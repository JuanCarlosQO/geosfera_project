// Day-theme dashboard hero: the app's own body figure with a card per body system, and
// beside it the crew member's card, two charts drawn from the daily log, the check-in
// gauge and today's readings. It shows only what the crew member logged; nothing here is
// a health score. The night theme keeps the Cupola.

import { figureSvg } from "./anatomy.js";
import { WINDOWS, series, EXERCISE_GOAL_MIN } from "./today-core.js";
import { STATUS } from "./data/body-systems.js";
import { judgeReading, fieldByKey } from "./log-core.js";
import { areaChart, completion, gaugeArc, readingList } from "./clinic-core.js";
import { tile } from "./icons.js";

const ICONS = {
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/>',
  lungs: '<path d="M12 4v8M12 12c-1.500-2-5-2-6 1-1 2.500-1.500 5-1 6 .5 1 4 .5 5-1 1-1.500 2-3 2-6zM12 12c1.500-2 5-2 6 1 1 2.500 1.500 5 1 6-.5 1-4 .5-5-1-1-1.500-2-3-2-6z"/>',
  mind: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 0V7a3 3 0 0 0-3-3zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 0"/>',
  metabolism: '<path d="M12 3c3 4 5 6.500 5 9.500a5 5 0 0 1-10 0C7 9.500 9 7 12 3z"/>',
  body: '<path d="M10 4a2 2 0 0 1 4 0v9.500a4 4 0 1 1-4 0zM12 9v7"/>',
  radiation: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10 9 4.800A8 8 0 0 0 4.200 13H10M14 12h5.800A8 8 0 0 0 15 4.800L12 10M13 13.700 16 19a8 8 0 0 1-8 0l3-5.300"/>'
};
const UNIT = { heartRate: "bpm", bloodOxygen: "%", glucose: "mg/dL", radiationDose: "mSv", temperature: "°C", sleepHours: "h", mood: "of 5", bloodPressure: "mmHg" };
const CALLOUTS = ["mind", "heart", "lungs", "metabolism"];

