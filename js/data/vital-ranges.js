// Vital-sign ranges from Earth clinical references, as gathered by the team in
// "AstroVital — Datos reales para el dashboard" (14 Nov 2026) and listed in docs/SOURCES.md.
// NASA publishes no vital-sign thresholds. These rows are marked "found with source,
// pending team review" in that document, and the app says so. Numbers only: the wording of
// MedlinePlus and ADA is not reproduced.
// Caution from the same document: in flight, 24-hour blood pressure runs about 8 mmHg lower
// and body temperature about 1 °C higher, so Earth ranges can raise false alarms in space.

export const REVIEW_NOTE = "Earth clinical reference, pending team review. In flight, blood pressure runs about 8 mmHg lower and body temperature about 1 °C higher.";

export const RANGES = {
  bloodPressure: {
    // the same categories in AHA/ACC's 2025 guideline, quoted word for word in docs/SOURCES.md
    source: "AHA/ACC 2025 guideline; CDC — About High Blood Pressure",
    url: "https://professional.heart.org/en/science-news/2025-high-blood-pressure-guideline/top-things-to-know",
    judge: ([s, d]) => {
      if (s > 180 || d > 120) return { status: "act", band: "Severe" };
      if (s >= 140 || d >= 90) return { status: "act", band: "Stage 2" };
      if (s >= 130 || d >= 80) return { status: "watch", band: "Stage 1" };
      if (s >= 120) return { status: "watch", band: "Elevated" };
      return { status: "normal", band: "Normal" };
    }
  },
  glucose: {
    source: "American Diabetes Association",
    url: "https://diabetes.org/about-diabetes/diagnosis",
    judge: (v) => (v >= 126 ? { status: "act", band: "Diabetes range" } : v >= 100 ? { status: "watch", band: "Prediabetes range" } : { status: "normal", band: "Normal" })
  },
  heartRate: {
    source: "MedlinePlus — Vital signs",
    url: "https://medlineplus.gov/ency/article/002341.htm",
    judge: (v) => (v >= 60 && v <= 100 ? { status: "normal", band: "60–100 bpm" } : { status: "watch", band: v < 60 ? "Below 60" : "Above 100" })
  },
  temperature: {
    source: "MedlinePlus — Vital signs; CDC (fever 38 °C)",
    url: "https://medlineplus.gov/ency/article/002341.htm",
    judge: (v) => (v >= 38 ? { status: "act", band: "Fever" } : v >= 36.5 && v <= 37.3 ? { status: "normal", band: "36.5–37.3 °C" } : { status: "watch", band: v < 36.5 ? "Below 36.5" : "37.4–37.9" })
  },
  bloodOxygen: {
    source: "MedlinePlus — Pulse oximetry",
    url: "https://medlineplus.gov/lab-tests/pulse-oximetry/",
    judge: (v) => (v <= 88 ? { status: "act", band: "88 % or less" } : v <= 92 ? { status: "watch", band: "92 % or less" } : v < 95 ? { status: "watch", band: "Below 95 %" } : { status: "normal", band: "95–100 %" })
  },
  sleepHours: {
    source: "CDC — About Sleep",
    url: "https://www.cdc.gov/sleep/about/index.html",
    judge: (v) => (v >= 7 ? { status: "normal", band: "7 h or more" } : { status: "watch", band: "Under 7 h" })
  }
};

/** NASA-STD-3001 Vol. 1 Rev. C: career effective dose shall be less than 600 mSv (verified in the team document). */
export const RADIATION_LIMITS = {
  careerMSv: 600,
  eventMSv: 250,
  source: "NASA-STD-3001 Vol. 1 Rev. C, §4.8.2 [V1 4030] and [V1 4031]",
  typicalIssDaily: "about 0.5 mSv per day (LSAH bulletin, Oct 2023)"
};
