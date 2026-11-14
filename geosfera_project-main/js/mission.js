// Module 4 — Mission: the daily exercise ring (NASA's 1.5 hours), the check-in streak,
// a self-drawing week of exercise and habit achievements.

import * as M from "./mission-core.js";
import { LOG_KEY, dateKey } from "./log-core.js";

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};

const BADGE_ICONS = {
  first: '<path d="M12 4v16M6 10l6-6 6 6"/>',
  full: '<path d="M5 12l4 4 10-10"/><rect x="3" y="3" width="18" height="18" rx="3"/>',
  streak3: '<circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/>',
  streak7: '<circle cx="12" cy="12" r="8"/><path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>',
  goal: '<path d="M6 9v6M18 9v6M3 11v2M21 11v2M6 12h12"/>',
  goalweek: '<path d="M4 18h16M6 18V9M10 18V6M14 18v-8M18 18V8"/>',
  dosimeter: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10 9 4.8A8 8 0 0 0 4.2 13H10M14 12h5.8A8 8 0 0 0 15 4.8L12 10M13 13.7 16 19a8 8 0 0 1-8 0l3-5.3"/>',
  second: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/>'
};

const weekday = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString("en-GB", { weekday: "short" });
};

export function mountMission(host) {
  const today = dateKey();
  const log = readJson(LOG_KEY, {});
  const start = readJson("geosfera.mission", {}).start;
  const entry = log[today];
  const mins = M.exerciseMinutes(entry);
  const frac = M.ringFraction(entry);
  const streak = M.currentStreak(log, today);
  const best = M.bestStreak(log);
  const wk = M.week(log, today);
  const goalDays = wk.filter((w) => w.goal).length;
  const adh = M.adherence(log, start, today);
  const badges = M.achievements(log, today);
  const unlocked = badges.filter((b) => b.unlocked).length;
  const maxMin = Math.max(M.EXERCISE.dailyMinutes * 1.5, ...wk.map((w) => w.minutes));

  host.innerHTML = `
  <section class="mission" aria-labelledby="mi-title">
    <p class="eyebrow">Module 4 · Mission</p>
    <h1 id="mi-title" tabindex="-1">Keep the countermeasures going</h1>
    <p class="lede">Badges reward checking in and doing the exercise NASA asks of every crew member, never what a reading says.</p>

    <div class="mi-top">
      <figure class="ring-card">
        <svg viewBox="0 0 180 180" role="img" aria-label="Exercise today: ${mins} of ${M.EXERCISE.dailyMinutes} minutes">
          <circle cx="90" cy="90" r="72" class="ring-track"/>
          <circle cx="90" cy="90" r="72" class="ring-fill" pathLength="100" style="--to:${(100 - frac * 100).toFixed(1)}"/>
        </svg>
        <div class="ring-text"><strong data-count="${mins}">0</strong><span>of ${M.EXERCISE.dailyMinutes} min</span></div>
        <figcaption>Exercise today${frac >= 1 ? ' · <span class="tone-normal">● goal reached</span>' : ""}</figcaption>
      </figure>

      <div class="streak-card">
        <p class="eyebrow">Check-in streak</p>
        <p class="streak-num"><strong data-count="${streak}">0</strong> <span>${streak === 1 ? "day" : "days"}</span></p>
        <ol class="dots" aria-label="Last 7 days">${wk.map((w) => `<li class="${w.logged ? "on" : ""}" title="${weekday(w.day)}: ${w.logged ? `${w.steps} steps` : "no check-in"}"><span class="sr-only">${weekday(w.day)}: ${w.logged ? "checked in" : "no check-in"}</span></li>`).join("")}</ol>
        <p class="fine">Best run: ${best} ${best === 1 ? "day" : "days"}${adh.days ? ` · ${adh.logged} of ${adh.days} mission days logged` : ""}</p>
      </div>
    </div>

    <section class="week-card" aria-labelledby="wk-h">
      <div class="wk-head"><h2 id="wk-h">Exercise this week</h2><span class="mono">${goalDays}/${M.EXERCISE.daysPerWeek} goal days</span></div>
      <div class="bars" role="img" aria-label="Exercise minutes for the last 7 days: ${wk.map((w) => `${weekday(w.day)} ${w.minutes}`).join(", ")}">
        <div class="goal-line" style="bottom:${(M.EXERCISE.dailyMinutes / maxMin) * 100}%"><span>${M.EXERCISE.dailyMinutes} min</span></div>
        ${wk.map((w, i) => `<div class="bar-col">
          <div class="bar ${w.goal ? "hit" : ""} ${w.logged ? "" : "empty"}" style="height:${(w.minutes / maxMin) * 100}%;--i:${i}"></div>
          <span class="bar-day ${w.day === today ? "today" : ""}">${weekday(w.day)}</span>
        </div>`).join("")}
      </div>
      <p class="fine source">NASA: “${M.EXERCISE.quote}” · <a href="${M.EXERCISE.url}" target="_blank" rel="noopener">${M.EXERCISE.source}<span class="sr-only"> (opens in a new tab)</span></a></p>
    </section>

    <section aria-labelledby="bd-h">
      <div class="wk-head"><h2 id="bd-h">Mission patches</h2><span class="mono">${unlocked}/${badges.length}</span></div>
      <ul class="badges">${badges.map((b) => `
        <li class="badge ${b.unlocked ? "won" : ""}">
          <span class="patch" aria-hidden="true">
            <svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="25" class="p-track"/><circle cx="28" cy="28" r="25" class="p-fill" pathLength="100" style="stroke-dashoffset:${100 - (b.progress / b.target) * 100}"/></svg>
            <svg class="p-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${BADGE_ICONS[b.id]}</svg>
          </span>
          <span class="b-text"><strong>${b.name}</strong><small>${b.how}</small>
            <span class="b-state">${b.unlocked ? "● Earned" : `${b.progress}/${b.target}`}</span></span>
        </li>`).join("")}
      </ul>
    </section>

    <a class="cta-wide" href="#log">${entry ? "Update today's check-in" : "Start today's check-in"}</a>
  </section>`;

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const el of host.querySelectorAll("[data-count]")) {
    const target = Number(el.dataset.count);
    if (reduce || !target) { el.textContent = String(target); continue; }
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 900);
      el.textContent = String(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(() => host.querySelector(".mission")?.classList.add("ready"));
}
