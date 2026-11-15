// After the mission and loneliness: pure rules, no DOM.
//
// Phase: the mission's start and length (geosfera.mission) say whether a crew member is before,
// during or after it. After landing the check-ins keep running every two weeks for a year (app
// rule), so a low mood back on Earth still reaches the flight surgeon.
// Help lines: the crew member's home country picks a line checked on its official page
// (data/after.js); every other country goes to the Find A Helpline directory.
// Connection: what the ground can see of loneliness without reading anything private (the
// family channel and the journal never leave the device): the UCLA-3 answers, requests to talk
// that mention home, mood and sleep against their usual. Thresholds are app rules.

import { LINES, DIRECTORY, COUNTRY_CODES } from "./data/after.js";

export const TRUSTED_KEY = "geosfera.trusted";   // this device only: people the crew member trusts
export const JOURNAL_KEY = "geosfera.journal";   // this device only: a private journal, never synced
export const FOLLOW_UP_DAYS = 365;               // app rule: check-ins continue this long after landing
export const MAX_TRUSTED = 3;
export const RULES = { homeRequests: 2, windowDays: 14 }; // app rule: 2 requests mentioning home in 14 days

const DAY = 86400000;
const ms = (t) => new Date(t).getTime();
const startOf = (day) => { const [y, m, d] = String(day).split("-").map(Number); return new Date(y, m - 1, d).getTime(); };

/** { phase: "none" | "during" | "after", day, daysAfter, landing, followUp } */
export function phase(mission, now = new Date()) {
  if (!mission?.start || !mission?.length) return { phase: "none" };
  const start = startOf(mission.start);
  const landing = start + mission.length * DAY;
  const t = ms(now);
  if (t < landing) return { phase: "during", day: Math.floor((t - start) / DAY) + 1, landing: new Date(landing).toISOString().slice(0, 10) };
  const daysAfter = Math.floor((t - landing) / DAY) + 1;
  return { phase: "after", daysAfter, landing: new Date(landing).toISOString().slice(0, 10), followUp: daysAfter <= FOLLOW_UP_DAYS };
}

/** The lines for a home country: { lines: [line], directory: { name, url } }. */
export function linesFor(home) {
  const h = String(home ?? "").trim().toLowerCase();
  const own = LINES.filter((l) => l.countries.some((c) => c.toLowerCase() === h));
  const code = Object.entries(COUNTRY_CODES).find(([c]) => c.toLowerCase() === h)?.[1];
  return { lines: own, directory: { ...DIRECTORY, url: code ? `${DIRECTORY.url}countries/${code}` : DIRECTORY.url } };
}

/** People the crew member trusts: up to 3, a name and a phone number made of digits, spaces, +, - and (). */
export function cleanTrusted(list) {
  return (Array.isArray(list) ? list : [])
    .map((p) => ({ name: String(p?.name ?? "").trim().slice(0, 40), phone: String(p?.phone ?? "").replace(/[^\d+\-() ]/g, "").trim().slice(0, 24) }))
    .filter((p) => p.name && p.phone.replace(/\D/g, "").length >= 3)
    .slice(0, MAX_TRUSTED);
}
export const telOf = (phone) => `tel:${String(phone).replace(/[^\d+]/g, "")}`;

/** Journal entries, newest first: [{ at, text }], text up to 2000 characters, at most 200 entries. */
export function cleanJournal(list) {
  return (Array.isArray(list) ? list : [])
    .filter((e) => e && Number.isFinite(ms(e.at)) && String(e.text ?? "").trim())
    .map((e) => ({ at: new Date(e.at).toISOString(), text: String(e.text).trim().slice(0, 2000) }))
    .sort((a, b) => ms(b.at) - ms(a.at))
    .slice(0, 200);
}

/**
 * Loneliness at a glance for the ground: { ucla, homeRequests, talkRequests, flag }. `alerts` are the
 * support requests (support-core.js); `ucla` the latest UCLA-3 { now, before } (screen-core.js).
 */
export function connection({ alerts = [], member, ucla = null, now = new Date() }) {
  const since = ms(now) - RULES.windowDays * DAY;
  const mine = alerts.filter((a) => a?.from?.id === member && ms(a.at) >= since);
  const homeRequests = mine.filter((a) => (a.reasons ?? []).includes("home")).length;
  const flag = homeRequests >= RULES.homeRequests ? { level: "watch", text: `Missing home or family: ${homeRequests} requests in ${RULES.windowDays} days` } : null;
  return { ucla, homeRequests, talkRequests: mine.length, flag };
}
