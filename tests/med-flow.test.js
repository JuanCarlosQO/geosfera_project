import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FLOW_FACTS } from "../js/data/med-flow.js";
import { OTHER_NAMES } from "../js/data/med-zones.js";

const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");

describe("quick log and export facts are verified", () => {
  it("only quotes words that are in docs/SOURCES.md, from the paper's PubMed record or HL7", () => {
    for (const [id, f] of Object.entries(FLOW_FACTS)) {
      assert.ok(sources.includes(f.quote), `not in SOURCES.md: ${id}`);
      assert.ok(sources.includes(f.url), `link not in SOURCES.md: ${f.url}`);
      assert.match(f.url, /^https:\/\/(pubmed\.ncbi\.nlm\.nih\.gov|hl7\.org)\//, id);
    }
  });
  it("lists the other medication names in docs/SOURCES.md", () => {
    for (const names of Object.values(OTHER_NAMES)) for (const n of names) assert.ok(sources.toLowerCase().includes(n), n);
  });
});
