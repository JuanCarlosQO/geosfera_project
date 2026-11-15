import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as A from "../js/after-core.js";
import { AFTER_FACTS, CONNECT_FACTS, LINES } from "../js/data/after.js";
import { buildDemo } from "../js/demo-core.js";

describe("after the mission", () => {
  it("knows the phase from the mission's start and length", () => {
    const m = { start: "2026-01-01", length: 180 };
    assert.equal(A.phase(m, new Date(2026, 0, 10)).phase, "during");
    const after = A.phase(m, new Date(2026, 6, 10, 12));
    assert.equal(after.phase, "after");
    assert.equal(after.landing, new Date(2026, 5, 30).toISOString().slice(0, 10));
    assert.equal(after.followUp, true);
    assert.equal(A.phase(m, new Date(2027, 7, 1)).followUp, false);
    assert.equal(A.phase({}, new Date()).phase, "none");
  });
  it("gives the checked national line, and the directory's country page otherwise", () => {
    assert.equal(A.linesFor("Colombia").lines[0].call, "106");
    assert.equal(A.linesFor("United States").lines[0].call, "988");
    assert.deepEqual(A.linesFor("Nigeria").lines, []);
    assert.equal(A.linesFor("Japan").directory.url, "https://findahelpline.com/countries/jp");
    assert.equal(A.linesFor("Atlantis").directory.url, "https://findahelpline.com/");
  });
  it("keeps up to three trusted people with a usable number", () => {
    const l = A.cleanTrusted([{ name: "Mamá", phone: "+57 300 123 4567" }, { name: "x", phone: "12" }, { name: "B", phone: "555<script>" }, { name: "C", phone: "911" }, { name: "D", phone: "123" }]);
    assert.deepEqual(l.map((p) => p.name), ["Mamá", "B", "C"]);
    assert.equal(l[1].phone, "555");
    assert.equal(A.telOf("+57 (300) 123-4567"), "tel:+573001234567");
  });
  it("flags two requests about home in 14 days", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    const al = (d, reasons) => ({ at: `2026-11-${d}T10:00:00Z`, from: { id: "a" }, reasons });
    assert.equal(A.connection({ alerts: [al(14, ["home"])], member: "a", now }).flag, null);
    assert.equal(A.connection({ alerts: [al(14, ["home"]), al("05", ["home", "low"])], member: "a", now }).homeRequests, 2);
    assert.equal(A.connection({ alerts: [al(14, ["home"]), al("0" + 1, ["home"])], member: "a", now }).homeRequests, 1); // older than 14 days
    const d = buildDemo(now);
    assert.ok(A.connection({ alerts: d.alerts, member: "demo-amorimoto", now }).flag);
  });
  it("quotes only sentences that are in docs/SOURCES.md, with their links", () => {
    const src = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
    for (const [k, f] of Object.entries({ ...AFTER_FACTS, ...CONNECT_FACTS })) {
      assert.ok(src.includes(f.quote), `quote not in SOURCES.md: ${k}`);
      assert.ok(src.includes(f.url), `link not in SOURCES.md: ${k}`);
    }
    for (const l of LINES) assert.ok(src.includes(l.url));
  });
});
