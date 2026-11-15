// Countermeasure exercise: the ground medical team prescribes each crew member's daily sessions
// on the station's machines; the crew member marks each session done, with the loads they used
// and anything they felt afterwards; equipment problems are reported too. Pure rules, no DOM.
// Nothing here judges a symptom or a load: a report goes to the ground team as it was written.
// NASA's numbers (1.5 hours a day, six to seven days a week) and the machines are in
// data/exercise.js and docs/SOURCES.md; the sessions and their lengths are app rules.

export const EXERCISE_KEY = "geosfera.exercise"; // { plans, log, faults }, shared with the ground through the sync

export const DEVICES = {
  ared: { name: "ARED", label: "Resistive exercise device (ARED)", kind: "resistive", unit: "lb" },
  cevis: { name: "CEVIS", label: "Cycle ergometer (CEVIS)", kind: "aerobic" },
  t2: { name: "T2", label: "Treadmill (T2)", kind: "aerobic" }
};

// the two halves of the daily countermeasure, as NASA names them: resistance training (strength,
// on ARED) and aerobic exercise (endurance and conditioning, on T2 and CEVIS)
export const BLOCKS = {
  strength: { label: "Strength training", sub: "Resistance on ARED: muscle and bone" },
  endurance: { label: "Endurance & conditioning", sub: "Aerobic on T2 and CEVIS: heart and lungs" }
};

// what a session works on; ARED sessions list their lifts so the loads can be logged
export const FOCUS = {
  lower: { device: "ared", block: "strength", label: "Lower body", moves: ["squat", "deadlift", "heel"] },
  upper: { device: "ared", block: "strength", label: "Upper body", moves: ["bench", "press", "row"] },
  run: { device: "t2", block: "endurance", label: "Run in the harness" },
  walk: { device: "t2", block: "endurance", label: "Walk in the harness" },
  intervals: { device: "cevis", block: "endurance", label: "Intervals" },
  steady: { device: "cevis", block: "endurance", label: "Steady ride" }
};
export const blockOf = (focus) => FOCUS[focus]?.block ?? null;

export const MOVES = {
  squat: "Squat", deadlift: "Deadlift", heel: "Heel raise",
  bench: "Bench press", press: "Shoulder press", row: "Row"
};

// what the crew member can tick after a session (a report, never a diagnosis)
export const SYMPTOMS = [
  { id: "dizzy", label: "Dizzy or light-headed" },
  { id: "back", label: "Back pain" },
  { id: "joint", label: "Joint pain (knee, hip, ankle, shoulder)" },
  { id: "muscle", label: "Muscle pain or cramp" },
  { id: "chest", label: "Chest discomfort" },
  { id: "breath", label: "Short of breath" },
  { id: "other", label: "Something else" }
];
// reported to the ground at once, with a nudge to talk to the crew medical officer now (app rule)
export const TELL_NOW = ["chest", "breath", "dizzy"];

// the app's starting prescription until the ground team writes one: 90 minutes, NASA's 1.5 hours (app rule)
export const DEFAULT_PLAN = [
  { id: "s1", device: "ared", focus: "lower", minutes: 60 },
  { id: "s2", device: "cevis", focus: "intervals", minutes: 30 }
];

export const MAX_SESSIONS = 4;
export const MAX_MINUTES = 180;
export const MAX_LOAD = 600; // lb, ARED's top load (data/exercise.js)
export const NOTE_MAX = 140;
const MAX_LOG = 600;
const MAX_FAULTS = 60;

const ms = (t) => new Date(t).getTime();
const iso = (t) => new Date(t).toISOString();
const int = (v, lo, hi) => { if (v == null || String(v).trim() === "") return null; const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; }; // an empty box is no value, not 0
const text = (v, n = NOTE_MAX) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));

/** One prescribed session, well formed, or null. */
export function cleanSession(raw, i = 0) {
  const focus = FOCUS[raw?.focus] ? raw.focus : null;
  if (!focus) return null;
  const minutes = int(raw.minutes, 5, MAX_MINUTES);
  if (!minutes) return null;
  return { id: /^[a-z0-9-]{1,24}$/i.test(raw.id ?? "") ? raw.id : `s${i + 1}`, device: FOCUS[focus].device, focus, minutes };
}

