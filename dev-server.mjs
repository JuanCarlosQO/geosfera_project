// Local preview with sync: serves the site and /api/sync from an in-memory store.
// npm run dev → http://localhost:8000 (data is lost when the server stops).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { handle, memoryStore } from "./lib/sync-handler.js";

const store = memoryStore();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png" };
const port = Number(process.env.PORT || 8000);

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/sync") {
    let raw = "";
    for await (const c of req) raw += c;
    const out = await handle({ method: req.method, query: Object.fromEntries(url.searchParams), headers: req.headers, body: raw ? JSON.parse(raw) : undefined }, store);
    res.writeHead(out.status, { "Content-Type": "application/json" }).end(JSON.stringify(out.body));
    return;
  }
  const path = normalize(join(process.cwd(), url.pathname === "/" ? "index.html" : url.pathname));
  if (!path.startsWith(process.cwd())) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream" }).end(await readFile(path)); }
  catch { res.writeHead(404).end("Not found"); }
}).listen(port, () => console.log(`Ergosphere with sync on http://localhost:${port}`));
