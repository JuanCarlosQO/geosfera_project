// Loads and removes the demo crew on this device (rules and values: demo-core.js).
// Loading is offered only while no crew is registered, so it never mixes with real entries.
// Removing takes away only what the demo wrote: its two members and their logs, its
// medication doses and vitamin D days, and its mission start.

import { buildDemo, DEMO_KEY, isDemoId } from "./demo-core.js";
import { getCrew, saveCrew, writeLog, deleteMember } from "./store.js";
import { MEDS_KEY } from "./meds-core.js";
import { FAMILY_KEY } from "./family-core.js";

const MISSION_KEY = "geosfera.mission";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const drop = (k) => { try { localStorage.removeItem(k); } catch { /* storage blocked */ } };

export const demoLoaded = () => Boolean(read(DEMO_KEY, null)) || getCrew().members.some((m) => isDemoId(m.id));

/** Writes the demo crew. Returns false when a crew is already registered. */
export function loadDemo(now = new Date()) {
  if (getCrew().members.length) return false;
  const d = buildDemo(now);
  saveCrew(d.crew);
  for (const [id, log] of Object.entries(d.logs)) writeLog(log, id);
  write(MEDS_KEY, d.meds);
  write(MISSION_KEY, d.mission);
  write(FAMILY_KEY, { ...read(FAMILY_KEY, {}), ...d.family });
  write(DEMO_KEY, { ...d.marker, doses: d.meds.doses.map((x) => x.id), supplementDays: Object.keys(d.meds.supplements), missionStart: d.mission.start });
  return true;
}

export function removeDemo() {
  const marker = read(DEMO_KEY, {});
  for (const m of getCrew().members.filter((x) => isDemoId(x.id))) deleteMember(m.id);
  const meds = read(MEDS_KEY, null);
  if (meds) {
    const doseIds = new Set(marker.doses ?? []);
    const days = new Set(marker.supplementDays ?? []);
    const supplements = Object.fromEntries(Object.entries(meds.supplements ?? {}).filter(([day]) => !days.has(day)));
    write(MEDS_KEY, { ...meds, doses: (meds.doses ?? []).filter((x) => !doseIds.has(x.id)), supplements });
  }
  if (marker.missionStart && read(MISSION_KEY, {}).start === marker.missionStart) drop(MISSION_KEY);
  const fam = read(FAMILY_KEY, null);
  if (fam) { for (const id of Object.keys(fam)) if (isDemoId(id)) delete fam[id]; write(FAMILY_KEY, fam); }
  drop(DEMO_KEY);
}

export const demoNoticeHtml = () => `<div class="demo-note" role="note"><span class="dn-tag mono">SIMULATED</span>
  <p><strong>Demo crew.</strong> Fictional people, simulated values, not real astronaut data.</p>
  <button type="button" class="textlink" data-action="remove-demo">Remove demo crew</button></div>`;

export const demoOfferHtml = () => `<div class="demo-offer">
  <p><strong>Just looking around?</strong> Load a demo crew: two fictional astronauts, a woman and a man, each with their own code and two weeks of simulated readings.</p>
  <button type="button" class="cta" data-action="load-demo">Load demo crew</button>
  <p class="fine">Not real astronaut data. Remove it any time from the Today screen.</p></div>`;
