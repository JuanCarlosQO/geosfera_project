// What it was for: the zones the crew member can tap on the body figure when logging a dose.
// `at` is the spot on the figure (its 200 x 450 drawing units), `lit` the figure regions that
// light up, `categories` the NASA kit-list categories offered for that zone. Navigation only:
// the app never says what a symptom means or what to take for it.

export const ZONES = [
  { id: "sleep", label: "Sleep", reason: "Sleep", side: "left", top: 0, at: [100, 16], lit: ["halo", "brain"], categories: ["Sleep"] },
  { id: "head", label: "Head", reason: "Headache", side: "right", top: 3, at: [109, 27], lit: ["brain"], categories: ["Pain Reliever"] },
  { id: "nose", label: "Nose", reason: "Stuffy nose", side: "left", top: 13, at: [100, 41], lit: ["eyes"], categories: ["Decongestant"] },
  { id: "stomach", label: "Stomach", reason: "Nausea or motion sickness", side: "right", top: 31, at: [113, 158], lit: ["gut"], categories: ["Space Motion Sickness/Anti-Nausea"] },
  { id: "back", label: "Back", reason: "Back pain", side: "left", top: 37, at: [100, 186], lit: ["skeleton"], categories: ["Pain Reliever"] },
  { id: "gut", label: "Gut", reason: "Constipation", side: "right", top: 45, at: [100, 208], lit: ["gut"], categories: ["Stool Softener"] },
  { id: "skin", label: "Skin", reason: "Skin", side: "left", top: 51, at: [48, 200], lit: ["skin"], categories: ["Steroid"] }
];
