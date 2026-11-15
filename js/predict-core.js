// The analysis behind Mission Control: each crew member compared with their own baseline, the
// direction of the last days, a short forecast, and mission-length outlooks. Pure functions, no DOM.
//
// What it is: plain statistics on the daily log (mean and spread of the crew member's own last
// two weeks, a least-squares line through the last seven days, that line carried forward with a
// band that widens with the scatter). What it is not: a diagnosis or a health score. It lists
// what moved away from the person's own usual, and why, for the flight surgeon to look at.
// Every threshold below is an app rule (docs/SOURCES.md), except the NASA figures it reuses:
// 7 hours of sleep, 1.5 hours of exercise, 1-1.5 % bone loss a month, the 600 mSv career limit.

import { RATE, WITH_CM_6M, MEASURED_MONTHS } from "./future-core.js";
import { RADIATION_LIMITS } from "./data/vital-ranges.js";

export const RULES = {
  baselineDays: 14,   // the crew member's own usual: up to the last 14 days before today
  baselineMin: 5,     // fewer days than this: no baseline yet
  trendDays: 7,       // the direction: the last 7 days, today included
  horizon: 7,         // forecast this many days ahead
  zWatch: 2,          // this many spreads away from the usual: "away from usual"
  trendSpreads: 1.5,  // a week's change this many spreads or more...
  trendFit: 0.6,      // ...along a line that fits this well (r²) counts as "rising" or "falling"
  sleepNeed: 7,       // h a night (NASA cites 7-9 h for an adult)
  sleepDebtWatch: 4,  // h of sleep missing over 7 nights
  adherenceWatch: 0.7 // under 70 % of prescribed sessions in 7 days
};

// what each reading looks like to the analysis; `floor` keeps a too-steady baseline from
// turning a tiny change into a big deviation; `worse` says which way is a concern
export const METRICS = [
  { key: "sleepHours", label: "Sleep", unit: "h", floor: 0.3, worse: "down", get: (e) => e?.sleepHours?.value },
  { key: "heartRate", label: "Heart rate", unit: "bpm", floor: 2, worse: "up", get: (e) => e?.heartRate?.value },
  { key: "systolic", label: "Blood pressure, top", unit: "mmHg", floor: 3, worse: "up", get: (e) => e?.bloodPressure?.value?.[0] },
  { key: "temperature", label: "Temperature", unit: "°C", floor: 0.15, worse: "up", get: (e) => e?.temperature?.value },
  { key: "bloodOxygen", label: "Oxygen saturation", unit: "%", floor: 0.7, worse: "down", get: (e) => e?.bloodOxygen?.value },
  { key: "mood", label: "Mood", unit: "of 5", floor: 0.4, worse: "down", get: (e) => e?.mood?.value },
  { key: "exerciseMinutes", label: "Exercise", unit: "min", floor: 8, worse: "down", get: (e) => e?.exerciseMinutes?.value }
];
export const metric = (key) => METRICS.find((m) => m.key === key);

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
export function addDays(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

/** The last n days of one reading, oldest first, gaps as null: [{ day, v }]. */
export function series(log, key, today, n = RULES.baselineDays + 1) {
  const m = metric(key);
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1)).map((day) => {
    const v = m.get(log?.[day]);
    return { day, v: Number.isFinite(v) ? v : null };
  });
}

/** The crew member's own usual before today: { mean, sd, n } or null with too few days. */
export function baseline(log, key, today) {
  const m = metric(key);
  const vals = series(log, key, addDays(today, -1), RULES.baselineDays).map((p) => p.v).filter((v) => v != null);
  if (vals.length < RULES.baselineMin) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1));
  return { mean: r1(mean), sd: r1(Math.max(sd, m.floor)), n: vals.length };
}

/** Least-squares line through the points that have a value: { slope (per day), intercept, r2, se, n }. */
export function fitLine(points) {
  const xs = [], ys = [];
  points.forEach((p, i) => { if (p.v != null) { xs.push(i); ys.push(p.v); } });
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i += 1) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; }
  const slope = sxx ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  const sse = ys.reduce((a, y, i) => a + (y - (intercept + slope * xs[i])) ** 2, 0);
  return { slope, intercept, r2: syy ? 1 - sse / syy : 1, se: Math.sqrt(sse / Math.max(1, n - 2)), n, last: points.length - 1 };
}

/** The last week's line carried forward: [{ day, v, lo, hi }], the band widening with distance. */
export function forecast(log, key, today, horizon = RULES.horizon) {
  const pts = series(log, key, today, RULES.trendDays);
  const fit = fitLine(pts);
  if (!fit) return [];
  return Array.from({ length: horizon }, (_, k) => {
    const x = fit.last + k + 1;
    const v = fit.intercept + fit.slope * x;
    const half = 1.96 * Math.max(fit.se, metric(key).floor) * Math.sqrt(1 + (k + 1) / fit.n);
    return { day: addDays(today, k + 1), v: r1(v), lo: r1(v - half), hi: r1(v + half) };
  });
}

