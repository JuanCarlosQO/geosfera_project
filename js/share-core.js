// What a crew member may see of their own data, and how they ask for more. Pure rules, no DOM.
//
// By default a crew member sees no readings (role-core.js). The ground medical team can share
// some of them on purpose, item by item ("standing" sharing), and a crew member can ask the
// ground for access: the ground approves or declines; an approval gives a one-time code that
// the ground reads to the crew member, who types it to open those items for the time approved.
// Every request, decision and use is kept for the ground. The emergency code (role-core.js) is
// separate: it opens everything at once, without waiting for the ground.
// All of this is an app rule (docs/SOURCES.md), not a NASA procedure.

export const SHARING_KEY = "geosfera.sharing";        // { [member]: { items, at, by } }, shared through the sync
export const REQUESTS_KEY = "geosfera.data-requests"; // [request], shared through the sync
export const MAX_REQUESTS = 80;
export const CODE_LEN = 6;
export const REASON_MAX = 160;

// readings (shown on the crew member's home) and screens (opened in the dock)
export const ITEMS = [
  { id: "sleepHours", kind: "reading", label: "Sleep" },
  { id: "heartRate", kind: "reading", label: "Heart rate" },
  { id: "systolic", kind: "reading", label: "Blood pressure" },
  { id: "bloodOxygen", kind: "reading", label: "Oxygen saturation" },
  { id: "temperature", kind: "reading", label: "Temperature" },
  { id: "mood", kind: "reading", label: "Mood" },
  { id: "exerciseMinutes", kind: "reading", label: "Exercise minutes" },
  { id: "radiation", kind: "reading", label: "Radiation dose" },
  { id: "today", kind: "screen", label: "Today dashboard", route: "today" },
  { id: "live", kind: "screen", label: "Live sensors", route: "live" },
  { id: "body", kind: "screen", label: "Body systems", route: "body" },
  { id: "mission", kind: "screen", label: "Exercise and mission", route: "mission" }
];
export const DURATIONS = [
  { minutes: 60, label: "1 hour" },
  { minutes: 1440, label: "24 hours" },
  { minutes: 10080, label: "7 days" }
];
export const STATUS = ["pending", "approved", "declined", "used", "expired"];

const ids = new Set(ITEMS.map((i) => i.id));
const ms = (t) => new Date(t).getTime();
const iso = (t) => new Date(t).toISOString();
const okTime = (t) => t != null && Number.isFinite(ms(t));
const cleanItems = (list) => [...new Set((Array.isArray(list) ? list : []).filter((x) => ids.has(x)))].sort((a, b) => ITEMS.findIndex((i) => i.id === a) - ITEMS.findIndex((i) => i.id === b));
export const itemLabel = (id) => ITEMS.find((i) => i.id === id)?.label ?? id;
export const durationLabel = (m) => DURATIONS.find((d) => d.minutes === m)?.label ?? `${m} min`;

/* ---------- standing sharing, set by the ground ---------- */

export function cleanSharing(raw) {
  const out = {};
  for (const [member, v] of Object.entries(raw && typeof raw === "object" ? raw : {})) {
    const items = cleanItems(v?.items);
    if (items.length) out[member] = { items, at: okTime(v.at) ? iso(v.at) : null, by: String(v.by ?? "Ground medical team") };
  }
  return out;
}

export function setShared(sharing, member, items, now = new Date(), by = "Ground medical team") {
  const out = cleanSharing(sharing);
  const list = cleanItems(items);
  if (list.length) out[member] = { items: list, at: iso(now), by };
  else delete out[member];
  return out;
}

/* ---------- requests from the crew, decided by the ground ---------- */

