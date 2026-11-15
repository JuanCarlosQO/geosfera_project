// Module 3 — daily log rules, with no DOM so Node can test them.
// "Measurement before health": a value that cannot be real, or that jumps far from the last
// one, becomes "Measure again". Limits here are APP RULES to catch typos and bad sensor
// contact; they are not clinical ranges and the app labels them that way.

import { RANGES } from "./data/vital-ranges.js";

export const LOG_KEY = "geosfera.log";

export const FIELDS = [
  { key: "heartRate", label: "Resting heart rate", unit: "bpm", step: 1, min: 20, max: 250, jump: 0.5, how: "Rest 5 minutes, then measure." },
  { key: "bloodPressure", label: "Blood pressure", unit: "mmHg", pair: ["systolic", "diastolic"], min: [50, 30], max: [260, 160], jump: 0.35, how: "Seated, cuff at heart level." },
  { key: "temperature", label: "Body temperature", unit: "°C", step: 0.1, min: 30, max: 43, jump: 0.05, how: "Not right after eating or exercise." },
  { key: "bloodOxygen", label: "Blood oxygen", unit: "%", step: 1, min: 50, max: 100, jump: 0.15, how: "Finger sensor, hand still." },
  { key: "glucose", label: "Fasting blood sugar", unit: "mg/dL", step: 1, min: 20, max: 600, jump: 0.6, how: "Before breakfast." },
  { key: "sleepHours", label: "Sleep last night", unit: "h", step: 0.1, min: 0, max: 24, how: "Hours actually asleep." },
  { key: "exerciseMinutes", label: "Exercise today", unit: "min", step: 5, min: 0, max: 600, how: "Resistance and aerobic together." },
  { key: "radiationDose", label: "Radiation dose today", unit: "mSv", step: 0.01, min: 0, max: 100, how: "From your personal dosimeter." },
  { key: "mood", label: "How do you feel today?", unit: "", scale: ["Very low", "Low", "Okay", "Good", "Very good"] }
];

export const fieldByKey = (key) => FIELDS.find((f) => f.key === key);

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const num = (raw) => {
  if (raw === null || raw === undefined) return NaN;
  const s = String(raw).trim().replace(",", ".");
  return s === "" ? NaN : Number(s);
};

/**
 * Checks one typed value. Returns { state: "empty" | "ok" | "impossible", value, why }.
 * Blood pressure takes [systolic, diastolic]; mood takes 1-5.
 */
export function checkValue(field, raw) {
  if (field.pair) {
    const [s, d] = (raw ?? []).map(num);
    if (Number.isNaN(s) && Number.isNaN(d)) return { state: "empty" };
    if (Number.isNaN(s) || Number.isNaN(d)) return { state: "impossible", why: "Enter both numbers, top and bottom." };
    if (s < field.min[0] || s > field.max[0] || d < field.min[1] || d > field.max[1]) return { state: "impossible", why: "These numbers cannot be real. Check the cuff and type them again." };
    if (d >= s) return { state: "impossible", why: "The top number must be higher than the bottom one." };
    return { state: "ok", value: [Math.round(s), Math.round(d)] };
  }
  if (field.scale) {
    const v = num(raw);
    if (Number.isNaN(v)) return { state: "empty" };
    return Number.isInteger(v) && v >= 1 && v <= field.scale.length ? { state: "ok", value: v } : { state: "impossible", why: "Choose one of the five options." };
  }
  const v = num(raw);
  if (Number.isNaN(v)) return { state: "empty" };
  if (v < field.min || v > field.max) return { state: "impossible", why: "This value cannot be real. Check the device and type it again." };
  const decimals = String(field.step).split(".")[1]?.length ?? 0;
  return { state: "ok", value: Number(v.toFixed(decimals)) };
}

/** The most recent saved value of a field before a given day. */
export function previousValue(log, key, beforeDay) {
  const days = Object.keys(log ?? {}).filter((d) => d < beforeDay).sort().reverse();
  for (const d of days) if (log[d]?.[key]?.value != null) return log[d][key].value;
  return null;
}

/** True when a value moved further than the field's jump fraction from the last one (app rule). */
export function isJump(field, value, prev) {
  if (!field.jump || prev == null || value == null) return false;
  const a = field.pair ? value[0] : value;
  const b = field.pair ? prev[0] : prev;
  if (!b) return false;
  if (field.pair && Math.abs(value[1] - prev[1]) / prev[1] > field.jump) return true;
  return Math.abs(a - b) / b > field.jump;
}

/**
 * Builds one day's entry from the form. raw: { heartRate: "64", bloodPressure: ["118","76"], ... }.
 * Returns { entry, problems }: entry holds only valid values, each { value, flag? };
 * flag "again" marks a sudden jump. Impossible values are left out and reported.
 */
