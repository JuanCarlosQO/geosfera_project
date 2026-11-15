// Medication log as HL7 FHIR R4 — the same doses the log keeps, written as MedicationStatement
// resources in a Bundle, the standard shape a flight surgeon's record system can read.
// Pure functions, no DOM. Element names and the status codes were checked against
// https://hl7.org/fhir/R4/medicationstatement.html (docs/SOURCES.md).
//
// Honest by construction: no medication or reason codes are invented (text only), what the
// crew member took is recorded and nothing is recommended, and the bundle says it is simulated.

export const FHIR_VERSION = "4.0.1";
export const STATUSES = ["active", "completed", "entered-in-error", "intended", "stopped", "on-hold", "unknown", "not-taken"];
const WORKED = { yes: "it worked", partly: "it worked partly", no: "it did not work" };

/** FHIR ids allow letters, digits, "-" and "." only, up to 64 characters. */
export const fhirId = (raw) => String(raw).replace(/[^A-Za-z0-9.-]/g, "-").slice(0, 64) || "x";

function notes(dose) {
  const out = [];
  if (dose.said) out.push(`Logged from the crew member's own words: "${dose.said}"`);
  if (dose.recalled) out.push("Remembered later: the day is right, the time of day is not known.");
  if (dose.scheduled) out.push("Every-day medication, confirmed as taken as scheduled.");
  if (dose.outcome) {
    const fx = (dose.outcome.effects ?? []).filter((e) => e !== "Nothing");
    out.push(`Crew member's own rating: ${WORKED[dose.outcome.worked] ?? dose.outcome.worked}.${fx.length ? ` Side effects noticed: ${fx.join(", ")}${dose.outcome.severity ? ` (${dose.outcome.severity})` : ""}.` : " No side effects noticed."}`);
  }
  const c = dose.context;
  if (c) {
    const parts = [];
    if (c.missionDay != null) parts.push(`mission day ${c.missionDay}`);
    if (c.sleepHours != null) parts.push(`sleep the night before ${c.sleepHours} h (self-reported)`);
    if (c.co2 != null) parts.push(`cabin CO2 ${c.co2} mmHg (SIMULATED sensor)`);
    if (parts.length) out.push(`Readings logged alongside, with no conclusion drawn: ${parts.join("; ")}.`);
  }
  return out.map((text) => ({ text }));
}

/** One dose as a MedicationStatement (what the crew member says they took). */
export function toStatement(dose, med, who) {
  const name = med ? `${med.name}${med.own ? " (crew member's own medication)" : med.strength ? ` ${med.strength}` : ""}` : dose.medId;
  const unit = med?.unit ?? "unit";
  const r = {
    resourceType: "MedicationStatement",
    id: fhirId(dose.id),
    status: "completed",
    medicationCodeableConcept: { text: name },
    subject: { display: who },
    effectiveDateTime: dose.recalled ? dose.at.slice(0, 10) : dose.at,
    informationSource: { display: `${who} (self-reported)` },
    dosage: [{ text: `${dose.units} ${unit}${dose.units === 1 ? "" : "s"} taken`, doseAndRate: [{ doseQuantity: { value: dose.units, unit } }] }]
  };
  if (!dose.recalled) r.dateAsserted = dose.at;
  if (dose.reason) r.reasonCode = [{ text: dose.reason }];
  const n = notes(dose);
  if (n.length) r.note = n;
  return r;
}

/** The doses as a FHIR R4 Bundle (type "collection"), oldest first. */
export function toBundle(doses, kit, { who = "Crew member", now = new Date() } = {}) {
  const byId = new Map(kit.map((k) => [k.id, k]));
  const sorted = [...doses].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date(now).toISOString(),
    meta: { tag: [{ display: "SIMULATED: demo data from the Ergosphere prototype, not a real crew record" }] },
    entry: sorted.map((d) => ({ resource: toStatement(d, byId.get(d.medId), who) }))
  };
}

export const bundleJson = (bundle) => `${JSON.stringify(bundle, null, 2)}\n`;
