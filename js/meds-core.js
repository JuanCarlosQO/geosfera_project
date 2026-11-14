// Module 8 — medication log. Rules with no DOM so Node can test them.
// It does not prescribe. It logs what the astronaut took, follows up on whether it worked,
// and flags patterns worth raising with the crew medical officer — the record NASA's Dose
// Tracker study kept, with a friendlier way in. It never suggests a medication or a dose
// and never interprets the cause of a symptom. Warnings either quote NASA's ISS medical kit
// list or are app rules marked as illustrative.

export const MEDS_KEY = "geosfera.meds";

export const RULES = {
  dayHours: 24,          // the kit list's "every 24 hours" window
  repeatDays: 3,         // illustrative app rule: same category on this many days in a row
  noReliefRepeats: 2     // illustrative app rule: this many "did not work" in a row
};

export const OUTCOMES = [
  { id: "yes", label: "It worked" },
  { id: "partly", label: "Partly" },
  { id: "no", label: "It did not work" }
];

export const LEVELS = {
  talk: "Talk it over with your crew medical officer",
  downlink: "Include it in the next downlink to Earth"
};

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

export const emptyStore = () => ({ doses: [], supplements: {} });

/** Keeps only well-formed data read back from the device. */
export function cleanStore(raw, kit, supplements = []) {
  const known = new Set(kit.map((k) => k.id));
  const sup = new Set(supplements.map((s) => s.id));
  const out = emptyStore();
  for (const d of Array.isArray(raw?.doses) ? raw.doses : []) {
    if (!known.has(d?.medId) || !Number.isInteger(d.units) || d.units < 1 || Number.isNaN(ms(d.at))) continue;
    const dose = { id: String(d.id ?? `${d.medId}-${d.at}`), medId: d.medId, units: d.units, at: iso(d.at), reason: d.reason ?? null, outcome: null };
    if (OUTCOMES.some((o) => o.id === d.outcome?.worked)) dose.outcome = { worked: d.outcome.worked, effects: Array.isArray(d.outcome.effects) ? d.outcome.effects.map(String) : [], at: d.outcome.at ?? null };
    out.doses.push(dose);
  }
  for (const [day, ids] of Object.entries(raw?.supplements ?? {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(ids)) continue;
    const ok = ids.filter((id) => !supplements.length || sup.has(id));
    if (ok.length) out.supplements[day] = [...new Set(ok)];
  }
  return out;
}

/** Symptoms the module does not handle: any of them means "talk to a person now". */
export function redFlags(flags, picked) {
  const have = new Set(picked);
  return flags.filter((f) => have.has(f.id));
}

/** The kit medications listed under the given NASA kit-list categories. */
export const inCategories = (kit, categories) => kit.filter((m) => categories.includes(m.category));

/* ---------- the log ---------- */

/** Records a dose. The record is never refused for being early or large: an honest log matters more. */
export function logDose(store, kit, { medId, units = 1, reason = null, at = new Date() }) {
  if (!kit.some((k) => k.id === medId)) return { ok: false, why: "This medication is not in the kit list." };
  if (!Number.isInteger(units) || units < 1) return { ok: false, why: "Choose how many you took." };
  const dose = { id: `${medId}-${ms(at)}`, medId, units, at: iso(at), reason, outcome: null };
  return { ok: true, dose, store: { ...store, doses: [...store.doses, dose] } };
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
  if (!store.doses.some((d) => d.id === doseId)) return { ok: false, why: "That dose is not in the log." };
  return {
    ok: true,
    store: { ...store, doses: store.doses.map((d) => (d.id === doseId ? { ...d, outcome: { worked, effects: [...effects], at: iso(at) } } : d)) }
  };
}

/** The side effects the app asks about for one medication: the kit list's own words, split. */
export function effectsFor(med) {
  const text = med.sideEffects?.quote ?? "";
  if (!text || /^No significant side effects/i.test(text)) return [];
  return text.split(/,\s*/).map((t) => t.trim()).filter(Boolean).map((t) => t.replace(/^(.)/, (c) => c.toUpperCase()));
}

export function response(doses, medId) {
  const done = doses.filter((d) => d.medId === medId && d.outcome);
  const count = (w) => done.filter((d) => d.outcome.worked === w).length;
  return { rated: done.length, yes: count("yes"), partly: count("partly"), no: count("no") };
}

/* ---------- patterns worth raising ---------- */

/** Doses of the same active ingredient in the 24 hours up to `now`. */
export function recentDoses(med, kit, doses, now, hours = RULES.dayHours) {
  const same = new Set(kit.filter((k) => k.ingredient === med.ingredient).map((k) => k.id));
  return doses.filter((d) => same.has(d.medId) && ms(d.at) <= ms(now) && ms(now) - ms(d.at) < hours * HOUR);
}

/** Days in a row, ending today, with at least one dose matching `test`. */
export function daysInARow(doses, test, today) {
  const days = new Set(doses.filter(test).map((d) => dayOf(d.at)));
  let n = 0;
  while (days.has(addDays(today, -n))) n += 1;
  return n;
}

/**
 * Patterns worth raising, "talk" before "downlink". Each: { id, level, medId?, category?,
 * text, quote?, url?, illustrative? }. `log` (the daily check-in) adds the nights' sleep
 * and mood to the sleep pattern, so the physical and the psychological sit together.
 */
export function patterns(store, kit, now = new Date(), log = {}) {
  const today = dayOf(now);
  const byId = new Map(kit.map((k) => [k.id, k]));
  const out = [];

  // 1. More than the kit list's 24-hour limit (quoted).
  for (const med of kit.filter((k) => k.kitLimit?.perDay)) {
    const units = recentDoses(med, kit, store.doses, now).reduce((n, d) => n + d.units, 0);
    if (units > med.kitLimit.perDay) out.push({ id: `limit-${med.id}`, level: "talk", medId: med.id, text: `${units} ${med.unit}s of ${med.name.toLowerCase()} logged in the last 24 hours. NASA's kit list says:`, quote: med.kitLimit.quote, url: med.kitLimit.url });
  }

  // 2. More consecutive days than the kit list allows (quoted).
  for (const med of kit.filter((k) => k.kitLimit?.days)) {
    const n = daysInARow(store.doses, (d) => d.medId === med.id, today);
    if (n > med.kitLimit.days) out.push({ id: `days-${med.id}`, level: "talk", medId: med.id, text: `${med.name} logged on ${n} days in a row. NASA's kit list says:`, quote: med.kitLimit.quote, url: med.kitLimit.url });
  }

  // 3. Combinations the kit list warns about, within 24 hours (quoted).
  const recent = store.doses.filter((d) => ms(d.at) <= ms(now) && ms(now) - ms(d.at) < RULES.dayHours * HOUR);
  const seen = new Set();
  for (const d of recent) {
    const med = byId.get(d.medId);
    for (const w of med?.askFirst ?? []) {
      const other = recent.find((o) => o.medId !== d.medId && byId.get(o.medId)?.ingredient !== med.ingredient && byId.get(o.medId)?.tags?.includes(w.tag));
      if (!other) continue;
      const key = [d.medId, other.medId].sort().join("+");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: `mix-${key}`, level: "talk", medId: med.id, text: `${med.name} and ${byId.get(other.medId).name.toLowerCase()} logged within 24 hours. NASA's kit list says:`, quote: w.quote, url: w.url });
    }
  }

  // 4. The same kind of medication several days in a row (illustrative app rule).
  for (const category of [...new Set(kit.map((k) => k.category))]) {
    const n = daysInARow(store.doses, (d) => byId.get(d.medId)?.category === category, today);
    if (n < RULES.repeatDays) continue;
    let text = `A ${category.toLowerCase()} medication logged on ${n} days in a row.`;
    if (category === "Sleep") {
      const nights = Array.from({ length: n }, (_, i) => log?.[addDays(today, -i)]).filter(Boolean);
      const sleep = nights.map((e) => e.sleepHours?.value).filter((v) => v != null);
      const mood = nights.map((e) => e.mood?.value).filter((v) => v != null);
      if (sleep.length) text += ` Sleep on those days: ${sleep.reverse().join(", ")} h.`;
      if (mood.length) text += ` Mood: ${mood.reverse().join(", ")} of 5.`;
    }
    out.push({ id: `repeat-${category}`, level: "downlink", category, text, illustrative: true });
  }

  // 5. A medication that did not work twice in a row (illustrative app rule).
  for (const med of kit) {
    const rated = store.doses.filter((d) => d.medId === med.id && d.outcome).sort((a, b) => ms(a.at) - ms(b.at)).slice(-RULES.noReliefRepeats);
    if (rated.length === RULES.noReliefRepeats && rated.every((d) => d.outcome.worked === "no")) {
      out.push({ id: `noeffect-${med.id}`, level: "talk", medId: med.id, text: `${med.name} did not work the last ${RULES.noReliefRepeats} times you logged it.`, illustrative: true });
    }
  }

  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "talk" ? -1 : 1));
}

