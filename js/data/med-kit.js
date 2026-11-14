// Module 8 data — common in-flight complaints and the medications NASA lists in the ISS
// medical kit. Every `quote` is word for word from an official source and is repeated in
// docs/SOURCES.md (tests/meds-data.test.js checks it). The numbers in each `dose` rule are
// read from the quoted label or kit-list text beside them. `reviewedBy` stays null until the
// team pharmacist signs the entry off; until then the screen shows "Pending check".
// Stock and expiry dates in `demo` are SIMULATED.

const KIT_LIST = "https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf";
const SAS = "https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf";
const CO2 = "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf";
const PHARM = "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-006-pharmaceuticals.pdf";
const SLEEP = "https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf";
const RASH = "https://humanresearchroadmap.nasa.gov/Evidence/medicalConditions/Skin_Rash.pdf";
const STABILITY = "https://ntrs.nasa.gov/citations/20230018496";
const NCCIH = "https://www.nccih.nih.gov/health/melatonin-what-you-need-to-know";
const label = (setId) => `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}`;

const N_SAS = "NASA OCHMO-MTB-004";
const N_KIT = "NASA ISS medical kit list";
const N_PHARM = "NASA OCHMO-MTB-012";

export const SYMPTOMS = [
  { id: "nausea", label: "Nausea", area: "Stomach and balance" },
  { id: "vomiting", label: "Vomiting", area: "Stomach and balance" },
  { id: "appetite", label: "No appetite", area: "Stomach and balance" },
  { id: "headMove", label: "Worse when I move my head", area: "Stomach and balance" },
  { id: "headache", label: "Headache", area: "Head and nose" },
  { id: "stuffy", label: "Stuffy nose", area: "Head and nose" },
  { id: "fullFace", label: "Full or puffy face", area: "Head and nose" },
  { id: "cantSleep", label: "Cannot fall asleep", area: "Sleep" },
  { id: "wakes", label: "Waking up often", area: "Sleep" },
  { id: "tired", label: "Tired during the day", area: "Sleep" },
  { id: "backPain", label: "Low back pain", area: "Back, skin and gut" },
  { id: "rash", label: "Red or itchy skin", area: "Back, skin and gut" },
  { id: "constipated", label: "Constipated", area: "Back, skin and gut" }
];

// App rule: with any of these the module steps aside and sends the crew member to a person.
export const RED_FLAGS = [
  { id: "chest", label: "Chest pain" },
  { id: "breath", label: "Trouble breathing" },
  { id: "faint", label: "Fainting" },
  { id: "blood", label: "Blood in vomit or stool" },
  { id: "vision", label: "Sudden change in vision" },
  { id: "weak", label: "Numbness or weakness" },
  { id: "fever", label: "Fever" }
];

export const SIDE_EFFECTS = [
  { id: "drowsy", label: "Drowsy" },
  { id: "dizzy", label: "Dizzy" },
  { id: "stomach", label: "Upset stomach" },
  { id: "headache", label: "Headache" },
  { id: "dryMouth", label: "Dry mouth" },
  { id: "other", label: "Something else" }
];

