import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as S from "../js/sleepcheck-core.js";

const log = {
  "2026-11-08": { sleepHours: { value: 7.2 } }, "2026-11-09": { sleepHours: { value: 7.0 } },
  "2026-11-10": { sleepHours: { value: 6.8 } }, "2026-11-11": { sleepHours: { value: 7.1 } },
  "2026-11-12": { sleepHours: { value: 7.0 } }, "2026-11-13": { sleepHours: { value: 6.9 } },
  "2026-11-14": { sleepHours: { value: 7.0 } },
  "2026-11-15": { sleepHours: { value: 5.33, src: "simulated" } }
};

describe("the morning sleep check (the one case the demo shows)", () => {
  it("asks when last night was clearly shorter than the recent average", () => {
    const c = S.sleepCheck(log, "2026-11-15");
    assert.equal(c.ask, true);
    assert.equal(c.usual, 7);
    assert.equal(S.hm(c.last), "5 h 20 min");
    assert.equal(c.src, "simulated");
  });
  it("does not ask after a usual night, or with nothing to compare and a long night", () => {
    assert.equal(S.sleepCheck({ ...log, "2026-11-15": { sleepHours: { value: 7.1 } } }, "2026-11-15").ask, false);
    assert.equal(S.sleepCheck({ "2026-11-15": { sleepHours: { value: 7.5 } } }, "2026-11-15").ask, false);
    assert.equal(S.sleepCheck({ "2026-11-15": { sleepHours: { value: 5 } } }, "2026-11-15").ask, true, "under 7 h asks even without a recent average");
    assert.equal(S.sleepCheck({}, "2026-11-15").ask, false);
  });
  it("keeps the answer and the note with that day's log", () => {
    const now = new Date("2026-11-15T08:00:00Z");
    const next = S.saveAnswer(log, "2026-11-15", { feel: "very", reasons: ["shift", "bogus", "shift"], text: "  Night shift   for the docking " }, now);
    assert.deepEqual(next["2026-11-15"].feel, { value: "very", at: now.toISOString() });
    assert.deepEqual(next["2026-11-15"].note, { reasons: ["shift"], text: "Night shift for the docking" });
    assert.equal(next["2026-11-15"].sleepHours.value, 5.33, "the reading stays");
    assert.equal(S.sleepCheck(next, "2026-11-15").answered.value, "very");
    assert.equal(S.saveAnswer(log, "2026-11-15", { feel: "sleepy" }, now), log, "an unknown answer changes nothing");
  });
  it("prepares a plain summary for the crew medical officer, saying what is simulated", () => {
    const text = S.summaryText({ name: "Valentina Reyes", role: "Commander", missionDay: 14, day: "2026-11-15", check: S.sleepCheck(log, "2026-11-15"), night: { asleep: "22:35", wake: "04:10", awakenings: 2, awakeMin: 17, offInSleepMin: 36 }, answer: { feel: "very", reasons: ["shift"], text: "Night shift" }, simulated: true });
    assert.match(text, /5 h 20 min · recent average 7 h/);
    assert.match(text, /Very tired/);
    assert.match(text, /I changed shift yesterday/);
    assert.match(text, /36 min with the watch off, not counted/);
    assert.match(text, /SIMULATED/);
    assert.doesNotMatch(text, /diagnos|because of|caused by|should take/i);
  });
});
describe("the short message for the support channel", () => {
  it("fits in 280 characters and says what is simulated", () => {
    const t = S.shortSummary({ check: S.sleepCheck(log, "2026-11-15"), answer: { feel: "very", reasons: ["shift", "woke"], text: "x".repeat(140) }, simulated: true });
    assert.ok(t.length <= 280);
    assert.match(t, /^Sleep: last night 5 h 20 min \(recent average 7 h\)\. Feels very tired\. I changed shift yesterday; I woke up several times\./);
  });
});