/* ---------- supplements: taken or not, never "did it work?" ---------- */

export function markSupplement(store, id, day, taken) {
  const list = new Set(store.supplements?.[day] ?? []);
  if (taken) list.add(id); else list.delete(id);
  const supplements = { ...(store.supplements ?? {}) };
  if (list.size) supplements[day] = [...list]; else delete supplements[day];
  return { ...store, supplements };
}

/** The last n days, oldest first: [{ day, taken }]. */
export function supplementDays(store, id, today, n = 7) {
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(today, i - n + 1);
    return { day, taken: Boolean(store.supplements?.[day]?.includes(id)) };
  });
}

export function toCsv(doses, kit) {
  const byId = new Map(kit.map((k) => [k.id, k]));
  const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));
  const rows = [...doses].sort((a, b) => ms(a.at) - ms(b.at)).map((d) => [
    d.at, byId.get(d.medId)?.name ?? d.medId, byId.get(d.medId)?.category ?? "", d.units, byId.get(d.medId)?.unit ?? "", d.reason ?? "", d.outcome?.worked ?? "", (d.outcome?.effects ?? []).join(" ")
  ].map(cell).join(","));
  return ["taken_at_utc,medication,kit_category,units,unit,what_for,worked,side_effects", ...rows].join("\n") + "\n";
}
