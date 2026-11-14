import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WINDOWS, windowStatus, summarise, headline, missionDay, cupolaGeometry } from "../js/today-core.js";
import { SYSTEMS } from "../js/data/body-systems.js";

describe("Cupola windows", () => {
  it("has six windows, each linked to a body system of the hologram", () => {
    assert.equal(WINDOWS.length, 6);
    const ids = new Set(SYSTEMS.map((s) => s.id));
    for (const w of WINDOWS) assert.ok(ids.has(w.body), w.id);
  });

  it("shows No data without readings and Pending check while ranges are unapproved", () => {
    const heart = WINDOWS.find((w) => w.id === "heart");
    assert.equal(windowStatus(heart, {}), "none");
    assert.equal(windowStatus(heart, { heartRate: { value: 64 } }), "pending");
  });

  it("shows the most urgent status among a window's readings", () => {
    const heart = WINDOWS.find((w) => w.id === "heart");
    const judge = (k) => (k === "bloodPressure" ? "watch" : "normal");
    assert.equal(windowStatus(heart, { heartRate: { value: 64 }, bloodPressure: { value: "122/77" } }, judge), "watch");
    assert.equal(windowStatus(heart, { heartRate: { value: 64 } }, () => "again"), "again");
  });
});

describe("headline", () => {
  it("is honest when nothing is measured", () => {
    assert.match(headline(summarise({})).title, /No readings yet/);
  });
  it("names the window to watch", () => {
    const judge = (k) => (k === "bloodPressure" ? "watch" : "normal");
    const all = { heartRate: { value: 1 }, bloodPressure: { value: 1 }, bloodOxygen: { value: 1 }, glucose: { value: 1 }, radiationDose: { value: 1 }, temperature: { value: 1 }, sleepHours: { value: 1 } };
    const h = headline(summarise(all, judge));
    assert.match(h.title, /Mostly good/);
    assert.match(h.line, /Heart is in the watch range/);
  });
  it("puts Measure again before Watch", () => {
    const judge = (k) => (k === "temperature" ? "again" : "watch");
    assert.match(headline(summarise({ temperature: { value: 1 }, glucose: { value: 1 } }, judge)).title, /Measure again/);
  });
  it("says when everything measured is in range", () => {
    assert.match(headline(summarise({ heartRate: { value: 64 } }, () => "normal")).line, /normal range/);
  });
});

describe("mission day and geometry", () => {
  it("counts the first day as day 1", () => {
    assert.equal(missionDay("2026-11-14", new Date(2026, 10, 14, 23, 0)), 1);
    assert.equal(missionDay("2026-11-14", new Date(2026, 10, 15, 8, 0)), 2);
  });
  it("draws six four-sided windows", () => {
    const g = cupolaGeometry();
    assert.equal(g.length, 6);
    for (const w of g) assert.equal(w.points.length, 4);
  });
});

import { actionsFor, radiationTotals, series, sparkPath, reasonFor, EXERCISE_GOAL_MIN } from "../js/today-core.js";
import { HAZARDS } from "../js/data/hazards.js";
import { readFileSync } from "node:fs";

describe("full dashboard", () => {
  it("lists measure-again steps, missing core readings and exercise left", () => {
    const a = actionsFor({ heartRate: { value: 131, flag: "again" }, exerciseMinutes: { value: 60 } });
    assert.match(a[0].title, /Measure again: resting heart rate/);
    assert.ok(a.some((x) => x.title === "Not measured yet" && /blood pressure/.test(x.text)));
    assert.ok(a.some((x) => /30 min left/.test(x.text)));
  });
  it("has nothing to do when the core is measured and exercise is done", () => {
    const full = { heartRate: { value: 60 }, bloodPressure: { value: [118, 76] }, temperature: { value: 36.6 }, bloodOxygen: { value: 98 }, sleepHours: { value: 7 }, exerciseMinutes: { value: EXERCISE_GOAL_MIN } };
    assert.deepEqual(actionsFor(full), []);
  });
  it("adds up dosimeter readings to a day, not after it", () => {
    const log = { "2026-11-12": { radiationDose: { value: 0.5 } }, "2026-11-13": { radiationDose: { value: 0.52 } }, "2026-11-15": { radiationDose: { value: 9 } } };
    assert.deepEqual(radiationTotals(log, "2026-11-14"), { today: null, total: 1.02, days: 2 });
  });
  it("builds series with gaps and a sparkline that skips them", () => {
    const s = series({ "2026-11-13": { heartRate: { value: 60 } }, "2026-11-14": { heartRate: { value: 64 } }, "2026-11-11": { bloodPressure: { value: [120, 80] } } }, "heartRate", "2026-11-14", 4);
    assert.deepEqual(s, [null, null, 60, 64]);
    assert.match(sparkPath(s), /^M\S+ \S+ L/);
    assert.equal(sparkPath([null, null]), "");
  });
  it("explains every status honestly", () => {
    assert.match(reasonFor("heartRate", { value: 64 }), /60–100 bpm · MedlinePlus/);
    assert.match(reasonFor("glucose", undefined), /Not measured/);
    assert.match(reasonFor("heartRate", { value: 131, flag: "again" }), /app rule/);
    assert.match(reasonFor("heartRate", undefined), /Not measured/);
  });
  it("shows the five NASA hazards word for word from docs/SOURCES.md", () => {
    const src = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
    assert.equal(HAZARDS.length, 5);
    for (const h of HAZARDS) assert.ok(src.includes(h.text), h.name);
  });
});
