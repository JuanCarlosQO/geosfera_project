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
  smoothSeconds: 10                 // app rule: vital signs are judged on their 10-second average
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
  nominal: { label: "Nominal", note: "Everything at NASA's usual cabin values." },
  co2: { label: "CO₂ scrubber fault", note: "Simulated: CO₂ removal slows and cabin CO₂ climbs." },
  solar: { label: "Solar particle event", note: "Simulated: a burst of particles multiplies the dose rate." },
  still: { label: "Long time still", note: "Simulated: hours at a console without moving." }
};

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
    radIndex: 0,
    radiation,
    base: { hr: hr ?? 70, sys: sys ?? 116, dia: dia ?? 75 }
  };
}

/** Moves a value a little toward its target, with some noise. */
const drift = (value, target, pull, noise, rand) => value + (target - value) * pull + (rand() - 0.5) * 2 * noise;

/** One second later. Pure: same state, scenario and random source give the same result. */
export function step(state, rand) {
  const s = { ...state, t: state.t + 1, since: state.since + 1 };
  const k = s.scenario;
  const ramp = Math.min(1, s.since / 45); // scenarios build up over about 45 seconds

  const co2Target = k === "co2" ? 2.2 + ramp * 4.4 : 2.2;
  const hrTarget = s.base.hr + (k === "co2" ? ramp * 9 : 0) + (k === "solar" ? ramp * 4 : 0) + (k === "still" ? -ramp * 4 : 0);
  s.co2 = clamp(drift(s.co2, co2Target, 0.12, 0.05, rand), 0.4, 12);
  s.heartRate = clamp(drift(s.heartRate, hrTarget, 0.15, 1.2, rand), 35, 190);
  s.systolic = clamp(drift(s.systolic, s.base.sys + (k === "co2" ? ramp * 6 : 0), 0.12, 1.1, rand), 80, 200);
  s.diastolic = clamp(drift(s.diastolic, s.base.dia + (k === "co2" ? ramp * 4 : 0), 0.12, 0.8, rand), 45, 130);
  s.temperature = clamp(drift(s.temperature, 22.4, 0.08, 0.05, rand), 10, 35);
  s.humidity = clamp(drift(s.humidity, 46, 0.08, 0.4, rand), 5, 95);
  s.pressure = clamp(drift(s.pressure, LIMITS.pressureIss, 0.2, 0.05, rand), 30, 110);
  // one simulated second stands for one minute at the console
  s.still = k === "still" ? s.still + 1 : Math.max(0, s.still + (rand() < 0.08 ? -s.still : 0.25));
  s.radIndex = (s.radIndex + 1) % (s.radiation?.values.length || 1);
  return s;
}

export function changeScenario(state, scenario) {
  if (!SCENARIOS[scenario]) return state;
  return { ...state, scenario, since: 0, ...(scenario === "still" ? { still: Math.max(state.still, 30) } : {}) };
}

/** The real dose rate at this point of the replay; the solar scenario multiplies it (simulated). */
export function doseRate(state) {
  const values = state.radiation?.values ?? [];
  if (!values.length) return { value: null, real: false };
  const real = values[state.radIndex];
  if (state.scenario !== "solar") return { value: real, real: true, time: state.radiation.times[state.radIndex] };
  const factor = 1 + Math.min(1, state.since / 20) * 39; // up to 40× in 20 s
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
export const co2Ppm = (mmHg) => Math.round(mmHg * LIMITS.co2PpmPerMmHg);

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

/**
 * Everything the screen shows for this second, and the alerts worst first.
 * bands: { hr, sys } from baseline(); typicalDose: median of the real replay.
 */
export function readout(state, bands = {}, typicalDose = 0, history = {}) {
  const dose = doseRate(state);
  const hr = round(state.heartRate);
  const bp = [round(state.systolic), round(state.diastolic)];
  // judge vital signs on a short average so one noisy second does not raise an alert
  const avg = (list, now) => { const v = [...(list ?? []).slice(-(RULES.smoothSeconds - 1)), now]; return round(v.reduce((a, b) => a + b, 0) / v.length); };
  const hrJ = avg(history.heartRate, hr);
  const bpJ = [avg(history.bloodPressure, bp[0]), avg(history.diastolic, bp[1])];
  const co2 = round(state.co2, 1);
  const ch = {
    heartRate: { value: hr, status: judgeVital("heartRate", hrJ, bands.hr), mine: versusBaseline(hrJ, bands.hr) },
    bloodPressure: { value: bp, status: judgeVital("bloodPressure", bpJ, bands.sys), mine: versusBaseline(bpJ[0], bands.sys) },
    still: { value: Math.floor(state.still), status: judgeStill(state.still) },
    co2: { value: co2, ppm: co2Ppm(co2), status: judgeCo2(co2) },
    temperature: { value: round(state.temperature, 1), status: judgeTemperature(state.temperature) },
    humidity: { value: round(state.humidity), status: judgeHumidity(state.humidity) },
    pressure: { value: round(state.pressure, 1), status: judgePressure(state.pressure) },
    dose: { value: dose.value, real: dose.real, time: dose.time, status: judgeDose(dose.value, typicalDose) }
  };
  const alerts = [];
  if (ch.co2.status !== "normal") alerts.push({ id: "co2", status: ch.co2.status });
  if (ch.dose.status !== "normal") alerts.push({ id: "dose", status: ch.dose.status });
  if (ch.heartRate.status === "act" || ch.heartRate.status === "watch") alerts.push({ id: "heartRate", status: ch.heartRate.status });
  if (ch.bloodPressure.status === "act" || ch.bloodPressure.status === "watch") alerts.push({ id: "bloodPressure", status: ch.bloodPressure.status });
  if (ch.still.status !== "normal") alerts.push({ id: "still", status: ch.still.status });
  for (const id of ["temperature", "humidity", "pressure"]) if (ch[id].status !== "normal") alerts.push({ id, status: ch[id].status });
  alerts.sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  return { channels: ch, alerts, overall: worst(Object.values(ch).map((c) => c.status)) };
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
  push("dose", r.channels.dose.value);
  return next;
}
