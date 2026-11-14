// Module 8 — Medication log. It does not prescribe. It logs what the astronaut took, follows
// up on whether it worked, and flags patterns worth raising with the crew medical officer.
// Three steps: what it was for (tap the body), what you took (from NASA's ISS kit list, as
// 3D models), how many. Supplements in the mission plan are logged as taken or not.
// Rules: meds-core.js. Words and sources: data/med-kit.js, data/supplements.js, SOURCES.md.

import * as M from "./meds-core.js";
import { RED_FLAGS, KIT, SIDE_EFFECTS, KIT_FACTS } from "./data/med-kit.js";
import { SUPPLEMENTS } from "./data/supplements.js";
import { ZONES } from "./data/med-zones.js";
import { STATUS } from "./data/body-systems.js";
import { figureSvg } from "./anatomy.js";
import { pill3d, enableDrag } from "./pill3d.js";
import { readLog } from "./store.js";

const WORKED = {
  yes: { ...STATUS.normal, word: "It worked" },
  partly: { ...STATUS.watch, word: "Partly" },
  no: { ...STATUS.act, word: "Did not work" }
};
const KIT_URL = KIT_FACTS.carried.url;

// The figure is 200 x 450 units and sits in the middle 46% of the stage.
const FIG = { left: 27, width: 46 };
const px = (x) => FIG.left + (x / 200) * FIG.width;
const py = (y) => (y / 450) * 100;

