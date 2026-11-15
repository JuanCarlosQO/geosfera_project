// Demo crew: two FICTIONAL people with SIMULATED values, so the app can be shown without
// typing two weeks of data first. No real astronaut is used: NASA publishes no individual
// crew health data, and inventing readings under a real person's name would be fabricating
// records about them. Every number below is made up, but kept inside the same input limits
// the daily log enforces (log-core.js checkValue), and the radiation figure follows the
// typical ISS dose the team verified (about 0.5 mSv per day, data/vital-ranges.js).
// Pure functions, no DOM: same date in, same demo out (tests/demo-core.test.js).

import * as X from "./exercise-core.js";
import { dateKey } from "./log-core.js";

export const DEMO_KEY = "geosfera.demo";
export const DEMO_DAYS = 14;
export const DEMO_NOTE = "Demo crew: fictional people, simulated values. Not real astronaut data.";

// Two fictional astronauts for the demo and the judges: a woman and a man, each with their own
// body picture and their own code (shown on the profile screen, since anyone may try the demo).
export const DEMO_CREW = [
  { id: "demo-vreyes", name: "Valentina Reyes", role: "Commander", body: "f", age: 41, home: "Colombia", avatar: "f1" },
  { id: "demo-tokafor", name: "Tomás Okafor", role: "Flight Engineer", body: "m", age: 36, home: "Nigeria", avatar: "m1" }
];
export const DEMO_CODES = { "demo-vreyes": "3719", "demo-tokafor": "8264" };

// small seeded generator so the demo is the same every time it is loaded on the same day
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, lo, hi, step = 1) => Math.round((lo + r() * (hi - lo)) / step) * step;
const fix = (v, d) => Number(v.toFixed(d));
const at = (day, hh, mm = 0) => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d, hh, mm); };
const shift = (base, n) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);

/**
 * One member's daily log. i = 0 is the first mission day shown, DEMO_DAYS - 1 is today.
 * Today only has the morning readings: exercise and radiation are logged at day's end.
 */
function memberLog(profile, days, seed) {
  const r = rng(seed);
  const log = {};
  days.forEach((day, i) => {
    const today = i === days.length - 1;
    const p = profile(i, r);
    // where each reading came from: sleep from the watch; the rest typed from other instruments
    // (cuff, thermometer, oximeter, glucometer), as a crew member would
    const e = {
      heartRate: { value: p.hr },
      bloodPressure: { value: p.bp },
      temperature: { value: fix(p.temp, 1) },
      bloodOxygen: { value: p.spo2 },
      glucose: { value: p.glu },
      sleepHours: { value: fix(p.sleep, 1), src: "simulated" },
      mood: { value: p.mood }
    };
    if (!today) {
      e.exerciseMinutes = { value: p.exercise };
      e.radiationDose = { value: fix(between(r, 0.44, 0.56, 0.01), 2) };
    }
    e.savedAt = at(day, 7, 30 + Math.floor(r() * 20)).toISOString();
    log[day] = e;
  });
  return log;
}

// Valentina: steady for ten days, then three short nights and a mood dip (the story the
// demo tells: Fit for duty and the medication log both pick it up).
const valentina = (i, r) => {
  const late = i - (DEMO_DAYS - 3); // 0, 1, 2 on the last three days
  return {
    hr: late >= 0 ? 66 + late * 3 : between(r, 60, 66),
    bp: [between(r, 108, 118), between(r, 68, 76)],
    temp: between(r, 36.6, 37.0, 0.1),
    spo2: between(r, 97, 99),
    glu: between(r, 84, 96),
    sleep: late >= 0 ? [6.4, 5.9, 5.3][late] : between(r, 7.0, 7.8, 0.1),
    mood: late >= 0 ? [4, 3, 3][late] : between(r, 4, 5),
    exercise: late >= 0 ? [75, 60, 45][late] : between(r, 90, 105, 5)
  };
};
// Tomás: everything in order, the "all clear" example.
const tomas = (i, r) => ({
  hr: between(r, 60, 66),
  bp: [between(r, 110, 119), between(r, 70, 78)],
  temp: between(r, 36.6, 37.1, 0.1),
  spo2: between(r, 97, 99),
  glu: between(r, 82, 94),
  sleep: between(r, 7.1, 8.0, 0.1),
  mood: between(r, 4, 5),
  exercise: between(r, 95, 115, 5)
});
/**
 * Everything the demo writes: { crew, logs: { memberId: log }, meds, mission, marker }.
 * Medication doses belong to Valentina's story (melatonin after midnight, three nights in a row).
 */
