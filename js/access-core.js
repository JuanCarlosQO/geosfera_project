// Ergosphere crew access: the rules behind the hatch, with no DOM so Node can test them.
// Honest scope: this is a device lock, not encryption.

export const DIGITS = 4;
export const ROUNDS = 210_000;          // PBKDF2-HMAC-SHA256 work factor (OWASP 2023)
export const GRACE_TRIES = 5;           // wrong codes allowed before waiting
export const BASE_DELAY_MS = 30_000;    // first wait
export const CAP_DELAY_MS = 900_000;    // longest wait (15 min)

const cryptoApi = () => globalThis.crypto;
const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder();

/* ---------------- code shape ---------------- */

export function codeShapeOk(code) {
  return typeof code === "string" && code.length === DIGITS && /^[0-9]+$/.test(code);
}

/** True for codes anyone would try first: 0000, 1234, 9876, 1212. */
export function guessable(code) {
  if (!codeShapeOk(code)) return true;
  const n = code.split("").map(Number);
  const steps = n.slice(1).map((v, i) => v - n[i]);
  const allSame = steps.every((s) => s === 0);
  const run = steps.every((s) => s === 1) || steps.every((s) => s === -1);
  const pairs = n[0] === n[2] && n[1] === n[3];
  return allSame || run || pairs;
}

/* ---------------- byte helpers ---------------- */

export function b64u(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  arr.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function unb64u(text) {
  const std = text.replaceAll("-", "+").replaceAll("_", "/");
  const padded = std + "=".repeat((4 - (std.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
}

export function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i += 1) acc |= a[i] ^ b[i];
  return acc === 0;
}

export const freshBytes = (n) => cryptoApi().getRandomValues(new Uint8Array(n));

const digest256 = async (bytes) => new Uint8Array(await cryptoApi().subtle.digest("SHA-256", bytes));

/* ---------------- code record ---------------- */

async function stretch(code, salt, rounds) {
  const base = await cryptoApi().subtle.importKey("raw", utf8.encode(code), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await cryptoApi().subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, base, 256);
  return new Uint8Array(bits);
}

/** What gets saved on the device. The code itself never is. */
export async function deriveRecord(code, { salt = freshBytes(16), rounds = ROUNDS } = {}) {
  if (!codeShapeOk(code)) throw new TypeError(`The code must have ${DIGITS} digits.`);
  return { version: 1, kdf: "pbkdf2-sha256", rounds, salt: b64u(salt), digest: b64u(await stretch(code, salt, rounds)) };
}

export async function matches(code, record) {
  if (!codeShapeOk(code) || record?.version !== 1) return false;
  const again = await stretch(code, unb64u(record.salt), record.rounds);
  return equalBytes(again, unb64u(record.digest));
}

/* ---------------- wrong-code waits ---------------- */

export function delayFor(misses) {
  if (misses < GRACE_TRIES) return 0;
  return Math.min(BASE_DELAY_MS * 2 ** (misses - GRACE_TRIES), CAP_DELAY_MS);
}

export function afterMiss(state, now) {
  const misses = (state?.misses ?? 0) + 1;
  const delay = delayFor(misses);
  return { misses, until: delay > 0 ? now + delay : 0 };
}

export const msLeft = (state, now) => Math.max(0, (state?.until ?? 0) - now);
export const attemptsRemaining = (state) => Math.max(0, GRACE_TRIES - (state?.misses ?? 0));
export const cleanSlate = () => ({ misses: 0, until: 0 });

/** Storage keys that belong to Ergosphere. Other apps on the same domain are never touched. */
export const appKeys = (keys) => keys.filter((k) => k.startsWith("geosfera."));

/* ---------------- fingerprint / face (WebAuthn) ---------------- */

export function readAuthenticatorData(raw) {
  const d = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  if (d.byteLength < 37) throw new RangeError("authenticatorData is too short");
  const flags = d[32];
  const counter = new DataView(d.buffer, d.byteOffset + 33, 4).getUint32(0, false);
  return { rpIdHash: d.subarray(0, 32), present: (flags & 1) === 1, verified: (flags & 4) === 4, counter };
}

/** Authenticators sign ECDSA in DER; WebCrypto verifies the fixed-width r||s form. */
export function ecdsaDerToP1363(der, width = 32) {
  const d = der instanceof Uint8Array ? der : new Uint8Array(der);
  if (d[0] !== 0x30) throw new SyntaxError("Expected a DER SEQUENCE");
  let pos = d[1] & 0x80 ? 2 + (d[1] & 0x7f) : 2;
  const out = new Uint8Array(width * 2);
  for (const slot of [0, 1]) {
    if (d[pos] !== 0x02) throw new SyntaxError("Expected a DER INTEGER");
    const len = d[pos + 1];
    let v = d.subarray(pos + 2, pos + 2 + len);
    while (v.length > width && v[0] === 0) v = v.subarray(1);
    if (v.length > width) throw new RangeError("INTEGER wider than the curve");
    out.set(v, slot * width + width - v.length);
    pos += 2 + len;
  }
  return out;
}

const no = (why) => ({ ok: false, why });

/**
 * Verifies what the phone returned after the fingerprint or face check.
 * want: { challenge, origin, rpId, key (b64u SPKI), alg (-7 ES256 | -257 RS256) }
 * got:  { authenticatorData, clientDataJSON, signature } as bytes
 */
export async function checkAssertion(want, got) {
  let client;
  try { client = JSON.parse(fromUtf8.decode(got.clientDataJSON)); } catch { return no("The phone's answer could not be read."); }
  if (client.type !== "webauthn.get") return no("Unexpected answer type.");
  if (client.challenge !== b64u(want.challenge)) return no("The answer was for another request.");
  if (client.origin !== want.origin) return no("The answer came from another site.");

  const auth = readAuthenticatorData(got.authenticatorData);
  if (!equalBytes(auth.rpIdHash, await digest256(utf8.encode(want.rpId)))) return no("The answer came from another site.");
  if (!auth.present || !auth.verified) return no("The fingerprint or face was not confirmed.");

  const authBytes = new Uint8Array(got.authenticatorData);
  const clientHash = await digest256(new Uint8Array(got.clientDataJSON));
  const message = new Uint8Array(authBytes.length + clientHash.length);
  message.set(authBytes);
  message.set(clientHash, authBytes.length);

  const subtle = cryptoApi().subtle;
  const spki = unb64u(want.key);
  let valid = false;
  if (want.alg === -7) {
    const k = await subtle.importKey("spki", spki, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    valid = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, ecdsaDerToP1363(got.signature), message);
  } else if (want.alg === -257) {
    const k = await subtle.importKey("spki", spki, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    valid = await subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, k, got.signature, message);
  } else {
    return no("This kind of key is not supported.");
  }
  return valid ? { ok: true, counter: auth.counter } : no("The signature does not match.");
}
