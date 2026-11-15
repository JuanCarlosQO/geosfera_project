// Mind map — the rules behind the 3D brain, with no DOM so Node can test them.
// Five signals the crew member already produces in the app are read together:
//   sleep     last night's hours (the Earth reference already used in the readings table)
//   mood      today's 1-5 answer, and whether it sits below the member's own usual
//   alertness medications in the log that NASA's kit list cautions about, still in their window
//   home      the family channel: sealed messages, a pause, or two reads in a row that hurt
//   support   the member's own open requests ("I'd like to talk", SOS)
// Each signal lights a zone of the brain. THE ZONES ARE A MAP, NOT ANATOMY: the app does not
// claim to know where mood or homesickness sit in a brain, and it measures nothing in one.
// Nothing here diagnoses. The mood cut-offs and "two in a row" are app rules.

import { judgeReading } from "./log-core.js";
import { checkMeds } from "./duty-core.js";
import { homesick, isPaused, waiting } from "./family-core.js";
import { mine } from "./support-core.js";

export const RULES = {
  lowMood: 2,      // app rule (same as Fit for duty): 1 or 2 of 5 is worth a look
  dropPoints: 1,   // app rule: the last days average this far under the member's own usual
  recentDays: 3,
  usualDays: 14,
  usualMin: 5      // readings needed before "your usual" means anything
};

export const SIGNALS = [
  { id: "sleep", label: "Sleep", zones: ["stem", "cerebellum"] },
  { id: "mood", label: "Mood", zones: ["temporal"] },
  { id: "alert", label: "Alertness", zones: ["frontal"] },
  { id: "home", label: "Home", zones: ["parietal"] },
  { id: "support", label: "Support", zones: ["occipital"] }
];

