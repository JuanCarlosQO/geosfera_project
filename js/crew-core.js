// Crew roster rules, with no DOM so Node can test them. Geosfera serves a whole crew on a
// shared station device: each member has a profile and their own daily log.

export const CREW_KEY = "geosfera.crew";
export const ROLES = ["Commander", "Pilot", "Flight Engineer", "Mission Specialist", "Payload Specialist", "Flight Surgeon"];
export const MAX_CREW = 8;

export const logKeyFor = (id) => `geosfera.log.${id}`;

export function cleanName(raw) {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
}

/** Validates a new member. Returns { ok, member } or { ok: false, why }. */
export function makeMember(crew, { name, role }, idSource = () => Math.random().toString(36).slice(2, 10)) {
  const n = cleanName(name);
  if (n.length < 2) return { ok: false, why: "Enter a name of at least 2 letters." };
  if (!ROLES.includes(role)) return { ok: false, why: "Choose a role from the list." };
  if ((crew?.members ?? []).length >= MAX_CREW) return { ok: false, why: `A crew can have up to ${MAX_CREW} members.` };
  if ((crew?.members ?? []).some((m) => m.name.toLowerCase() === n.toLowerCase())) return { ok: false, why: "Someone with that name is already on the crew." };
  let id = idSource();
  while ((crew?.members ?? []).some((m) => m.id === id)) id = idSource();
  return { ok: true, member: { id, name: n, role } };
}

export function addMember(crew, member) {
  const members = [...(crew?.members ?? []), member];
  return { members, active: crew?.active ?? member.id };
}

export function removeMember(crew, id) {
  const members = (crew?.members ?? []).filter((m) => m.id !== id);
  const active = crew?.active === id ? members[0]?.id ?? null : crew?.active ?? null;
  return { members, active };
}

export function setActive(crew, id) {
  return (crew?.members ?? []).some((m) => m.id === id) ? { ...crew, active: id } : crew;
}

export const activeMember = (crew) => (crew?.members ?? []).find((m) => m.id === crew?.active) ?? (crew?.members ?? [])[0] ?? null;

/** Short label for a silhouette: initials. */
export function initials(name) {
  const parts = cleanName(name).split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)[0] : "")).toUpperCase();
}
