/* ============================================================================
   The Capitalist Caucus — static site + newsletter sign-up API.
   Zero dependencies: uses only Node's built-in modules.

   Run:   node server.js
   Then:  open http://localhost:3000

   Subscribers are appended to subscribers.json in this folder.
   ============================================================================ */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
// Store path is overridable so it can point at a mounted persistent disk/volume.
const DB = process.env.DB_PATH || path.join(ROOT, "subscribers.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

/* ---------- tiny JSON "database" ---------- */
function readSubs() {
  try {
    return JSON.parse(fs.readFileSync(DB, "utf8"));
  } catch (_) {
    return [];
  }
}
function writeSubs(list) {
  fs.writeFileSync(DB, JSON.stringify(list, null, 2));
}

function isEmail(v) {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}

/* ---------- helpers ---------- */
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  // Resolve and confine to ROOT (prevent path traversal).
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

/* ---------- request router ---------- */
const server = http.createServer((req, res) => {
  const urlPath = req.url.split("?")[0];

  // GET /api/count  -> number of subscribers
  if (req.method === "GET" && urlPath === "/api/count") {
    return sendJSON(res, 200, { count: readSubs().length });
  }

  // POST /api/subscribe  { email, name }
  if (req.method === "POST" && urlPath === "/api/subscribe") {
    let raw = "";
    let tooBig = false;
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 10_000) { tooBig = true; req.destroy(); }
    });
    req.on("end", () => {
      if (tooBig) return sendJSON(res, 413, { error: "Payload too large." });
      let body;
      try { body = JSON.parse(raw || "{}"); }
      catch (_) { return sendJSON(res, 400, { error: "Invalid JSON." }); }

      const email = String(body.email || "").trim().toLowerCase();
      const name = String(body.name || "").trim().slice(0, 80);

      if (!isEmail(email)) {
        return sendJSON(res, 400, { error: "Please enter a valid email address." });
      }

      const subs = readSubs();
      if (subs.some((s) => s.email === email)) {
        return sendJSON(res, 200, { ok: true, already: true });
      }

      subs.push({
        id: crypto.randomUUID(),
        email,
        name,
        subscribedAt: new Date().toISOString()
      });
      try {
        writeSubs(subs);
      } catch (e) {
        return sendJSON(res, 500, { error: "Could not save subscription." });
      }
      return sendJSON(res, 201, { ok: true, already: false });
    });
    return;
  }

  // Everything else: static files
  if (req.method === "GET" || req.method === "HEAD") {
    return serveStatic(req, res);
  }

  res.writeHead(405, { "Content-Type": "text/plain" }).end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`\n  The Capitalist Caucus is serving at http://localhost:${PORT}`);
  console.log(`  Subscribers file: ${DB}\n`);
});
