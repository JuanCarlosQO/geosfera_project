import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as M from "../js/meds-core.js";

// A made-up kit so the rules are tested apart from the real data.
const KIT = [
  { id: "painA", name: "Pain A", unit: "tablet", ingredient: "alpha", category: "Pain Reliever", tags: ["pain"], kitLimit: { perDay: 8, quote: "No more than 8 tablets every 24 hours.", url: "https://example.test/kit" }, sideEffects: { quote: "Dizziness, upset stomach, ringing in the ears" }, askAfterHours: 1 },
  { id: "painA2", name: "Pain A, other brand", unit: "tablet", ingredient: "alpha", category: "Pain Reliever", tags: ["pain"], sideEffects: { quote: "No significant side effects within prescribed dose" }, askAfterHours: 1 },
  { id: "sleepB", name: "Sleep B", unit: "tablet", ingredient: "beta", category: "Sleep", tags: ["sleep"], askFirst: [{ tag: "sleep", quote: "Do not use with other sleep meds.", url: "https://example.test/kit" }], askAfterHours: 8 },
  { id: "sleepC", name: "Sleep C", unit: "tablet", ingredient: "gamma", category: "Sleep", tags: ["sleep"], askFirst: [{ tag: "sleep", quote: "Do not use with other sleep meds.", url: "https://example.test/kit" }], askAfterHours: 8 },
  { id: "sprayD", name: "Spray D", unit: "dose", ingredient: "delta", category: "Decongestant", tags: [], kitLimit: { days: 3, quote: "Do not use more than 3 consecutive days.", url: "https://example.test/kit" }, askAfterHours: 1 }
];
const SUPPS = [{ id: "vitD" }];
const NOW = new Date("2026-11-15T12:00:00");
const ago = (h) => new Date(NOW.getTime() - h * 3600000).toISOString();
const dose = (medId, hoursAgo, units = 1, extra = {}) => ({ id: `${medId}-${hoursAgo}`, medId, units, at: ago(hoursAgo), reason: null, outcome: null, ...extra });
const store = (doses, supplements = {}) => ({ doses, supplements });
const ids = (list) => list.map((p) => p.id);

describe("the log never prescribes", () => {
  it("records what was taken, whatever the amount or timing", () => {
    const r = M.logDose(M.emptyStore(), KIT, { medId: "painA", units: 3, reason: "Headache", at: NOW });
    assert.equal(r.ok, true);
    assert.deepEqual(r.store.doses[0], { id: `painA-${NOW.getTime()}`, medId: "painA", units: 3, at: NOW.toISOString(), reason: "Headache", outcome: null });
    assert.equal(M.logDose(r.store, KIT, { medId: "painA", units: 3, at: NOW }).ok, true, "a second dose straight away is still recorded");
  });
  it("refuses only an unknown medication or a bad count", () => {
    assert.equal(M.logDose(M.emptyStore(), KIT, { medId: "ghost" }).ok, false);
    assert.equal(M.logDose(M.emptyStore(), KIT, { medId: "painA", units: 0 }).ok, false);
  });
  it("offers the medications of a kit category", () => {
    assert.deepEqual(M.inCategories(KIT, ["Sleep"]).map((m) => m.id), ["sleepB", "sleepC"]);
  });
  it("asks about the side effects the kit list gives, in its own words", () => {
    assert.deepEqual(M.effectsFor(KIT[0]), ["Dizziness", "Upset stomach", "Ringing in the ears"]);
    assert.deepEqual(M.effectsFor(KIT[1]), [], "no list when the kit says no significant side effects");
    assert.deepEqual(M.effectsFor(KIT[2]), []);
  });
  it("picks out the alarm signs", () => {
    const flags = [{ id: "chest", label: "Chest pain" }, { id: "breath", label: "Trouble breathing" }];
    assert.deepEqual(M.redFlags(flags, ["breath"]).map((f) => f.id), ["breath"]);
  });
});

describe("follow-up: did it work?", () => {
  it("asks after the medication's own waiting time", () => {
    const f = M.followUps([dose("painA", 1.5), dose("sleepB", 1.5), dose("painA", 30, 1, { outcome: { worked: "yes", effects: [] } })], KIT, NOW);
    assert.deepEqual(f.due.map((x) => x.dose.medId), ["painA"]);
    assert.deepEqual(f.later.map((x) => x.dose.medId), ["sleepB"]);
  });
  it("saves the answer and the side effects", () => {
    let s = store([dose("painA", 5), dose("painA", 3)]);
    s = M.setOutcome(s, "painA-5", { worked: "no", effects: ["Dizziness"], at: NOW }).store;
    assert.deepEqual(s.doses[0].outcome, { worked: "no", effects: ["Dizziness"], at: NOW.toISOString() });
    assert.deepEqual(M.response(s.doses, "painA"), { rated: 1, yes: 0, partly: 0, no: 1 });
    assert.equal(M.setOutcome(s, "painA-3", { worked: "maybe" }).ok, false);
  });
});

