import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as A from "../js/access-core.js";
import { DEMO_CREW, DEMO_CODES } from "../js/demo-core.js";

describe("one code per crew member", () => {
  const rec = { salt: "s", hash: "h", rounds: 1 };
  it("gives an older device's single code to the member who was active", () => {
    const s = A.migrateAccess({ record: rec, misses: { misses: 2, until: 0 } }, "v1");
    assert.deepEqual(s, { v: 2, members: { v1: { record: rec, misses: { misses: 2, until: 0 } } } });
    assert.deepEqual(A.migrateAccess({ record: rec }, null).members[A.DEVICE_ID].record, rec);
    assert.deepEqual(A.migrateAccess(null), { v: 2, members: {} });
    assert.deepEqual(A.migrateAccess(s, "other"), s, "already per member: left as it is");
  });
  it("keeps each member's code apart", () => {
    let s = A.withAccess(A.migrateAccess(null), "v1", { record: rec });
    s = A.withAccess(s, "t1", { record: { ...rec, hash: "x" } });
    assert.equal(A.accessFor(s, "v1").record.hash, "h");
    assert.equal(A.accessFor(s, "t1").record.hash, "x");
    assert.deepEqual(A.accessFor(s, "nobody"), {});
    assert.deepEqual(Object.keys(A.withoutAccess(s, "v1").members), ["t1"]);
  });
  it("gives each demo profile its own code, shown for the judges, and none easy to guess", async () => {
    assert.equal(DEMO_CREW.length, 4);
    assert.deepEqual(DEMO_CREW.map((m) => m.body).sort(), ["f", "f", "m", "m"]);
    const codes = DEMO_CREW.map((m) => DEMO_CODES[m.id]);
    assert.equal(new Set(codes).size, 4);
    for (const c of codes) { assert.ok(A.codeShapeOk(c)); assert.equal(A.guessable(c), false, c); }
    const r = await A.deriveRecord(codes[0], { rounds: 1000 });
    assert.equal(await A.matches(codes[0], r), true);
    assert.equal(await A.matches(codes[1], r), false, "one profile's code does not open the other");
  });
});
