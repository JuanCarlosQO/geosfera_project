// Main dashboard — the Cupola, plus the full picture under it: day stepper, mission strip,
// NASA's five hazards, what to do now, radiation and every reading with a trend and a reason.

import { watchLine } from "./devices.js";
import { confirmHere } from "./ask.js";
import {
  WINDOWS, summarise, headline, missionDay, cupolaGeometry,
  actionsFor, radiationTotals, series, sparkPath, reasonFor, EXERCISE_GOAL_MIN
} from "./today-core.js";
import { STATUS, SYSTEMS } from "./data/body-systems.js";
import { HAZARDS, HAZARDS_SOURCE } from "./data/hazards.js";
import { FIELDS, LOG_KEY, judgeReading, dateKey } from "./log-core.js";
import { currentStreak } from "./mission-core.js";
import * as S from "./store.js";
import { crewStatusHtml, crewFormHtml, manageHtml, bindCrewForm } from "./crew.js";
import { RADIATION_LIMITS, REVIEW_NOTE } from "./data/vital-ranges.js";
import { clinicHero } from "./clinic.js";
import { MEDS_KEY, cleanStore, medList, reminders } from "./meds-core.js";
import { SUPPLEMENTS } from "./data/supplements.js";
import { familyWaiting } from "./family.js";
import { KIT } from "./data/med-kit.js";
import { demoLoaded, loadDemo, removeDemo, demoNoticeHtml, demoOfferHtml } from "./demo.js";
import { fold, tabsHtml } from "./fold.js";
import { tile } from "./icons.js";
import { mindSignals, overall } from "./mind-core.js";
import { getAlerts } from "./support.js";
import { FAMILY_KEY, cleanBox } from "./family-core.js";

const MISSION_KEY = "geosfera.mission";
const UNITS = { heartRate: "bpm", bloodOxygen: "%", glucose: "mg/dL", radiationDose: "mSv", temperature: "°C", sleepHours: "h sleep", mood: "/5" };

const readJson = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };

function missionStart() {
  const saved = readJson(MISSION_KEY, null);
  if (saved?.start) return saved.start;
  const start = dateKey();
  try { localStorage.setItem(MISSION_KEY, JSON.stringify({ start })); } catch { /* storage blocked */ }
  return start;
}

const shift = (day, n) => { const [y, m, d] = day.split("-").map(Number); return dateKey(new Date(y, m - 1, d + n)); };
const nice = (day) => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); };
const fmt = (key, v) => (Array.isArray(v) ? `${v[0]}/${v[1]}` : String(v));
const poly = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const chip = (key) => { const s = STATUS[key]; return `<span class="chip tone-${s.tone}"><span aria-hidden="true">${s.shape}</span> ${s.word}</span>`; };

const HAZARD_ICONS = {
  radiation: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10 9 4.8A8 8 0 0 0 4.2 13H10M14 12h5.8A8 8 0 0 0 15 4.8L12 10M13 13.7 16 19a8 8 0 0 1-8 0l3-5.3"/>',
  isolation: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="12" r="2.5"/>',
  distance: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="7" r="2"/><path d="M8.5 15 16 8.5" stroke-dasharray="2 2"/>',
  gravity: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  closed: '<path d="M4 11a8 8 0 0 1 16 0v7H4z"/><path d="M8 18v-4h8v4"/>'
};

