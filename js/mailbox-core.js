// Family mailbox — rules with no DOM so Node can test them.
// Each crew member has a mailbox on the team's sync server: an encrypted record the family
// can drop messages into and only that crew member's device empties. The crew member shares
// ONE link with their family; the link carries who it is for and the mailbox's id and keys,
// so the family types no name and needs no account. The server stores only ciphertext.
// Anyone holding the link can write to that mailbox, so it is shared like a phone number:
// with family only.

import { newStationId, validStationId } from "./sync-core.js";

export const MAILBOX_KEY = "geosfera.mailbox";     // { [memberId]: { id, token, key } }, this device only
export const SEEN_KEY = "geosfera.family-seen";    // ids of messages already announced on this device
export const KEEP_IN_BAG = 12;                     // messages waiting on the server at most
export const KEEP_SEEN = 200;

const HEX64 = /^[0-9a-f]{64}$/;
const B64 = /^[A-Za-z0-9+/]{43}=$/;
const hex = (bytes) => Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const defaultRand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** A new mailbox: an id the server accepts, a token that proves the right to use it, and an AES key. */
export function newMailbox(rand = defaultRand) {
  return { id: newStationId(rand), token: hex(rand(32)), key: b64(rand(32)) };
}

export const validMailbox = (m) => Boolean(m) && validStationId(m.id) && HEX64.test(m.token ?? "") && B64.test(m.key ?? "");

/** Keeps only well-formed mailboxes read back from the device. */
export function cleanMailboxes(raw) {
  const out = {};
  for (const [memberId, m] of Object.entries(raw && typeof raw === "object" ? raw : {})) if (validMailbox(m)) out[memberId] = { id: m.id, token: m.token, key: m.key };
  return out;
}

const toUrl = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const fromUrl = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0)));

/** The text that goes after # in the family's link. */
export function makeInvite({ memberId, name }, mailbox) {
  return toUrl(JSON.stringify({ v: 1, m: String(memberId), n: String(name).slice(0, 40), i: mailbox.id, t: mailbox.token, k: mailbox.key }));
}

/** Reads the link back. Never throws; returns { memberId, name, mailbox } or null. */
export function readInvite(text) {
  try {
    if (typeof text !== "string" || text.length > 600 || !/^[\w-]+$/.test(text)) return null;
    const raw = JSON.parse(fromUrl(text));
    const mailbox = { id: raw.i, token: raw.t, key: raw.k };
    if (raw?.v !== 1 || typeof raw.m !== "string" || !raw.m || typeof raw.n !== "string" || raw.n.trim().length < 1 || !validMailbox(mailbox)) return null;
    return { memberId: raw.m, name: raw.n.trim().slice(0, 40), mailbox };
  } catch { return null; }
}

/** What waits on the server: a short list of messages, each kept once. */
export const cleanBag = (raw) => (Array.isArray(raw?.messages) ? raw.messages : []).filter((m) => m && typeof m.id === "string").slice(-KEEP_IN_BAG);
export function addToBag(list, message) {
  return list.some((m) => m.id === message.id) ? list : [...list, message].slice(-KEEP_IN_BAG);
}
export const bag = (messages) => ({ v: 1, messages });

/**
 * Does this reply come from the sync server at all? A static host (GitHub Pages) answers a
 * missing /api/sync with a web page, not with the server's JSON.
 */
export const fromServer = (status, data) => status === 200 || (typeof data?.error === "string" && data.error.length > 0);

/** Which sealed messages of one member have not been announced yet (the demo's own are never announced). */
export function unannounced(list, seen) {
  const known = new Set(seen ?? []);
  return (list ?? []).filter((m) => m.state === "sealed" && !m.simulated && !known.has(m.id));
}
export const markSeen = (seen, ids) => [...new Set([...(seen ?? []), ...ids])].slice(-KEEP_SEEN);