export const CONDITIONS = [
  {
    id: "sms",
    name: "Space motion sickness",
    signs: ["nausea", "vomiting", "appetite", "headMove", "headache"],
    core: ["nausea", "vomiting"],
    about: { quote: "affects up to 73% of crewmembers during the first 2-3 days of spaceflight", url: SAS, source: N_SAS },
    first: [
      { text: "Move your head slowly and as little as you can.", quote: "Training to minimize head and provocative movements", url: SAS, source: N_SAS },
      { text: "Get more air moving around you.", quote: "Increased air movement/circulation", url: SAS, source: N_SAS },
      { text: "Keep drinking.", quote: "Maintain hydration", url: SAS, source: N_SAS }
    ],
    options: ["meclizine", "promethazine"],
    officer: { text: "Tell your crew medical officer if you vomit more than twice or it lasts past 72 hours. NASA calls that severe:", quote: "includes more than 2 episodes of vomiting; significant performance decrement may be apparent; symptoms may persist beyond 72 hours", url: SAS, source: N_SAS }
  },
  {
    id: "headache",
    name: "Headache",
    signs: ["headache"],
    core: ["headache"],
    about: { quote: "Headaches are reported by up to 90% of astronauts during the first few days.", url: SAS, source: N_SAS },
    first: [
      { text: "Look at the cabin CO2 reading; tell the crew if it is high.", quote: "To keep the risk of headache below 1%, average 7-day CO2 needs to be maintained below 2.5 mmHg", url: CO2, source: "NASA OCHMO-TB-004" },
      { text: "Drink, rest, and keep to your sleep and exercise.", quote: "Treatment includes sleep, exercise, hydration, coffee intake, and analgesics including acetaminophen, aspirin, or NSAIDS.", url: SAS, source: N_SAS },
      { text: "Think about what else is going on: the wrong treatment will not help.", quote: "a headache can be caused by congestion, fluid shifts, elevated CO2", url: PHARM, source: N_PHARM }
    ],
    options: ["acetaminophen", "ibuprofen"],
    officer: { text: "App rule: tell your crew medical officer if it keeps coming back or pain relievers do not help." }
  },
  {
    id: "congestion",
    name: "Head and nose congestion",
    signs: ["stuffy", "fullFace", "headache"],
    core: ["stuffy", "fullFace"],
    about: { quote: "The SAS related nasal congestion lasts from a few hours to a few days", url: SAS, source: N_SAS },
    first: [
      { text: "Give it time: early in flight this is body fluid moving to your head, and decongestants may not help.", quote: "fluid shifts to the head can appear as nasal congestion but will not be relieved by decongestants", url: PHARM, source: N_PHARM },
      { text: "Try the saline nasal spray from the Convenience Medication Pack.", quote: "No significant side effects within prescribed dose", url: KIT_LIST, source: `${N_KIT}, Sodium Chloride (AYR Saline)` }
    ],
    options: ["oxymetazoline", "pseudoephedrine"],
    officer: { text: "Tell your crew medical officer if it comes with a fever or lasts more than a week. The decongestant label says to stop and ask when:", quote: "symptoms do not improve within 7 days or occur with a fever", url: label("00a8327b-41f0-4498-ad13-331256b539f9"), source: "Pseudoephedrine label" }
  },
  {
    id: "sleep",
    name: "Trouble sleeping",
    signs: ["cantSleep", "wakes", "tired"],
    core: ["cantSleep", "wakes"],
    about: { quote: "astronauts sleep an average of about six hours while in space", url: SLEEP, source: "NASA OCHMO Sleep Accommodations" },
    first: [
      { text: "Dim the lights before sleep and avoid bright light at the wrong time.", quote: "Exposure to light at inappropriate times leads to circadian misalignment, which causes sleep disruption.", url: SLEEP, source: "NASA OCHMO Sleep Accommodations" },
      { text: "Check noise, temperature and light in your sleep station.", quote: "environmental factors (e.g., noise, temperature, vibration, and light) inhibit sleep and impact well-being in space", url: SLEEP, source: "NASA OCHMO Sleep Accommodations" }
    ],
    options: ["melatonin", "zolpidem"],
    officer: { text: "App rule: tell your crew medical officer if you sleep badly for several nights in a row." }
  },
  {
    id: "back",
    name: "Space adaptation back pain",
    signs: ["backPain"],
    core: ["backPain"],
    about: { quote: "Space Adaptation Back Pain (SABP) occurs in 52% of space travelers during the first 2-5 days of flight.", url: SAS, source: N_SAS },
    first: [
      { text: "Try positioning exercises and your scheduled exercise first.", quote: "Positioning exercises, analgesic medications, and exercise are used to manage symptoms", url: SAS, source: N_SAS }
    ],
    options: ["acetaminophen", "ibuprofen"],
    officer: { text: "App rule: pain that shoots down a leg, or any numbness or weakness, needs your crew medical officer." }
  },
  {
    id: "rash",
    name: "Skin rash",
    signs: ["rash"],
    core: ["rash"],
    about: { quote: "Skin rashes are a common problem in space flight, and may be caused by a contact dermatitis (irritant or allergic in nature) or infection.", url: RASH, source: "NASA Human Research Roadmap" },
    first: [
      { text: "Work out what touched the skin there and keep it away.", quote: "Contact dermatitis may result from irritants or allergens found in the space craft cabin coming in contact with the skin.", url: RASH, source: "NASA Human Research Roadmap" }
    ],
    options: ["hydrocortisone"],
    officer: { text: "Rash treatments are the ones crews most often reported as not working, so say if it does not clear:", quote: "3 reports of ineffective medication use involved topical rash treatments.", url: PHARM, source: N_PHARM }
  },
  {
    id: "constipation",
    name: "Constipation",
    signs: ["constipated"],
    core: ["constipated"],
    about: { quote: "Some crew experience constipation that may be caused by alterations in bowel induced by microgravity.", url: SAS, source: N_SAS },
    first: [
      { text: "Drink more and eat the high-fibre items on your menu.", quote: "Crew is treated with fluid management and fiber in diet; stool softeners and laxatives are available if needed", url: SAS, source: N_SAS }
    ],
    options: ["bisacodyl"],
    officer: { text: "Tell your crew medical officer if nothing happens after a dose or you need it for more than a week. The label says to stop and ask when:", quote: "you need to use a laxative for more than 1 week", url: label("02358772-6724-4f1a-b3d8-bc36e58b5cfc"), source: "Bisacodyl label" }
  }
];

