// Module 9 — fit for duty. Rules with no DOM so Node can test them.
// A one-minute look, before a critical task, at what the crew member already logged:
// last night's sleep, today's mood, medications that can dull performance, and how loaded
// they feel right now. It never says "fit" or "unfit": it lists what is worth mentioning
// to a crewmate, and the people decide. The 7-hour sleep line and the performance cautions
// are quoted from NASA; the other cut-offs are APP RULES and the screen labels them.

export const DUTY_KEY = "geosfera.duty";

export const RULES = {
  sleepHours: 7,    // NASA sleep brief: "an average adult needs 7-9 hours of sleep"
  impairHours: 8,   // app rule: how far back a performance-dulling medication counts
  lowMood: 2,       // app rule: mood 1-2 of 5 is worth mentioning
  highWorkload: 4,  // app rule: 4-5 of 5 on any workload question is worth mentioning
  keep: 30          // saved checks kept on the device
};

const HOUR = 3600000;
const ms = (t) => new Date(t).getTime();

const reading = (log, day, key) => {
  const r = log?.[day]?.[key];
  if (r?.value == null) return { missing: "none" };
  if (r.flag === "again") return { missing: "again" };
  return { value: r.value };
};

export function checkSleep(log, day) {
  const r = reading(log, day, "sleepHours");
  if (r.missing) return { id: "sleep", state: "none", why: r.missing };
  return { id: "sleep", state: r.value < RULES.sleepHours ? "flag" : "ok", value: r.value };
}

export function checkMood(log, day) {
  const r = reading(log, day, "mood");
  if (r.missing) return { id: "mood", state: "none", why: r.missing };
  return { id: "mood", state: r.value <= RULES.lowMood ? "flag" : "ok", value: r.value };
}

/** Hours a cautioned medication counts before a critical task: the pharmacist's value when she gave a longer one. */
export const hoursFor = (med) => Math.max(RULES.impairHours, med?.dutyHours ?? 0);

/** Recorded doses of medications whose NASA entry cautions about performance, within their hours. */
export function checkMeds(doses, kit, now = new Date()) {
  const byId = new Map(kit.map((k) => [k.id, k]));
  const items = (doses ?? [])
    .filter((d) => byId.get(d.medId)?.performance && ms(d.at) <= ms(now) && ms(now) - ms(d.at) < hoursFor(byId.get(d.medId)) * HOUR)
    .sort((a, b) => ms(b.at) - ms(a.at))
    .map((d) => ({ med: byId.get(d.medId), at: d.at, hoursAgo: Math.floor((ms(now) - ms(d.at)) / HOUR), hours: hoursFor(byId.get(d.medId)) }));
  return { id: "meds", state: items.length ? "flag" : "ok", items };
}

/** answers: { time, effort, frustration }, each 1-5 or null. All three are needed for "ok". */
export function checkWorkload(answers = {}) {
  const keys = ["time", "effort", "frustration"];
  const given = keys.filter((k) => Number.isInteger(answers[k]) && answers[k] >= 1 && answers[k] <= 5);
  const high = given.filter((k) => answers[k] >= RULES.highWorkload);
  if (high.length) return { id: "workload", state: "flag", high };
  if (given.length < keys.length) return { id: "workload", state: "none", why: "unanswered" };
  return { id: "workload", state: "ok" };
}

/**
 * All four checks and an honest headline:
 * "talk"  — something is worth mentioning before starting;
 * "gaps"  — nothing flagged, but some checks have no data;
 * "ready" — every check has data and none is flagged.
 */
export function assess({ log, day, doses, kit, workload, now = new Date() }) {
  const checks = [checkSleep(log, day), checkMeds(doses, kit, now), checkMood(log, day), checkWorkload(workload)];
  const flags = checks.filter((c) => c.state === "flag").map((c) => c.id);
  const gaps = checks.filter((c) => c.state === "none").map((c) => c.id);
  return { checks, flags, gaps, headline: flags.length ? "talk" : gaps.length ? "gaps" : "ready" };
}

export function saveCheck(list, { task, result, at = new Date() }) {
  const entry = { at: new Date(at).toISOString(), task: task ?? null, headline: result.headline, flags: [...result.flags], gaps: [...result.gaps] };
  return [...(Array.isArray(list) ? list : []), entry].slice(-RULES.keep);
}

/** Keeps only well-formed saved checks read back from the device. */
export function cleanChecks(raw) {
  return (Array.isArray(raw) ? raw : []).filter((c) => !Number.isNaN(ms(c?.at)) && ["talk", "gaps", "ready"].includes(c.headline) && Array.isArray(c.flags) && Array.isArray(c.gaps)).slice(-RULES.keep);
}
