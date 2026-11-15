import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as X from "../js/exercise-core.js";
import { LOCAL_ONLY } from "../js/sync-core.js";
import { readFileSync } from "node:fs";
import { EXERCISE_FACTS } from "../js/data/exercise.js";

const empty = () => X.cleanStore({});
const now = new Date("2026-11-15T15:00:00Z");

describe("the ground team prescribes, the crew member logs", () => {
  it("starts from the app's 90-minute plan until the ground team writes one", () => {
    const p = X.planFor(empty(), "a");
    assert.equal(p.set, false);
    assert.equal(p.sessions.reduce((t, s) => t + s.minutes, 0), 90);
  });

  it("keeps a prescription the ground team writes, and refuses an empty or oversized one", () => {
    const r = X.setPlan(empty(), "a", [{ focus: "upper", minutes: 45 }, { focus: "run", minutes: 40 }], "Flight surgeon", now);
    assert.ok(r.ok);
    const p = X.planFor(r.store, "a");
    assert.equal(p.set, true);
    assert.deepEqual(p.sessions.map((s) => s.device), ["ared", "t2"]);
    assert.equal(X.setPlan(empty(), "a", []).ok, false);
    assert.equal(X.setPlan(empty(), "a", Array(5).fill({ focus: "steady", minutes: 20 })).ok, false);
    assert.equal(X.setPlan(empty(), "a", [{ focus: "yoga", minutes: 20 }]).ok, false);
  });

  it("logs a session with its loads and what was felt after, and replaces it when edited", () => {
    const s = X.planFor(empty(), "a").sessions[0];
    let r = X.logSession(empty(), { member: "a", day: "2026-11-15", session: s, minutes: 55, sets: [{ move: "squat", load: 250, reps: 8 }, { move: "bench", load: 100 }], symptoms: ["back", "nope"], note: "lower back after deadlifts", now });
    assert.ok(r.ok);
    assert.deepEqual(r.entry.sets, [{ move: "squat", load: 250, reps: 8 }]); // a bench press is not part of a lower-body session
    assert.deepEqual(r.entry.symptoms, ["back"]);
    r = X.logSession(r.store, { member: "a", day: "2026-11-15", session: s, minutes: 60, now });
    assert.equal(r.store.log.length, 1);
    assert.equal(X.minutesOn(r.store, "a", "2026-11-15"), 60);
    assert.equal(X.logSession(empty(), { member: "a", day: "2026-11-15", session: s, minutes: 999 }).ok, false);
    assert.equal(X.logSession(empty(), { member: "a", day: "2026-11-15", session: s, minutes: 30, sets: [{ move: "squat", load: 9999 }] }).entry.sets.length, 0);
    // boxes left empty are not loads of 0
    assert.deepEqual(X.logSession(empty(), { member: "a", day: "2026-11-15", session: s, minutes: 30, sets: [{ move: "squat", load: 200, reps: null }, { move: "deadlift", load: null, reps: null }, { move: "heel", load: "", reps: "" }] }).entry.sets, [{ move: "squat", load: 200, reps: null }]);
  });

  it("counts the days the prescription was done", () => {
    let st = empty();
    const [a, b] = X.planFor(st, "a").sessions;
    for (const day of ["2026-11-13", "2026-11-14", "2026-11-15"]) st = X.logSession(st, { member: "a", day, session: a, minutes: 60, now }).store;
    st = X.logSession(st, { member: "a", day: "2026-11-15", session: b, minutes: 30, now }).store;
    const c = X.compliance(st, "a", "2026-11-15", 7);
    assert.equal(c.full, 1);
    assert.equal(c.doneSessions, 4);
    assert.equal(c.sessions, 14);
    assert.deepEqual(X.dayStatus(st, "a", "2026-11-14").map((d) => Boolean(d.done)), [true, false]);
  });

  it("lists symptoms and follows a lift's heaviest load", () => {
    let st = empty();
    const s = X.planFor(st, "a").sessions[0];
    st = X.logSession(st, { member: "a", day: "2026-11-14", session: s, minutes: 60, sets: [{ move: "squat", load: 240 }, { move: "squat", load: 250 }], now }).store;
    st = X.logSession(st, { member: "a", day: "2026-11-15", session: s, minutes: 60, sets: [{ move: "squat", load: 255 }], symptoms: ["dizzy"], now }).store;
    assert.deepEqual(X.loadTrend(st, "a", "squat").map((p) => p.load), [250, 255]);
    assert.deepEqual(X.recentSymptoms(st, "a", "2026-11-15").map((e) => e.symptoms), [["dizzy"]]);
    assert.ok(X.TELL_NOW.includes("dizzy"));
  });

  it("keeps machine problems open until fixed", () => {
    const r = X.addFault(empty(), { member: "a", device: "t2", text: "harness bungee frayed", now, id: "f1" });
    assert.ok(r.ok);
    assert.equal(X.openFaults(r.store).length, 1);
    assert.equal(X.openFaults(X.fixFault(r.store, "f1", now)).length, 0);
    assert.equal(X.addFault(empty(), { member: "a", device: "t2", text: "  " }).ok, false);
  });

  it("is shared with the ground through the sync", () => {
    assert.equal(LOCAL_ONLY.includes(X.EXERCISE_KEY), false);
    assert.deepEqual(X.cleanStore({ plans: { a: { sessions: [{ focus: "bad" }] } }, log: [{ member: "a" }], faults: [{}] }), { plans: {}, log: [], faults: [] });
  });
});

describe("exercise facts are verified", () => {
  it("quotes only words that are in docs/SOURCES.md, with their link", () => {
    const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
    for (const [id, f] of Object.entries(EXERCISE_FACTS)) {
      assert.ok(sources.includes(f.quote), `not in SOURCES.md: ${id}`);
      assert.ok(sources.includes(f.url), `link not in SOURCES.md: ${id}`);
    }
  });
});

describe("strength training and endurance & conditioning", () => {
  it("puts every session in one of the two blocks", () => {
    for (const [id, f] of Object.entries(X.FOCUS)) assert.ok(X.BLOCKS[f.block], id);
    assert.equal(X.blockOf("lower"), "strength");
    assert.equal(X.blockOf("run"), "endurance");
    assert.equal(X.blockOf("intervals"), "endurance");
    const b = X.byBlock(X.dayStatus(X.cleanStore({}), "a", "2026-11-15"));
    assert.deepEqual([b.strength.length, b.endurance.length], [1, 1]); // the starting plan has one of each
  });
});

