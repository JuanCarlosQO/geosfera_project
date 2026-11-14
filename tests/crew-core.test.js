import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../js/crew-core.js";
import { RANGES, RADIATION_LIMITS } from "../js/data/vital-ranges.js";

const ids = (() => { let n = 0; return () => `m${++n}`; })();

describe("crew roster", () => {
  it("adds members with a valid name and role, the first becomes active", () => {
    let crew = { members: [], active: null };
    const a = C.makeMember(crew, { name: "  Ana   Ruiz ", role: "Commander" }, ids);
    assert.equal(a.ok, true);
    assert.equal(a.member.name, "Ana Ruiz");
    crew = C.addMember(crew, a.member);
    assert.equal(crew.active, a.member.id);
    crew = C.addMember(crew, C.makeMember(crew, { name: "Luis Gómez", role: "Pilot" }, ids).member);
    assert.equal(crew.members.length, 2);
    assert.equal(crew.active, a.member.id);
  });
  it("rejects short names, unknown roles and duplicates", () => {
    const crew = { members: [{ id: "x", name: "Ana Ruiz", role: "Commander" }] };
    assert.equal(C.makeMember(crew, { name: "A", role: "Pilot" }).ok, false);
    assert.equal(C.makeMember(crew, { name: "Bo Li", role: "Captain" }).ok, false);
    assert.equal(C.makeMember(crew, { name: "ana ruiz", role: "Pilot" }).ok, false);
  });
  it("keeps a separate log key per member and moves the active member on removal", () => {
    assert.equal(C.logKeyFor("abc"), "geosfera.log.abc");
    const crew = { members: [{ id: "a", name: "Ana", role: "Commander" }, { id: "b", name: "Bo", role: "Pilot" }], active: "a" };
    assert.equal(C.removeMember(crew, "a").active, "b");
    assert.equal(C.setActive(crew, "zzz").active, "a");
    assert.equal(C.initials("Ana María Ruiz"), "AR");
  });
});

describe("vital ranges from the team document", () => {
  it("classify blood pressure by CDC categories", () => {
    assert.equal(RANGES.bloodPressure.judge([118, 76]).status, "normal");
    assert.equal(RANGES.bloodPressure.judge([124, 78]).band, "Elevated");
    assert.equal(RANGES.bloodPressure.judge([132, 76]).band, "Stage 1");
    assert.equal(RANGES.bloodPressure.judge([142, 88]).status, "act");
  });
  it("classify the other vitals", () => {
    assert.equal(RANGES.heartRate.judge(64).status, "normal");
    assert.equal(RANGES.heartRate.judge(104).status, "watch");
    assert.equal(RANGES.temperature.judge(38.2).status, "act");
    assert.equal(RANGES.bloodOxygen.judge(98).status, "normal");
    assert.equal(RANGES.bloodOxygen.judge(87).status, "act");
    assert.equal(RANGES.glucose.judge(110).status, "watch");
    assert.equal(RANGES.sleepHours.judge(6.2).status, "watch");
  });
  it("link only to sources listed in docs/SOURCES.md", () => {
    const src = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
    for (const [k, r] of Object.entries(RANGES)) assert.ok(src.includes(r.url), k);
    assert.ok(src.includes("less than 600 mSv"));
    assert.equal(RADIATION_LIMITS.careerMSv, 600);
  });
});
