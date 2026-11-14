import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as M from "../js/meds-core.js";

// A made-up kit so the rules are tested apart from the real label data.
const KIT = [
  { id: "painA", name: "Pain A", unit: "tablet", ingredient: "alpha", tags: ["pain"], dose: { unitsPerDose: [1, 2], everyHours: 4, maxUnitsPerDay: 6 }, askAfterHours: 1, demo: { stock: 10, expiresInDays: 200 } },
  { id: "painA2", name: "Pain A, other brand", unit: "tablet", ingredient: "alpha", tags: ["pain"], dose: { unitsPerDose: [1, 2], everyHours: 4, maxUnitsPerDay: 6 }, askAfterHours: 1, demo: { stock: 4, expiresInDays: 200 } },
  { id: "sleepB", name: "Sleep B", unit: "tablet", ingredient: "beta", tags: ["sedating"], dose: { unitsPerDose: [1, 1], everyHours: 24, maxUnitsPerDay: 1 }, askAfterHours: 8, demo: { stock: 5, expiresInDays: 10 } },
  { id: "sickC", name: "Motion C", unit: "tablet", ingredient: "gamma", tags: ["sedating"], askFirst: [{ tag: "sedating", quote: "ask before use with sedatives", url: "https://example.test/c" }], dose: { unitsPerDose: [1, 2], everyHours: null, maxUnitsPerDay: 2 }, askAfterHours: 2, demo: { stock: 6, expiresInDays: -20 } },
  { id: "creamD", name: "Cream D", unit: "application", ingredient: "delta", tags: [], dose: { unitsPerDose: [1, 1], everyHours: null, maxUnitsPerDay: null }, askAfterHours: 24, demo: { stock: 0, expiresInDays: 90 } }
];
const med = (id) => KIT.find((k) => k.id === id);
const NOW = new Date("2026-11-15T12:00:00Z");
const ago = (h) => new Date(NOW.getTime() - h * 3600000).toISOString();
const dose = (medId, hoursAgo, units = 1, extra = {}) => ({ id: `${medId}-${hoursAgo}`, medId, units, at: ago(hoursAgo), reason: null, outcome: null, ...extra });
const fresh = () => M.seedKit(M.emptyStore(), KIT, M.dayOf(NOW));

describe("matching symptoms to common complaints", () => {
  const CONDITIONS = [
    { id: "sms", signs: ["nausea", "vomiting", "dizzy", "headache"], core: ["nausea", "vomiting"], options: [] },
    { id: "headache", signs: ["headache"], core: ["headache"], options: [] },
    { id: "congestion", signs: ["stuffy", "headache", "puffy"], core: ["stuffy"], options: [] }
  ];
  it("lists the complaints that fit, best fit first", () => {
    const m = M.matchConditions(CONDITIONS, ["nausea", "dizzy", "headache"]);
    assert.deepEqual(m.map((x) => x.id), ["sms", "headache"]);
    assert.deepEqual(m[0].hits, ["nausea", "dizzy", "headache"]);
  });
  it("needs a core symptom, so a headache alone is not motion sickness", () => {
    assert.deepEqual(M.matchConditions(CONDITIONS, ["headache"]).map((x) => x.id), ["headache"]);
  });
  it("returns nothing when nothing is picked", () => {
    assert.deepEqual(M.matchConditions(CONDITIONS, []), []);
  });
  it("picks out the symptoms that need a person, not the app", () => {
    const flags = [{ id: "chest", label: "Chest pain" }, { id: "breath", label: "Trouble breathing" }];
    assert.deepEqual(M.redFlags(flags, ["headache", "breath"]).map((f) => f.id), ["breath"]);
  });
});

