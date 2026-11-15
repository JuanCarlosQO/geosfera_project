// Facts behind the quick log and the flight-surgeon export, quoted word for word.
// Every `quote` is repeated in docs/SOURCES.md (tests/med-flow.test.js checks it).
// The Dose Tracker results were read in the paper's abstract only (PubMed), 15 Nov 2026.

const PUBMED = "https://pubmed.ncbi.nlm.nih.gov/31852573/";
const FHIR = "https://hl7.org/fhir/R4/medicationstatement.html";
const N_PAPER = "Wotring & Smith, Aerosp Med Hum Perform 2020 (abstract)";
const N_FHIR = "HL7 FHIR R4, MedicationStatement";

export const FLOW_FACTS = {
  usability: { quote: "despite user criticisms regarding app usability", url: PUBMED, source: N_PAPER },
  ended: { quote: "Six crewmembers completed flight data collection and five completed ground data collection before NASA's early study discontinuation.", url: PUBMED, source: N_PAPER },
  better: { quote: "improvements in a software-based questionnaire application could result in a robust data collection tool that astronauts find more acceptable", url: PUBMED, source: N_PAPER },
  share: { quote: "to share data with flight surgeons", url: PUBMED, source: N_PAPER },
  fhirWhat: { quote: "A record of a medication that is being consumed by a patient.", url: FHIR, source: N_FHIR },
  fhirSource: { quote: "The source of this information can be the patient, significant other (such as a family member or spouse), or a clinician.", url: FHIR, source: N_FHIR }
};