const kitSays = (head, quote) => ({ head: `NASA kit list: ${head}`, quote, url: KIT_LIST });

export const KIT = [
  {
    id: "acetaminophen", form: "tablet", tint: "#f2f4f7", name: "Acetaminophen", strength: "325 mg", unit: "tablet", ingredient: "acetaminophen", tags: ["pain"],
    labelName: "TYLENOL Regular Strength, 325 mg (Kenvue)",
    use: { quote: "temporarily relieves minor aches and pains due to: headache muscular aches backache", url: label("01f41fae-4abb-4b96-ab09-a7d3dfc286cd") },
    directions: { quote: "take 2 caplets every 4 to 6 hours while symptoms last do not take more than 10 caplets in 24 hours, unless directed by a doctor", url: label("01f41fae-4abb-4b96-ab09-a7d3dfc286cd") },
    dose: { unitsPerDose: [2, 2], everyHours: 4, maxUnitsPerDay: 10 },
    warnings: [
      { head: "Label: liver warning", quote: "more than 4,000 mg of acetaminophen in 24 hours", url: label("01f41fae-4abb-4b96-ab09-a7d3dfc286cd") },
      { head: "Label: do not use", quote: "with any other drug containing acetaminophen (prescription or nonprescription)", url: label("01f41fae-4abb-4b96-ab09-a7d3dfc286cd") },
      kitSays("comments", "No more than 12 tablets every 24 hours.")
    ],
    note: "The label limit (10 in 24 hours) is lower than the kit list's (12). Geosfera follows the lower one.",
    askAfterHours: 1, reviewedBy: null, demo: { stock: 40, expiresInDays: 310 }
  },
  {
    id: "ibuprofen", form: "caplet", tint: "#e8845c", name: "Ibuprofen", strength: "400 mg", unit: "tablet", ingredient: "ibuprofen", tags: ["pain"], rx: true,
    labelName: "Ibuprofen Tablets USP, 400 mg (Aurobindo)",
    use: { quote: "indicated for relief of mild to moderate pain", url: label("00872852-680a-41b3-901b-b991b12a176d") },
    directions: { quote: "Mild to moderate pain: 400 mg every 4 to 6 hours as necessary for relief of pain", url: label("00872852-680a-41b3-901b-b991b12a176d") },
    dose: { unitsPerDose: [1, 1], everyHours: 4, maxUnitsPerDay: 8 },
    warnings: [
      kitSays("comments", "No more than 8 tablets every 24 hours. Take with food."),
      kitSays("possible side effects", "Dizziness, nervousness, upset stomach, nausea, vomiting, rash, ringing in the ears"),
      { head: "Label: daily limit", quote: "Do not exceed 3200 mg total daily dose", url: label("00872852-680a-41b3-901b-b991b12a176d") }
    ],
    askAfterHours: 1, reviewedBy: null, demo: { stock: 60, expiresInDays: 420 }
  },
  {
    id: "meclizine", form: "tablet", tint: "#f3d36b", name: "Meclizine", strength: "25 mg", unit: "tablet", ingredient: "meclizine", tags: ["drowsy"],
    labelName: "Dramamine Chewable, meclizine 25 mg (Medtech)",
    use: { quote: "prevention and treatment of these symptoms associated with motion sickness: nausea vomiting dizziness", url: label("30387e63-278d-412a-bcad-7965c7c0aea7") },
    directions: { quote: "1 to 2 tablets once daily, or as directed by a doctor", url: label("30387e63-278d-412a-bcad-7965c7c0aea7") },
    dose: { unitsPerDose: [1, 2], everyHours: null, maxUnitsPerDay: 2, maxDosesPerDay: 1 },
    warnings: [
      kitSays("comments", "May cause sedation and impair performance. Do not use with sleep meds."),
      kitSays("possible side effects", "Drowsiness, headache, fatigue, nervousness, dizziness, dry mouth, blurred vision"),
      { head: "Label: when using", quote: "alcohol, sedatives, and tranquilizers may increase drowsiness", url: label("30387e63-278d-412a-bcad-7965c7c0aea7") }
    ],
    askFirst: [{ tag: "sleep", quote: "Do not use with sleep meds.", url: KIT_LIST }],
    performance: { quote: "May cause sedation and impair performance. Do not use with sleep meds.", url: KIT_LIST },
    askAfterHours: 2, reviewedBy: null, demo: { stock: 12, expiresInDays: 200 }
  },
  {
    id: "promethazine", form: "tablet", tint: "#9ad0f5", name: "Promethazine", strength: "25 mg", unit: "tablet", ingredient: "promethazine", tags: ["drowsy"], rx: true,
    labelName: "Promethazine Hydrochloride Tablets (Coupler)",
    use: { quote: "Active and prophylactic treatment of motion sickness", url: label("2d996287-9eed-265a-e063-6294a90a6969") },
    directions: { quote: "The average adult dose is 25 mg taken twice daily", url: label("2d996287-9eed-265a-e063-6294a90a6969") },
    dose: { unitsPerDose: [1, 1], everyHours: 8, maxUnitsPerDay: 2 },
    warnings: [
      { head: "Label: repeat dose", quote: "one-half to one hour before anticipated travel and be repeated 8 to 12 hours later, if necessary", url: label("2d996287-9eed-265a-e063-6294a90a6969") },
      kitSays("comments", "May cause sedation and impair performance. Do not use with sleep meds."),
      { head: "Label: warning", quote: "may cause marked drowsiness", url: label("2d996287-9eed-265a-e063-6294a90a6969") }
    ],
    askFirst: [{ tag: "sleep", quote: "Do not use with sleep meds.", url: KIT_LIST }],
    performance: { quote: "May cause sedation and impair performance. Do not use with sleep meds.", url: KIT_LIST },
    askAfterHours: 2, reviewedBy: null, demo: { stock: 16, expiresInDays: -40 }
  },
  {
    id: "oxymetazoline", form: "spray", tint: "#7fd6c2", name: "Oxymetazoline nasal spray", strength: "0.05 %", unit: "dose", ingredient: "oxymetazoline", tags: ["decongestant"],
    labelName: "Afrin Original Pump Mist (Bayer)",
    use: { quote: "temporarily relieves sinus congestion and pressure", url: label("0f5ec576-f788-40aa-9088-0dd672e3cc7c") },
    directions: { quote: "2 or 3 sprays in each nostril not more often than every 10 to 12 hours. Do not exceed 2 doses in any 24-hour period.", url: label("0f5ec576-f788-40aa-9088-0dd672e3cc7c") },
    dose: { unitsPerDose: [1, 1], everyHours: 10, maxUnitsPerDay: 2 },
    warnings: [
      kitSays("comments", "Do not use more than 3 consecutive days. Rebound congestion with prolonged use."),
      { head: "Label: when using", quote: "Frequent or prolonged use may cause nasal congestion to recur or worsen", url: label("0f5ec576-f788-40aa-9088-0dd672e3cc7c") }
    ],
    askAfterHours: 1, reviewedBy: null, demo: { stock: 30, expiresInDays: 24 }
  },
  {
    id: "pseudoephedrine", form: "caplet", tint: "#e2616b", name: "Pseudoephedrine 12-hour", strength: "120 mg", unit: "tablet", ingredient: "pseudoephedrine", tags: ["decongestant"],
    labelName: "Pseudoephedrine HCl 120 mg, 12-hour (Kroger)",
    use: { quote: "temporarily relieves nasal congestion due to the common cold, hay fever or other upper respiratory allergies", url: label("00a8327b-41f0-4498-ad13-331256b539f9") },
    directions: { quote: "take 1 tablet every 12 hours do not take more than 2 tablets in 24 hours", url: label("00a8327b-41f0-4498-ad13-331256b539f9") },
    dose: { unitsPerDose: [1, 1], everyHours: 12, maxUnitsPerDay: 2 },
    warnings: [
      kitSays("possible side effects", "Dizziness, rapid heart rate, high blood pressure, restlessness, tremor, headache, loss of appetite, may impair ability to concentrate, dry mouth, insomnia, photosensitivity"),
      { head: "Label: stop and ask if", quote: "nervousness, dizziness, or sleeplessness occur", url: label("00a8327b-41f0-4498-ad13-331256b539f9") }
    ],
    inFlight: { quote: "Treatment: pharmaceuticals such as pseudoephedrine (congestion or allergy medications).", url: SAS, source: N_SAS },
    performance: { quote: "Dizziness, rapid heart rate, high blood pressure, restlessness, tremor, headache, loss of appetite, may impair ability to concentrate, dry mouth, insomnia, photosensitivity", url: KIT_LIST },
    askAfterHours: 2, reviewedBy: null, demo: { stock: 20, expiresInDays: 150 }
  },
  {
    id: "melatonin", form: "tablet", tint: "#b9a5f0", name: "Melatonin", strength: "3 mg", unit: "tablet", ingredient: "melatonin", tags: ["sleep"], noLabel: true,
    labelName: "No FDA label: NIH NCCIH fact sheet",
    use: { quote: "In the United States, melatonin is considered a dietary supplement.", url: NCCIH },
    directions: { quote: "Short-term use of melatonin supplements appears to be safe for most people, but information on the long-term safety of supplementing with melatonin is lacking.", url: NCCIH },
    dose: { unitsPerDose: [1, 1], everyHours: null, maxUnitsPerDay: null },
    warnings: [
      kitSays("comments", "Do not use with other sleep meds."),
      kitSays("possible side effects", "Headache, nausea, drowsiness, dizziness")
    ],
    askFirst: [
      { tag: "sleep", quote: "Do not use with other sleep meds.", url: KIT_LIST },
      { tag: "drowsy", quote: "May cause sedation and impair performance. Do not use with sleep meds.", url: KIT_LIST }
    ],
    performance: { quote: "Headache, nausea, drowsiness, dizziness", url: KIT_LIST },
    askAfterHours: 9, reviewedBy: null, demo: { stock: 20, expiresInDays: 12 }
  },
  {
    id: "zolpidem", form: "caplet", tint: "#f4f1ea", name: "Zolpidem", strength: "10 mg", unit: "tablet", ingredient: "zolpidem", tags: ["sleep"], rx: true,
    labelName: "Ambien (Cosette)",
    use: { quote: "short-term treatment of insomnia characterized by difficulties with sleep initiation", url: label("747949c5-2c91-4909-8a07-71b6826f8e97") },
    directions: { quote: "recommended initial dose is 5 mg for women and either 5 or 10 mg for men", url: label("747949c5-2c91-4909-8a07-71b6826f8e97") },
    dose: { unitsPerDose: [1, 1], everyHours: null, maxUnitsPerDay: 1 },
    warnings: [
      { head: "Label: daily limit", quote: "should not exceed 10 mg once daily immediately before bedtime", url: label("747949c5-2c91-4909-8a07-71b6826f8e97") },
      { head: "Label: same night", quote: "should not be readministered during the same night", url: label("747949c5-2c91-4909-8a07-71b6826f8e97") },
      kitSays("comments", "Do not use with other sleep meds."),
      kitSays("possible side effects", "Drowsiness, dizziness, headache, abnormal dreams, insomnia, memory impairment, visual and attention disturbance")
    ],
    note: "The kit tablet is 10 mg; the label's starting dose for women is 5 mg. Use it only as your flight surgeon directed.",
    askFirst: [
      { tag: "sleep", quote: "Do not use with other sleep meds.", url: KIT_LIST },
      { tag: "drowsy", quote: "May cause sedation and impair performance. Do not use with sleep meds.", url: KIT_LIST }
    ],
    performance: { quote: "Drowsiness, dizziness, headache, abnormal dreams, insomnia, memory impairment, visual and attention disturbance", url: KIT_LIST },
    askAfterHours: 9, reviewedBy: null, demo: { stock: 14, expiresInDays: 260 }
  },
  {
    id: "hydrocortisone", form: "packet", tint: "#dfe7f2", name: "Hydrocortisone cream", strength: "1 %", unit: "application", ingredient: "hydrocortisone", tags: [],
    labelName: "Hydrocortisone Cream 1 % (Veridian)",
    use: { quote: "temporarily relieves itching associated with minor skin irritations, inflammation, and rashes", url: label("01cb7b47-2c3c-707d-e063-6294a90a5d97") },
    directions: { quote: "apply to affected area not more than 3 to 4 times daily", url: label("01cb7b47-2c3c-707d-e063-6294a90a5d97") },
    dose: { unitsPerDose: [1, 1], everyHours: null, maxDosesPerDay: 4 },
    warnings: [
      { head: "Label: stop and ask if", quote: "condition worsens, symptoms persist for more than 7 days or clear up and occur again within a few days", url: label("01cb7b47-2c3c-707d-e063-6294a90a5d97") },
      { head: "Label", quote: "For external use only", url: label("01cb7b47-2c3c-707d-e063-6294a90a5d97") }
    ],
    askAfterHours: 24, reviewedBy: null, demo: { stock: 30, expiresInDays: 500 }
  },
  {
    id: "bisacodyl", form: "tablet", tint: "#f0a65a", name: "Bisacodyl", strength: "5 mg", unit: "tablet", ingredient: "bisacodyl", tags: [],
    labelName: "Bisacodyl 5 mg laxative tablets (Bi-Mart)",
    use: { quote: "for temporary relief of occasional constipation and irregularity", url: label("02358772-6724-4f1a-b3d8-bc36e58b5cfc") },
    directions: { quote: "take 1 to 3 tablets in a single daily dose", url: label("02358772-6724-4f1a-b3d8-bc36e58b5cfc") },
    dose: { unitsPerDose: [1, 3], everyHours: null, maxUnitsPerDay: 3, maxDosesPerDay: 1 },
    warnings: [
      { head: "Label: what to expect", quote: "this product generally produces bowel movement in 6 to 12 hours", url: label("02358772-6724-4f1a-b3d8-bc36e58b5cfc") },
      { head: "Label: when using", quote: "do not use within 1 hour after taking an antacid or milk", url: label("02358772-6724-4f1a-b3d8-bc36e58b5cfc") },
      kitSays("possible side effects", "Mild abdominal cramps, nausea, vomiting, dizziness")
    ],
    askAfterHours: 12, reviewedBy: null, demo: { stock: 12, expiresInDays: 95 }
  }
];

