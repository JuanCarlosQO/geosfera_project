import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as D from "../js/devices-core.js";

const at = (s) => new Date(s).toISOString();

describe("Bluetooth health sensors (Bluetooth SIG formats)", () => {
  it("reads IEEE 11073 SFLOAT and FLOAT, and their special values", () => {
    assert.equal(D.sfloat(0x0078), 120);
    assert.equal(D.sfloat(0xf2d5), 72.5);
    assert.equal(D.sfloat(0x07ff), null, "NaN");
    assert.equal(D.sfloat(0x0800), null, "NRes");
    assert.equal(D.float32(0xff00016e), 36.6);
    assert.equal(D.float32(0x007fffff), null, "NaN");
  });
  it("reads a heart-rate strap: 8 or 16 bit, contact, RR intervals", () => {
    assert.deepEqual(D.parseHeartRate(new Uint8Array([0x00, 72])), { bpm: 72, contact: null, rr: [] });
    assert.deepEqual(D.parseHeartRate(new Uint8Array([0x17, 0x48, 0x00, 0x00, 0x04, 0x00, 0x02])), { bpm: 72, contact: true, rr: [1000, 500] });
    assert.equal(D.parseHeartRate(new Uint8Array([0x04, 61])).contact, false);
    assert.equal(D.parseHeartRate(new Uint8Array([0x08, 66, 0x10, 0x00])).bpm, 66, "skips energy expended");
    assert.equal(D.parseHeartRate(new Uint8Array([0x00])), null);
  });
  it("reads a blood-pressure cuff, in mmHg or kPa, with or without a time stamp", () => {
    assert.deepEqual(D.parseBloodPressure(new Uint8Array([0x04, 0x78, 0, 0x50, 0, 0x5a, 0, 0x48, 0])), { systolic: 120, diastolic: 80, pulse: 72 });
    const withTime = [0x06, 0x76, 0, 0x4c, 0, 0x58, 0, 0xea, 0x07, 11, 15, 7, 30, 0, 0x40, 0];
    assert.deepEqual(D.parseBloodPressure(new Uint8Array(withTime)), { systolic: 118, diastolic: 76, pulse: 64 });
    assert.deepEqual(D.parseBloodPressure(new Uint8Array([0x01, 0x10, 0, 0x0b, 0, 0x0d, 0])), { systolic: 120, diastolic: 83, pulse: null });
    assert.equal(D.parseBloodPressure(new Uint8Array([0x00, 0xff, 0x07, 0x50, 0, 0, 0])), null, "a failed measurement");
  });
  it("reads a thermometer (°C or °F) and a pulse oximeter", () => {
    assert.deepEqual(D.parseTemperature(new Uint8Array([0x00, 0x6e, 0x01, 0x00, 0xff])), { celsius: 36.6 });
    assert.deepEqual(D.parseTemperature(new Uint8Array([0x01, 0xda, 0x03, 0x00, 0xff])), { celsius: 37 });
    assert.deepEqual(D.parsePlx(new Uint8Array([0x00, 0x62, 0, 0x48, 0])), { spo2: 98, pulse: 72 });
  });
  it("turns readings into log values only when they are possible", () => {
    assert.equal(D.bleValue("hr", { bpm: 64 }), 64);
    assert.equal(D.bleValue("hr", { bpm: 300 }), null);
    assert.deepEqual(D.bleValue("bp", { systolic: 118, diastolic: 76 }), [118, 76]);
    assert.equal(D.bleValue("bp", { systolic: 70, diastolic: 76 }), null);
    assert.equal(D.bleValue("spo2", { spo2: 97 }), 97);
    assert.equal(D.restingFrom([70, 64, 63, 90, 62], 5), 64);
    assert.equal(D.restingFrom([70, 64], 5), null);
    assert.deepEqual(D.BLE.map((b) => b.service), [0x180d, 0x1810, 0x1809, 0x1822]);
  });
});