export function buildDemo(now = new Date()) {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Array.from({ length: DEMO_DAYS }, (_, i) => dateKey(shift(base, i - (DEMO_DAYS - 1))));
  const today = days[days.length - 1];
  const seed = Number(today.replaceAll("-", ""));
  const logs = {
    [DEMO_CREW[0].id]: memberLog(valentina, days, seed + 1),
    [DEMO_CREW[1].id]: memberLog(tomas, days, seed + 2)
  };

  const doses = days.slice(-3).map((day, k) => {
    const t = at(day, 0, 30 + k * 5);
    return {
      id: `melatonin-${t.getTime()}`, medId: "melatonin", units: 1, at: t.toISOString(), reason: "Sleep",
      // the first two were rated; the last one is still waiting for "Did it work?"
      outcome: k < 2 ? { worked: "partly", effects: [], at: at(day, 7, 40).toISOString() } : null
    };
  });
  const supplements = {};
  days.forEach((day, i) => { if (i !== 4 && i !== 9) supplements[day] = ["vitaminD"]; });

  // countermeasure exercise: Valentina on the starting plan, loads creeping up, back pain after
  // yesterday's deadlifts; Tomás on a plan the ground wrote, and a frayed treadmill bungee
  let exercise = X.cleanStore({});
  const vPlan = X.planFor(exercise, DEMO_CREW[0].id).sessions;
  days.slice(-7, -1).forEach((day, i) => {
    exercise = X.logSession(exercise, { member: DEMO_CREW[0].id, day, session: vPlan[0], minutes: 55 + (i % 2) * 5, now: at(day, 10, 15),
      sets: [{ move: "squat", load: 230 + i * 4, reps: 8 }, { move: "deadlift", load: 255 + i * 4, reps: 6 }, { move: "heel", load: 280, reps: 12 }],
      symptoms: i === 5 ? ["back"] : [], note: i === 5 ? "Lower back after the deadlifts" : "" }).store;
    if (i !== 2) exercise = X.logSession(exercise, { member: DEMO_CREW[0].id, day, session: vPlan[1], minutes: 30, now: at(day, 16, 0) }).store;
  });
  exercise = X.setPlan(exercise, DEMO_CREW[1].id, [{ focus: "upper", minutes: 45 }, { focus: "run", minutes: 40 }], "Ground medical team", at(days[0], 9, 0)).store;
  const tPlan = X.planFor(exercise, DEMO_CREW[1].id).sessions;
  days.slice(-7, -1).forEach((day, i) => {
    exercise = X.logSession(exercise, { member: DEMO_CREW[1].id, day, session: tPlan[0], minutes: 45, now: at(day, 9, 30), sets: [{ move: "bench", load: 150 + i * 5, reps: 8 }, { move: "row", load: 140 + i * 5, reps: 10 }] }).store;
    if (i !== 3) exercise = X.logSession(exercise, { member: DEMO_CREW[1].id, day, session: tPlan[1], minutes: 40, now: at(day, 17, 0) }).store;
  });
  exercise = X.addFault(exercise, { member: DEMO_CREW[1].id, device: "t2", text: "One harness bungee looks frayed near the clip", now: at(days[days.length - 2], 17, 50), id: "f-demo-1" }).store;

  // the daily log's "Exercise today" follows the sessions logged (today stays open for the demo)
  for (const m of DEMO_CREW) for (const day of days) {
    const mins = X.minutesOn(exercise, m.id, day);
    if (logs[m.id][day]) { if (mins) logs[m.id][day].exerciseMinutes = { value: mins, src: "exercise" }; else if (day === today) delete logs[m.id][day].exerciseMinutes; }
  }

  return {
    exercise,
    crew: { members: DEMO_CREW.map((m) => ({ ...m })), active: DEMO_CREW[0].id },
    logs,
    meds: { doses, supplements },
    mission: { start: days[0] },
    // two messages from home waiting sealed for Valentina (family channel), 20 minutes in transit
    family: {
      [DEMO_CREW[0].id]: [
        { v: 1, id: "fm-demo-1", to: "Valentina Reyes", from: "Dad", rel: "Parent", kind: "hello", text: "The mango tree you planted gave fruit this week. I am saving the best ones for when you are back. Sleep well up there.", at: at(days[days.length - 3], 18, 10).toISOString(), arrivedAt: at(days[days.length - 3], 18, 30).toISOString(), state: "sealed", openedAt: null, simulated: true },
        { v: 1, id: "fm-demo-2", to: "Valentina Reyes", from: "Camila", rel: "Sibling", kind: "news", text: "Mateo took his first steps today. He walked straight to your photo on the shelf. We are all fine, and so proud of you.", at: at(days[days.length - 1], 6, 5).toISOString(), arrivedAt: at(days[days.length - 1], 6, 25).toISOString(), state: "sealed", openedAt: null, simulated: true }
      ]
    },
    marker: { loadedAt: now.toISOString(), ids: DEMO_CREW.map((m) => m.id), note: DEMO_NOTE }
  };
}

export const isDemoId = (id) => DEMO_CREW.some((m) => m.id === id);
