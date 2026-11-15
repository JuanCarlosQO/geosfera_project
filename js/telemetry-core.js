// Module 10 — live telemetry simulator. Rules with no DOM so Node can test them.
// Started from a team member's prototype (js/telemetry.js, "Add telemetry module"): same
// idea — a stream that changes every second and scenarios that trigger alerts — rebuilt so
// every limit has a source and nothing is presented as a real crew reading.
//
// What is what:
//  · Heart rate, blood pressure, time still, cabin CO2, temperature, humidity and pressure
//    are SIMULATED, around NASA's nominal values and the crew member's own baseline.
//  · The radiation dose rate is REAL NASA data (RadLab, ISS DosTel1) replayed in a loop.
//  · Limits quote NASA (docs/SOURCES.md); vital signs use the team's reference ranges;
//    "your usual range" and the stillness reminder are APP RULES and say so.

import { judgeReading } from "./log-core.js";
import { RANGES } from "./data/vital-ranges.js";

export const TICK_MS = 1000;
export const HISTORY = 60;          // seconds kept for the sparklines
export const RULES = {
  baselineDays: 14,                 // app rule: days of the log used for "your usual range"
  baselineMin: 5,                   // app rule: readings needed before the band is shown
  baselineSd: 2,                    // app rule: band = mean ± 2 standard deviations
  stillWatch: 60,                   // app rule: minutes without moving before a reminder
  stillAct: 120,                    // app rule: minutes without moving before "move now"
  radiationSpike: 10,               // app rule: dose rate this many times the replay's median
  smoothSeconds: 10,                // app rule: vital signs are judged on their 10-second average
  // --- from the team's simulator engine; illustrative app rules, not NASA limits ---
  age: 40,                          // estimated maximum heart rate = 220 − age (demo value)
  hrExercise: [0.85, 0.95],         // watch / act as a fraction of that maximum while exercising
  hrEva: [0.70, 0.85],              // the same during a spacewalk
  hrRestAct: 130,                   // resting heart rate that is "act now"
  hrRecovery: 115,                  // still above this 45 s after stopping: slow recovery
  recoveryAfter: 45,
  recoverySeconds: 60,              // how long the recovery phase lasts
  sysEffort: 210,                   // systolic pressure worth a look during effort
  sysLow: 90,
  smoke: [50, 150],                 // µg/m³ of particles: watch / act
  ammonia: [3, 20],                 // ppm
  power: [70, 40],                  // % of power available (below)
  hydration: [80, 65],              // % of estimated hydration (below)
  pressureLow: [97, 92],            // kPa (below), around the ISS's usual 101.3
  leakKpaMin: 2,                    // cabin pressure falling this fast is a leak
  raiseAfter: 3,                    // readings in a row before an alert is raised
  clearAfter: 5                     // readings in a row back to normal before it is cleared
};

/* NASA limits used by the simulator (quotes and links in js/data/telemetry.js). */
export const LIMITS = {
  co2Standard: 3,          // mmHg, 1-hour average (NASA-STD-3001 Vol. 2 [V2 6004])
  co2Symptoms: 4.5,        // mmHg, upper end of the headache band and start of fatigue/nausea reports
  co2PpmPerMmHg: 5000 / 3.8, // NASA OCHMO-TB-004: "0.5% CO2 = 3.8 mmHg CO2."
  tempHealth: [18, 27],    // °C health limits
  tempComfort: [20, 25],   // °C comfort and performance zone
  rhHealth: [25, 75],      // % relative humidity
  rhComfort: [30, 60],
  pressure: [34.5, 103],   // kPa allowed total pressure
  pressureIss: 101.3       // kPa, 14.7 psia, the ISS's usual sea-level pressure
};

