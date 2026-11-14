import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as P from "../js/support-core.js";
import { SUPPORT_FACTS, REASONS, LEVELS, COMFORT } from "../js/data/support.js";

const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
const NOW = new Date("2026-11-15T12:00:00Z");
const ago = (h) => new Date(NOW.getTime() - h * 3600000);
const ana = { id: "a", name: "Ana", role: "Commander" };
const ben = { id: "b", name: "Ben", role: "Pilot" };
const send = (level, member, h = 0, extra = {}) => P.makeAlert({ level, member, at: ago(h), id: `${member.id}-${level}-${h}`, ...extra }).alert;

describe("support alerts", () => {
  it("builds an alert with who, what and when", () => {
    const r = P.makeAlert({ level: "emergency", member: ana, reasons: ["anxious", "anxious", "sleep"], note: "  hard night  ", at: NOW, id: "x" });
    assert.deepEqual(r.alert, { id: "x", at: NOW.toISOString(), level: "emergency", from: ana, reasons: ["anxious", "sleep"], note: "hard night", acks: [], closed: null });
    assert.equal(P.makeAlert({ level: "maybe", member: ana }).ok, false);
  });
  it("shows a crewmate's open alerts to everyone else, emergencies first", () => {
    const list = [send("talk", ana, 1), send("emergency", ana, 2), send("talk", ben, 0.5)];
    assert.deepEqual(P.forMe(list, ben, NOW).map((a) => a.id), ["a-emergency-2", "a-talk-1"]);
    assert.deepEqual(P.mine(list, ben).map((a) => a.id), ["b-talk-0.5"]);
  });
  it("stops showing an alert once I answered, it closed, or it is old", () => {
    let list = [send("emergency", ana, 1), send("talk", ana, 20)];
    list = P.acknowledge(list, "a-emergency-1", ben, "coming", NOW);
    assert.deepEqual(P.forMe(list, ben, NOW), []);
    assert.equal(list[0].acks[0].name, "Ben");
    assert.equal(P.acknowledge(list, "a-emergency-1", ben).at(0).acks.length, 1, "one answer per person");
    assert.equal(P.forMe(P.closeAlert([send("talk", ana, 1)], "a-talk-1", NOW), ben, NOW).length, 0);
  });
  it("keeps the last 50 and drops broken data from a station", () => {
    let list = [];
    for (let i = 0; i < 60; i += 1) list = P.addAlert(list, send("talk", ana, i));
    assert.equal(list.length, P.KEEP);
    assert.equal(P.cleanAlerts([...list.slice(0, 2), { id: 1 }, { id: "z", level: "x", at: NOW, from: {}, acks: [] }, null]).length, 2);
  });
  it("says how long ago", () => {
    assert.equal(P.ago(NOW, NOW), "just now");
    assert.equal(P.ago(ago(0.5), NOW), "30 min ago");
    assert.equal(P.ago(ago(2.25), NOW), "2 h 15 min ago");
  });
});

describe("SOS: one gesture, details and undo after", () => {
  it("adds reasons and a note after sending, without duplicates", () => {
    let list = [send("emergency", ana, 0)];
    list = P.addDetails(list, "a-emergency-0", { reasons: ["anxious", "anxious"], note: " node 2 " });
    list = P.addDetails(list, "a-emergency-0", { reasons: ["sleep"] });
    assert.deepEqual(list[0].reasons, ["anxious", "sleep"]);
    assert.equal(list[0].note, "node 2");
  });
  it("can be closed as sent by mistake, and then nobody is asked to come", () => {
    const list = P.closeAlert([send("emergency", ana, 0)], "a-emergency-0", NOW, "mistake");
    assert.equal(list[0].closedWhy, "mistake");
    assert.deepEqual(P.forMe(list, ben, NOW), []);
    assert.ok(P.HOLD_MS >= 1500 && P.UNDO_S > 0);
  });
});

describe("mind trend and comfort", () => {
  it("reads mood and sleep from the daily log", () => {
    const t = P.mindTrend({ "2026-11-15": { mood: { value: 2 }, sleepHours: { value: 5.5 } }, "2026-11-13": { mood: { value: 4 } } }, "2026-11-15", 3);
    assert.deepEqual(t, [{ day: "2026-11-13", mood: 4, sleep: null }, { day: "2026-11-14", mood: null, sleep: null }, { day: "2026-11-15", mood: 2, sleep: 5.5 }]);
  });
  it("keeps comfort settings to three switches", () => {
    assert.deepEqual(P.cleanComfort({ calm: 1, large: true, x: true }), { calm: true, large: true, focus: false });
    assert.deepEqual(COMFORT.map((c) => c.id), ["calm", "large", "focus"]);
  });
});

describe("support words are verified", () => {
  it("shows only NASA words quoted in docs/SOURCES.md", () => {
    for (const [k, f] of Object.entries(SUPPORT_FACTS)) {
      assert.ok(sources.includes(f.quote), `not in SOURCES.md: ${k}`);
      assert.ok(sources.includes(f.url), `link not in SOURCES.md: ${k}`);
    }
    assert.ok(REASONS.length >= 6 && LEVELS.talk && LEVELS.emergency);
  });
});
