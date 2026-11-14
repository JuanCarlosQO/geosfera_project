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
  it("does not judge readings without an approved range", () => {
    assert.match(headline(summarise({ heartRate: { value: 64 } })).line, /pending an approved official source/);
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