export const SCENARIOS = {
  nominal: { label: "Reset all", note: "Everything at NASA's usual cabin values.", group: "reset" },
  co2: { label: "CO₂ scrubber fault", note: "Simulated: CO₂ removal slows and cabin CO₂ climbs.", group: "cabin" },
  solar: { label: "Solar particle event", note: "Simulated: a burst of particles multiplies the dose rate.", group: "cabin" },
  depress: { label: "Cabin leak", note: "Simulated: the cabin loses pressure, and gets colder and drier.", group: "cabin" },
  thermal: { label: "Cooling failure", note: "Simulated: thermal control stops; heat and humidity build up.", group: "cabin" },
  fire: { label: "Fire", note: "Simulated: smoke particles rise fast, with heat and some CO₂.", group: "cabin" },
  nh3: { label: "Ammonia leak", note: "Simulated: coolant ammonia reaches the cabin air.", group: "cabin" },
  power: { label: "Power loss", note: "Simulated: power drops; fans slow, so CO₂ and temperature rise.", group: "cabin" },
  exercise: { label: "Exercise session", note: "Simulated: a workout. A high heart rate is expected and judged as effort.", group: "crew" },
  eva: { label: "Spacewalk", note: "Simulated: work outside in the suit. Effort limits are stricter.", group: "crew" },
  still: { label: "Long time still", note: "Simulated: hours at a console without moving.", group: "crew" },
  hydration: { label: "Dehydration", note: "Simulated: estimated hydration falls; heart rate rises, pressure drops.", group: "crew" },
  tachy: { label: "Racing heart", note: "Simulated: heart rate jumps at rest with no effort.", group: "crew" }
};
export const EFFORT = ["exercise", "eva"];
const EFFORT_END = { exercise: 110, eva: 240 }; // seconds before the effort ends by itself

/* ---------- a repeatable random source, so tests and demos behave the same ---------- */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (v, d = 0) => Number(v.toFixed(d));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ---------- personal baseline (the crew member compared with themself) ---------- */

/**
 * Mean and spread of one reading over the last RULES.baselineDays days of the log.
 * Blood pressure gives the systolic (part 0) or diastolic (part 1) number.
 * Returns null until RULES.baselineMin readings exist.
 */
export function baseline(log, key, today, part = 0) {
  const [y, m, d] = today.split("-").map(Number);
  const values = [];
  for (let i = 0; i < RULES.baselineDays; i += 1) {
    const dt = new Date(y, m - 1, d - i);
    const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const r = log?.[k]?.[key];
    if (r?.value == null || r.flag === "again") continue;
    values.push(Array.isArray(r.value) ? r.value[part] : r.value);
  }
  if (values.length < RULES.baselineMin) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1));
  const spread = Math.max(sd, mean * 0.03); // never narrower than ±3 % (app rule, avoids alarms on very steady logs)
  return { n: values.length, mean: round(mean, 1), sd: round(sd, 1), low: round(mean - RULES.baselineSd * spread, 1), high: round(mean + RULES.baselineSd * spread, 1) };
}

/** "below" / "above" the crew member's usual range, or "inside". */
export const versusBaseline = (value, band) => (!band ? null : value < band.low ? "below" : value > band.high ? "above" : "inside");

/* ---------- the stream ---------- */

/** First state of the stream, centred on the crew member's baseline when there is one. */
export function startState({ hr = null, sys = null, dia = null } = {}, radiation) {
  return {
    t: 0,
    scenario: "nominal",
    since: 0,
    heartRate: hr ?? 70,
    systolic: sys ?? 116,
    diastolic: dia ?? 75,
    still: 12,
    co2: 2.2,
    temperature: 22.4,
    humidity: 46,
    pressure: LIMITS.pressureIss,
    smoke: 5,
    ammonia: 0,
    power: 100,
    hydration: 95,
    active: {},
    mode: "rest",
    presHist: [],
    radIndex: 0,
    radiation,
    base: { hr: hr ?? 70, sys: sys ?? 116, dia: dia ?? 75 }
  };
}

/** Moves a value a little toward its target, with some noise. */
const drift = (value, target, pull, noise, rand) => value + (target - value) * pull + (rand() - 0.5) * 2 * noise;

