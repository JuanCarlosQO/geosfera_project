import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SYMPTOMS, RED_FLAGS, CONDITIONS, KIT, SIDE_EFFECTS, KIT_FACTS, allQuotes } from "../js/data/med-kit.js";

const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");
const OFFICIAL = /^https:\/\/(www\.nasa\.gov|humanresearchroadmap\.nasa\.gov|ntrs\.nasa\.gov|dailymed\.nlm\.nih\.gov|www\.nccih\.nih\.gov)\//;

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

  it("builds every complaint from known symptoms and kit medications", () => {
    const symptoms = new Set(SYMPTOMS.map((s) => s.id));
    const kit = new Set(KIT.map((k) => k.id));
    assert.equal(new Set(CONDITIONS.map((c) => c.id)).size, CONDITIONS.length);
    for (const c of CONDITIONS) {
      for (const s of c.signs) assert.ok(symptoms.has(s), `${c.id}: ${s}`);
      for (const s of c.core) assert.ok(c.signs.includes(s), `${c.id}: core ${s}`);
      for (const o of c.options) assert.ok(kit.has(o), `${c.id}: ${o}`);
      assert.ok(c.about.quote && c.first.length >= 1 && c.officer.text, c.id);
    }
    for (const s of symptoms) assert.ok(CONDITIONS.some((c) => c.signs.includes(s)), `unused symptom ${s}`);
    for (const f of RED_FLAGS) assert.ok(!symptoms.has(f.id), `${f.id} is both a symptom and a red flag`);
    assert.ok(SIDE_EFFECTS.length >= 3 && KIT_FACTS.expired.quote);
  });

  it("gives every kit medication a label, a dose rule and a simulated stock", () => {
    assert.equal(new Set(KIT.map((k) => k.id)).size, KIT.length);
    for (const m of KIT) {
      assert.ok(m.use.quote && m.directions.quote && m.labelName, m.id);
      assert.ok(m.warnings.length >= 2 && m.warnings.every((w) => w.head && w.quote && w.url), m.id);
      const [lo, hi] = m.dose.unitsPerDose;
      assert.ok(Number.isInteger(lo) && Number.isInteger(hi) && lo >= 1 && hi >= lo, m.id);
      if (m.dose.maxUnitsPerDay != null) assert.ok(m.dose.maxUnitsPerDay >= hi, `${m.id}: one dose exceeds the daily limit`);
      assert.ok(m.askAfterHours > 0 && Number.isInteger(m.demo.stock) && Number.isInteger(m.demo.expiresInDays), m.id);
      assert.ok(CONDITIONS.some((c) => c.options.includes(m.id)), `${m.id} is never offered`);
      assert.ok(m.reviewedBy === null || typeof m.reviewedBy === "string", m.id);
    }
  });

  it("reads each daily limit from the words it quotes", () => {
    const said = { 1: ["once", "single daily dose"], 2: ["twice", "2 "] };
    for (const m of KIT) {
      const limit = m.dose.maxUnitsPerDay ?? m.dose.maxDosesPerDay;
      const words = [m.directions.quote, ...m.warnings.map((w) => w.quote)].join(" ");
      if (limit == null) { assert.ok(m.noLabel, `${m.id}: no limit and no "no label" mark`); continue; }
      const ways = [String(limit), ...(said[limit] ?? [])];
      assert.ok(ways.some((w) => words.includes(w)), `${m.id}: limit ${limit} is not in its quotes`);
    }
  });
});
