import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as Q from "../js/screen-core.js";
import { SCREEN_FACTS, PHQ9_ITEMS, GAD7_ITEMS } from "../js/data/screening.js";
import { buildDemo, DEMO_CREW } from "../js/demo-core.js";

const day = (s) => new Date(`2026-11-${s}Z`);
const run = (answersBySet, extra = false) => {
  let a = {};
  for (;;) {
    const q = Q.nextQuestion(a, { extra });
    if (!q) return a;
    a = Q.answer(a, q.set, q.i, answersBySet[q.set][q.i]);
  }
};

describe("check-in questions", () => {
  it("asks only PHQ-2 and GAD-2 when both screens are negative", () => {
    const a = run({ phq: [1, 1, 3, 3, 3, 3, 3, 3, 3], gad: [1, 1, 3, 3, 3, 3, 3] });
    assert.equal(Q.plan(a).length, 4);
    assert.deepEqual(Q.scores(a), { phq2: 2, gad2: 2, phq9: null, gad7: null, item9: null, pss4: null, ucla3: null });
  });
  it("follows a positive PHQ-2 with the rest of the PHQ-9, and a positive GAD-2 with the GAD-7", () => {
    const a = run({ phq: [2, 1, 1, 1, 0, 0, 1, 0, 0], gad: [1, 2, 1, 1, 1, 0, 0] });
    assert.equal(Q.plan(a).length, 4 + 7 + 5);
    const s = Q.scores(a);
    assert.equal(s.phq9, 6);
    assert.equal(s.gad7, 6);
    assert.equal(Q.phq9Band(s.phq9), "Mild");
  });
  it("adds PSS-4 (items 2 and 3 reversed) and UCLA-3 every four weeks", () => {
    const a = run({ phq: [0, 0], gad: [0, 0], pss: [4, 0, 0, 4], ucla: [3, 3, 3] }, true);
    assert.equal(Q.plan(a, { extra: true }).length, 11);
    assert.equal(Q.scores(a).pss4, 16);
    assert.equal(Q.scores(a).ucla3, 9);
  });
  it("uses the sources' bands", () => {
    assert.deepEqual([0, 5, 10, 15, 20, 27].map(Q.phq9Band), ["None-minimal", "Mild", "Moderate", "Moderately severe", "Severe", "Severe"]);
    assert.deepEqual([4, 5, 10, 15, 21].map(Q.gad7Band), ["Minimal", "Mild", "Moderate", "Severe", "Severe"]);
  });
});

describe("check-in flags", () => {
  const rec = (answers, at = day("15T08:00:00")) => Q.makeCheckin({ member: "a", answers, at });
  it("question 9 above 'Not at all' is always Act now", () => {
    const f = Q.flags([rec({ phq: [2, 1, 0, 0, 0, 0, 0, 0, 1], gad: [0, 0] })], "a");
    assert.equal(f[0].level, "act");
    assert.match(f[0].text, /question 9/);
  });
  it("positive screens and a GAD-7 of 8 or more are worth a look; severe is Act now", () => {
    assert.equal(Q.flags([rec({ phq: [2, 1, 0, 0, 0, 0, 0, 0, 0], gad: [0, 0] })], "a")[0].level, "watch");
    assert.equal(Q.flags([rec({ phq: [0, 0], gad: [2, 2, 1, 1, 1, 1, 0] })], "a")[0].text.startsWith("GAD-7 8"), true);
    assert.equal(Q.flags([rec({ phq: [0, 0], gad: [3, 3, 3, 2, 2, 1, 1] })], "a")[0].level, "act");
    assert.deepEqual(Q.flags([rec({ phq: [1, 1], gad: [1, 1] })], "a"), []);
  });
  it("stress and loneliness are compared with their own last answer", () => {
    const list = [rec({ phq: [0, 0], gad: [0, 0], pss: [1, 3, 3, 1], ucla: [1, 1, 1] }, day("01T08:00:00")), rec({ phq: [0, 0], gad: [0, 0], pss: [3, 1, 1, 3], ucla: [2, 2, 1] }, day("15T08:00:00"))];
    const f = Q.flags(list, "a").map((x) => x.text);
    assert.ok(f.some((t) => t.startsWith("Stress (PSS-4) up from 4 to 12")));
    assert.ok(f.some((t) => t.startsWith("Loneliness (UCLA-3) up from 3 to 5")));
  });
});

describe("when a check-in is due", () => {
  it("every 14 days, stress and loneliness every 28, and whenever the ground asks", () => {
    const list = [Q.makeCheckin({ member: "a", answers: { phq: [0, 0], gad: [0, 0], pss: [0, 4, 4, 0], ucla: [1, 1, 1] }, at: day("01T08:00:00") })];
    assert.equal(Q.due(list, [], "a", day("10T08:00:00")).due, false);
    assert.deepEqual([Q.due(list, [], "a", day("15T08:00:00")).due, Q.due(list, [], "a", day("15T08:00:00")).extra], [true, false]);
    assert.equal(Q.due(list, [{ member: "a", at: "2026-11-05T08:00:00Z" }], "a", day("06T08:00:00")).asked, true);
    assert.equal(Q.due([], [], "a", day("06T08:00:00")).extra, true);
  });
});

describe("questionnaire wording and sources", () => {
  it("quotes only sentences that are in docs/SOURCES.md, with their links", () => {
    const src = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
    for (const [k, f] of Object.entries(SCREEN_FACTS)) {
      assert.ok(src.includes(f.quote), `quote not in SOURCES.md: ${k}`);
      assert.ok(src.includes(f.url), `link not in SOURCES.md: ${k}`);
    }
    for (const t of [...PHQ9_ITEMS, ...GAD7_ITEMS]) assert.ok(src.includes(t), `item not in SOURCES.md: ${t}`);
  });
  it("the demo has a positive GAD-2 for Arjun with its GAD-7, and Tomás is due", () => {
    const d = buildDemo(new Date());
    const arjun = DEMO_CREW.find((m) => m.name.startsWith("Arjun")).id;
    const f = Q.flags(d.checkins, arjun);
    assert.ok(f.some((x) => x.text.startsWith("GAD-7 11")));
    assert.equal(Q.due(d.checkins, [], DEMO_CREW[1].id).due, true);
  });
});
