// Module 5 — Future body. Where the body is heading on a long mission: bone mineral density
// with NASA's average loss without countermeasures, against NASA's 95 % requirement, on a
// chart that draws itself and a skeleton that fades as the months go by. The crew member's
// own countermeasures (exercise, vitamin D) are shown as habits beside it.
// Rules: future-core.js. Words and sources: data/future.js, docs/SOURCES.md.

import * as F from "./future-core.js";
import { FUTURE_FACTS, MISSIONS } from "./data/future.js";
import { STATUS } from "./data/body-systems.js";
import { figureSvg } from "./anatomy.js";
import { dateKey } from "./log-core.js";
import { readLog } from "./store.js";
import { MEDS_KEY } from "./meds-core.js";

const link = (f) => `<a href="${f.url}" target="_blank" rel="noopener">${f.source}</a>`;
const src = (f) => `<small class="src">“${f.quote}” ${link(f)}</small>`;
const fmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

function chartSvg() {
  const { W, H, left, right, top, bottom } = F.CHART;
  const ticksY = [100, 95, 90, 80, 70, 60, 50, 40];
  const ticksX = [0, 6, 12, 18, 24, 30, 36];
  const lo = F.linePaths(F.RATE.low);
  const hi = F.linePaths(F.RATE.high);
  return `<svg class="fb-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bone mineral density over 36 months without countermeasures: from 100 % down to between ${F.remaining(36, 1)} % and ${F.remaining(36, 1.5)} %. NASA requires at least 95 % for hip and spine.">
    <defs><linearGradient id="fb-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="fb-band-a"/><stop offset="1" class="fb-band-b"/></linearGradient></defs>
    ${ticksY.map((v) => `<line class="fb-grid" x1="${left}" x2="${W - right}" y1="${F.y(v)}" y2="${F.y(v)}"/><text class="fb-tick" x="${left - 8}" y="${F.y(v) + 4}" text-anchor="end">${v}%</text>`).join("")}
    ${ticksX.map((m) => `<text class="fb-tick" x="${F.x(m)}" y="${H - bottom + 20}" text-anchor="middle">${m}</text>`).join("")}
    <text class="fb-tick" x="${W - right}" y="${H - 4}" text-anchor="end">months in space</text>
    <rect class="fb-extra" x="${F.x(F.MEASURED_MONTHS)}" y="${top}" width="${F.x(36) - F.x(F.MEASURED_MONTHS)}" height="${H - top - bottom}"/>
    <text class="fb-extra-t" x="${F.x(21)}" y="${F.y(42)}" text-anchor="middle">App's extrapolation beyond what NASA measured</text>
    <path d="${F.bandPath()}" fill="url(#fb-band)"/>
    <path class="fb-line" d="${lo.measured}" pathLength="1"/><path class="fb-line fb-dash" d="${lo.extrapolated}"/>
    <path class="fb-line" d="${hi.measured}" pathLength="1"/><path class="fb-line fb-dash" d="${hi.extrapolated}"/>
    <line class="fb-req" x1="${left}" x2="${W - right}" y1="${F.y(F.REQUIREMENT)}" y2="${F.y(F.REQUIREMENT)}"/>
    <text class="fb-req-t" x="${F.x(12)}" y="${F.y(F.REQUIREMENT) - 7}">NASA requirement: hip and spine ≥ 95 %</text>
    <line class="fb-cm" x1="${F.x(6)}" x2="${F.x(6)}" y1="${F.y(100)}" y2="${F.y(F.WITH_CM_6M)}"/>
    <circle class="fb-cm-dot" cx="${F.x(6)}" cy="${F.y(F.WITH_CM_6M)}" r="5"/>
    <text class="fb-cm-t" x="${F.x(6) + 10}" y="${F.y(F.WITH_CM_6M) + 18}">With countermeasures, most crews:</text><text class="fb-cm-t" x="${F.x(6) + 10}" y="${F.y(F.WITH_CM_6M) + 33}">&lt; 5 % loss at 6 months</text>
    <g data-ref="cursor"><line class="fb-cursor" y1="${top}" y2="${H - bottom}"/><circle class="fb-c-dot" r="5"/><circle class="fb-c-dot" r="5"/></g>
  </svg>`;
}

