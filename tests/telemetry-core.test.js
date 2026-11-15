import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as T from "../js/telemetry-core.js";
import { LIMIT_FACTS, RESPONSES } from "../js/data/telemetry.js";
import { RADLAB_ISS } from "../js/data/radlab-iss.js";

const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
const run = (scenario, seconds, seed = 7) => {
  const rand = T.rng(seed);
  let s = T.changeScenario(T.startState({}, RADLAB_ISS), scenario);
  for (let i = 0; i < seconds; i += 1) s = T.step(s, rand);
  return s;
};

describe("live telemetry: the stream", () => {
  it("is repeatable with the same seed and moves every second", () => {
    assert.deepEqual(run("nominal", 30, 3), run("nominal", 30, 3));
    assert.notEqual(run("nominal", 30, 3).heartRate, run("nominal", 31, 3).heartRate);
  });
  it("stays nominal on its own for ten minutes", () => {
    const rand = T.rng(11);
    let s = T.startState({}, RADLAB_ISS);
    for (let i = 0; i < 600; i += 1) {
      s = T.step(s, rand);
      const r = T.readout(s, {}, T.median(RADLAB_ISS.values));
      assert.equal(r.channels.co2.status, "normal", `co2 at ${i}`);
      assert.equal(r.channels.temperature.status, "normal", `temperature at ${i}`);
      assert.equal(r.channels.pressure.status, "normal", `pressure at ${i}`);
    }
  });
  it("raises CO2 above NASA's limits in the scrubber fault", () => {
    const r = T.readout(run("co2", 90), {}, 20);
    assert.equal(r.channels.co2.status, "act");
    assert.equal(r.alerts[0].id, "co2");
    assert.equal(r.overall, "act");
  });
  it("replays the real NASA dose rate and multiplies it only in the solar scenario", () => {
    const s = run("nominal", 5);
    assert.deepEqual(T.doseRate(s), { value: RADLAB_ISS.values[5], real: true, time: RADLAB_ISS.times[5] });
    const sol = run("solar", 30);
    const d = T.doseRate(sol);
    assert.equal(d.real, false);
    assert.ok(d.value > RADLAB_ISS.values[sol.radIndex] * 30);
    assert.equal(T.readout(sol, {}, T.median(RADLAB_ISS.values)).channels.dose.status, "watch");
  });
  it("counts time still and asks to move (app rule)", () => {
    const s = run("still", 100);
    assert.ok(s.still >= T.RULES.stillAct);
    assert.equal(T.readout(s).channels.still.status, "act");
  });
  it("judges vital signs on their 10-second average, not one noisy second", () => {
    const s = { ...T.startState({ hr: 70 }, RADLAB_ISS), heartRate: 104 };
    assert.equal(T.readout(s, {}, 0, { heartRate: Array(9).fill(70) }).channels.heartRate.status, "normal");
    assert.equal(T.readout(s, {}, 0, { heartRate: Array(9).fill(104) }).channels.heartRate.status, "watch");
  });
  it("keeps 60 seconds of history per channel", () => {
    let h = {};
    let s = T.startState({}, RADLAB_ISS);
    const rand = T.rng(1);
    for (let i = 0; i < 75; i += 1) { s = T.step(s, rand); h = T.remember(h, T.readout(s)); }
    assert.equal(h.co2.length, T.HISTORY);
    assert.equal(h.dose.length, T.HISTORY);
  });
});

