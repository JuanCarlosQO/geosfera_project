import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as Y from "../js/sync-core.js";
import { handle, memoryStore } from "../lib/sync-handler.js";

describe("station secrets and encryption", () => {
  it("makes readable station IDs", () => {
    const id = Y.newStationId();
    assert.ok(Y.validStationId(id), id);
    assert.equal(Y.validStationId("ERG-O0I1AB"), false);
    assert.match(id, /^ERG-/);
    assert.ok(Y.validStationId("GSF-ABCDEF"), "old IDs still work");
  });
  it("derives a token and key that differ by station and code", async () => {
    const a = await Y.deriveSecrets("orbit-crew-7", "GSF-ABCDEF", 1000);
    const b = await Y.deriveSecrets("orbit-crew-7", "GSF-ABCDEG", 1000);
    const c = await Y.deriveSecrets("orbit-crew-8", "GSF-ABCDEF", 1000);
    assert.match(a.token, /^[0-9a-f]{64}$/);
    assert.notEqual(a.token, b.token);
    assert.notEqual(a.key, c.key);
    assert.notEqual(a.token, a.key);
  });
  it("seals data so only the right code opens it", async () => {
    const good = await Y.deriveSecrets("orbit-crew-7", "GSF-ABCDEF", 1000);
    const bad = await Y.deriveSecrets("orbit-crew-x", "GSF-ABCDEF", 1000);
    const blob = await Y.seal({ hello: "crew" }, good.key);
    assert.ok(!blob.ct.includes("crew"));
    assert.deepEqual(await Y.open(blob, good.key), { hello: "crew" });
    assert.equal(await Y.open(blob, bad.key), null);
  });
});

describe("snapshots and merging", () => {
  it("keeps the access code and sync settings on the device", () => {
    const s = Y.snapshot({ "geosfera.crew-access": "x", "geosfera.sync": "y", "geosfera.crew": "{}", "crewcheck.v1": "z" }, {}, 5);
    assert.deepEqual(Object.keys(s.keys), ["geosfera.crew"]);
  });
  it("stamps only keys that changed and records deletions", () => {
    const a = Y.snapshot({ "geosfera.crew": "{}", "geosfera.meds": "[1]" }, {}, 1);
    const b = Y.snapshot({ "geosfera.crew": "{}" }, a.stamps, 9);
    assert.equal(b.stamps["geosfera.crew"].at, 1);
    assert.equal(b.stamps["geosfera.meds"].deleted, true);
  });
  it("merges member logs day by day, newest save wins", () => {
    const m = Y.mergeLog(
      { "2026-11-14": { heartRate: { value: 60 }, savedAt: "2026-11-14T10:00:00Z" }, "2026-11-13": { savedAt: "a" } },
      { "2026-11-14": { heartRate: { value: 64 }, savedAt: "2026-11-14T12:00:00Z" }, "2026-11-12": { savedAt: "b" } });
    assert.equal(m["2026-11-14"].heartRate.value, 64);
    assert.deepEqual(Object.keys(m).sort(), ["2026-11-12", "2026-11-13", "2026-11-14"]);
  });
  it("combines two devices: logs from both, newer crew list, newer deletion", () => {
    const phone = { keys: { "geosfera.log.a": JSON.stringify({ d1: { savedAt: "1" } }), "geosfera.crew": "phone" }, stamps: { "geosfera.log.a": { h: "1", at: 5 }, "geosfera.crew": { h: "p", at: 9 }, "geosfera.duty": { h: "", at: 8, deleted: true } } };
    const tablet = { keys: { "geosfera.log.a": JSON.stringify({ d2: { savedAt: "2" } }), "geosfera.crew": "tablet", "geosfera.duty": "old" }, stamps: { "geosfera.log.a": { h: "2", at: 6 }, "geosfera.crew": { h: "t", at: 3 }, "geosfera.duty": { h: "o", at: 2 } } };
    const m = Y.mergeSnapshots(phone, tablet);
    assert.deepEqual(Object.keys(JSON.parse(m.keys["geosfera.log.a"])).sort(), ["d1", "d2"]);
    assert.equal(m.keys["geosfera.crew"], "phone");
    assert.equal("geosfera.duty" in m.keys, false);
  });
});

describe("sync server", () => {
  const T = "a".repeat(64);
  const W = "b".repeat(64);
  const req = (method, extra = {}) => ({ method, query: { station: "GSF-ABCDEF" }, headers: { authorization: `Bearer ${extra.token ?? T}` }, body: extra.body });
  it("creates a station on first write and serves it back", async () => {
    const s = memoryStore();
    assert.equal((await handle(req("GET"), s)).status, 404);
    assert.equal((await handle(req("PUT", { body: { blob: { iv: "i", ct: "c" }, baseVersion: 0 } }), s)).status, 200);
    const got = await handle(req("GET"), s);
    assert.equal(got.status, 200);
    assert.equal(got.body.version, 1);
  });
  it("rejects a wrong code, a stale version and bad input", async () => {
    const s = memoryStore();
    await handle(req("PUT", { body: { blob: { iv: "i", ct: "c" }, baseVersion: 0 } }), s);
    assert.equal((await handle(req("GET", { token: W }), s)).status, 403);
    assert.equal((await handle(req("PUT", { token: W, body: { blob: { iv: "i", ct: "x" }, baseVersion: 1 } }), s)).status, 403);
    const stale = await handle(req("PUT", { body: { blob: { iv: "i", ct: "y" }, baseVersion: 0 } }), s);
    assert.equal(stale.status, 409);
    assert.equal(stale.body.version, 1);
    assert.equal((await handle({ method: "GET", query: { station: "nope" }, headers: {} }, s)).status, 400);
    assert.equal((await handle({ method: "GET", query: { station: "GSF-ABCDEF" }, headers: {} }, s)).status, 401);
  });
});
