// Mind & support rules, with no DOM so Node can test them.
// A crew member can raise a support request or an emergency in two taps. The alert is kept
// in geosfera.alerts, which the team's station sync shares with every linked crew device;
// Mission Control delivery is simulated in this prototype and the screen says so.

export const ALERTS_KEY = "geosfera.alerts";
export const COMFORT_KEY = "geosfera.comfort";
export const KEEP = 50;
export const HOLD_MS = 1500;          // app rule: hold the emergency button this long to send
export const ACTIVE_HOURS = 12;       // app rule: an unanswered alert stays on other screens this long

const ms = (t) => new Date(t).getTime();
const iso = (t) => new Date(t).toISOString();

export function makeAlert({ level, member, reasons = [], note = "", at = new Date(), id }) {
  if (!["talk", "emergency"].includes(level)) return { ok: false, why: "Choose what kind of help." };
  const text = String(note ?? "").trim().slice(0, 280);
  return {
    ok: true,
    alert: {
      id: id ?? `al-${ms(at)}-${Math.random().toString(36).slice(2, 7)}`,
      at: iso(at),
      level,
      from: { id: member?.id ?? null, name: member?.name ?? "Crew member", role: member?.role ?? "" },
      reasons: [...new Set(reasons)].slice(0, 8),
      note: text,
      acks: [],
      closed: null
    }
  };
}

export const addAlert = (list, alert) => [...(Array.isArray(list) ? list : []), alert].slice(-KEEP);

/** A crewmate answers "I'm on my way" (or "Seen"). One answer per person. */
export function acknowledge(list, alertId, by, kind = "coming", at = new Date()) {
  return list.map((a) => (a.id !== alertId || a.acks.some((k) => k.id === by.id) ? a : { ...a, acks: [...a.acks, { id: by.id ?? null, name: by.name ?? "Crewmate", kind, at: iso(at) }] }));
}

export const closeAlert = (list, alertId, at = new Date()) => list.map((a) => (a.id === alertId && !a.closed ? { ...a, closed: iso(at) } : a));

/** Alerts from other crew members that are open, recent and not yet answered by `me`. */
export function forMe(list, me, now = new Date()) {
  return (list ?? []).filter((a) => !a.closed && a.from.id !== me?.id && ms(now) - ms(a.at) < ACTIVE_HOURS * 3600000 && !a.acks.some((k) => k.id === me?.id))
    .sort((a, b) => (a.level === b.level ? ms(b.at) - ms(a.at) : a.level === "emergency" ? -1 : 1));
}

/** My own open alerts, newest first. */
export const mine = (list, me) => (list ?? []).filter((a) => a.from.id === me?.id && !a.closed).sort((a, b) => ms(b.at) - ms(a.at));

/** Keeps only well-formed alerts read back from the device or a station. */
export function cleanAlerts(raw) {
  return (Array.isArray(raw) ? raw : []).filter((a) => a && typeof a.id === "string" && ["talk", "emergency"].includes(a.level) && !Number.isNaN(ms(a.at)) && a.from && Array.isArray(a.acks)).slice(-KEEP);
}

export function ago(at, now = new Date()) {
  const min = Math.max(0, Math.floor((ms(now) - ms(at)) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60 ? `${min % 60} min ` : ""}ago`;
}

/** Last n days of mood (1-5) and sleep (h) from the daily log, oldest first. */
export function mindTrend(log, today, n = 7) {
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const dt = new Date(y, m - 1, d - (n - 1 - i));
    const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    return { day: k, mood: log?.[k]?.mood?.value ?? null, sleep: log?.[k]?.sleepHours?.value ?? null };
  });
}

export const cleanComfort = (raw) => ({ calm: Boolean(raw?.calm), large: Boolean(raw?.large), focus: Boolean(raw?.focus) });
