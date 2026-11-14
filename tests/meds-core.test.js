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
    assert.equal(csv.split("\n")[0], "taken_at_utc,medication,kit_category,units,unit,what_for,worked,side_effects,side_effect_strength,logged");
    assert.match(csv.split("\n")[1], /,Sleep B,Sleep,1,tablet,Sleep,partly,Drowsiness,,at the time$/);
  });
  it("writes waits in hours and minutes", () => {
    assert.equal(M.spanWords(NOW, ago(-3.5)), "3 h 30 min");
    assert.equal(M.spanWords(NOW, ago(1)), "now");
  });
});

describe("Dose Tracker 1: the weekly question", () => {
  it("asks when nothing was answered in the last 7 days", () => {
    assert.equal(M.weeklyDue(M.emptyStore(), NOW), true);
    const s = M.answerWeekly(M.emptyStore(), "none", new Date(NOW.getTime() - 6 * 86400000));
    assert.equal(M.weeklyDue(s, NOW), false);
    assert.equal(M.weeklyDue(s, new Date(NOW.getTime() + 86400000)), true);
    assert.equal(M.answerWeekly(M.emptyStore(), "maybe", NOW).weekly.length, 0);
  });
  it("records a dose remembered later at midday of that day, marked as remembered", () => {
    const w = M.whenToAt("2", NOW);
    assert.equal(w.recalled, true);
    assert.equal(M.dayOf(w.at), "2026-11-13");
    assert.equal(w.at.getHours(), 12);
    assert.equal(M.whenToAt("0", NOW).recalled, false);
    const r = M.logDose(M.emptyStore(), KIT, { medId: "painA", ...w });
    assert.equal(r.store.doses[0].recalled, true);
    assert.equal(M.cleanStore(r.store, KIT).doses[0].recalled, true);
  });
});

describe("Dose Tracker 2: own and every-day medications", () => {
  const ids = ["a1", "b2", "c3"];
  const next = () => ids.shift();
  let s = M.addOwn(M.emptyStore(), { name: "  Allergy  tablet ", unit: "tablet" }, next).store;
  s = M.addOwn(s, { name: "Thyroid pill", unit: "tablet", daily: true }, next).store;
  it("adds them with a clean name, refuses duplicates and bad units", () => {
    assert.deepEqual(s.own.map((o) => o.name), ["Allergy tablet", "Thyroid pill"]);
    assert.equal(M.addOwn(s, { name: "allergy tablet" }).ok, false);
    assert.equal(M.addOwn(s, { name: "X" }).ok, false);
    assert.equal(M.addOwn(s, { name: "Cream", unit: "jar" }).ok, false);
  });
  it("logs them like kit medications and keeps them after a reload", () => {
    const list = M.medList(KIT, s);
    const r = M.logDose(s, list, { medId: "own-a1", at: NOW });
    assert.equal(r.ok, true);
    const back = M.cleanStore(JSON.parse(JSON.stringify(r.store)), KIT);
    assert.equal(back.doses.length, 1);
    assert.equal(back.own.length, 2);
  });
  it("offers one tap for an every-day medication and does not ask whether it worked", () => {
    const today = M.dayOf(NOW);
    assert.deepEqual(M.scheduledToday(s, today).map((x) => [x.own.name, x.taken]), [["Thyroid pill", false]]);
    const r = M.logDose(s, M.medList(KIT, s), { medId: "own-b2", at: NOW, scheduled: true, reason: "As scheduled" });
    assert.equal(M.scheduledToday(r.store, today)[0].taken, true);
    assert.equal(M.followUps(r.store.doses, M.medList(KIT, r.store), new Date(NOW.getTime() + 5 * 3600000)).due.length, 0);
    assert.equal(M.patterns(M.emptyStore(), M.medList(KIT, s), NOW).length, 0);
  });
  it("never raises an every-day medication as a repeat pattern", () => {
    let t = s;
    for (const h of [0, 24, 48, 72]) t = M.logDose(t, M.medList(KIT, t), { medId: "own-b2", at: new Date(NOW.getTime() - h * 3600000), scheduled: true }).store;
    assert.equal(M.patterns(t, M.medList(KIT, t), NOW).length, 0);
  });
  it("keeps a removed one for the history but off the list", () => {
    const r = M.removeOwn(s, "own-a1");
    assert.equal(r.own.find((o) => o.id === "own-a1").removed, true);
    assert.equal(M.scheduledToday(M.removeOwn(s, "own-b2"), M.dayOf(NOW)).length, 0);
  });
});

describe("Dose Tracker 3: how strong the side effect was", () => {
  it("saves the strength only when there was a side effect", () => {
    let s = store([dose("painA", 5), dose("painA", 4)]);
    s = M.setOutcome(s, "painA-5", { worked: "yes", effects: ["Dizziness"], severity: "moderate", at: NOW }).store;
    assert.equal(s.doses[0].outcome.severity, "moderate");
    s = M.setOutcome(s, "painA-4", { worked: "yes", effects: ["Nothing"], severity: "severe", at: NOW }).store;
    assert.equal(s.doses[1].outcome.severity, undefined);
    assert.equal(M.setOutcome(s, "painA-4", { worked: "yes", effects: ["Dizziness"], severity: "awful" }).ok, false);
  });
  it("raises a severe side effect from the last week with the crew medical officer (illustrative)", () => {
    const s = store([dose("painA", 30, 1, { outcome: { worked: "yes", effects: ["Dizziness"], severity: "severe" } })]);
    const p = M.patterns(M.cleanStore(s, KIT), KIT, NOW);
    assert.equal(p[0].level, "talk");
    assert.match(p[0].text, /Severe side effect after pain a .*: dizziness\./);
    assert.equal(p[0].illustrative, true);
  });
});

describe("pharmacist review: day limits", () => {
  const KIT2 = [{ id: "cream", name: "Cream", unit: "dose", ingredient: "c", category: "Steroid", reviewedBy: "Pharmacist", reviewLimit: { days: 7, text: "Stop it after 7 to 10 days." }, askAfterHours: 72 }];
  it("raises it with the crew medical officer after more days in a row than she allows, labelled as her review", () => {
    const days = (n) => Array.from({ length: n }, (_, i) => dose("cream", i * 24));
    const review = (list) => list.filter((x) => x.id.startsWith("review-"));
    assert.equal(review(M.patterns(store(days(7)), KIT2, NOW)).length, 0);
    const p = review(M.patterns(store(days(8)), KIT2, NOW));
    assert.equal(p[0].id, "review-cream");
    assert.equal(p[0].level, "talk");
    assert.equal(p[0].reviewed, "Pharmacist");
    assert.match(p[0].text, /8 days in a row\. Pharmacist review: Stop it after 7 to 10 days\./);
  });
});
