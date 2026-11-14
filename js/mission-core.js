// Module 4 — mission progress and gamification rules, with no DOM so Node can test them.
// Rule from Juan Carlos: reward the HABIT of measuring and doing the countermeasures,
// never the health values themselves. No badge depends on what a vital sign reads.

import { FIELDS, dateKey } from "./log-core.js";

/** NASA: "Six to seven days a week … resistance training and aerobic exercises for 1.5 hours per day". */
export const EXERCISE = {
  dailyMinutes: 90,
  daysPerWeek: 6,
  quote: "Six to seven days a week … resistance training and aerobic exercises for 1.5 hours per day",
  source: "NASA — Risk of reduced cardiorespiratory and musculoskeletal fitness",
  url: "https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/"
};

const dayKeys = (log) => Object.keys(log ?? {}).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
const filled = (entry) => FIELDS.filter((f) => entry?.[f.key]?.value != null).length;
const logged = (entry) => filled(entry) > 0;

export function addDays(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}

export function lastDays(today, n) {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
}

/** Consecutive days with a check-in, ending today (or yesterday while today is still open). */
export function currentStreak(log, today) {
  let day = logged(log?.[today]) ? today : addDays(today, -1);
  let n = 0;
  while (logged(log?.[day])) { n += 1; day = addDays(day, -1); }
  return n;
}

export function bestStreak(log) {
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of dayKeys(log)) {
    if (!logged(log[d])) { run = 0; prev = d; continue; }
    run = prev && addDays(prev, 1) === d && run > 0 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export const exerciseMinutes = (entry) => entry?.exerciseMinutes?.value ?? 0;
export const ringFraction = (entry) => Math.min(1, exerciseMinutes(entry) / EXERCISE.dailyMinutes);

export function week(log, today) {
  return lastDays(today, 7).map((d) => ({
    day: d,
    minutes: exerciseMinutes(log?.[d]),
    goal: exerciseMinutes(log?.[d]) >= EXERCISE.dailyMinutes,
    logged: logged(log?.[d]),
    steps: filled(log?.[d])
  }));
}

/** Achievements: each one is about doing something, never about a value being "good". */
export const ACHIEVEMENTS = [
  { id: "first", name: "First check-in", how: "Save your first daily check-in.", target: 1, progress: (log) => dayKeys(log).filter((d) => logged(log[d])).length },
  { id: "full", name: "Full checklist", how: `Complete all ${FIELDS.length} steps in one day.`, target: FIELDS.length, progress: (log) => Math.max(0, ...dayKeys(log).map((d) => filled(log[d]))) },
  { id: "streak3", name: "Three in a row", how: "Check in three days in a row.", target: 3, progress: (log) => bestStreak(log) },
  { id: "streak7", name: "Full week", how: "Check in seven days in a row.", target: 7, progress: (log) => bestStreak(log) },
  { id: "goal", name: "Countermeasure done", how: "Log 90 minutes of exercise in a day (NASA's daily amount).", target: 1, progress: (log) => dayKeys(log).filter((d) => exerciseMinutes(log[d]) >= EXERCISE.dailyMinutes).length },
  { id: "goalweek", name: "NASA week", how: "Reach 90 minutes of exercise on 6 of the last 7 days.", target: EXERCISE.daysPerWeek, progress: (log, today) => week(log, today).filter((w) => w.goal).length },
  { id: "dosimeter", name: "Dose keeper", how: "Log your dosimeter reading on 5 days.", target: 5, progress: (log) => dayKeys(log).filter((d) => log[d].radiationDose?.value != null).length },
  { id: "second", name: "Second look", how: "After a Measure again, log that reading again on a later day.", target: 1, progress: (log) => secondLooks(log) }
];

function secondLooks(log) {
  const days = dayKeys(log);
  let n = 0;
  days.forEach((d, i) => {
    for (const f of FIELDS) {
      if (log[d][f.key]?.flag === "again" && days.slice(i + 1).some((later) => log[later][f.key]?.value != null)) n += 1;
    }
  });
  return Math.min(n, 1);
}

export function achievements(log, today) {
  return ACHIEVEMENTS.map((a) => {
    const p = Math.min(a.target, a.progress(log, today));
    return { id: a.id, name: a.name, how: a.how, target: a.target, progress: p, unlocked: p >= a.target };
  });
}

/** Share of mission days (since the first day) with a check-in. */
export function adherence(log, startDay, today) {
  if (!startDay || startDay > today) return { logged: 0, days: 0, share: 0 };
  let days = 0;
  let n = 0;
  for (let d = startDay; d <= today; d = addDays(d, 1)) { days += 1; if (logged(log?.[d])) n += 1; }
  return { logged: n, days, share: days ? n / days : 0 };
}
