import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { translate, keyOf, squash, checkDictionary } from "../js/i18n-core.js";
import { ES, ES_RULES } from "../js/data/es.js";
import { allQuotes } from "../js/data/med-kit.js";
import { LIMIT_FACTS } from "../js/data/telemetry.js";
import { FLOW_FACTS } from "../js/data/med-flow.js";
import { LOCAL_ONLY } from "../js/sync-core.js";

const D = { "Mission day #": "Día de misión #", "# of # entries waiting": "#2 entradas, #1 en espera", "Log it": "Registrar", "Normal": "Normal", "Sleep": "Sueño" };
const RULES = [[/^Good evening, (.+)$/, (m, t) => `Buenas noches, ${m[1]}`], [/^Logged: (.+)\.$/, (m, t) => `Registrado: ${t(m[1])}.`]];

describe("Spanish look: the lookup", () => {
  it("takes the numbers out before looking a text up, and puts them back", () => {
    assert.deepEqual(keyOf("Mission  day 14"), { key: "Mission day #", nums: ["14"] });
    assert.equal(keyOf("2026-11-15 05:46 UTC, 5.3 h").key, "# # UTC, # h");
    assert.equal(translate("Mission day 14", D), "Día de misión 14");
    assert.equal(translate("3 of 5 entries waiting", D), "5 entradas, 3 en espera", "a translation may reorder the numbers");
    assert.equal(keyOf("CO₂ at 2.3").key, "CO₂ at #", "a subscript is not a number");
  });

  it("keeps the spaces that separate a text from the elements beside it", () => {
    assert.equal(translate("  Log it\n   ", D), " Registrar ");
    assert.equal(translate("Log it", D), "Registrar");
    assert.equal(squash("  a \n b "), "a b");
  });

  it("leaves alone what it does not know", () => {
    assert.equal(translate("No more than 12 tablets every 24 hours.", D), null, "a quoted source is not in the dictionary");
    assert.equal(translate("Valentina Reyes", D), null);
    assert.equal(translate("14:05", D), null);
    assert.equal(translate("", D), null);
    assert.equal(translate("Normal", D), null, "same word in both languages: nothing to change");
    assert.equal(translate("toString", D), null, "not fooled by object built-ins");
  });

  it("uses rules for sentences built around a name", () => {
    assert.equal(translate("Good evening, Valentina", D, RULES), "Buenas noches, Valentina");
    assert.equal(translate("Logged: Sleep.", D, RULES), "Registrado: Sueño.");
    assert.equal(translate("Logged: Zolpidem.", D, RULES), "Registrado: Zolpidem.");
  });

  it("finds a dictionary entry that would lose or invent a number", () => {
    assert.deepEqual(checkDictionary(D), []);
    assert.equal(checkDictionary({ "# tablets": "tabletas" }).length, 1);
    assert.equal(checkDictionary({ "Take it": "Tome 2" }).length, 1);
    assert.equal(checkDictionary({ "# of #": "#1 de #1" }).length, 1);
    assert.equal(checkDictionary({ "Day 3": "Día #" }).length >= 1, true);
  });
});

describe("Spanish look: the dictionary", () => {
  const sources = readFileSync(new URL("../docs/SOURCES.md", import.meta.url), "utf8");

  it("is well formed", () => {
    assert.deepEqual(checkDictionary(ES), []);
    assert.ok(Object.keys(ES).length > 800, "covers the app");
    for (const [re, to] of ES_RULES) { assert.ok(re instanceof RegExp); assert.equal(typeof to, "function"); }
  });

  it("never translates a quoted source: quotes stay word for word", () => {
    const quotes = [...allQuotes().map((q) => q.quote), ...Object.values(LIMIT_FACTS).map((f) => f.quote), ...Object.values(FLOW_FACTS).map((f) => f.quote)].filter(Boolean);
    assert.ok(quotes.length > 100);
    for (const q of quotes) assert.equal(translate(q, ES, ES_RULES), null, q);
    for (const key of Object.keys(ES)) if (key.length >= 40) assert.ok(!sources.includes(`"${key}"`), `quoted in SOURCES.md, must not be translated: ${key}`);
  });

  it("keeps the language choice on the device", () => {
    assert.ok(LOCAL_ONLY.includes("geosfera.lang"));
  });
});
