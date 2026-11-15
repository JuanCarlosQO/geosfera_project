import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as B from "../js/mailbox-core.js";
import { seal, open, LOCAL_ONLY } from "../js/sync-core.js";
import { handle, memoryStore } from "../lib/sync-handler.js";
import { makeMessage } from "../js/family-core.js";

const fixed = (n) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256);
const box = B.newMailbox(fixed);
const member = { memberId: "m-1", name: "Valentina Reyes" };
const msg = (text) => makeMessage({ to: "Valentina Reyes", from: "Camila", rel: "Sibling", kind: "hello", text, at: new Date("2026-11-14T12:00:00Z") }).message;

describe("family mailbox", () => {
  it("makes a mailbox the sync server accepts", () => {
    assert.ok(B.validMailbox(box));
    assert.match(box.id, /^ERG-[A-HJ-NP-Z2-9]{6}$/);
    assert.match(box.token, /^[0-9a-f]{64}$/);
    assert.equal(atob(box.key).length, 32);
    assert.ok(!B.validMailbox({ ...box, token: "short" }) && !B.validMailbox(null));
    assert.notDeepEqual(B.newMailbox(), B.newMailbox(), "two mailboxes are never the same");
  });
  it("puts who the message is for and the mailbox inside one link, and reads it back", () => {
    const text = B.makeInvite(member, box);
    assert.match(text, /^[\w-]+$/, "safe to put after # in a link");
    assert.deepEqual(B.readInvite(text), { memberId: "m-1", name: "Valentina Reyes", mailbox: box });
  });
  it("refuses a cut, altered or foreign link without throwing", () => {
    const text = B.makeInvite(member, box);
    for (const bad of [text.slice(0, -9), `${text}%`, "", "family/write", null, 42, "x".repeat(700), B.makeInvite({ memberId: "m-1", name: " " }, box), B.makeInvite(member, { ...box, token: "nope" })]) assert.equal(B.readInvite(bad), null);
  });
  it("keeps each waiting message once and the bag short", () => {
    let list = [];
    for (let i = 0; i < B.KEEP_IN_BAG + 3; i++) list = B.addToBag(list, { id: `m${i}` });
    assert.equal(list.length, B.KEEP_IN_BAG);
    assert.equal(B.addToBag(list, { id: list[0].id }), list, "a repeat adds nothing");
    assert.deepEqual(B.cleanBag({ messages: [{ id: "a" }, null, { nope: 1 }, "x"] }), [{ id: "a" }]);
    assert.deepEqual(B.cleanBag(null), []);
  });
  it("tells the sync server from a plain web host", () => {
    assert.equal(B.fromServer(200, { version: 1 }), true);
    assert.equal(B.fromServer(404, { error: "No station with this ID yet." }), true);
    assert.equal(B.fromServer(404, null), false, "a web page answering 404 is not the server");
    assert.equal(B.fromServer(405, null), false);
    assert.equal(B.fromServer(0, null), false);
  });
  it("announces a sealed message once, never the demo's own, never an opened one", () => {
    const list = [{ id: "a", state: "sealed" }, { id: "b", state: "open" }, { id: "c", state: "sealed", simulated: true }, { id: "d", state: "sealed" }];
    assert.deepEqual(B.unannounced(list, ["d"]).map((m) => m.id), ["a"]);
    assert.deepEqual(B.unannounced(undefined, null), []);
    const seen = B.markSeen(["d"], ["a", "d"]);
    assert.deepEqual(seen, ["d", "a"]);
    assert.equal(B.markSeen(Array.from({ length: 300 }, (_, i) => `x${i}`), ["new"]).length, B.KEEP_SEEN);
  });
  it("keeps mailbox keys and what was announced on the device", () => {
    assert.ok(LOCAL_ONLY.includes(B.MAILBOX_KEY) && LOCAL_ONLY.includes(B.SEEN_KEY));
    assert.deepEqual(B.cleanMailboxes({ a: box, b: { id: "x" }, c: null }), { a: box });
  });
  it("travels through the real sync server rules: the family drops, the crew member empties", async () => {
    const store = memoryStore();
    const req = (method, body) => handle({ method, query: { station: box.id }, headers: { authorization: `Bearer ${box.token}` }, body }, store);
    assert.equal((await req("GET")).status, 404, "an unused mailbox does not exist yet");
    // family: first message creates the record, second one appends
    let put = await req("PUT", { blob: await seal(B.bag(B.addToBag([], msg("Hello from home"))), box.key), baseVersion: 0 });
    assert.equal(put.status, 200);
    let got = await req("GET");
    const first = B.cleanBag(await open(got.body.blob, box.key));
    put = await req("PUT", { blob: await seal(B.bag(B.addToBag(first, msg("A second one"))), box.key), baseVersion: got.body.version });
    assert.equal(put.status, 200);
    // crew member: reads both, then leaves the mailbox empty
    got = await req("GET");
    const waiting = B.cleanBag(await open(got.body.blob, box.key));
    assert.deepEqual(waiting.map((m) => m.text), ["Hello from home", "A second one"]);
    assert.equal((await req("PUT", { blob: await seal(B.bag([]), box.key), baseVersion: got.body.version })).status, 200);
    assert.deepEqual(B.cleanBag(await open((await req("GET")).body.blob, box.key)), []);
    // someone with another token cannot read it, and the wrong key opens nothing
    assert.equal((await handle({ method: "GET", query: { station: box.id }, headers: { authorization: `Bearer ${"0".repeat(64)}` } }, store)).status, 403);
    assert.equal(await open((await req("GET")).body.blob, B.newMailbox().key), null);
  });
});