const icon = (id, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>`;
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (v) => (Array.isArray(v) ? `${v[0]}/${v[1]}` : String(v));
const tone = (key) => { const s = STATUS[key]; return `<span class="cl-tone tone-${s.tone}"><span aria-hidden="true">${s.shape}</span> ${s.word}</span>`; };

function callout(id, summary, entry) {
  const win = WINDOWS.find((w) => w.id === id);
  const key = win.readings.find((k) => entry?.[k]?.value != null);
  const value = key ? fmt(entry[key].value) : "—";
  return `<button type="button" class="cl-callout" data-callout="${id}" data-body="${win.body}" aria-label="${win.label}: ${STATUS[summary.status[id]].word}. Open in the body view">
    <span class="cl-co-icon">${icon(id, 26)}</span>
    <span class="cl-co-name">${win.label}</span>
    <span class="cl-co-value">${value}${key ? `<small> ${UNIT[key] ?? ""}</small>` : ""}</span>
    ${tone(summary.status[id])}
  </button>`;
}

function chartCard(title, key, kind, log, day, entry) {
  const field = fieldByKey(key);
  const r = entry?.[key];
  const c = areaChart(series(log, key, day, 14));
  const id = `cl-${kind}`;
  return `<section class="cl-card cl-chart cl-${kind}" aria-label="${title}, last 14 days">
    <header><h2>${title}</h2><p class="cl-now">${r?.value != null ? `<strong>${Array.isArray(r.value) ? r.value[0] : r.value}</strong>${Array.isArray(r.value) ? `/${r.value[1]}` : ""} ${field.unit}` : `<strong>—</strong> ${field.unit}`}</p></header>
    <svg viewBox="0 0 320 130" preserveAspectRatio="none" role="img" aria-label="${c ? `${c.points} readings in the last 14 days, from ${c.min} to ${c.max} ${field.unit}` : "Not enough readings to draw a chart"}">
      <defs>
        <pattern id="${id}-dots" width="16" height="13" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" class="cl-dot"/></pattern>
        <linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="cl-fade-a"/><stop offset="1" class="cl-fade-b"/></linearGradient>
      </defs>
      ${c ? `<path d="${c.area}" fill="url(#${id}-fade)"/>` : ""}
      <rect width="320" height="130" fill="url(#${id}-dots)"/>
      ${c ? `<path d="${c.line}" class="cl-line" pathLength="1"/><circle cx="${c.last[0]}" cy="${c.last[1]}" r="3.500" class="cl-last"/>` : ""}
    </svg>
    <p class="cl-cap">${c ? `${key === "bloodPressure" ? "Top number · " : ""}${c.points} of the last 14 days${c.gaps ? " · days without a reading are joined by a straight line" : ""}` : "Log it on two days to see the line."} ${r?.value != null ? tone(judgeReading(key, r)) : ""}</p>
  </section>`;
}

/**
 * props: { log, day, entry, summary, mday, streak, exercise, actions, isToday, followUps, who: { name, role } }
 * part: "all" (default), "overview" (figure and crew member card) or "charts" (charts, gauge and readings).
 */
export function clinicHero({ log, day, entry, summary, mday, streak, exercise, actions, isToday, followUps = 0, reminders = [], family = 0, who = {}, stage = "", part = "all" }) {
  const name = esc(who.name || "Crew member");
  const role = esc(who.role || "Crew");
  const done = completion(entry);
  const g = gaugeArc(done.fraction);
  const rows = readingList(entry, judgeReading);
  const next = actions[0];
  const checkIn = isToday ? "#log" : `#log/${day}`;
  const info = `<section class="cl-card cl-info" aria-labelledby="cl-info-h">
        <h2 id="cl-info-h">Crew member</h2>
        <div class="cl-info-grid">
          <div class="cl-avatar" aria-hidden="true"><svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="26" r="15"/><path d="M22 26a10 8 0 0 1 20 0v3a10 6 0 0 1-20 0z"/><path d="M12 56c2-9 9-13 20-13s18 4 20 13"/><path d="M26 47v6M38 47v6"/></svg></div>
          <dl>
            <div class="cl-who">${name}</div>
            <div><dt>Role</dt><dd>${role}</dd></div>
            <div><dt>Mission day</dt><dd>${mday}</dd></div>
            <div><dt>Check-in streak</dt><dd>${streak} ${streak === 1 ? "day" : "days"}</dd></div>
            <div><dt>Exercise today</dt><dd>${exercise} of ${EXERCISE_GOAL_MIN} min</dd></div>
          </dl>
          <div class="cl-next">
            <span>Next step</span>
            <strong>${next ? next.title : "Nothing to do"}</strong>
            <small>${next ? next.text : "Keep your routine: exercise, meals and sleep on schedule."}</small>
            ${reminders.length ? `<a class="cl-rem" href="#meds"><b>${reminders.length} ${reminders.length === 1 ? "reminder" : "reminders"}</b>${reminders.slice(0, 3).map((r) => `<span>${esc(r.text)}</span>`).join("")}${reminders.length > 3 ? `<span>and ${reminders.length - 3} more</span>` : ""}</a>` : ""}
            ${family ? `<a class="cl-fam" href="#family">✉ ${family} ${family === 1 ? "message" : "messages"} from home, sealed. Open whenever you like.</a>` : ""}
          </div>
        </div>
        <a class="cl-cta" href="${checkIn}">${isToday ? (done.filled ? "Continue today's check-in" : "Start today's check-in") : "Correct this day"}</a>
      </section>`;
  const charts = `<div class="cl-charts">
        ${chartCard("Blood pressure", "bloodPressure", "bp", log, day, entry)}
        ${chartCard("Heart rate", "heartRate", "hr", log, day, entry)}
      </div>

      <section class="cl-card cl-comp" aria-labelledby="cl-comp-h">
        <div class="cl-gauge">
          <svg viewBox="0 0 240 132" role="img" aria-label="${done.filled} of ${done.total} check-in steps logged">
            <path d="${g.track}" class="cl-g-track"/>
            ${g.fill ? `<path d="${g.fill}" class="cl-g-fill" pathLength="1"/>` : ""}
          </svg>
          <p class="cl-g-num">${done.percent}%</p>
          <p class="cl-g-word">${done.filled} of ${done.total} check-in steps logged</p>
          <p class="cl-g-note">Check-in completeness, not a health score.</p>
        </div>
        <div class="cl-list">
          <h2 id="cl-comp-h">${isToday ? "Today's readings" : "Readings on this day"}</h2>
          <ul>${rows.map((r) => `<li><span class="cl-row-name">${tile(r.key, 18)}${r.label}</span><span class="cl-val tone-${STATUS[r.status].tone}"><strong>${r.value}</strong> ${r.unit}<span class="cl-shape" title="${STATUS[r.status].word}" aria-label="${STATUS[r.status].word}">${STATUS[r.status].shape}</span></span></li>`).join("")}</ul>
        </div>
      </section>`;
  if (part === "charts") return `<div class="clinic clinic-charts"><div class="cl-side">${charts}</div></div>`;
  return `<div class="clinic">
    <div class="cl-stage${stage ? " cl-stage-cupola" : ""}">
      ${stage || `<div class="cl-figure" aria-hidden="true">${figureSvg()}</div>
      <div class="cl-callouts">${CALLOUTS.map((id) => callout(id, summary, entry)).join("")}</div>`}
      <p class="cl-plate">${name} · Mission day ${mday}</p>
    </div>

    <div class="cl-side">
      ${info}
      ${part === "overview" ? "" : charts}
    </div>
  </div>`;
}