describe("patterns worth raising", () => {
  it("is quiet with nothing unusual", () => {
    assert.deepEqual(M.patterns(store([dose("painA", 2, 2)]), KIT, NOW), []);
  });
  it("quotes the kit list when its 24-hour limit is passed, counting the same ingredient", () => {
    const p = M.patterns(store([dose("painA", 20, 4), dose("painA2", 10, 3), dose("painA", 2, 2)]), KIT, NOW);
    assert.deepEqual(ids(p), ["limit-painA"]);
    assert.equal(p[0].level, "talk");
    assert.equal(p[0].quote, "No more than 8 tablets every 24 hours.");
    assert.match(p[0].text, /^9 tablets/);
  });
  it("quotes the kit list when a spray is used more days in a row than it allows", () => {
    const p = M.patterns(store([0, 24, 48, 72].map((h) => dose("sprayD", h))), KIT, NOW);
    assert.ok(ids(p).includes("days-sprayD"));
    assert.equal(M.patterns(store([0, 24, 48].map((h) => dose("sprayD", h))), KIT, NOW).some((x) => x.id === "days-sprayD"), false);
  });
  it("quotes the kit list for two sleep medications within 24 hours, once", () => {
    const p = M.patterns(store([dose("sleepB", 20), dose("sleepC", 2)]), KIT, NOW);
    assert.deepEqual(ids(p), ["mix-sleepB+sleepC"]);
    assert.equal(p[0].quote, "Do not use with other sleep meds.");
  });
  it("suggests a downlink when one category is used several days in a row, with sleep and mood (illustrative)", () => {
    const day = (h) => M.dayOf(ago(h));
    const log = { [day(0)]: { sleepHours: { value: 5.1 }, mood: { value: 2 } }, [day(24)]: { sleepHours: { value: 5.6 }, mood: { value: 3 } }, [day(48)]: { sleepHours: { value: 6 } } };
    const p = M.patterns(store([2, 26, 50].map((h) => dose("sleepB", h))), KIT, NOW, log);
    const r = p.find((x) => x.id === "repeat-Sleep");
    assert.equal(r.level, "downlink");
    assert.equal(r.illustrative, true);
    assert.match(r.text, /3 days in a row\. Sleep on those days: 6, 5\.6, 5\.1 h\. Mood: 3, 2 of 5\./);
  });
  it("raises a medication that did not work twice in a row (illustrative)", () => {
    const no = { outcome: { worked: "no", effects: [] } };
    const p = M.patterns(store([dose("painA", 30, 1, no), dose("painA", 20, 1, no)]), KIT, NOW);
    assert.deepEqual(ids(p), ["noeffect-painA"]);
    assert.equal(M.patterns(store([dose("painA", 30, 1, no), dose("painA", 20, 1, { outcome: { worked: "yes" } })]), KIT, NOW).length, 0);
  });
  it("lists talk-to-the-officer before downlink", () => {
    const p = M.patterns(store([2, 26, 50].map((h) => dose("sleepB", h)).concat(dose("sleepC", 3))), KIT, NOW);
    assert.deepEqual(p.map((x) => x.level), ["talk", "downlink"]);
  });
  it("counts days in a row ending today", () => {
    assert.equal(M.daysInARow([dose("painA", 0), dose("painA", 24), dose("painA", 72)], () => true, M.dayOf(NOW)), 2);
  });
});

describe("supplements: taken or not", () => {
  it("marks and unmarks a day and shows the last seven", () => {
    const today = M.dayOf(NOW);
    let s = M.markSupplement(M.emptyStore(), "vitD", today, true);
    s = M.markSupplement(s, "vitD", M.addDays(today, -2), true);
    assert.deepEqual(M.supplementDays(s, "vitD", today, 3).map((d) => d.taken), [true, false, true]);
    s = M.markSupplement(s, "vitD", today, false);
    assert.equal(s.supplements[today], undefined);
  });
});

describe("the log on the device", () => {
  it("drops broken data and unknown supplements", () => {
    const c = M.cleanStore({ doses: [dose("painA", 2), { medId: "ghost", units: 1, at: ago(1) }, { medId: "painA", units: 0, at: ago(1) }, { medId: "painA", units: 1, at: "x" }], supplements: { "2026-11-15": ["vitD", "other"], bad: ["vitD"] } }, KIT, SUPPS);
    assert.equal(c.doses.length, 1);
    assert.deepEqual(c.supplements, { "2026-11-15": ["vitD"] });
  });
  it("exports the log as CSV with the kit category and what it was for", () => {
    const csv = M.toCsv([dose("sleepB", 3, 1, { reason: "Sleep", outcome: { worked: "partly", effects: ["Drowsiness"] } })], KIT);
    assert.equal(csv.split("\n")[0], "taken_at_utc,medication,kit_category,units,unit,what_for,worked,side_effects");
    assert.match(csv.split("\n")[1], /,Sleep B,Sleep,1,tablet,Sleep,partly,Drowsiness$/);
  });
  it("writes waits in hours and minutes", () => {
    assert.equal(M.spanWords(NOW, ago(-3.5)), "3 h 30 min");
    assert.equal(M.spanWords(NOW, ago(1)), "now");
  });
});