export function mountFuture(host) {
  const today = dateKey();
  let supplements = {};
  try { supplements = JSON.parse(localStorage.getItem(MEDS_KEY))?.supplements ?? {}; } catch { /* no supplements yet */ }
  const h = F.habits(readLog(), supplements, today, 14);
  let months = 6;

  host.innerHTML = `
  <section class="future" aria-labelledby="fb-title">
    <p class="eyebrow">Module 5 · Future body</p>
    <h1 id="fb-title" tabindex="-1">Where your bones are heading</h1>
    <p class="lede">Bone loss is silent: nothing hurts while it happens. Move through the mission and see what NASA's numbers mean without countermeasures, and why the daily exercise matters.</p>

    <div class="fb-missions" role="group" aria-label="Mission">${MISSIONS.map((m) => `<button type="button" class="tm-scn" data-months="${m.months}" aria-pressed="${m.months === months}">${m.label} · ${m.months} months</button>`).join("")}</div>

    <div class="fb-main">
      <div class="fb-body">
        <div class="fb-fig" data-ref="fig" aria-hidden="true">${figureSvg()}</div>
        <p class="fine">Illustration: the skeleton fades with the projected loss.</p>
      </div>
      <div class="fb-side">
        <div class="fb-read" data-ref="read" aria-live="polite"></div>
        <label class="fb-slider"><span>Months in space: <strong data-ref="m">${months}</strong></span>
          <input type="range" min="0" max="${F.MAX_MONTHS}" step="1" value="${months}" data-ref="range" aria-label="Months in space">
        </label>
        <p class="fine" data-ref="note"></p>
      </div>
    </div>

    <section class="data-card fb-chart-card" aria-labelledby="fb-c-h">
      <h2 id="fb-c-h">Bone mineral density, % of pre-mission</h2>
      ${chartSvg()}
      <p class="fine"><span class="fb-key fb-key-band"></span> Without countermeasures (NASA's average, 1–1.5 % a month) <span class="fb-key fb-key-req"></span> NASA requirement <span class="fb-key fb-key-cm"></span> With countermeasures, 6-month ISS missions</p>
      ${src(FUTURE_FACTS.loss)}${src(FUTURE_FACTS.requirement)}${src(FUTURE_FACTS.withCountermeasures)}
    </section>

    <section class="data-card" aria-labelledby="fb-h-h">
      <h2 id="fb-h-h">Your countermeasures, last ${h.days} days</h2>
      <div class="fb-habits">
        <div class="fb-habit"><span class="fb-ring" style="--p:${Math.round((h.exercise / h.days) * 100)}"><strong>${h.exercise}</strong></span><p><strong>Days with NASA's 1.5 hours of exercise</strong>${h.exerciseLogged ? ` · exercise logged on ${h.exerciseLogged} days` : " · no exercise logged yet"}</p></div>
        <div class="fb-habit"><span class="fb-ring" style="--p:${Math.round((h.vitaminD / h.days) * 100)}"><strong>${h.vitaminD}</strong></span><p><strong>Days with vitamin D taken</strong> · from the medication log</p></div>
      </div>
      <p class="fine">Shown as habits only. NASA publishes no formula that turns minutes of exercise into a bone number, so Ergosphere does not invent one.</p>
      ${src(FUTURE_FACTS.exercise)}${src(FUTURE_FACTS.vitaminD)}
      <p class="fb-links"><a class="tm-go" href="#log">Log today's exercise →</a> <a class="tm-go" href="#meds">Vitamin D in the medication log →</a></p>
    </section>

    <section class="data-card" aria-labelledby="fb-o-h">
      <h2 id="fb-o-h">Also on NASA's list</h2>
      <ul class="fb-facts">
        <li><strong>Strength and fitness.</strong>${src(FUTURE_FACTS.fitness)}</li>
        <li><strong>Medication with exercise.</strong> For the flight surgeon to decide, not the app.${src(FUTURE_FACTS.drugs)}</li>
        <li><strong>Back on Earth.</strong>${src(FUTURE_FACTS.recovery)}</li>
        <li><strong>On Mars.</strong> Partial gravity is not modelled here.${src(FUTURE_FACTS.marsGravity)}</li>
      </ul>
    </section>

    <p class="fine rule-note">NASA measured 1–1.5 % a month on 4-to-6-month missions. Beyond 6 months the straight line is the app's extrapolation, not a NASA prediction, and real loss differs by person and by bone. This is an illustration for planning, not a medical assessment. Sources: docs/SOURCES.md.</p>
  </section>`;

  const root = host.querySelector(".future");
  const $ = (r) => root.querySelector(`[data-ref="${r}"]`);
  const dots = $("cursor").querySelectorAll(".fb-c-dot");

  function paint() {
    const b = F.band(months);
    const vs = F.versusRequirement(months);
    const st = vs === "above" ? STATUS.normal : vs === "crossing" ? STATUS.watch : STATUS.act;
    $("m").textContent = months;
    $("read").innerHTML = `
      <p class="mono">AFTER ${months} ${months === 1 ? "MONTH" : "MONTHS"}, WITHOUT COUNTERMEASURES</p>
      <p class="fb-big"><strong>${fmt(b.worst)}–${fmt(b.best)} %</strong> <span>of pre-mission bone density</span></p>
      <p class="tone-${st.tone}">${st.shape} ${vs === "above" ? "Above NASA's 95 % requirement." : vs === "crossing" ? "Crossing NASA's 95 % requirement." : `Below NASA's 95 % requirement since month ${F.monthsToRequirement(F.RATE.high)}–${F.monthsToRequirement(F.RATE.low)}.`}</p>
      ${b.extrapolated ? `<p class="fine">Beyond 6 months: app's extrapolation of NASA's average.</p>` : ""}`;
    const cx = F.x(months);
    $("cursor").querySelector(".fb-cursor").setAttribute("x1", cx);
    $("cursor").querySelector(".fb-cursor").setAttribute("x2", cx);
    dots[0].setAttribute("cx", cx); dots[0].setAttribute("cy", F.y(b.best));
    dots[1].setAttribute("cx", cx); dots[1].setAttribute("cy", F.y(b.worst));
    // the skeleton fades from full to faint as the worst case drops from 100 % to 46 %
    const fade = 0.2 + 0.8 * ((b.worst - F.remaining(F.MAX_MONTHS, F.RATE.high)) / (100 - F.remaining(F.MAX_MONTHS, F.RATE.high)));
    $("fig").style.setProperty("--bone", fade.toFixed(2));
    root.querySelectorAll("[data-months]").forEach((x) => x.setAttribute("aria-pressed", String(Number(x.dataset.months) === months)));
    const mission = MISSIONS.find((m) => m.months === months);
    $("note").textContent = mission ? mission.note : "";
  }

  $("range").addEventListener("input", (e) => { months = Number(e.target.value); paint(); });
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-months]");
    if (!b) return;
    const target = Number(b.dataset.months);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { months = target; $("range").value = months; paint(); return; }
    const from = months;
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 900);
      months = Math.round(from + (target - from) * (1 - (1 - t) ** 3));
      $("range").value = months;
      paint();
      if (t < 1 && root.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  $("fig").querySelector(".figure .region.bones")?.classList.add("lit");
  paint();
  requestAnimationFrame(() => root.classList.add("ready"));
}
