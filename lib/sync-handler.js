// Server side of station sync, independent of the storage so it can be tested.
// Stores per station: { authHash, version, blob, updatedAt }. The blob is AES-GCM ciphertext
// made on the device; the server only checks the token and the version.

import { createHash } from "node:crypto";

export const MAX_BLOB_CHARS = 900_000;
const ID = /^GSF-[A-HJ-NP-Z2-9]{6}$/;
const TOKEN = /^[0-9a-f]{64}$/;

const sha = (s) => createHash("sha256").update(s).digest("hex");
const reply = (status, body) => ({ status, body });

/**
 * store: { get(key) -> string|null, cas(key, authHash, baseVersion, newValue) -> "OK" | "AUTH" | currentString }
 * cas must create the record when it does not exist, and compare-and-set atomically otherwise.
 */
export async function handle({ method, query, headers, body }, store) {
  const station = String(query?.station ?? "").toUpperCase();
  const token = String(headers?.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!ID.test(station)) return reply(400, { error: "Bad station ID." });
  if (!TOKEN.test(token)) return reply(401, { error: "Missing or bad token." });
  const key = `geosfera:station:${station}`;
  const authHash = sha(`${station}:${token}`);

  if (method === "GET") {
    const raw = await store.get(key);
    if (!raw) return reply(404, { error: "No station with this ID yet." });
    const rec = JSON.parse(raw);
    if (rec.authHash !== authHash) return reply(403, { error: "Wrong station code." });
    return reply(200, { version: rec.version, blob: rec.blob, updatedAt: rec.updatedAt });
  }

  if (method === "PUT") {
    const blob = body?.blob;
    const base = Number(body?.baseVersion ?? 0);
    if (!blob || typeof blob.iv !== "string" || typeof blob.ct !== "string") return reply(400, { error: "Bad blob." });
    if (blob.ct.length > MAX_BLOB_CHARS) return reply(413, { error: "Too much data for one station." });
    const next = { authHash, version: base + 1, blob, updatedAt: new Date().toISOString() };
    const r = await store.cas(key, authHash, base, JSON.stringify(next));
    if (r === "OK") return reply(200, { version: next.version, updatedAt: next.updatedAt });
    if (r === "AUTH") return reply(403, { error: "Wrong station code." });
    const cur = JSON.parse(r);
    return reply(409, { error: "Changed on another device.", version: cur.version, blob: cur.blob });
  }

  return reply(405, { error: "Use GET or PUT." });
}

/** Lua compare-and-set for Redis (Upstash runs it atomically). */
export const CAS_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
if cur then
  local d = cjson.decode(cur)
  if d.authHash ~= ARGV[1] then return 'AUTH' end
  if tonumber(d.version) ~= tonumber(ARGV[2]) then return cur end
elseif tonumber(ARGV[2]) ~= 0 then
  return '{"version":0,"blob":null}'
end
redis.call('SET', KEYS[1], ARGV[3])
return 'OK'`;

/** In-memory store with the same rules, for tests and local preview. */
export function memoryStore() {
  const m = new Map();
  return {
    async get(k) { return m.get(k) ?? null; },
    async cas(k, authHash, base, value) {
      const cur = m.get(k);
      if (cur) {
        const d = JSON.parse(cur);
        if (d.authHash !== authHash) return "AUTH";
        if (Number(d.version) !== Number(base)) return cur;
      } else if (Number(base) !== 0) return '{"version":0,"blob":null}';
      m.set(k, value);
      return "OK";
    }
  };
}
