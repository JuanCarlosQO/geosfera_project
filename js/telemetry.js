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
  co2: { name: "Cabin CO₂", unit: "mmHg", group: "cabin" },
  temperature: { name: "Cabin temperature", unit: "°C", group: "cabin" },
  humidity: { name: "Relative humidity", unit: "%", group: "cabin" },
  pressure: { name: "Cabin pressure", unit: "kPa", group: "cabin" },
  dose: { name: "Radiation dose rate", unit: "µGy/h", group: "rad" }
};
const LIMIT_TEXT = {
  heartRate: "Team reference 60–100 bpm",
  bloodPressure: "Team reference: CDC categories",
  still: "App rule: move after 60 min",
  co2: "NASA: no more than 3 mmHg (1-hour average)",
  temperature: "NASA: 18–27 °C · comfort 20–25 °C",
  humidity: "NASA: 25–75 % · comfort 30–60 %",
  pressure: "NASA: 34.5–103 kPa · ISS 101.3 kPa",
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
    <p class="lede">A feed like the one a cabin and a wearable would send. Crew and cabin values are <strong>simulated</strong>; the radiation dose rate is <strong>real NASA data</strong> from the International Space Station, replayed. Every limit comes from NASA.</p>

    <div class="tm-status" data-ref="status" aria-live="polite"></div>

    <div class="tm-controls" role="group" aria-label="Scenario">
      ${Object.entries(T.SCENARIOS).map(([id, s]) => `<button type="button" class="tm-scn" data-scn="${id}" aria-pressed="${id === "nominal"}">${s.label}</button>`).join("")}
      <button type="button" class="tm-pause" data-ref="pause" aria-pressed="false">Pause</button>
    </div>
    <p class="fine" data-ref="note">${T.SCENARIOS.nominal.note}</p>

    <ul class="tm-alerts" data-ref="alerts" aria-live="polite"></ul>

    <h2 class="tm-h">Crew member${member ? ` · ${member.name.replace(/[<>&"]/g, "")}` : ""}</h2>
    <p class="fine">${bands.hr ? `Your usual range (app rule, last ${T.RULES.baselineDays} days, ${bands.hr.n} readings): heart rate ${bands.hr.low}–${bands.hr.high} bpm${bands.sys ? `, top blood pressure ${bands.sys.low}–${bands.sys.high} mmHg` : ""}. Values outside it are flagged even inside the reference range.` : `Log heart rate and blood pressure on ${T.RULES.baselineMin} days and the feed will also compare you with yourself.`}</p>
    <ul class="tm-grid">${["heartRate", "bloodPressure", "still"].map(card).join("")}</ul>

    <h2 class="tm-h">Cabin</h2>
    <ul class="tm-grid">${["co2", "temperature", "humidity", "pressure"].map(card).join("")}</ul>

    <h2 class="tm-h">Radiation</h2>
    <ul class="tm-grid tm-one">${card("dose")}</ul>
    <p class="fine">Replay of NASA OSDR RadLab, ISS DosTel1, ${RADLAB_ISS.from.slice(0, 10)} ${RADLAB_ISS.from.slice(11, 16)}–${RADLAB_ISS.to.slice(11, 16)} UTC, one reading per second. <a href="${RADLAB_ISS.docs}" target="_blank" rel="noopener">RadLab</a>. For scale, NASA reports ISS crews ${src(LIMIT_FACTS.doseIss)}</p>
    <div class="tm-weather" data-ref="weather"><p class="fine">Asking NASA's DONKI service for real space weather…</p></div>

    <p class="fine rule-note">Not a medical device and not real crew data. Simulated values move around NASA's usual cabin values and your own log; the dose-rate replay is real. "Your usual range", the movement reminder and the dose-rate alert are app rules. Sources: docs/SOURCES.md.</p>
  </section>`;

  const root = host.querySelector(".live");
  const $ = (r) => root.querySelector(`[data-ref="${r}"]`);
  let lastAlerts = "";

  function paint() {
    const r = T.readout(state, bands, TYPICAL_DOSE, history);
    history = T.remember(history, r);
    const st = STATUS[r.overall] ?? STATUS.none;
    const sc = T.SCENARIOS[state.scenario];
    $("status").dataset.status = r.overall;
    $("status").innerHTML = `<span class="tm-live-dot" aria-hidden="true"></span><strong class="tone-${st.tone}">${st.shape} ${r.alerts.length ? `${r.alerts.length} ${r.alerts.length === 1 ? "alert" : "alerts"}` : "All channels nominal"}</strong><span>${sc.label} · T+${state.t}s</span>`;
    for (const [k, c] of Object.entries(r.channels)) {
      root.querySelector(`[data-val="${k}"]`).textContent = fmt(k, c);
      const s = STATUS[c.status] ?? STATUS.none;
      root.querySelector(`[data-st="${k}"]`).innerHTML = `<span class="tone-${s.tone}">${s.shape} ${s.word}</span>`;
      root.querySelector(`[data-ch="${k}"]`).dataset.status = c.status;
      root.querySelector(`[data-spark="${k}"]`).setAttribute("d", sparkPath(history[k] ?? [], 120, 32));
    }
    root.querySelector('[data-extra="co2"]').textContent = ` ≈ ${r.channels.co2.ppm} ppm`;
    root.querySelector('[data-extra="dose"]').textContent = r.channels.dose.time ? ` · ISS ${r.channels.dose.time} UTC` : "";
    root.querySelector('[data-tag="dose"]').textContent = r.channels.dose.real ? "REAL NASA DATA" : "REAL × SIMULATED EVENT";
    for (const k of ["heartRate", "bloodPressure"]) {
      const mine = r.channels[k].mine;
      if (mine && mine !== "inside") root.querySelector(`[data-st="${k}"]`).insertAdjacentHTML("beforeend", ` <small>${mine} your usual</small>`);
    }
    const sig = r.alerts.map((a) => `${a.id}:${a.status}`).join(",");
    if (sig !== lastAlerts) { $("alerts").innerHTML = r.alerts.map(alertHtml).join(""); lastAlerts = sig; }
  }

  const timer = setInterval(() => {
    if (!root.isConnected) { clearInterval(timer); return; } // left the screen: stop the feed
    if (paused) return;
    state = T.step(state, rand);
    paint();
  }, T.TICK_MS);

  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-scn]");
    if (b) {
      state = T.changeScenario(state, b.dataset.scn);
      root.querySelectorAll("[data-scn]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      $("note").textContent = T.SCENARIOS[b.dataset.scn].note;
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