function cleanSets(sets, focus) {
  const moves = FOCUS[focus]?.moves ?? [];
  return (Array.isArray(sets) ? sets : [])
    .filter((s) => moves.includes(s?.move))
    .map((s) => ({ move: s.move, load: int(s.load, 0, MAX_LOAD), reps: int(s.reps, 1, 100) }))
    .filter((s) => s.load != null || s.reps != null);
}

export function cleanStore(raw) {
  const plans = {};
  for (const [member, p] of Object.entries(raw?.plans ?? {})) {
    const sessions = (Array.isArray(p?.sessions) ? p.sessions : []).map(cleanSession).filter(Boolean).slice(0, MAX_SESSIONS);
    if (sessions.length) plans[member] = { sessions, by: text(p.by, 60), at: Number.isFinite(ms(p.at)) ? iso(p.at) : null };
  }
  const log = (Array.isArray(raw?.log) ? raw.log : []).filter((e) => e?.member && isDay(e.day) && FOCUS[e.focus])
    .map((e) => ({
      id: String(e.id ?? `${e.member}-${e.day}-${e.sessionId}`), member: String(e.member), day: e.day, sessionId: String(e.sessionId ?? ""),
      device: FOCUS[e.focus].device, focus: e.focus, minutes: int(e.minutes, 0, MAX_MINUTES) ?? 0,
      sets: cleanSets(e.sets, e.focus), symptoms: [...new Set((e.symptoms ?? []).filter((s) => SYMPTOMS.some((x) => x.id === s)))],
      note: text(e.note), at: Number.isFinite(ms(e.at)) ? iso(e.at) : iso(0)
    })).slice(-MAX_LOG);
  const faults = (Array.isArray(raw?.faults) ? raw.faults : []).filter((f) => f?.member && DEVICES[f.device] && text(f.text))
    .map((f) => ({ id: String(f.id), member: String(f.member), device: f.device, text: text(f.text), at: iso(f.at), fixed: f.fixed && Number.isFinite(ms(f.fixed)) ? iso(f.fixed) : null }))
    .slice(-MAX_FAULTS);
  return { plans, log, faults };
}

/** The sessions the ground team prescribed for this crew member (or the app's starting plan). */
export function planFor(store, member) {
  const p = store?.plans?.[member];
  return p?.sessions?.length ? { sessions: p.sessions, by: p.by, at: p.at, set: true } : { sessions: DEFAULT_PLAN, by: "", at: null, set: false };
}

/** The ground team writes a crew member's prescription. Returns { ok, store } or { ok: false, why }. */
export function setPlan(store, member, sessions, by = "Ground medical team", now = new Date()) {
  const clean = (sessions ?? []).map((s, i) => cleanSession({ ...s, id: s.id || `s${i + 1}` }, i)).filter(Boolean);
  if (!clean.length) return { ok: false, why: "Add at least one session." };
  if (clean.length > MAX_SESSIONS) return { ok: false, why: `At most ${MAX_SESSIONS} sessions a day.` };
  const ids = new Set();
  clean.forEach((s, i) => { if (ids.has(s.id)) s.id = `s${i + 1}-${i}`; ids.add(s.id); });
  return { ok: true, store: { ...store, plans: { ...store.plans, [member]: { sessions: clean, by: text(by, 60), at: iso(now) } } } };
}

/** Marks one prescribed session done (or updates it). The minutes, loads and symptoms are what the crew member wrote. */
export function logSession(store, { member, day, session, minutes, sets = [], symptoms = [], note = "", now = new Date() }) {
  if (!member || !isDay(day) || !session?.focus || !FOCUS[session.focus]) return { ok: false, why: "That session is not on the plan." };
  const mins = int(minutes, 0, MAX_MINUTES);
  if (mins == null) return { ok: false, why: `Minutes from 0 to ${MAX_MINUTES}.` };
  const entry = {
    id: `${member}-${day}-${session.id}`, member, day, sessionId: session.id, device: FOCUS[session.focus].device, focus: session.focus,
    minutes: mins, sets: cleanSets(sets, session.focus), symptoms: [...new Set(symptoms.filter((s) => SYMPTOMS.some((x) => x.id === s)))],
    note: text(note), at: iso(now)
  };
  return { ok: true, entry, store: { ...store, log: [...store.log.filter((e) => e.id !== entry.id), entry].slice(-MAX_LOG) } };
}

