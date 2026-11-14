// Main dashboard — the Cupola, plus the full picture under it: day stepper, mission strip,
// NASA's five hazards, what to do now, radiation and every reading with a trend and a reason.

import {
  WINDOWS, summarise, headline, missionDay, cupolaGeometry,
  actionsFor, radiationTotals, series, sparkPath, reasonFor, EXERCISE_GOAL_MIN
} from "./today-core.js";
import { STATUS, SYSTEMS } from "./data/body-systems.js";
import { HAZARDS, HAZARDS_SOURCE } from "./data/hazards.js";
import { FIELDS, LOG_KEY, judgeReading, dateKey } from "./log-core.js";
import { currentStreak } from "./mission-core.js";

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

function cupola(summary, readings) {
  const geo = cupolaGeometry();
  const glass = geo.map((g) => {
    const st = summary.status[g.id];
    const ring = { watch: "var(--tone-watch)", act: "var(--tone-act)", again: "var(--tone-again)" }[st] ?? "#4b5664";
    return `<polygon points="${poly(g.points)}" class="pane" style="stroke:${ring}"/>${st === "watch" ? `<polygon points="${poly(g.points)}" fill="url(#hatch)"/>` : ""}`;
  }).join("");
  const labels = geo.map((g) => {
    const win = WINDOWS.find((w) => w.id === g.id);
    const st = STATUS[summary.status[g.id]];
    const key = win.readings.find((k) => readings[k] != null);
    const value = key ? fmt(key, readings[key].value) : "—";
    const unit = key && key !== "bloodPressure" ? UNITS[key] ?? "" : "";
    return `<button type="button" class="pane-label" data-body="${win.body}" style="left:${(g.centre[0] / 390) * 100}%;top:${(g.centre[1] / 360) * 100}%" aria-label="${win.label}: ${st.word}. Open in the body hologram">
      <span class="pl-name">${win.label.toUpperCase()}</span>
      <span class="pl-value">${value}${unit ? `<small> ${unit}</small>` : ""}</span>
      <span class="pl-status tone-${st.tone}"><span aria-hidden="true">${st.shape}</span> ${st.word}</span>
    </button>`;
  }).join("");
  return `<div class="cupola">
    <svg viewBox="0 0 390 360" role="img" aria-label="Cupola: six body-system windows around the day's summary">
      <defs>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1626"/><stop offset=".7" stop-color="#0f2a4d"/><stop offset="1" stop-color="#1b4f8f"/></linearGradient>
        <radialGradient id="earth-c" cx=".5" cy="1.25" r="1"><stop offset=".45" stop-color="#2f7be0"/><stop offset=".6" stop-color="#0f3a78"/><stop offset=".8" stop-color="#071628"/></radialGradient>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#ff9f5a" stroke-width="1.4" opacity=".35"/></pattern>
      </defs>
      <polygon points="102,19 288,19 381,180 288,341 102,341 9,180" class="frame"/>
      ${glass}
      <polygon points="161,121 229,121 263,180 229,239 161,239 127,180" class="hub"/>
      <circle cx="195" cy="180" r="56" fill="url(#earth-c)" stroke="var(--beacon)" stroke-width="1.5"/>
      <circle cx="195" cy="180" r="62" class="hub-ring"/>
      <g class="rivets"><circle cx="102" cy="19" r="2.5"/><circle cx="288" cy="19" r="2.5"/><circle cx="381" cy="180" r="2.5"/><circle cx="288" cy="341" r="2.5"/><circle cx="102" cy="341" r="2.5"/><circle cx="9" cy="180" r="2.5"/></g>
    </svg>
    ${labels}
    <div class="hub-label" aria-hidden="true"><span class="hub-num"><span data-count="${summary.measured}">0</span><small>/${summary.total}</small></span><span class="hub-word">MEASURED</span></div>
  </div>`;
}

function readingRows(log, day, entry) {
  return FIELDS.map((f, i) => {
    const r = entry?.[f.key];
    const st = r?.value == null ? "none" : judgeReading(f.key, r);
    const d = sparkPath(series(log, f.key, day, 14));
    return `<li class="rd" style="--i:${i}">
      <div class="rd-name">${f.label}<small>${reasonFor(f.key, r)}</small></div>
      <svg class="spark" viewBox="0 0 120 32" aria-hidden="true">${d ? `<path d="${d}" pathLength="1"/>` : `<line x1="0" y1="16" x2="120" y2="16" class="flat"/>`}</svg>
      <div class="rd-val"><strong>${r?.value != null ? fmt(f.key, r.value) : "—"}</strong><span>${f.unit}</span></div>
      <div class="rd-st">${chip(st)}</div>
    </li>`;
  }).join("");
}

