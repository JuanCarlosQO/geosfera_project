// Module 5 data — the NASA words "Future body" shows. Every `quote` is word for word and is
// repeated in docs/SOURCES.md (tests/future-core.test.js checks it).

const RISK = "https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/";
const FIT = "https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/";
const HAZ = "https://www.nasa.gov/hrp/hazards/";
const VOL1 = "https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf";
const NUTRITION = "https://humanresearchroadmap.nasa.gov/evidence/reports/Nutrition.pdf";

export const FUTURE_FACTS = {
  loss: { quote: "on average, bones lose between 1% and 1.5% of their density each month during four-to-six-month missions", url: RISK, source: "NASA HRP, Risk of spaceflight-induced bone changes" },
  requirement: { quote: "Countermeasures shall maintain bone mineral density of the hip and spine at or above 95% of pre-mission values and at or above 90% for the femoral neck.", url: VOL1, source: "NASA-STD-3001 Vol. 1 [V1 4027]" },
  withCountermeasures: { quote: "have resulted in the majority of crewmembers returning with <10% deficit bone mineral density in femoral neck and <5% in total hip or spine during 6-month ISS missions.", url: VOL1, source: "NASA-STD-3001 Vol. 1, rationale of [V1 4027]" },
  drugs: { quote: "decreased the bone loss further (~0% loss) when used in combination with exercise countermeasures.", url: VOL1, source: "NASA-STD-3001 Vol. 1, rationale of [V1 4027]" },
  recovery: { quote: "Post-mission reconditioning shall be aimed at returning bone mineral density to pre-mission baseline.", url: VOL1, source: "NASA-STD-3001 Vol. 1 [V1 4028]" },
  exercise: { quote: "Six to seven days a week … resistance training and aerobic exercises for 1.5 hours per day", url: FIT, source: "NASA HRP" },
  fitness: { quote: "average losses to strength and aerobic fitness are 10-12% of pre-mission levels", url: FIT, source: "NASA HRP" },
  mars: { quote: "roughly three years", url: HAZ, source: "NASA HRP, 5 hazards" },
  marsGravity: { quote: "three-eighths of Earth's gravitational pull for up to two years", url: HAZ, source: "NASA HRP, 5 hazards" },
  vitaminD: { quote: "The problem of weightlessness-induced bone loss must be solved, but vitamin D is not the answer.", url: NUTRITION, source: "NASA HRP evidence report, Inadequate Nutrition (2015)" }
};

export const MISSIONS = [
  { id: "iss", label: "Space Station", months: 6, note: "A usual ISS increment: the missions NASA's 1–1.5 % a month comes from." },
  { id: "mars", label: "Mars", months: 36, note: "NASA: a Mars mission takes “roughly three years”. Beyond 6 months the line is the app's extrapolation." }
];