/** What one active scenario adds to each channel's target, ramping up over its own time. */
function contribution(id, c) {
  if (EFFORT.includes(id) && c.phase === "rec") { const r = Math.exp(-c.t / 20); return Object.fromEntries(Object.entries(c.c0 ?? {}).map(([k, v]) => [k, v * r])); }
  const k = (n) => Math.min(c.since, n) / n;
  switch (id) {
    case "co2": return { co2: 4.4 * k(45), hr: 9 * k(45), sys: 6 * k(45), dia: 4 * k(45) };
    case "solar": return { hr: 4 * k(45) };
    case "still": return { hr: -4 * k(45) };
    case "depress": return { pressure: -16.8 * k(90), temperature: -2.4 * k(90), humidity: -12 * k(90), hr: 28 * k(90), sys: 14 * k(90) };
    case "thermal": return { temperature: 10.5 * k(80), humidity: 30 * k(80), hr: 8 * k(80) };
    case "fire": return { smoke: 200 * k(40), temperature: 4 * k(40), co2: 1.5 * k(40), hr: 15 * k(40), humidity: -5 * k(40) };
    case "nh3": return { ammonia: 30 * k(50), hr: 10 * k(50) };
    case "power": return { power: -65 * k(90), co2: 2.2 * k(90), temperature: 4 * k(90), hr: 3 * k(90) };
    case "hydration": return { hydration: -35 * k(90), hr: 22 * k(90), sys: -12 * k(90) };
    case "tachy": return { hr: 75 * k(30) };
    case "exercise": return { hr: 77 * k(20), sys: 32 * k(20), dia: 6 * k(20), temperature: 0.5 * k(20), humidity: 8 * k(20), co2: 0.4 * k(20) };
    case "eva": return { hr: 40 * k(15), sys: 15 * k(15), dia: 4 * k(15) };
    default: return {};
  }
}

/** "exercise", "eva", "recovery" (just stopped an effort) or "rest". */
export function modeOf(active = {}) {
  if (active.eva && active.eva.phase !== "rec") return "eva";
  if (active.exercise && active.exercise.phase !== "rec") return "exercise";
  if (EFFORT.some((id) => active[id]?.phase === "rec")) return "recovery";
  return "rest";
}
/** Seconds since the last effort stopped (0 when not recovering). */
export const recoveryTime = (active = {}) => Math.max(0, ...EFFORT.map((id) => (active[id]?.phase === "rec" ? active[id].t : 0)));

/** One second later. Pure: same state, scenarios and random source give the same result. */
export function step(state, rand) {
  const s = { ...state, t: state.t + 1, since: state.since + 1, active: {} };
  for (const [id, c0] of Object.entries(state.active ?? {})) {
    const c = { ...c0, since: c0.since + 1 };
    if (EFFORT.includes(id)) {
      if (c.phase === "rec") { c.t += 1; if (c.t > RULES.recoverySeconds) continue; }
      else if (c.since > EFFORT_END[id]) Object.assign(c, { phase: "rec", t: 0, c0: contribution(id, c) });
    }
    s.active[id] = c;
  }
  s.mode = modeOf(s.active);
  const T = { hr: s.base.hr, sys: s.base.sys, dia: s.base.dia, co2: 2.2, temperature: 22.4, humidity: 46, pressure: LIMITS.pressureIss, smoke: 5, ammonia: 0, power: 100, hydration: 95 };
  for (const [id, c] of Object.entries(s.active)) for (const [k, v] of Object.entries(contribution(id, c))) T[k] += v;

  s.co2 = clamp(drift(s.co2, T.co2, 0.12, 0.05, rand), 0.4, 12);
  s.heartRate = clamp(drift(s.heartRate, T.hr, 0.15, 1.2, rand), 35, 200);
  s.systolic = clamp(drift(s.systolic, T.sys, 0.12, 1.1, rand), 70, 230);
  s.diastolic = clamp(drift(s.diastolic, T.dia, 0.12, 0.8, rand), 45, 130);
  s.temperature = clamp(drift(s.temperature, T.temperature, 0.08, 0.05, rand), 10, 40);
  s.humidity = clamp(drift(s.humidity, T.humidity, 0.08, 0.4, rand), 5, 95);
  s.pressure = clamp(drift(s.pressure, T.pressure, 0.2, 0.05, rand), 30, 110);
  // one simulated second stands for one minute at the console
  const resting = s.mode === "rest";
  s.still = !resting ? 0 : s.active.still ? s.still + 1 : Math.max(0, s.still + (rand() < 0.08 ? -s.still : 0.25));
  s.smoke = clamp(drift(s.smoke ?? 5, T.smoke, 0.15, 0.5, rand), 0, 400);
  s.ammonia = clamp(drift(s.ammonia ?? 0, T.ammonia, 0.15, 0.03, rand), 0, 60);
  s.power = clamp(drift(s.power ?? 100, T.power, 0.1, 0.15, rand), 0, 100);
  s.hydration = clamp(drift(s.hydration ?? 95, T.hydration, 0.06, 0.1, rand), 30, 100);
  s.presHist = [...(state.presHist ?? []), s.pressure].slice(-12);
  s.radIndex = (s.radIndex + 1) % (s.radiation?.values.length || 1);
  return s;
}

