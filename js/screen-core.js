// Mental health check-ins: short validated questionnaires asked every so often, scored, and
// turned into alerts for the ground medical team. Pure rules, no DOM. Wording and thresholds:
// data/screening.js (quoted in docs/SOURCES.md).
//
// Every 14 days (the questionnaires ask about "the last 2 weeks") the crew member answers four
// questions: PHQ-2 (depression) and GAD-2 (anxiety). Only when one of them screens positive
// (3 or more, the sources' cut-off) do the remaining items of the PHQ-9 or the GAD-7 follow.
// Every 28 days, seven more: PSS-4 (stress, "in the last month") and the 3-item UCLA loneliness
// scale. The ground can ask for a check-in at any time. Screening is not diagnosis: the app
// says "worth a look" and the flight surgeon decides.

import { PHQ9_ITEMS, GAD7_ITEMS, PSS4_ITEMS, UCLA3_ITEMS, FREQ4, PSS_OPTIONS, UCLA_OPTIONS, PSS4_REVERSED, TWO_WEEKS, PSS_LEAD, UCLA_LEAD } from "./data/screening.js";

export const CHECKINS_KEY = "geosfera.checkins";   // [check-in], shared with the ground through the sync
export const ASKS_KEY = "geosfera.checkin-asks";   // [{ member, at, by }], the ground asks for one now
export const MAX_CHECKINS = 200;
export const RULES = {
  coreDays: 14,     // PHQ-2 + GAD-2: every 2 weeks, the questionnaires' own recall period
  extraDays: 28,    // PSS-4 + UCLA-3: every 4 weeks ("in the last month")
  screenCut: 3,     // PHQ-2 and GAD-2: 3 or more is a positive screen (sources)
  gad7Cut: 8,       // GAD-7: "a score of 8 or greater represents a reasonable cut-point" (source)
  phq9Watch: 10,    // PHQ-9 moderate or worse (source's bands)
  severe: 15,       // PHQ-9 moderately severe or worse, GAD-7 severe: act now (app rule)
  pssRise: 4,       // app rule: PSS-4 up this much since their last (the PSS has no cut-off)
  uclaRise: 2       // app rule: UCLA-3 up this much since their last (no cut-off found in the paper)
};

export const SETS = {
  phq: { name: "PHQ", lead: TWO_WEEKS, items: PHQ9_ITEMS, options: FREQ4 },
  gad: { name: "GAD", lead: TWO_WEEKS, items: GAD7_ITEMS, options: FREQ4 },
  pss: { name: "PSS-4", lead: PSS_LEAD, items: PSS4_ITEMS, options: PSS_OPTIONS },
  ucla: { name: "UCLA-3", lead: UCLA_LEAD, items: UCLA3_ITEMS, options: UCLA_OPTIONS }
};

const ms = (t) => new Date(t).getTime();
const iso = (t) => new Date(t).toISOString();
const okTime = (t) => t != null && Number.isFinite(ms(t));
const sum = (a) => a.reduce((x, y) => x + y, 0);
const okAns = (set, list) => (Array.isArray(list) ? list : []).slice(0, SETS[set].items.length).map((v) => (SETS[set].options.some((o) => o.points === v) ? v : null));

/* ---------- which questions, in which order ---------- */

/**
 * The questions for this sitting given what is already answered: [{ set, i, text, lead, options }].
 * `extra` adds PSS-4 and UCLA-3. The PHQ-9 and GAD-7 follow-ups appear only after a positive
 * PHQ-2 or GAD-2.
 */
export function plan(answers = {}, { extra = false } = {}) {
  const a = { phq: answers.phq ?? [], gad: answers.gad ?? [] };
  const q = (set, i) => ({ set, i, text: SETS[set].items[i], lead: SETS[set].lead, options: SETS[set].options });
  const out = [q("phq", 0), q("phq", 1), q("gad", 0), q("gad", 1)];
  const two = (s) => (a[s][0] ?? 0) + (a[s][1] ?? 0);
  const coreDone = [a.phq[0], a.phq[1], a.gad[0], a.gad[1]].every((v) => v != null);
  if (coreDone && two("phq") >= RULES.screenCut) for (let i = 2; i < 9; i += 1) out.push(q("phq", i));
  if (coreDone && two("gad") >= RULES.screenCut) for (let i = 2; i < 7; i += 1) out.push(q("gad", i));
  if (extra) { for (let i = 0; i < 4; i += 1) out.push(q("pss", i)); for (let i = 0; i < 3; i += 1) out.push(q("ucla", i)); }
  return out;
}

