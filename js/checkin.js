// Mental health check-ins on screen (rules: screen-core.js, wording: data/screening.js).
// Crew side, on their home: when one is due, one question at a time with big answer buttons;
// the answers go to the ground and no score is shown to the crew member. Ground side, in each
// crew member's analysis: latest scores with their bands, what changed, flags, and a button to
// ask for a check-in now.

import * as Q from "./screen-core.js";
import { SCREEN_FACTS, SCREEN_URLS } from "./data/screening.js";
import { sendAlert } from "./support.js";
import { stamp } from "./clock-core.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const SNOOZE_KEY = "geosfera.checkin-snooze"; // this device only: "not now" until tomorrow
const quote = (f) => `<span data-no-i18n>“${f.quote}”</span> <a href="${f.url}" target="_blank" rel="noopener" data-no-i18n>${f.source}</a>`;

export const getCheckins = () => Q.cleanCheckins(read(Q.CHECKINS_KEY, []));
export const getAsks = () => Q.cleanAsks(read(Q.ASKS_KEY, []));
const dueFor = (member) => Q.due(getCheckins(), getAsks(), member);

/* ---------------- crew ---------------- */

const drafts = new Map(); // member -> { answers, extra, kind } while a check-in is in progress

const snoozed = (member) => read(SNOOZE_KEY, {})[member] === new Date().toISOString().slice(0, 10);

export function crewCheckinHtml(me) {
  const d = dueFor(me.id);
  const draft = drafts.get(me.id);
  if (draft) return runnerHtml(me, draft);
  if (draft === null) return doneHtml(me);
  if (!d.due || snoozed(me.id)) {
    return `<section class="ch-card ci-card ci-idle" aria-labelledby="ci-h"><h2 id="ci-h">Check-in</h2>
      <p class="fine">A few questions on how you have been, every two weeks.</p>${d.nextCore ? `<p class="fine">Next one: ${d.nextCore.slice(0, 10)}</p>` : ""}</section>`;
  }
  const n = Q.plan({}, { extra: d.extra }).length;
  return `<section class="ch-card ci-card ci-due" aria-labelledby="ci-h">
    <h2 id="ci-h">${d.asked ? "Your flight surgeon asked for a check-in" : "Time for your check-in"}</h2>
    <p>${n} short questions on how you have been. About a minute. Your answers go to the ground medical team; there are no right or wrong answers.</p>
    <div class="sh-row"><button type="button" class="cta main" data-ci="start">Start</button><button type="button" class="cta" data-ci="later">Not now</button></div>
  </section>`;
}

function runnerHtml(me, draft) {
  const q = Q.nextQuestion(draft.answers, { extra: draft.extra });
  const all = Q.plan(draft.answers, { extra: draft.extra });
  const done = all.filter((x) => draft.answers?.[x.set]?.[x.i] != null).length;
  const picked = null;
  return `<section class="ch-card ci-card ci-run" aria-labelledby="ci-q">
    <div class="ci-top"><span class="ci-step">${done + 1} / ${all.length}</span><span class="ci-bar"><i style="width:${Math.round((done / all.length) * 100)}%"></i></span>${done ? `<button type="button" class="textlink" data-ci="back">Previous question</button>` : ""}</div>
    <p class="ci-lead" data-no-i18n>${esc(q.lead)}</p>
    <h2 id="ci-q" class="ci-q" data-no-i18n>${esc(q.text)}</h2>
    <div class="ci-opts" role="group" aria-labelledby="ci-q">${q.options.map((o) => `<button type="button" class="ci-opt${picked === o.points ? " on" : ""}" data-ci-ans="${o.points}" data-no-i18n>${esc(o.label)}</button>`).join("")}</div>
    <p class="fine ci-lang">Validated questionnaire: shown in the language its wording was checked in (English).</p>
  </section>`;
}

function doneHtml() {
  return `<section class="ch-card ci-card ci-done" aria-labelledby="ci-h">
    <h2 id="ci-h">Thank you</h2>
    <p>Your answers are with the ground medical team. If you would like to talk to someone, use “I'd like to talk to someone” below, or press and hold SOS.</p>
  </section>`;
}

function item9Html() {
  return `<section class="ch-card ci-card ci-care" aria-labelledby="ci-h" role="alert">
    <h2 id="ci-h">Thank you for telling us</h2>
    <p>You are not alone with this. Your flight surgeon has been told and will talk with you today. If you need someone now, press and hold SOS, or tell a crewmate.</p>
  </section>`;
}

