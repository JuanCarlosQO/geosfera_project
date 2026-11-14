// Module 8 — onboard medications. Rules with no DOM so Node can test them.
// Ergosphere never diagnoses. It matches the crew member's own symptoms to common in-flight
// complaints, shows what the official label says, and keeps a record of what was taken and
// whether it worked. Doses, intervals and daily limits come only from the label data in
// js/data/med-kit.js. The windows below are APP RULES and the app labels them that way.

export const MEDS_KEY = "geosfera.meds";

export const RULES = {
  dayHours: 24,          // a label's "in 24 hours" window
  clashWindowHours: 24,  // app rule: how far back to look for label-warned combinations
  expiresSoonDays: 30,   // app rule: when "Use first" appears
  noReliefRepeats: 2     // app rule: this many "did not work" in a row asks for the medical officer
};

export const OUTCOMES = [
  { id: "yes", label: "It worked" },
  { id: "partly", label: "Partly" },
  { id: "no", label: "It did not work" }
];

const HOUR = 3600000;
const ms = (t) => new Date(t).getTime();
const iso = (t) => new Date(t).toISOString();
const pad = (n) => String(n).padStart(2, "0");

export function dayOf(t = new Date()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  return dayOf(new Date(y, m - 1, d + n));
}

export function daysBetween(from, to) {
  const p = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(to) - p(from)) / (24 * HOUR));
}

