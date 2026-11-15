// Module 2 — Body hologram. A human figure on a ring of light, one control per body system
// around it, and a panel with NASA's own words about the risks for that system.

import { figureSvg, photoFigure, PHOTO_NOTE } from "./anatomy.js";
import { SYSTEMS, STATUS } from "./data/body-systems.js";
import { NASA_RISKS, RISKS_SOURCE } from "./data/nasa-risks.js";

// Stage coordinates: 360 × 470. The figure (200 × 450) sits at x 80, y 10.
const FIG_X = 80;
const FIG_Y = 10;
const STAGE_W = 360;
const STAGE_H = 470;

// Day look: a realistic body picture, 260 wide at x 50, y 40 of the stage. Each system's anchor
// on it is given in % of the picture. (The night look keeps the hologram and its own anchors.)
const PHOTO_BOX = { x: 50, y: 40, w: 260, h: 390 };
const ON_PHOTO = { brain: [50, 4.2], mind: [54, 7], heart: [54.5, 24], lungs: [44.5, 22.5], immune: [50, 34], musculo: [40.5, 66], radiation: [61, 31] };
const anchorOf = (s, photo) => (photo
  ? [PHOTO_BOX.x + (ON_PHOTO[s.id][0] / 100) * PHOTO_BOX.w, PHOTO_BOX.y + (ON_PHOTO[s.id][1] / 100) * PHOTO_BOX.h]
  : [FIG_X + s.anchor[0], FIG_Y + s.anchor[1]]);

const PLACES = {
  brain: { side: "left", y: 58 },
  lungs: { side: "left", y: 148 },
  immune: { side: "left", y: 248 },
  musculo: { side: "left", y: 352 },
  mind: { side: "right", y: 48 },
  heart: { side: "right", y: 150 },
  radiation: { side: "right", y: 262 }
};

const ICONS = {
  brain: '<path d="M9 5a3 3 0 0 0-3 3 3 3 0 0 0-1 5.5A3 3 0 0 0 8 18h1V5Zm6 0a3 3 0 0 1 3 3 3 3 0 0 1 1 5.5A3 3 0 0 1 16 18h-1V5ZM9 5h6M9 18h6M12 5v13"/><circle cx="8.5" cy="21" r=".8"/><circle cx="15.5" cy="21" r=".8"/>',
  mind: '<path d="M16 4a8 8 0 1 0 4 12A6.5 6.5 0 0 1 16 4Z"/><path d="M5 5h2M6 4v2"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/><path d="M3 12h4l2-3 2 6 2-3h8"/>',
  lungs: '<path d="M12 4v8M12 9c-2 0-3 1-4 3M12 9c2 0 3 1 4 3"/><path d="M8 7C5 8 4 13 4 17c0 2 2 3 4 2V9M16 7c3 1 4 6 4 10 0 2-2 3-4 2V9"/>',
  immune: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/><path d="M9 12h6M12 9v6"/>',
  musculo: '<path d="M7 4a2 2 0 0 0-1 3.7L16.3 18A2 2 0 1 0 20 17a2 2 0 1 0-3-2.7L9.7 7A2 2 0 1 0 7 4Z"/>',
  radiation: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10 9 4.8A8 8 0 0 0 4.2 13H10M14 12h5.8A8 8 0 0 0 15 4.8L12 10M13 13.7 16 19a8 8 0 0 1-8 0l3-5.3"/>'
};

const riskByName = new Map(NASA_RISKS.map((r) => [r.name, r]));

