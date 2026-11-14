import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as F from "../js/future-core.js";
import { FUTURE_FACTS, MISSIONS } from "../js/data/future.js";

const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");

describe("future body: the projection", () => {
  it("uses NASA's 1 % to 1.5 % a month", () => {
    assert.deepEqual(F.band(0), { best: 100, worst: 100, extrapolated: false });
    assert.deepEqual(F.band(6), { best: 94, worst: 91, extrapolated: false });
    assert.deepEqual(F.band(36), { best: 64, worst: 46, extrapolated: true });
    assert.equal(F.remaining(100, 1.5), 0);
  });
  it("says when the range crosses NASA's 95 % requirement", () => {
    assert.equal(F.monthsToRequirement(1.5), 3.3);
    assert.equal(F.monthsToRequirement(1), 5);
    assert.deepEqual([2, 4, 6].map(F.versusRequirement), ["above", "crossing", "below"]);
  });
  it("counts countermeasure habits, never turning them into a bone number", () => {
    const log = { "2026-11-15": { exerciseMinutes: { value: 90 } }, "2026-11-14": { exerciseMinutes: { value: 60 } }, "2026-11-01": { exerciseMinutes: { value: 120 } } };
    const h = F.habits(log, { "2026-11-15": ["vitaminD"], "2026-11-13": ["vitaminD"] }, "2026-11-15", 14);
    assert.deepEqual(h, { days: 14, exercise: 1, exerciseLogged: 2, vitaminD: 2 });
    assert.deepEqual(Object.keys(h), ["days", "exercise", "exerciseLogged", "vitaminD"]);
  });
  it("draws the chart inside its box", () => {
    assert.equal(F.x(0), F.CHART.left);
    assert.equal(F.x(F.MAX_MONTHS), F.CHART.W - F.CHART.right);
    assert.equal(F.y(100), F.CHART.top);
    assert.equal(F.y(40), F.CHART.H - F.CHART.bottom);
    assert.match(F.linePaths(1).measured, /^M44 16 L/);
    assert.match(F.bandPath(), / Z$/);
  });
});

describe("future body: sources", () => {
  it("shows only NASA words quoted in docs/SOURCES.md", () => {
    for (const [k, f] of Object.entries(FUTURE_FACTS)) {
      assert.ok(sources.includes(f.quote), `not in SOURCES.md: ${k}`);
      assert.ok(sources.includes(f.url), `link not in SOURCES.md: ${k}`);
    }
  });
  it("takes its numbers from those words", () => {
    assert.ok(FUTURE_FACTS.loss.quote.includes(`${F.RATE.low}% and ${F.RATE.high}%`));
    assert.ok(FUTURE_FACTS.requirement.quote.includes(`${F.REQUIREMENT}%`));
    assert.ok(FUTURE_FACTS.withCountermeasures.quote.includes(`<${100 - F.WITH_CM_6M}%`));
    assert.ok(FUTURE_FACTS.loss.quote.includes(`four-to-six-month`) && F.MEASURED_MONTHS === 6);
    assert.ok(FUTURE_FACTS.exercise.quote.includes("1.5 hours") && F.EXERCISE_MIN === 90);
    assert.equal(MISSIONS.find((m) => m.id === "mars").months, F.MAX_MONTHS);
  });
});
