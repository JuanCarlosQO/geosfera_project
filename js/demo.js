// Loads and removes the demo crew on this device (rules and values: demo-core.js).
// Loading is offered only while no crew is registered; a demo saved by an older version is
// replaced by the current one, keeping any crew member the team created by hand.
// Removing takes away only what the demo wrote: its members and their logs, its medication
// doses and vitamin D days, its exercise, alerts and openings, and its mission start.

import { buildDemo, DEMO_KEY, isDemoId, DEMO_CREW, DEMO_VERSION } from "./demo-core.js";
import { ALERTS_KEY } from "./support-core.js";
import { OPENINGS_KEY, cleanOpenings } from "./role-core.js";
import { getCrew, saveCrew, writeLog, deleteMember } from "./store.js";
import { MEDS_KEY } from "./meds-core.js";
import { FAMILY_KEY } from "./family-core.js";
import { EXERCISE_KEY, cleanStore as cleanExercise } from "./exercise-core.js";
import { SHARING_KEY, REQUESTS_KEY, cleanSharing, cleanRequests } from "./share-core.js";
import { DRILLS_KEY, cleanDrills } from "./drill-core.js";
import { CHECKINS_KEY, ASKS_KEY, cleanCheckins, cleanAsks } from "./screen-core.js";

const MISSION_KEY = "geosfera.mission";
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const drop = (k) => { try { localStorage.removeItem(k); } catch { /* storage blocked */ } };

export const demoLoaded = () => Boolean(read(DEMO_KEY, null)) || getCrew().members.some((m) => isDemoId(m.id));

/** Writes the demo crew. Returns false when a crew is already registered (unless `keep`: then the
 * demo is written next to the crew members already on the device). */
export function loadDemo(now = new Date(), { keep = false } = {}) {
  const others = getCrew().members.filter((m) => !isDemoId(m.id));
  if (getCrew().members.length && !keep) return false;
  const d = buildDemo(now);
  saveCrew({ ...d.crew, members: [...d.crew.members, ...others] });
  for (const [id, log] of Object.entries(d.logs)) writeLog(log, id);
  const meds = read(MEDS_KEY, null);
  write(MEDS_KEY, meds ? { ...meds, doses: [...(meds.doses ?? []), ...d.meds.doses], supplements: { ...(meds.supplements ?? {}), ...d.meds.supplements } } : d.meds);
  write(ALERTS_KEY, [...d.alerts, ...read(ALERTS_KEY, [])]);
  write(OPENINGS_KEY, [...d.openings, ...cleanOpenings(read(OPENINGS_KEY, []))]);
  write(MISSION_KEY, d.mission);
  write(SHARING_KEY, { ...cleanSharing(read(SHARING_KEY, {})), ...d.sharing });
  write(REQUESTS_KEY, [...d.requests, ...cleanRequests(read(REQUESTS_KEY, []))]);
  write(CHECKINS_KEY, [...d.checkins, ...cleanCheckins(read(CHECKINS_KEY, []))]);
  write(FAMILY_KEY, { ...read(FAMILY_KEY, {}), ...d.family });
  const ex = cleanExercise(read(EXERCISE_KEY, {}));
  write(EXERCISE_KEY, { plans: { ...ex.plans, ...d.exercise.plans }, log: [...ex.log, ...d.exercise.log], faults: [...ex.faults, ...d.exercise.faults] });
  write(DEMO_KEY, { ...d.marker, doses: d.meds.doses.map((x) => x.id), supplementDays: Object.keys(d.meds.supplements), missionStart: d.mission.start });
  return true;
}

/**
 * A demo crew loaded by an older version of the app lacks fields added since (a woman's or a
 * man's body, age, home, avatar), so Valentina showed a man's body. Fills only what is missing;
 * a choice the crew member made (like an avatar) is never overwritten.
 */
export function refreshDemoProfiles() {
  const crew = getCrew();
  let changed = false;
  for (const m of crew.members) {
    const d = DEMO_CREW.find((x) => x.id === m.id);
    if (!d) continue;
    const old = m.body == null;
    for (const k of ["body", "age", "home"]) if (m[k] == null && d[k] != null) { m[k] = d[k]; changed = true; }
    if (old && m.avatar == null && d.avatar) { m.avatar = d.avatar; changed = true; }
  }
  if (changed) saveCrew(crew);
  return changed;
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
  const ex = read(EXERCISE_KEY, null);
  if (ex) {
    const c = cleanExercise(ex);
    for (const id of Object.keys(c.plans)) if (isDemoId(id)) delete c.plans[id];
    write(EXERCISE_KEY, { plans: c.plans, log: c.log.filter((e) => !isDemoId(e.member)), faults: c.faults.filter((f) => !isDemoId(f.member)) });
  }
  write(ALERTS_KEY, read(ALERTS_KEY, []).filter((a) => !isDemoId(a?.from?.id)));
  write(OPENINGS_KEY, cleanOpenings(read(OPENINGS_KEY, [])).filter((o) => !isDemoId(o.member)));
  const sh = cleanSharing(read(SHARING_KEY, {}));
  for (const id of Object.keys(sh)) if (isDemoId(id)) delete sh[id];
  write(SHARING_KEY, sh);
  write(REQUESTS_KEY, cleanRequests(read(REQUESTS_KEY, [])).filter((r) => !isDemoId(r.member)));
  write(DRILLS_KEY, cleanDrills(read(DRILLS_KEY, [])).filter((x) => !isDemoId(x.patient)));
  write(CHECKINS_KEY, cleanCheckins(read(CHECKINS_KEY, [])).filter((c) => !isDemoId(c.member)));
  write(ASKS_KEY, cleanAsks(read(ASKS_KEY, [])).filter((a) => !isDemoId(a.member)));
  drop(DEMO_KEY);
}

/** A demo saved by an older version (fewer crew, no mission) is swapped for the current one. */
export function upgradeDemo(now = new Date()) {
  const marker = read(DEMO_KEY, null);
  if (!demoLoaded() || (marker?.version ?? 1) >= DEMO_VERSION) return false;
  removeDemo();
  loadDemo(now, { keep: true });
  return true;
}

export const demoNoticeHtml = () => `<div class="demo-note" role="note"><span class="dn-tag mono">SIMULATED</span>
  <p><strong>Demo crew.</strong> Fictional people, simulated values, not real astronaut data.</p>
  <button type="button" class="textlink" data-action="remove-demo">Remove demo crew</button></div>`;

export const demoOfferHtml = () => `<div class="demo-offer">
  <p><strong>Just looking around?</strong> Load a demo crew: two fictional astronauts, a woman and a man, each with their own code and two weeks of simulated readings.</p>
  <button type="button" class="cta" data-action="load-demo">Load demo crew</button>
  <p class="fine">Not real astronaut data. Remove it any time from the Today screen.</p></div>`;