/** Several scenarios can run at once. Starting one twice changes nothing. */
export function startScenario(state, id) {
  if (!SCENARIOS[id] || id === "nominal" || state.active?.[id]) return state;
  const c = { since: 0, ...(EFFORT.includes(id) ? { phase: "on" } : {}) };
  return { ...state, scenario: id, since: 0, active: { ...(state.active ?? {}), [id]: c }, ...(id === "still" ? { still: Math.max(state.still, 30) } : {}) };
}

/** Stopping an effort starts its recovery (heart rate comes down little by little); anything else just ends. */
export function stopScenario(state, id) {
  const c = state.active?.[id];
  if (!c) return state;
  const active = { ...state.active };
  if (EFFORT.includes(id) && c.phase !== "rec") active[id] = { ...c, phase: "rec", t: 0, c0: contribution(id, c) };
  else delete active[id];
  const left = Object.keys(active);
  return { ...state, active, scenario: left.at(-1) ?? "nominal" };
}

export const toggleScenario = (state, id) => (state.active?.[id] && state.active[id].phase !== "rec" ? stopScenario(state, id) : startScenario(stopRecovery(state, id), id));
const stopRecovery = (state, id) => { if (state.active?.[id]?.phase !== "rec") return state; const active = { ...state.active }; delete active[id]; return { ...state, active }; };

/** Stops everything; an effort still goes through its recovery, as a body would. */
export const resetAll = (state) => Object.keys(state.active ?? {}).reduce((st, id) => (st.active[id]?.phase === "rec" ? st : stopScenario(st, id)), state);

/** Only this scenario (or none, for "nominal"): what the single-scenario buttons and the tests use. */
export function changeScenario(state, scenario) {
  if (!SCENARIOS[scenario]) return state;
  const clean = { ...state, active: {}, scenario: "nominal", since: 0 };
  return scenario === "nominal" ? clean : startScenario(clean, scenario);
}

/** The real dose rate at this point of the replay; the solar scenario multiplies it (simulated). */
export function doseRate(state) {
  const values = state.radiation?.values ?? [];
  if (!values.length) return { value: null, real: false };
  const real = values[state.radIndex];
  const solar = state.active?.solar;
  if (!solar) return { value: real, real: true, time: state.radiation.times[state.radIndex] };
  const factor = 1 + Math.min(1, solar.since / 20) * 39; // up to 40× in 20 s
  return { value: round(real * factor, 2), real: false, time: state.radiation.times[state.radIndex] };
}

export function median(values) {
  const v = [...values].sort((a, b) => a - b);
  const h = Math.floor(v.length / 2);
  return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2;
}

/* ---------- judging each channel ---------- */

export function judgeCo2(mmHg) {
  if (mmHg > LIMITS.co2Symptoms) return "act";
  if (mmHg > LIMITS.co2Standard) return "watch";
  return "normal";
}

const zone = (v, health, comfort) => (v < health[0] || v > health[1] ? "act" : v < comfort[0] || v > comfort[1] ? "watch" : "normal");
export const judgeTemperature = (c) => zone(c, LIMITS.tempHealth, LIMITS.tempComfort);
export const judgeHumidity = (rh) => zone(rh, LIMITS.rhHealth, LIMITS.rhComfort);
export const judgePressure = (kPa) => (kPa <= LIMITS.pressure[0] || kPa > LIMITS.pressure[1] ? "act" : "normal");
export const judgeStill = (min) => (min >= RULES.stillAct ? "act" : min >= RULES.stillWatch ? "watch" : "normal");
export const judgeDose = (rate, typical) => (rate != null && typical > 0 && rate >= typical * RULES.radiationSpike ? "watch" : "normal");
const below = (v, [watch, act]) => (v < act ? "act" : v < watch ? "watch" : "normal");
const atOrAbove = (v, [watch, act]) => (v >= act ? "act" : v >= watch ? "watch" : "normal");
export const judgeSmoke = (v) => atOrAbove(v, RULES.smoke);
export const judgeAmmonia = (v) => atOrAbove(v, RULES.ammonia);
export const judgePower = (v) => below(v, RULES.power);
export const judgeHydration = (v) => below(v, RULES.hydration);
export const maxHeartRate = () => 220 - RULES.age;

