import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as F from "../js/family-core.js";
import { SUPPORT_FACTS } from "../js/data/support.js";
import { LOCAL_ONLY } from "../js/sync-core.js";
import { buildDemo, DEMO_CREW } from "../js/demo-core.js";

const NOW = new Date("2026-11-15T12:00:00Z");
const msg = (over = {}) => F.makeMessage({ to: "Valentina Reyes", from: "Camila", rel: "Sibling", kind: "news", text: "Mateo took his first steps. ¡Te queremos! 🚀", at: NOW, ...over });

describe("family channel: writing a message", () => {
  it("needs a name, a kind and some words, and caps the length", () => {
    assert.equal(msg().ok, true);
    assert.equal(msg({ from: "" }).ok, false);
    assert.equal(msg({ kind: "ad" }).ok, false);
    assert.equal(msg({ text: " " }).ok, false);
    assert.equal(msg({ text: "x".repeat(2000) }).message.text.length, F.MAX_TEXT);
    assert.equal(msg({ rel: "Boss" }).message.rel, "Family");
  });
  it("travels inside a link and comes back the same, accents and emoji included", () => {
    const m = msg().message, payload = F.encode(m);
    assert.match(payload, /^[\w-]+$/);
    assert.deepEqual(F.decode(payload).message, m);
  });
  it("rejects a damaged or made-up link without throwing", () => {
    for (const bad of ["", "###", "abc", F.encode({ v: 2 }), F.encode({ v: 1, at: "x" }), "a".repeat(7000), null]) assert.equal(F.decode(bad).ok, false);
    const forged = F.decode(F.encode({ v: 1, at: NOW.toISOString(), from: "Eve", kind: "hello", text: "<img src=x onerror=alert(1)>", state: "open", id: "x" }));
    assert.equal(forged.ok, true, "kept as plain text; the screen escapes it");
    assert.equal(forged.message.state, undefined);
  });
});

describe("family channel: the crew member decides", () => {
  const m = msg().message;
  it("arrives sealed, once", () => {
    const r = F.receive({}, "v1", m, NOW);
    assert.equal(r.added, true);
    assert.equal(r.box.v1[0].state, "sealed");
    assert.equal(F.waiting(r.box, "v1"), 1);
    assert.equal(F.receive(r.box, "v1", m, NOW).added, false);
  });
  it("opens only when asked, can be set aside unread, sealed again or deleted", () => {
    let box = F.receive({}, "v1", m, NOW).box;
    box = F.setState(box, "v1", m.id, "aside", NOW);
    assert.equal(F.waiting(box, "v1"), 0);
    assert.equal(box.v1[0].openedAt, null, "set aside is not opened");
    box = F.setState(box, "v1", m.id, "open", NOW);
    assert.equal(box.v1[0].openedAt, NOW.toISOString());
    assert.equal(F.inbox(box, "v1").open.length, 1);
    box = F.setState(box, "v1", m.id, "sealed", NOW);
    assert.equal(F.waiting(box, "v1"), 1);
    assert.deepEqual(F.remove(box, "v1", m.id), {});
  });
  it("finds who it is for by full name or an unambiguous first name", () => {
    const crew = [{ id: "a", name: "Valentina Reyes" }, { id: "b", name: "Tomás Okafor" }, { id: "c", name: "Valentina Cruz" }];
    assert.equal(F.matchMember(crew, "valentina reyes").id, "a");
    assert.equal(F.matchMember(crew, "Tomás").id, "b");
    assert.equal(F.matchMember(crew, "Valentina"), null);
    assert.equal(F.matchMember(crew, ""), null);
  });
  it("drops broken data read back from the device", () => {
    const box = F.receive({}, "v1", m, NOW).box;
    const c = F.cleanBox({ ...box, v2: [{ text: "no sender" }], v3: "x" });
    assert.deepEqual(Object.keys(c), ["v1"]);
  });
});

describe("family channel: privacy and sources", () => {
  it("never leaves the device with the station sync", () => {
    assert.ok(LOCAL_ONLY.includes(F.FAMILY_KEY));
  });
  it("quotes NASA word for word", () => {
    const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
    for (const k of ["familyContact", "carePackages"]) assert.ok(sources.includes(SUPPORT_FACTS[k].quote), k);
  });
  it("gives the demo crew sealed messages marked as simulated", () => {
    const fam = F.cleanBox(buildDemo(NOW).family);
    const list = fam[DEMO_CREW[0].id];
    assert.equal(list.length, 2);
    assert.ok(list.every((x) => x.simulated && x.state === "sealed"));
  });
});