describe("live telemetry: limits", () => {
  it("judges CO2 with NASA's 3 and 4.5 mmHg marks", () => {
    assert.deepEqual([2.9, 3, 3.1, 4.5, 4.6].map(T.judgeCo2), ["normal", "normal", "watch", "watch", "act"]);
    assert.equal(T.co2Ppm(3.8), 5000);
  });
  it("judges the cabin against NASA's health limits and comfort zone", () => {
    assert.deepEqual([17.9, 19, 22, 26, 27.1].map(T.judgeTemperature), ["act", "watch", "normal", "watch", "act"]);
    assert.deepEqual([24, 28, 50, 70, 76].map(T.judgeHumidity), ["act", "watch", "normal", "watch", "act"]);
    assert.deepEqual([34.5, 34.6, 101.3, 103, 103.1].map(T.judgePressure), ["act", "normal", "normal", "normal", "act"]);
  });
  it("uses the team's vital ranges and the crew member's own band", () => {
    const band = { low: 58, high: 70 };
    assert.equal(T.judgeVital("heartRate", 64, band), "normal");
    assert.equal(T.judgeVital("heartRate", 78, band), "watch", "inside 60-100 but above this person's usual");
    assert.equal(T.judgeVital("heartRate", 105, null), "watch");
    assert.equal(T.judgeVital("bloodPressure", [150, 95], null), "act");
  });
});

describe("live telemetry: personal baseline", () => {
  const day = (i) => `2026-11-${String(15 - i).padStart(2, "0")}`;
  const log = Object.fromEntries([62, 64, 61, 66, 63, 65].map((v, i) => [day(i), { heartRate: { value: v }, bloodPressure: { value: [118 + i, 76] } }]));
  it("needs five readings", () => {
    assert.equal(T.baseline({ [day(0)]: { heartRate: { value: 60 } } }, "heartRate", day(0)), null);
  });
  it("gives mean, spread and band from the last 14 days", () => {
    const b = T.baseline(log, "heartRate", day(0));
    assert.equal(b.n, 6);
    assert.equal(b.mean, 63.5);
    assert.ok(b.low < 60 && b.high > 67);
    assert.equal(T.versusBaseline(80, b), "above");
    assert.equal(T.versusBaseline(63, b), "inside");
    assert.equal(T.baseline(log, "bloodPressure", day(0)).mean, 120.5);
  });
  it("leaves out readings marked Measure again", () => {
    const flagged = { ...log, [day(0)]: { heartRate: { value: 140, flag: "again" } } };
    assert.equal(T.baseline(flagged, "heartRate", day(0)).n, 5);
  });
});

describe("live telemetry: sources", () => {
  it("shows only NASA words quoted in docs/SOURCES.md", () => {
    for (const [k, f] of Object.entries(LIMIT_FACTS)) {
      assert.ok(sources.includes(f.quote), `not in SOURCES.md: ${k}`);
      assert.ok(sources.includes(f.url), `link not in SOURCES.md: ${k}`);
    }
    assert.ok(sources.includes(RADLAB_ISS.url));
  });
  it("has a response for every alert and only known facts", () => {
    for (const id of ["co2", "dose", "heartRate", "bloodPressure", "still", "temperature", "humidity", "pressure"]) {
      assert.ok(RESPONSES[id]?.steps.length, id);
      for (const f of RESPONSES[id].facts) assert.ok(LIMIT_FACTS[f], `${id}: ${f}`);
    }
  });
  it("stores the real RadLab replay in µGy/h", () => {
    assert.equal(RADLAB_ISS.unit, "µGy/h");
    assert.equal(RADLAB_ISS.values.length, RADLAB_ISS.times.length);
    assert.ok(RADLAB_ISS.values.length > 400 && RADLAB_ISS.values.every((v) => v > 0));
  });
});

