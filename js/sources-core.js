// In-app sources page: every document behind a fact the app shows, built from the app's own
// data modules (the same objects the screens read), so the page cannot drift from the app.
// No DOM, so Node can test that every link has a name and a group.

import { SYSTEMS } from "./data/body-systems.js";
import { NASA_RISKS, RISKS_SOURCE } from "./data/nasa-risks.js";
import { HAZARDS, HAZARDS_SOURCE } from "./data/hazards.js";
import { KIT, allQuotes as medQuotes } from "./data/med-kit.js";
import { LIMIT_FACTS } from "./data/telemetry.js";
import { FUTURE_FACTS } from "./data/future.js";
import { DUTY_FACTS } from "./data/duty.js";
import { RANGES } from "./data/vital-ranges.js";
import { RADLAB_ISS } from "./data/radlab-iss.js";

export const MODULES = {
  today: { label: "Today", href: "#today" },
  body: { label: "Body", href: "#body" },
  risks: { label: "Body · NASA risks", href: "#body" },
  log: { label: "Log", href: "#log" },
  meds: { label: "Meds", href: "#meds" },
  duty: { label: "Fit for duty", href: "#duty" },
  live: { label: "Live", href: "#live" },
  future: { label: "Future body", href: "#future" }
};

export const GROUPS = [
  { id: "standard", title: "NASA standards and technical briefs", note: "Requirements and limits NASA sets for crew health." },
  { id: "hrp", title: "NASA Human Research Program", note: "What NASA knows about the hazards and risks of spaceflight." },
  { id: "data", title: "Real NASA data", note: "Measurements the app shows or replays." },
  { id: "partner", title: "Partner space agencies", note: "" },
  { id: "earth", title: "Earth clinical references", note: "Used where NASA publishes no number: drug labels and vital-sign ranges. Marked “Earth reference” in the app." }
];

/** Names for documents whose title is not in the data itself. */
const NAMED = {
  "https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf": ["NASA ISS medical kit list — 3.001 Medical Kit Contents and Reference (2015)", "standard"],
  "https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf": ["NASA-STD-3001 Volume 1, Revision C — Crew Health", "standard"],
  "https://standards.nasa.gov/system/files/tmp/NASA-STD-3001%20Vol%202%20Rev%20F.pdf": ["NASA-STD-3001 Volume 2, Revision F — Human Factors, Habitability and Environmental Health", "standard"],
  "https://www.nasa.gov/wp-content/uploads/2025/09/ochmo-mtb-004-space-adaptation-sickness-sas.pdf": ["NASA OCHMO-MTB-004 — Space Adaptation Sickness", "standard"],
  "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-006-pharmaceuticals.pdf": ["NASA OCHMO-MTB-012 — Pharmaceutical Care", "standard"],
  "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf": ["NASA OCHMO-TB-004 — Carbon Dioxide", "standard"],
  "https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-003-habitable-atmosphere.pdf": ["NASA OCHMO-TB-003 — Habitable Atmosphere", "standard"],
  "https://www.nasa.gov/wp-content/uploads/2023/03/sleep-accomodations-technical-brief-ochmo.pdf": ["NASA OCHMO technical brief — Sleep Accommodations", "standard"],
  "https://ntrs.nasa.gov/citations/20230018496": ["NASA HRP evidence report — Risk of Ineffective or Toxic Medications (2023)", "hrp"],
  "https://humanresearchroadmap.nasa.gov/evidence/reports/Nutrition.pdf": ["NASA HRP evidence report — Risk Factor of Inadequate Nutrition (2015)", "hrp"],
  "https://www.nasa.gov/wp-content/uploads/2023/10/lsah-newsletter-2023-vol28-issue2.pdf": ["NASA Lifetime Surveillance of Astronaut Health newsletter, Oct 2023", "hrp"],
  "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp": ["Canadian Space Agency — Monitoring radiation for astronaut health", "partner"],
  "https://www.nccih.nih.gov/health/melatonin-what-you-need-to-know": ["NIH NCCIH — Melatonin: what you need to know", "earth"]
};

/** Every quoted fact the app shows: { module, quote, url }. */
export function collect() {
  const out = [];
  const add = (module, quote, url) => { if (url) out.push({ module, quote: quote ?? null, url }); };
  for (const s of SYSTEMS) for (const f of s.facts) add("body", f.quote, f.url);
  for (const r of NASA_RISKS) add("risks", r.text, r.url);
  for (const h of HAZARDS) add("today", h.text, HAZARDS_SOURCE.url);
  for (const q of medQuotes()) add("meds", q.quote, q.url);
  for (const f of Object.values(LIMIT_FACTS)) add("live", f.quote, f.url);
  for (const f of Object.values(FUTURE_FACTS)) add("future", f.quote, f.url);
  for (const f of Object.values(DUTY_FACTS)) add("duty", f.quote, f.url);
  for (const r of Object.values(RANGES)) add("log", null, r.url);
  return out;
}

/** Title and group for one link. */
export function describe(url) {
  if (NAMED[url]) return { title: NAMED[url][0], group: NAMED[url][1] };
  const risk = NASA_RISKS.find((r) => r.url === url);
  if (risk) return { title: `NASA HRP — ${risk.name}`, group: "hrp" };
  if (url === RISKS_SOURCE.url) return { title: RISKS_SOURCE.label, group: "hrp" };
  if (url === HAZARDS_SOURCE.url) return { title: HAZARDS_SOURCE.label, group: "hrp" };
  const label = KIT.find((k) => k.directions?.url === url || k.use?.url === url);
  if (url.includes("dailymed.nlm.nih.gov")) return { title: `FDA drug label (DailyMed) — ${label?.labelName ?? "label"}`, group: "earth" };
  const range = Object.values(RANGES).find((r) => r.url === url);
  if (range) return { title: range.source, group: "earth" };
  return null;
}

/** Documents grouped and sorted, each with the modules that use it and its quotes. */
export function documents(facts = collect()) {
  const byUrl = new Map();
  for (const f of facts) {
    const d = byUrl.get(f.url) ?? { url: f.url, ...describe(f.url), modules: new Set(), quotes: [] };
    d.modules.add(f.module);
    if (f.quote && !d.quotes.includes(f.quote)) d.quotes.push(f.quote);
    byUrl.set(f.url, d);
  }
  const docs = [...byUrl.values()].map((d) => ({ ...d, modules: [...d.modules] }));
  return GROUPS.map((g) => ({ ...g, docs: docs.filter((d) => d.group === g.id).sort((a, b) => a.title.localeCompare(b.title)) })).filter((g) => g.docs.length);
}

/** Real data the app reads or replays. */
export const DATA_SOURCES = [
  { title: RADLAB_ISS.source, url: RADLAB_ISS.docs, what: `Radiation dose rate, ${RADLAB_ISS.values.length} real readings (${RADLAB_ISS.unit}), replayed on the Live screen.`, module: "live" },
  { title: "NASA DONKI space-weather catalogue (CCMC)", url: "https://ccmc.gsfc.nasa.gov/tools/DONKI/", what: "Latest real solar flares, asked live when the Live screen opens.", module: "live" }
];

/** Case-insensitive filter over titles and quotes. */
export function filterGroups(groups, text) {
  const q = text.trim().toLowerCase();
  if (!q) return groups;
  return groups.map((g) => ({ ...g, docs: g.docs.filter((d) => d.title.toLowerCase().includes(q) || d.quotes.some((x) => x.toLowerCase().includes(q))) })).filter((g) => g.docs.length);
}