export const KIT_FACTS = {
  carried: {
    text: "Medications, strengths and cautions come from NASA's ISS medical kit list (2015). Its stated purpose:",
    quote: "To provide a contents list of each medical pack including medications, potential medication side effects, other contents, locations, and supportive information.",
    url: KIT_LIST, source: N_KIT
  },
  shelfLife: {
    text: "Why dates matter on a long mission:",
    quote: "Expiration Concerns include long duration spaceflight planned for 1-5 years which will be beyond the current average medication expiration dates of 1-2 years.",
    url: PHARM, source: N_PHARM
  },
  expired: {
    quote: "it remains unclear whether spaceflight has any measurable effect on pharmaceutical stability",
    url: STABILITY, source: "NASA HRP evidence report, 2023"
  },
  record: {
    text: "Geosfera keeps the record NASA's Dose Tracker study asked crews for:",
    quote: "how well it seemed to work, how frequently doses were repeated, and if the medication seemed to cause side effects",
    url: PHARM, source: N_PHARM
  }
};

/** Every quoted fact in this file, for docs/SOURCES.md and the tests. */
export function allQuotes() {
  const out = [];
  const add = (where, f) => { if (f?.quote) out.push({ where, quote: f.quote, url: f.url }); };
  for (const c of CONDITIONS) {
    add(`${c.name}: how common`, c.about);
    c.first.forEach((s) => add(`${c.name}: first steps`, s));
    add(`${c.name}: when to tell the medical officer`, c.officer);
  }
  for (const m of KIT) {
    const name = `${m.name} ${m.strength}`;
    add(`${name}: use`, m.use);
    add(`${name}: directions`, m.directions);
    m.warnings.forEach((w) => add(`${name}: ${w.head}`, w));
    (m.askFirst ?? []).forEach((w) => add(`${name}: ask first`, w));
    add(`${name}: in flight`, m.inFlight);
    add(`${name}: performance caution`, m.performance);
  }
  for (const [k, f] of Object.entries(KIT_FACTS)) add(`Kit: ${k}`, f);
  return out;
}
