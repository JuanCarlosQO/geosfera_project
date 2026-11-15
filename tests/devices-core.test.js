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
    assert.ok(a.some((e) => e.kind === "off") && a.every((e) => e.src === "simulated"));
    const early = D.simulateNight("2026-11-15", { member: "v1", hours: 7, now: new Date(s.wake) });
    assert.ok(early.every((e) => new Date(e.at) <= new Date(s.wake)) && !early.some((e) => e.kind === "off"));
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