describe("the watch: when it was off, asleep, awake", () => {
  const night = [
    { kind: "asleep", at: at("2026-11-13T22:41:00") },
    { kind: "awake", at: at("2026-11-14T02:10:00"), until: at("2026-11-14T02:16:00") },
    { kind: "awake", at: at("2026-11-14T04:00:00"), until: at("2026-11-14T04:10:00") },
    { kind: "wake", at: at("2026-11-14T06:12:00") },
    { kind: "off", at: at("2026-11-14T07:30:00"), until: at("2026-11-14T07:52:00") },
    { kind: "on", at: at("2026-11-14T07:52:00") }
  ];
  it("sums up a night: asleep, awakenings, woke up, time off the wrist", () => {
    const s = D.nightSummary(night, "2026-11-14");
    assert.equal(s.asleep, night[0].at);
    assert.equal(s.wake, night[3].at);
    assert.equal(s.awakenings, 2);
    assert.equal(s.awakeMin, 16);
    assert.equal(s.sleepHours, 7.3, "7 h 31 min in bed minus 16 min awake");
    assert.equal(s.efficiency, 96);
    assert.equal(s.offMin, 22);
    assert.equal(D.nightSummary(night, "2026-11-15"), null, "no sleep recorded that night");
  });
  it("knows when the watch is off right now, and when it has been off too long", () => {
    const ev = [...night.slice(0, 4), { kind: "off", at: at("2026-11-14T07:30:00") }];
    assert.deepEqual(D.offNow(ev, new Date("2026-11-14T08:00:00")), { since: ev[4].at, minutes: 30, remind: false, eva: false });
    assert.equal(D.offNow(ev, new Date("2026-11-14T08:45:00")).remind, true);
    assert.equal(D.offNow(night, new Date("2026-11-14T09:00:00")), null, "put back on");
  });
  it("keeps clean, sorted events for two weeks", () => {
    const list = D.addEvents([], [...night, { kind: "nonsense", at: "x" }, night[0]], new Date("2026-11-14T12:00:00"));
    assert.equal(list.length, 6);
    assert.equal(D.addEvents(list, [], new Date("2026-12-14T12:00:00")).length, 0);
  });
  it("simulates a believable night, the same every time, never in the future", () => {
    const now = new Date("2026-11-15T12:00:00");
    const a = D.simulateNight("2026-11-15", { member: "v1", hours: 7, now });
    assert.deepEqual(a, D.simulateNight("2026-11-15", { member: "v1", hours: 7, now }));
    const s = D.nightSummary(a, "2026-11-15");
    assert.ok(s.sleepHours > 4.5 && s.sleepHours < 9.5, String(s.sleepHours));
    assert.ok(s.awakenings >= 1 && s.awakenings <= 3);
    assert.ok(a.some((e) => e.kind === "off") && a.every((e) => ["simulated", "self-sim"].includes(e.src)));
    assert.ok(a.some((e) => e.kind === "bed" && e.src === "self-sim") && a.some((e) => e.kind === "up"), "the crew member's own marks");
    const early = D.simulateNight("2026-11-15", { member: "v1", hours: 7, now: new Date(s.wake) });
    assert.ok(early.every((e) => new Date(e.at) <= new Date(s.wake)) && !early.some((e) => e.kind === "off" && new Date(e.at) > new Date(s.wake)));
  });
});

describe("the file Actiware exports", () => {
  const csv = [
    "Actiware Export File", "Identity:,AW-0001", "",
    '"Interval Type","Interval#","Start Date","Start Time","End Date","End Time","Duration","Efficiency","Sleep Time"',
    "ACTIVE,1,13/11/2026,07:00:00,13/11/2026,22:30:00,930,.,.",
    "REST,1,13/11/2026,22:30:00,14/11/2026,06:20:00,470,.,.",
    "SLEEP,1,13/11/2026,22:41:00,14/11/2026,06:12:00,451,92.0,415",
    "EXCLUDED,1,14/11/2026,07:30:00,14/11/2026,07:52:00,22,.,.",
    "SLEEP,2,14/11/2026,10:41:00 PM,15/11/2026,6:05:00 AM,444,95.0,430"
  ].join("\n");
  it("finds the interval table and turns it into events and nights", () => {
    const r = D.parseActiware(csv);
    assert.equal(r.ok, true);
    assert.equal(r.rows, 5);
    assert.deepEqual(r.nights.map((n) => [n.day, n.sleepHours, n.offMin]), [["2026-11-14", 6.9, 22], ["2026-11-15", 7.2, 0]]);
    assert.ok(r.events.some((e) => e.kind === "off" && e.until));
    assert.ok(r.events.every((e) => e.src === "actiware"));
  });
  it("reads semicolon files and refuses anything else", () => {
    assert.equal(D.parseActiware(csv.replaceAll(",", ";")).ok, true);
    assert.equal(D.parseActiware("date,steps\n2026-11-14,8000").ok, false);
    assert.equal(D.parseActiware("").ok, false);
    assert.equal(D.parseStamp("2026-11-14", "06:12").getHours(), 6);
    assert.equal(D.parseStamp("14/13/2026", "06:12"), null);
  });
});

