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
import { current } from "./store.js";
import { startFeed, subscribe, toggle, setPaused, TYPICAL_DOSE } from "./feed.js";
import { goToSleep } from "./alarm.js";
import { fold, tabsHtml, showTab } from "./fold.js";
import { tile } from "./icons.js";
import { mountHelix } from "./helix3d.js";
import { versusUsual } from "./helix-core.js";
import { radiationTotals } from "./today-core.js";
import { dateKey } from "./log-core.js";
import { readLog } from "./store.js";
import { RADIATION_LIMITS } from "./data/vital-ranges.js";
import { photoFigure, PHOTO, PHOTO_NOTE } from "./anatomy.js";

const DONKI = "https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR";

const CARDS = {
  heartRate: { name: "Heart rate", unit: "bpm", group: "crew" },
  bloodPressure: { name: "Blood pressure", unit: "mmHg", group: "crew" },
  still: { name: "Time without moving", unit: "min", group: "crew" },
  co2Personal: { name: "CO₂ near you", unit: "mmHg", group: "crew" },
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
  co2Personal: "App rule: NASA's cabin limit, 3 mmHg, near you",
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
const fmt = (k, c) => (c.value == null ? "—" : k === "bloodPressure" ? `${c.value[0]}/${c.value[1]}` : String(c.value));

/* ---------- the wearables on the body, and their link to this tablet ---------- */

// The body picture fills 72 % of the stage's width, 14 % in from the left. Each sensor's place
// is given in % of the picture (x from its left, y from its top) and turned into stage %.
const FIG = { left: 14, width: 72 };
const STAGE_RATIO = 1.22;                               // stage height / width
const px = (x) => FIG.left + (x / 100) * FIG.width;
const py = (y) => (y / 100) * ((FIG.width * (PHOTO.h / PHOTO.w)) / STAGE_RATIO);
const ON_BODY = { chest: [54.5, 24], cuff: [31.8, 29.5], wrist: [80.9, 45.6], clip: [55.5, 18.2] };
const HUB = [50, 95];                                   // where the tablet sits on the stage, in %
const LABELS = { chest: { side: "left", top: 2 }, cuff: { side: "left", top: 60 }, wrist: { side: "right", top: 60 }, clip: { side: "right", top: 2 } };
const LINK_WORDS = { ok: "Linked", off: "Sensor off", lost: "Link lost" };

function sensorsHtml() {
  const list = Object.keys(T.SENSORS).map((id) => [id, T.SENSORS[id], px(ON_BODY[id][0]), py(ON_BODY[id][1])]);
  const flows = list.map(([id, , x, y]) => `<path data-sn-line="${id}" d="M${x.toFixed(1)} ${y.toFixed(1)} Q${((x + HUB[0]) / 2 + (x < 50 ? -10 : 10)).toFixed(1)} ${((y + HUB[1]) / 2 + 12).toFixed(1)} ${HUB[0]} ${HUB[1] - 4}"/>`).join("");
  const leads = list.map(([id, , x, y]) => { const l = LABELS[id]; return `<line class="sn-lead" x1="${l.side === "left" ? 29 : 71}" y1="${l.top + 7}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join("");
  return `<div class="sn-stage" role="group" aria-label="Wearable sensors on the body and their link to this tablet">
    <span class="tm-tag sn-sim">SIMULATED</span>
    <div class="sn-fig" aria-hidden="true">${photoFigure()}</div>
    <svg class="sn-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${leads}${flows}</svg>
    ${list.map(([id, , x, y]) => `<span class="sn-dot" data-sn-dot="${id}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%" aria-hidden="true"></span>`).join("")}
    ${list.map(([id, sn]) => `<div class="sn-label" data-sn="${id}" data-side="${LABELS[id].side}" style="top:${LABELS[id].top}%"><strong>${sn.name}</strong><span data-sn-val="${id}">—</span><small data-sn-link="${id}"></small></div>`).join("")}
    <div class="sn-hub" style="left:${HUB[0]}%;top:${HUB[1]}%"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M10 18h4"/></svg><span><strong>This tablet</strong><small data-ref="hub" aria-live="polite"></small></span></div>
  </div>
  <p class="fine sn-ai">${PHOTO_NOTE}</p>
  <ol class="sn-chain" aria-label="Where the data goes"><li>Body sensors</li><li>This tablet<small>judges on board</small></li><li>Station computer</li><li>Mission Control<small>up to 20 min away</small></li></ol>`;
}

const realHtml = () => `<p>On the International Space Station the same chain exists today:</p>
  <ul class="sn-real">
    <li><strong>Worn on the body.</strong> Canada's Bio-Monitor: “${LIMIT_FACTS.wearParts.quote}”. Among what it measures: “${LIMIT_FACTS.wearHeart.quote}”. ${link(LIMIT_FACTS.wearParts)}</li>
    <li><strong>To the station, then to Earth.</strong> “${LIMIT_FACTS.wearBase.quote}”, which sends the data down through the station's communications. ${link(LIMIT_FACTS.wearBase)}</li>
    <li><strong>Paired with a tablet.</strong> NASA's clip-on CO₂ monitor: “${LIMIT_FACTS.wearPaired.quote}”. “${LIMIT_FACTS.wearUpload.quote}” ${link(LIMIT_FACTS.wearPaired)}</li>
    <li><strong>On a spacewalk.</strong> “${LIMIT_FACTS.suitSensors.quote}” “${LIMIT_FACTS.suitData.quote}” ${link(LIMIT_FACTS.suitSensors)}</li>
  </ul>
  <p class="fine">In this prototype the sensors are simulated and nothing is paired. The pages quoted here say “paired” and “tablet application” but do not name the radio; a short-range link such as Bluetooth Low Energy is the usual choice for wearables, and that detail is pending a source. On a mission far from Earth the first three steps stay on board, so the tablet has to judge by itself: the answer from Earth can take 20 minutes each way.</p>`;

function card(k) {
  const c = CARDS[k];
  return `<li class="tm-card" data-ch="${k}">
    <div class="tm-top"><span class="tm-name">${tile(k)}${c.name}</span><span class="tm-tag" data-tag="${k}">${k === "dose" ? "REAL NASA DATA" : "SIMULATED"}</span></div>
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
    ${r.illustrative ? `<p class="tm-ill"><span class="tm-tag">APP RULE</span> Illustrative, not a NASA procedure.</p>` : ""}
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

export function mountLive(host, openTab) {
  const member = current();
  const { bands } = startFeed(); // the feed is shared: it keeps running, and alerting, after leaving this screen
  const rad = member ? radiationTotals(readLog(member.id), dateKey()) : { total: 0, days: 0 };

  const crewTab = `<h2 class="tm-h">Crew member${member ? ` · ${member.name.replace(/[<>&"]/g, "")}` : ""}</h2>
    ${sensorsHtml()}
    ${fold("How real sensors connect", realHtml(), { cls: "block" })}
    <ul class="tm-grid">${["heartRate", "bloodPressure", "still", "hydration", "co2Personal"].map(card).join("")}</ul>
    ${fold("Your usual range", `<p class="fine">${bands.hr ? `App rule, last ${T.RULES.baselineDays} days, ${bands.hr.n} readings: heart rate ${bands.hr.low}–${bands.hr.high} bpm${bands.sys ? `, top blood pressure ${bands.sys.low}–${bands.sys.high} mmHg` : ""}. Values outside it are flagged even inside the reference range.` : `Log heart rate and blood pressure on ${T.RULES.baselineMin} days and the feed will also compare you with yourself.`}</p>`)}`;

  const cabinTab = `<h2 class="tm-h">Cabin</h2>
    <ul class="tm-grid">${["co2", "temperature", "humidity", "pressure", "smoke", "ammonia", "power"].map(card).join("")}</ul>`;

  const radTab = `<h2 class="tm-h">Radiation</h2>
    <ul class="tm-grid tm-one">${card("dose")}</ul>
    <div class="tm-weather" data-ref="weather"><p class="fine">Asking NASA's DONKI service for real space weather…</p></div>
    <section class="dna-card" aria-labelledby="dna-h">
      <h3 class="tm-h3" id="dna-h">Radiation and your DNA</h3>
      <div class="dna-stage">
        <canvas class="dna-canvas" data-ref="dna" role="img" aria-label="3D illustration of a DNA double helix turning. Streaks cross it more often when the dose rate rises, and the rung they cross flashes."></canvas>
        <p class="brain-tag mono">Illustration · not your DNA</p>
        <p class="dna-rate" data-ref="dna-rate" aria-live="off"></p>
      </div>
      <ol class="dna-steps">
        <li><strong>A particle crosses a cell</strong><span>and can break or knock out pieces of its DNA.</span></li>
        <li><strong>The cell tries to repair it</strong><span>sometimes it works, sometimes it does not.</span></li>
        <li><strong>A bad repair can become a mutation</strong><span>and mutations that add up over time can lead to cancer.</span></li>
      </ol>
      <p class="dna-you">${rad.days ? `Your dosimeter log: <strong>${rad.total} mSv</strong> in ${rad.days} ${rad.days === 1 ? "day" : "days"}, ${((rad.total / RADIATION_LIMITS.careerMSv) * 100).toFixed(1)} % of NASA's ${RADIATION_LIMITS.careerMSv} mSv career limit.` : "No dosimeter reading logged yet."} <a href="#log">Log today's</a></p>
      ${fold("NASA's words", `<ul class="dna-quotes">
          <li>“${LIMIT_FACTS.dnaDamage.quote}”</li>
          <li>“${LIMIT_FACTS.dnaBases.quote}”</li>
          <li>“${LIMIT_FACTS.dnaRepair.quote}”</li>
          <li>“${LIMIT_FACTS.dnaCancer.quote}”</li>
        </ul>
        <p class="fine">All four: ${link(LIMIT_FACTS.dnaDamage)}, quoting a biologist of NASA's Space Radiation Laboratory.</p>`)}
      ${fold("What this picture is not", `<p class="fine">It is not a measurement. Nothing in Ergosphere measures DNA, and it shows no number for DNA damage: NASA's own scientists say “${LIMIT_FACTS.dnaHard.quote}”. The streaks follow the dose rate above (more radiation, more streaks); they are not counted particles, and a flash is not damage found in you. The only real numbers here are the dose rate and your dosimeter log.</p>`)}
    </section>
    ${fold("Where this data comes from", `<p class="fine">Replay of NASA OSDR RadLab, ISS DosTel1, ${RADLAB_ISS.from.slice(0, 10)} ${RADLAB_ISS.from.slice(11, 16)}–${RADLAB_ISS.to.slice(11, 16)} UTC, one reading per second. <a href="${RADLAB_ISS.docs}" target="_blank" rel="noopener">RadLab</a>. For scale, NASA reports ISS crews “${LIMIT_FACTS.doseIss.quote}” ${link(LIMIT_FACTS.doseIss)}</p>`)}
    ${fold("Space radiation: where it comes from", `<div class="tm-info"><div class="tm-kinds">
        <div><p class="mono">ALWAYS THERE</p><h3>Galactic cosmic rays</h3><p>High-energy protons and heavy ions from outside the solar system. The dose-rate replay above is mostly this, plus the particles trapped in Earth's magnetic field.</p></div>
        <div><p class="mono">IN BURSTS</p><h3>Solar particle events</h3><p>Particles shot out by the Sun during a flare. The “Solar particle event” button simulates one; the real flare list above comes from NASA.</p></div>
      </div>
      ${fact("radKinds")}${fact("radSolar")}</div>`, { cls: "block" })}
    ${fold("During a solar particle event: take shelter", `<div class="tm-info">
      <p>NASA's plan for Orion uses what is already on board as shielding: the crew will ${factInline("shelter")}. Those bags hold the mission's own cargo: ${factInline("shelterBags")}.</p>
      ${fact("shelterTime")}${fact("shelterWhy")}
      <p class="fine">This is NASA's 2016 plan for the Orion spacecraft, not an ISS procedure. On any vehicle the crew follows its own flight rules.</p></div>`, { cls: "block" })}`;

  const rulesTab = `<section class="tm-info tm-rules" aria-labelledby="tm-cond-h">
      <h2 class="tm-h" id="tm-cond-h">Exactly when an alert fires</h2>
      <div class="tm-table" role="table" aria-label="Alert conditions">
        <div class="tm-tr tm-th" role="row"><span role="columnheader">Channel</span><span role="columnheader">${STATUS.watch.shape} Watch when</span><span role="columnheader">${STATUS.act.shape} Act now when</span><span role="columnheader">Based on</span></div>
        ${T.conditions(TYPICAL_DOSE).map((c) => `<div class="tm-tr" role="row"><span role="cell"><strong>${c.name ?? CARDS[c.key].name}</strong></span><span role="cell">${c.watch ?? "—"}</span><span role="cell">${c.act ?? "—"}</span><span role="cell">${BASIS[c.basis]}${[...new Map(c.facts.map((f) => [LIMIT_FACTS[f].source, LIMIT_FACTS[f]])).values()].map((f) => ` <a href="${f.url}" target="_blank" rel="noopener">${f.source}</a>`).join(",")}</span></div>`).join("")}
      </div>
      ${fold("How readings are averaged", `<p class="fine">NASA's CO₂ limit is a 1-hour average. The simulator compares the current value so the demo reacts in seconds; a real detector would average over the hour. Crew vital signs are judged on a ${T.RULES.smoothSeconds}-second average so one noisy reading raises nothing. An alert is raised after ${T.RULES.raiseAfter} readings in a row and cleared after ${T.RULES.clearAfter} back to normal.</p>`)}
    </section>`;

  host.innerHTML = `
  <section class="live" aria-labelledby="lv-title">
    <p class="eyebrow">Module 10 · Live telemetry</p>
    <h1 id="lv-title" tabindex="-1">Sensors, second by second</h1>
    <p class="lede">A feed like the one a cabin and a wearable would send. Crew and cabin values are <strong>simulated</strong>; the radiation dose rate is <strong>real NASA data</strong> from the International Space Station, replayed. Limits come from NASA wherever NASA publishes one; the rest are marked as app rules.</p>

    <div class="tm-status" data-ref="status" aria-live="polite"></div>

    <p class="fine tm-how">Simulate: tap one or several. Tap again to stop.</p>
    ${[["cabin", "Cabin"], ["crew", "Crew member"], ["sensor", "Sensors"]].map(([g, label]) => `<span class="tm-glabel mono">${label}</span><div class="tm-controls scroll-row" role="group" aria-label="${label} simulations">
      ${Object.entries(T.SCENARIOS).filter(([, x]) => x.group === g).map(([id, x]) => `<button type="button" class="tm-scn" data-scn="${id}" data-group="${g}" aria-pressed="false">${x.label}</button>`).join("")}</div>`).join("")}
    <div class="tm-controls"><button type="button" class="tm-scn tm-reset" data-scn="nominal">${T.SCENARIOS.nominal.label}</button>
      <button type="button" class="tm-scn tm-sleep" data-ref="sleep">☾ Sleep mode</button>
      <button type="button" class="tm-pause" data-ref="pause" aria-pressed="false">Pause</button></div>
    <p class="fine" data-ref="note">${T.SCENARIOS.nominal.note}</p>

    <ul class="tm-alerts" data-ref="alerts" aria-live="polite"></ul>
    <details class="tm-log"><summary>Event log · <span data-ref="logn">0</span></summary><ol data-ref="log"></ol>
      <p class="fine">The feed keeps running on the other screens: an alert shows across the top of any of them, and sounds.</p></details>

    ${tabsHtml("live", [
      { id: "crew", label: "Crew", html: crewTab },
      { id: "cabin", label: "Cabin", html: cabinTab },
      { id: "rad", label: "Radiation", html: radTab },
      { id: "rules", label: "Alert rules", html: rulesTab }
    ])}

    <p class="fine rule-note">Not a medical device and not real crew data. Simulated values move around NASA's usual cabin values and your own log; the dose-rate replay is real. The simulator engine (scenarios that combine, effort and recovery, steady alerts) comes from a prototype by a team member; its thresholds for smoke, ammonia, power, hydration, effort heart rate and the leak rate are illustrative app rules, not NASA procedures: on a real vehicle the crew follows its own emergency procedures. "Your usual range", the movement reminder and the dose-rate alert are app rules. The four wearables (chest band, arm cuff, wrist unit, CO₂ clip), their batteries and their link are simulated; where they sit on the figure is an illustration, and the body picture itself was generated with AI. The DNA helix is an illustration: nothing measures DNA. Sleep mode, the CO₂ pocket alert, the wake alarm and its sounds are app rules; a web page cannot sound with the phone locked, so sleep mode needs this app open. Sources: docs/SOURCES.md.</p>
  </section>`;

  const root = host.querySelector(".live");
  const $ = (r) => root.querySelector(`[data-ref="${r}"]`);
  let lastAlerts = null;
  let lastLog = null;
  const MODES = { rest: "At rest", exercise: "Exercising", eva: "On a spacewalk", recovery: "Recovering from effort", sleep: "Asleep", waking: "Just woken" };
  const clock = (t) => `T+${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

  function paint(feed) {
    const { state, readout: r, history, steady, events } = feed;
    const logSig = events.map((ev) => `${ev.t}${ev.id}${ev.type}`).join(",");
    if (logSig !== lastLog) {
      lastLog = logSig;
      $("logn").textContent = events.length;
      $("log").innerHTML = events.map((ev) => `<li><span class="mono">${clock(ev.t)}</span> <span class="tone-${ev.type === "resolved" ? STATUS.normal.tone : STATUS[ev.status].tone}">${ev.type === "resolved" ? `${STATUS.normal.shape} Resolved` : `${STATUS[ev.status].shape} ${STATUS[ev.status].word}`}</span> ${RESPONSES[ev.id].title}</li>`).join("");
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
    const near = r.channels.co2Personal;
    root.querySelector('[data-extra="co2"]').textContent = ` ≈ ${r.channels.co2.ppm} ppm`;
    root.querySelector('[data-extra="co2Personal"]').textContent = near.value == null ? "" : ` · ${near.gap > 0 ? "+" : ""}${near.gap} vs the cabin`;
    root.querySelector('[data-extra="still"]').textContent = r.channels.still.asleep ? " · asleep, not counted" : "";
    root.querySelector('[data-extra="pressure"]').textContent = Math.abs(r.channels.pressure.rate) >= 0.5 ? ` · ${r.channels.pressure.rate > 0 ? "+" : ""}${r.channels.pressure.rate} kPa/min` : "";
    root.querySelector('[data-extra="heartRate"]').textContent = r.mode === "exercise" || r.mode === "eva" ? ` · effort, max ≈ ${T.maxHeartRate()}` : r.mode === "recovery" ? " · recovering" : r.mode === "sleep" ? " · asleep" : r.mode === "waking" ? " · just woken" : "";
    root.querySelector('[data-extra="dose"]').textContent = r.channels.dose.time ? ` · ISS ${r.channels.dose.time} UTC` : "";
    root.querySelector('[data-tag="dose"]').textContent = r.channels.dose.real ? "REAL NASA DATA" : "REAL × SIMULATED EVENT";
    const dose = r.channels.dose;
    helix.set({ rate: dose.value, usual: TYPICAL_DOSE });
    $("dna-rate").textContent = dose.value == null ? "" : `${dose.value} µGy/h · ${versusUsual(dose.value, TYPICAL_DOSE)}${dose.real ? "" : " · simulated solar event"}`;
    let linked = 0;
    for (const [id, sn] of Object.entries(r.sensors)) {
      const c = r.channels[sn.feeds];
      if (sn.link === "ok") linked += 1;
      const tone = sn.link === "ok" && (c.status === "act" || c.status === "watch") ? c.status : "";
      for (const el of root.querySelectorAll(`[data-sn="${id}"], [data-sn-dot="${id}"], [data-sn-line="${id}"]`)) { el.dataset.link = sn.link; el.dataset.low = String(sn.low && sn.link === "ok"); el.dataset.tone = tone; }
      root.querySelector(`[data-sn-val="${id}"]`).innerHTML = c.value == null ? "No data" : `${fmt(sn.feeds, c)} <i>${CARDS[sn.feeds].unit}</i>`;
      root.querySelector(`[data-sn-link="${id}"]`).textContent = sn.link === "ok" ? `${LINK_WORDS.ok} · bat. ${sn.battery} %` : sn.link === "lost" ? `${LINK_WORDS.lost} · ${r.silent} s` : sn.battery <= 0 ? "Off · battery empty" : "Off · no skin contact";
    }
    $("hub").textContent = `${linked} of ${Object.keys(r.sensors).length} sensors linked`;
    for (const k of ["heartRate", "bloodPressure", "still", "co2Personal"]) root.querySelector(`[data-ch="${k}"]`).dataset.nodata = String(r.channels[k].value == null);
    for (const k of ["heartRate", "bloodPressure"]) {
      const mine = r.channels[k].mine;
      if (mine && mine !== "inside") root.querySelector(`[data-st="${k}"]`).insertAdjacentHTML("beforeend", ` <small>${mine} your usual</small>`);
    }
    root.querySelectorAll("[data-scn][data-group]").forEach((b) => {
      const c = state.active[b.dataset.scn];
      b.setAttribute("aria-pressed", String(Boolean(c) && c.phase !== "rec"));
      b.classList.toggle("rec", c?.phase === "rec");
    });
    $("pause").setAttribute("aria-pressed", String(feed.paused));
    $("pause").textContent = feed.paused ? "Resume" : "Pause";
    $("note").textContent = active.length ? active.map((id) => T.SCENARIOS[id].note).join(" ") : T.SCENARIOS.nominal.note;
    const sig = steady.map((a) => `${a.id}:${a.status}`).join(",");
    if (sig !== lastAlerts) { $("alerts").innerHTML = steady.map(alertHtml).join(""); lastAlerts = sig; }
  }

  const helix = mountHelix($("dna"));
  const stop = subscribe((feed) => {
    if (!root.isConnected) { stop(); helix.stop(); return; } // left the screen: stop painting; the feed itself carries on
    paint(feed);
  }, { screen: true });

  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-scn]");
    if (b) { toggle(b.dataset.scn); return; }
    if (e.target.closest('[data-ref="sleep"]')) { goToSleep(); return; }
    if (e.target.closest('[data-ref="pause"]')) setPaused($("pause").getAttribute("aria-pressed") !== "true");
  });

  paint(startFeed());
  if (openTab) showTab(host, "live", openTab); // #live/rad opens straight on a tab
  spaceWeather($("weather"));
}
