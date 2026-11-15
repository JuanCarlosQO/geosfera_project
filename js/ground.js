// Mission Control (#ground), the ground medical team's home: the whole crew at a glance.
// On top, the mission and a few counts; then "Look at now", every crew member's items ranked
// (requests, emergency openings, symptoms after exercise, medication patterns, readings away from
// their own usual and where they are heading); then one card per crew member with last night,
// heart rate, exercise and mood against their own two weeks. A card opens that crew member's
// analysis (#analysis). Nothing here is a diagnosis or a health score. Rules: crew-status.js,
// predict-core.js.

import { getCrew, setActive } from "./store.js";
import { crewStatus, mission } from "./crew-status.js";
import { missionDay } from "./today-core.js";
import * as P from "./predict-core.js";
import { avatarHtml } from "./avatar.js";
import { DEVICE_FACTS } from "./data/devices.js";
import { fold } from "./fold.js";
import { demoNoticeHtml, demoLoaded } from "./demo.js";
import { researchHtml } from "./research.js";
import * as X from "./exercise-core.js";
import { exerciseStore } from "./exercise.js";
import { getAlerts } from "./support.js";
import * as C from "./sleepcheck-core.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const quote = (f) => `“${f.quote}” <a href="${f.url}" target="_blank" rel="noopener">${f.source}</a>`;
const SIM = ["simulated", "sensors"];
export const LEVEL_WORDS = { act: { word: "Act now", cls: "act" }, watch: { word: "Take a look", cls: "watch" }, ok: { word: "Nothing to look at", cls: "ok" } };
export const KIND = { request: "Request", opening: "Own data", answer: "Morning answer", exercise: "Exercise", meds: "Medication", trend: "Readings" };

export function missionLine(crew) {
  const m = mission();
  if (!m?.name) return "";
  const day = m.start ? missionDay(m.start, new Date()) : null;
  return `<p class="gf-mission"><strong data-no-i18n>${esc(m.name)}</strong><span>${esc(m.where ?? "")}</span>${day ? `<span>Mission day ${day}${m.length ? ` of ${m.length}` : ""}</span>` : ""}${crew ? `<span>${crew} crew</span>` : ""}<span class="sim">SIMULATED</span></p>`;
}

/** A 14-day sparkline on one scale with the crew member's usual (mean ± spread) as a band. */
export function spark(series, base, w = 120, h = 32) {
  const vals = series.map((p) => p.v);
  const nums = vals.filter((v) => v != null);
  if (nums.length < 2) return `<svg class="mc-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"></svg>`;
  const lo = Math.min(...nums, base ? base.mean - base.sd : Infinity), hi = Math.max(...nums, base ? base.mean + base.sd : -Infinity);
  const y = (v) => Number((h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6)).toFixed(1));
  const band = base ? `<rect x="0" y="${y(base.mean + base.sd)}" width="${w}" height="${Math.max(1, y(base.mean - base.sd) - y(base.mean + base.sd)).toFixed(1)}" class="mc-band"/>` : "";
  const step = w / (vals.length - 1);
  let d = "", pen = false;
  vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${(i * step).toFixed(1)} ${y(v)} `; pen = true; });
  const last = vals.length - 1;
  return `<svg class="mc-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${band}<path d="${d}"/>${vals[last] != null ? `<circle cx="${w}" cy="${y(vals[last])}" r="2.6"/>` : ""}</svg>`;
}

export const usualWord = (a) => (a.now == null ? "Not logged yet" : !a.base ? "No usual yet" : a.away ? (a.z > 0 ? "Above their usual" : "Below their usual") : a.direction === "steady" ? "As usual" : a.direction === "rising" ? "Rising this week" : "Falling this week");
const series14 = (s, key) => P.series(s.log, key, s.today, 14);
const shown = (s) => s.items.filter((i) => i.level !== "info");

function card(s) {
  const m = s.member, lv = LEVEL_WORDS[s.level];
  const sl = s.sleep, hr = s.heart;
  const sleepSrc = s.log[s.today]?.sleepHours?.src;
  const items = shown(s);
  return `<li><button type="button" class="mc-card mc-${lv.cls}" data-open="${esc(m.id)}">
    <span class="mc-top"><span class="mc-who">${avatarHtml(m, "mc-av")}<span><strong data-no-i18n>${esc(m.name)}</strong><small>${esc(m.role)}</small></span></span><span class="mc-pill mc-${lv.cls}">${lv.word}</span></span>
    <span class="mc-stats">
      <span class="mc-stat${sl.concern ? " bad" : ""}"><small>Last night</small><b>${sl.now != null ? C.hm(sl.now) : "—"}</b>${spark(series14(s, "sleepHours"), sl.base)}<em>${usualWord(sl)}${SIM.includes(sleepSrc) ? ' <i class="sim">SIM</i>' : ""}</em></span>
      <span class="mc-stat${hr.concern ? " bad" : ""}"><small>Heart rate</small><b>${hr.now ?? "—"} <i>bpm</i></b>${spark(series14(s, "heartRate"), hr.base)}<em>${usualWord(hr)}</em></span>
      <span class="mc-stat"><small>Exercise, 7 days</small><b>${s.adherence == null ? "—" : `${Math.round(s.adherence * 100)} %`}</b><span class="mc-bar"><i style="width:${Math.round((s.adherence ?? 0) * 100)}%"></i></span><em>Today ${s.exToday.done} of ${s.exToday.total}</em></span>
      <span class="mc-stat"><small>Mood today</small><b>${s.mood ?? "—"} <i>of 5</i></b><span class="mc-dots">${[1, 2, 3, 4, 5].map((n) => `<i class="${s.mood != null && n <= s.mood ? "on" : ""}"></i>`).join("")}</span><em>${s.answer ? `Feels: ${C.FEELS.find((f) => f.id === s.answer)?.label}` : s.check.ask ? "Not answered yet" : "No question today"}</em></span>
    </span>
    ${items.length ? `<span class="mc-items">${items.slice(0, 3).map((i) => `<span class="mc-item mc-${i.level}"><b>${KIND[i.kind]}</b> <span>${esc(i.text)}</span></span>`).join("")}${items.length > 3 ? `<span class="mc-more">+${items.length - 3} more in the analysis</span>` : ""}</span>` : ""}
    <span class="mc-open">Open analysis ›</span>
  </button></li>`;
}

