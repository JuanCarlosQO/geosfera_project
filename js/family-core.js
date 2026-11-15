// Family channel — rules with no DOM so Node can test them.
// A family member writes a message on their own phone; the page turns it into a link (the
// whole message travels inside the link, nothing is uploaded). Opened on the crew member's
// device, the message lands SEALED: they see who it is from and what kind it is, and decide
// whether and when to open it. Nothing is ever marked overdue, and no one is told whether
// it was read. Text only, length-capped, always escaped on screen.

export const FAMILY_KEY = "geosfera.family"; // { [memberId]: [message] }, kept on this device only
export const MAX_TEXT = 600;
export const KEEP = 40;
export const KINDS = [
  { id: "hello", label: "Just saying hello" },
  { id: "news", label: "Good news" },
  { id: "cheer", label: "Encouragement" },
  { id: "home", label: "News from home" }
];
// Attachments travel as data URLs inside a message file (too big for a link). Sizes are capped
// so a few of them fit in the device's storage; both caps count characters of the data URL.
export const MAX_PHOTO = 170000;   // about 125 KB of JPEG
export const MAX_AUDIO = 280000;   // about 45 s of voice at a low bit rate
export const MAX_VOICE_S = 45;
export const FEELS = [
  { id: "better", label: "Better" },
  { id: "same", label: "About the same" },
  { id: "worse", label: "More homesick" }
];
const B64 = /^[A-Za-z0-9+/]+=*$/;
const dataUrl = (raw, head, max) => {
  if (typeof raw !== "string" || raw.length > max) return null;
  const m = raw.match(head);
  return m && B64.test(raw.slice(m[0].length)) ? raw : null;
};
export const cleanPhoto = (raw) => dataUrl(raw, /^data:image\/jpeg;base64,/, MAX_PHOTO);
export const cleanAudio = (raw) => dataUrl(raw, /^data:audio\/(webm|mp4|ogg|mpeg)(;codecs=[\w.,-]+)?;base64,/, MAX_AUDIO);

export const RELATIONS = ["Partner", "Parent", "Child", "Sibling", "Friend", "Family"];
export const kindLabel = (id) => KINDS.find((k) => k.id === id)?.label ?? "Message";

const ms = (t) => new Date(t).getTime();
const iso = (t) => new Date(t).toISOString();
const clean = (raw, n) => String(raw ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, n);
const line = (raw, n) => clean(raw, n).replace(/\s+/g, " ");
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

/** Builds a message from what the family member typed. Returns { ok, message } or { ok: false, why }. */
export function makeMessage({ to, from, rel, kind, text, photo, audio, at = new Date() }) {
  const m = { v: 1, to: line(to, 40), from: line(from, 40), rel: RELATIONS.includes(rel) ? rel : "Family", kind: KINDS.some((k) => k.id === kind) ? kind : null, text: clean(text, MAX_TEXT), at: iso(at) };
  if (m.from.length < 2) return { ok: false, why: "Write your name, so they know who it is from." };
  if (!m.kind) return { ok: false, why: "Choose what kind of message it is." };
  const p = cleanPhoto(photo), a = cleanAudio(audio);
  if (photo && !p) return { ok: false, why: "That photo could not be used. Try another one." };
  if (audio && !a) return { ok: false, why: "That voice note could not be used. Record it again, a little shorter." };
  if (m.text.length < 2 && !p && !a) return { ok: false, why: "Write your message, or add a photo or a voice note." };
  if (p) m.photo = p;
  if (a) m.audio = a;
  m.id = `fm-${ms(at).toString(36)}-${hash(`${m.from}${m.text}${p?.length ?? 0}.${a?.length ?? 0}`)}`;
  return { ok: true, message: m };
}