function iconSvg(id) {
  return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>`;
}

function controlPosition(id) {
  const p = PLACES[id];
  return { x: p.side === "left" ? 34 : STAGE_W - 34, y: p.y, side: p.side };
}

function connectors(photo) {
  return SYSTEMS.map((s) => {
    const c = controlPosition(s.id);
    const [ax, ay] = anchorOf(s, photo);
    const startX = c.side === "left" ? c.x + 26 : c.x - 26;
    const kneeX = c.side === "left" ? 92 : STAGE_W - 92;
    return `<g class="link" data-system="${s.id}">
      <path d="M${startX} ${c.y} H${kneeX} L${ax} ${ay}"/>
      <circle cx="${ax}" cy="${ay}" r="2.6" class="node"/>
    </g>`;
  }).join("");
}

function controls() {
  return SYSTEMS.map((s) => {
    const c = controlPosition(s.id);
    return `<button type="button" class="sys" data-system="${s.id}" aria-pressed="false"
      style="left:${((c.x / STAGE_W) * 100).toFixed(2)}%;top:${((c.y / STAGE_H) * 100).toFixed(2)}%">
      <span class="sys-dot">${iconSvg(s.id)}</span>
      <span class="sys-name">${s.name}</span>
    </button>`;
  }).join("");
}

function statusChip(key) {
  const st = STATUS[key];
  return `<span class="chip tone-${st.tone}"><span aria-hidden="true">${st.shape}</span> ${st.word}</span>`;
}

function overview() {
  return `
    <p class="eyebrow">Body scan</p>
    <h2>Tap a body system</h2>
    <p class="lede">See what NASA's Human Research Program says about the risks of spaceflight for that part of the body.</p>
    <ul class="tally">
      <li><strong data-count="17">0</strong><span>NASA risks</span></li>
      <li><strong data-count="${SYSTEMS.length}">0</strong><span>body systems</span></li>
      <li><strong data-count="5">0</strong><span>hazards</span></li>
    </ul>
    <p class="note">Readings arrive with the daily log module. Until then every system shows ${statusChip("none")}.</p>`;
}

function detail(system) {
  const risks = system.risks.map((name) => {
    const r = riskByName.get(name);
    return `<li class="risk">
      <h4>${r.name}</h4>
      <p>${r.text}</p>
      <a href="${r.url}" target="_blank" rel="noopener">Read on nasa.gov<span class="sr-only"> (opens in a new tab)</span></a>
    </li>`;
  }).join("");
  const facts = system.facts.map((f) => `<li class="fact">
      <blockquote>“${f.quote}”</blockquote>
      <a href="${f.url}" target="_blank" rel="noopener">${f.source}<span class="sr-only"> (opens in a new tab)</span></a>
    </li>`).join("");

  return `
    <p class="eyebrow">Body system</p>
    <div class="panel-head">
      <h2>${system.name}</h2>
      ${statusChip("none")}
    </div>
    <p class="note">No readings yet: status comes with the daily log.</p>
    ${facts ? `<h3>Key facts</h3><ul class="facts">${facts}</ul>` : ""}
    <h3>NASA risks <span class="count">${system.risks.length}</span></h3>
    <ul class="risks">${risks}</ul>
    <p class="fine">How systems are grouped is a Ergosphere choice. Risk names and texts are NASA's own words from <a href="${RISKS_SOURCE.url}" target="_blank" rel="noopener">${RISKS_SOURCE.label}</a>.</p>
    <button type="button" class="textlink" data-action="overview">Back to all systems</button>`;
}

function countUp(root) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const el of root.querySelectorAll("[data-count]")) {
    const target = Number(el.dataset.count);
    if (reduce) { el.textContent = String(target); continue; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 900);
      el.textContent = String(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

export function mountBody(host) {
  const photo = document.documentElement.dataset.theme !== "night"; // day: the realistic body; night: the hologram
  host.innerHTML = `
  <section class="body-module${photo ? " with-photo" : ""}" aria-labelledby="body-title">
    <header class="module-head">
      <p class="eyebrow">Module 2</p>
      <h1 id="body-title" tabindex="-1">${photo ? "Body systems" : "Body hologram"}</h1>
      <a class="fb-link" href="#future"><span>Future body<small>Bone density over a mission, against NASA's requirement</small></span><span>Open →</span></a>
      <a class="fb-link" href="#mind"><span>Mind &amp; support<small>Mood and sleep this week, comfort settings, and asking for help</small></span><span>Open →</span></a>
    </header>
    <div class="body-layout">
      <div class="stage" data-ref="stage">
        ${photo
    ? `<div class="figure-wrap" style="left:${(PHOTO_BOX.x / STAGE_W) * 100}%;top:${(PHOTO_BOX.y / STAGE_H) * 100}%;width:${(PHOTO_BOX.w / STAGE_W) * 100}%">${photoFigure()}</div>`
    : `<div class="figure-wrap" style="left:${(FIG_X / STAGE_W) * 100}%;top:${(FIG_Y / STAGE_H) * 100}%;width:${(200 / STAGE_W) * 100}%">${figureSvg()}</div>`}
        <svg class="links" viewBox="0 0 ${STAGE_W} ${STAGE_H}" aria-hidden="true">${connectors(photo)}</svg>
        ${controls()}
        ${photo ? `<p class="fine body-ai">${PHOTO_NOTE}</p>` : ""}
      </div>
      <aside class="system-panel" data-ref="panel" aria-live="polite"></aside>
    </div>
  </section>`;

  const stage = host.querySelector('[data-ref="stage"]');
  const panel = host.querySelector('[data-ref="panel"]');
  let current = null;

  function select(id) {
    current = id;
    const system = SYSTEMS.find((s) => s.id === id);
    const lit = new Set(system ? system.regions : []);
    stage.classList.toggle("focused", Boolean(system));
    for (const g of stage.querySelectorAll(".region")) g.classList.toggle("lit", lit.has(g.dataset.region));
    for (const el of stage.querySelectorAll("[data-system]")) {
      const on = el.dataset.system === id;
      el.classList.toggle("on", on);
      if (el.tagName === "BUTTON") el.setAttribute("aria-pressed", String(on));
    }
    panel.innerHTML = system ? detail(system) : overview();
    if (!system) countUp(panel);
  }

  stage.addEventListener("click", (e) => {
    const btn = e.target.closest("button.sys");
    if (!btn) return;
    select(current === btn.dataset.system ? null : btn.dataset.system);
    if (current && matchMedia("(max-width: 860px)").matches) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  panel.addEventListener("click", (e) => {
    if (e.target.closest('[data-action="overview"]')) {
      const was = current;
      select(null);
      stage.querySelector(`button.sys[data-system="${was}"]`)?.focus();
    }
  });

  select(null);
  requestAnimationFrame(() => host.querySelector(".body-module").classList.add("ready"));
  return { select };
}
