import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as M from "../js/mind-core.js";
import { ZONES } from "../js/brain-core.js";
import { KIT } from "../js/data/med-kit.js";
import { makeAlert } from "../js/support-core.js";
import { makeMessage, receive, setState, setFeel, setPaused } from "../js/family-core.js";

const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
const TODAY = "2026-11-15";
const NOW = new Date("2026-11-15T12:00:00Z");
const me = { id: "a", name: "Ana", role: "Commander" };
const day = (n) => { const d = new Date(2026, 10, 15 - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const logOf = (fn, days = 18) => Object.fromEntries(Array.from({ length: days }, (_, i) => [day(i), fn(i)]));
const steady = logOf(() => ({ sleepHours: { value: 7.5 }, mood: { value: 4 } }));
const by = (list) => Object.fromEntries(list.map((s) => [s.id, s]));
const run = (extra = {}) => by(M.mindSignals({ log: steady, today: TODAY, kit: KIT, me, now: NOW, ...extra }));

describe("mind map signals", () => {
  it("gives the five signals, each on zones the brain drawing has", () => {
    const list = M.mindSignals({ log: steady, today: TODAY, kit: KIT, me, now: NOW });
    assert.deepEqual(list.map((s) => s.id), ["sleep", "mood", "alert", "home", "support"]);
    for (const s of list) for (const z of s.zones) assert.ok(ZONES.includes(z), `${s.id} uses an unknown zone ${z}`);
    assert.deepEqual(Object.keys(M.zoneStatus(list)).sort(), [...ZONES].sort(), "every zone of the brain belongs to a signal");
  });
  it("reads a steady day as nothing standing out", () => {
    const s = run();
    assert.deepEqual([s.sleep.status, s.mood.status, s.alert.status, s.home.status, s.support.status], ["normal", "normal", "normal", "normal", "normal"]);
    assert.equal(M.overall(Object.values(s)).status, "normal");
    assert.equal(s.sleep.usual, 7.5);
  });
  it("flags sleep under seven hours with the same reference as the readings table", () => {
    const s = run({ log: { ...steady, [TODAY]: { sleepHours: { value: 5.3 }, mood: { value: 4 } } } });
    assert.equal(s.sleep.status, "watch");
    assert.equal(s.sleep.basis, "ref");
    assert.equal(s.sleep.value, "5.3 h");
  });
  it("does not judge what is not logged or is marked to measure again", () => {
    const s = run({ log: { [TODAY]: { sleepHours: { value: 3, flag: "again" } } } });
    assert.equal(s.sleep.status, "again");
    assert.equal(s.mood.status, "none");
    assert.equal(s.mood.usual, null, "no usual without enough days");
    assert.equal(M.overall(Object.values(s)).status, "none");
  });
  it("flags a low mood, and a mood under the member's own usual", () => {
    assert.equal(run({ log: { ...steady, [TODAY]: { mood: { value: 2 } } } }).mood.status, "watch");
    const drop = logOf((i) => ({ mood: { value: i < 3 ? 3 : 4.5 } }));
    const s = run({ log: drop });
    assert.equal(s.mood.status, "watch");
    assert.match(s.mood.text, /your own usual \(4\.5\)/);
    assert.equal(s.mood.basis, "app");
  });
  it("flags a logged medication NASA cautions about, inside its window", () => {
    const med = KIT.find((k) => k.performance);
    const s = run({ doses: [{ id: "d1", medId: med.id, at: new Date(NOW.getTime() - 2 * 3600000).toISOString(), units: 1 }] });
    assert.equal(s.alert.status, "watch");
    assert.equal(s.alert.value, med.name);
    assert.equal(run({ doses: [{ id: "d1", medId: med.id, at: new Date(NOW.getTime() - 40 * 3600000).toISOString(), units: 1 }] }).alert.status, "normal");
  });
  it("follows the family channel: sealed, paused, and two reads in a row that hurt", () => {
    const msg = (n) => makeMessage({ to: "Ana", from: "Dad", rel: "Parent", kind: "hello", text: `Hello ${n}`, at: new Date(NOW.getTime() - n * 3600000) }).message;
    let box = receive({}, "a", msg(1), NOW).box;
    box = receive(box, "a", msg(2), NOW).box;
    assert.equal(run({ box }).home.value, "2 sealed");
    assert.equal(run({ box: setPaused(box, "a", true) }).home.status, "none");
    for (const m of box.a) { box = setState(box, "a", m.id, "open", NOW); box = setFeel(box, "a", m.id, "worse"); }
    assert.equal(run({ box }).home.status, "watch");
  });
  it("shows the member's own open request, an SOS above all", () => {
    const talk = makeAlert({ level: "talk", member: me, at: NOW, id: "t" }).alert;
    const sos = makeAlert({ level: "emergency", member: me, at: NOW, id: "s" }).alert;
    const other = makeAlert({ level: "emergency", member: { id: "b", name: "Ben" }, at: NOW, id: "o" }).alert;
    assert.equal(run({ alerts: [other] }).support.status, "normal", "a crewmate's alert is not mine");
    assert.equal(run({ alerts: [talk] }).support.status, "watch");
    const s = run({ alerts: [talk, sos] });
    assert.equal(s.support.status, "act");
    const all = M.overall(Object.values(s));
    assert.equal(all.status, "act");
    assert.equal(M.firstSignal(Object.values(s)), "support");
  });
  it("names what to look at, never a score", () => {
    const s = run({ log: { ...steady, [TODAY]: { sleepHours: { value: 5 }, mood: { value: 2 } } } });
    const all = M.overall(Object.values(s));
    assert.equal(all.title, "2 signals to look at: sleep, mood");
    assert.doesNotMatch(all.title, /\d+\s*%|score/i);
  });
  it("is documented in docs/SOURCES.md as an illustration with app rules", () => {
    assert.match(sources, /Mind map/);
    assert.match(sources, /not a scan/i);
  });
});
