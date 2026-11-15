// Who is looking: the ground medical team or a crew member. Pure rules, no DOM.
//
// On the station the readings go down to the ground: NASA's actigraphy protocol has ground
// personnel download the watch (docs/SOURCES.md). So Ergosphere is built for the people who
// monitor. A crew member's own screens only collect what they report (how they feel, when they
// went to bed, a dose they took, messages from home) and show no readings. In an emergency the
// crew member can open their own data for a while; every opening is kept and the ground sees it.

export const ROLE_KEY = "geosfera.role";         // this device: who is signed in (never synced)
export const OPENINGS_KEY = "geosfera.openings"; // emergency openings, shared with the ground through the sync
export const GROUND_ID = "_ground";              // the ground team's own code lives in the access store under this id
export const GROUND = { id: GROUND_ID, name: "Ground medical team", role: "Flight surgeon console" };
export const EMERGENCY_MIN = 60;                 // app rule: an opening lasts one hour, then the data hides again
export const MAX_OPENINGS = 50;

export const EMERGENCY_REASONS = [
  { id: "medical", label: "Medical emergency" },
  { id: "los", label: "No contact with the ground" },
  { id: "asked", label: "The ground team asked me to look" },
  { id: "alarm", label: "An alarm is sounding" }
];

// What a crew member opens without an emergency: their own home, the medication log (they log
// what they took) and the family channel. Everything else shows readings.
export const CREW_ROUTES = ["crew", "meds", "family"];
// Never for the ground: the crew member's home and their messages from home.
export const CREW_ONLY = ["crew", "family"];
// The ground's own screen (the crew roster); a crew member never opens it.
export const GROUND_ROUTES = ["ground", "analysis"];

const ms = (t) => new Date(t).getTime();
const iso = (t) => new Date(t).toISOString();

/** A well-formed state read back from the device: { role, emergency }. */
export function cleanRole(raw) {
  const role = raw?.role === "ground" || raw?.role === "crew" ? raw.role : null;
  const e = raw?.emergency;
  const emergency = role === "crew" && e && Number.isFinite(ms(e.until)) && Number.isFinite(ms(e.at)) && EMERGENCY_REASONS.some((r) => r.id === e.reason)
    ? { at: iso(e.at), until: iso(e.until), reason: e.reason, member: String(e.member ?? "") }
    : null;
  return { role, emergency };
}

export const signIn = (role) => cleanRole({ role });

/** Minutes left of an emergency opening (0 when there is none or it ran out). */
export function emergencyLeft(state, now = new Date()) {
  const e = state?.emergency;
  if (!e) return 0;
  return Math.max(0, Math.ceil((ms(e.until) - ms(now)) / 60000));
}

export const inEmergency = (state, now = new Date()) => state?.role === "crew" && emergencyLeft(state, now) > 0;

export function startEmergency(state, reason, member, now = new Date(), minutes = EMERGENCY_MIN) {
  if (state?.role !== "crew" || !EMERGENCY_REASONS.some((r) => r.id === reason)) return state;
  return { ...state, emergency: { at: iso(now), until: iso(ms(now) + minutes * 60000), reason, member: String(member ?? "") } };
}

export const endEmergency = (state) => ({ ...state, emergency: null });

/** Whether this screen opens for whoever is signed in. */
export function canSee(state, route, now = new Date()) {
  // the family channel is the crew member's own, kept apart from the medical record
  if (state?.role === "ground") return !CREW_ONLY.includes(route);
  if (state?.role === "crew") {
    if (GROUND_ROUTES.includes(route)) return false;
    return CREW_ROUTES.includes(route) || inEmergency(state, now);
  }
  return true; // no crew yet on this device: the app is open, as before
}

/** Where each one lands. */
export const homeFor = (state) => (state?.role === "ground" ? "ground" : state?.role === "crew" ? "crew" : "today");

/** Adds an opening to the shared list (newest first, capped). */
export function addOpening(list, { member, reason, at = new Date() }) {
  if (!member || !EMERGENCY_REASONS.some((r) => r.id === reason)) return cleanOpenings(list);
  return [{ member: String(member), reason, at: iso(at) }, ...cleanOpenings(list)].slice(0, MAX_OPENINGS);
}

export function cleanOpenings(list) {
  return (Array.isArray(list) ? list : [])
    .filter((o) => o && o.member && EMERGENCY_REASONS.some((r) => r.id === o.reason) && Number.isFinite(ms(o.at)))
    .map((o) => ({ member: String(o.member), reason: o.reason, at: iso(o.at), ...(Number.isFinite(ms(o.closedAt)) && o.closedAt ? { closedAt: iso(o.closedAt) } : {}) }))
    .slice(0, MAX_OPENINGS);
}

/** The crew member hid their data again: the latest open opening gets its end time. */
export function closeOpening(list, member, at = new Date()) {
  let done = false;
  return cleanOpenings(list).map((o) => {
    if (done || o.member !== member || o.closedAt) return o;
    done = true;
    return { ...o, closedAt: iso(at) };
  });
}

/** Whether an opening is still open: not hidden again and within the hour. */
export const openNow = (o, now = new Date()) => Boolean(o) && !o.closedAt && ms(now) - ms(o.at) < EMERGENCY_MIN * 60000;

export const openingsFor = (list, member) => cleanOpenings(list).filter((o) => o.member === member);
export const reasonLabel = (id) => EMERGENCY_REASONS.find((r) => r.id === id)?.label ?? id;
