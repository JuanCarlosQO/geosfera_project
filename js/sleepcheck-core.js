// The morning sleep check — the one case the demo shows. When the watch's estimate of last
// night is clearly shorter than the crew member's recent nights, Today asks how they feel.
// "Very tired" opens a few reasons (a shift change, for one) and a note; the answer is kept with
// that day's log, and a summary can be prepared for the crew medical officer or flight surgeon.
// Rules only, no DOM. The app never says what the tiredness means.

export const RULES = {
  shorterBy: 0.75, // h: last night this much under the recent average... (app rule)
  under: 7,        // ...or under the 7 h that NASA cites as the low end for adults
  recentDays: 7,
  recentMin: 3     // nights needed before "your recent average" means anything
};
export const FEELS = [
  { id: "rested", label: "Rested" },
  { id: "tired", label: "A bit tired" },
  { id: "very", label: "Very tired" }
];
export const REASONS = [
  { id: "shift", label: "I changed shift yesterday" },
  { id: "late", label: "Late work or a critical task" },
  { id: "noise", label: "Noise, light or temperature where I sleep" },
  { id: "woke", label: "I woke up several times" },
  { id: "worry", label: "Something on my mind" }
];
export const NOTE_MAX = 140;

const shift = (day, n) => { const [y, m, d] = day.split("-").map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const round1 = (v) => Math.round(v * 10) / 10;

/** "5 h 20 min" */
export function hm(hours) {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60), m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Whether to ask this morning. -> { ask, last, usual, src, answered } (hours).
 * last: today's sleepHours in the log (the watch's estimate, or typed); usual: mean of the
 * previous nights that have a value (needs RULES.recentMin).
 */
export function sleepCheck(log, today) {
  const r = log?.[today]?.sleepHours;
  const last = Number.isFinite(r?.value) ? r.value : null;
  const prev = Array.from({ length: RULES.recentDays }, (_, i) => log?.[shift(today, -1 - i)]?.sleepHours?.value).filter(Number.isFinite);
  const usual = prev.length >= RULES.recentMin ? round1(prev.reduce((a, b) => a + b, 0) / prev.length) : null;
  const short = last != null && ((usual != null && last <= usual - RULES.shorterBy) || last < RULES.under);
  return { ask: short, last, usual, src: r?.src ?? null, answered: log?.[today]?.feel ?? null };
}

/** Keeps a well-formed answer: { feel, reasons, text }. */
export function cleanNote(raw) {
  const feel = FEELS.some((f) => f.id === raw?.feel) ? raw.feel : null;
  if (!feel) return null;
  const reasons = (Array.isArray(raw.reasons) ? raw.reasons : []).filter((id) => REASONS.some((r) => r.id === id));
  const text = String(raw.text ?? "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);
  return { feel, reasons: [...new Set(reasons)], text };
}

/** Writes the answer into that day's log entry, next to the readings. */
export function saveAnswer(log, day, answer, now = new Date()) {
  const a = cleanNote(answer);
  if (!a) return log;
  const entry = { ...(log?.[day] ?? {}) };
  entry.feel = { value: a.feel, at: now.toISOString() };
  if (a.reasons.length || a.text) entry.note = { reasons: a.reasons, text: a.text };
  else delete entry.note;
  return { ...(log ?? {}), [day]: { ...entry, savedAt: entry.savedAt ?? now.toISOString() } };
}

/**
 * The summary for the crew medical officer or flight surgeon, in plain words: what was
 * measured, what the crew member said, and what is simulated. No interpretation.
 */
export function summaryText({ name, role, missionDay, day, check, night = null, answer, simulated }) {
  const a = cleanNote(answer) ?? {};
  const feel = FEELS.find((f) => f.id === a.feel)?.label ?? "Not answered";
  const reasons = a.reasons?.map((id) => REASONS.find((r) => r.id === id)?.label).filter(Boolean) ?? [];
  const lines = [
    `Sleep summary · ${name}${role ? `, ${role}` : ""}${missionDay ? ` · mission day ${missionDay}` : ""} · ${day}`,
    `Last night (watch estimate): ${check.last != null ? hm(check.last) : "no data"}${check.usual != null ? ` · recent average ${hm(check.usual)}` : ""}.`
  ];
  if (night) lines.push(`Watch: fell asleep ${night.asleep}, woke ${night.wake}; ${night.awakenings} awakening${night.awakenings === 1 ? "" : "s"} (${night.awakeMin} min awake)${night.offInSleepMin ? `; ${night.offInSleepMin} min with the watch off, not counted` : ""}.`);
  lines.push(`How they feel this morning: ${feel}.`);
  if (reasons.length) lines.push(`They say: ${reasons.join("; ")}.`);
  if (a.text) lines.push(`Note: "${a.text}"`);
  lines.push(simulated ? "Data: SIMULATED (demo), not real crew data." : "Data: from the crew member's watch and their own answers.");
  lines.push("Prepared by Ergosphere. No conclusion is drawn; for the crew medical officer to review.");
  return lines.join("\n");
}

/** The same, in one short message for the support channel (it keeps 280 characters). */
export function shortSummary({ check, answer, simulated }) {
  const a = cleanNote(answer) ?? {};
  const feel = FEELS.find((f) => f.id === a.feel)?.label.toLowerCase() ?? "not answered";
  const reasons = a.reasons?.map((id) => REASONS.find((r) => r.id === id)?.label).filter(Boolean) ?? [];
  return [`Sleep: last night ${check.last != null ? hm(check.last) : "no data"}${check.usual != null ? ` (recent average ${hm(check.usual)})` : ""}.`, `Feels ${feel}.`, reasons.length ? `${reasons.join("; ")}.` : "", a.text ? `Note: "${a.text}"` : "", simulated ? "(Simulated demo data.)" : ""].filter(Boolean).join(" ").slice(0, 280);
}