/** Today against the usual and the week's direction, in words. */
export function analyse(log, key, today) {
  const m = metric(key);
  const base = baseline(log, key, today);
  const now = m.get(log?.[today]);
  const fit = fitLine(series(log, key, today, RULES.trendDays));
  const z = base && Number.isFinite(now) ? r1((now - base.mean) / base.sd) : null;
  const away = z != null && Math.abs(z) >= RULES.zWatch;
  const concern = away && ((m.worse === "up" && z > 0) || (m.worse === "down" && z < 0));
  const perWeek = fit ? r1(fit.slope * 7) : null;
  // a week-long change counts only when the line fits well and moves more than 1.5 spreads a week
  // (day-to-day scatter alone should never read as a trend)
  const steady = !fit || !base || fit.n < 5 || Math.abs(fit.slope * 7) < RULES.trendSpreads * base.sd || fit.r2 < RULES.trendFit;
  const direction = steady ? "steady" : fit.slope > 0 ? "rising" : "falling";
  const worsening = !steady && ((m.worse === "up" && fit.slope > 0) || (m.worse === "down" && fit.slope < 0));
  return { key, label: m.label, unit: m.unit, now: Number.isFinite(now) ? now : null, base, z, away, concern, direction, perWeek, worsening, forecast: forecast(log, key, today) };
}

/** Hours of sleep missing against 7 a night over the last 7 nights (nights with no reading not counted). */
export function sleepDebt(log, today, n = 7) {
  const vals = series(log, "sleepHours", today, n).map((p) => p.v).filter((v) => v != null);
  return { hours: r1(vals.reduce((a, v) => a + Math.max(0, RULES.sleepNeed - v), 0)), nights: vals.length };
}

/** Radiation logged so far and where the mission's end lands at the same daily rate. */
export function radiationOutlook(log, today, mission) {
  const days = Object.keys(log ?? {}).filter((d) => d <= today && Number.isFinite(log[d]?.radiationDose?.value));
  if (!days.length) return null;
  const logged = days.reduce((a, d) => a + log[d].radiationDose.value, 0);
  const perDay = logged / days.length;
  const left = mission?.start && mission?.length ? Math.max(0, mission.length - (daysBetween(mission.start, today) + 1)) : 0;
  const atEnd = logged + perDay * left;
  return { logged: r1(logged), perDay: r2(perDay), atEnd: r1(atEnd), pctAtEnd: r1((atEnd / RADIATION_LIMITS.careerMSv) * 100), limit: RADIATION_LIMITS.careerMSv };
}

/**
 * Bone outlook at the mission's end from the share of prescribed exercise done (app's
 * illustrative model, not a NASA prediction): no exercise follows NASA's 1.5 % a month; full
 * exercise follows "<5% … during six months" with countermeasures; in between, a straight line.
 */
export function boneOutlook(adherence, mission) {
  const months = mission?.length ? mission.length / 30 : MEASURED_MONTHS;
  const withCm = (100 - WITH_CM_6M) / MEASURED_MONTHS; // % a month with full countermeasures
  const a = Math.max(0, Math.min(1, adherence ?? 0));
  const rate = RATE.high - (RATE.high - withCm) * a;
  return { rate: r2(rate), months: r1(months), atEnd: r1(100 - rate * months), extrapolated: months > MEASURED_MONTHS };
}

/**
 * What the flight surgeon should look at for one crew member, most important first:
 * [{ id, level: "act" | "watch", text }]. Built from the readings only; the caller adds reports
 * (requests to talk, symptoms, medication patterns), which are the crew member's own words.
 */
export function signals(log, today, { adherence = null } = {}) {
  const out = [];
  for (const m of METRICS) {
    const a = analyse(log, m.key, today);
    if (a.concern) out.push({ id: `away-${m.key}`, level: "watch", text: `${m.label} ${a.now} ${m.unit}: away from their usual (${a.base.mean} ± ${a.base.sd})` });
    else if (a.worsening && m.key !== "exerciseMinutes") out.push({ id: `trend-${m.key}`, level: "watch", text: `${m.label} ${a.direction} for a week (${a.perWeek > 0 ? "+" : ""}${a.perWeek} ${m.unit} a week)` });
  }
  const sleepF = forecast(log, "sleepHours", today, 3);
  if (sleepF.length && sleepF.some((p) => p.v < 6)) out.push({ id: "forecast-sleep", level: "watch", text: `Sleep heading under 6 h within 3 days if nothing changes (${sleepF.map((p) => p.v).join(", ")} h)` });
  const debt = sleepDebt(log, today);
  if (debt.hours >= RULES.sleepDebtWatch) out.push({ id: "sleep-debt", level: "watch", text: `${debt.hours} h of sleep missing over the last ${debt.nights} nights` });
  if (adherence != null && adherence < RULES.adherenceWatch) out.push({ id: "exercise-low", level: "watch", text: `${Math.round(adherence * 100)} % of prescribed exercise done in 7 days` });
  return out;
}
