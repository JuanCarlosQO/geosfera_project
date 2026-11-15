// What a crew member can see, their requests and codes, the emergency code, the drill, the clocks
// and the Excel export.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as H from "../js/share-core.js";
import * as R from "../js/role-core.js";
import * as D from "../js/drill-core.js";
import * as K from "../js/clock-core.js";
import * as E from "../js/export-core.js";
import { buildDemo, DEMO_CREW, DEMO_EMERGENCY_CODE } from "../js/demo-core.js";

const T = (s) => new Date(`2026-11-15T${s}Z`);

describe("standing sharing", () => {
  it("keeps only known items, in a fixed order, and removes a member with nothing shared", () => {
    let s = H.setShared({}, "a", ["live", "sleepHours", "nope", "sleepHours"], T("10:00:00"));
    assert.deepEqual(s.a.items, ["sleepHours", "live"]);
    s = H.setShared(s, "a", []);
    assert.equal(s.a, undefined);
  });
});

describe("requests and codes", () => {
  const ask = () => H.requestAccess([], { member: "a", items: ["heartRate", "today"], reason: "  check  ", now: T("08:00:00") });
  it("a request needs at least one known item", () => {
    assert.equal(H.requestAccess([], { member: "a", items: ["x"] }).request, null);
    const { list, request } = ask();
    assert.equal(request.status, "pending");
    assert.equal(request.reason, "check");
    assert.equal(H.pendingFor(list, "a").length, 1);
  });
  it("declining gives no code and no access", () => {
    const { list, request } = ask();
    const d = H.decide(list, request.id, { approve: false, note: "Later today", now: T("08:05:00") });
    assert.equal(d[0].status, "declined");
    assert.equal(d[0].code, undefined);
    assert.deepEqual(H.grantedItems({}, d, "a", T("08:06:00")), []);
  });
  it("an approved code opens the items for the time approved, once, and only for that member", () => {
    const { list, request } = ask();
    const ap = H.decide(list, request.id, { approve: true, minutes: 60, code: "123456", now: T("08:05:00") });
    assert.equal(ap[0].status, "approved");
    assert.equal(H.useCode(ap, "b", "123456", T("08:10:00")).ok, false); // someone else
    assert.equal(H.useCode(ap, "a", "654321", T("08:10:00")).ok, false); // wrong code
    const used = H.useCode(ap, "a", "123 456", T("08:10:00"));
    assert.equal(used.ok, true);
    assert.equal(H.useCode(used.list, "a", "123456", T("08:11:00")).ok, false); // one time only
    assert.deepEqual(H.grantedItems({}, used.list, "a", T("08:30:00")), ["heartRate", "today"]);
    assert.deepEqual(H.grantedRoutes(H.grantedItems({}, used.list, "a", T("08:30:00"))), ["today"]);
    assert.equal(H.minutesLeft(used.list[0], T("09:00:00")), 10);
    assert.deepEqual(H.grantedItems({}, used.list, "a", T("09:10:01")), []); // the hour is over
  });
  it("an unknown duration falls back to one hour", () => {
    const { list, request } = ask();
    assert.equal(H.decide(list, request.id, { approve: true, minutes: 5 })[0].minutes, 60);
  });
  it("codes are six digits", () => {
    assert.match(H.newCode(), /^\d{6}$/);
    assert.equal(H.newCode(() => 0.99), "999999");
  });
  it("standing sharing and opened requests add up", () => {
    const s = H.setShared({}, "a", ["mood"]);
    const { list, request } = ask();
    const used = H.useCode(H.decide(list, request.id, { approve: true, code: "111111" }), "a", "111111", T("08:10:00")).list;
    assert.deepEqual(H.grantedItems(s, used, "a", T("08:20:00")), ["heartRate", "mood", "today"]);
  });
});

describe("emergency code and screens", () => {
  it("matches the mission's six-digit code, spaces ignored", () => {
    assert.equal(R.checkEmergencyCode({ emergencyCode: "246810" }, "246 810"), true);
    assert.equal(R.checkEmergencyCode({ emergencyCode: "246810" }, "246811"), false);
    assert.equal(R.checkEmergencyCode({}, ""), false);
    assert.match(R.newEmergencyCode(), /^\d{6}$/);
  });
  it("a crew member opens a shared screen, and never the ground's", () => {
    const crew = R.signIn("crew");
    assert.equal(R.canSee(crew, "live"), false);
    assert.equal(R.canSee(crew, "live", new Date(), ["live"]), true);
    assert.equal(R.canSee(crew, "ground", new Date(), ["ground"]), false);
    assert.equal(R.canSee(crew, "drill"), true);
  });
  it("a drill opening keeps its flag", () => {
    const l = R.addOpening([], { member: "a", reason: "cpr", drill: true, by: "b", at: T("09:00:00") });
    assert.deepEqual(R.cleanOpenings(l)[0], { member: "a", reason: "cpr", at: "2026-11-15T09:00:00.000Z", drill: true, by: "b" });
  });
  it("the demo mission has the emergency code, a shared item and a pending request", () => {
    const d = buildDemo(T("12:00:00"));
    assert.equal(d.mission.emergencyCode, DEMO_EMERGENCY_CODE);
    assert.deepEqual(H.cleanSharing(d.sharing)[DEMO_CREW[0].id].items, ["sleepHours", "mood"]);
    assert.equal(H.cleanRequests(d.requests)[0].status, "pending");
  });
});

