// Module 2 — how Geosfera groups the body for the hologram.
// The grouping is an app choice; every risk name and every fact comes from an official
// source (js/data/nasa-risks.js and docs/SOURCES.md). Quotes are exact.

export const SYSTEMS = [
  {
    id: "brain",
    name: "Brain & eyes",
    regions: ["brain", "eyes"],
    anchor: [100, 30],
    risks: [
      "Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)",
      "Risk of Altered Sensorimotor and Vestibular Function"
    ],
    facts: [
      {
        quote: "Approximately 70 percent of astronauts aboard the International Space Station experience some swelling in the back of their eyes.",
        source: "NASA — Risk of SANS",
        url: "https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/"
      }
    ]
  },
  {
    id: "mind",
    name: "Mind & sleep",
    regions: ["brain", "halo"],
    anchor: [112, 18],
    risks: [
      "Risk of Inadequate Sleep and Irregular Schedules",
      "Risk of Behavioral Changes and Psychiatric Disorders",
      "Risk of Inadequate Teamwork",
      "Risk of Inadequate Systems Operations Support"
    ],
    facts: [
      {
        quote: "Astronauts witness 16 sunrises and sunsets per day aboard the space station",
        source: "NASA — Risk from inadequate sleep and irregular schedules",
        url: "https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/"
      }
    ]
  },
  {
    id: "heart",
    name: "Heart & vessels",
    regions: ["heart", "vessels"],
    anchor: [106, 118],
    risks: ["Risk of Cardiovascular Adaptations"],
    facts: [
      {
        quote: "blood clots, heart arrythmias, cardiovascular disease, and low blood pressure which elevates the chances of fainting at landing",
        source: "NASA — Risk of cardiovascular adaptations",
        url: "https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/"
      }
    ]
  },
  {
    id: "lungs",
    name: "Lungs & oxygen",
    regions: ["lungs"],
    anchor: [86, 112],
    risks: [
      "Risk of Hypoxia",
      "Risk of Decompression Sickness",
      "Risk of Injury and Compromised Performance from Spacewalks"
    ],
    facts: [
      {
        quote: "Mild hypoxia, if untreated, can cause confusion, headaches, vision impairment, and trouble sleeping.",
        source: "NASA — Risk of hypoxia",
        url: "https://www.nasa.gov/reference/risk-of-hypoxia/"
      }
    ]
  },
  {
    id: "immune",
    name: "Immune & gut",
    regions: ["gut"],
    anchor: [100, 182],
    risks: [
      "Risk of Altered Immune System Responses",
      "Risk of Host-Microorganism Interactions",
      "Risk of Inadequate Food and Nutrition"
    ],
    facts: []
  },
  {
    id: "musculo",
    name: "Bones & muscles",
    regions: ["skeleton"],
    anchor: [82, 300],
    risks: [
      "Risk of Spaceflight-Induced Bone Changes",
      "Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness",
      "Risk of Injury from Dynamic Loads"
    ],
    facts: [
      {
        quote: "on average, bones lose between 1% and 1.5% of their density each month during four-to-six-month missions",
        source: "NASA — Risk of spaceflight-induced bone changes",
        url: "https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/"
      },
      {
        quote: "average losses to strength and aerobic fitness are 10-12% of pre-mission levels",
        source: "NASA — Risk of reduced cardiorespiratory and musculoskeletal fitness",
        url: "https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/"
      },
      {
        quote: "the height of crew members can increase as much as 3% in space",
        source: "NASA — Risk of spaceflight-induced bone changes",
        url: "https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/"
      }
    ]
  },
  {
    id: "radiation",
    name: "Radiation",
    regions: ["skin"],
    anchor: [136, 214],
    risks: ["Risk of Radiation-Induced Cancers"],
    facts: [
      {
        quote: "Neutron radiation, which contributes to about 30% of total radiation on the ISS",
        source: "Canadian Space Agency — Monitoring radiation for astronaut health",
        url: "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp"
      },
      {
        quote: "entirely within the magnetosphere",
        source: "NASA — Risk of radiation-induced cancers (missions to the space station)",
        url: "https://www.nasa.gov/reference/risk-of-radiation-induced-cancers/"
      }
    ]
  }
];

/** Status shown for a system. Module 2 has no readings yet, so every system is "No data". */
export const STATUS = {
  normal: { word: "Normal", shape: "●", tone: "normal" },
  watch: { word: "Watch", shape: "▲", tone: "watch" },
  act: { word: "Act now", shape: "⯃", tone: "act" },
  again: { word: "Measure again", shape: "◌", tone: "again" },
  pending: { word: "Pending check", shape: "◇", tone: "none" },
  logged: { word: "Logged", shape: "✓", tone: "none" },
  none: { word: "No data", shape: "—", tone: "none" }
};