/** Binds the card inside `wrap`; `redraw` redraws it. */
export function bindCrewCheckin(wrap, me, redraw) {
  wrap.onclick = (e) => {
    const b = e.target.closest("[data-ci], [data-ci-ans]");
    if (!b) return;
    if (b.dataset.ci === "start") { const d = dueFor(me.id); drafts.set(me.id, { answers: {}, extra: d.extra, kind: d.asked ? "asked" : d.extra ? "extra" : "core" }); return redraw(); }
    if (b.dataset.ci === "later") { write(SNOOZE_KEY, { ...read(SNOOZE_KEY, {}), [me.id]: new Date().toISOString().slice(0, 10) }); return redraw(); }
    const draft = drafts.get(me.id);
    if (!draft) return;
    if (b.dataset.ci === "back") {
      const all = Q.plan(draft.answers, { extra: draft.extra }).filter((x) => draft.answers?.[x.set]?.[x.i] != null);
      const last = all.at(-1);
      if (last) { const l = [...draft.answers[last.set]]; l[last.i] = null; draft.answers = { ...draft.answers, [last.set]: l }; }
      return redraw();
    }
    const q = Q.nextQuestion(draft.answers, { extra: draft.extra });
    if (!q) return;
    draft.answers = Q.answer(draft.answers, q.set, q.i, Number(b.dataset.ciAns));
    if (Q.nextQuestion(draft.answers, { extra: draft.extra })) return redraw();
    // complete: save, and tell the ground at once if question 9 was answered above "Not at all"
    const rec = Q.makeCheckin({ member: me.id, answers: draft.answers, kind: draft.kind });
    write(Q.CHECKINS_KEY, [rec, ...getCheckins()].slice(0, Q.MAX_CHECKINS));
    drafts.set(me.id, null);
    if (rec.scores.item9 > 0) {
      sendAlert("talk", { note: "Check-in: PHQ-9 question 9 answered above “Not at all”. Please call today." });
      wrap.innerHTML = item9Html();
      return;
    }
    redraw();
  };
}

/* ---------------- ground ---------------- */

const ROWS = [
  { key: "phq", label: "Depression", short: "phq2", full: "phq9", shortMax: 6, fullMax: 27, band: Q.phq9Band, shortName: "PHQ-2", fullName: "PHQ-9" },
  { key: "gad", label: "Anxiety", short: "gad2", full: "gad7", shortMax: 6, fullMax: 21, band: Q.gad7Band, shortName: "GAD-2", fullName: "GAD-7" },
  { key: "pss", label: "Stress", short: "pss4", shortMax: 16, shortName: "PSS-4" },
  { key: "ucla", label: "Loneliness", short: "ucla3", shortMax: 9, shortMin: 3, shortName: "UCLA-3" }
];

function dots(series, max, min = 0) {
  if (!series?.length) return "";
  return `<span class="ci-dots" aria-hidden="true">${series.map((p) => `<i style="height:${Math.max(8, Math.round(((p.v - min) / (max - min)) * 100))}%" title="${p.at.slice(0, 10)}: ${p.v}"></i>`).join("")}</span>`;
}