/* The message travels inside the link as URL-safe base64 of UTF-8 JSON. */
export function encode(message) {
  const bytes = new TextEncoder().encode(JSON.stringify(message));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Reads a link's payload. Never throws; everything is re-validated and re-capped. */
export function decode(payload) {
  try {
    if (typeof payload !== "string" || payload.length > 6000 || !/^[\w-]+$/.test(payload)) return { ok: false };
    const bin = atob(payload.replaceAll("-", "+").replaceAll("_", "/"));
    const raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (raw?.v !== 1 || Number.isNaN(ms(raw.at))) return { ok: false };
    const r = makeMessage({ ...raw, at: raw.at });
    return r.ok ? { ok: true, message: r.message } : { ok: false };
  } catch { return { ok: false }; }
}

const STATES = ["sealed", "open", "aside"];
function cleanMessage(m) {
  const r = makeMessage({ ...m, at: m?.at });
  if (!r.ok || Number.isNaN(ms(m.arrivedAt))) return null;
  return { ...r.message, id: String(m.id ?? r.message.id), arrivedAt: iso(m.arrivedAt), state: STATES.includes(m.state) ? m.state : "sealed", openedAt: m.openedAt && !Number.isNaN(ms(m.openedAt)) ? iso(m.openedAt) : null, ...(FEELS.some((f) => f.id === m.feel) ? { feel: m.feel } : {}), ...(m.simulated === true ? { simulated: true } : {}) };
}

/** Keeps only well-formed inboxes read back from the device. */
export function cleanBox(raw) {
  const out = {};
  for (const [id, list] of Object.entries(raw && typeof raw === "object" ? raw : {})) {
    if (id === "_prefs") continue;
    const ok = (Array.isArray(list) ? list : []).map(cleanMessage).filter(Boolean).slice(-KEEP);
    if (ok.length) out[id] = ok;
  }
  const paused = Object.entries(raw?._prefs ?? {}).filter(([, v]) => v?.paused === true).map(([id]) => [id, { paused: true }]);
  if (paused.length) out._prefs = Object.fromEntries(paused);
  return out;
}

/** Puts an arriving message in a member's inbox, sealed. The same link opened twice adds nothing. */
export function receive(box, memberId, message, now = new Date()) {
  const list = box[memberId] ?? [];
  if (list.some((m) => m.id === message.id)) return { box, added: false };
  const next = [...list, { ...message, arrivedAt: iso(now), state: "sealed", openedAt: null }].slice(-KEEP);
  return { box: { ...box, [memberId]: next }, added: true };
}

/** "open" shows it, "aside" puts it away unread, "sealed" brings it back. Only the crew member decides. */
export function setState(box, memberId, id, state, now = new Date()) {
  if (!STATES.includes(state)) return box;
  return { ...box, [memberId]: (box[memberId] ?? []).map((m) => (m.id === id ? { ...m, state, openedAt: state === "open" ? m.openedAt ?? iso(now) : m.openedAt } : m)) };
}

export function remove(box, memberId, id) {
  const list = (box[memberId] ?? []).filter((m) => m.id !== id);
  const next = { ...box };
  if (list.length) next[memberId] = list; else delete next[memberId];
  return next;
}

export const waiting = (box, memberId) => (box[memberId] ?? []).filter((m) => m.state === "sealed").length;

/** Newest first within each group. */
export function inbox(box, memberId) {
  const list = [...(box[memberId] ?? [])].sort((a, b) => ms(b.arrivedAt) - ms(a.arrivedAt));
  return { sealed: list.filter((m) => m.state === "sealed"), open: list.filter((m) => m.state === "open"), aside: list.filter((m) => m.state === "aside") };
}

/** The crew member a message is addressed to: full name, or a first name only one member has. */
export function matchMember(members, to) {
  const want = clean(to, 40).toLowerCase();
  if (!want) return null;
  const full = members.filter((m) => m.name.toLowerCase() === want);
  if (full.length === 1) return full[0];
  const first = members.filter((m) => m.name.toLowerCase().split(" ")[0] === want.split(" ")[0]);
  return first.length === 1 ? first[0] : null;
}

/** "just now", "20 min ago", "3 h ago", "2 days ago". */
export function ago(at, now = new Date()) {
  const min = Math.max(0, Math.round((ms(now) - ms(at)) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 48 * 60) return `${Math.round(min / 60)} h ago`;
  return `${Math.round(min / 1440)} days ago`;
}

/* ---------- protections: the channel can be paused, and each read can be rated ---------- */

export const isPaused = (box, memberId) => box._prefs?.[memberId]?.paused === true;

/** Paused: messages are still kept, sealed, but nothing announces them anywhere in the app. */
export function setPaused(box, memberId, paused) {
  const prefs = { ...(box._prefs ?? {}) };
  if (paused) prefs[memberId] = { paused: true }; else delete prefs[memberId];
  const next = { ...box };
  if (Object.keys(prefs).length) next._prefs = prefs; else delete next._prefs;
  return next;
}

/** How many sealed messages the rest of the app may mention: none while the channel is paused. */
export const announced = (box, memberId) => (isPaused(box, memberId) ? 0 : waiting(box, memberId));

/** "How did that leave you?" — one tap after reading, changeable. */
export function setFeel(box, memberId, id, feel) {
  if (!FEELS.some((f) => f.id === feel)) return box;
  return { ...box, [memberId]: (box[memberId] ?? []).map((m) => (m.id === id ? { ...m, feel } : m)) };
}

/** True when the last two rated messages both left the crew member more homesick (app rule). */
export function homesick(box, memberId) {
  const rated = (box[memberId] ?? []).filter((m) => m.feel && m.openedAt).sort((a, b) => ms(a.openedAt) - ms(b.openedAt)).slice(-2);
  return rated.length === 2 && rated.every((m) => m.feel === "worse");
}

export const hasMedia = (m) => Boolean(m.photo || m.audio);

/* ---------- a message with a photo or a voice note travels as a small file ---------- */

export const toFile = (message) => JSON.stringify({ app: "ergosphere", kind: "family-message", v: 1, message });

/** Reads a message file. Never throws; every field is validated again. */
export function fromFile(text) {
  try {
    if (typeof text !== "string" || text.length > MAX_PHOTO + MAX_AUDIO + 4000) return { ok: false };
    const raw = JSON.parse(text);
    if (raw?.app !== "ergosphere" || raw.kind !== "family-message" || raw.v !== 1 || Number.isNaN(ms(raw.message?.at))) return { ok: false };
    const r = makeMessage({ ...raw.message, at: raw.message.at });
    return r.ok ? { ok: true, message: r.message } : { ok: false };
  } catch { return { ok: false }; }
}
