// Station sync rules, with no DOM so Node can test them.
// Every device keeps working offline on its own copy (localStorage). When a device is linked
// to a station, its geosfera.* data is encrypted on the device with a key derived from the
// station code, and exchanged with the server as one opaque blob. The server cannot read it.

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const SYNC_KEY = "geosfera.sync";
export const LOCAL_ONLY = ["geosfera.crew-access", "geosfera.sync", "geosfera.theme", "geosfera.family", "geosfera.sound", "geosfera.mailbox", "geosfera.family-seen", "geosfera.lang", "geosfera.focus", "geosfera.actigraph", "geosfera.watch-seen", "geosfera.role", "geosfera.look"]; // never leave the device
export const ROUNDS = 150_000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I

export function newStationId(rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  const b = rand(6);
  return `ERG-${Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("")}`;
}

export const validStationId = (id) => /^(ERG|GSF)-[A-HJ-NP-Z2-9]{6}$/.test(String(id ?? "").trim().toUpperCase());
export const normaliseId = (id) => String(id ?? "").trim().toUpperCase();
export const validCode = (code) => typeof code === "string" && code.trim().length >= 8;

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (bytes) => Array.from(new Uint8Array(bytes), (x) => x.toString(16).padStart(2, "0")).join("");

/** Two independent secrets from one code: a token that proves membership, and an AES key. */
export async function deriveSecrets(code, stationId, rounds = ROUNDS) {
  const base = await subtle().importKey("raw", enc.encode(code.trim()), "PBKDF2", false, ["deriveBits"]);
  const bits = async (purpose) => new Uint8Array(await subtle().deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(`geosfera:${normaliseId(stationId)}:${purpose}`), iterations: rounds }, base, 256));
  return { token: hex(await bits("auth")), key: b64(await bits("enc")) };
}

async function aesKey(keyB64) {
  return subtle().importKey("raw", unb64(keyB64), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(obj, keyB64) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, await aesKey(keyB64), enc.encode(JSON.stringify(obj)));
  return { v: 1, iv: b64(iv), ct: b64(ct) };
}

/** Returns the object, or null when the key is wrong or the blob was altered. */
export async function open(blob, keyB64) {
  try {
    const pt = await subtle().decrypt({ name: "AES-GCM", iv: unb64(blob.iv) }, await aesKey(keyB64), unb64(blob.ct));
    return JSON.parse(dec.decode(pt));
  } catch {
    return null;
  }
}

/** A cheap, stable fingerprint to notice local edits between syncs. */
export function fingerprint(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/**
 * Snapshot of the syncable data. stamps tells when each key last changed on this device
 * (kept in geosfera.sync between syncs); a key that disappeared becomes a tombstone.
 * entries: { key: rawStringOrNull }, prev: { key: { h, at, deleted? } }
 */
export function snapshot(entries, prev = {}, now = Date.now()) {
  const keys = {};
  const stamps = {};
  for (const [k, raw] of Object.entries(entries)) {
    if (LOCAL_ONLY.includes(k) || !k.startsWith("geosfera.")) continue;
    const h = fingerprint(raw);
    stamps[k] = prev[k] && prev[k].h === h && !prev[k].deleted ? prev[k] : { h, at: now };
    keys[k] = raw;
  }
  for (const [k, st] of Object.entries(prev)) {
    if (!(k in keys)) stamps[k] = st.deleted ? st : { h: "", at: now, deleted: true };
  }
  return { keys, stamps };
}

const isLogKey = (k) => k.startsWith("geosfera.log.");
const parse = (raw) => { try { return JSON.parse(raw); } catch { return null; } };

/** Day-by-day merge of two member logs: for each day the most recently saved entry wins. */
export function mergeLog(a, b) {
  const out = { ...(a ?? {}) };
  for (const [day, e] of Object.entries(b ?? {})) {
    const mine = out[day];
    if (!mine || String(e?.savedAt ?? "") > String(mine?.savedAt ?? "")) out[day] = e;
  }
  return out;
}

/**
 * Merges two snapshots. Logs merge per day; every other key (crew, medications, duty,
 * mission) takes the newer version, and a newer deletion wins over an older edit.
 */
export function mergeSnapshots(local, remote) {
  const keys = {};
  const stamps = {};
  const all = new Set([...Object.keys(local.stamps ?? {}), ...Object.keys(remote?.stamps ?? {})]);
  for (const k of all) {
    const L = local.stamps?.[k];
    const R = remote?.stamps?.[k];
    const newer = !R || (L && L.at >= R.at) ? "local" : "remote";
    const win = newer === "local" ? L : R;
    if (isLogKey(k) && !L?.deleted && !R?.deleted && local.keys?.[k] != null && remote?.keys?.[k] != null) {
      const merged = JSON.stringify(mergeLog(parse(local.keys[k]), parse(remote.keys[k])));
      keys[k] = merged;
      stamps[k] = { h: fingerprint(merged), at: Math.max(L?.at ?? 0, R?.at ?? 0) };
      continue;
    }
    stamps[k] = win;
    if (!win.deleted) keys[k] = newer === "local" ? local.keys[k] : remote.keys[k];
  }
  return { keys, stamps };
}

export const sameSnapshot = (a, b) => JSON.stringify(a?.keys ?? {}) === JSON.stringify(b?.keys ?? {})
  && JSON.stringify(Object.keys(a?.stamps ?? {}).sort()) === JSON.stringify(Object.keys(b?.stamps ?? {}).sort());