/** kPa per minute over the last readings (negative = falling), from averaged ends so noise does not count. */
export function pressureRate(hist = []) {
  if (hist.length < 10) return 0;
  const mean = (l) => l.reduce((a, b) => a + b, 0) / l.length;
  return ((mean(hist.slice(-3)) - mean(hist.slice(0, 3))) / (hist.length - 3)) * 60;
}
/** NASA's range first; then the team's leak rule around the ISS's usual pressure (illustrative). */
export function judgeCabinPressure(kPa, hist) {
  if (judgePressure(kPa) === "act") return "act";
  const leak = pressureRate(hist) < -RULES.leakKpaMin, [watch, act] = RULES.pressureLow;
  if (kPa < act || (leak && kPa < watch)) return "act";
  return kPa < watch || leak ? "watch" : "normal";
}
/** Heart rate in context: effort is judged against an estimated maximum, rest against the ranges. */
export function judgeHeart(mode, hr, band, recovering = 0) {
  const max = maxHeartRate();
  if (mode === "exercise" || mode === "eva") { const [w, a] = mode === "exercise" ? RULES.hrExercise : RULES.hrEva; return hr > a * max ? "act" : hr > w * max ? "watch" : "normal"; }
  if (mode === "recovery") return recovering >= RULES.recoveryAfter && hr > RULES.hrRecovery ? "watch" : "normal";
  return hr > RULES.hrRestAct ? "act" : judgeVital("heartRate", hr, band);
}
export function judgePressureArterial(mode, bp, band) {
  if (mode !== "rest") return bp[0] > RULES.sysEffort ? "watch" : "normal";
  const st = judgeVital("bloodPressure", bp, band);
  return st === "normal" && bp[0] < RULES.sysLow ? "watch" : st;
}

export const co2Ppm = (mmHg) => Math.round(mmHg * LIMITS.co2PpmPerMmHg);

/**
 * The exact condition behind every alert, written from the same numbers the judges use.
 * basis: "nasa" (quoted limit), "team" (Earth clinical reference) or "app" (app rule).
 */
export function conditions(typicalDose = 0) {
  const L = LIMITS, R = RULES;
  return [
    { key: "co2", basis: "nasa", watch: `above ${L.co2Standard} mmHg (${co2Ppm(L.co2Standard)} ppm)`, act: `above ${L.co2Symptoms} mmHg (${co2Ppm(L.co2Symptoms)} ppm)`, facts: ["co2Standard", "co2Above"] },
    { key: "temperature", basis: "nasa", watch: `outside ${L.tempComfort[0]}–${L.tempComfort[1]} °C`, act: `outside ${L.tempHealth[0]}–${L.tempHealth[1]} °C`, facts: ["comfort", "temperature"] },
    { key: "humidity", basis: "nasa", watch: `outside ${L.rhComfort[0]}–${L.rhComfort[1]} %`, act: `outside ${L.rhHealth[0]}–${L.rhHealth[1]} %`, facts: ["comfort", "humidity"] },
    { key: "pressure", basis: "nasa", watch: null, act: `${L.pressure[0]} kPa or less, or above ${L.pressure[1]} kPa`, facts: ["pressure"] },
    { key: "dose", basis: "app", watch: `${R.radiationSpike} times the replay's median or more${typicalDose ? ` (${round(typicalDose * R.radiationSpike, 1)} µGy/h)` : ""}`, act: null, facts: [] },
    { key: "still", basis: "app", watch: `${R.stillWatch} minutes or more`, act: `${R.stillAct} minutes or more`, facts: [] },
    { key: "pressure", name: "Cabin leak", basis: "app", watch: `below ${R.pressureLow[0]} kPa, or falling ${R.leakKpaMin} kPa a minute or faster`, act: `below ${R.pressureLow[1]} kPa, or falling that fast below ${R.pressureLow[0]} kPa`, facts: [] },
    { key: "smoke", basis: "app", watch: `${R.smoke[0]} µg/m³ or more`, act: `${R.smoke[1]} µg/m³ or more`, facts: [] },
    { key: "ammonia", basis: "app", watch: `${R.ammonia[0]} ppm or more`, act: `${R.ammonia[1]} ppm or more`, facts: [] },
    { key: "power", basis: "app", watch: `below ${R.power[0]} %`, act: `below ${R.power[1]} %`, facts: [] },
    { key: "hydration", basis: "app", watch: `below ${R.hydration[0]} %`, act: `below ${R.hydration[1]} %`, facts: [] },
    { key: "heartRate", name: "Heart rate in effort", basis: "app", watch: `exercise: above ${Math.round(R.hrExercise[0] * 100)} % of an estimated maximum of ${220 - R.age} bpm; spacewalk: above ${Math.round(R.hrEva[0] * 100)} %; ${R.recoveryAfter} s after stopping: still above ${R.hrRecovery} bpm`, act: `exercise: above ${Math.round(R.hrExercise[1] * 100)} %; spacewalk: above ${Math.round(R.hrEva[1] * 100)} %; at rest: above ${R.hrRestAct} bpm`, facts: [] },
    { key: "heartRate", basis: "team", watch: `outside 60–100 bpm, or outside your usual range, on the ${R.smoothSeconds}-second average`, act: null, facts: [] },
    { key: "bloodPressure", basis: "team", watch: `top number 120 or more, bottom 80 or more, or outside your usual range, on the ${R.smoothSeconds}-second average`, act: "140/90 or more", facts: [] }
  ];
}