describe("into the daily log", () => {
  const now = new Date("2026-11-15T08:00:00Z");
  it("fills what a device measured and marks where it came from", () => {
    const r = D.fillDay({}, "2026-11-15", { sleepHours: 6.9, heartRate: null }, "simulated", now);
    assert.deepEqual(r.filled, ["sleepHours"]);
    assert.deepEqual(r.log["2026-11-15"].sleepHours, { value: 6.9, src: "simulated", at: now.toISOString() });
  });
  it("never replaces what the crew member typed, but updates a device's own reading", () => {
    const typed = { "2026-11-15": { sleepHours: { value: 5 } } };
    assert.deepEqual(D.fillDay(typed, "2026-11-15", { sleepHours: 6.9 }, "simulated", now).filled, []);
    const dev = { "2026-11-15": { heartRate: { value: 70, src: "bluetooth" } } };
    const r = D.fillDay(dev, "2026-11-15", { heartRate: 64 }, "bluetooth", now);
    assert.equal(r.log["2026-11-15"].heartRate.value, 64);
    assert.deepEqual(D.fillDay(r.log, "2026-11-15", { heartRate: 64 }, "bluetooth", now).filled, [], "same value, nothing to do");
  });
});

describe("a simulated night can match the log", () => {
  it("lasts exactly the hours asked for", () => {
    const ev = D.simulateNight("2026-11-10", { member: "v1", hours: 5.3, exact: true, now: new Date("2026-11-11T00:00:00") });
    assert.equal(D.nightSummary(ev, "2026-11-10").sleepHours, 5.3);
  });
});

describe("device facts are verified", () => {
  it("quotes only words that are in docs/SOURCES.md, with their link", async () => {
    const { readFileSync } = await import("node:fs");
    const { DEVICE_FACTS } = await import("../js/data/devices.js");
    const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
    for (const [id, f] of Object.entries(DEVICE_FACTS)) {
      assert.ok(sources.includes(f.quote), `not in SOURCES.md: ${id}`);
      assert.ok(sources.includes(f.url), `link not in SOURCES.md: ${id}`);
    }
  });
});

describe("a spacewalk: the watch comes off", () => {
  const t0 = new Date("2026-11-15T13:00:00");
  const later = (min) => new Date(t0.getTime() + min * 60000);
  it("takes the watch off at suit-up, with no reminder however long it lasts", () => {
    const ev = D.startEva([], t0);
    const off = D.offNow(ev, later(400));
    assert.equal(off.eva, true);
    assert.equal(off.remind, false, "6 h 40 min outside, still no reminder");
    assert.equal(D.eventLabel(ev[0]), "Watch off for the spacewalk");
    assert.deepEqual(D.startEva(ev, later(5)), ev, "starting twice changes nothing");
  });
  it("closes the off period and puts the watch back on when the crew member is back inside", () => {
    const ev = D.endEva(D.startEva([], t0), later(390));
    assert.equal(D.offNow(ev, later(395)), null);
    const off = ev.find((e) => e.kind === "off");
    assert.equal(off.until, later(390).toISOString());
    assert.equal(D.eventLabel(ev.at(-1)), "Watch back on after the spacewalk");
    assert.deepEqual(D.endEva([], later(1)), [], "no spacewalk, nothing to end");
  });
  it("an ordinary time off still gets its reminder", () => {
    assert.equal(D.offNow([{ kind: "off", at: t0.toISOString() }], later(61)).remind, true);
  });
});

