// Mind & support data — the NASA words the support screens show. Every `quote` is word for
// word from NASA and repeated in docs/SOURCES.md (tests/support-core.test.js checks it).

const BH = "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-016-behavioral-health.pdf";
const DIST = "https://www.nasa.gov/hrp/hazard-distance-from-earth/";
const SRC = "NASA OCHMO-TB-016, Behavioral Health and Performance";

export const SUPPORT_FACTS = {
  ppc: { quote: "Private psychological conferences (PPCs) are currently provided", url: BH, source: SRC },
  always: { quote: "current behavioral health support is provided before, during, and after the mission.", url: BH, source: SRC },
  baseline: { quote: "A preflight baseline is obtained for each astronaut and is then compared using a monthly in-flight test.", url: BH, source: SRC },
  longMissions: { quote: "For missions beyond 6 months and/or beyond LEO, additional minimally obtrusive measures that objectively evaluate psychological and behavioral states within the mission context should be provided.", url: BH, source: SRC },
  delay: { quote: "Facing a communication delay of up to 20 minutes one way", url: DIST, source: "NASA HRP, Distance from Earth" }
};

// What the crew member can tick after asking for support (optional, never before an SOS; app choice).
export const REASONS = [
  { id: "anxious", label: "Anxious or panicky" },
  { id: "low", label: "Low or overwhelmed" },
  { id: "sleep", label: "Can't sleep" },
  { id: "crew", label: "Tension with the crew" },
  { id: "home", label: "Missing home or family" },
  { id: "sensory", label: "Too much noise, light or input" },
  { id: "body", label: "Something physical" },
  { id: "other", label: "Something else" }
];

export const LEVELS = {
  talk: { label: "I'd like to talk to someone", short: "Wants to talk", note: "Not urgent. Your crew medical officer is asked to reach you and to book a private conference with Earth." },
  emergency: { label: "SOS — I need help now", short: "SOS", note: "Urgent. Every linked crew device shows it at once, and the alert is queued for Mission Control." }
};

// Comfort settings for different sensory and attention needs (neuro-inclusive design; app choices).
export const COMFORT = [
  { id: "calm", label: "Calm motion", help: "Stops animations, blinking dots and moving scan lines." },
  { id: "large", label: "Larger text", help: "Makes all text about 15 % bigger." },
  { id: "focus", label: "One thing at a time", help: "Hides sources and side notes until you open them." }
];