/** Vital sign: the team's reference range first; the personal band can raise it to "watch". */
export function judgeVital(key, value, band) {
  const ref = RANGES[key] ? judgeReading(key, { value }) : "pending";
  const mine = versusBaseline(Array.isArray(value) ? value[0] : value, band);
  if (ref === "act") return "act";
  if (ref === "watch" || mine === "above" || mine === "below") return "watch";
  return ref;
}

const ORDER = ["act", "watch", "normal", "pending", "none"];
export const worst = (list) => ORDER.find((s) => list.includes(s)) ?? "none";

const CABIN = ["co2", "pressure", "dose", "smoke", "ammonia", "temperature", "power"];

/**
 * Everything the screen shows for this second, and the alerts worst first.
 * bands: { hr, sys } from baseline(); typicalDose: median of the real replay.
 * Context rules from the team's engine: effort changes how heart rate and blood pressure are
 * judged; with a cabin emergency, mild heart-rate and pressure notices are noise and are dropped.
 */
export function readout(state, bands = {}, typicalDose = 0, history = {}) {
  const dose = doseRate(state);
  const mode = state.mode ?? modeOf(state.active), rec = recoveryTime(state.active);
  const hr = round(state.heartRate);
  const bp = [round(state.systolic), round(state.diastolic)];
  // judge vital signs on a short average so one noisy second does not raise an alert
  const avg = (list, now) => { const v = [...(list ?? []).slice(-(RULES.smoothSeconds - 1)), now]; return round(v.reduce((a, b) => a + b, 0) / v.length); };
  const hrJ = avg(history.heartRate, hr);
  const bpJ = [avg(history.bloodPressure, bp[0]), avg(history.diastolic, bp[1])];
  const co2 = round(state.co2, 1);
  const rest = mode === "rest";
  const ch = {
    heartRate: { value: hr, status: judgeHeart(mode, hrJ, bands.hr, rec), mine: rest ? versusBaseline(hrJ, bands.hr) : null },
    bloodPressure: { value: bp, status: judgePressureArterial(mode, bpJ, bands.sys), mine: rest ? versusBaseline(bpJ[0], bands.sys) : null },
    still: { value: Math.floor(state.still), status: judgeStill(state.still) },
    hydration: { value: round(state.hydration ?? 95), status: judgeHydration(state.hydration ?? 95) },
    co2: { value: co2, ppm: co2Ppm(co2), status: judgeCo2(co2) },
    temperature: { value: round(state.temperature, 1), status: judgeTemperature(state.temperature) },
    humidity: { value: round(state.humidity), status: judgeHumidity(state.humidity) },
    pressure: { value: round(state.pressure, 1), status: judgeCabinPressure(state.pressure, state.presHist), rate: round(pressureRate(state.presHist), 1) },
    smoke: { value: round(state.smoke ?? 5), status: judgeSmoke(state.smoke ?? 5) },
    ammonia: { value: round(state.ammonia ?? 0, 1), status: judgeAmmonia(state.ammonia ?? 0) },
    power: { value: round(state.power ?? 100), status: judgePower(state.power ?? 100) },
    dose: { value: dose.value, real: dose.real, time: dose.time, status: judgeDose(dose.value, typicalDose) }
  };
  let alerts = [];
  const hrId = { exercise: "hrExercise", eva: "hrEva", recovery: "hrRecovery" }[mode] ?? "heartRate";
  if (ch.co2.status !== "normal") alerts.push({ id: "co2", status: ch.co2.status });
  if (ch.dose.status !== "normal") alerts.push({ id: "dose", status: ch.dose.status });
  if (ch.heartRate.status === "act" || ch.heartRate.status === "watch") alerts.push({ id: hrId, status: ch.heartRate.status, vital: true });
  if (ch.bloodPressure.status === "act" || ch.bloodPressure.status === "watch") alerts.push({ id: "bloodPressure", status: ch.bloodPressure.status, vital: true });
  if (ch.still.status !== "normal") alerts.push({ id: "still", status: ch.still.status });
  for (const id of ["temperature", "humidity", "pressure", "smoke", "ammonia", "power", "hydration"]) if (ch[id].status !== "normal") alerts.push({ id, status: ch[id].status });
  const cabinAct = CABIN.some((k) => ch[k].status === "act");
  if (cabinAct) {
    alerts = alerts.filter((a) => !(a.vital && a.status === "watch"));
    if (mode === "exercise") alerts.push({ id: "stopExercise", status: "act" });
  }
  if (mode === "eva" && ch.dose.status !== "normal") alerts.push({ id: "endEva", status: "act" });
  alerts.sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  return { channels: ch, alerts, mode, overall: worst(Object.values(ch).map((c) => c.status)) };
}