/** "3 h 10 min", "40 min" or "now" for the time between two moments. */
export function spanWords(from, to) {
  const min = Math.ceil((ms(to) - ms(from)) / 60000);
  if (min <= 0) return "now";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

export const emptyStore = () => ({ doses: [], kit: {} });

/** First run: fills the demo kit. Quantities and dates are SIMULATED and the screen says so. */
export function seedKit(store, kit, today = dayOf()) {
  const next = { doses: store?.doses ?? [], kit: { ...(store?.kit ?? {}) } };
  for (const med of kit) {
    if (next.kit[med.id]) continue;
    next.kit[med.id] = { stock: med.demo?.stock ?? 0, expires: med.demo?.expiresInDays == null ? null : addDays(today, med.demo.expiresInDays) };
  }
  return next;
}

/** Keeps only well-formed data read back from the device. */
export function cleanStore(raw, kit) {
  const known = new Set(kit.map((k) => k.id));
  const out = emptyStore();
  for (const d of Array.isArray(raw?.doses) ? raw.doses : []) {
    if (!known.has(d?.medId) || !Number.isInteger(d.units) || d.units < 1 || Number.isNaN(ms(d.at))) continue;
    const dose = { id: String(d.id ?? `${d.medId}-${d.at}`), medId: d.medId, units: d.units, at: iso(d.at), reason: d.reason ?? null, outcome: null };
    if (OUTCOMES.some((o) => o.id === d.outcome?.worked)) dose.outcome = { worked: d.outcome.worked, effects: Array.isArray(d.outcome.effects) ? d.outcome.effects.map(String) : [], at: d.outcome.at ?? null };
    out.doses.push(dose);
  }
  for (const [id, item] of Object.entries(raw?.kit ?? {})) {
    if (!known.has(id) || !Number.isInteger(item?.stock) || item.stock < 0) continue;
    out.kit[id] = { stock: item.stock, expires: /^\d{4}-\d{2}-\d{2}$/.test(item.expires ?? "") ? item.expires : null };
  }
  return out;
}

/* ---------- symptoms ---------- */

/** Symptoms the module does not handle: any of them means "talk to a person now". */
export function redFlags(flags, picked) {
  const have = new Set(picked);
  return flags.filter((f) => have.has(f.id));
}

/**
 * Common in-flight complaints that fit the picked symptoms, best fit first.
 * A complaint needs at least one of its `core` symptoms. This is a list of possibilities
 * for the crew member to read, never a diagnosis.
 */
export function matchConditions(conditions, picked) {
  const have = new Set(picked);
  return conditions
    .map((c) => {
      const hits = c.signs.filter((s) => have.has(s));
      const coreOk = !c.core?.length || c.core.some((s) => have.has(s));
      return { id: c.id, hits, share: hits.length / c.signs.length, coreOk };
    })
    .filter((m) => m.hits.length > 0 && m.coreOk)
    .sort((a, b) => b.hits.length - a.hits.length || b.share - a.share)
    .map(({ id, hits, share }) => ({ id, hits, share }));
}

/* ---------- one medication ---------- */

/** Doses with the same active ingredient in the label's 24-hour window, oldest first. */
export function recentDoses(med, kit, doses, now, hours = RULES.dayHours) {
  const same = new Set(kit.filter((k) => k.ingredient === med.ingredient).map((k) => k.id));
  return doses
    .filter((d) => same.has(d.medId) && ms(d.at) <= ms(now) && ms(now) - ms(d.at) < hours * HOUR)
    .sort((a, b) => ms(a.at) - ms(b.at));
}

/**
 * Where the crew member stands against the label: "ok", "wait" (too soon after the last
 * dose) or "max" (label's daily limit reached). `until` says when that changes.
 */
export function doseState(med, kit, doses, now) {
  const rule = med.dose ?? {};
  const recent = recentDoses(med, kit, doses, now);
  const units = recent.reduce((n, d) => n + d.units, 0);
  if (rule.maxUnitsPerDay != null && units >= rule.maxUnitsPerDay) {
    let left = units;
    let until = null;
    for (const d of recent) {
      left -= d.units;
      if (left < rule.maxUnitsPerDay) { until = iso(ms(d.at) + RULES.dayHours * HOUR); break; }
    }
    return { state: "max", units, until, room: 0 };
  }
  // Some labels limit how many times a day, not how many units ("not more than 6 times in 24 hours").
  if (rule.maxDosesPerDay != null && recent.length >= rule.maxDosesPerDay) {
    const frees = recent[recent.length - rule.maxDosesPerDay];
    return { state: "max", units, until: iso(ms(frees.at) + RULES.dayHours * HOUR), room: 0 };
  }
  const room = rule.maxUnitsPerDay == null ? null : rule.maxUnitsPerDay - units;
  const last = recent.at(-1);
  if (last && rule.everyHours != null && ms(now) - ms(last.at) < rule.everyHours * HOUR) {
    return { state: "wait", units, until: iso(ms(last.at) + rule.everyHours * HOUR), room };
  }
  return { state: "ok", units, until: null, room };
}

/** The most units one dose may be, by the label and by what is left of the daily limit. */
export function maxUnitsNow(med, state) {
  const perDose = med.dose?.unitsPerDose?.[1] ?? 1;
  return state.room == null ? perDose : Math.max(0, Math.min(perDose, state.room));
}

/** "out", "expired", "soon" (app rule: within RULES.expiresSoonDays) or "ok". */
export function stockState(item, today) {
  if (!item || item.stock <= 0) return "out";
  if (item.expires && item.expires < today) return "expired";
  if (item.expires && daysBetween(today, item.expires) <= RULES.expiresSoonDays) return "soon";
  return "ok";
}

/**
 * Label-warned combinations: another medication taken in the last RULES.clashWindowHours
 * whose tag this label says to ask about first. Returns [{ medId, tag, quote, url }].
 */
export function clashes(med, kit, doses, now) {
  const byId = new Map(kit.map((k) => [k.id, k]));
  const found = new Map();
  for (const d of doses) {
    const other = byId.get(d.medId);
    const age = ms(now) - ms(d.at);
    if (!other || other.ingredient === med.ingredient || age < 0 || age >= RULES.clashWindowHours * HOUR) continue;
    for (const warn of med.askFirst ?? []) {
      if (other.tags?.includes(warn.tag) && !found.has(other.id)) found.set(other.id, { medId: other.id, tag: warn.tag, quote: warn.quote, url: warn.url });
    }
  }
  return [...found.values()];
}

/* ---------- what the crew member has learned about each medication ---------- */

export function response(doses, medId) {
  const done = doses.filter((d) => d.medId === medId && d.outcome);
  const count = (w) => done.filter((d) => d.outcome.worked === w).length;
  const effects = {};
  for (const d of done) for (const e of d.outcome.effects ?? []) effects[e] = (effects[e] ?? 0) + 1;
  return { rated: done.length, yes: count("yes"), partly: count("partly"), no: count("no"), effects };
}

/** App rule: the last RULES.noReliefRepeats rated doses for this complaint all "did not work". */
export function needsOfficer(doses, reason) {
  const rated = doses.filter((d) => d.reason === reason && d.outcome).sort((a, b) => ms(a.at) - ms(b.at));
  const last = rated.slice(-RULES.noReliefRepeats);
  return last.length === RULES.noReliefRepeats && last.every((d) => d.outcome.worked === "no");
}

/* ---------- suggestions for one complaint ---------- */

/**
 * The kit options for a complaint, in the order the data lists them. Each has a `state`:
 * "out" · "max" · "wait" · "expired" · "check" (label says ask first) · "ok".
 */
export function options(condition, kit, store, now = new Date()) {
  const today = dayOf(now);
  return condition.options.map((id) => kit.find((k) => k.id === id)).filter(Boolean).map((med) => {
    const item = store.kit?.[med.id];
    const stock = stockState(item, today);
    const dose = doseState(med, kit, store.doses, now);
    const clash = clashes(med, kit, store.doses, now);
    let state = "ok";
    if (stock === "out") state = "out";
    else if (dose.state !== "ok") state = dose.state;
    else if (stock === "expired") state = "expired";
    else if (clash.length) state = "check";
    return { med, item, state, stock, dose, clash, maxUnits: maxUnitsNow(med, dose), response: response(store.doses, med.id) };
  });
}

/* ---------- the record: what was taken and whether it worked ---------- */

/**
 * Records a dose. The record is never refused for being early or over the limit — an honest
 * record matters more — only for an unknown medication, a bad count or an empty pouch.
 */
export function logDose(store, kit, { medId, units = 1, reason = null, at = new Date() }) {
  const med = kit.find((k) => k.id === medId);
  if (!med) return { ok: false, why: "This medication is not in the kit." };
  if (!Number.isInteger(units) || units < 1) return { ok: false, why: "Choose how many you took." };
  const item = store.kit?.[medId];
  if (!item || item.stock < units) return { ok: false, why: "The kit does not have that many left." };
  const dose = { id: `${medId}-${ms(at)}`, medId, units, at: iso(at), reason, outcome: null };
  return {
    ok: true,
    dose,
    store: { doses: [...store.doses, dose], kit: { ...store.kit, [medId]: { ...item, stock: item.stock - units } } }
  };
}

/** Doses still waiting for "Did it work?". `due` ones are past the medication's ask-after time (app rule). */
export function followUps(doses, kit, now = new Date()) {
  const byId = new Map(kit.map((k) => [k.id, k]));
  const open = doses.filter((d) => !d.outcome && byId.has(d.medId)).map((d) => {
    const askAt = ms(d.at) + (byId.get(d.medId).askAfterHours ?? 1) * HOUR;
    return { dose: d, askAt: iso(askAt), due: ms(now) >= askAt };
  });
  return { due: open.filter((f) => f.due), later: open.filter((f) => !f.due) };
}

export function setOutcome(store, doseId, { worked, effects = [], at = new Date() }) {
  if (!OUTCOMES.some((o) => o.id === worked)) return { ok: false, why: "Choose how it went." };
  if (!store.doses.some((d) => d.id === doseId)) return { ok: false, why: "That dose is not in the record." };
  return {
    ok: true,
    store: { ...store, doses: store.doses.map((d) => (d.id === doseId ? { ...d, outcome: { worked, effects: [...effects], at: iso(at) } } : d)) }
  };
}

export function toCsv(doses, kit) {
  const byId = new Map(kit.map((k) => [k.id, k]));
  const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));
  const rows = [...doses].sort((a, b) => ms(a.at) - ms(b.at)).map((d) => [
    d.at, byId.get(d.medId)?.name ?? d.medId, d.units, byId.get(d.medId)?.unit ?? "", d.reason ?? "", d.outcome?.worked ?? "", (d.outcome?.effects ?? []).join(" ")
  ].map(cell).join(","));
  return ["taken_at_utc,medication,units,unit,reason,worked,side_effects", ...rows].join("\n") + "\n";
}