describe("exact alert conditions", () => {
  it("writes each condition from the numbers the judges use", () => {
    const c = {}; for (const x of T.conditions(5)) c[x.key] ??= x;
    assert.match(c.co2.watch, /^above 3 mmHg \(3947 ppm\)$/);
    assert.match(c.co2.act, /^above 4\.5 mmHg/);
    assert.equal(T.judgeCo2(3), "normal"); assert.equal(T.judgeCo2(3.1), "watch"); assert.equal(T.judgeCo2(4.6), "act");
    assert.equal(c.pressure.act, "34.5 kPa or less, or above 103 kPa");
    assert.equal(T.judgePressure(34.5), "act"); assert.equal(T.judgePressure(103), "normal");
    assert.match(c.dose.watch, /^10 times the replay's median or more \(50 µGy\/h\)$/);
    assert.match(c.still.watch, /^60 minutes/);
    for (const x of T.conditions()) for (const f of x.facts) assert.ok(LIMIT_FACTS[f], `${x.key}: ${f}`);
  });
});

describe("the team's engine: several scenarios, effort and steady alerts", () => {
  const start = () => T.startState({}, RADLAB_ISS);
  const play = (s, n, seed = 3, h = {}) => { const rand = T.rng(seed); let hist = h, r; for (let i = 0; i < n; i += 1) { s = T.step(s, rand); r = T.readout(s, {}, T.median(RADLAB_ISS.values), hist); hist = T.remember(hist, r); } return { s, r, hist }; };
  const ids = (r) => r.alerts.map((a) => a.id);

  it("runs several scenarios at once and adds their effects", () => {
    let s = T.startScenario(T.startScenario(start(), "fire"), "nh3");
    assert.deepEqual(Object.keys(s.active), ["fire", "nh3"]);
    const { r } = play(s, 70);
    assert.equal(r.channels.smoke.status, "act");
    assert.equal(r.channels.ammonia.status, "act");
    assert.equal(T.startScenario(s, "fire"), s, "starting it twice changes nothing");
  });
  it("every new scenario ends in its own alert", () => {
    for (const [id, alert] of [["depress", "pressure"], ["thermal", "temperature"], ["fire", "smoke"], ["nh3", "ammonia"], ["power", "power"], ["hydration", "hydration"], ["tachy", "heartRate"]]) {
      const { r } = play(T.startScenario(start(), id), 130);
      assert.ok(ids(r).includes(alert), `${id} → ${ids(r)}`);
    }
  });
  it("judges a workout as effort: a heart rate of 140 raises nothing", () => {
    const { s, r } = play(T.startScenario(start(), "exercise"), 60);
    assert.equal(r.mode, "exercise");
    assert.ok(s.heartRate > 130 && s.heartRate < 0.85 * T.maxHeartRate() + 6, String(s.heartRate));
    assert.deepEqual(ids(r).filter((x) => x.startsWith("hr") || x === "heartRate"), []);
    assert.equal(T.judgeHeart("exercise", 160, null), "watch");
    assert.equal(T.judgeHeart("exercise", 175, null), "act");
    assert.equal(T.judgeHeart("eva", 130, null), "watch");
    assert.equal(T.judgeHeart("rest", 135, null), "act");
  });
  it("recovers little by little after stopping, then goes back to rest", () => {
    let { s, hist } = play(T.startScenario(start(), "exercise"), 60);
    s = T.stopScenario(s, "exercise");
    assert.equal(T.modeOf(s.active), "recovery");
    const mid = play(s, 20, 5, hist);
    assert.ok(mid.s.heartRate < 135 && mid.s.heartRate > 80, String(mid.s.heartRate));
    const end = play(mid.s, 50, 6, mid.hist);
    assert.equal(end.r.mode, "rest");
    assert.deepEqual(end.s.active, {});
    assert.equal(T.judgeHeart("recovery", 120, null, 50), "watch");
    assert.equal(T.judgeHeart("recovery", 120, null, 20), "normal");
  });
  it("in a cabin emergency drops mild heart notices and tells whoever is exercising to stop", () => {
    const { r } = play(T.startScenario(T.startScenario(start(), "exercise"), "fire"), 60);
    assert.ok(ids(r).includes("smoke") && ids(r).includes("stopExercise"), String(ids(r)));
    assert.ok(!r.alerts.some((a) => a.vital && a.status === "watch"));
    const sw = play(T.startScenario(T.startScenario(start(), "eva"), "solar"), 40);
    assert.ok(ids(sw.r).includes("endEva"));
  });
  it("sees a leak by how fast the pressure falls, not by noise", () => {
    assert.equal(T.pressureRate(Array(12).fill(101.3)), 0);
    assert.ok(T.pressureRate(Array.from({ length: 12 }, (_, i) => 101.3 - i * 0.15)) < -2);
    assert.equal(T.judgeCabinPressure(100, Array.from({ length: 12 }, (_, i) => 101.6 - i * 0.15)), "watch");
    assert.equal(T.judgeCabinPressure(96, Array.from({ length: 12 }, (_, i) => 97.6 - i * 0.15)), "act");
    assert.equal(T.judgeCabinPressure(91, []), "act");
    const quiet = play(start(), 120);
    assert.equal(quiet.r.channels.pressure.status, "normal");
  });
  it("raises an alert after 3 readings in a row and clears it after 5 back to normal", () => {
    let t = T.makeTracker(), out;
    const a = [{ id: "co2", status: "watch" }];
    out = T.track(t, a); t = out.tracker; assert.deepEqual(out.events, []);
    out = T.track(t, a); t = out.tracker; assert.deepEqual(out.active, []);
    out = T.track(t, a); t = out.tracker;
    assert.deepEqual(out.events, [{ type: "raised", id: "co2", status: "watch" }]);
    for (let i = 0; i < 3; i += 1) { out = T.track(t, [{ id: "co2", status: "act" }]); t = out.tracker; }
    assert.deepEqual(out.events, [{ type: "raised", id: "co2", status: "act" }], "escalates once");
    for (let i = 0; i < 4; i += 1) { out = T.track(t, []); t = out.tracker; assert.equal(out.active.length, 1); }
    out = T.track(t, []);
    assert.deepEqual(out.events, [{ type: "resolved", id: "co2", status: "act" }]);
    assert.deepEqual(out.active, []);
  });
  it("a single odd reading raises nothing", () => {
    let t = T.makeTracker(), out;
    for (const list of [[{ id: "smoke", status: "watch" }], [], [{ id: "smoke", status: "watch" }], [{ id: "smoke", status: "watch" }], []]) { out = T.track(t, list); t = out.tracker; assert.deepEqual(out.events, []); }
  });
  it("a workout alone does not push cabin CO₂ over NASA's limit", () => {
    const { r } = play(T.startScenario(start(), "exercise"), 100);
    assert.equal(r.channels.co2.status, "normal", String(r.channels.co2.value));
    assert.deepEqual(ids(r), []);
  });
  it("reset stops everything but lets an effort recover", () => {
    const { s } = play(T.startScenario(T.startScenario(start(), "exercise"), "fire"), 30);
    const r = T.resetAll(s);
    assert.deepEqual(Object.keys(r.active), ["exercise"]);
    assert.equal(T.modeOf(r.active), "recovery");
    assert.deepEqual(T.resetAll(r).active, r.active);
  });
  it("has words for every alert it can raise", () => {
    for (const id of ["co2", "dose", "heartRate", "hrExercise", "hrEva", "hrRecovery", "bloodPressure", "still", "temperature", "humidity", "pressure", "smoke", "ammonia", "power", "hydration", "stopExercise", "endEva"]) {
      assert.ok(RESPONSES[id]?.title && RESPONSES[id].steps.length, id);
      for (const f of RESPONSES[id].facts) assert.ok(LIMIT_FACTS[f], `${id}: ${f}`);
    }
  });
});

describe("wearable sensors: measurement before health", () => {
  const start = () => T.startState({}, RADLAB_ISS);
  const play = (s, n, seed = 5) => { const rand = T.rng(seed); let h = {}; let r; for (let i = 0; i < n; i++) { s = T.step(s, rand); r = T.readout(s, {}, 5, h); h = T.remember(h, r); } return { s, r, h }; };
  const ids = (r) => r.alerts.map((a) => a.id);

  it("starts with three linked sensors, each feeding one channel", () => {
    const { r } = play(start(), 3);
    assert.deepEqual(Object.keys(r.sensors), ["chest", "cuff", "wrist"]);
    for (const sn of Object.values(r.sensors)) { assert.equal(sn.link, "ok"); assert.ok(r.channels[sn.feeds].value != null); }
    assert.deepEqual(ids(r).filter((x) => x.startsWith("sensor")), []);
  });
  it("shows no heart rate when the chest sensor is loose, and raises the sensor, not the heart", () => {
    const { r, h } = play(T.startScenario(T.startScenario(start(), "tachy"), "leadoff"), 40);
    assert.equal(r.sensors.chest.link, "off");
    assert.equal(r.channels.heartRate.value, null);
    assert.equal(r.channels.heartRate.status, "again");
    assert.ok(ids(r).includes("sensorChest"));
    assert.ok(!ids(r).includes("heartRate"), "a racing heart nobody can measure raises no heart alert");
    assert.equal(h.heartRate, undefined, "nothing is added to the trend while the sensor is silent");
    assert.ok(r.channels.bloodPressure.value != null, "the cuff keeps working");
  });
  it("warns of a low battery before the cuff stops, then shows no blood pressure", () => {
    let s = T.startScenario(start(), "battery");
    const low = play(s, 30);
    assert.ok(low.r.sensors.cuff.battery <= T.RULES.batteryLow && low.r.sensors.cuff.battery > 0);
    assert.ok(ids(low.r).includes("sensorBattery"));
    assert.ok(low.r.channels.bloodPressure.value != null, "still measuring while the battery is only low");
    const dead = play(low.s, 20);
    assert.equal(dead.r.sensors.cuff.link, "off");
    assert.equal(dead.r.channels.bloodPressure.value, null);
    assert.ok(ids(dead.r).includes("sensorCuff") && !ids(dead.r).includes("sensorBattery"));
    s = T.stopScenario(dead.s, "battery");
    assert.equal(T.sensorState(s).cuff.link, "ok", "a charged battery goes back in");
  });
  it("judges nothing from the body while the wireless link is lost, and escalates with time", () => {
    const first = play(T.startScenario(T.startScenario(start(), "tachy"), "linkdrop"), 10);
    for (const k of ["heartRate", "bloodPressure", "still"]) { assert.equal(first.r.channels[k].value, null); assert.equal(first.r.channels[k].status, "again"); }
    assert.deepEqual(first.r.alerts.filter((a) => a.id === "sensorLink").map((a) => a.status), ["watch"]);
    assert.ok(!ids(first.r).some((x) => ["heartRate", "bloodPressure", "still"].includes(x)));
    assert.ok(first.r.channels.co2.value != null, "the cabin sensors are wired and keep reporting");
    const later = play(first.s, T.RULES.linkAct);
    assert.deepEqual(later.r.alerts.filter((a) => a.id === "sensorLink").map((a) => a.status), ["act"]);
    const back = play(T.stopScenario(later.s, "linkdrop"), 2);
    assert.equal(back.r.silent, 0);
    assert.ok(back.r.channels.heartRate.value > 0);
  });
  it("has words and a condition for every sensor alert, and a place on the figure for every sensor", () => {
    for (const id of ["sensorChest", "sensorCuff", "sensorBattery", "sensorLink"]) { assert.ok(RESPONSES[id]?.title && RESPONSES[id].steps.length, id); assert.equal(RESPONSES[id].illustrative, true); }
    assert.ok(T.conditions(5).some((c) => c.name === "A wearable sensor" && c.basis === "app"));
    for (const sn of Object.values(T.SENSORS)) { assert.ok(sn.at[0] >= 0 && sn.at[0] <= 200 && sn.at[1] >= 0 && sn.at[1] <= 450); assert.ok(["heartRate", "bloodPressure", "still"].includes(sn.feeds)); }
    for (const id of ["leadoff", "battery", "linkdrop"]) assert.equal(T.SCENARIOS[id].group, "sensor");
  });
});