/* ---------- steady alerts: raised after a few readings in a row, cleared after a few back to normal ---------- */

export const makeTracker = () => ({ active: {}, up: {}, down: {} });

/** Returns { tracker, active: [{ id, status }], events: [{ type: "raised" | "resolved", id, status }] }. */
export function track(tracker, alerts) {
  const t = { active: { ...tracker.active }, up: {}, down: { ...tracker.down } };
  const events = [], rank = { watch: 1, act: 2 }, seen = new Set();
  for (const a of alerts) {
    seen.add(a.id); t.down[a.id] = 0;
    const prev = tracker.up[a.id];
    const n = prev && prev.status === a.status ? prev.n + 1 : 1;
    t.up[a.id] = { status: a.status, n };
    const cur = t.active[a.id];
    if (n >= RULES.raiseAfter && (!cur || rank[a.status] > rank[cur])) { t.active[a.id] = a.status; events.push({ type: "raised", id: a.id, status: a.status }); }
    else if (cur && rank[a.status] < rank[cur] && n >= RULES.raiseAfter) t.active[a.id] = a.status;
  }
  for (const id of Object.keys(t.active)) {
    if (seen.has(id)) continue;
    t.down[id] = (t.down[id] ?? 0) + 1;
    if (t.down[id] >= RULES.clearAfter) { events.push({ type: "resolved", id, status: t.active[id] }); delete t.active[id]; delete t.down[id]; }
  }
  const active = Object.entries(t.active).map(([id, status]) => ({ id, status })).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  return { tracker: t, active, events };
}

/** Keeps the last HISTORY values of each sparkline. */
export function remember(history, r) {
  const next = { ...history };
  const push = (k, v) => { next[k] = [...(next[k] ?? []), v].slice(-HISTORY); };
  push("heartRate", r.channels.heartRate.value);
  push("bloodPressure", r.channels.bloodPressure.value[0]);
  push("diastolic", r.channels.bloodPressure.value[1]);
  push("still", r.channels.still.value);
  push("co2", r.channels.co2.value);
  push("temperature", r.channels.temperature.value);
  push("humidity", r.channels.humidity.value);
  push("pressure", r.channels.pressure.value);
  for (const k of ["smoke", "ammonia", "power", "hydration"]) push(k, r.channels[k].value);
  push("dose", r.channels.dose.value);
  return next;
}
