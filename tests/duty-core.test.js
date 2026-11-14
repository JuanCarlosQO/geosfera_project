import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as D from "../js/duty-core.js";
import { DUTY_FACTS, WORKLOAD, LEVELS, TASKS } from "../js/data/duty.js";
import { KIT } from "../js/data/med-kit.js";

const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
const NOW = new Date("2026-11-15T12:00:00Z");
const DAY = "2026-11-15";
const ago = (h) => new Date(NOW.getTime() - h * 3600000).toISOString();
const log = (sleep, mood, flag) => ({ [DAY]: { ...(sleep == null ? {} : { sleepHours: { value: sleep, ...(flag ? { flag } : {}) } }), ...(mood == null ? {} : { mood: { value: mood } }) } });
const calm = { time: 2, effort: 3, frustration: 1 };
const run = (over = {}) => D.assess({ log: log(7.5, 4), day: DAY, doses: [], kit: KIT, workload: calm, now: NOW, ...over });

describe("fit for duty: each check", () => {
  it("flags sleep under the 7 hours NASA's brief cites, and not 7 or more", () => {
    assert.equal(D.checkSleep(log(6.9, 4), DAY).state, "flag");
    assert.equal(D.checkSleep(log(7, 4), DAY).state, "ok");
  });
  it("says no data when sleep or mood is missing or needs measuring again", () => {
    assert.deepEqual(D.checkSleep({}, DAY), { id: "sleep", state: "none", why: "none" });
    assert.equal(D.checkSleep(log(5, 4, "again"), DAY).why, "again");
    assert.equal(D.checkMood(log(7, null), DAY).state, "none");
  });
  it("flags low mood only (app rule)", () => {
    assert.equal(D.checkMood(log(7, 2), DAY).state, "flag");
    assert.equal(D.checkMood(log(7, 3), DAY).state, "ok");
  });
  it("flags a recent dose of a medication NASA cautions about, newest first", () => {
    const r = D.checkMeds([{ medId: "meclizine", at: ago(3) }, { medId: "zolpidem", at: ago(7.5) }, { medId: "ibuprofen", at: ago(1) }], KIT, NOW);
    assert.equal(r.state, "flag");
    assert.deepEqual(r.items.map((i) => [i.med.id, i.hoursAgo]), [["meclizine", 3], ["zolpidem", 7]]);
  });
  it("ignores older doses and medications without a performance caution", () => {
    assert.equal(D.checkMeds([{ medId: "meclizine", at: ago(8) }, { medId: "acetaminophen", at: ago(1) }], KIT, NOW).state, "ok");
    assert.equal(D.checkMeds(undefined, KIT, NOW).state, "ok");
  });
  it("needs all three workload answers, and flags any high one", () => {
    assert.equal(D.checkWorkload(calm).state, "ok");
    assert.equal(D.checkWorkload({ time: 2, effort: 3 }).state, "none");
    assert.deepEqual(D.checkWorkload({ time: 4 }), { id: "workload", state: "flag", high: ["time"] });
    assert.equal(D.checkWorkload({ time: 9, effort: 1, frustration: 1 }).state, "none");
  });
});

describe("fit for duty: the headline is honest", () => {
  it("says ready only when every check has data and none is flagged", () => {
    const r = run();
    assert.equal(r.headline, "ready");
    assert.deepEqual([r.flags, r.gaps], [[], []]);
  });
  it("says there are gaps instead of ready when data is missing", () => {
    const r = run({ log: {}, workload: {} });
    assert.equal(r.headline, "gaps");
    assert.deepEqual(r.gaps, ["sleep", "mood", "workload"]);
  });
  it("says talk it over when anything is flagged, even with gaps", () => {
    const r = run({ log: log(5.5, null), doses: [{ medId: "promethazine", at: ago(2) }] });
    assert.equal(r.headline, "talk");
    assert.deepEqual(r.flags, ["sleep", "meds"]);
    assert.deepEqual(r.gaps, ["mood"]);
  });
  it("keeps the last checks and drops broken ones", () => {
    let list = [];
    for (let i = 0; i < D.RULES.keep + 5; i += 1) list = D.saveCheck(list, { task: "eva", result: run(), at: ago(-i) });
    assert.equal(list.length, D.RULES.keep);
    assert.equal(list.at(-1).headline, "ready");
    assert.equal(D.cleanChecks([...list.slice(0, 2), { at: "x" }, { at: ago(1), headline: "fit" }, null]).length, 2);
  });
});

describe("fit for duty: words are verified", () => {
  it("only shows facts quoted word for word in docs/SOURCES.md, with a NASA link", () => {
    for (const f of Object.values(DUTY_FACTS)) {
      assert.ok(sources.includes(f.quote), `not in SOURCES.md: ${f.quote}`);
      assert.ok(sources.includes(f.url), `link not in SOURCES.md: ${f.url}`);
      assert.match(f.url, /^https:\/\/(www|standards)\.nasa\.gov\//);
    }
    for (const m of KIT.filter((k) => k.performance)) assert.ok(sources.includes(m.performance.quote), m.id);
  });
  it("asks about the three parts of workload NASA names, on a five-step scale", () => {
    assert.deepEqual(WORKLOAD.map((w) => w.id), ["time", "effort", "frustration"]);
    assert.equal(LEVELS.length, 5);
    assert.ok(TASKS.length >= 2);
    assert.ok(String(D.RULES.sleepHours) === "7" && DUTY_FACTS.sleep.quote.includes("7-9 hours"));
  });
});

describe("fit for duty: the pharmacist's longer windows", () => {
  const at = (h) => new Date(NOW.getTime() - h * 3600000).toISOString();
  const dose = (medId, h) => ({ id: `${medId}-${h}`, medId, units: 1, at: at(h) });
  it("counts promethazine and zolpidem for 12 hours, others for the app's 8", () => {
    assert.equal(D.hoursFor(KIT.find((k) => k.id === "promethazine")), 12);
    assert.equal(D.hoursFor(KIT.find((k) => k.id === "zolpidem")), 12);
    assert.equal(D.hoursFor(KIT.find((k) => k.id === "melatonin")), D.RULES.impairHours);
    const c = D.checkMeds([dose("promethazine", 10), dose("melatonin", 10)], KIT, NOW);
    assert.deepEqual(c.items.map((i) => i.med.id), ["promethazine"]);
    assert.equal(D.checkMeds([dose("zolpidem", 13)], KIT, NOW).state, "ok");
  });
  it("never shortens the app's window", () => {
    for (const k of KIT) assert.ok(D.hoursFor(k) >= D.RULES.impairHours, k.id);
  });
});
