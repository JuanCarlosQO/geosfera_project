// Module 10 — Live telemetry. A stream that updates every second, as a sensor feed would:
// the crew member's heart rate, blood pressure and time still; the cabin's CO2, temperature,
// humidity and pressure; and the radiation dose rate. Scenario buttons trigger the
// emergencies the team wants to show, and each alert says what to do.
//
// Based on a team member's prototype ("Add telemetry module"). That version imported a
// telemetry-core.js that was never added, was not linked from the app and kept its timer
// running after leaving the screen; this one fixes those and sources every limit.
// Rules: telemetry-core.js. Words and sources: data/telemetry.js, docs/SOURCES.md.

import * as T from "./telemetry-core.js";
import { LIMIT_FACTS, RESPONSES } from "./data/telemetry.js";
import { RADLAB_ISS } from "./data/radlab-iss.js";
import { STATUS } from "./data/body-systems.js";
import { sparkPath } from "./today-core.js";
import { dateKey } from "./log-core.js";
import { readLog, current } from "./store.js";

const DONKI = "https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR";
const TYPICAL_DOSE = T.median(RADLAB_ISS.values);

const CARDS = {
  heartRate: { name: "Heart rate", unit: "bpm", group: "crew" },
  bloodPressure: { name: "Blood pressure", unit: "mmHg", group: "crew" },
  still: { name: "Time without moving", unit: "min", group: "crew" },
  hydration: { name: "Estimated hydration", unit: "%", group: "crew" },
  co2: { name: "Cabin CO₂", unit: "mmHg", group: "cabin" },
  temperature: { name: "Cabin temperature", unit: "°C", group: "cabin" },
  humidity: { name: "Relative humidity", unit: "%", group: "cabin" },
  pressure: { name: "Cabin pressure", unit: "kPa", group: "cabin" },
  smoke: { name: "Smoke particles", unit: "µg/m³", group: "cabin" },
  ammonia: { name: "Ammonia", unit: "ppm", group: "cabin" },
  power: { name: "Power available", unit: "%", group: "cabin" },
  dose: { name: "Radiation dose rate", unit: "µGy/h", group: "rad" }
};
const BASIS = { nasa: "NASA limit", team: "Team reference (Earth clinical ranges)", app: "App rule" };
const fact = (k) => `<small class="src">“${LIMIT_FACTS[k].quote}” <a href="${LIMIT_FACTS[k].url}" target="_blank" rel="noopener">${LIMIT_FACTS[k].source}</a></small>`;
const factInline = (k) => `“${LIMIT_FACTS[k].quote}”`;
const LIMIT_TEXT = {
  heartRate: "Team reference 60–100 bpm",
  bloodPressure: "Team reference: CDC categories",
  still: "App rule: move after 60 min",
  co2: "NASA: no more than 3 mmHg (1-hour average)",
  temperature: "NASA: 18–27 °C · comfort 20–25 °C",
  humidity: "NASA: 25–75 % · comfort 30–60 %",
  pressure: "NASA: 34.5–103 kPa · ISS 101.3 kPa",
  hydration: `App rule: below ${T.RULES.hydration[0]} % watch, ${T.RULES.hydration[1]} % act`,
  smoke: `App rule: ${T.RULES.smoke[0]} watch, ${T.RULES.smoke[1]} act`,
  ammonia: `App rule: ${T.RULES.ammonia[0]} ppm watch, ${T.RULES.ammonia[1]} act`,
  power: `App rule: below ${T.RULES.power[0]} % watch, ${T.RULES.power[1]} % act`,
  dose: `Real ISS data · median ${TYPICAL_DOSE.toFixed(1)} µGy/h`
};

const link = (f) => `<a href="${f.url}" target="_blank" rel="noopener">${f.source}</a>`;
const src = (f) => `<small class="src">“${f.quote}” ${link(f)}</small>`;
const fmt = (k, c) => (k === "bloodPressure" ? `${c.value[0]}/${c.value[1]}` : c.value == null ? "—" : String(c.value));

function card(k) {
  const c = CARDS[k];
  return `<li class="tm-card" data-ch="${k}">
    <div class="tm-top"><span class="tm-name">${c.name}</span><span class="tm-tag" data-tag="${k}">${k === "dose" ? "REAL NASA DATA" : "SIMULATED"}</span></div>
    <p class="tm-val"><strong data-val="${k}">—</strong> <span>${c.unit}</span><small data-extra="${k}"></small></p>
    <svg class="tm-spark" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true"><path data-spark="${k}"/></svg>
    <p class="tm-foot"><span data-st="${k}"></span><span class="tm-limit">${LIMIT_TEXT[k]}</span></p>
  </li>`;
}

