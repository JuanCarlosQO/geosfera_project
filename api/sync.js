// Vercel serverless function: station sync backed by Upstash Redis (Vercel Marketplace).
// Vercel injects the database URL and token as environment variables when Upstash is added.

import { handle, CAS_SCRIPT } from "../lib/sync-handler.js";

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(command) });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

const store = {
  get: (k) => redis(["GET", k]),
  cas: (k, authHash, base, value) => redis(["EVAL", CAS_SCRIPT, "1", k, authHash, String(base), value])
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!URL_ || !TOKEN) { res.status(503).json({ error: "Sync is not set up on the server yet (add Upstash Redis in Vercel)." }); return; }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const out = await handle({ method: req.method, query: req.query, headers: req.headers, body }, store);
    res.status(out.status).json(out.body);
  } catch {
    res.status(500).json({ error: "Sync failed on the server." });
  }
}