/** The next unanswered question, or null when the sitting is complete. */
export function nextQuestion(answers, opts) {
  return plan(answers, opts).find((x) => answers?.[x.set]?.[x.i] == null) ?? null;
}

export function answer(answers, set, i, points) {
  const list = [...(answers?.[set] ?? [])];
  list[i] = points;
  return { ...answers, [set]: list };
}

/* ---------- scores ---------- */

export function scores(answers = {}) {
  const phq = okAns("phq", answers.phq), gad = okAns("gad", answers.gad), pss = okAns("pss", answers.pss), ucla = okAns("ucla", answers.ucla);
  const full = (l, n) => l.length >= n && l.slice(0, n).every((v) => v != null);
  return {
    phq2: full(phq, 2) ? phq[0] + phq[1] : null,
    gad2: full(gad, 2) ? gad[0] + gad[1] : null,
    phq9: full(phq, 9) ? sum(phq.slice(0, 9)) : null,
    gad7: full(gad, 7) ? sum(gad.slice(0, 7)) : null,
    item9: phq[8] ?? null,
    pss4: full(pss, 4) ? sum(pss.map((v, i) => (PSS4_REVERSED.includes(i) ? 4 - v : v))) : null,
    ucla3: full(ucla, 3) ? sum(ucla) : null
  };
}

// the sources' bands (PHQ-9: 5, 10, 15, 20; GAD-7: 5, 10, 15; the GAD-7 page writes "greater
// than 15" for severe and leaves 15 itself unlabelled: the app counts 15 as severe)
export function phq9Band(s) {
  if (s == null) return null;
  return s >= 20 ? "Severe" : s >= 15 ? "Moderately severe" : s >= 10 ? "Moderate" : s >= 5 ? "Mild" : "None-minimal";
}
export function gad7Band(s) {
  if (s == null) return null;
  return s >= 15 ? "Severe" : s >= 10 ? "Moderate" : s >= 5 ? "Mild" : "Minimal";
}

/* ---------- the record ---------- */

export function makeCheckin({ member, answers, kind = "core", at = new Date() }) {
  const sc = scores(answers);
  return { id: `ci-${ms(at).toString(36)}-${String(member).slice(-4)}`, member: String(member), kind, at: iso(at), answers: {
    phq: okAns("phq", answers.phq), gad: okAns("gad", answers.gad), pss: okAns("pss", answers.pss), ucla: okAns("ucla", answers.ucla)
  }, scores: sc };
}

export function cleanCheckins(list) {
  return (Array.isArray(list) ? list : [])
    .filter((c) => c && c.id && c.member && okTime(c.at))
    .map((c) => ({ id: String(c.id), member: String(c.member), kind: ["core", "extra", "asked"].includes(c.kind) ? c.kind : "core", at: iso(c.at), answers: { phq: okAns("phq", c.answers?.phq), gad: okAns("gad", c.answers?.gad), pss: okAns("pss", c.answers?.pss), ucla: okAns("ucla", c.answers?.ucla) }, scores: scores(c.answers ?? {}) }))
    .sort((a, b) => ms(b.at) - ms(a.at))
    .slice(0, MAX_CHECKINS);
}

export const forMember = (list, member) => cleanCheckins(list).filter((c) => c.member === member);

export function cleanAsks(list) {
  return (Array.isArray(list) ? list : []).filter((a) => a && a.member && okTime(a.at)).map((a) => ({ member: String(a.member), at: iso(a.at), by: String(a.by ?? "Ground medical team") }));
}

/* ---------- when ---------- */

const daysSince = (t, now) => (t ? (ms(now) - ms(t)) / 86400000 : Infinity);

/**
 * What is due for one crew member: { due, extra, asked, nextCore, nextExtra }. A check-in is due
 * when the last core one is 14 days old (or none), or the ground asked after the last one; PSS-4
 * and UCLA-3 ride along when the last of them is 28 days old.
 */
