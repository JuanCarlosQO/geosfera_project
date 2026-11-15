// Module 10 data — the words the Live screen shows for each limit. Every `quote` is word for
// word from NASA and repeated in docs/SOURCES.md (tests/telemetry-core.test.js checks it).

const VOL1 = "https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf";
const VOL2 = "https://standards.nasa.gov/system/files/tmp/NASA-STD-3001%20Vol%202%20Rev%20F.pdf";
const CO2 = "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf";
const ATM = "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-003-habitable-atmosphere.pdf";
const LSAH = "https://www.nasa.gov/wp-content/uploads/2023/10/lsah-newsletter-2023-vol28-issue2.pdf";
const EXERCISE = "https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/";
const RADIATION = "https://www.nasa.gov/missions/analog-field-testing/why-space-radiation-matters/";
const BIOMON = "https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp";
const PCO2M = "https://www.nasa.gov/blogs/stationreport/2016/07/19/iss-daily-summary-report-07-19-16/";
const SUITS = "https://spinoff.nasa.gov/astronaut-remote-health-monitoring";
const DNA = "https://www.nasa.gov/humans-in-space/space-radiation-is-risky-business-for-the-human-body/";
const SHELTER = "https://www.nasa.gov/missions/artemis/orion/scientists-and-engineers-evaluate-orion-radiation-protection-plan/";

export const LIMIT_FACTS = {
  co2Standard: { quote: "limits the average 1-hour CO2 partial pressure (ppCO2) in the habitat volume to no more than 3 mmHg", url: CO2, source: "NASA OCHMO-TB-004" },
  co2Headache: { quote: "Headaches at levels between 2.8-4.5 mmHg", url: CO2, source: "NASA OCHMO-TB-004" },
  co2Above: { quote: "Fatigue malaise, decreased sleep, and nausea reported at levels above 4.5 mmHg.", url: CO2, source: "NASA OCHMO-TB-004" },
  co2Pockets: { quote: "provide circulation that prevents CO2 and thermal pockets from forming", url: CO2, source: "NASA OCHMO-TB-004, quoting NASA-STD-3001 [V2 6107]" },
  co2Nodes: { quote: "There is a slight variation across the different nodes of the ISS due to location of CO2 scrubbing equipment and ventilation patterns.", url: CO2, source: "NASA OCHMO-TB-004" },
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
  wearParts: { quote: "This system, which includes a smart shirt, headband and dedicated tablet application", url: BIOMON, source: "Canadian Space Agency — Bio-Monitor" },
  wearHeart: { quote: "pulse and electrical activity of the heart", url: BIOMON, source: "Canadian Space Agency — Bio-Monitor" },
  wearBase: { quote: "Once finished, the astronaut disconnects the battery pack and plugs it into a base", url: BIOMON, source: "Canadian Space Agency — Bio-Monitor" },
  wearPaired: { quote: "The Personal CO2 Monitor was then paired to the iPad", url: PCO2M, source: "NASA ISS Daily Summary Report, 19 Jul 2016" },
  wearUpload: { quote: "The data collected will be uploaded to the Space Station Computer via the iPad app before being powered off and stowed.", url: PCO2M, source: "NASA ISS Daily Summary Report, 19 Jul 2016" },
  suitSensors: { quote: "their spacesuits contain numerous sensors that monitor body temperature, heart rate, how much they sweat, and more.", url: SUITS, source: "NASA Spinoff (2020)" },
  suitData: { quote: "That data is automatically sent to NASA and distributed to the flight surgeon, biomedical engineers, and others.", url: SUITS, source: "NASA Spinoff (2020)" },
  dnaDamage: { quote: "The primary means by which radiation effects cells is by damaging DNA", url: DNA, source: "NASA — Space Radiation is Risky Business for the Human Body (2017)" },
  dnaBases: { quote: "DNA bases (adenine, guanine, cytosine, and thymine) can also be knocked out.", url: DNA, source: "NASA — Space Radiation is Risky Business for the Human Body (2017)" },
  dnaRepair: { quote: "The cell will make an attempt to repair these damages.", url: DNA, source: "NASA — Space Radiation is Risky Business for the Human Body (2017)" },
  dnaCancer: { quote: "Genes that have been misrepaired can become mutations, and the accumulation of these mutations over time can potentially lead to cancer.", url: DNA, source: "NASA — Space Radiation is Risky Business for the Human Body (2017)" },
  dnaHard: { quote: "It’s difficult to quantify exactly how radiation is interacting with tissues and cells", url: DNA, source: "NASA — Space Radiation is Risky Business for the Human Body (2017)" },
  exercise: { quote: "Six to seven days a week … resistance training and aerobic exercises for 1.5 hours per day", url: EXERCISE, source: "NASA HRP" }
};

