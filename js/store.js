// Device storage for the whole crew (option A: everything stays on this device).
// geosfera.crew = { members: [{ id, name, role }], active }
// geosfera.log.<id> = { "YYYY-MM-DD": { heartRate: { value }, ... } } — one log per member.

import { CREW_KEY, logKeyFor, activeMember, setActive as pick, addMember, removeMember, makeMember } from "./crew-core.js";

const OLD_LOG_KEY = "geosfera.log";

const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export function getCrew() {
  const crew = read(CREW_KEY, { members: [], active: null });
  // one-time move: a log saved before crews existed goes to the first member
  const old = read(OLD_LOG_KEY, null);
  if (old && crew.members.length) {
    const key = logKeyFor(crew.members[0].id);
    if (!localStorage.getItem(key)) write(key, old);
    try { localStorage.removeItem(OLD_LOG_KEY); } catch { /* ignore */ }
  }
  return crew;
}

export const saveCrew = (crew) => write(CREW_KEY, crew);
export const current = () => activeMember(getCrew());

export function setActive(id) {
  const crew = pick(getCrew(), id);
  saveCrew(crew);
  return crew;
}

export function createMember(fields) {
  const crew = getCrew();
  const r = makeMember(crew, fields);
  if (!r.ok) return r;
  const next = addMember(crew, r.member);
  const hadOld = crew.members.length === 0 && read(OLD_LOG_KEY, null);
  saveCrew(next);
  if (hadOld) getCrew();
  return { ok: true, member: r.member, crew: next };
}

export function deleteMember(id) {
  const next = removeMember(getCrew(), id);
  saveCrew(next);
  try { localStorage.removeItem(logKeyFor(id)); } catch { /* ignore */ }
  return next;
}

export function readLog(id = current()?.id) {
  return id ? read(logKeyFor(id), {}) : {};
}

export function writeLog(log, id = current()?.id) {
  return id ? write(logKeyFor(id), log) : false;
}