export function due(list, asks, member, now = new Date()) {
  const mine = forMember(list, member);
  const lastCore = mine.find((c) => c.scores.phq2 != null)?.at ?? null;
  const lastExtra = mine.find((c) => c.scores.pss4 != null || c.scores.ucla3 != null)?.at ?? null;
  const ask = cleanAsks(asks).filter((a) => a.member === member).sort((a, b) => ms(b.at) - ms(a.at))[0];
  const asked = Boolean(ask && (!mine[0] || ms(ask.at) > ms(mine[0].at)));
  const coreDue = daysSince(lastCore, now) >= RULES.coreDays;
  const extra = daysSince(lastExtra, now) >= RULES.extraDays;
  return {
    due: coreDue || asked || extra, extra, asked,
    nextCore: lastCore ? iso(ms(lastCore) + RULES.coreDays * 86400000) : null,
    nextExtra: lastExtra ? iso(ms(lastExtra) + RULES.extraDays * 86400000) : null
  };
}

/* ---------- what the ground should look at ---------- */

/**
 * Flags from one crew member's latest check-ins, most urgent first: [{ level: "act" | "watch", text }].
 * Item 9 of the PHQ-9 answered above "Not at all" is always "act": the source says it is a
 * screening question on suicide risk and needs assessment by someone competent to assess it.
 */
export function flags(list, member) {
  const mine = forMember(list, member);
  const out = [];
  const last = mine.find((c) => c.scores.phq2 != null);
  if (last) {
    const s = last.scores, day = last.at.slice(0, 10);
    if (s.item9 != null && s.item9 > 0) out.push({ level: "act", text: `PHQ-9 question 9 answered "${FREQ4[s.item9].label}" (${day}): assess suicide risk today` });
    if (s.phq9 != null && s.phq9 >= RULES.phq9Watch) out.push({ level: s.phq9 >= RULES.severe ? "act" : "watch", text: `PHQ-9 ${s.phq9} of 27, ${phq9Band(s.phq9).toLowerCase()} (${day})` });
    else if (s.phq2 >= RULES.screenCut) out.push({ level: "watch", text: `PHQ-2 positive: ${s.phq2} of 6 (${day})${s.phq9 != null ? `, PHQ-9 ${s.phq9}` : ""}` });
    if (s.gad7 != null && s.gad7 >= RULES.gad7Cut) out.push({ level: s.gad7 >= RULES.severe ? "act" : "watch", text: `GAD-7 ${s.gad7} of 21, ${gad7Band(s.gad7).toLowerCase()} (${day})` });
    else if (s.gad2 >= RULES.screenCut) out.push({ level: "watch", text: `GAD-2 positive: ${s.gad2} of 6 (${day})${s.gad7 != null ? `, GAD-7 ${s.gad7}` : ""}` });
  }
  const withPss = mine.filter((c) => c.scores.pss4 != null);
  if (withPss.length >= 2 && withPss[0].scores.pss4 - withPss[1].scores.pss4 >= RULES.pssRise) out.push({ level: "watch", text: `Stress (PSS-4) up from ${withPss[1].scores.pss4} to ${withPss[0].scores.pss4} of 16` });
  const withUcla = mine.filter((c) => c.scores.ucla3 != null);
  if (withUcla.length >= 2 && withUcla[0].scores.ucla3 - withUcla[1].scores.ucla3 >= RULES.uclaRise) out.push({ level: "watch", text: `Loneliness (UCLA-3) up from ${withUcla[1].scores.ucla3} to ${withUcla[0].scores.ucla3} of 9` });
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "act" ? -1 : 1));
}

/** The latest value of each score with the one before it: { phq2: { now, before, at }, ... }. */
export function latest(list, member) {
  const mine = forMember(list, member);
  const out = {};
  for (const k of ["phq2", "phq9", "gad2", "gad7", "pss4", "ucla3"]) {
    const with_ = mine.filter((c) => c.scores[k] != null);
    out[k] = with_.length ? { now: with_[0].scores[k], before: with_[1]?.scores[k] ?? null, at: with_[0].at, series: with_.slice(0, 8).reverse().map((c) => ({ at: c.at, v: c.scores[k] })) } : null;
  }
  return out;
}
