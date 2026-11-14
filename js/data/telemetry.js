// Module 10 data — the words the Live screen shows for each limit. Every `quote` is word for
// word from NASA and repeated in docs/SOURCES.md (tests/telemetry-core.test.js checks it).

const VOL1 = "https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf";
const VOL2 = "https://standards.nasa.gov/system/files/tmp/NASA-STD-3001%20Vol%202%20Rev%20F.pdf";
const CO2 = "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf";
const ATM = "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-003-habitable-atmosphere.pdf";
const LSAH = "https://www.nasa.gov/wp-content/uploads/2023/10/lsah-newsletter-2023-vol28-issue2.pdf";
const EXERCISE = "https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/";
const RADIATION = "https://www.nasa.gov/missions/analog-field-testing/why-space-radiation-matters/";
const SHELTER = "https://www.nasa.gov/missions/artemis/orion/scientists-and-engineers-evaluate-orion-radiation-protection-plan/";

export const LIMIT_FACTS = {
  co2Standard: { quote: "limits the average 1-hour CO2 partial pressure (ppCO2) in the habitat volume to no more than 3 mmHg", url: CO2, source: "NASA OCHMO-TB-004" },
  co2Headache: { quote: "Headaches at levels between 2.8-4.5 mmHg", url: CO2, source: "NASA OCHMO-TB-004" },
  co2Above: { quote: "Fatigue malaise, decreased sleep, and nausea reported at levels above 4.5 mmHg.", url: CO2, source: "NASA OCHMO-TB-004" },
  co2Ppm: { quote: "0.5% CO2 = 3.8 mmHg CO2.", url: CO2, source: "NASA OCHMO-TB-004" },
  temperature: { quote: "anchored at 18°C and 75% humidity on the upper left corner and 27 °C and 25% humidity", url: VOL2, source: "NASA-STD-3001 Vol. 2 [V2 6012]" },
  comfort: { quote: "these atmospheric parameters (20°C - 25°C and 30-60% humidity) to support human comfort and performance", url: VOL2, source: "NASA-STD-3001 Vol. 2 [V2 6013]" },
  humidity: { quote: "25% < RH ≤ 75% (nominal range", url: VOL2, source: "NASA-STD-3001 Vol. 2, Table 6.2-2" },
  pressure: { quote: "between 34.5 kPa < pressure ≤ 103 kPa (5 psia < pressure ≤ 15.0 psia)", url: VOL2, source: "NASA-STD-3001 Vol. 2 [V2 6006]" },
  pressureIss: { quote: "pressure is typically maintained at 14.7 psia with 21% O2, which is equivalent to sea level", url: ATM, source: "NASA OCHMO-TB-003" },
  doseIss: { quote: "receive doses in the order of 0.5 mSv/day", url: LSAH, source: "NASA LSAH bulletin, Oct 2023" },
  doseEvent: { quote: "than an effective dose of 250 mSv.", url: VOL1, source: "NASA-STD-3001 Vol. 1 [V1 4031]" },
  radKinds: { quote: "Space radiation is made up of three kinds of radiation: particles trapped in the Earth’s magnetic field; particles shot into space during solar flares (solar particle events); and galactic cosmic rays, which are high-energy protons and heavy ions from outside our solar system.", url: RADIATION, source: "NASA — Why Space Radiation Matters" },
  radSolar: { quote: "Occasionally, giant explosions, called solar flares, occur on the surface of the Sun and release massive amounts of energy out into space in the form of x-rays, gamma rays, and streams of protons and electrons.", url: RADIATION, source: "NASA — Why Space Radiation Matters" },
  shelter: { quote: "create a shelter using the stowage bags on board", url: SHELTER, source: "NASA — Orion radiation protection plan (2016)" },
  shelterBags: { quote: "Using the stowage bags on board that will contain supplies, food and water", url: SHELTER, source: "NASA — Orion radiation protection plan (2016)" },
  shelterTime: { quote: "If the warning were to sound, the crew would create the shelter within an hour and in some cases would need to stay inside for as long as 24 hours.", url: SHELTER, source: "NASA — Orion radiation protection plan (2016)" },
  shelterWhy: { quote: "The method protects the crew by increasing mass directly surrounding them", url: SHELTER, source: "NASA — Orion radiation protection plan (2016)" },
  exercise: { quote: "Six to seven days a week … resistance training and aerobic exercises for 1.5 hours per day", url: EXERCISE, source: "NASA HRP" }
};

/** What the crew can do when a channel raises an alert. Steps are app rules unless quoted. */
export const RESPONSES = {
  co2: { title: "Cabin CO₂ above NASA's limit", steps: ["Tell the crew and Mission Control: CO₂ removal may be failing.", "Move to a ventilated module and keep the air moving.", "Headache? Open Meds › Head for what to try first."], link: { href: "#meds", text: "Open Meds" }, facts: ["co2Standard", "co2Headache", "co2Above"] },
  dose: { title: "Dose rate far above the usual", steps: ["Tell the crew and Mission Control.", "Follow the flight rules for a solar particle event: move to the most shielded part of the vehicle. NASA's plan for Orion is a shelter built from the stowage bags.", "Log your dosimeter reading in today's check-in."], link: { href: "#log", text: "Open the check-in" }, facts: ["shelter", "shelterTime", "doseEvent"] },
  heartRate: { title: "Heart rate outside the range", steps: ["Stop and rest for five minutes, then look again.", "If it stays out, tell your crew medical officer."], link: { href: "#duty", text: "Fit for duty check" }, facts: [] },
  bloodPressure: { title: "Blood pressure outside the range", steps: ["Sit still and measure again with the cuff.", "If it stays out, tell your crew medical officer."], link: { href: "#log", text: "Open the check-in" }, facts: [] },
  still: { title: "A long time without moving", steps: ["Stand up, stretch or do a short exercise block.", "Exercise counts toward NASA's daily 1.5 hours."], link: { href: "#mission", text: "Open Mission" }, facts: ["exercise"] },
  temperature: { title: "Cabin temperature outside the comfort zone", steps: ["Check the cabin temperature control."], link: null, facts: ["temperature", "comfort"] },
  humidity: { title: "Cabin humidity outside the comfort zone", steps: ["Check the humidity control."], link: null, facts: ["humidity", "comfort"] },
  pressure: { title: "Cabin pressure outside NASA's range", steps: ["Tell the crew and Mission Control now."], link: null, facts: ["pressure"] }
};