describe("drill", () => {
  it("goes alarm, open, ended and times it", () => {
    let { list, drill } = D.startDrill([], { patient: "a", responder: "b", now: T("10:00:00") });
    assert.equal(D.stepOf(drill), "alarm");
    list = D.wrongCode(list, drill.id);
    list = D.opened(list, drill.id, T("10:00:47"));
    assert.equal(D.stepOf(list[0]), "open");
    list = D.endDrill(list, drill.id, "pulse", T("10:03:00"));
    assert.deepEqual(D.timings(list[0]), { toOpen: 47, total: 180, wrongCodes: 1 });
    assert.equal(D.clockOf(47), "00:47");
    assert.equal(list[0].outcome, "pulse");
  });
});

describe("clocks", () => {
  it("UTC, Houston and Florida, with daylight saving", () => {
    const winter = K.clocks(new Date("2026-01-15T15:30:00Z"));
    assert.deepEqual(winter.map((c) => [c.time, c.offset]), [["15:30", 0], ["09:30", -6], ["10:30", -5]]);
    const summer = K.clocks(new Date("2026-07-15T15:30:00Z"));
    assert.deepEqual(summer.map((c) => [c.time, c.offset]), [["15:30", 0], ["10:30", -5], ["11:30", -4]]);
    assert.equal(K.abbr(new Date("2026-07-15T15:30:00Z"), "America/Chicago"), "CDT");
  });
  it("a stamp shows the date when Texas is still on the day before", () => {
    assert.equal(K.stamp("2026-11-15T02:05:00Z"), "02:05 UTC · 20:05 (11-14) Houston CST · 21:05 (11-14) Florida EST");
    assert.equal(K.hm("2026-11-15T00:00:09Z", "UTC", true), "00:00:09");
  });
});

describe("Excel export", () => {
  const demo = buildDemo(new Date("2026-11-15T12:00:00"));
  const data = { members: demo.crew.members, logs: demo.logs, doses: demo.meds.doses, kit: [], exercise: demo.exercise, requests: demo.requests, openings: demo.openings, drills: [] };
  it("filters by dates (both ends included) and by crew member", () => {
    assert.equal(E.inRange("2026-11-10", "2026-11-10", "2026-11-12"), true);
    assert.equal(E.inRange("2026-11-13T00:10:00Z", "2026-11-10", "2026-11-12"), false);
    assert.equal(E.inRange("2026-11-01", "", ""), true);
    const all = E.buildSheets(data, {});
    const some = E.buildSheets(data, { from: "2026-11-14", to: "2026-11-15", members: [DEMO_CREW[0].id] });
    const readings = (s) => s.find((x) => x.name === "Readings").rows;
    assert.ok(readings(all).length > readings(some).length);
    assert.ok(readings(some).every((r) => r[0] >= "2026-11-14" && r[1] === DEMO_CREW[0].name));
    assert.ok(readings(some).length >= 1 && readings(some).length <= 2);
    assert.equal(all.length, 7);
  });
  it("names columns and sheets the way Excel accepts", () => {
    assert.equal(E.colName(0), "A");
    assert.equal(E.colName(25), "Z");
    assert.equal(E.colName(26), "AA");
    assert.equal(E.sheetName("Data/access: [x]?"), "Data access   x  ");
  });
  it("writes a valid ZIP whose parts read back with their CRC", () => {
    const bytes = E.xlsx(E.buildSheets(data, {}), { created: new Date("2026-11-15T12:00:00Z") });
    const buf = Buffer.from(bytes);
    assert.equal(buf.readUInt32LE(0), 0x04034b50);
    const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const count = buf.readUInt16LE(end + 10);
    assert.equal(count, 6 + 7); // 6 package parts + 7 sheets
    let p = 0;
    const names = [];
    for (let i = 0; i < count; i += 1) {
      assert.equal(buf.readUInt32LE(p), 0x04034b50);
      const crc = buf.readUInt32LE(p + 14), size = buf.readUInt32LE(p + 18), n = buf.readUInt16LE(p + 26);
      const name = buf.subarray(p + 30, p + 30 + n).toString();
      const data2 = buf.subarray(p + 30 + n, p + 30 + n + size);
      assert.equal(E.crc32(data2), crc, name);
      names.push(name);
      p += 30 + n + size;
    }
    assert.ok(names.includes("xl/workbook.xml") && names.includes("xl/worksheets/sheet6.xml"));
  });
  it("escapes text so a note cannot break the sheet", () => {
    const parts = E.workbookParts([{ name: "Readings", columns: ["Note"], rows: [["a < b & \"c\""]] }]);
    const sheet = parts.find((x) => x.name === "xl/worksheets/sheet1.xml").text;
    assert.ok(sheet.includes("a &lt; b &amp; &quot;c&quot;"));
  });
  it("names the file after the dates", () => {
    assert.equal(E.fileName("2026-11-01", "2026-11-15", "2026-11-15"), "ergosphere-2026-11-01-to-2026-11-15.xlsx");
  });
});