describe("three layers: recorded by the watch, estimated by the app, reported by the crew member", () => {
  const T = (h, m = 0, d = 14) => new Date(2026, 10, d, h, m).toISOString();
  it("does not count the stretch with the watch off as sleep", () => {
    const ev = [
      { kind: "asleep", at: T(23, 0, 13) }, { kind: "wake", at: T(7, 0) },
      { kind: "off", at: T(2, 0), until: T(2, 30) }, { kind: "on", at: T(2, 30) }
    ];
    const s = D.nightSummary(ev, "2026-11-14");
    assert.equal(s.offInSleepMin, 30);
    assert.equal(s.sleepHours, 7.5, "8 h window minus 30 min off the wrist");
    assert.equal(s.basis, "watch");
  });
  it("closes an off period at the next 'on' even without an end time", () => {
    const ev = [{ kind: "asleep", at: T(23, 0, 13) }, { kind: "wake", at: T(7, 0) }, { kind: "off", at: T(3, 0) }, { kind: "on", at: T(3, 20), src: "self" }];
    assert.equal(D.nightSummary(ev, "2026-11-14").offInSleepMin, 20);
  });
  it("estimates the night from the crew member's own marks when the watch has none", () => {
    const ev = [{ kind: "bed", at: T(22, 30, 13), src: "self" }, { kind: "up", at: T(6, 30), src: "self" }, { kind: "off", at: T(1, 0), until: T(1, 15), src: "self" }];
    const s = D.nightSummary(ev, "2026-11-14");
    assert.equal(s.basis, "marks");
    assert.equal(s.sleepHours, 7.8, "8 h in bed minus 15 min off the wrist");
  });
  it("keeps the marks beside the watch's night, with the time it took to fall asleep", () => {
    const ev = [{ kind: "bed", at: T(22, 40, 13), src: "self" }, { kind: "asleep", at: T(23, 0, 13) }, { kind: "wake", at: T(6, 0) }, { kind: "up", at: T(6, 10), src: "self" }];
    const s = D.nightSummary(ev, "2026-11-14");
    assert.equal(s.basis, "watch");
    assert.equal(s.latencyMin, 20);
    assert.equal(s.bed, ev[0].at);
    assert.equal(s.up, ev[3].at);
    assert.equal(D.nightSummary([ev[0]], "2026-11-14"), null, "going to bed alone is not a night");
  });
  it("records the crew member's taps, and putting the watch on closes the off period", () => {
    const now = new Date(2026, 10, 14, 9, 0);
    let ev = D.selfMark([], "off", now);
    assert.deepEqual(D.selfMark(ev, "off", now), ev, "already off");
    ev = D.selfMark(ev, "on", new Date(now.getTime() + 25 * 60000));
    assert.equal(D.offNow(ev, new Date(now.getTime() + 26 * 60000)), null);
    assert.equal(ev.find((e) => e.kind === "off").until, new Date(now.getTime() + 25 * 60000).toISOString());
    assert.ok(ev.every((e) => D.isSelf(e)));
    assert.deepEqual(D.selfMark([], "on", now), [], "nothing to put back on");
    assert.equal(D.selfMark([], "bed", now)[0].kind, "bed");
  });
});

