// Module 9 data — the words Fit for duty shows. Every `quote` is word for word from NASA
// and repeated in docs/SOURCES.md (tests/duty-core.test.js checks it).

const STD = "https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf";
const SLEEP = "https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf";

export const TASKS = [
  { id: "eva", label: "Spacewalk" },
  { id: "docking", label: "Docking or robotics" },
  { id: "other", label: "Another critical task" }
];

// NASA-STD-3001 names the three parts of cognitive workload; the 1-5 scale is an app rule.
export const WORKLOAD = [
  { id: "time", label: "Time pressure", ask: "How rushed do you feel?" },
  { id: "effort", label: "Mental effort", ask: "How hard do you have to think?" },
  { id: "frustration", label: "Frustration", ask: "How frustrated are you?" }
];
export const LEVELS = ["Very low", "Low", "Medium", "High", "Very high"];

export const DUTY_FACTS = {
  sleep: { quote: "an average adult needs 7-9 hours of sleep for optimal daytime functioning", url: SLEEP, source: "NASA OCHMO Sleep Accommodations" },
  sleepWhy: { quote: "Sleep loss and fatigue can cause errors in judgment and impairments to memory and cognition", url: SLEEP, source: "NASA OCHMO Sleep Accommodations" },
  workload: { quote: "perceived level of time-stress, mental effort, and frustration required to complete a task", url: STD, source: "NASA-STD-3001 Vol. 1, 4.3" },
  workloadWhy: { quote: "Perceived high or low workload can lead to crew hurrying, compromised performance, and increased crew stress", url: STD, source: "NASA-STD-3001 Vol. 1, 4.3" },
  limits: { quote: "shall have established limits to assure continued crew health and safety", url: STD, source: "NASA-STD-3001 Vol. 1 [V1 4014]" },
  monitored: { quote: "cognitive state will be assessed and monitored through all mission phases", url: STD, source: "NASA-STD-3001 Vol. 1, 4.3" }
};