function alertHtml(a) {
  const r = RESPONSES[a.id];
  const st = STATUS[a.status];
  return `<li class="tm-alert tone-${st.tone}" data-status="${a.status}">
    <p class="tm-a-head"><strong>${st.shape} ${r.title}</strong><span>${st.word}</span></p>
    <ol>${r.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
    ${r.facts.map((f) => src(LIMIT_FACTS[f])).join("")}
    ${r.illustrative ? `<p class="fine">Threshold and steps: illustrative app rule from the team simulator, not a NASA procedure. On a real vehicle the crew follows its own emergency procedures.</p>` : ""}
    ${r.link ? `<a class="tm-go" href="${r.link.href}">${r.link.text} →</a>` : ""}
  </li>`;
}

async function spaceWeather(box) {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 864e5);
  const d = (x) => x.toISOString().slice(0, 10);
  try {
    const res = await fetch(`${DONKI}?startDate=${d(start)}&endDate=${d(end)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    const list = await res.json();
    if (!box.isConnected) return;
    if (!Array.isArray(list) || !list.length) { box.innerHTML = `<p><strong>No solar flares</strong> in NASA's DONKI catalogue in the last 30 days.</p>`; return; }
    const f = list.at(-1);
    const peak = new Date(f.peakTime).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
    box.innerHTML = `<p><span class="tm-live-dot" aria-hidden="true"></span><strong>Latest real solar flare: class ${f.classType}</strong>, peak ${peak} UTC${f.sourceLocation ? `, from ${f.sourceLocation}` : ""}. ${list.length} ${list.length === 1 ? "flare" : "flares"} in the last 30 days.</p>
      <p class="fine">Live from NASA's DONKI space-weather catalogue (CCMC). <a href="https://ccmc.gsfc.nasa.gov/tools/DONKI/" target="_blank" rel="noopener">DONKI</a></p>`;
  } catch {
    if (box.isConnected) box.innerHTML = `<p class="fine">Could not reach NASA's DONKI space-weather service right now (offline?). The rest of this screen works without it.</p>`;
  }
}

