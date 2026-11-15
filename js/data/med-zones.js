// What it was for: the zones the crew member can tap on the body figure when logging a dose.
// `at` is the spot on the figure (its 200 x 450 drawing units), `lit` the figure regions that
// light up, `categories` the NASA kit-list categories offered for that zone. Navigation only:
// the app never says what a symptom means or what to take for it. `words` are other ways the
// crew member may say the same thing in the quick log (app list, plain English and Spanish,
// written without accents because the sentence is compared without them).

export const ZONES = [
  { id: "sleep", label: "Sleep", reason: "Sleep", side: "left", top: 0, at: [100, 16], lit: ["halo", "brain"], categories: ["Sleep"], words: ["insomnia", "sleeping", "fall asleep", "get to sleep", "dormir", "insomnio", "sueno"] },
  { id: "head", label: "Head", reason: "Headache", side: "right", top: 3, at: [109, 27], lit: ["brain"], categories: ["Pain Reliever"], words: ["headache", "head ache", "migraine", "dolor de cabeza", "cabeza", "migrana"] },
  { id: "nose", label: "Nose", reason: "Stuffy nose", side: "left", top: 13, at: [100, 41], lit: ["eyes"], categories: ["Decongestant"], words: ["stuffy nose", "congestion", "congested", "blocked nose", "sinus", "nariz tapada", "nariz", "congestion nasal"] },
  { id: "stomach", label: "Stomach", reason: "Nausea or motion sickness", side: "right", top: 31, at: [113, 158], lit: ["gut"], categories: ["Space Motion Sickness/Anti-Nausea"], words: ["nausea", "nauseous", "motion sickness", "queasy", "vomiting", "nauseas", "mareo", "estomago", "vomito"] },
  { id: "back", label: "Back", reason: "Back pain", side: "left", top: 37, at: [100, 186], lit: ["skeleton"], categories: ["Pain Reliever"], words: ["back pain", "backache", "back ache", "lower back", "lumbar", "dolor de espalda", "espalda", "dolor lumbar"] },
  { id: "gut", label: "Gut", reason: "Constipation", side: "right", top: 45, at: [100, 208], lit: ["gut"], categories: ["Stool Softener"], words: ["constipation", "constipated", "estrenimiento", "estrenido"] },
  { id: "skin", label: "Skin", reason: "Skin", side: "left", top: 51, at: [48, 200], lit: ["skin"], categories: ["Steroid"], words: ["rash", "itch", "itching", "itchy", "sarpullido", "piel", "picazon", "comezon", "erupcion"] }
];

// Other names a crew member may say for a kit medication in the quick log. The brand names
// are those of the FDA labels this module already quotes (docs/SOURCES.md); "paracetamol" is
// the international name of acetaminophen (app list, pending the pharmacist's check).
// The Spanish spellings let the same sentence be said in Spanish (same list, same check pending).
export const OTHER_NAMES = {
  acetaminophen: ["paracetamol", "tylenol", "acetaminofen"],
  ibuprofen: ["ibuprofeno"],
  meclizine: ["meclizina"],
  promethazine: ["prometazina"],
  oxymetazoline: ["afrin", "nasal spray", "oximetazolina", "spray nasal"],
  pseudoephedrine: ["pseudoefedrina", "seudoefedrina"],
  melatonin: ["melatonina"],
  zolpidem: ["ambien"],
  hydrocortisone: ["hydrocortisone cream", "hidrocortisona"],
  bisacodyl: ["bisacodilo"]
};
