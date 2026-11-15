// Demo crew: three FICTIONAL people with SIMULATED values, so the app can be shown without
// typing two weeks of data first. No real astronaut is used: NASA publishes no individual
// crew health data, and inventing readings under a real person's name would be fabricating
// records about them. Every number below is made up, but kept inside the same input limits
// the daily log enforces (log-core.js checkValue), and the radiation figure follows the
// typical ISS dose the team verified (about 0.5 mSv per day, data/vital-ranges.js).
// Pure functions, no DOM: same date in, same demo out (tests/demo-core.test.js).

import { dateKey } from "./log-core.js";

export const DEMO_KEY = "geosfera.demo";
export const DEMO_DAYS = 14;
export const DEMO_NOTE = "Demo crew: fictional people, simulated values. Not real astronaut data.";

export const DEMO_CREW = [
  { id: "demo-vreyes", name: "Valentina Reyes", role: "Commander" },
  { id: "demo-tokafor", name: "Tomás Okafor", role: "Flight Engineer" },
  { id: "demo-alindqvist", name: "Amara Lindqvist", role: "Mission Specialist" }
];

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
    // where each reading came from: the watch (sleep) and the live sensors (heart rate, blood
    // pressure) as the Devices screen fills them; the rest typed, as a crew member would
    const e = {
      heartRate: { value: p.hr, src: "sensors" },
      bloodPressure: { value: p.bp, src: "sensors" },
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
// Amara: a rough first two days (space adaptation), then fine; a slightly high pressure today.
const amara = (i, r) => ({
  hr: i < 2 ? between(r, 76, 82) : between(r, 60, 68),
  bp: i === DEMO_DAYS - 1 ? [124, 79] : [between(r, 106, 116), between(r, 66, 74)],
  temp: between(r, 36.6, 37.1, 0.1),
  spo2: between(r, 96, 99),
  glu: between(r, 85, 97),
  sleep: i < 2 ? between(r, 5.8, 6.4, 0.1) : between(r, 7.0, 7.6, 0.1),
  mood: i < 2 ? 3 : between(r, 4, 5),
  exercise: i < 2 ? 40 : between(r, 85, 100, 5)
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
    [DEMO_CREW[1].id]: memberLog(tomas, days, seed + 2),
    [DEMO_CREW[2].id]: memberLog(amara, days, seed + 3)
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

  return {
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