export function cleanRequests(list) {
  return (Array.isArray(list) ? list : [])
    .filter((r) => r && r.id && r.member && STATUS.includes(r.status) && okTime(r.at) && cleanItems(r.items).length)
    .map((r) => ({
      id: String(r.id), member: String(r.member), items: cleanItems(r.items), reason: String(r.reason ?? "").slice(0, REASON_MAX),
      at: iso(r.at), status: r.status,
      ...(okTime(r.decidedAt) ? { decidedAt: iso(r.decidedAt) } : {}),
      ...(Number.isInteger(r.minutes) && r.minutes > 0 ? { minutes: r.minutes } : {}),
      ...(typeof r.code === "string" && new RegExp(`^\\d{${CODE_LEN}}$`).test(r.code) ? { code: r.code } : {}),
      ...(r.note ? { note: String(r.note).slice(0, REASON_MAX) } : {}),
      ...(okTime(r.usedAt) ? { usedAt: iso(r.usedAt) } : {}),
      ...(okTime(r.until) ? { until: iso(r.until) } : {})
    }))
    .slice(0, MAX_REQUESTS);
}

/** A crew member asks for some items; newest first. Returns { list, request } (request null when nothing valid was asked). */
export function requestAccess(list, { member, items, reason = "", now = new Date() }) {
  const clean = cleanRequests(list);
  const its = cleanItems(items);
  if (!member || !its.length) return { list: clean, request: null };
  const request = { id: `req-${ms(now).toString(36)}-${String(member).slice(-4)}`, member: String(member), items: its, reason: String(reason).trim().slice(0, REASON_MAX), at: iso(now), status: "pending" };
  return { list: [request, ...clean].slice(0, MAX_REQUESTS), request };
}

/** A random one-time code of CODE_LEN digits (rand returns [0, 1)). */
export function newCode(rand = Math.random) {
  let s = "";
  for (let i = 0; i < CODE_LEN; i += 1) s += Math.floor(rand() * 10);
  return s;
}

/** The ground approves (with how long, and a code) or declines a pending request. */
export function decide(list, id, { approve, minutes = DURATIONS[0].minutes, code = newCode(), note = "", now = new Date() }) {
  return cleanRequests(list).map((r) => {
    if (r.id !== id || r.status !== "pending") return r;
    if (!approve) return { ...r, status: "declined", decidedAt: iso(now), ...(note ? { note: String(note).slice(0, REASON_MAX) } : {}) };
    const m = DURATIONS.some((d) => d.minutes === minutes) ? minutes : DURATIONS[0].minutes;
    return { ...r, status: "approved", decidedAt: iso(now), minutes: m, code: String(code) };
  });
}

/**
 * The crew member types a code. A match with one of their approved, unused requests opens its
 * items from now for the minutes approved. Returns { list, ok, request }.
 */
export function useCode(list, member, code, now = new Date()) {
  const clean = cleanRequests(list);
  const typed = String(code ?? "").replace(/\D/g, "");
  const hit = clean.find((r) => r.member === member && r.status === "approved" && r.code === typed);
  if (!hit || typed.length !== CODE_LEN) return { list: clean, ok: false, request: null };
  const used = { ...hit, status: "used", usedAt: iso(now), until: iso(ms(now) + hit.minutes * 60000) };
  return { list: clean.map((r) => (r.id === hit.id ? used : r)), ok: true, request: used };
}

/** Whether an opened request still gives access. */
export const activeNow = (r, now = new Date()) => r.status === "used" && okTime(r.until) && ms(now) < ms(r.until);

/** Minutes left on an opened request. */
export const minutesLeft = (r, now = new Date()) => (activeNow(r, now) ? Math.ceil((ms(r.until) - ms(now)) / 60000) : 0);

/** Everything a crew member may see now: standing sharing plus opened requests still running. */
export function grantedItems(sharing, requests, member, now = new Date()) {
  const set = new Set(cleanSharing(sharing)[member]?.items ?? []);
  for (const r of cleanRequests(requests)) if (r.member === member && activeNow(r, now)) r.items.forEach((i) => set.add(i));
  return cleanItems([...set]);
}

/** The screens those items open. */
export const grantedRoutes = (items) => ITEMS.filter((i) => i.kind === "screen" && items.includes(i.id)).map((i) => i.route);

export const pendingFor = (requests, member) => cleanRequests(requests).filter((r) => r.member === member && r.status === "pending");
export const forMember = (requests, member) => cleanRequests(requests).filter((r) => r.member === member);
