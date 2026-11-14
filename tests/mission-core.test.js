import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as M from "../js/mission-core.js";

const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
const day = (hr, ex, extra = {}) => ({ heartRate: { value: hr }, ...(ex != null ? { exerciseMinutes: { value: ex } } : {}), ...extra });

describe("exercise goal is NASA's, quoted exactly", () => {
  it("uses 90 minutes and a quote found in docs/SOURCES.md", () => {
    assert.equal(M.EXERCISE.dailyMinutes, 90);
    assert.ok(sources.includes(M.EXERCISE.quote));
    assert.ok(sources.includes(M.EXERCISE.url));
  });
  it("fills the ring by minutes, capped at full", () => {
    assert.equal(M.ringFraction(day(60, 45)), 0.5);
    assert.equal(M.ringFraction(day(60, 200)), 1);
    assert.equal(M.ringFraction({}), 0);
  });
});

describe("streaks", () => {
  const log = { "2026-11-10": day(60), "2026-11-12": day(61), "2026-11-13": day(62), "2026-11-14": day(63) };
  it("counts consecutive days ending today", () => assert.equal(M.currentStreak(log, "2026-11-14"), 3));
  it("keeps yesterday's streak while today is still open", () => assert.equal(M.currentStreak(log, "2026-11-15"), 3));
  it("drops to zero after a missed day", () => assert.equal(M.currentStreak(log, "2026-11-16"), 0));
  it("remembers the best run", () => assert.equal(M.bestStreak(log), 3));
  it("crosses month ends", () => assert.equal(M.currentStreak({ "2026-10-31": day(60), "2026-11-01": day(60) }, "2026-11-01"), 2));
});

describe("achievements reward habits, not values", () => {
  it("never depend on a vital-sign value", () => {
    const calm = { "2026-11-14": day(60, 90) };
    const odd = { "2026-11-14": day(180, 90) };
    assert.deepEqual(M.achievements(calm, "2026-11-14"), M.achievements(odd, "2026-11-14"));
  });
  it("unlock first check-in and the exercise countermeasure", () => {
    const a = Object.fromEntries(M.achievements({ "2026-11-14": day(60, 95) }, "2026-11-14").map((x) => [x.id, x]));
    assert.equal(a.first.unlocked, true);
    assert.equal(a.goal.unlocked, true);
    assert.equal(a.streak3.progress, 1);
  });
  it("counts a NASA week as 6 goal days out of the last 7", () => {
    const log = Object.fromEntries(M.lastDays("2026-11-14", 7).map((d, i) => [d, day(60, i === 0 ? 30 : 90)]));
    const a = M.achievements(log, "2026-11-14").find((x) => x.id === "goalweek");
    assert.equal(a.progress, 6);
    assert.equal(a.unlocked, true);
  });
  it("gives a second look after a Measure again", () => {
    const log = { "2026-11-13": { heartRate: { value: 131, flag: "again" } }, "2026-11-14": day(64) };
    assert.equal(M.achievements(log, "2026-11-14").find((x) => x.id === "second").unlocked, true);
  });
});

describe("week and adherence", () => {
  it("lists the last 7 days with minutes", () => {
    const w = M.week({ "2026-11-14": day(60, 40) }, "2026-11-14");
    assert.equal(w.length, 7);
    assert.equal(w.at(-1).minutes, 40);
    assert.equal(w[0].day, "2026-11-08");
  });
  it("shares mission days with a check-in", () => {
    const r = M.adherence({ "2026-11-12": day(60), "2026-11-14": day(60) }, "2026-11-12", "2026-11-14");
    assert.deepEqual([r.logged, r.days], [2, 3]);
  });
});