export function mountGround(host) {
  const members = getCrew().members;
  const all = members.map((m) => crewStatus(m));
  const faults = X.openFaults(exerciseStore());
  const requests = getAlerts().filter((a) => !a.closed && members.some((m) => m.id === a.from?.id)).length;
  const sessions = all.reduce((a, s) => ({ done: a.done + s.exToday.done, total: a.total + s.exToday.total }), { done: 0, total: 0 });
  // most urgent first; then what crew members said or asked before what the readings show
  const ORDER = ["request", "opening", "exercise", "meds", "answer", "trend"];
  const look = all.flatMap((s) => shown(s).map((i) => ({ ...i, member: s.member })))
    .sort((a, b) => (a.level !== b.level ? (a.level === "act" ? -1 : 1) : ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)));
  const needs = all.filter((s) => s.level !== "ok").length;

  host.innerHTML = `<section class="ground mc">
    <header>
      <p class="eyebrow">Mission Control · ground medical team</p>
      <h1 tabindex="-1">Crew this morning</h1>
      ${missionLine(members.length)}
    </header>
    ${demoLoaded() ? demoNoticeHtml() : ""}

    <div class="mc-kpis">
      <div class="mc-kpi${needs ? " watch" : ""}"><b>${needs}</b><small>of ${members.length} crew need a look</small></div>
      <div class="mc-kpi${requests ? " watch" : ""}"><b>${requests}</b><small>${requests === 1 ? "open request" : "open requests"}</small></div>
      <div class="mc-kpi"><b>${sessions.done}/${sessions.total}</b><small>exercise sessions done today</small></div>
      <div class="mc-kpi${faults.length ? " watch" : ""}"><b>${faults.length}</b><small>${faults.length === 1 ? "machine problem open" : "machine problems open"}</small></div>
    </div>

    <section class="mc-look" aria-labelledby="mc-look-h">
      <h2 id="mc-look-h">Look at now</h2>
      ${look.length ? `<ol class="mc-list">${look.slice(0, 8).map((i) => `<li class="mc-${i.level}"><button type="button" data-open="${esc(i.member.id)}"><span class="mc-dot" aria-hidden="true"></span><strong data-no-i18n>${esc(i.member.name.split(" ")[0])}</strong><span class="mc-kind">${KIND[i.kind]}</span><span class="mc-text">${esc(i.text)}</span><span class="mc-go" aria-hidden="true">›</span></button></li>`).join("")}</ol>${look.length > 8 ? `<p class="fine">${look.length - 8} more in each crew member's analysis.</p>` : ""}` : `<p class="fine">Nothing to look at this morning.</p>`}
    </section>

    <h2 class="mc-h2">Crew</h2>
    <ul class="mc-grid">${all.map(card).join("")}</ul>

    ${fold("How Mission Control reads the crew", `<p>Each crew member is compared with <strong>their own</strong> last two weeks, not with anyone else: their usual is the average and spread of those days, and a reading counts as away from usual when it is two spreads or more from it. The week's direction is a straight line through the last seven days; carried forward, it gives the next days, with a band that widens with the scatter. These are app rules for a first look, not a diagnosis: the flight surgeon decides.</p>
      <p>${quote(DEVICE_FACTS.groundDownload)}</p>
      <p>${quote(DEVICE_FACTS.nonDominant)}</p>
      <p>${quote(DEVICE_FACTS.restricted)} That is why the demo crew's nights are simulated.</p>
      ${researchHtml(["Sleep_ISS12", "Comm_Delay"])}
      <p class="fine">On the ISS today the watch is read every 32 days. Ergosphere proposes a daily download so the morning question can be asked the same day: that is our proposal, not NASA's schedule. The 60-minute emergency opening is an app rule.</p>`)}
  </section>`;
  host.onclick = (e) => {
    const b = e.target.closest("[data-open]");
    if (!b) return;
    setActive(b.dataset.open);
    location.hash = "#analysis";
  };
}
