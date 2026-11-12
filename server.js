require("dotenv").config();
const cors = require("cors");
const express = require("express");
const { Pool } = require("pg");
const cron = require("node-cron");
const runSync = require("./sync-runner");
const twilio = require("twilio");

const app = express();
app.use(express.json());

const connectionString = process.env.SUPABASE_DATABASE_URL;
if (!connectionString) throw new Error("SUPABASE_DATABASE_URL is not set");

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10
});

// Schedule sync every 15 minutes (does not crash server on errors)
let syncRunning = false;

cron.schedule("*/15 * * * *", async () => {
  if (syncRunning) {
    console.log("Sync skipped (previous run still running)");
    return;
  }

  syncRunning = true;
  console.log("Running scheduled sync...");

  try {
    const result = await runSync({ pool });
    console.log("Sync done:", result);
  } catch (err) {
    console.error("Sync failed:", err?.message || err);
  } finally {
    syncRunning = false;
  }
});

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://changerealty-web-production.up.railway.app"
  ]
}));

app.post("/api/sync", async (req, res) => {
  try {
    console.log("Manual sync triggered");
    const result = await runSync({ pool });
    res.json({ ok: true, result });
  } catch (err) {
    console.error("Manual sync failed:", err?.message || err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.get("/api/version", (req, res) => {
  res.json({ version: "2026-02-25-A" });
});

app.get("/api/sync/status", async (req, res) => {
  try {
    const [state, lock, progress] = await Promise.all([
      pool.query(`
        select last_listing_modified_at, updated_at
        from public.sync_state
        where id = 'crea_ddf'
      `),
      pool.query(`
        select name, locked_at
        from public.sync_locks
        where name = 'crea_ddf_sync'
      `),
      pool.query(`
        select
          name,
          status,
          started_at,
          heartbeat_at,
          finished_at,
          current_since,
          pages_processed,
          rows_seen,
          listings_upserted,
          offices_seen,
	  phase,
          last_error
        from public.sync_progress
        where name = 'crea_ddf_sync'
      `)
    ]);

    const stateRow = state.rows[0] || null;
    const lockRow = lock.rows[0] || null;
    const progressRow = progress.rows[0] || null;

    let lag = null;
    if (stateRow?.last_listing_modified_at) {
      const now = Date.now();
      const ts = new Date(stateRow.last_listing_modified_at).getTime();
      const diffMs = Math.max(0, now - ts);
      lag = {
        ms: diffMs,
        hours: Math.floor(diffMs / (1000 * 60 * 60)),
        days: Math.floor(diffMs / (1000 * 60 * 60 * 24))
      };
    }
let speed = null;

if (progressRow?.started_at) {
  const startedMs = new Date(progressRow.started_at).getTime();
  const endedMs = progressRow.finished_at
    ? new Date(progressRow.finished_at).getTime()
    : Date.now();

  const elapsedMs = Math.max(1, endedMs - startedMs);
  const elapsedMinutes = elapsedMs / 60000;

  speed = {
    elapsed_minutes: Number(elapsedMinutes.toFixed(2)),
    pages_per_minute: Number(((progressRow.pages_processed || 0) / elapsedMinutes).toFixed(2)),
    rows_per_minute: Number(((progressRow.rows_seen || 0) / elapsedMinutes).toFixed(2)),
    upserts_per_minute: Number(((progressRow.listings_upserted || 0) / elapsedMinutes).toFixed(2))
  };
}
let running = false;

if (lockRow?.locked_at) {
  const lockAgeMs = Date.now() - new Date(lockRow.locked_at).getTime();
  const heartbeatAgeMs = progressRow?.heartbeat_at
    ? Date.now() - new Date(progressRow.heartbeat_at).getTime()
    : Number.MAX_SAFE_INTEGER;

  // Consider sync live only if lock exists and heartbeat is recent
  running = lockAgeMs < 10 * 60 * 1000 && heartbeatAgeMs < 10 * 60 * 1000;
}
let stale = false;

if (lockRow?.locked_at) {
  const lockAgeMs = Date.now() - new Date(lockRow.locked_at).getTime();
  stale = lockAgeMs >= 10 * 60 * 1000;
}
    res.json({
      running,
      stale,
      lock: lockRow,
      state: stateRow,
      progress: progressRow,
      lag,speed
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// BBOX search + advanced filters
app.get("/api/listings", async (req, res) => {
  try {
    const west = Number(req.query.west);
    const south = Number(req.query.south);
    const east = Number(req.query.east);
    const north = Number(req.query.north);

    const hasBbox = [west, south, east, north].every(Number.isFinite);

if (hasBbox && !(west < east && south < north)) {
  return res.status(400).json({ error: "Invalid bbox (west<east and south<north required)" });
}

    // mode: sale (default) | lease | all
    const mode = String(req.query.mode || "sale").toLowerCase();
    if (!["sale", "lease", "all"].includes(mode)) {
      return res.status(400).json({ error: "Invalid mode (sale|lease|all)" });
    }

    // Filters
    const minPrice = req.query.minPrice !== undefined ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined;
    const minBeds  = req.query.minBeds  !== undefined ? Number(req.query.minBeds)  : undefined;
    const maxBeds  = req.query.maxBeds  !== undefined ? Number(req.query.maxBeds)  : undefined;
    const minBaths = req.query.minBaths !== undefined ? Number(req.query.minBaths) : undefined;
    const maxBaths = req.query.maxBaths !== undefined ? Number(req.query.maxBaths) : undefined;

    for (const [k, v] of [
      ["minPrice", minPrice], ["maxPrice", maxPrice],
      ["minBeds", minBeds],   ["maxBeds", maxBeds],
      ["minBaths", minBaths], ["maxBaths", maxBaths],
    ]) {
      if (v !== undefined && !Number.isFinite(v)) {
        return res.status(400).json({ error: `Invalid ${k}` });
      }
    }

// NEW filters
const cityCsv = req.query.city ? String(req.query.city) : "";
const cities = cityCsv.trim()
  ? cityCsv.split(",").map(s => s.trim()).filter(Boolean)
  : [];

const minSqft = req.query.minSqft !== undefined ? Number(req.query.minSqft) : undefined;
const maxSqft = req.query.maxSqft !== undefined ? Number(req.query.maxSqft) : undefined;

const qRaw = req.query.q ? String(req.query.q).trim() : "";
const q = qRaw.length ? qRaw : "";

if (minSqft !== undefined && !Number.isFinite(minSqft)) {
  return res.status(400).json({ error: "Invalid minSqft" });
}
if (maxSqft !== undefined && !Number.isFinite(maxSqft)) {
  return res.status(400).json({ error: "Invalid maxSqft" });
}

    // status override (optional). If omitted, keep your default.
    // Accept CSV: status=active,conditional
    const statusCsv = req.query.status ? String(req.query.status) : "";
    const statuses =
      statusCsv.trim()
        ? statusCsv.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
        : ["active", "conditional"];

    // limit override (optional)
    const limit = Math.min(
      req.query.limit !== undefined ? Number(req.query.limit) : 250,
      500
    );
    if (!Number.isFinite(limit) || limit <= 0) {
      return res.status(400).json({ error: "Invalid limit" });
    }

    // Optional property type filter (only if you have a column)
    // const propertyTypeCsv = req.query.propertyType ? String(req.query.propertyType) : "";
    // const propertyTypes = propertyTypeCsv.trim()
    //   ? propertyTypeCsv.split(",").map(s => s.trim()).filter(Boolean)
    //   : [];

    const buildingType = String(req.query.buildingType || "");
    if (buildingType && !["house","townhouse","apartment","multi_unit","other"].includes(buildingType)) {
      return res.status(400).json({error:"Invalid building type."});
    }
    const where = [];
const params = [];

// helper: pushes value and returns its $ placeholder
const P = (val) => {
  params.push(val);
  return `$${params.length}`;
};

// Base where
if (hasBbox) {
  where.push(`l.geom is not null`);
}

// status list
where.push(`l.status = ANY(${P(statuses)})`);

// mode filter
if (mode === "sale") where.push(`l.is_lease = false`);
if (mode === "lease") where.push(`l.is_lease = true`);

// data presence filter
if (mode === "sale") where.push(`l.list_price is not null`);
else if (mode === "lease") where.push(`l.lease_amount is not null`);
else where.push(`(l.list_price is not null OR l.lease_amount is not null)`);

// bbox (4 params, always)
if (hasBbox) {
  where.push(`l.geom && st_makeenvelope(${P(west)}, ${P(south)}, ${P(east)}, ${P(north)}, 4326)`);
}

// city filter (CSV) - case-insensitive recommended
if (cities.length) {
  where.push(`lower(l.city) = ANY(${P(cities.map(c => c.toLowerCase()))})`);
}

// living area sqft
if (minSqft !== undefined) where.push(`l.living_area_sqft >= ${P(minSqft)}`);
if (maxSqft !== undefined) where.push(`l.living_area_sqft <= ${P(maxSqft)}`);

// keyword search
if (q) {
  const like = `%${q}%`;
where.push(`(
  l.address_full ILIKE ${P(like)}
  OR l.public_remarks ILIKE ${P(like)}
  OR l.mls_number ILIKE ${P(like)}
)`);
}

// beds/baths
if (minBeds !== undefined)  where.push(`l.bedrooms_total >= ${P(minBeds)}`);
if (maxBeds !== undefined)  where.push(`l.bedrooms_total <= ${P(maxBeds)}`);
if (minBaths !== undefined) where.push(`l.bathrooms_total >= ${P(minBaths)}`);
if (maxBaths !== undefined) where.push(`l.bathrooms_total <= ${P(maxBaths)}`);

// Building type is independent of ownership (e.g. a condo townhouse).
if (buildingType) {
  where.push(`(select CASE
 WHEN building_text ~ '(^| )(duplex|triplex|fourplex|multiplex|multi family|multi unit)($| )' THEN 'multi_unit'
 WHEN building_text ~ '(^| )(townhouse|townhome|row|terrace|terraced)($| )' THEN 'townhouse'
 WHEN building_text ~ '(^| )(apartment|flat)($| )' THEN 'apartment'
 WHEN building_text ~ '(^| )(house|bungalow|detached|semi detached|manufactured|mobile home|modular home)($| )' THEN 'house'
 ELSE 'other' END from (select regexp_replace(lower(coalesce(
    nullif(nullif(l.raw->>'StructureType','[]'),''),
    nullif(nullif(l.raw->>'BuildingType','[]'),''),
    nullif(l.raw#>>'{Building,Type}',''),
    nullif(l.raw->>'PropertySubType',''),'')
  ),'[^a-z0-9]+',' ','g') as building_text) bt) = ${P(buildingType)}`);
}

// price filter
if (minPrice !== undefined || maxPrice !== undefined) {
  const lo = minPrice ?? 0;
  const hi = maxPrice ?? Number.MAX_SAFE_INTEGER;

  if (mode === "sale") {
    where.push(`l.list_price BETWEEN ${P(lo)} AND ${P(hi)}`);
  } else if (mode === "lease") {
    where.push(`l.lease_amount BETWEEN ${P(lo)} AND ${P(hi)}`);
  } else {
    where.push(`l.effective_price BETWEEN ${P(lo)} AND ${P(hi)}`);
  }
}

const sql = `
  with filtered as (
    select
      l.id,
      l.source,
      l.list_office_key,
      l.listing_key,
      l.mls_number,
      l.status,
      l.list_price,
      l.is_lease,
      l.lease_amount,
      l.lease_per_unit,
      l.bedrooms_total,
      l.bathrooms_total,
      l.address_full,
      l.city,
      l.province,
      l.lat,
      l.lng,
      l.raw,
      l.last_modified_at
    from listings l
    where ${where.join("\n      and ")}
    order by l.last_modified_at desc nulls last, l.id desc
    limit ${P(limit)}
  )
  select
    f.id,
    f.listing_key,
    f.mls_number,
    f.status,
    f.list_price,
    f.is_lease,
    f.lease_amount,
    f.lease_per_unit,
    f.bedrooms_total,
    f.bathrooms_total,
    f.address_full,
    f.city,
    f.province,
    f.lat,
    f.lng,
    f.raw,
    o.office_name as brokerage_name,
    ph.url as photo
  from filtered f
  left join offices o
    on o.source = f.source
    and o.office_key = f.list_office_key
  left join lateral (
    select url
    from listing_photos p
    where p.listing_id = f.id
    order by p.position asc
    limit 1
  ) ph on true
  order by f.last_modified_at desc nulls last, f.id desc
`;
    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Public lead-form rate limiting. This is intentionally simple and in-memory.
// Railway restarts clear it, which is fine for basic abuse protection.
const inquiryRate = new Map();

function cleanText(value, maxLength = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function compactDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value.replace(/\s+/g, "");
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    return value.replace(/\s+/g, "");
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[Number(month) - 1] + Number(day);
}

function compactTime(value) {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  const match = /^(\d{1,2}):(\d{2})$/.exec(compact);
  if (!match) return compact;
  const hour = Number(match[1]);
  if (hour > 23 || Number(match[2]) > 59) return compact;
  return (hour % 12 || 12) + ":" + match[2] + (hour < 12 ? "AM" : "PM");
}

function allowInquiry(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxRequests = 5;
  const key = String(ip || "unknown");
  const recent = (inquiryRate.get(key) || []).filter(ts => now - ts < windowMs);

  if (recent.length >= maxRequests) {
    inquiryRate.set(key, recent);
    return false;
  }

  recent.push(now);
  inquiryRate.set(key, recent);
  return true;
}

app.post("/api/inquiries", async (req, res) => {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress;

    if (!allowInquiry(ip)) {
      return res.status(429).json({ error: "Too many requests. Please wait a few minutes and try again." });
    }

    const body = req.body || {};

    // Honeypot: real visitors never see or fill this field.
    if (cleanText(body.website, 100)) {
      return res.json({ ok: true });
    }

    const type = cleanText(body.type, 30);
    const name = cleanText(body.name, 100);
    const email = cleanText(body.email, 160);
    const phone = cleanText(body.phone, 30);
    const contactPreference = cleanText(body.contactPreference, 20).toLowerCase();
    const preferredDate = cleanText(body.preferredDate, 30);
    const preferredTime = cleanText(body.preferredTime, 50);
    const message = cleanText(body.message, 1000);
    const listingKey = cleanText(body.listingKey, 50);
    const mlsNumber = cleanText(body.mlsNumber, 50);
    const address = cleanText(body.address, 250);

    if (!["book_showing", "request_info", "mortgage_consultant"].includes(type)) {
      return res.status(400).json({ error: "Invalid inquiry type." });
    }

    if (!name) {
      return res.status(400).json({ error: "Please enter your name." });
    }

    if (!["text", "call", "email"].includes(contactPreference)) {
      return res.status(400).json({ error: "Please choose a contact preference." });
    }

    if ((contactPreference === "text" || contactPreference === "call") && !phone) {
      return res.status(400).json({ error: "A phone number is required for text or phone contact." });
    }

    if (contactPreference === "email" && !email) {
      return res.status(400).json({ error: "An email address is required for email contact." });
    }

    if (type === "request_info" && !message) {
      return res.status(400).json({ error: "Please enter your question." });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const leadNumber = process.env.LEAD_NOTIFICATION_PHONE;

    if (!accountSid || !authToken || !fromNumber || !leadNumber) {
      console.error("Lead SMS configuration is incomplete.");
      return res.status(503).json({ error: "Lead notifications are temporarily unavailable." });
    }

    const isShowing = type === "book_showing";
    const isMortgage = type === "mortgage_consultant";
    const isAppointment = isShowing || isMortgage;
    const lines = [
      isMortgage ? "Mortgage lead" : isShowing ? "Showing lead" : "Info lead",
      (address || "Address unavailable").replace(/\s*,\s*/g, ","),
      mlsNumber ? `MLS:${mlsNumber}` : "",
      name,
      phone,
      email,
      `Contact:${contactPreference === "call" ? "Phone call" : contactPreference === "text" ? "Text" : "Email"}`,
      isAppointment && preferredDate ? `Date:${compactDate(preferredDate)}` : "",
      isAppointment && preferredTime ? `Time:${compactTime(preferredTime)}` : "",
      message ? `${isAppointment ? "Message" : "Question"}:${message}` : ""
    ].filter(Boolean);

    const client = twilio(accountSid, authToken);
    const sent = await client.messages.create({
      body: lines.join("\n"),
      from: fromNumber,
      to: leadNumber
    });

    console.log("Lead SMS sent:", sent.sid, type, listingKey || mlsNumber || address);
    res.json({ ok: true });
  } catch (e) {
    console.error("Lead inquiry failed:", e?.message || e);
    res.status(500).json({ error: "Unable to send the request right now. Please try again." });
  }
});

app.get("/api/listings/:listing_key", async (req, res) => {
  try {
    const listingKey = String(req.params.listing_key || "").trim();

    if (!listingKey) {
      return res.status(400).json({ error: "Missing listing_key" });
    }

    const sql = `
      select
        l.id,
        l.source,
        l.list_office_key,
        l.listing_key,
        l.mls_number,
        l.status,
        l.list_price,
        l.is_lease,
        l.lease_amount,
        l.lease_per_unit,
        l.bedrooms_total,
        l.bathrooms_total,
        l.address_full,
        l.city,
        l.province,
        l.postal_code,
        l.lat,
        l.lng,
        l.public_remarks,
        l.last_modified_at,
	l.raw,
        o.office_name as brokerage_name,
        ph.url as photo
      from listings l
      left join offices o
        on o.source = l.source
        and o.office_key = l.list_office_key
      left join lateral (
        select url
        from listing_photos p
        where p.listing_id = l.id
        order by p.position asc
        limit 1
      ) ph on true
      where l.listing_key = $1
      limit 1
    `;

    const r = await pool.query(sql, [listingKey]);

    if (r.rows.length === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }

    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on ${port}`));
