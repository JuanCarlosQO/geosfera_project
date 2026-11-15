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

describe("family channel: photos and voice notes", () => {
  const photo = `data:image/jpeg;base64,${"A".repeat(4000)}`, audio = `data:audio/webm;codecs=opus;base64,${"B".repeat(8000)}`;
  it("accepts a JPEG photo and a short voice note, even with no text", () => {
    const r = msg({ text: "", photo, audio });
    assert.equal(r.ok, true);
    assert.ok(F.hasMedia(r.message));
    assert.equal(msg({ text: "" }).ok, false);
  });
  it("refuses anything that is not a capped JPEG or audio data URL", () => {
    for (const bad of ["data:image/svg+xml;base64,AAAA", "data:text/html;base64,AAAA", "https://example.com/x.jpg", "data:image/jpeg;base64,<script>", `data:image/jpeg;base64,${"A".repeat(F.MAX_PHOTO)}`]) assert.equal(msg({ photo: bad }).ok, false, bad.slice(0, 30));
    assert.equal(msg({ audio: "data:video/mp4;base64,AAAA" }).ok, false);
  });
  it("travels as a file and comes back the same; a damaged or foreign file is refused", () => {
    const m = msg({ photo, audio }).message;
    assert.deepEqual(F.fromFile(F.toFile(m)).message, m);
    for (const bad of ["", "{}", "not json", JSON.stringify({ app: "other", kind: "family-message", v: 1, message: m }), F.toFile({ ...m, photo: "data:image/png;base64,AAAA" })]) assert.equal(F.fromFile(bad).ok, false);
  });
  it("keeps the photo and the feeling when read back from the device", () => {
    const m = msg({ photo }).message;
    let box = F.setState(F.receive({}, "v1", m, NOW).box, "v1", m.id, "open", NOW);
    box = F.setFeel(box, "v1", m.id, "better");
    const c = F.cleanBox(JSON.parse(JSON.stringify(box)));
    assert.equal(c.v1[0].photo, photo);
    assert.equal(c.v1[0].feel, "better");
  });
});

describe("family channel: protections", () => {
  const three = [0, 1, 2].map((i) => msg({ text: `message ${i}`, at: new Date(NOW.getTime() + i * 60000) }).message);
  const boxWith = () => three.reduce((b, m, i) => F.receive(b, "v1", m, new Date(NOW.getTime() + i * 60000)).box, {});
  it("when paused, messages are still kept but nothing announces them", () => {
    let box = boxWith();
    assert.equal(F.announced(box, "v1"), 3);
    box = F.setPaused(box, "v1", true);
    assert.equal(F.announced(box, "v1"), 0);
    assert.equal(F.waiting(box, "v1"), 3, "still there, sealed");
    assert.equal(F.isPaused(F.cleanBox(JSON.parse(JSON.stringify(box))), "v1"), true);
    box = F.receive(box, "v1", msg({ text: "one more" }).message, NOW).box;
    assert.equal(F.waiting(box, "v1"), 4);
    assert.equal(F.setPaused(box, "v1", false)._prefs, undefined);
  });
  it("suggests talking to someone only after two reads in a row left them more homesick", () => {
    let box = boxWith();
    three.forEach((m, i) => { box = F.setState(box, "v1", m.id, "open", new Date(NOW.getTime() + (i + 5) * 60000)); });
    box = F.setFeel(box, "v1", three[0].id, "worse");
    assert.equal(F.homesick(box, "v1"), false);
    box = F.setFeel(box, "v1", three[1].id, "worse");
    assert.equal(F.homesick(box, "v1"), true);
    box = F.setFeel(box, "v1", three[2].id, "better");
    assert.equal(F.homesick(box, "v1"), false);
    assert.deepEqual(F.setFeel(box, "v1", three[2].id, "angry"), box);
  });
});
