// Who is signed in on this device, and the emergency openings (rules: role-core.js).

import * as R from "./role-core.js";
import { getCrew } from "./store.js";

const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const getRole = () => R.cleanRole(read(R.ROLE_KEY, {}));
export function setRole(state) {
  write(R.ROLE_KEY, R.cleanRole(state));
  document.dispatchEvent(new CustomEvent("ergosphere:role"));
}
export const isGround = () => getRole().role === "ground";
export const isCrew = () => getRole().role === "crew";
/** A crew member sees readings only during an emergency opening; the ground always does. */
// With a crew on the device and nobody signed in (the profiles screen), no readings show either.
export const seesData = () => { const s = getRole(); return s.role === "ground" || R.inEmergency(s) || (!s.role && !getCrew().members.length); };

export const getOpenings = () => R.cleanOpenings(read(R.OPENINGS_KEY, []));

/** A crew member opens their own data: the opening starts and is kept for the ground. */
export function openEmergency(reason, member) {
  const s = getRole();
  const next = R.startEmergency(s, reason, member);
  if (next === s) return false;
  write(R.OPENINGS_KEY, R.addOpening(getOpenings(), { member, reason }));
  setRole(next);
  return true;
}
export function closeEmergency() {
  const s = getRole();
  if (s.emergency?.member) write(R.OPENINGS_KEY, R.closeOpening(getOpenings(), s.emergency.member));
  setRole(R.endEmergency(s));
}
