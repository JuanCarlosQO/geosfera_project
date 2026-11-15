import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as Q from "../js/quicklog-core.js";
import { KIT } from "../js/data/med-kit.js";
import { ZONES, OTHER_NAMES } from "../js/data/med-zones.js";
import { ownAsMeds } from "../js/meds-core.js";

const read = (text, meds = KIT) => Q.parseQuick(text, meds, ZONES, OTHER_NAMES);

describe("the quick log reads only what was said", () => {
  it("finds the medication, the count and what it was for", () => {
    const p = read("Two ibuprofen for back pain");
    assert.equal(p.med.id, "ibuprofen");
    assert.equal(p.units, 2);
    assert.equal(p.zone.id, "back");
    assert.equal(p.close, false);
    assert.equal(p.said, "Two ibuprofen for back pain");
  });

  it("understands digits, unit words and 'took'", () => {
    assert.equal(read("took 1 melatonin tablet to sleep").units, 1);
    assert.equal(read("3 tablets of bisacodyl, constipated").units, 3);
    assert.equal(read("I took 2 of the zolpidem last night").units, 2);
    assert.equal(read("melatonin for insomnia").zone.id, "sleep");
    assert.equal(read("meclizine, motion sickness").zone.id, "stomach");
  });

  it("knows the other names on the list, and the kit's longer names", () => {
    assert.equal(read("paracetamol for a headache").med.id, "acetaminophen");
    assert.equal(read("paracetamol for a headache").word, "paracetamol");
    assert.equal(read("one Tylenol").med.id, "acetaminophen");
    assert.equal(read("Afrin, two sprays, stuffy nose").med.id, "oxymetazoline");
    assert.equal(read("pseudoephedrine for congestion").med.id, "pseudoephedrine");
    assert.equal(read("hydrocortisone cream on a rash").med.id, "hydrocortisone");
    for (const [id, names] of Object.entries(OTHER_NAMES)) {
      assert.ok(KIT.some((k) => k.id === id), id);
      for (const n of names) assert.equal(read(`one ${n}`).med.id, id, n);
    }
  });

  it("never turns milligrams into a count", () => {
    const p = read("Log 500 mg paracetamol for lumbar pain after EVA");
    assert.equal(p.med.id, "acetaminophen");
    assert.equal(p.strength, "500 mg");
    assert.equal(p.units, null, "500 mg is not a number of tablets");
    assert.equal(p.zone.id, "back");
    assert.equal(Q.strengthDiffers(p.strength, p.med), true, "the kit's tablet is 325 mg");
    assert.equal(Q.strengthDiffers("400 mg", KIT.find((k) => k.id === "ibuprofen")), false);
    assert.equal(read("ibuprofen 400mg two tablets").units, 2);
    assert.equal(read("ibuprofen 400 milligrams").strength, "400 mg");
  });

  it("does not take a time or a mission day for a count", () => {
    assert.equal(read("ibuprofen 2 hours ago").units, null);
    assert.equal(read("melatonin on day 14").units, null);
    assert.equal(read("took 30 ibuprofen").units, null, "outside what a sentence may fill in");
  });

  it("never picks a medication from a symptom", () => {
    const p = read("something for my headache");
    assert.equal(p.med, null);
    assert.equal(p.zone.id, "head");
    assert.equal(read("I feel bad").med, null);
    assert.equal(read("").med, null);
    assert.equal(read("   ").said, "");
  });

  it("accepts a near miss from speech recognition and says it was one", () => {
    const p = read("two ibuprofin for my back");
    assert.equal(p.med.id, "ibuprofen");
    assert.equal(p.close, true);
    assert.equal(read("acetaminophin").med.id, "acetaminophen");
    assert.equal(read("two aspirin").med, null, "a medication that is not on the list is not guessed");
  });

  it("reads the same sentence in Spanish", () => {
    const p = read("Registrar 500 mg paracetamol para dolor lumbar post-EVA");
    assert.equal(p.med.id, "acetaminophen");
    assert.equal(p.strength, "500 mg");
    assert.equal(p.units, null);
    assert.equal(p.zone.id, "back");
    const q = read("Tomé dos ibuprofeno para el dolor de espalda");
    assert.deepEqual([q.med.id, q.units, q.zone.id, q.close], ["ibuprofen", 2, "back", false]);
    assert.equal(read("una melatonina para dormir").units, 1);
    assert.equal(read("una melatonina para dormir").zone.id, "sleep");
    assert.equal(read("2 tabletas de bisacodilo, estreñimiento").zone.id, "gut");
    assert.equal(read("ibuprofeno hace 2 horas").units, null);
    assert.equal(read("algo para el dolor de cabeza").med, null);
    assert.equal(read("ibuprofeno 400 miligramos").strength, "400 mg");
  });

  it("reads the crew member's own medications and skips removed ones", () => {
    const own = ownAsMeds([{ id: "own-a1", name: "Allergy tablet", unit: "tablet", daily: false }, { id: "own-b2", name: "Old drops", unit: "drop", daily: false, removed: true }]);
    assert.equal(read("one allergy tablet", [...KIT, ...own]).med.id, "own-a1");
    assert.equal(read("old drops", [...KIT, ...own]).med, null);
  });

  it("keeps what was said, cut to a safe length", () => {
    assert.equal(read(`ibuprofen ${"x".repeat(300)}`).said.length, Q.MAX_SAID);
    assert.equal(Q.norm("Dolor  LUMBAR, post-EVA."), "dolor lumbar post eva");
  });
});