describe("Actiware's epoch-by-epoch list (columns as the Actiware manual defines them)", () => {
  // 1-minute epochs from 22:00 to 07:00: in bed (Rest) 22:30-06:40, asleep 22:50-06:30,
  // awake 02:00-02:05, watch off 03:10-03:30, button pressed at 22:30 and 06:40.
  const pad = (n) => String(n).padStart(2, "0");
  const lines = ['"Line","Date","Time","Off-Wrist Status","Activity","Marker","White Light","Sleep/Wake","Interval Status"'];
  let n = 0;
  for (let t = new Date(2026, 10, 13, 22, 0).getTime(); t < new Date(2026, 10, 14, 7, 0).getTime(); t += 60000) {
    const d = new Date(t), hm = d.getHours() * 60 + d.getMinutes();
    const inBed = hm >= 22 * 60 + 30 || hm < 6 * 60 + 40;
    const asleep = (hm >= 22 * 60 + 50 || hm < 6 * 60 + 30) && !(hm >= 120 && hm < 125);
    const off = hm >= 3 * 60 + 10 && hm < 3 * 60 + 30;
    const mark = hm === 22 * 60 + 30 || hm === 6 * 60 + 40;
    n += 1;
    lines.push([n, `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, `${pad(d.getHours())}:${pad(d.getMinutes())}:00`, off ? 1 : 0, off ? 0 : asleep ? 5 : 220, mark ? 1 : 0, inBed ? 0 : 80, off ? "NaN" : asleep ? 0 : 1, inBed ? "REST" : "ACTIVE"].join(","));
  }
  const csv = ["Actiware Export File", "Epoch-by-Epoch Data", ...lines].join("\n");
  const r = D.readActiwareFile(csv);
  it("finds the epoch table and its 1-minute epochs", () => {
    assert.equal(r.ok, true);
    assert.equal(r.kind, "epoch");
    assert.equal(r.epochSec, 60);
    assert.equal(r.rows, 540);
  });
  it("takes from the file what the watch knows: off the wrist, time in bed, sleep, awakenings, button presses", () => {
    const off = r.events.find((e) => e.kind === "off");
    assert.equal(new Date(off.at).getHours() * 60 + new Date(off.at).getMinutes(), 190);
    assert.equal((new Date(off.until) - new Date(off.at)) / 60000, 20);
    assert.ok(r.events.some((e) => e.kind === "bed" && e.src === "actiware-rest"));
    assert.equal(r.events.filter((e) => e.kind === "press").length, 2);
    const s = D.nightSummary(r.events, "2026-11-14");
    assert.equal(s.basis, "watch");
    assert.equal(new Date(s.asleep).getHours(), 22);
    assert.equal(s.awakenings, 1, "the 5-minute wake run; the off-wrist minutes are not scored");
    assert.equal(s.offInSleepMin, 20, "time off the wrist is left out");
    assert.equal(s.latencyMin, 20, "from going to bed (Rest) to falling asleep");
    assert.ok(s.sleepHours > 6.9 && s.sleepHours < 7.4, String(s.sleepHours));
  });
  it("keeps the wrist activity in 15-minute sums", () => {
    const bins = Object.values(r.activity);
    assert.equal(bins.length, 36);
    assert.ok(Math.max(...bins) > Math.min(...bins));
  });
  it("lets the file replace the crew member's taps for what it knows, and keeps how rested they felt", () => {
    const taps = [
      { kind: "bed", at: new Date(2026, 10, 13, 22, 20).toISOString(), src: "self" },
      { kind: "off", at: new Date(2026, 10, 14, 3, 12).toISOString(), until: new Date(2026, 10, 14, 3, 25).toISOString(), src: "self" },
      { kind: "rated", at: new Date(2026, 10, 14, 7, 0).toISOString(), value: 4, src: "self" }
    ];
    const merged = D.mergeFile(taps, r.events, { coverFrom: new Date(2026, 10, 13, 22).getTime(), coverTo: new Date(2026, 10, 14, 7).getTime() });
    assert.ok(!merged.some((e) => e.src === "self" && (e.kind === "bed" || e.kind === "off")));
    assert.equal(D.nightSummary(merged, "2026-11-14").rested, 4);
  });
  it("still reads the interval statistics, and says when a file is neither", () => {
    assert.equal(D.readActiwareFile('"Interval Type","Start Date","Start Time","End Date","End Time","Sleep Time"\nSLEEP,13/11/2026,23:00,14/11/2026,07:00,450').kind, "intervals");
    assert.equal(D.readActiwareFile("hello").ok, false);
  });
  it("records how rested the crew member felt, 1 to 5", () => {
    const ev = D.selfMark([], "rated", new Date(2026, 10, 14, 7, 0), 3);
    assert.equal(ev[0].value, 3);
    assert.deepEqual(D.selfMark([], "rated", new Date(), 9), []);
  });
});

describe("calibration: Actiware's sleep/wake scoring with a chosen wake threshold", () => {
  it("weighs the minute and its neighbours as the Actiware manual's example does (37.68)", () => {
    const t0 = new Date(2026, 10, 14, 11, 58).getTime();
    const rows = [100, 42, 20, 13, 67].map((ac, i) => ({ t: t0 + i * 60000, ac, off: 0, sw: null }));
    const at40 = D.scoreSleepWake(rows, 60000, 40).rows[2].sw;
    const at20 = D.scoreSleepWake(rows, 60000, 20).rows[2].sw;
    assert.equal(at40, "S", "37.68 <= 40 is sleep");
    assert.equal(at20, "W", "37.68 > 20 is wake");
    assert.deepEqual(D.WAKE_THRESHOLDS, { low: 20, medium: 40, high: 80 });
  });
  it("leaves other epoch lengths and off-wrist minutes alone", () => {
    const rows = [{ t: 0, ac: 50, off: 0, sw: "W" }, { t: 30000, ac: 50, off: 1, sw: null }];
    assert.equal(D.scoreSleepWake(rows, 30000, 80).rescored, false);
    assert.equal(D.scoreSleepWake([{ t: 0, ac: 5, off: 1, sw: "S" }], 60000, 80).rows[0].sw, null);
  });
  it("a higher threshold scores fewer minutes awake, so more sleep (a hypothesis for microgravity, not validated)", () => {
    const csv = require_sample();
    const a = D.readActiwareFile(csv, { threshold: 20 }), b = D.readActiwareFile(csv, { threshold: 80 });
    assert.equal(a.scoredBy, 20);
    assert.equal(b.scoredBy, 80);
    const sa = a.nights[0], sb = b.nights[0];
    assert.ok(sb.sleepHours >= sa.sleepHours, `${sa.sleepHours} -> ${sb.sleepHours}`);
    assert.ok(sb.awakeMin <= sa.awakeMin);
    const again = D.fromRows(D.unpackRows(a.packed), { threshold: 80 });
    assert.deepEqual(again.nights.map((n) => n.sleepHours), b.nights.map((n) => n.sleepHours), "kept rows rescore the same way");
    assert.equal(D.readActiwareFile(csv).scoredBy, "file");
  });
});
import { readFileSync as rfs } from "node:fs";
function require_sample() { return rfs(new URL("../samples/actiware-epochs-sample.csv", import.meta.url), "utf8"); }
