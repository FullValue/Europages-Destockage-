// Compack — serveur local : sites (public/) + API (lib/app.js).
// En ligne sur Vercel, les fichiers de public/ sont servis directement et l'API passe par api/handler.js.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleApi, MIME, send, fail, PUB } = require("./lib/app.js");
const store = require("./lib/store.js");

const PORT = +process.env.PORT || 5173;

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === "/") p = "/index.html";
  if (["/destock", "/market", "/admin"].includes(p)) return send(res, 301, "", { Location: p + "/" });
  if (p.endsWith("/")) p += "index.html";
  const file = path.normalize(path.join(PUB, p));
  if (!file.startsWith(PUB)) return fail(res, 403, "Interdit");
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, "Page introuvable", { "Content-Type": "text/html; charset=utf-8" });
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": p.startsWith("/assets/") ? "public, max-age=3600" : "no-cache" });
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) await handleApi(req, res);
    else serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) fail(res, 500, e.message || "Erreur serveur");
  }
}).listen(PORT, () => console.log(`Compack en ligne sur http://localhost:${PORT}  (Destock /destock · Market /market · Admin /admin) — base : ${store.mode}`));