// The Cupola: six glass windows around the day's summary. Each window IS the button: it lifts
// toward you on hover or focus, presses in on a tap and opens that system in the body view.
// The windows fly in from the centre when the screen opens; a window with "Act now" breathes.
function cupola(summary, readings) {
  const geo = cupolaGeometry();
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const panes = geo.map((g, i) => {
    const win = WINDOWS.find((w) => w.id === g.id);
    const stKey = summary.status[g.id];
    const st = STATUS[stKey];
    const key = win.readings.find((k) => readings?.[k] != null);
    const value = key ? fmt(key, readings[key].value) : "—";
    const unit = key === "sleepHours" ? "h" : key && key !== "bloodPressure" ? UNITS[key] ?? "" : ""; // short in the window: "5.3 h"
    const len = Math.hypot(g.centre[0] - 195, g.centre[1] - 180) || 1;
    const ux = (g.centre[0] - 195) / len, uy = (g.centre[1] - 180) / len;
    const dx = ux.toFixed(3), dy = uy.toFixed(3);
    // the four side windows narrow toward the hub: their words sit a little further out
    const push = Math.abs(uy) < 0.95 ? 9 : 0;
    const cx = g.centre[0] + ux * push, cy = g.centre[1] + uy * push * 0.4;
    return `<g class="pane-in" style="--i:${i};--dx:${dx};--dy:${dy}">
      <g class="pane-btn" data-body="${win.body}" data-status="${stKey}" role="button" tabindex="0" aria-label="${esc(`${win.label}: ${value}${unit ? ` ${unit}` : ""}, ${st.word}. Open in the body view`)}">
        <polygon points="${poly(g.points)}" class="pane"/>
        ${stKey === "watch" ? `<polygon points="${poly(g.points)}" class="pane-hatch" fill="url(#hatch)"/>` : ""}
        <polygon points="${poly(g.points)}" class="pane-edge"/>
        <text x="${cx.toFixed(1)}" y="${(cy - 20).toFixed(1)}" class="pl-name" text-anchor="middle">${win.label.toUpperCase()}</text>
        <text x="${cx.toFixed(1)}" y="${(cy + 8).toFixed(1)}" class="pl-value" text-anchor="middle">${value}${unit ? `<tspan class="pl-unit" dx="4">${unit}</tspan>` : ""}</text>
        <text x="${cx.toFixed(1)}" y="${(cy + 28).toFixed(1)}" class="pl-status tone-${st.tone}" text-anchor="middle"><tspan class="pl-shape">${st.shape}</tspan> ${st.word}</text>
      </g>
    </g>`;
  }).join("");
  // the hub's ring: one arc per window, lit for each window with a reading today
  const arcs = Array.from({ length: summary.total }, (_, i) => {
    const r = 64, gap = 7, a0 = -90 + (360 / summary.total) * i + gap / 2, a1 = a0 + 360 / summary.total - gap;
    const p = (a) => [195 + r * Math.cos((a * Math.PI) / 180), 180 + r * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" class="hub-arc${i < summary.measured ? " on" : ""}" style="--i:${i}"/>`;
  }).join("");
  return `<div class="cupola">
    <svg viewBox="0 0 390 360" role="group" aria-label="Cupola: six body-system windows around the day's summary">
      <defs>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1830"/><stop offset=".62" stop-color="#11305a"/><stop offset="1" stop-color="#1d5aa6"/></linearGradient>
        <radialGradient id="earth-c" cx=".5" cy="1.25" r="1"><stop offset=".45" stop-color="#2f7be0"/><stop offset=".6" stop-color="#0f3a78"/><stop offset=".8" stop-color="#071628"/></radialGradient>
        <radialGradient id="cupola-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#3b82f6" stop-opacity=".22"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></radialGradient>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#ff9f5a" stroke-width="1.4" opacity=".32"/></pattern>
      </defs>
      <circle cx="195" cy="180" r="190" fill="url(#cupola-glow)"/>
      <polygon points="102,19 288,19 381,180 288,341 102,341 9,180" class="frame"/>
      <g class="sweep" aria-hidden="true"><path d="M195 180 L195 2 A178 178 0 0 1 284 26 Z" class="sweep-beam"/></g>
      ${panes}
      <polygon points="161,121 229,121 263,180 229,239 161,239 127,180" class="hub"/>
      <circle cx="195" cy="180" r="56" fill="url(#earth-c)" class="hub-earth"/>
      <g class="hub-arcs">${arcs}</g>
      <g class="rivets"><circle cx="102" cy="19" r="2.5"/><circle cx="288" cy="19" r="2.5"/><circle cx="381" cy="180" r="2.5"/><circle cx="288" cy="341" r="2.5"/><circle cx="102" cy="341" r="2.5"/><circle cx="9" cy="180" r="2.5"/></g>
    </svg>
    <div class="hub-label" aria-hidden="true"><span class="hub-num"><span data-count="${summary.measured}">0</span><small>/${summary.total}</small></span><span class="hub-word">MEASURED</span></div>
  </div>`;
}

// One line on Today: last night from the watch, and a reminder when it has been off too long.
function devicesStrip(memberId) {
  const w = watchLine(memberId);
  if (!w) return `<a class="dv-strip" href="#devices"><span>⌁ Devices<small>No watch in use. Bluetooth sensors and live sensors fill your readings.</small></span><span class="dv-go">Open →</span></a>`;
  const t = (x) => new Date(x).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const night = w.night ? `${w.night.sleepHours} h asleep · ${t(w.night.asleep)} to ${t(w.night.wake)} · ${w.night.awakenings} ${w.night.awakenings === 1 ? "awakening" : "awakenings"}` : "No night recorded yet";
  const off = w.off?.eva ? ` · spacewalk: watch off since ${t(w.off.since)}` : w.off ? ` · watch off for ${w.off.minutes} min${w.off.remind ? ": put it back on" : ""}` : "";
  return `<a class="dv-strip${w.off?.remind ? " remind" : ""}" href="#devices"><span>⌚ Actiwatch-Plus${w.mode === "sim" ? " (simulated)" : ""}<small>${night}${off}</small></span><span class="dv-go">Devices →</span></a>`;
}

function readingRows(log, day, entry) {
  return FIELDS.map((f, i) => {
    const r = entry?.[f.key];
    const st = r?.value == null ? "none" : judgeReading(f.key, r);
    const d = sparkPath(series(log, f.key, day, 14));
    return `<li class="rd" style="--i:${i}">
      <div class="rd-name"><span class="rd-label">${tile(f.key)}${f.label}</span><small class="rd-why">${reasonFor(f.key, r)}</small></div>
      <svg class="spark" viewBox="0 0 120 32" aria-hidden="true">${d ? `<path d="${d}" pathLength="1"/>` : `<line x1="0" y1="16" x2="120" y2="16" class="flat"/>`}</svg>
      <div class="rd-val"><strong>${r?.value != null ? fmt(f.key, r.value) : "—"}</strong><span>${f.unit}</span></div>
      <div class="rd-st">${chip(st)}</div>
    </li>`;
  }).join("");
}

export function mountToday(host, { go }, requested) {
  const crew = S.getCrew();
  if (!crew.members.length) {
    host.innerHTML = `<section class="today crew-onboard">${crewFormHtml(true)}${demoOfferHtml()}</section>`;
    bindCrewForm(host, () => mountToday(host, { go }, requested));
    host.querySelector('[data-action="load-demo"]').addEventListener("click", () => { loadDemo(); mountToday(host, { go }, requested); });
    host.querySelector("input[name=name]")?.focus();
    return;
  }
  const member = S.current();
  const first = member.name.split(" ")[0];
  const today = dateKey();
  const day = requested && requested <= today ? requested : today;
  const log = S.readLog(member.id);
  const entry = log[day] ?? {};
  const summary = summarise(entry, judgeReading);
  const head = headline(summary);
  const start = missionStart();
  const [yy, mm, dd] = day.split("-").map(Number);
  const mday = missionDay(start, new Date(yy, mm - 1, dd));
  const streak = currentStreak(log, today);
  const ex = entry.exerciseMinutes?.value ?? 0;
  const exFrac = Math.min(1, ex / EXERCISE_GOAL_MIN);
  const actions = actionsFor(entry);
  const rad = radiationTotals(log, day);
  const isToday = day === today;
  // Day theme: the clinical overview around the Cupola. Night theme: the Cupola with the check-in strip.
  const day_theme = document.documentElement.dataset.theme !== "night";
  const medStore = cleanStore(readJson(MEDS_KEY, null), KIT, SUPPLEMENTS);
  const rem = reminders(medStore, medList(KIT, medStore), SUPPLEMENTS);

  const heroProps = { log, day, entry, summary, mday, streak, exercise: ex, actions, isToday, reminders: rem, family: familyWaiting(member.id), who: member, stage: cupola(summary, entry) };
  const mind = overall(mindSignals({ log, today, me: member, doses: medStore.doses, kit: KIT, alerts: getAlerts(), box: cleanBox(readJson(FAMILY_KEY, {})) }));
  const mindSt = STATUS[mind.status] ?? STATUS.none;

  const overviewTab = `${day_theme ? clinicHero({ ...heroProps, part: "overview" }) : `<div class="hero">
      ${cupola(summary, entry)}
      <div class="hero-side">
        <a class="cta-wide" href="${isToday ? "#log" : `#log/${day}`}">${isToday ? (summary.measured ? "Review today's readings" : "Start today's readings") : "Correct this day"}</a>
        <a class="strip" href="#mission" aria-label="Mission progress">
          <span class="mini-ring" style="--p:${(exFrac * 100).toFixed(0)}"><span>${ex}</span></span>
          <span class="strip-text"><strong>${ex} of ${EXERCISE_GOAL_MIN} min</strong><small>Exercise · NASA's 1.5 hours</small></span>
          <span class="strip-text"><strong>${streak} ${streak === 1 ? "day" : "days"}</strong><small>Check-in streak</small></span>
        </a>
      </div>
    </div>`}
    ${isToday ? devicesStrip(member.id) : ""}
    ${isToday ? `<a class="fb-link today-mind" href="#mind"><span><span class="tone-${mindSt.tone}" aria-hidden="true">${mindSt.shape}</span> Mind map<small>${mind.title}</small></span><span>Open →</span></a>` : ""}`;

  const readingsTab = `${day_theme ? clinicHero({ ...heroProps, part: "charts" }) : ""}
    <section aria-labelledby="rd-h">
      <div class="rd-head"><h2 id="rd-h">Readings</h2><span class="mono">last 14 days</span></div>
      <ul class="readings" data-ref="readings">${readingRows(log, day, entry)}</ul>
      <button type="button" class="textlink rd-toggle" data-action="ranges" aria-expanded="false">Show ranges and sources</button>
      <p class="fine rd-note" hidden>Ranges: ${REVIEW_NOTE}</p>
    </section>`;

  const hazardsTab = `<section class="hazards" aria-labelledby="hz-h">
      <h2 id="hz-h">The five hazards</h2>
      <div class="hz-row" role="group" aria-label="NASA's five hazards of human spaceflight">
        ${HAZARDS.map((h) => `<button type="button" class="hz" data-hazard="${h.id}" aria-expanded="false">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HAZARD_ICONS[h.id]}</svg>
          <span>${h.name}</span></button>`).join("")}
      </div>
      <div class="hz-detail" data-ref="hz" aria-live="polite"><p class="fine">Tap a hazard to read NASA's description.</p></div>
    </section>

    <div class="panels">
      <section class="panel" aria-labelledby="todo-h">
        <h2 id="todo-h">What to do now</h2>
        ${actions.length ? `<ol class="todo">${actions.map((a) => `<li class="tone-${a.tone}"><strong>${a.tone === "again" ? "◌ " : ""}${a.title}</strong><span>${a.text}</span></li>`).join("")}</ol>`
          : `<p class="calm">● Nothing to do. Keep your routine: exercise, meals and sleep on schedule.</p>`}
        <p class="fine">Measuring steps only, not medical advice.</p>
      </section>
      <section class="panel" aria-labelledby="rad-h">
        <h2 id="rad-h">Radiation</h2>
        <div class="rad-nums">
          <div><strong>${rad.today ?? "—"}</strong><small>mSv this day</small></div>
          <div><strong data-count-dec="${rad.total}">0</strong><small>mSv logged in total · ${rad.days} ${rad.days === 1 ? "day" : "days"}</small></div>
        </div>
        <div class="limit">
          <div class="limit-bar"><span style="width:${Math.min(100, (rad.total / RADIATION_LIMITS.careerMSv) * 100).toFixed(2)}%"></span></div>
          <p class="fine">${rad.total} of ${RADIATION_LIMITS.careerMSv} mSv career limit (${((rad.total / RADIATION_LIMITS.careerMSv) * 100).toFixed(1)} %)</p>
        </div>
        <a class="tm-go rad-dna" href="#live/rad">Radiation and your DNA →</a>
        ${fold("About these numbers", `<ul class="rad-facts">
          <li>Missions to the space station are “entirely within the magnetosphere”; Moon and Mars missions “will extend beyond this protective bubble”. <a href="https://www.nasa.gov/reference/risk-of-radiation-induced-cancers/" target="_blank" rel="noopener">NASA</a></li>
          <li>“Neutron radiation, which contributes to about 30% of total radiation on the ISS”. <a href="https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp" target="_blank" rel="noopener">Canadian Space Agency</a></li>
        </ul>
        <p class="fine">Career limit: ${RADIATION_LIMITS.source}. Doses from earlier missions are not included.</p>`)}
      </section>
    </div>`;

  host.innerHTML = `
  <section class="today" aria-labelledby="today-title">
    <div class="today-head">
      <div>
        <p class="eyebrow">${isToday ? "Today" : "Looking back"} · Mission day ${mday}</p>
        <h1 id="today-title" tabindex="-1">${isToday ? head.title.replace("Commander", first) : `${member.name} · ${nice(day)}.`}</h1>
        <p class="today-line">${isToday ? head.line : `${summary.measured} of ${summary.total} windows measured on this day.`}</p>
      </div>
      <div class="stepper" role="group" aria-label="Change day">
        <button type="button" class="round-btn" data-day="${shift(day, -1)}" aria-label="Previous day"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
        <span class="mono">${isToday ? "Today" : nice(day)}</span>
        <button type="button" class="round-btn" data-day="${shift(day, 1)}" aria-label="Next day" ${isToday ? "disabled" : ""}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
      </div>
    </div>

    ${demoLoaded() ? demoNoticeHtml() : ""}
    ${crewStatusHtml(crew)}

    ${tabsHtml("today", [
      { id: "overview", label: "Overview", html: overviewTab },
      { id: "readings", label: "Readings", html: readingsTab, badge: `${summary.measured}/${summary.total}` },
      { id: "hazards", label: "Hazards", html: hazardsTab }
    ])}
  </section>`;

  const rerender = () => mountToday(host, { go }, requested);
  host.querySelector('[data-action="remove-demo"]')?.addEventListener("click", async (e) => {
    if (await confirmHere(e.currentTarget, "Remove the demo crew and its simulated data?")) { removeDemo(); mountToday(host, { go }, undefined); }
  });
  host.querySelector(".crew-status").addEventListener("click", (e) => {
    const card = e.target.closest("[data-member]");
    if (card) { S.setActive(card.dataset.member); rerender(); return; }
    if (e.target.closest('[data-action="manage-crew"]')) {
      host.insertAdjacentHTML("beforeend", manageHtml(S.getCrew()));
      const veil = host.querySelector('[data-ref="crew-veil"]');
      veil.querySelector("input[name=name]")?.focus();
      bindCrewForm(veil, rerender);
      veil.addEventListener("click", async (ev) => {
        if (ev.target.closest('[data-action="close-crew"]') || ev.target === veil) { rerender(); return; }
        const rm = ev.target.closest("[data-remove]");
        if (rm) {
          const m = S.getCrew().members.find((x) => x.id === rm.dataset.remove);
          if (m && await confirmHere(rm, `Remove ${m.name}? Their log on this device is erased.`)) { S.deleteMember(m.id); rerender(); }
        }
      });
    }
  });
  const openPane = (b) => {
    if (!b) return;
    if (!b.classList.contains("pane-btn") || matchMedia("(prefers-reduced-motion: reduce)").matches) { go(`body/${b.dataset.body}`); return; }
    b.classList.add("pressed"); // a short press-in before the body view opens
    setTimeout(() => go(`body/${b.dataset.body}`), 180);
  };
  host.querySelectorAll(".cupola, .cl-callouts").forEach((box) => {
    box.addEventListener("click", (e) => openPane(e.target.closest(".pane-btn, .pane-label, .cl-callout")));
    box.addEventListener("keydown", (e) => {
      const b = e.target.closest(".pane-btn");
      if (b && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openPane(b); }
    });
  });
  host.querySelector(".stepper").addEventListener("click", (e) => {
    const b = e.target.closest("[data-day]");
    if (b && !b.disabled) go(b.dataset.day === today ? "today" : `today/${b.dataset.day}`);
  });
  host.querySelector('[data-action="ranges"]').addEventListener("click", (e) => {
    const on = e.currentTarget.getAttribute("aria-expanded") !== "true";
    e.currentTarget.setAttribute("aria-expanded", String(on));
    e.currentTarget.textContent = on ? "Hide ranges and sources" : "Show ranges and sources";
    host.querySelector('[data-ref="readings"]').classList.toggle("show-why", on);
    host.querySelector(".rd-note").hidden = !on;
  });
  const hzBox = host.querySelector('[data-ref="hz"]');
  host.querySelector(".hz-row").addEventListener("click", (e) => {
    const b = e.target.closest(".hz");
    if (!b) return;
    const open = b.getAttribute("aria-expanded") !== "true";
    host.querySelectorAll(".hz").forEach((x) => x.setAttribute("aria-expanded", "false"));
    if (!open) { hzBox.innerHTML = `<p class="fine">Tap a hazard to read NASA's description.</p>`; return; }
    b.setAttribute("aria-expanded", "true");
    const h = HAZARDS.find((x) => x.id === b.dataset.hazard);
    const sys = h.systems.map((id) => SYSTEMS.find((s) => s.id === id)).filter(Boolean);
    hzBox.innerHTML = `<blockquote>“${h.text}”</blockquote>
      <p class="fine">${h.name} · <a href="${HAZARDS_SOURCE.url}" target="_blank" rel="noopener">${HAZARDS_SOURCE.label}</a></p>
      ${sys.length ? `<div class="hz-sys">${sys.map((s) => `<a class="cta" href="#body/${s.id}">${s.name}</a>`).join("")}</div>` : ""}`;
  });

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = (el, target, dec) => {
    if (reduce || !target) { el.textContent = dec ? target.toFixed(2) : String(target); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 900);
      const v = target * (1 - (1 - t) ** 3);
      el.textContent = dec ? v.toFixed(2) : String(Math.round(v));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  host.querySelectorAll("[data-count]").forEach((el) => animate(el, Number(el.dataset.count), false));
  host.querySelectorAll("[data-count-dec]").forEach((el) => animate(el, Number(el.dataset.countDec), true));
  requestAnimationFrame(() => host.querySelector(".today")?.classList.add("ready"));
}
