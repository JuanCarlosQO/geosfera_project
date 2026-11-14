import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RED_FLAGS, KIT, SIDE_EFFECTS, KIT_FACTS, allQuotes, REVIEWER } from "../js/data/med-kit.js";
import { SUPPLEMENTS } from "../js/data/supplements.js";
import { FORMS } from "../js/pill3d.js";
import { ZONES } from "../js/data/med-zones.js";
import { effectsFor } from "../js/meds-core.js";

const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
const OFFICIAL = /^https:\/\/(www\.nasa\.gov|humanresearchroadmap\.nasa\.gov|ntrs\.nasa\.gov|dailymed\.nlm\.nih\.gov|www\.nccih\.nih\.gov)\//;
// The kit-list category headings, exactly as NASA's "3.001 Medical Kit – Contents and Reference" prints them.
const KIT_CATEGORIES = ["Pain Reliever", "Sleep", "Decongestant", "Space Motion Sickness/Anti-Nausea", "Steroid", "Stool Softener"];

describe("medication data is verified", () => {
  it("only shows facts quoted word for word in docs/SOURCES.md, with an official link", () => {
    const quotes = allQuotes();
    assert.ok(quotes.length > 60);
    for (const q of quotes) {
      assert.ok(sources.includes(q.quote), `not in SOURCES.md: ${q.quote}`);
      assert.ok(sources.includes(q.url), `link not in SOURCES.md: ${q.url}`);
      assert.match(q.url, OFFICIAL, q.where);
    }
  });

  it("files every medication under a NASA kit-list category with its listed side effects", () => {
    assert.equal(new Set(KIT.map((k) => k.id)).size, KIT.length);
    for (const m of KIT) {
      assert.ok(KIT_CATEGORIES.includes(m.category), `${m.id}: ${m.category}`);
      assert.ok(m.sideEffects?.quote && m.sideEffects.url === KIT_FACTS.carried.url, m.id);
      assert.ok(m.askAfterHours > 0, m.id);
      assert.ok(m.reviewedBy === null || typeof m.reviewedBy === "string", m.id);
    }
    for (const c of KIT_CATEGORIES) assert.ok(sources.includes(c), `category not in SOURCES.md: ${c}`);
    assert.ok(effectsFor(KIT.find((k) => k.id === "zolpidem")).includes("Memory impairment"));
  });

  it("takes each kit-list limit's number from the words it quotes", () => {
    for (const m of KIT.filter((k) => k.kitLimit)) {
      const n = m.kitLimit.perDay ?? m.kitLimit.days;
      assert.ok(m.kitLimit.quote.includes(`${n} `), `${m.id}: ${n} not in "${m.kitLimit.quote}"`);
    }
  });

  it("draws every medication in a known 3D form and colour", () => {
    for (const m of KIT) {
      assert.ok(FORMS[m.form], `${m.id}: form ${m.form}`);
      assert.match(m.tint, /^#[0-9a-f]{6}$/, m.id);
    }
  });

  it("offers kit medications from every body zone, and every medication from some zone", () => {
    for (const z of ZONES) {
      assert.ok(z.reason && z.categories.every((c) => KIT_CATEGORIES.includes(c)), z.id);
      assert.ok(KIT.some((m) => z.categories.includes(m.category)), `${z.id} offers nothing`);
      assert.ok(z.at[0] >= 0 && z.at[0] <= 200 && z.at[1] >= 0 && z.at[1] <= 450, z.id);
      assert.ok(["left", "right"].includes(z.side) && z.lit.length >= 1, z.id);
    }
    for (const m of KIT) assert.ok(ZONES.some((z) => z.categories.includes(m.category)), `${m.id} is never offered`);
    assert.ok(RED_FLAGS.length >= 5 && SIDE_EFFECTS.some((s) => s.label === "Nothing"));
  });

  it("keeps supplements as a plan to log, with NASA's reason", () => {
    assert.deepEqual(SUPPLEMENTS.map((s) => s.id), ["vitaminD"]);
    for (const s of SUPPLEMENTS) {
      assert.ok(s.plan && s.why.text && s.why.facts.length >= 2, s.id);
      for (const f of s.why.facts) assert.match(f.url, OFFICIAL);
    }
  });

  it("labels the pharmacist's values as hers and lists them in docs/SOURCES.md", () => {
    assert.ok(sources.includes("Pharmacist review"));
    for (const m of KIT.filter((k) => k.reviewLimit || k.dutyHours || k.beforeTaking)) {
      assert.equal(m.reviewedBy, REVIEWER, m.id);
      if (m.reviewLimit) assert.ok(sources.includes(m.reviewLimit.text), `${m.id} limit not in SOURCES.md`);
      if (m.beforeTaking) assert.ok(sources.includes(m.beforeTaking), `${m.id} check not in SOURCES.md`);
    }
    assert.equal(KIT.find((k) => k.id === "bisacodyl").reviewedBy, null, "not in her document");
  });
});