/** What the crew can do when a channel raises an alert. Steps are app rules unless quoted. */
export const RESPONSES = {
  co2: { title: "Cabin CO₂ above NASA's limit", steps: ["Tell the crew and Mission Control: CO₂ removal may be failing.", "Move to a ventilated module and keep the air moving.", "Headache? Open Meds › Head for what to try first."], link: { href: "#meds", text: "Open Meds" }, facts: ["co2Standard", "co2Headache", "co2Above"] },
  dose: { title: "Dose rate far above the usual", steps: ["Tell the crew and Mission Control.", "Follow the flight rules for a solar particle event: move to the most shielded part of the vehicle. NASA's plan for Orion is a shelter built from the stowage bags.", "Log your dosimeter reading in today's check-in."], link: { href: "#log", text: "Open the check-in" }, facts: ["shelter", "shelterTime", "doseEvent"] },
  co2Pocket: { title: "CO₂ pocket around you", steps: ["The cabin reading is normal: it is the air around you that is not moving.", "Move, and point the nearest fan or vent at where you are.", "Headache or short of breath once the air is moving? Tell your crew medical officer."], link: null, facts: ["co2Pockets", "co2Headache", "co2Above"], illustrative: true },
  sensorChest: { title: "Chest sensor: no signal", steps: ["This is the sensor, not the heart: no heart rate is shown until it reads again.", "Press the chest band flat against the skin, or moisten its contacts.", "Still nothing? Measure by hand and log it in the check-in."], link: { href: "#log", text: "Open the check-in" }, facts: [], illustrative: true },
  sensorCuff: { title: "Arm cuff is off: battery empty", steps: ["No blood pressure is shown until the cuff is back.", "Change or charge the battery, then measure again."], link: null, facts: [], illustrative: true },
  sensorBattery: { title: "Arm cuff battery is low", steps: ["Change or charge it at the next break, before it stops.", "Readings are still good for now."], link: null, facts: [], illustrative: true },
  sensorLink: { title: "No data from the body sensors", steps: ["No reading is not a normal reading: nothing from the body is being judged.", "Bring the tablet closer and check that the sensors are on.", "Out of reach for long? A crewmate checks on them in person."], link: null, facts: [], illustrative: true },
  heartRate: { title: "Heart rate outside the range", steps: ["Stop and rest for five minutes, then look again.", "If it stays out, tell your crew medical officer."], link: { href: "#duty", text: "Fit for duty check" }, facts: [] },
  bloodPressure: { title: "Blood pressure outside the range", steps: ["Sit still and measure again with the cuff.", "If it stays out, tell your crew medical officer."], link: { href: "#log", text: "Open the check-in" }, facts: [] },
  still: { title: "A long time without moving", steps: ["Stand up, stretch or do a short exercise block.", "Exercise counts toward NASA's daily 1.5 hours."], link: { href: "#mission", text: "Open Mission" }, facts: ["exercise"] },
  hrExercise: { title: "Heart rate very high for a workout", steps: ["Lower the intensity, or stop if it does not come down.", "Chest pain, dizziness or shortness of breath: stop and tell your crew medical officer."], link: { href: "#duty", text: "Fit for duty check" }, facts: [], illustrative: true },
  hrEva: { title: "Heart rate high during the spacewalk", steps: ["Slow the work and hold on to a fixed point.", "Tell your partner and Mission Control.", "If it stays high, get ready to go back to the airlock."], link: null, facts: [], illustrative: true },
  hrRecovery: { title: "Heart rate slow to recover", steps: ["Sit and breathe slowly.", "If it is still high in five minutes, tell your crew medical officer."], link: null, facts: [], illustrative: true },
  smoke: { title: "Smoke in the cabin", steps: ["Tell the whole crew and Mission Control.", "Follow the fire emergency procedure of your vehicle: mask on, find the source, stop the ventilation of that module.", "If it cannot be put out, get ready to evacuate."], link: null, facts: [], illustrative: true },
  ammonia: { title: "Ammonia in the cabin air", steps: ["Mask on and tell the whole crew.", "Follow the toxic-atmosphere procedure of your vehicle: leave the module and isolate it.", "Tell Mission Control."], link: null, facts: [], illustrative: true },
  power: { title: "Power running low", steps: ["Switch off what is not essential.", "Keep life support and communications.", "Watch CO₂ and temperature: the fans may slow down.", "Tell Mission Control."], link: null, facts: [], illustrative: true },
  hydration: { title: "Estimated hydration is low", steps: ["Drink water or an electrolyte drink and rest.", "Avoid hard effort for now.", "If it keeps falling, tell your crew medical officer."], link: { href: "#log", text: "Open the check-in" }, facts: [], illustrative: true },
  stopExercise: { title: "Stop exercising: there is a cabin emergency", steps: ["Stop now and follow the steps of the emergency.", "Hard breathing uses your reserve and adds CO₂ to the air."], link: null, facts: [], illustrative: true },
  endEva: { title: "End the spacewalk: radiation is rising", steps: ["Go back to the airlock by the shortest route.", "Tell Mission Control."], link: null, facts: ["shelter"], illustrative: true },
  temperature: { title: "Cabin temperature outside the comfort zone", steps: ["Check the cabin temperature control."], link: null, facts: ["temperature", "comfort"] },
  humidity: { title: "Cabin humidity outside the comfort zone", steps: ["Check the humidity control."], link: null, facts: ["humidity", "comfort"] },
  pressure: { title: "Cabin pressure is dropping or out of range", steps: ["Tell the crew and Mission Control now.", "Follow the depressurisation procedure of your vehicle: close the hatches of the affected module and get the emergency equipment ready."], link: null, facts: ["pressure"], illustrative: true }
};
