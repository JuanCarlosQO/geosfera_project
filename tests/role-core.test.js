import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as R from "../js/role-core.js";
import { LOCAL_ONLY } from "../js/sync-core.js";

const now = new Date("2026-11-15T08:00:00Z");

describe("who is looking", () => {
  it("the ground team opens every reading but not the crew member's home or family messages", () => {
    const g = R.signIn("ground");
    for (const r of ["ground", "today", "log", "live", "body", "meds", "devices", "mission"]) assert.ok(R.canSee(g, r, now), r);
    assert.equal(R.canSee(g, "crew", now), false);
    assert.equal(R.canSee(g, "family", now), false);
    assert.equal(R.homeFor(g), "ground");
  });

  it("a crew member's own screens show no readings", () => {
    const c = R.signIn("crew");
    for (const r of ["crew", "meds", "family"]) assert.ok(R.canSee(c, r, now), r);
    for (const r of ["today", "log", "live", "body", "devices", "mind", "duty", "ground"]) assert.equal(R.canSee(c, r, now), false, r);
    assert.equal(R.homeFor(c), "crew");
  });

  it("an emergency opens the crew member's data for an hour, then hides it again", () => {
    const c = R.startEmergency(R.signIn("crew"), "medical", "demo-vreyes", now);
    assert.ok(R.inEmergency(c, now));
    assert.equal(R.emergencyLeft(c, now), R.EMERGENCY_MIN);
    assert.ok(R.canSee(c, "today", now) && R.canSee(c, "live", now));
    assert.equal(R.canSee(c, "ground", now), false);
    const later = new Date(now.getTime() + (R.EMERGENCY_MIN + 1) * 60000);
    assert.equal(R.inEmergency(c, later), false);
    assert.equal(R.canSee(c, "today", later), false);
    assert.equal(R.inEmergency(R.endEmergency(c), now), false);
  });

  it("only a crew member, and only for a known reason, can open an emergency", () => {
    const g = R.signIn("ground");
    assert.equal(R.startEmergency(g, "medical", "x", now), g);
    const c = R.signIn("crew");
    assert.equal(R.startEmergency(c, "curious", "x", now), c);
  });

  it("keeps every opening for the ground, newest first, and drops malformed ones", () => {
    let list = R.addOpening([], { member: "a", reason: "los", at: now });
    list = R.addOpening(list, { member: "b", reason: "alarm", at: new Date(now.getTime() + 1000) });
    list = R.addOpening(list, { member: "", reason: "los" });
    assert.equal(list.length, 2);
    assert.equal(list[0].member, "b");
    assert.deepEqual(R.openingsFor(list, "a").map((o) => o.reason), ["los"]);
    assert.equal(R.cleanOpenings([{ member: "a", reason: "nope", at: now }, null]).length, 0);
    assert.equal(R.reasonLabel("los"), "No contact with the ground");
    const closed = R.closeOpening(list, "a", new Date(now.getTime() + 5 * 60000));
    assert.ok(closed.find((o) => o.member === "a").closedAt);
    assert.equal(R.openNow(closed.find((o) => o.member === "a"), now), false);
    assert.equal(R.openNow(closed.find((o) => o.member === "b"), now), true);
    assert.equal(R.openNow(list[0], new Date(now.getTime() + 2 * 3600000)), false);
  });

  it("cleans what it reads back and keeps the sign-in on this device only", () => {
    assert.deepEqual(R.cleanRole({ role: "admin" }), { role: null, emergency: null });
    assert.equal(R.cleanRole({ role: "ground", emergency: { at: now, until: now, reason: "medical" } }).emergency, null);
    assert.ok(R.canSee(R.cleanRole(null), "today", now)); // no crew yet: the app is open, as before
    assert.ok(LOCAL_ONLY.includes(R.ROLE_KEY));
    assert.equal(LOCAL_ONLY.includes(R.OPENINGS_KEY), false); // the ground must see the openings
  });
});
