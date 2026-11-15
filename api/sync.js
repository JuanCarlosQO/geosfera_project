// Vercel serverless function: station sync. Storage is Supabase (Postgres) when its settings are
// present; Upstash Redis is still supported as a fallback.

import { handle, CAS_SCRIPT } from "../lib/sync-handler.js";
import { supabaseStore, supabaseEnv } from "../lib/supabase-store.js";

function upstashStore() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const redis = async (command) => {
    const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(command) });
    const data = await r.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  };
  return { get: (k) => redis(["GET", k]), cas: (k, a, b, v) => redis(["EVAL", CAS_SCRIPT, "1", k, a, String(b), v]) };
}

function pickStore() {
  const sb = supabaseEnv(process.env);
  return sb ? supabaseStore(sb) : upstashStore();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const store = pickStore();
  if (!store) { res.status(503).json({ error: "Sync is not set up on the server yet (connect Supabase in Vercel and run supabase/schema.sql)." }); return; }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
    const out = await handle({ method: req.method, query: req.query, headers: req.headers, body }, store);
    res.status(out.status).json(out.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sync failed on the server. Check that supabase/schema.sql was run." });
  }
}