export function mountToday(host, { go }, requested) {
  const today = dateKey();
  const day = requested && requested <= today ? requested : today;
  const log = readJson(LOG_KEY, {});
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

  host.innerHTML = `
  <section class="today" aria-labelledby="today-title">
    <div class="today-head">
      <div>
        <p class="eyebrow">${isToday ? "Today" : "Looking back"} · Mission day ${mday}</p>
        <h1 id="today-title" tabindex="-1">${isToday ? head.title : `${nice(day)}.`}</h1>
        <p class="today-line">${isToday ? head.line : `${summary.measured} of ${summary.total} windows measured on this day.`}</p>
      </div>
      <div class="stepper" role="group" aria-label="Change day">
        <button type="button" class="round-btn" data-day="${shift(day, -1)}" aria-label="Previous day"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
        <span class="mono">${isToday ? "Today" : nice(day)}</span>
        <button type="button" class="round-btn" data-day="${shift(day, 1)}" aria-label="Next day" ${isToday ? "disabled" : ""}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
      </div>
    </div>

    <div class="hero">
      ${cupola(summary, entry)}
      <div class="hero-side">
        <a class="cta-wide" href="${isToday ? "#log" : `#log/${day}`}">${isToday ? (summary.measured ? "Continue today's check-in" : "Start today's check-in") : "Correct this day"}</a>
        <a class="strip" href="#mission" aria-label="Mission progress">
          <span class="mini-ring" style="--p:${(exFrac * 100).toFixed(0)}"><span>${ex}</span></span>
          <span class="strip-text"><strong>${ex} of ${EXERCISE_GOAL_MIN} min</strong><small>Exercise · NASA's 1.5 hours</small></span>
          <span class="strip-text"><strong>${streak} ${streak === 1 ? "day" : "days"}</strong><small>Check-in streak</small></span>
        </a>
      </div>
    </div>

    <section class="hazards" aria-labelledby="hz-h">
      <h2 id="hz-h">The five hazards</h2>
      <div class="hz-row" role="group" aria-label="NASA's five hazards of human spaceflight">
        ${HAZARDS.map((h) => `<button type="button" class="hz" data-hazard="${h.id}" aria-expanded="false">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${HAZARD_ICONS[h.id]}</svg>
          <span>${h.name}</span></button>`).join("")}
      </div>
      <div class="hz-detail" data-ref="hz" aria-live="polite"><p class="fine">Tap a hazard to read NASA's description and see which body systems it touches.</p></div>
    </section>

    <div class="panels">
      <section class="panel" aria-labelledby="todo-h">
        <h2 id="todo-h">What to do now</h2>
        ${actions.length ? `<ol class="todo">${actions.map((a) => `<li class="tone-${a.tone}"><strong>${a.tone === "again" ? "◌ " : ""}${a.title}</strong><span>${a.text}</span></li>`).join("")}</ol>`
          : `<p class="calm">● Nothing to do. Keep your routine: exercise, meals and sleep on schedule.</p>`}
        <p class="fine">Measuring steps only. Geosfera does not give medical advice; follow your flight surgeon.</p>
      </section>
      <section class="panel" aria-labelledby="rad-h">
        <h2 id="rad-h">Radiation</h2>
        <div class="rad-nums">
          <div><strong>${rad.today ?? "—"}</strong><small>mSv this day</small></div>
          <div><strong data-count-dec="${rad.total}">0</strong><small>mSv logged in total · ${rad.days} ${rad.days === 1 ? "day" : "days"}</small></div>
        </div>
        <ul class="rad-facts">
          <li>Missions to the space station are “entirely within the magnetosphere”; Moon and Mars missions “will extend beyond this protective bubble”. <a href="https://www.nasa.gov/reference/risk-of-radiation-induced-cancers/" target="_blank" rel="noopener">NASA</a></li>
          <li>“Neutron radiation, which contributes to about 30% of total radiation on the ISS”. <a href="https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp" target="_blank" rel="noopener">Canadian Space Agency</a></li>
        </ul>
        <p class="fine">Dose limits: ${chip("pending")} until an official limit is added to the sources.</p>
      </section>
    </div>

    <section aria-labelledby="rd-h">
      <div class="rd-head"><h2 id="rd-h">Readings</h2><span class="mono">last 14 days</span></div>
      <ul class="readings">${readingRows(log, day, entry)}</ul>
    </section>
  </section>`;

  host.querySelector(".cupola").addEventListener("click", (e) => {
    const b = e.target.closest(".pane-label");
    if (b) go(`body/${b.dataset.body}`);
  });
  host.querySelector(".stepper").addEventListener("click", (e) => {
    const b = e.target.closest("[data-day]");
    if (b && !b.disabled) go(b.dataset.day === today ? "today" : `today/${b.dataset.day}`);
  });
  const hzBox = host.querySelector('[data-ref="hz"]');
  host.querySelector(".hz-row").addEventListener("click", (e) => {
    const b = e.target.closest(".hz");
    if (!b) return;
    const open = b.getAttribute("aria-expanded") !== "true";
    host.querySelectorAll(".hz").forEach((x) => x.setAttribute("aria-expanded", "false"));
    if (!open) { hzBox.innerHTML = `<p class="fine">Tap a hazard to read NASA's description and see which body systems it touches.</p>`; return; }
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