const med = (id) => KIT.find((k) => k.id === id);
const zone = (id) => ZONES.find((z) => z.id === id);
const units = (m, n) => `${n} ${m.unit}${n === 1 ? "" : "s"}`;
const link = (url, text) => `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
const quote = (f) => (f?.quote ? `<small class="src">“${f.quote}” ${link(f.url, f.source ?? "Source")}</small>` : "");
const chip = (x, name, type = "checkbox") => `<label class="chip"><input type="${type}" name="${name}" value="${x.id}"><span>${x.label}</span></label>`;

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(M.MEDS_KEY)); } catch { /* start with an empty log */ }
  return M.cleanStore(raw, KIT, SUPPLEMENTS);
}
function save(store) {
  try { localStorage.setItem(M.MEDS_KEY, JSON.stringify(store)); return true; } catch { return false; }
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- step 1: what it was for ---------- */

function stageHtml() {
  const lines = ZONES.map((z) => `<line data-zone-line="${z.id}" x1="${z.side === "left" ? 25 : 75}" y1="${z.top + 5.5}" x2="${px(z.at[0]).toFixed(1)}" y2="${py(z.at[1]).toFixed(1)}"/>`).join("");
  const dots = ZONES.map((z) => `<span class="zone-dot" data-zone-dot="${z.id}" style="left:${px(z.at[0]).toFixed(1)}%;top:${py(z.at[1]).toFixed(1)}%" aria-hidden="true"></span>`).join("");
  const labels = ZONES.map((z) => `<button type="button" class="zone-btn" data-zone="${z.id}" data-side="${z.side}" style="top:${z.top}%" aria-pressed="false">${z.label}</button>`).join("");
  return `<div class="body-stage" data-ref="stage">
    <div class="stage-fig" aria-hidden="true">${figureSvg()}</div>
    <svg class="zone-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
    ${dots}${labels}
  </div>`;
}

/* ---------- steps 2 and 3: what you took, how many ---------- */

function pickHtml(z) {
  const meds = M.inCategories(KIT, z.categories);
  const cats = [...new Set(meds.map((m) => m.category))];
  return `<div class="zone-panel">
    <div class="zone-head"><div><p class="mono">STEP 1 · WHAT FOR</p><h2>${z.reason}</h2></div><button type="button" class="textlink" data-med-act="close">Change</button></div>
  </div>
  <div class="log-step">
    <p class="mono step-label">STEP 2 · WHAT YOU TOOK</p>
    <p class="fine">NASA's ISS medical kit list, category “${cats.join("”, “")}”. ${link(KIT_URL, "NASA kit list")}</p>
    <div class="take-grid" role="radiogroup" aria-label="Medication you took">
      ${meds.map((m) => `<label class="take-opt">
        <input type="radio" name="take" value="${m.id}">
        ${pill3d(m, 78)}
        <strong>${m.name}</strong>
        <span class="mono">${m.strength}${m.rx ? " · Rx" : ""}</span>
      </label>`).join("")}
    </div>
  </div>
  <div class="log-step" data-ref="howmany" hidden>
    <p class="mono step-label">STEP 3 · HOW MANY</p>
    <div class="chips" role="radiogroup" aria-label="How many">${[1, 2, 3].map((n) => `<label class="chip"><input type="radio" name="units" value="${n}" ${n === 1 ? "checked" : ""}><span data-unit-label="${n}">${n}</span></label>`).join("")}</div>
    <button type="button" class="cta main log-btn" data-med-act="log">Log it</button>
  </div>`;
}

const HINT = `<div class="hint"><p><strong>Log something you took</strong></p><p>Step 1: tap what it was for on the figure.</p></div>`;

/* ---------- follow-up ---------- */

function followUpHtml(store, now) {
  const { due, later } = M.followUps(store.doses, KIT, now);
  const cards = due.map(({ dose }) => {
    const m = med(dose.medId);
    const effects = M.effectsFor(m).map((label, i) => ({ id: `k${i}`, label }));
    return `<form class="followup" data-dose="${dose.id}">
      <div class="fu-top">${pill3d(m, 56)}<p class="fu-q"><strong>Did it work?</strong><br>${m.name} · ${units(m, dose.units)} · ${M.spanWords(dose.at, now)} ago${dose.reason ? ` · for ${dose.reason.toLowerCase()}` : ""}</p></div>
      <div class="chips" role="radiogroup" aria-label="How it went">${M.OUTCOMES.map((o) => chip(o, "worked", "radio")).join("")}</div>
      <p class="fu-sub">Did you notice any of these? <span class="fine">${effects.length ? `Possible side effects NASA's kit list gives for ${m.name.toLowerCase()}.` : `NASA's kit list gives no significant side effects for ${m.name.toLowerCase()}.`}</span></p>
      <div class="chips">${[...effects, ...SIDE_EFFECTS].map((x) => chip(x, "effect")).join("")}</div>
      <button type="submit" class="cta main">Save answer</button>
      <p class="step-msg" role="status" aria-live="polite"></p>
    </form>`;
  }).join("");
  const waiting = later.map(({ dose, askAt }) => `<p class="fine">Ergosphere will ask whether ${med(dose.medId).name.toLowerCase()} worked in ${M.spanWords(now, askAt)}.</p>`).join("");
  return cards + waiting;
}

/* ---------- patterns ---------- */

function patternsHtml(store, now) {
  const list = M.patterns(store, KIT, now, readLog());
  if (!list.length) return `<p class="calm-line">${STATUS.normal.shape} Nothing to raise right now.</p>`;
  return `<ul class="patterns">${list.map((p) => `<li class="pattern" data-level="${p.level}">
    <p class="pt-head">${p.level === "talk" ? `${STATUS.watch.shape} ${M.LEVELS.talk}` : `↗ ${M.LEVELS.downlink}`}</p>
    <p>${p.text}${p.quote ? ` “${p.quote}” ${link(p.url, "NASA kit list")}` : ""}</p>
    ${p.illustrative ? `<p class="fine">Illustrative app rule, not a NASA limit.</p>` : ""}
  </li>`).join("")}</ul>`;
}

/* ---------- supplements ---------- */

function supplementsHtml(store, today) {
  return SUPPLEMENTS.map((s) => {
    const days = M.supplementDays(store, s.id, today, 7);
    const taken = days.at(-1).taken;
    return `<div class="supp">
      <div class="supp-top">
        <div><p class="mono">IN YOUR MISSION PLAN · ${s.plan.toUpperCase()}</p><h3>${s.name}</h3></div>
        <button type="button" class="cta ${taken ? "" : "main"}" data-supp="${s.id}" aria-pressed="${taken}">${taken ? "✓ Taken today" : "Mark as taken today"}</button>
      </div>
      <ul class="supp-week" aria-label="Last 7 days">${days.map((d) => `<li class="${d.taken ? "on" : ""}" title="${d.day}${d.taken ? ": taken" : ""}"><span>${new Date(`${d.day}T12:00`).toLocaleDateString("en-GB", { weekday: "narrow" })}</span></li>`).join("")}</ul>
      <p class="supp-why">${s.why.text}</p>
      ${s.why.facts.map(quote).join("")}
      <p class="fine">Logged as taken or not. There is no “Did it work?” for a supplement: its effect does not show the next day.</p>
    </div>`;
  }).join("");
}

/* ---------- history ---------- */

function recordHtml(store) {
  const doses = [...store.doses].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);
  if (!doses.length) return `<p class="fine">Nothing logged yet.</p>`;
  return `<ul class="doses">${doses.map((d) => {
    const m = med(d.medId);
    const w = d.outcome ? WORKED[d.outcome.worked] : null;
    const fx = (d.outcome?.effects ?? []).filter((e) => e !== "Nothing");
    return `<li><span class="mono">${d.at.slice(0, 16).replace("T", " ")} UTC</span>
      <span>${m.name} · ${units(m, d.units)}${d.reason ? ` · ${d.reason.toLowerCase()}` : ""}</span>
      <span class="${w ? `tone-${w.tone}` : "tone-none"}">${w ? `${w.shape} ${w.word}${fx.length ? ` · ${fx.join(", ").toLowerCase()}` : ""}` : `${STATUS.pending.shape} Not rated yet`}</span></li>`;
  }).join("")}</ul>`;
}

export function mountMeds(host) {
  let store = load();
  let open = null;

  host.innerHTML = `
  <section class="meds" aria-labelledby="md-title">
    <p class="eyebrow">Module 8 · Medication log</p>
    <h1 id="md-title" tabindex="-1">What did you take?</h1>
    <p class="lede">It does not prescribe. It logs what you took, follows up on whether it worked, and flags patterns worth raising with your crew medical officer.</p>

    <div data-ref="due" aria-live="polite"></div>

    <div class="meds-main">
      <div class="meds-left">
        ${stageHtml()}
        <form class="alarm" novalidate autocomplete="off">
          <p class="alarm-h"><strong>Alarm signs.</strong> Any of these? Tap it.</p>
          <div class="chips">${RED_FLAGS.map((f) => chip(f, "flag")).join("")}</div>
          <div data-ref="alarm"></div>
        </form>
      </div>
      <div class="meds-right">
        <div data-ref="panel" aria-live="polite">${HINT}</div>
        <p class="step-msg" data-ref="msg" role="status" aria-live="polite"></p>
        <section class="data-card" aria-labelledby="pt-h">
          <h2 id="pt-h">Patterns to raise</h2>
          <div data-ref="patterns"></div>
        </section>
      </div>
    </div>

    <section class="data-card" aria-labelledby="sp-h">
      <h2 id="sp-h">Supplements</h2>
      <div data-ref="supps"></div>
    </section>

    <section class="data-card" aria-labelledby="rec-h">
      <h2 id="rec-h">Your log</h2>
      <p>It stays on this device. ${KIT_FACTS.record.text}${quote(KIT_FACTS.record)}</p>
      <div data-ref="record"></div>
      <div class="data-btns"><button type="button" class="cta" data-med-act="csv">Export CSV</button><button type="button" class="textlink" data-med-act="reset">Clear the demo log</button></div>
    </section>

    <a class="duty-link" href="#duty"><span>Fit for duty check<small>Before a spacewalk, docking or another critical task</small></span><span>Open →</span></a>

    <p class="fine rule-note">Ergosphere never suggests a medication or a dose and never interprets a symptom. Names and categories come from NASA's ISS medical kit list (2015); the 3D shapes are illustrations, not the real products. Warnings quote that list or are marked as illustrative app rules; the waiting time before "Did it work?" and the alarm-sign list are app rules too. Sources: docs/SOURCES.md.</p>
  </section>`;

  const root = host.querySelector(".meds");
  const $ = (r) => root.querySelector(`[data-ref="${r}"]`);
  const stage = $("stage");

  function lightZone(id) {
    const z = id ? zone(id) : null;
    stage.classList.toggle("focused", Boolean(z));
    stage.querySelectorAll(".region").forEach((r) => r.classList.toggle("lit", Boolean(z?.lit.includes(r.dataset.region))));
    stage.querySelectorAll("[data-zone]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zone === id)));
    stage.querySelectorAll("[data-zone-dot]").forEach((d) => d.classList.toggle("on", d.dataset.zoneDot === id));
    stage.querySelectorAll("[data-zone-line]").forEach((l) => l.classList.toggle("on", l.dataset.zoneLine === id));
  }

  function openZone(id) {
    open = id;
    lightZone(id);
    $("panel").innerHTML = pickHtml(zone(id));
    if (matchMedia("(max-width: 859px)").matches) $("panel").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  function closeZone() {
    open = null;
    lightZone(null);
    $("panel").innerHTML = HINT;
  }

  function paint(keepMsg = false) {
    const now = new Date();
    $("due").innerHTML = followUpHtml(store, now);
    $("patterns").innerHTML = patternsHtml(store, now);
    $("supps").innerHTML = supplementsHtml(store, M.dayOf(now));
    $("record").innerHTML = recordHtml(store);
    if (!keepMsg) $("msg").textContent = "";
  }

  root.addEventListener("change", (e) => {
    if (e.target.name === "take") {
      const m = med(e.target.value);
      $("howmany").hidden = false;
      root.querySelectorAll("[data-unit-label]").forEach((s) => { s.textContent = units(m, Number(s.dataset.unitLabel)); });
      $("howmany").scrollIntoView({ block: "nearest" });
    }
    if (e.target.name === "flag") {
      const flags = M.redFlags(RED_FLAGS, [...root.querySelectorAll('input[name="flag"]:checked')].map((i) => i.value));
      $("alarm").innerHTML = flags.length ? `<p class="result act"><strong>${STATUS.act.shape} ${STATUS.act.word}.</strong> ${flags.map((f) => f.label).join(", ")}: talk to your crew medical officer or the flight surgeon now. Ergosphere does not handle this.</p>` : "";
    }
  });

  root.addEventListener("click", (e) => {
    const z = e.target.closest("[data-zone]");
    if (z) { if (open === z.dataset.zone) closeZone(); else openZone(z.dataset.zone); return; }
    const sp = e.target.closest("[data-supp]");
    if (sp) {
      store = M.markSupplement(store, sp.dataset.supp, M.dayOf(), sp.getAttribute("aria-pressed") !== "true");
      save(store);
      paint();
      return;
    }
    const t = e.target.closest("[data-med-act]");
    if (!t) return;
    const act = t.dataset.medAct;
    if (act === "close") { closeZone(); stage.scrollIntoView({ block: "nearest" }); return; }
    if (act === "csv") { download(`ergosphere-medications-${M.dayOf()}.csv`, M.toCsv(store.doses, KIT), "text/csv"); return; }
    if (act === "reset") { store = M.emptyStore(); save(store); paint(); $("msg").textContent = "Demo log cleared."; return; }
    if (act === "log") {
      const medId = root.querySelector('input[name="take"]:checked')?.value;
      const n = Number(root.querySelector('input[name="units"]:checked')?.value ?? 1);
      const r = M.logDose(store, KIT, { medId, units: n, reason: zone(open)?.reason ?? null });
      if (!r.ok) { $("msg").textContent = r.why; return; }
      store = r.store;
      if (!save(store)) { $("msg").textContent = "This browser blocked saving. The dose was not stored."; return; }
      const m = med(medId);
      closeZone();
      paint(true);
      $("msg").textContent = `Logged: ${m.name}, ${units(m, n)}. Ergosphere will ask whether it worked in ${M.spanWords(new Date(), new Date(Date.now() + m.askAfterHours * 3600000))}.`;
    }
  });

  root.addEventListener("submit", (e) => {
    const form = e.target.closest(".followup");
    if (!form) return;
    e.preventDefault();
    const worked = form.querySelector('input[name="worked"]:checked')?.value;
    const effects = [...form.querySelectorAll('input[name="effect"]:checked')].map((i) => i.closest("label").textContent.trim());
    const r = M.setOutcome(store, form.dataset.dose, { worked, effects });
    if (!r.ok) { form.querySelector(".step-msg").textContent = r.why; return; }
    store = r.store;
    save(store);
    paint();
    $("msg").textContent = "Answer saved to your log.";
  });

  enableDrag(root);
  paint();
}