export function mountLive(host) {
  const member = current();
  const log = member ? readLog(member.id) : {};
  const today = dateKey();
  const bands = { hr: T.baseline(log, "heartRate", today), sys: T.baseline(log, "bloodPressure", today, 0) };
  const dia = T.baseline(log, "bloodPressure", today, 1);
  let state = T.startState({ hr: bands.hr?.mean, sys: bands.sys?.mean, dia: dia?.mean }, RADLAB_ISS);
  const rand = T.rng(Date.now() % 100000);
  let history = {};
  let paused = false;

  host.innerHTML = `
  <section class="live" aria-labelledby="lv-title">
    <p class="eyebrow">Module 10 · Live telemetry</p>
    <h1 id="lv-title" tabindex="-1">Sensors, second by second</h1>
    <p class="lede">A feed like the one a cabin and a wearable would send. Crew and cabin values are <strong>simulated</strong>; the radiation dose rate is <strong>real NASA data</strong> from the International Space Station, replayed. Limits come from NASA wherever NASA publishes one; the rest are marked as app rules.</p>

    <div class="tm-status" data-ref="status" aria-live="polite"></div>

    <p class="fine">Simulations can be combined: tap one or several. Tap again to stop one.</p>
    ${[["cabin", "Cabin"], ["crew", "Crew member"]].map(([g, label]) => `<div class="tm-controls" role="group" aria-label="${label} simulations"><span class="tm-glabel mono">${label}</span>
      ${Object.entries(T.SCENARIOS).filter(([, x]) => x.group === g).map(([id, x]) => `<button type="button" class="tm-scn" data-scn="${id}" data-group="${g}" aria-pressed="false">${x.label}</button>`).join("")}</div>`).join("")}
    <div class="tm-controls"><button type="button" class="tm-scn tm-reset" data-scn="nominal">${T.SCENARIOS.nominal.label}</button>
      <button type="button" class="tm-pause" data-ref="pause" aria-pressed="false">Pause</button></div>
    <p class="fine" data-ref="note">${T.SCENARIOS.nominal.note}</p>

    <ul class="tm-alerts" data-ref="alerts" aria-live="polite"></ul>
    <details class="tm-log"><summary>Event log · <span data-ref="logn">0</span></summary><ol data-ref="log"></ol>
      <p class="fine">An alert is raised after ${T.RULES.raiseAfter} readings in a row and cleared after ${T.RULES.clearAfter} back to normal, so one odd reading raises nothing. The log lasts while this screen is open.</p></details>

    <h2 class="tm-h">Crew member${member ? ` · ${member.name.replace(/[<>&"]/g, "")}` : ""}</h2>
    <p class="fine">${bands.hr ? `Your usual range (app rule, last ${T.RULES.baselineDays} days, ${bands.hr.n} readings): heart rate ${bands.hr.low}–${bands.hr.high} bpm${bands.sys ? `, top blood pressure ${bands.sys.low}–${bands.sys.high} mmHg` : ""}. Values outside it are flagged even inside the reference range.` : `Log heart rate and blood pressure on ${T.RULES.baselineMin} days and the feed will also compare you with yourself.`}</p>
    <ul class="tm-grid">${["heartRate", "bloodPressure", "still", "hydration"].map(card).join("")}</ul>

    <h2 class="tm-h">Cabin</h2>
    <ul class="tm-grid">${["co2", "temperature", "humidity", "pressure", "smoke", "ammonia", "power"].map(card).join("")}</ul>

    <h2 class="tm-h">Radiation</h2>
    <ul class="tm-grid tm-one">${card("dose")}</ul>
    <p class="fine">Replay of NASA OSDR RadLab, ISS DosTel1, ${RADLAB_ISS.from.slice(0, 10)} ${RADLAB_ISS.from.slice(11, 16)}–${RADLAB_ISS.to.slice(11, 16)} UTC, one reading per second. <a href="${RADLAB_ISS.docs}" target="_blank" rel="noopener">RadLab</a>. For scale, NASA reports ISS crews ${src(LIMIT_FACTS.doseIss)}</p>
    <div class="tm-weather" data-ref="weather"><p class="fine">Asking NASA's DONKI service for real space weather…</p></div>

    <section class="tm-info" aria-labelledby="tm-rad-h">
      <h2 class="tm-h" id="tm-rad-h">Space radiation: where it comes from, what the crew does</h2>
      <div class="tm-kinds">
        <div><p class="mono">ALWAYS THERE</p><h3>Galactic cosmic rays</h3><p>High-energy protons and heavy ions from outside the solar system. The dose-rate replay above is mostly this, plus the particles trapped in Earth's magnetic field.</p></div>
        <div><p class="mono">IN BURSTS</p><h3>Solar particle events</h3><p>Particles shot out by the Sun during a flare. The “Solar particle event” button simulates one; the real flare list above comes from NASA.</p></div>
      </div>
      ${fact("radKinds")}${fact("radSolar")}
      <h3 class="tm-h3">During a solar particle event: take shelter</h3>
      <p>NASA's plan for Orion uses what is already on board as shielding: the crew will ${factInline("shelter")}. Those bags hold the mission's own cargo: ${factInline("shelterBags")}.</p>
      ${fact("shelterTime")}${fact("shelterWhy")}
      <p class="fine">This is NASA's 2016 plan for the Orion spacecraft, not an ISS procedure. On any vehicle the crew follows its own flight rules.</p>
    </section>

    <section class="tm-info" aria-labelledby="tm-cond-h">
      <h2 class="tm-h" id="tm-cond-h">Exactly when an alert fires</h2>
      <div class="tm-table" role="table" aria-label="Alert conditions">
        <div class="tm-tr tm-th" role="row"><span role="columnheader">Channel</span><span role="columnheader">${STATUS.watch.shape} Watch when</span><span role="columnheader">${STATUS.act.shape} Act now when</span><span role="columnheader">Based on</span></div>
        ${T.conditions(TYPICAL_DOSE).map((c) => `<div class="tm-tr" role="row"><span role="cell"><strong>${c.name ?? CARDS[c.key].name}</strong></span><span role="cell">${c.watch ?? "—"}</span><span role="cell">${c.act ?? "—"}</span><span role="cell">${BASIS[c.basis]}${[...new Map(c.facts.map((f) => [LIMIT_FACTS[f].source, LIMIT_FACTS[f]])).values()].map((f) => ` <a href="${f.url}" target="_blank" rel="noopener">${f.source}</a>`).join(",")}</span></div>`).join("")}
      </div>
      <p class="fine">NASA's CO₂ limit is a 1-hour average. The simulator compares the current value so the demo reacts in seconds; a real detector would average over the hour. Crew vital signs are judged on a ${T.RULES.smoothSeconds}-second average so one noisy reading raises nothing.</p>
    </section>

    <p class="fine rule-note">Not a medical device and not real crew data. Simulated values move around NASA's usual cabin values and your own log; the dose-rate replay is real. The simulator engine (scenarios that combine, effort and recovery, steady alerts) comes from a prototype by a team member; its thresholds for smoke, ammonia, power, hydration, effort heart rate and the leak rate are illustrative app rules. "Your usual range", the movement reminder and the dose-rate alert are app rules. Sources: docs/SOURCES.md.</p>
  </section>`;

  const root = host.querySelector(".live");
  const $ = (r) => root.querySelector(`[data-ref="${r}"]`);
  let lastAlerts = "";
  let tracker = T.makeTracker();
  let steady = [];
  const events = [];
  const MODES = { rest: "At rest", exercise: "Exercising", eva: "On a spacewalk", recovery: "Recovering from effort" };
  const clock = (t) => `T+${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

  function paint(advance = false) {
    const r = T.readout(state, bands, TYPICAL_DOSE, history);
    history = T.remember(history, r);
    if (advance) {
      const out = T.track(tracker, r.alerts);
      tracker = out.tracker; steady = out.active;
      for (const ev of out.events) events.unshift({ ...ev, t: state.t });
      if (out.events.length) {
        events.length = Math.min(events.length, 30);
        $("logn").textContent = events.length;
        $("log").innerHTML = events.map((ev) => `<li><span class="mono">${clock(ev.t)}</span> <span class="tone-${ev.type === "resolved" ? STATUS.normal.tone : STATUS[ev.status].tone}">${ev.type === "resolved" ? `${STATUS.normal.shape} Resolved` : `${STATUS[ev.status].shape} ${STATUS[ev.status].word}`}</span> ${RESPONSES[ev.id].title}</li>`).join("");
      }
    }
    const top = steady.some((a) => a.status === "act") ? "act" : steady.length ? "watch" : "normal";
    const st = STATUS[top];
    const active = Object.keys(state.active);
    $("status").dataset.status = top;
    $("status").innerHTML = `<span class="tm-live-dot" aria-hidden="true"></span><strong class="tone-${st.tone}">${st.shape} ${steady.length ? `${steady.length} ${steady.length === 1 ? "alert" : "alerts"}` : "All channels nominal"}</strong><span class="tm-mode" data-mode="${r.mode}">${MODES[r.mode]}</span><span>${active.length ? `${active.length} ${active.length === 1 ? "simulation" : "simulations"}` : "Nominal"} · ${clock(state.t)}</span>`;
    for (const [k, c] of Object.entries(r.channels)) {
      root.querySelector(`[data-val="${k}"]`).textContent = fmt(k, c);
      const s = STATUS[c.status] ?? STATUS.none;
      root.querySelector(`[data-st="${k}"]`).innerHTML = `<span class="tone-${s.tone}">${s.shape} ${s.word}</span>`;
      root.querySelector(`[data-ch="${k}"]`).dataset.status = c.status;
      root.querySelector(`[data-spark="${k}"]`).setAttribute("d", sparkPath(history[k] ?? [], 120, 32));
    }
    root.querySelector('[data-extra="co2"]').textContent = ` ≈ ${r.channels.co2.ppm} ppm`;
    root.querySelector('[data-extra="pressure"]').textContent = Math.abs(r.channels.pressure.rate) >= 0.5 ? ` · ${r.channels.pressure.rate > 0 ? "+" : ""}${r.channels.pressure.rate} kPa/min` : "";
    root.querySelector('[data-extra="heartRate"]').textContent = r.mode === "exercise" || r.mode === "eva" ? ` · effort, max ≈ ${T.maxHeartRate()}` : r.mode === "recovery" ? " · recovering" : "";
    root.querySelector('[data-extra="dose"]').textContent = r.channels.dose.time ? ` · ISS ${r.channels.dose.time} UTC` : "";
    root.querySelector('[data-tag="dose"]').textContent = r.channels.dose.real ? "REAL NASA DATA" : "REAL × SIMULATED EVENT";
    for (const k of ["heartRate", "bloodPressure"]) {
      const mine = r.channels[k].mine;
      if (mine && mine !== "inside") root.querySelector(`[data-st="${k}"]`).insertAdjacentHTML("beforeend", ` <small>${mine} your usual</small>`);
    }
    root.querySelectorAll("[data-scn][data-group]").forEach((b) => {
      const c = state.active[b.dataset.scn];
      b.setAttribute("aria-pressed", String(Boolean(c) && c.phase !== "rec"));
      b.classList.toggle("rec", c?.phase === "rec");
    });
    $("note").textContent = active.length ? active.map((id) => T.SCENARIOS[id].note).join(" ") : T.SCENARIOS.nominal.note;
    const sig = steady.map((a) => `${a.id}:${a.status}`).join(",");
    if (sig !== lastAlerts) { $("alerts").innerHTML = steady.map(alertHtml).join(""); lastAlerts = sig; }
  }

  const timer = setInterval(() => {
    if (!root.isConnected) { clearInterval(timer); return; } // left the screen: stop the feed
    if (paused) return;
    state = T.step(state, rand);
    paint(true);
  }, T.TICK_MS);

  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-scn]");
    if (b) {
      state = b.dataset.scn === "nominal" ? T.resetAll(state) : T.toggleScenario(state, b.dataset.scn);
      paint();
      return;
    }
    if (e.target.closest('[data-ref="pause"]')) {
      paused = !paused;
      $("pause").setAttribute("aria-pressed", String(paused));
      $("pause").textContent = paused ? "Resume" : "Pause";
    }
  });

  paint();
  spaceWeather($("weather"));
}