const dayBack = (today, n) => {
  const [y, m, d] = today.split("-").map(Number);
  const t = new Date(y, m - 1, d - n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const round1 = (v) => Math.round(v * 10) / 10;

/** Values of one reading on the `days` days ending `from` days before today (skips "Measure again"). */
export function valuesOf(log, key, today, days, from = 0) {
  const out = [];
  for (let i = from; i < from + days; i++) {
    const r = log?.[dayBack(today, i)]?.[key];
    if (r?.value != null && r.flag !== "again") out.push(r.value);
  }
  return out;
}

/** The member's own usual: the mean of the days before the recent ones, or null with too few readings. */
export function usual(log, key, today) {
  const list = valuesOf(log, key, today, RULES.usualDays, RULES.recentDays);
  return list.length >= RULES.usualMin ? round1(mean(list)) : null;
}

function sleepSignal(log, today) {
  const r = log?.[today]?.sleepHours;
  const mine_ = usual(log, "sleepHours", today);
  const base = { usual: mine_, unit: "h", href: "#log", cta: "Open today's check-in" };
  if (r?.value == null) return { ...base, status: "none", value: "—", text: "Last night's sleep is not logged yet.", basis: "none" };
  if (r.flag === "again") return { ...base, status: "again", value: `${r.value} h`, text: "Your sleep entry is marked “Measure again”. Check it in the log.", basis: "app" };
  const status = judgeReading("sleepHours", r);
  return { ...base, status, value: `${r.value} h`, text: status === "normal" ? "Seven hours or more last night." : "Under seven hours last night.", basis: "ref" };
}

function moodSignal(log, today, scale) {
  const r = log?.[today]?.mood;
  const mine_ = usual(log, "mood", today);
  const base = { usual: mine_, unit: "of 5", href: "#log", cta: "Open today's check-in" };
  if (r?.value == null) return { ...base, status: "none", value: "—", text: "Today's mood is not logged yet.", basis: "none" };
  const word = scale?.[r.value - 1];
  const value = `${r.value} of 5`;
  const recent = valuesOf(log, "mood", today, RULES.recentDays);
  const drop = mine_ != null && recent.length >= 2 && mine_ - mean(recent) >= RULES.dropPoints;
  if (r.value <= RULES.lowMood) return { ...base, status: "watch", value, word, text: "Low today. Worth telling someone you trust on the crew.", basis: "app" };
  if (drop) return { ...base, status: "watch", value, word, text: `Lower than your own usual (${mine_}) over the last ${recent.length} days.`, basis: "app" };
  return { ...base, status: "normal", value, word, text: mine_ != null ? `In line with your own usual (${mine_}).` : "Logged. A few more days and it is compared with your own usual.", basis: "app" };
}

function alertSignal(doses, kit, now) {
  const c = checkMeds(doses, kit, now);
  const base = { href: "#duty", cta: "Fit for duty check" };
  if (c.state !== "flag") return { ...base, status: "normal", value: "Clear", text: "No medication with a NASA performance caution in its counting window of your log.", basis: "nasa" };
  const first = c.items[0];
  return { ...base, status: "watch", value: first.med.name, items: c.items, text: `${c.items.map((i) => `${i.med.name}, ${i.hoursAgo} h ago`).join("; ")}. NASA's kit list cautions about performance.`, basis: "nasa" };
}

function homeSignal(box, me) {
  const base = { href: "#family", cta: "Family channel" };
  const id = me?.id;
  if (!id) return { ...base, status: "none", value: "—", text: "Register the crew to receive messages from home.", basis: "none" };
  if (isPaused(box, id)) return { ...base, status: "none", value: "Paused", text: "You paused the channel. Messages are kept, sealed, and nothing is announced.", basis: "app" };
  const n = waiting(box, id);
  if (homesick(box, id)) return { ...base, status: "watch", value: "Homesick", text: "Your last two messages both left you more homesick. Missing home on a long mission is expected.", basis: "app" };
  if (n) return { ...base, status: "normal", value: `${n} sealed`, text: `${n} ${n === 1 ? "message" : "messages"} from home, sealed. Open ${n === 1 ? "it" : "them"} whenever you like, or not at all.`, basis: "app" };
  return { ...base, status: "normal", value: "Quiet", text: "Nothing waiting from home right now.", basis: "app" };
}

function supportSignal(alerts, me) {
  const open = mine(alerts, me);
  const base = { href: null, cta: null };
  const sos = open.find((a) => a.level === "emergency");
  const talk = open.find((a) => a.level === "talk");
  const answer = (a) => (a.acks.length ? `${a.acks[0].name} ${a.acks[0].kind === "coming" ? "is on the way" : "saw it"}.` : "No answer yet.");
  if (sos) return { ...base, status: "act", value: "SOS open", text: `Your SOS is open. ${answer(sos)}`, basis: "app", alertId: sos.id };
  if (talk) return { ...base, status: "watch", value: "Asked to talk", text: `You asked to talk to someone. ${answer(talk)}`, basis: "app", alertId: talk.id };
  return { ...base, status: "normal", value: "No request", text: "You have no open request. Asking early is part of the job, not a failure.", basis: "app" };
}

/**
 * The five signals for one crew member, in SIGNALS order.
 * Each: { id, label, zones, status, value, text, basis, href, cta, ... }.
 * status: "normal" | "watch" | "act" | "again" | "none". basis: "ref" (Earth reference),
 * "nasa" (NASA kit list caution), "app" (app rule) or "none" (nothing logged).
 */
export function mindSignals({ log = {}, today, doses = [], kit = [], alerts = [], box = {}, me = null, scale = null, now = new Date() }) {
  const by = {
    sleep: sleepSignal(log, today),
    mood: moodSignal(log, today, scale),
    alert: alertSignal(doses, kit, now),
    home: homeSignal(box, me),
    support: supportSignal(alerts, me)
  };
  return SIGNALS.map((s) => ({ ...s, ...by[s.id] }));
}

const RANK = { act: 3, watch: 2, again: 1, normal: 0, none: 0 };

/** One honest line for the whole map. Never a score. */
export function overall(signals) {
  const flagged = signals.filter((s) => s.status === "watch" || s.status === "act");
  const logged = signals.filter((s) => s.status !== "none");
  if (flagged.some((s) => s.status === "act")) return { status: "act", title: "Your SOS is open", flagged: flagged.map((s) => s.id) };
  if (flagged.length) return { status: "watch", title: `${flagged.length} ${flagged.length === 1 ? "signal" : "signals"} to look at: ${flagged.map((s) => s.label.toLowerCase()).join(", ")}`, flagged: flagged.map((s) => s.id) };
  if (logged.length < signals.length) return { status: "none", title: "Nothing stands out, but today's check-in is not complete", flagged: [] };
  return { status: "normal", title: "Nothing stands out today", flagged: [] };
}

/** The signal to show first: the most serious one, else the first. */
export const firstSignal = (signals) => [...signals].sort((a, b) => RANK[b.status] - RANK[a.status])[0]?.id ?? signals[0]?.id;

/** Status per brain zone, for the drawing. */
export function zoneStatus(signals) {
  const out = {};
  for (const s of signals) for (const z of s.zones) out[z] = s.status;
  return out;
}
