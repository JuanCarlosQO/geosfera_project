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
    const c = Object.fromEntries(T.conditions(5).map((x) => [x.key, x]));
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
