const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/map", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "map.html"));
});

app.get("/config.js", (req, res) => {
  res.type("application/javascript").send(`
    window.APP_CONFIG = {
      API_BASE: "${process.env.PUBLIC_API_BASE || "https://changerealty-api-production.up.railway.app"}",
      GOOGLE_MAPS_API_KEY: "${process.env.GOOGLE_MAPS_API_KEY || ""}"
    };
  `);
});

app.listen(PORT, () => {
  console.log("Web server running on port", PORT);
});