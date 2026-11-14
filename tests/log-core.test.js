import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as L from "../js/log-core.js";
import { WINDOWS } from "../js/today-core.js";

const F = (k) => L.fieldByKey(k);

describe("checking typed values", () => {
  it("accepts empty steps", () => {
    assert.equal(L.checkValue(F("heartRate"), "").state, "empty");
    assert.equal(L.checkValue(F("bloodPressure"), ["", ""]).state, "empty");
  });
  it("turns impossible values into a request to measure again", () => {
    for (const v of ["0", "999", "-5"]) assert.equal(L.checkValue(F("heartRate"), v).state, "impossible", v);
    assert.equal(L.checkValue(F("bloodOxygen"), "104").state, "impossible");
    assert.equal(L.checkValue(F("temperature"), "3.7").state, "impossible");
  });
  it("checks blood pressure as a pair", () => {
    assert.deepEqual(L.checkValue(F("bloodPressure"), ["118", "76"]), { state: "ok", value: [118, 76] });
    assert.equal(L.checkValue(F("bloodPressure"), ["76", "118"]).state, "impossible");
    assert.equal(L.checkValue(F("bloodPressure"), ["118", ""]).state, "impossible");
  });
  it("accepts a comma as decimal mark and rounds to the field's step", () => {
    assert.deepEqual(L.checkValue(F("temperature"), "36,74"), { state: "ok", value: 36.7 });
  });
  it("keeps mood on the five-point scale", () => {
    assert.equal(L.checkValue(F("mood"), "4").state, "ok");
    assert.equal(L.checkValue(F("mood"), "6").state, "impossible");
  });
});

describe("building a day", () => {
  const log = { "2026-11-13": { heartRate: { value: 60 }, temperature: { value: 36.6 } } };
  it("keeps valid values, reports impossible ones, flags sudden jumps", () => {
    const { entry, problems } = L.buildEntry({ heartRate: "130", temperature: "36.7", bloodOxygen: "140" }, log, "2026-11-14");
    assert.equal(entry.heartRate.flag, "again");
    assert.equal(entry.temperature.flag, undefined);
    assert.ok(problems.bloodOxygen);
    assert.equal(entry.bloodOxygen, undefined);
  });
  it("only compares with earlier days", () => {
    assert.equal(L.previousValue(log, "heartRate", "2026-11-13"), null);
    assert.equal(L.previousValue(log, "heartRate", "2026-11-20"), 60);
  });
  it("saves, replaces and removes a day", () => {
    let l = L.saveDay({}, "2026-11-14", { heartRate: { value: 64 } });
    assert.equal(l["2026-11-14"].heartRate.value, 64);
    l = L.saveDay(l, "2026-11-14", {});
    assert.equal(l["2026-11-14"], undefined);
  });
  it("feeds the dashboard: jumps become Measure again, the rest use the reference ranges", () => {
    assert.equal(L.judgeReading("heartRate", { value: 130, flag: "again" }), "again");
    assert.equal(L.judgeReading("heartRate", { value: 64 }), "normal");
    assert.equal(L.judgeReading("heartRate", { value: 104 }), "watch");
    assert.equal(L.judgeReading("glucose", { value: 130 }), "act");
    assert.equal(L.judgeReading("radiationDose", { value: 0.5 }), "logged");
    assert.equal(L.judgeReading("exerciseMinutes", { value: 90 }), "logged");
    assert.equal(L.judgeReading("mood", { value: 4 }), "logged");
  });
  it("logs every reading the Cupola windows read", () => {
    const keys = new Set(L.FIELDS.map((f) => f.key));
    for (const w of WINDOWS) for (const k of w.readings) assert.ok(keys.has(k), k);
  });
});

describe("backup and export", () => {
  const log = { "2026-11-14": { heartRate: { value: 64 }, bloodPressure: { value: [118, 76] }, mood: { value: 4 }, savedAt: "x" } };
  it("writes a CSV with one row per day", () => {
    const csv = L.toCsv(log).trim().split("\n");
    assert.equal(csv.length, 2);
    assert.match(csv[1], /^2026-11-14,64,118,76,/);
  });
  it("round-trips a backup", () => {
    const back = L.fromBackup(L.toBackup(log));
    assert.equal(back.ok, true);
    assert.deepEqual(back.log["2026-11-14"].bloodPressure.value, [118, 76]);
  });
  it("rejects other files and drops impossible values on import", () => {
    assert.equal(L.fromBackup("{}").ok, false);
    assert.equal(L.fromBackup("not json").ok, false);
    const bad = JSON.stringify({ app: "geosfera", kind: "daily-log", log: { "2026-11-14": { heartRate: { value: 999 }, mood: { value: 3 } } } });
    const r = L.fromBackup(bad);
    assert.equal(r.dropped, 1);
    assert.equal(r.log["2026-11-14"].heartRate, undefined);
  });
  it("never overwrites a day already on the device when merging", () => {
    const { log: merged, added } = L.mergeLogs(log, { "2026-11-14": { heartRate: { value: 99 } }, "2026-11-15": { heartRate: { value: 70 } } });
    assert.equal(merged["2026-11-14"].heartRate.value, 64);
    assert.equal(added, 1);
  });
});
