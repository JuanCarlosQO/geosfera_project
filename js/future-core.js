// Module 5 — Future body. Rules with no DOM so Node can test them.
// Projects bone mineral density over a mission with NASA's own average loss without
// countermeasures (1 % to 1.5 % a month, measured on 4-to-6-month missions), against
// NASA's requirement (hip and spine at or above 95 % of pre-mission). Beyond 6 months the
// straight line is the APP'S EXTRAPOLATION, not a NASA prediction, and the screen says so.
// The crew member's own countermeasures (exercise, vitamin D) are shown as habits only:
// NASA publishes no formula that turns minutes of exercise into a bone number.

export const RATE = { low: 1, high: 1.5 };   // % per month, NASA HRP
export const MEASURED_MONTHS = 6;            // NASA's figure comes from 4-to-6-month missions
export const REQUIREMENT = 95;               // % of pre-mission, hip and spine [V1 4027]
export const WITH_CM_6M = 95;                // "<5% in total hip or spine" after 6 months with countermeasures
export const EXERCISE_MIN = 90;              // NASA: 1.5 hours per day
export const MAX_MONTHS = 36;

const round = (v, d = 1) => Number(v.toFixed(d));

/** Bone mineral density left, % of pre-mission, after `months` at `rate` % a month (never below 0). */
export const remaining = (months, rate) => Math.max(0, round(100 - rate * months));

/** The range NASA's average gives after `months`, and whether that is beyond what NASA measured. */
export function band(months) {
  return { best: remaining(months, RATE.low), worst: remaining(months, RATE.high), extrapolated: months > MEASURED_MONTHS };
}

/** Month at which a rate crosses NASA's requirement. */
export const monthsToRequirement = (rate) => round((100 - REQUIREMENT) / rate);

/** "above" the requirement for the whole range, "crossing" when part of it is below, "below" otherwise. */
export function versusRequirement(months) {
  const b = band(months);
  if (b.worst >= REQUIREMENT) return "above";
  if (b.best >= REQUIREMENT) return "crossing";
  return "below";
}

const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const lastDays = (today, n) => { const [y, m, d] = today.split("-").map(Number); return Array.from({ length: n }, (_, i) => key(new Date(y, m - 1, d - (n - 1 - i)))); };

/** Countermeasure habits over the last n days: exercise at NASA's 1.5 h and vitamin D taken. */
export function habits(log, supplements, today, n = 14) {
  const days = lastDays(today, n);
  return {
    days: n,
    exercise: days.filter((d) => (log?.[d]?.exerciseMinutes?.value ?? 0) >= EXERCISE_MIN).length,
    exerciseLogged: days.filter((d) => log?.[d]?.exerciseMinutes?.value != null).length,
    vitaminD: days.filter((d) => supplements?.[d]?.includes("vitaminD")).length
  };
}

/* ---------- chart geometry (viewBox 0 0 W H) ---------- */

export const CHART = { W: 640, H: 300, left: 44, right: 16, top: 16, bottom: 34, yMin: 40, yMax: 100 };
export const x = (months) => CHART.left + (months / MAX_MONTHS) * (CHART.W - CHART.left - CHART.right);
export const y = (pct) => CHART.top + ((CHART.yMax - pct) / (CHART.yMax - CHART.yMin)) * (CHART.H - CHART.top - CHART.bottom);
const pt = (m, v) => `${round(x(m))} ${round(y(v))}`;

/** Paths for the measured part (0–6 months) and the extrapolated part (6–36) of one rate. */
export function linePaths(rate) {
  return { measured: `M${pt(0, 100)} L${pt(MEASURED_MONTHS, remaining(MEASURED_MONTHS, rate))}`, extrapolated: `M${pt(MEASURED_MONTHS, remaining(MEASURED_MONTHS, rate))} L${pt(MAX_MONTHS, remaining(MAX_MONTHS, rate))}` };
}

/** The shaded area between the 1 % and 1.5 % lines. */
export function bandPath() {
  return `M${pt(0, 100)} L${pt(MAX_MONTHS, remaining(MAX_MONTHS, RATE.low))} L${pt(MAX_MONTHS, remaining(MAX_MONTHS, RATE.high))} Z`;
}