export const undoSession = (store, member, day, sessionId) => ({ ...store, log: store.log.filter((e) => e.id !== `${member}-${day}-${sessionId}`) });

/** Today's sessions with what was logged for each: [{ session, done }]. */
export function dayStatus(store, member, day) {
  const { sessions } = planFor(store, member);
  return sessions.map((s) => ({ session: s, done: store.log.find((e) => e.member === member && e.day === day && e.sessionId === s.id) ?? null }));
}

/** Minutes logged on one day (all sessions), which also fill "Exercise today" in the daily log. */
export const minutesOn = (store, member, day) => store.log.filter((e) => e.member === member && e.day === day).reduce((a, e) => a + e.minutes, 0);

const shift = (day, n) => { const [y, m, d] = day.split("-").map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };

/** The last days against the current prescription: { days: [{ day, planned, done, minutes }], full, sessions, doneSessions }. */
export function compliance(store, member, today, n = 7) {
  const planned = planFor(store, member).sessions.length;
  const days = Array.from({ length: n }, (_, i) => shift(today, i - n + 1)).map((day) => {
    const done = new Set(store.log.filter((e) => e.member === member && e.day === day).map((e) => e.sessionId)).size;
    return { day, planned, done: Math.min(done, planned), minutes: minutesOn(store, member, day) };
  });
  return { days, full: days.filter((d) => d.done >= d.planned).length, sessions: planned * n, doneSessions: days.reduce((a, d) => a + d.done, 0) };
}

/** Symptoms reported after sessions in the last days, newest first. */
export function recentSymptoms(store, member, today, n = 7) {
  const from = shift(today, -n + 1);
  return store.log.filter((e) => e.member === member && e.day >= from && e.day <= today && (e.symptoms.length || e.note))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

/** The heaviest load logged for one lift on each day, oldest first: [{ day, load }]. */
export function loadTrend(store, member, move, n = 10) {
  const byDay = new Map();
  for (const e of store.log) if (e.member === member) for (const s of e.sets) if (s.move === move && s.load != null) byDay.set(e.day, Math.max(byDay.get(e.day) ?? 0, s.load));
  return [...byDay].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-n).map(([day, load]) => ({ day, load }));
}

/** A problem with a machine, reported by a crew member; it stays open until the ground marks it fixed. */
export function addFault(store, { member, device, text: t, now = new Date(), id }) {
  if (!member || !DEVICES[device]) return { ok: false, why: "Choose the machine." };
  const words = text(t);
  if (!words) return { ok: false, why: "Say what is wrong in a few words." };
  const fault = { id: id ?? `f-${ms(now)}`, member, device, text: words, at: iso(now), fixed: null };
  return { ok: true, store: { ...store, faults: [...store.faults, fault].slice(-MAX_FAULTS) } };
}
export const fixFault = (store, id, now = new Date()) => ({ ...store, faults: store.faults.map((f) => (f.id === id ? { ...f, fixed: iso(now) } : f)) });
export const openFaults = (store) => store.faults.filter((f) => !f.fixed);

export const sessionLabel = (s) => `${DEVICES[FOCUS[s.focus].device].name} · ${FOCUS[s.focus].label}`;
export const symptomLabel = (id) => SYMPTOMS.find((s) => s.id === id)?.label ?? id;

/** Today's sessions split into the two blocks: { strength: [{ session, done }], endurance: [...] }. */
export function byBlock(rows) {
  const out = { strength: [], endurance: [] };
  for (const r of rows) out[blockOf(r.session.focus)]?.push(r);
  return out;
}