describe("following the label", () => {
  it("is ok with nothing taken, and shows the room left in the day", () => {
    assert.deepEqual(M.doseState(med("painA"), KIT, [], NOW), { state: "ok", units: 0, until: null, room: 6 });
  });
  it("says wait when the last dose is closer than the label interval", () => {
    const s = M.doseState(med("painA"), KIT, [dose("painA", 1, 2)], NOW);
    assert.equal(s.state, "wait");
    assert.equal(s.until, ago(-3));
    assert.equal(s.room, 4);
  });
  it("is ok again once the interval has passed", () => {
    assert.equal(M.doseState(med("painA"), KIT, [dose("painA", 4.1, 2)], NOW).state, "ok");
  });
  it("stops at the label's daily limit and says when it frees up", () => {
    const s = M.doseState(med("painA"), KIT, [dose("painA", 20, 2), dose("painA", 12, 2), dose("painA", 5, 2)], NOW);
    assert.equal(s.state, "max");
    assert.equal(s.until, ago(-4), "24 h after the oldest dose in the window");
  });
  it("counts another product with the same active ingredient", () => {
    const s = M.doseState(med("painA"), KIT, [dose("painA2", 10, 2), dose("painA2", 6, 2), dose("painA", 5, 2)], NOW);
    assert.equal(s.state, "max");
  });
  it("also follows labels that limit times a day instead of units", () => {
    const cream = { ...med("creamD"), dose: { unitsPerDose: [1, 1], everyHours: null, maxDosesPerDay: 3 } };
    assert.equal(M.doseState(cream, KIT, [dose("creamD", 9), dose("creamD", 5)], NOW).state, "ok");
    const s = M.doseState(cream, KIT, [dose("creamD", 20), dose("creamD", 9), dose("creamD", 5)], NOW);
    assert.equal(s.state, "max");
    assert.equal(s.until, ago(-4));
  });
  it("forgets doses older than 24 hours", () => {
    assert.equal(M.doseState(med("painA"), KIT, [dose("painA", 30, 2), dose("painA", 26, 2), dose("painA", 25, 2)], NOW).state, "ok");
  });
  it("never offers more units than the daily limit has left", () => {
    const s = M.doseState(med("painA"), KIT, [dose("painA", 10, 2), dose("painA", 5, 2), dose("painA", 4.5, 1)], NOW);
    assert.equal(s.state, "ok");
    assert.equal(M.maxUnitsNow(med("painA"), s), 1);
  });
});

describe("saying how long", () => {
  it("writes waits in hours and minutes", () => {
    assert.equal(M.spanWords(NOW, ago(-3.5)), "3 h 30 min");
    assert.equal(M.spanWords(NOW, ago(-2)), "2 h");
    assert.equal(M.spanWords(NOW, ago(-0.25)), "15 min");
    assert.equal(M.spanWords(NOW, ago(1)), "now");
  });
});

describe("the kit", () => {
  it("seeds a simulated kit once and keeps what is already there", () => {
    const s = fresh();
    assert.equal(s.kit.painA.stock, 10);
    assert.equal(s.kit.sickC.expires, "2026-10-26");
    const again = M.seedKit({ doses: [], kit: { ...s.kit, painA: { stock: 3, expires: "2027-01-01" } } }, KIT, "2030-01-01");
    assert.deepEqual(again.kit.painA, { stock: 3, expires: "2027-01-01" });
  });
  it("tells out, expired, use-first and ok apart", () => {
    const s = fresh();
    const today = M.dayOf(NOW);
    assert.equal(M.stockState(s.kit.creamD, today), "out");
    assert.equal(M.stockState(s.kit.sickC, today), "expired");
    assert.equal(M.stockState(s.kit.sleepB, today), "soon");
    assert.equal(M.stockState(s.kit.painA, today), "ok");
    assert.equal(M.stockState(undefined, today), "out");
  });
  it("drops broken data read back from the device", () => {
    const c = M.cleanStore({ doses: [dose("painA", 2), { medId: "ghost", units: 1, at: ago(1) }, { medId: "painA", units: 0, at: ago(1) }, { medId: "painA", units: 1, at: "not a date" }], kit: { painA: { stock: 4, expires: "2027-01-01" }, ghost: { stock: 1 }, sleepB: { stock: -1 } } }, KIT);
    assert.equal(c.doses.length, 1);
    assert.deepEqual(Object.keys(c.kit), ["painA"]);
  });
});

describe("label-warned combinations", () => {
  it("flags a sedating medication taken in the last 24 hours", () => {
    const c = M.clashes(med("sickC"), KIT, [dose("sleepB", 6)], NOW);
    assert.equal(c.length, 1);
    assert.equal(c[0].medId, "sleepB");
    assert.equal(c[0].quote, "ask before use with sedatives");
  });
  it("ignores older doses and labels without that warning", () => {
    assert.deepEqual(M.clashes(med("sickC"), KIT, [dose("sleepB", 30)], NOW), []);
    assert.deepEqual(M.clashes(med("sleepB"), KIT, [dose("sickC", 2)], NOW), []);
  });
});

