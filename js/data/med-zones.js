// Where it bothers: the zones the crew member can tap on the body figure. `at` is the spot
// on the figure (its 200 x 450 drawing units), `lit` the figure regions that light up,
// `main` the symptom ticked on opening and `symptoms` the few that zone asks about.
// This is navigation, an app choice; the medical content stays in med-kit.js.

export const ZONES = [
  { id: "sleep", label: "Sleep", side: "left", top: 0, at: [100, 16], lit: ["halo", "brain"], main: "cantSleep", symptoms: ["cantSleep", "wakes", "tired"] },
  { id: "head", label: "Head", side: "right", top: 3, at: [109, 27], lit: ["brain"], main: "headache", symptoms: ["headache", "nausea", "headMove"] },
  { id: "nose", label: "Nose", side: "left", top: 13, at: [100, 41], lit: ["eyes"], main: "stuffy", symptoms: ["stuffy", "fullFace", "headache"] },
  { id: "stomach", label: "Stomach", side: "right", top: 31, at: [113, 158], lit: ["gut"], main: "nausea", symptoms: ["nausea", "vomiting", "appetite", "headMove"] },
  { id: "back", label: "Back", side: "left", top: 37, at: [100, 186], lit: ["skeleton"], main: "backPain", symptoms: ["backPain"] },
  { id: "gut", label: "Gut", side: "right", top: 45, at: [100, 208], lit: ["gut"], main: "constipated", symptoms: ["constipated"] },
  { id: "skin", label: "Skin", side: "left", top: 51, at: [48, 200], lit: ["skin"], main: "rash", symptoms: ["rash"] }
];
