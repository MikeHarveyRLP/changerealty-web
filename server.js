const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/config.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.send(`
window.APP_CONFIG = {
  API_BASE: ${JSON.stringify(process.env.PUBLIC_API_BASE || "https://changerealty-api-production.up.railway.app")},
  SANITY_STUDIO_ORIGIN: ${JSON.stringify(process.env.SANITY_STUDIO_ORIGIN || "")},
  GOOGLE_MAPS_API_KEY: ${JSON.stringify(process.env.GOOGLE_MAPS_API_KEY || "")}
};
  `);
});

// Public website copy only. Drafts and credentials are never returned here.
let homepageCache = null;
let homepageCacheAt = 0;
let homepageRequest = null;
app.get("/api/content/homepage", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=30");
  const project = String(process.env.SANITY_PROJECT_ID || "");
  const dataset = String(process.env.SANITY_DATASET || "production");
  if (!/^[a-z0-9]{3,32}$/.test(project) || !/^[a-z0-9_-]{1,64}$/.test(dataset)) return res.json({content:null});
  if (homepageCache && Date.now() - homepageCacheAt < 60000) return res.json({content:homepageCache});
  try {
    if (!homepageRequest) homepageRequest = (async () => {
      const query = '*[_type == "homepage" && _id == "homepage"][0]{heroEyebrow,heroTitle,searchLabel,searchPlaceholder,searchButton,experienceEyebrow,experienceTitle,experienceText,officeEyebrow,officeTitle,headingFont,bodyFont,heroSize,headingSize,bodySize,officeSize,"heroVideoUrl":heroVideo.asset->url,"heroPosterUrl":heroPoster.asset->url}';
      const params = new URLSearchParams({query,perspective:"published"});
      const response = await fetch("https://" + project + ".apicdn.sanity.io/v2025-02-19/data/query/" + dataset + "?" + params, {signal:AbortSignal.timeout(4000)});
      if (!response.ok) throw new Error("Content unavailable");
      const result = await response.json();
      if (result.result && typeof result.result === "object") { homepageCache = result.result; homepageCacheAt = Date.now(); }
      return result.result || null;
    })().finally(() => { homepageRequest = null; });
    return res.json({content:await homepageRequest});
  } catch {
    return res.json({content:homepageCache && Date.now()-homepageCacheAt < 900000 ? homepageCache : null});
  }
});

// Published page copy, with fixed document IDs and safe static fallback.
const pageIds = new Set(["about", "buying", "selling", "mortgage", "evaluation", "tools", "waste", "search"]);
const pageCache = new Map();
app.get("/api/content/pages/:page", async (req,res) => {
 res.setHeader("Cache-Control","public, max-age=30");
 const key=req.params.page;
 if(!pageIds.has(key))return res.status(404).json({content:null});
 const project=String(process.env.SANITY_PROJECT_ID||""),dataset=String(process.env.SANITY_DATASET||"production");
 if(!/^[a-z0-9]{3,32}$/.test(project)||!/^[a-z0-9_-]{1,64}$/.test(dataset))return res.json({content:null});
 const cached=pageCache.get(key);
 if(cached&&Date.now()-cached.at<60000)return res.json({content:cached.content});
 try {
  const query='*[_type == $type && _id == $id][0]{copy,headingFont,bodyFont,headingSize,bodySize,"portraitUrl":portrait.asset->url}';
  const params=new URLSearchParams({query,'$id':JSON.stringify('page-'+key),'$type':JSON.stringify('page_'+key),perspective:'published'});
  const response=await fetch('https://'+project+'.apicdn.sanity.io/v2025-02-19/data/query/'+dataset+'?'+params,{signal:AbortSignal.timeout(4000)});
  if(!response.ok)throw Error('Content unavailable');
  const content=(await response.json()).result||null;
  if(content)pageCache.set(key,{content,at:Date.now()});
  return res.json({content});
 }catch{return res.json({content:cached&&Date.now()-cached.at<900000?cached.content:null});}
});

app.use(express.static(path.join(__dirname, "public")));

app.get(["/studio", "/studio/*"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "studio", "index.html"));
});

app.get("/map", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "map.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Web server running on port", PORT);
});