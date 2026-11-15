import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as P from "../js/predict-core.js";
import { buildDemo, DEMO_CREW } from "../js/demo-core.js";

const day = (n) => P.addDays("2026-11-15", n);
// a log of 15 days with a reading made by f(i), i = 0 the oldest, 14 today
const make = (f) => Object.fromEntries(Array.from({ length: 15 }, (_, i) => [day(i - 14), f(i)]));

describe("each crew member against their own usual", () => {
  it("builds a baseline from the days before today, never from today", () => {
    const log = make((i) => ({ heartRate: { value: i === 14 ? 90 : 60 + (i % 3) } }));
    const b = P.baseline(log, "heartRate", "2026-11-15");
    assert.equal(b.n, 14);
    assert.ok(b.mean > 60 && b.mean < 62);
    const a = P.analyse(log, "heartRate", "2026-11-15");
    assert.equal(a.away, true);
    assert.equal(a.concern, true); // a heart rate far above their usual
  });

  it("needs five days before it calls anything usual", () => {
    const log = { [day(-1)]: { sleepHours: { value: 7 } }, [day(0)]: { sleepHours: { value: 4 } } };
    assert.equal(P.baseline(log, "sleepHours", "2026-11-15"), null);
    assert.equal(P.analyse(log, "sleepHours", "2026-11-15").away, false);
  });

  it("finds a falling week and carries it forward with a widening band", () => {
    const log = make((i) => ({ sleepHours: { value: i < 8 ? 7.5 : 7.5 - (i - 7) * 0.35 } }));
    const a = P.analyse(log, "sleepHours", "2026-11-15");
    assert.equal(a.direction, "falling");
    assert.equal(a.worsening, true);
    const f = P.forecast(log, "sleepHours", "2026-11-15", 3);
    assert.equal(f.length, 3);
    assert.ok(f[0].v > f[2].v);
    assert.ok(f[2].hi - f[2].lo >= f[0].hi - f[0].lo);
    assert.ok(P.signals(log, "2026-11-15").some((s) => s.id === "forecast-sleep"));
  });

  it("fits a straight line exactly", () => {
    const fit = P.fitLine([{ v: 1 }, { v: 3 }, { v: 5 }, { v: 7 }]);
    assert.equal(fit.slope, 2);
    assert.equal(fit.r2, 1);
  });

  it("adds up sleep debt against 7 hours", () => {
    const log = make((i) => ({ sleepHours: { value: i >= 12 ? 5 : 7 } }));
    assert.equal(P.sleepDebt(log, "2026-11-15").hours, 6);
  });

  it("projects radiation to the mission's end at the logged daily rate", () => {
    const log = make(() => ({ radiationDose: { value: 0.5 } }));
    const r = P.radiationOutlook(log, "2026-11-15", { start: day(-14), length: 180 });
    assert.equal(r.logged, 7.5);
    assert.equal(r.atEnd, 90);
    assert.equal(r.pctAtEnd, 15);
  });

  it("puts the bone outlook between NASA's two figures by the share of exercise done", () => {
    const none = P.boneOutlook(0, { length: 180 }), full = P.boneOutlook(1, { length: 180 });
    assert.equal(none.rate, 1.5);
    assert.ok(full.rate < 0.9 && full.atEnd >= 95);
    assert.ok(P.boneOutlook(0.5, { length: 180 }).atEnd < full.atEnd);
    assert.equal(P.boneOutlook(1, { length: 900 }).extrapolated, true);
  });

  it("reads the demo crew: Valentina's short nights stand out, Tomás has nothing", () => {
    const d = buildDemo(new Date(2026, 10, 15, 12));
    const today = Object.keys(d.logs[DEMO_CREW[0].id]).sort().pop();
    const v = P.signals(d.logs[DEMO_CREW[0].id], today);
    assert.ok(v.some((s) => s.id.includes("sleep")), JSON.stringify(v));
    assert.deepEqual(P.signals(d.logs[DEMO_CREW[1].id], today, { adherence: 0.9 }).filter((s) => s.id.includes("sleep")), []);
  });
});