export function buildEntry(raw, log, day) {
  const entry = {};
  const problems = {};
  for (const f of FIELDS) {
    const r = checkValue(f, raw[f.key]);
    if (r.state === "impossible") { problems[f.key] = r.why; continue; }
    if (r.state !== "ok") continue;
    const reading = { value: r.value };
    if (isJump(f, r.value, previousValue(log, f.key, day))) reading.flag = "again";
    entry[f.key] = reading;
  }
  return { entry, problems };
}

export function saveDay(log, day, entry) {
  const next = { ...(log ?? {}) };
  if (Object.keys(entry).length === 0) delete next[day];
  else next[day] = { ...entry, savedAt: new Date().toISOString() };
  return next;
}

/** Status for the dashboard: "again" for a flagged jump, otherwise "pending" until ranges are approved. */
export function judgeReading(key, reading) {
  if (reading?.flag === "again") return "again";
  if (HABITS.includes(key)) return "logged";
  if (RANGES[key] && reading?.value != null) return RANGES[key].judge(reading.value).status;
  return "pending";
}

/** The range band and its source for a reading, or null when no range applies. */
export function bandFor(key, reading) {
  if (!RANGES[key] || reading?.value == null) return null;
  return { band: RANGES[key].judge(reading.value).band, source: RANGES[key].source, url: RANGES[key].url };
}

/** Habits and self-reports: no medical range applies, so they are simply "Logged". */
export const HABITS = ["exerciseMinutes", "mood", "radiationDose"];

export function countFilled(entry) {
  return FIELDS.filter((f) => entry?.[f.key]?.value != null).length;
}

/* ---------- B: export and import ---------- */

export function toCsv(log) {
  const head = ["date", "heart_rate_bpm", "bp_systolic_mmHg", "bp_diastolic_mmHg", "temperature_C", "blood_oxygen_pct", "glucose_mg_dL", "sleep_h", "exercise_min", "radiation_mSv", "mood_1_5", "measure_again"];
  const rows = Object.keys(log ?? {}).sort().map((d) => {
    const e = log[d];
    const v = (k) => e[k]?.value ?? "";
    const bp = e.bloodPressure?.value ?? ["", ""];
    const again = FIELDS.filter((f) => e[f.key]?.flag === "again").map((f) => f.key).join(" ");
    return [d, v("heartRate"), bp[0], bp[1], v("temperature"), v("bloodOxygen"), v("glucose"), v("sleepHours"), v("exerciseMinutes"), v("radiationDose"), v("mood"), again].join(",");
  });
  return [head.join(","), ...rows].join("\n") + "\n";
}

export function toBackup(log) {
  return JSON.stringify({ app: "geosfera", kind: "daily-log", version: 1, exportedAt: new Date().toISOString(), log }, null, 2);
}

/** Reads a backup made by toBackup. Every value is checked again; bad ones are dropped and counted. */
export function fromBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, why: "This file is not a Ergosphere backup." }; }
  if (data?.app !== "geosfera" || data?.kind !== "daily-log" || typeof data.log !== "object") return { ok: false, why: "This file is not a Ergosphere backup." };
  const log = {};
  let dropped = 0;
  for (const [day, e] of Object.entries(data.log)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { dropped += 1; continue; }
    const clean = {};
    for (const f of FIELDS) {
      if (e?.[f.key] == null) continue;
      const r = checkValue(f, e[f.key].value);
      if (r.state !== "ok") { dropped += 1; continue; }
      clean[f.key] = { value: r.value, ...(e[f.key].flag === "again" ? { flag: "again" } : {}), ...(typeof e[f.key].src === "string" ? { src: e[f.key].src.slice(0, 20) } : {}) };
    }
    if (typeof e?.feel?.value === "string") clean.feel = { value: e.feel.value.slice(0, 12), at: e.feel.at ?? null };
    if (e?.note && typeof e.note === "object") clean.note = { reasons: (Array.isArray(e.note.reasons) ? e.note.reasons : []).map(String).slice(0, 8), text: String(e.note.text ?? "").slice(0, 140) };
    if (Object.keys(clean).length) log[day] = { ...clean, savedAt: e.savedAt ?? null };
  }
  return { ok: true, log, days: Object.keys(log).length, dropped };
}

/** Merge: imported days fill gaps; a day already on this device is kept as it is. */
export function mergeLogs(current, incoming) {
  const out = { ...(current ?? {}) };
  let added = 0;
  for (const [d, e] of Object.entries(incoming ?? {})) if (!out[d]) { out[d] = e; added += 1; }
  return { log: out, added };
}
