// Demo crew: four FICTIONAL people with SIMULATED values, so the app can be shown without
// typing two weeks of data first. No real astronaut is used: NASA publishes no individual
// crew health data, and inventing readings under a real person's name would be fabricating
// records about them. Every number below is made up, but kept inside the same input limits
// the daily log enforces (log-core.js checkValue), and the radiation figure follows the
// typical ISS dose the team verified (about 0.5 mSv per day, data/vital-ranges.js).
// Pure functions, no DOM: same date in, same demo out (tests/demo-core.test.js).

import { makeCheckin } from "./screen-core.js";
import * as X from "./exercise-core.js";
import { dateKey } from "./log-core.js";

export const DEMO_KEY = "geosfera.demo";
export const DEMO_DAYS = 14;
export const DEMO_NOTE = "Demo crew: fictional people, simulated values. Not real astronaut data.";

// The demo mission and its four fictional crew members, each with their own body picture, avatar
// and code (shown on the profile screen, since anyone may try the demo). Each one tells a story
// that lights up different parts of the app (see buildDemo).
export const DEMO_MISSION = { name: "Expedition ERG-1", where: "Low Earth orbit station", length: 180 };
export const DEMO_CREW = [
  { id: "demo-vreyes", name: "Valentina Reyes", role: "Commander", body: "f", age: 41, home: "Colombia", avatar: "f1" },
  { id: "demo-tokafor", name: "Tomás Okafor", role: "Flight Engineer", body: "m", age: 36, home: "Nigeria", avatar: "m1" },
  { id: "demo-amorimoto", name: "Aiko Morimoto", role: "Mission Specialist", body: "f", age: 38, home: "Japan", avatar: "f2" },
  { id: "demo-amehta", name: "Arjun Mehta", role: "Crew Medical Officer", body: "m", age: 44, home: "India", avatar: "m2" }
];
export const DEMO_CODES = { "demo-vreyes": "3719", "demo-tokafor": "8264", "demo-amorimoto": "5081", "demo-amehta": "6427" };
export const DEMO_VERSION = 5;
// the crew's emergency code for the demo mission (shown on the profiles screen so anyone can try it)
export const DEMO_EMERGENCY_CODE = "246810";

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
  spo2: i % 4 === 1 ? 97 : 98, // steady on purpose: the demo's "nothing to look at" example
  glu: between(r, 82, 94),
  sleep: between(r, 7.1, 8.0, 0.1),
  mood: between(r, 4, 5),
  exercise: between(r, 95, 115, 5)
});
// Aiko: a six-hour spacewalk yesterday (no exercise that day), a headache in the evening, a
// lower mood this morning and a request to talk to someone.
const aiko = (i, r) => {
  const eva = i === DEMO_DAYS - 2, after = i === DEMO_DAYS - 1;
  return {
    hr: eva ? 72 : between(r, 58, 64),
    bp: [between(r, 104, 114), between(r, 66, 74)],
    temp: between(r, 36.5, 36.9, 0.1),
    spo2: between(r, 97, 99),
    glu: between(r, 82, 92),
    sleep: after ? 6.2 : between(r, 7.0, 7.6, 0.1),
    mood: after ? 2 : between(r, 4, 5),
    exercise: eva ? 0 : between(r, 90, 100, 5)
  };
};
// Arjun: the crew medical officer. A stuffy nose for two days, an alarm woke him in the night
// and he took a second sleep medication (the pattern NASA's sleep-medication study describes).
const arjun = (i, r) => {
  const woke = i === DEMO_DAYS - 1;
  return {
    hr: between(r, 60, 67),
    bp: [between(r, 112, 119), between(r, 72, 79)],
    temp: between(r, 36.6, 37.0, 0.1),
    spo2: between(r, 96, 99),
    glu: between(r, 86, 98),
    sleep: woke ? 5.6 : between(r, 7.1, 7.7, 0.1),
    mood: woke ? 3 : between(r, 4, 5),
    exercise: between(r, 90, 110, 5)
  };
};

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
    [DEMO_CREW[2].id]: memberLog(aiko, days, seed + 3),
    [DEMO_CREW[3].id]: memberLog(arjun, days, seed + 4)
  };
  const [vId, tId, aId, jId] = DEMO_CREW.map((m) => m.id);

  const doses = days.slice(-3).map((day, k) => {
    const t = at(day, 0, 30 + k * 5);
    return {
      id: `melatonin-${t.getTime()}`, medId: "melatonin", units: 1, at: t.toISOString(), reason: "Sleep", member: DEMO_CREW[0].id,
      // the first two were rated; the last one is still waiting for "Did it work?"
      outcome: k < 2 ? { worked: "partly", effects: [], at: at(day, 7, 40).toISOString() } : null
    };
  });
  // Aiko: two acetaminophen for a headache after the spacewalk (it worked)
  const yday = days[days.length - 2];
  doses.push({ id: `acet-${at(yday, 20, 10).getTime()}`, medId: "acetaminophen", units: 2, at: at(yday, 20, 10).toISOString(), reason: "Headache", member: aId,
    outcome: { worked: "yes", effects: [], at: at(yday, 22, 0).toISOString() } });
  // Arjun: decongestant spray two mornings; melatonin at 23:40, an alarm at 02:50, zolpidem at 03:10
  for (const day of days.slice(-3, -1)) doses.push({ id: `oxy-${at(day, 7, 50).getTime()}`, medId: "oxymetazoline", units: 1, at: at(day, 7, 50).toISOString(), reason: "Stuffy nose", member: jId, outcome: { worked: "partly", effects: [], at: at(day, 12, 0).toISOString() } });
  doses.push({ id: `melatonin-j-${at(yday, 23, 40).getTime()}`, medId: "melatonin", units: 1, at: at(yday, 23, 40).toISOString(), reason: "Sleep", member: jId, outcome: null });
  doses.push({ id: `zolpidem-j-${at(today, 3, 10).getTime()}`, medId: "zolpidem", units: 1, at: at(today, 3, 10).toISOString(), reason: "Sleep", member: jId, outcome: null });
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

  // Aiko: the starting plan, nothing on the spacewalk day
  const aPlan = X.planFor(exercise, aId).sessions;
  days.slice(-7, -1).forEach((day, i) => {
    if (day === yday) return;
    exercise = X.logSession(exercise, { member: aId, day, session: aPlan[0], minutes: 60, now: at(day, 11, 0), sets: [{ move: "squat", load: 175 + i * 3, reps: 10 }, { move: "deadlift", load: 190 + i * 3, reps: 8 }] }).store;
    exercise = X.logSession(exercise, { member: aId, day, session: aPlan[1], minutes: 30, now: at(day, 17, 30) }).store;
  });
  // Arjun: every session done, a knee report after yesterday's run
  exercise = X.setPlan(exercise, jId, [{ focus: "lower", minutes: 50 }, { focus: "run", minutes: 30 }, { focus: "steady", minutes: 20 }], "Ground medical team", at(days[0], 9, 30)).store;
  const jPlan = X.planFor(exercise, jId).sessions;
  days.slice(-7, -1).forEach((day, i) => {
    exercise = X.logSession(exercise, { member: jId, day, session: jPlan[0], minutes: 50, now: at(day, 8, 30), sets: [{ move: "squat", load: 240 + i * 5, reps: 8 }, { move: "heel", load: 300, reps: 15 }] }).store;
    exercise = X.logSession(exercise, { member: jId, day, session: jPlan[1], minutes: 30, now: at(day, 15, 0), symptoms: day === yday ? ["joint"] : [], note: day === yday ? "Right knee after the run" : "" }).store;
    exercise = X.logSession(exercise, { member: jId, day, session: jPlan[2], minutes: 20, now: at(day, 19, 0) }).store;
  });

  // Aiko and Arjun answered this morning's question; Valentina's is still waiting on her screen
  logs[aId][today].feel = { value: "tired" };
  logs[aId][today].note = { feel: "tired", reasons: ["late"], text: "Six hours outside yesterday" };
  logs[jId][today].feel = { value: "very" };
  logs[jId][today].note = { feel: "very", reasons: ["woke"], text: "Alarm at 02:50, took a second sleep pill" };

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
    mission: { start: days[0], name: DEMO_MISSION.name, where: DEMO_MISSION.where, length: DEMO_MISSION.length, emergencyCode: DEMO_EMERGENCY_CODE },
    // the ground shares Valentina's sleep and mood with her; Tomás asked this morning to see his sleep and heart rate
    sharing: { [DEMO_CREW[0].id]: { items: ["sleepHours", "mood"], at: at(yday, 16, 0).toISOString(), by: "Ground medical team" } },
    // mental health check-ins (simulated answers): a baseline on day 1 for everyone (Tomás the day
    // before launch, so his next one is due now); Valentina's stress up; Aiko's loneliness up;
    // Arjun's anxiety screen positive this morning, so the GAD-7 followed
    checkins: [
      ...DEMO_CREW.map((m, k) => makeCheckin({ member: m.id, kind: "extra", at: new Date(at(days[0], 9, 10 + k).getTime() - (k === 1 ? 86400000 : 0)), answers: { phq: [0, k === 2 ? 1 : 0], gad: [k === 3 ? 1 : 0, k === 1 ? 1 : 0], pss: [1, 3, 3, 1], ucla: [1, k === 2 ? 2 : 1, 1] } })),
      makeCheckin({ member: DEMO_CREW[0].id, kind: "extra", at: at(days[days.length - 4], 20, 15), answers: { phq: [1, 1], gad: [1, 1], pss: [2, 2, 2, 2], ucla: [1, 1, 1] } }),
      makeCheckin({ member: aId, kind: "extra", at: at(yday, 21, 40), answers: { phq: [1, 1], gad: [1, 0], pss: [2, 3, 2, 1], ucla: [2, 3, 2] } }),
      makeCheckin({ member: jId, kind: "core", at: at(today, 7, 20), answers: { phq: [1, 1], gad: [2, 2, 2, 2, 1, 1, 1] } })
    ],
    requests: [{ id: "req-demo-1", member: DEMO_CREW[1].id, items: ["sleepHours", "heartRate"], reason: "I want to see how my sleep is doing before the spacewalk prep.", at: at(today, 6, 40).toISOString(), status: "pending" }],
    // Aiko asked to talk to someone this morning (support channel)
    alerts: [{ id: "al-demo-1", at: at(today, 7, 5).toISOString(), level: "talk", from: { id: aId, name: "Aiko Morimoto", role: "Mission Specialist" }, reasons: ["low", "home"], note: "Long day outside yesterday. Would like a private call with home when possible.", acks: [], closed: null },
      { id: "al-demo-2", at: at(days[days.length - 5], 19, 30).toISOString(), level: "talk", from: { id: aId, name: "Aiko Morimoto", role: "Mission Specialist" }, reasons: ["home"], note: "", acks: [], closed: at(days[days.length - 5], 21, 0).toISOString() }],
    // Arjun opened his own data during a loss of signal two days ago, for 25 minutes
    openings: [{ member: jId, reason: "los", at: at(days[days.length - 3], 14, 5).toISOString(), closedAt: at(days[days.length - 3], 14, 30).toISOString() }],
    // two messages from home waiting sealed for Valentina (family channel), 20 minutes in transit
    family: {
      [DEMO_CREW[0].id]: [
        { v: 1, id: "fm-demo-1", to: "Valentina Reyes", from: "Dad", rel: "Parent", kind: "hello", text: "The mango tree you planted gave fruit this week. I am saving the best ones for when you are back. Sleep well up there.", at: at(days[days.length - 3], 18, 10).toISOString(), arrivedAt: at(days[days.length - 3], 18, 30).toISOString(), state: "sealed", openedAt: null, simulated: true },
        { v: 1, id: "fm-demo-2", to: "Valentina Reyes", from: "Camila", rel: "Sibling", kind: "news", text: "Mateo took his first steps today. He walked straight to your photo on the shelf. We are all fine, and so proud of you.", at: at(days[days.length - 1], 6, 5).toISOString(), arrivedAt: at(days[days.length - 1], 6, 25).toISOString(), state: "sealed", openedAt: null, simulated: true }
      ],
      [aId]: [
        { v: 1, id: "fm-demo-3", to: "Aiko Morimoto", from: "Ken", rel: "Partner", kind: "hello", text: "We watched your spacewalk on the live feed. Hana pointed at the screen the whole time. Rest well tonight.", at: at(yday, 21, 0).toISOString(), arrivedAt: at(yday, 21, 20).toISOString(), state: "sealed", openedAt: null, simulated: true }
      ]
    },
    marker: { loadedAt: now.toISOString(), ids: DEMO_CREW.map((m) => m.id), note: DEMO_NOTE, version: DEMO_VERSION }
  };
}

export const isDemoId = (id) => DEMO_CREW.some((m) => m.id === id);
