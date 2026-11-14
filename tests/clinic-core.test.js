import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as C from "../js/clinic-core.js";
import { FIELDS } from "../js/log-core.js";

describe("day dashboard: charts", () => {
  it("needs two readings to draw", () => {
    assert.equal(C.areaChart([null, 64, null]), null);
    assert.equal(C.areaChart([]), null);
  });
  it("puts the highest value at the top and closes the area on the baseline", () => {
    const c = C.areaChart([60, 80, 70], 300, 100, 10);
    assert.equal(c.line, "M0 62 L150 10 L300 36");
    assert.ok(c.area.endsWith("L300 100 L0 100 Z"));
    assert.deepEqual([c.min, c.max, c.points, c.gaps], [60, 80, 3, false]);
    assert.deepEqual(c.last, [300, 36]);
  });
  it("bridges days without a reading and says so", () => {
    const c = C.areaChart([60, null, null, 70], 300, 100, 10);
    assert.equal(c.line, "M0 62 L300 10");
    assert.equal(c.gaps, true);
  });
  it("draws a flat line when every value is the same", () => {
    assert.equal(C.areaChart([70, 70], 100, 100, 10).line, "M0 62 L100 62");
  });
});

describe("day dashboard: the gauge counts the check-in, not health", () => {
  it("counts the fields logged today", () => {
    assert.deepEqual(C.completion({}), { filled: 0, total: FIELDS.length, fraction: 0, percent: 0 });
    const c = C.completion({ heartRate: { value: 60 }, mood: { value: 4 }, sleepHours: { value: 7 } });
    assert.equal(c.filled, 3);
    assert.equal(c.percent, 33);
  });
  it("draws nothing at zero and the whole half-circle at one", () => {
    assert.equal(C.gaugeArc(0).fill, "");
    const g = C.gaugeArc(1, 100, 100, 50);
    assert.equal(g.track, "M50 100 A50 50 0 0 1 150 100");
    assert.equal(g.fill, g.track);
    assert.equal(C.gaugeArc(0.5, 100, 100, 50).fill, "M50 100 A50 50 0 0 1 100 50");
    assert.equal(C.gaugeArc(7, 100, 100, 50).fill, g.track);
  });
});

describe("day dashboard: readings list", () => {
  it("lists every field without its own chart, with the app's status", () => {
    const rows = C.readingList({ temperature: { value: 36.7 }, mood: { value: 4 }, glucose: { value: 92, flag: "again" } }, (k, r) => (r.flag === "again" ? "again" : "pending"));
    assert.equal(rows.length, FIELDS.length - 2);
    assert.ok(!rows.some((r) => r.key === "heartRate" || r.key === "bloodPressure"));
    assert.deepEqual(rows.find((r) => r.key === "temperature"), { key: "temperature", label: "Body temperature", value: "36.7", unit: "°C", status: "pending" });
    assert.deepEqual(rows.find((r) => r.key === "mood"), { key: "mood", label: "Mood", value: "4 · Good", unit: "of 5", status: "pending" });
    assert.equal(rows.find((r) => r.key === "glucose").status, "again");
    assert.deepEqual(rows.find((r) => r.key === "sleepHours"), { key: "sleepHours", label: "Sleep last night", value: "—", unit: "", status: "none" });
  });
});
