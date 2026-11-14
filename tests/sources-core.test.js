import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as S from "../js/sources-core.js";
import { NASA_RISKS } from "../js/data/nasa-risks.js";

const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");

describe("in-app sources page", () => {
  const groups = S.documents();
  const docs = groups.flatMap((g) => g.docs);

  it("names and groups every document the app quotes", () => {
    for (const f of S.collect()) {
      const d = S.describe(f.url);
      assert.ok(d?.title, `no title for ${f.url}`);
      assert.ok(S.GROUPS.some((g) => g.id === d.group), `bad group for ${f.url}`);
    }
  });
  it("lists each document once, with the modules that use it", () => {
    assert.equal(new Set(docs.map((d) => d.url)).size, docs.length);
    for (const d of docs) {
      assert.ok(d.modules.length >= 1 && d.modules.every((m) => S.MODULES[m]), d.title);
      // the 17 risk pages are listed in SOURCES.md through NASA's risk index page
      const listed = sources.includes(d.url) || NASA_RISKS.some((r) => r.url === d.url);
      assert.ok(listed, `not in docs/SOURCES.md: ${d.url}`);
    }
    assert.ok(docs.length >= 40);
  });
  it("puts NASA first and Earth references last", () => {
    assert.equal(groups[0].id, "standard");
    assert.equal(groups.at(-1).id, "earth");
    const std = docs.find((d) => d.title.startsWith("NASA-STD-3001 Volume 1"));
    assert.deepEqual([...std.modules].sort(), ["duty", "future", "live"]);
  });
  it("filters by title or quote", () => {
    const co2 = S.filterGroups(groups, "co2").flatMap((g) => g.docs);
    assert.ok(co2.some((d) => d.title.includes("Carbon Dioxide")));
    assert.deepEqual(S.filterGroups(groups, "   "), groups);
    assert.deepEqual(S.filterGroups(groups, "zzzz-nothing"), []);
  });
  it("lists the real data sources with links", () => {
    for (const d of S.DATA_SOURCES) assert.match(d.url, /^https:\/\/(visualization\.osdr\.nasa\.gov|ccmc\.gsfc\.nasa\.gov)\//);
  });
});