export function groundCheckinHtml(member) {
  const list = getCheckins();
  const L = Q.latest(list, member.id);
  const fl = Q.flags(list, member.id);
  const d = Q.due(list, getAsks(), member.id);
  const last = Q.forMember(list, member.id)[0];
  return `<section class="an-card ci-ground" aria-labelledby="ci-g-h" data-ci-member="${esc(member.id)}">
    <h2 id="ci-g-h">Mental health check-ins</h2>
    <p class="fine">Validated questionnaires every two weeks (depression and anxiety, 4 questions; more only after a positive answer) and every four weeks (stress and loneliness). Screening, not diagnosis.</p>
    ${fl.length ? `<ul class="an-items">${fl.map((f) => `<li class="mc-${f.level}"><span class="mc-kind">Check-in</span><span>${esc(f.text)}</span></li>`).join("")}</ul>` : last ? `<p class="fine">Nothing flagged in the latest check-in.</p>` : ""}
    <div class="ci-grid">${ROWS.map((r) => {
      const s = L[r.short], f = r.full ? L[r.full] : null;
      const fullNewer = f && s && f.at >= s.at;
      const pos = s && (r.key === "phq" || r.key === "gad") && s.now >= Q.RULES.screenCut;
      const change = s && s.before != null ? s.now - s.before : null;
      return `<div class="an-out ci-out${pos || (fullNewer && f.now >= (r.key === "gad" ? Q.RULES.gad7Cut : Q.RULES.phq9Watch)) ? " warn" : ""}">
        <small>${r.label} · ${r.shortName}${r.full ? ` / ${r.fullName}` : ""}</small>
        <b>${s ? `${s.now} <i>of ${r.shortMax}</i>` : "—"}</b>
        ${fullNewer ? `<em><strong>${r.fullName} ${f.now} of ${r.fullMax}</strong> · ${r.band(f.now)}</em>` : ""}
        <em>${!s ? "Not asked yet" : r.full ? (pos ? "Positive screen (3 or more)" : "Negative screen") : change == null ? "First answer: compared with their own next one" : change === 0 ? "Same as last time" : `${change > 0 ? "+" : ""}${change} since last time`}${s ? ` · ${s.at.slice(0, 10)}` : ""}</em>
        ${s ? dots(s.series, r.shortMax, r.shortMin ?? 0) : ""}
      </div>`;
    }).join("")}</div>
    <p class="fine ci-when">${d.due ? "<span>A check-in is due now.</span>" : `<span>Next check-in: ${d.nextCore ? d.nextCore.slice(0, 10) : "—"}</span>${d.nextExtra ? ` <span>Stress and loneliness: ${d.nextExtra.slice(0, 10)}</span>` : ""}`}${last ? ` <span>Last answered ${stamp(last.at)}</span>` : ""}</p>
    <div class="sh-row"><button type="button" class="cta" data-ci-ask>${d.asked ? "Check-in requested" : "Ask for a check-in now"}</button></div>
  </section>`;
}

export function bindGroundCheckin(root, member, redraw) {
  const box = root.querySelector(`[data-ci-member="${CSS.escape(member.id)}"]`);
  if (!box) return;
  box.addEventListener("click", (e) => {
    if (!e.target.closest("[data-ci-ask]")) return;
    write(Q.ASKS_KEY, [{ member: member.id, at: new Date().toISOString(), by: "Ground medical team" }, ...getAsks()].slice(0, 100));
    redraw();
  });
}

/** The fold on the analysis page: what each questionnaire is, quoted, with links. */
export const checkinAboutHtml = () => `<p><strong>Depression:</strong> PHQ-2, the first two questions of the PHQ-9. ${quote(SCREEN_FACTS.phq2Cut)} ${quote(SCREEN_FACTS.phq2Next)} ${quote(SCREEN_FACTS.phq9Use)} ${quote(SCREEN_FACTS.phq9Item9)} When question 9 is answered above “Not at all”, the app raises “Act now” and sends a request to talk.</p>
  <p><strong>Anxiety:</strong> GAD-2, the first two questions of the GAD-7. ${quote(SCREEN_FACTS.gad2Sens)} ${quote(SCREEN_FACTS.gad7Sens)} ${quote(SCREEN_FACTS.gadFree)}</p>
  <p><strong>Stress:</strong> PSS-4. ${quote(SCREEN_FACTS.pssReverse)} ${quote(SCREEN_FACTS.pssNoCut)} So the app compares each crew member with their own last answer. ${quote(SCREEN_FACTS.pssPermission)}</p>
  <p><strong>Loneliness:</strong> the 3-item UCLA scale (Hughes et al., 2004). ${quote(SCREEN_FACTS.uclaSum)} The paper gives no cut-off, so again the app compares with their own last answer.</p>
  <p class="fine">Questions are shown in English, the wording checked against the sources; a validated Spanish version was not verified. How often to ask, the follow-up rule and the rises that raise a flag (PSS-4 up 4, UCLA-3 up 2) are app rules (docs/SOURCES.md). <a href="${SCREEN_URLS.phq9}" target="_blank" rel="noopener">PHQ-9</a> · <a href="${SCREEN_URLS.gad7}" target="_blank" rel="noopener">GAD-7</a> · <a href="${SCREEN_URLS.pssForm}" target="_blank" rel="noopener">PSS-4 form</a> · <a href="${SCREEN_URLS.ucla3}" target="_blank" rel="noopener">UCLA-3 paper</a></p>`;
