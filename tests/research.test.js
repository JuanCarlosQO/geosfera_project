import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RESEARCH } from "../js/data/research.js";
import * as S from "../js/sources-core.js";

describe("NASA experiments behind each feature", () => {
  it("quotes only words that are in docs/SOURCES.md, with their NLSP link", () => {
    const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
    assert.equal(Object.keys(RESEARCH).length, 8);
    for (const [id, r] of Object.entries(RESEARCH)) {
      assert.ok(sources.includes(r.quote), `not in SOURCES.md: ${id}`);
      assert.ok(sources.includes(r.url), `link not in SOURCES.md: ${id}`);
      assert.match(r.url, /^https:\/\/nlsp\.nasa\.gov\/search\/data\/details\/[0-9a-f-]{36}\?dataType=EXPERIMENTS$/);
    }
  });
  it("shows them on the Sources screen under their own group", () => {
    const g = S.documents().find((x) => x.id === "nlsp");
    assert.equal(g.docs.length, 8);
    assert.ok(g.docs.every((d) => d.title && d.quotes.length === 1));
  });
});
