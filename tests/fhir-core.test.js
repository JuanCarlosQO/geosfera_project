import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toBundle, toStatement, fhirId, bundleJson, STATUSES } from "../js/fhir-core.js";

const KIT = [
  { id: "painA", name: "Pain A", strength: "325 mg", unit: "tablet" },
  { id: "own-x1", name: "Allergy tablet", unit: "tablet", own: true }
];
const doses = [
  { id: "painA-2", medId: "painA", units: 2, at: "2026-11-15T10:00:00.000Z", reason: "Headache", outcome: { worked: "partly", effects: ["Drowsiness"], severity: "mild" }, said: "two pain a for a headache", context: { missionDay: 14, sleepHours: 5.3, co2: 2.3 } },
  { id: "own-x1-1", medId: "own-x1", units: 1, at: "2026-11-13T12:00:00.000Z", reason: null, outcome: null, recalled: true },
  { id: "painA 1/x", medId: "painA", units: 1, at: "2026-11-14T08:00:00.000Z", reason: null, outcome: null, scheduled: true }
];

describe("the log as HL7 FHIR R4", () => {
  const bundle = toBundle(doses, KIT, { who: "Demo crew", now: new Date("2026-11-15T12:00:00Z") });

  it("is a collection Bundle of MedicationStatements, oldest first, marked simulated", () => {
    assert.equal(bundle.resourceType, "Bundle");
    assert.equal(bundle.type, "collection");
    assert.equal(bundle.timestamp, "2026-11-15T12:00:00.000Z");
    assert.match(bundle.meta.tag[0].display, /^SIMULATED/);
    assert.deepEqual(bundle.entry.map((e) => e.resource.effectiveDateTime), ["2026-11-13", "2026-11-14T08:00:00.000Z", "2026-11-15T10:00:00.000Z"]);
    for (const { resource: r } of bundle.entry) {
      assert.equal(r.resourceType, "MedicationStatement");
      assert.ok(STATUSES.includes(r.status));
      assert.ok(r.medicationCodeableConcept.text && r.subject.display, "the required elements are there");
      assert.match(r.id, /^[A-Za-z0-9.-]{1,64}$/);
    }
  });

  it("records what was taken, in the crew member's words, with no codes invented", () => {
    const r = bundle.entry[2].resource;
    assert.equal(r.medicationCodeableConcept.text, "Pain A 325 mg");
    assert.equal(r.medicationCodeableConcept.coding, undefined);
    assert.deepEqual(r.reasonCode, [{ text: "Headache" }]);
    assert.deepEqual(r.dosage[0].doseAndRate[0].doseQuantity, { value: 2, unit: "tablet" });
    assert.equal(r.dosage[0].text, "2 tablets taken");
    assert.equal(r.dateAsserted, "2026-11-15T10:00:00.000Z");
    assert.match(r.informationSource.display, /self-reported/);
    const notes = r.note.map((n) => n.text).join(" ");
    assert.match(notes, /"two pain a for a headache"/);
    assert.match(notes, /it worked partly.*Drowsiness \(mild\)/);
    assert.match(notes, /no conclusion drawn: mission day 14; sleep the night before 5\.3 h \(self-reported\); cabin CO2 2\.3 mmHg \(SIMULATED sensor\)/);
  });

  it("gives a remembered dose its day only, and says so", () => {
    const r = bundle.entry[0].resource;
    assert.equal(r.effectiveDateTime, "2026-11-13");
    assert.equal(r.dateAsserted, undefined);
    assert.equal(r.reasonCode, undefined);
    assert.match(r.medicationCodeableConcept.text, /crew member's own medication/);
    assert.match(r.note[0].text, /Remembered later/);
  });

  it("never carries a recommendation", () => {
    const text = bundleJson(bundle);
    assert.doesNotMatch(text, /recommend|should take|suggest|maxDosePer|"asNeeded/i);
    assert.equal(JSON.parse(text).entry.length, 3);
    assert.equal(fhirId("painA 1/x"), "painA-1-x");
    assert.equal(toStatement({ id: "g-1", medId: "ghost", units: 1, at: "2026-11-15T10:00:00.000Z" }, undefined, "Demo").medicationCodeableConcept.text, "ghost");
  });
});
