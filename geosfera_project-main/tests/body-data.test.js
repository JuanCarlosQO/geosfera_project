import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SYSTEMS, STATUS } from "../js/data/body-systems.js";
import { NASA_RISKS } from "../js/data/nasa-risks.js";
import { REGIONS } from "../js/anatomy.js";

const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");

describe("hologram data is verified", () => {
  it("lists the 17 NASA risks, each with text and a nasa.gov link", () => {
    assert.equal(NASA_RISKS.length, 17);
    for (const r of NASA_RISKS) {
      assert.match(r.name, /^Risk (of|from) /);
      assert.ok(r.text.length > 40, r.name);
      assert.match(r.url, /^https:\/\/www\.nasa\.gov\//, r.name);
    }
  });

  it("places every NASA risk in exactly one body system", () => {
    const used = SYSTEMS.flatMap((s) => s.risks);
    assert.equal(new Set(used).size, used.length, "a risk is listed twice");
    assert.deepEqual([...used].sort(), NASA_RISKS.map((r) => r.name).sort());
  });

  it("only shows facts quoted word for word in docs/SOURCES.md, with an official link", () => {
    for (const s of SYSTEMS) {
      for (const f of s.facts) {
        assert.ok(sources.includes(f.quote), `not in SOURCES.md: ${f.quote}`);
        assert.ok(sources.includes(f.url), `link not in SOURCES.md: ${f.url}`);
        assert.match(f.url, /^https:\/\/www\.(nasa\.gov|asc-csa\.gc\.ca)\//);
      }
    }
  });

  it("lights only regions the figure draws", () => {
    for (const s of SYSTEMS) for (const r of s.regions) assert.ok(REGIONS.includes(r), `${s.id}: ${r}`);
  });

  it("gives every status a word and a shape", () => {
    for (const st of Object.values(STATUS)) {
      assert.ok(st.word.length > 1);
      assert.ok(st.shape.length >= 1);
    }
  });
});
