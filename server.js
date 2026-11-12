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
  GOOGLE_MAPS_API_KEY: ${JSON.stringify(process.env.GOOGLE_MAPS_API_KEY || "")}
};
  `);
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/map", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "map.html"));
});

app.get("/", (req, res) => {
  res.redirect("/map");
});

app.listen(PORT, () => {
  console.log("Web server running on port", PORT);
});