describe("suggestions for a complaint", () => {
  const cond = { id: "x", options: ["painA", "sleepB", "sickC", "creamD", "missing"] };
  it("gives each kit option a state, in the data's order", () => {
    const store = { ...fresh(), doses: [dose("painA", 1, 2), dose("sleepB", 30)] };
    const o = M.options(cond, KIT, store, NOW);
    assert.deepEqual(o.map((x) => [x.med.id, x.state]), [["painA", "wait"], ["sleepB", "ok"], ["sickC", "expired"], ["creamD", "out"]]);
  });
  it("puts the label limit before the date, and the date before a combination", () => {
    const store = { ...fresh(), doses: [dose("sickC", 3, 2), dose("sleepB", 2)] };
    const o = M.options(cond, KIT, store, NOW);
    assert.equal(o.find((x) => x.med.id === "sickC").state, "max");
    store.doses = [dose("sleepB", 2)];
    assert.equal(M.options(cond, KIT, store, NOW).find((x) => x.med.id === "sickC").state, "expired");
    store.kit.sickC.expires = "2027-06-01";
    assert.equal(M.options(cond, KIT, store, NOW).find((x) => x.med.id === "sickC").state, "check");
  });
});

describe("the record of what was taken and whether it worked", () => {
  it("records a dose and takes it out of the kit", () => {
    const r = M.logDose(fresh(), KIT, { medId: "painA", units: 2, reason: "headache", at: NOW });
    assert.equal(r.ok, true);
    assert.equal(r.store.kit.painA.stock, 8);
    assert.equal(r.store.doses.length, 1);
    assert.equal(r.dose.outcome, null);
  });
  it("refuses only an unknown medication, a bad count or an empty pouch", () => {
    const s = fresh();
    assert.equal(M.logDose(s, KIT, { medId: "ghost" }).ok, false);
    assert.equal(M.logDose(s, KIT, { medId: "painA", units: 0 }).ok, false);
    assert.equal(M.logDose(s, KIT, { medId: "creamD", units: 1 }).ok, false);
    const early = M.logDose({ ...s, doses: [dose("painA", 0.5, 2)] }, KIT, { medId: "painA", units: 2, at: NOW });
    assert.equal(early.ok, true, "an early dose is still recorded");
  });
  it("asks whether it worked after the medication's own waiting time", () => {
    const f = M.followUps([dose("painA", 1.5), dose("sleepB", 1.5), dose("painA", 30, 1, { outcome: { worked: "yes", effects: [] } })], KIT, NOW);
    assert.deepEqual(f.due.map((x) => x.dose.medId), ["painA"]);
    assert.deepEqual(f.later.map((x) => x.dose.medId), ["sleepB"]);
    assert.equal(f.later[0].askAt, ago(-6.5));
  });
  it("saves the answer and counts how each medication has gone for this person", () => {
    let s = { ...fresh(), doses: [dose("painA", 50), dose("painA", 26), dose("painA", 3)] };
    s = M.setOutcome(s, "painA-50", { worked: "yes", at: NOW }).store;
    s = M.setOutcome(s, "painA-26", { worked: "no", effects: ["drowsy"], at: NOW }).store;
    assert.deepEqual(M.response(s.doses, "painA"), { rated: 2, yes: 1, partly: 0, no: 1, effects: { drowsy: 1 } });
    assert.equal(M.setOutcome(s, "painA-3", { worked: "maybe" }).ok, false);
    assert.equal(M.setOutcome(s, "nope", { worked: "yes" }).ok, false);
  });
  it("asks for the medical officer after two doses in a row that did not work", () => {
    const no = { outcome: { worked: "no", effects: [] }, reason: "headache" };
    const yes = { outcome: { worked: "yes", effects: [] }, reason: "headache" };
    assert.equal(M.needsOfficer([dose("painA", 30, 1, no), dose("painA", 20, 1, no)], "headache"), true);
    assert.equal(M.needsOfficer([dose("painA", 30, 1, no), dose("painA", 20, 1, yes)], "headache"), false);
    assert.equal(M.needsOfficer([dose("painA", 20, 1, no)], "headache"), false);
    assert.equal(M.needsOfficer([dose("painA", 30, 1, no), dose("painA", 20, 1, no)], "back"), false);
  });
  it("exports the record as CSV", () => {
    const s = { doses: [dose("sickC", 3, 2, { reason: "sms", outcome: { worked: "partly", effects: ["drowsy", "dry mouth"] } })] };
    const csv = M.toCsv(s.doses, KIT);
    assert.equal(csv.split("\n")[0], "taken_at_utc,medication,units,unit,reason,worked,side_effects");
    assert.match(csv.split("\n")[1], /,Motion C,2,tablet,sms,partly,drowsy dry mouth$/);
  });
});
