// Emergency drill: a simulated cardiac arrest on board, to rehearse opening a crewmate's data
// with the crew's emergency code. Pure rules, no DOM. Everything in a drill is SIMULATED: no
// reading is written to anyone's log, and the opening it records carries a "drill" flag.
// The steps and their timing are an app exercise, not a NASA procedure: on a real station the
// crew follows its own emergency procedures and the flight surgeon leads.

export const DRILLS_KEY = "geosfera.drills"; // [drill], shared with the ground through the sync
export const MAX_DRILLS = 30;
export const STEPS = ["alarm", "code", "open", "ended"];
export const OUTCOMES = [
  { id: "pulse", label: "Pulse back (simulated)" },
  { id: "stopped", label: "Drill stopped" }
];

const ms = (t) => new Date(t).getTime();
const iso = (t) => new Date(t).toISOString();
const okTime = (t) => t != null && Number.isFinite(ms(t));

export function cleanDrills(list) {
  return (Array.isArray(list) ? list : [])
    .filter((d) => d && d.id && d.patient && okTime(d.startedAt))
    .map((d) => ({
      id: String(d.id), patient: String(d.patient), responder: String(d.responder ?? ""), startedAt: iso(d.startedAt),
      wrongCodes: Number.isInteger(d.wrongCodes) && d.wrongCodes > 0 ? d.wrongCodes : 0,
      ...(okTime(d.openedAt) ? { openedAt: iso(d.openedAt) } : {}),
      ...(okTime(d.endedAt) ? { endedAt: iso(d.endedAt) } : {}),
      ...(OUTCOMES.some((o) => o.id === d.outcome) ? { outcome: d.outcome } : {})
    }))
    .slice(0, MAX_DRILLS);
}

export function startDrill(list, { patient, responder, now = new Date() }) {
  const drill = { id: `drill-${ms(now).toString(36)}`, patient: String(patient), responder: String(responder ?? ""), startedAt: iso(now), wrongCodes: 0 };
  return { list: [drill, ...cleanDrills(list)].slice(0, MAX_DRILLS), drill };
}

const update = (list, id, f) => cleanDrills(list).map((d) => (d.id === id ? f(d) : d));
export const wrongCode = (list, id) => update(list, id, (d) => ({ ...d, wrongCodes: d.wrongCodes + 1 }));
export const opened = (list, id, now = new Date()) => update(list, id, (d) => (d.openedAt ? d : { ...d, openedAt: iso(now) }));
export const endDrill = (list, id, outcome, now = new Date()) => update(list, id, (d) => (d.endedAt ? d : { ...d, endedAt: iso(now), outcome: OUTCOMES.some((o) => o.id === outcome) ? outcome : "stopped" }));

/** Which step a drill is on. */
export const stepOf = (d) => (!d ? null : d.endedAt ? "ended" : d.openedAt ? "open" : "alarm");

/** Seconds from the alarm to the data opening, and to the end. */
export function timings(d) {
  if (!d) return null;
  const s = (a, b) => (okTime(a) && okTime(b) ? Math.max(0, Math.round((ms(b) - ms(a)) / 1000)) : null);
  return { toOpen: s(d.startedAt, d.openedAt), total: s(d.startedAt, d.endedAt), wrongCodes: d.wrongCodes };
}

/** mm:ss */
export const clockOf = (sec) => (sec == null ? "—" : `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`);

export const outcomeLabel = (id) => OUTCOMES.find((o) => o.id === id)?.label ?? id;
