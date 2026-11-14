// Main dashboard — the Cupola. Six windows around today's summary; each window opens its
// body system in the hologram. Readings come from the daily log (module 3); until then
// every window says "No data".

import { WINDOWS, summarise, headline, missionDay, cupolaGeometry } from "./today-core.js";
import { STATUS } from "./data/body-systems.js";
import { judgeReading, LOG_KEY as LOG_STORE } from "./log-core.js";

const MISSION_KEY = "geosfera.mission";
const LOG_KEY = LOG_STORE;

function missionStart() {
  try {
    const saved = JSON.parse(localStorage.getItem(MISSION_KEY));
    if (saved?.start) return saved.start;
    const d = new Date();
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    localStorage.setItem(MISSION_KEY, JSON.stringify({ start }));
    return start;
  } catch {
    return null;
  }
}

/** Today's readings from the daily log, once module 3 writes them. */
function todaysReadings() {
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY)) ?? {};
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return log[key] ?? {};
  } catch {
    return {};
  }
}

const UNITS = { heartRate: "bpm", bloodOxygen: "%", glucose: "mg/dL", radiationDose: "mSv", temperature: "°C", sleepHours: "h sleep", mood: "/5" };

function mainValue(win, readings) {
  const key = win.readings.find((k) => readings[k] != null);
  if (!key) return { value: "—", unit: "" };
  const v = readings[key].value;
  if (key === "bloodPressure") return { value: `${v[0]}/${v[1]}`, unit: "" };
  return { value: String(v), unit: UNITS[key] ?? "" };
}

const poly = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

export function mountToday(host, { go }) {
  const readings = todaysReadings();
  const summary = summarise(readings, judgeReading);
  const head = headline(summary);
  const geo = cupolaGeometry();
  const start = missionStart();
  const day = start ? missionDay(start) : null;

  const glass = geo.map((g) => {
    const st = summary.status[g.id];
    const ring = { watch: "var(--tone-watch)", act: "var(--tone-act)", again: "var(--tone-again)" }[st] ?? "#4b5664";
    return `<polygon points="${poly(g.points)}" class="pane" style="stroke:${ring}"/>
      ${st === "watch" ? `<polygon points="${poly(g.points)}" fill="url(#hatch)"/>` : ""}`;
  }).join("");

  const labels = geo.map((g) => {
    const win = WINDOWS.find((w) => w.id === g.id);
    const st = STATUS[summary.status[g.id]];
    const v = mainValue(win, readings);
    return `<button type="button" class="pane-label" data-body="${win.body}"
        style="left:${(g.centre[0] / 390) * 100}%;top:${(g.centre[1] / 360) * 100}%"
        aria-label="${win.label}: ${st.word}. Open in the body hologram">
      <span class="pl-name">${win.label.toUpperCase()}</span>
      <span class="pl-value">${v.value}${v.unit ? `<small> ${v.unit}</small>` : ""}</span>
      <span class="pl-status tone-${st.tone}"><span aria-hidden="true">${st.shape}</span> ${st.word}</span>
    </button>`;
  }).join("");

  host.innerHTML = `
  <section class="today" aria-labelledby="today-title">
    <h1 id="today-title" tabindex="-1">${head.title}</h1>
    <p class="today-line">${head.line}</p>

    <div class="cupola">
      <svg viewBox="0 0 390 360" role="img" aria-label="Cupola: six body-system windows around today's summary">
        <defs>
          <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#0b1626"/><stop offset=".7" stop-color="#0f2a4d"/><stop offset="1" stop-color="#1b4f8f"/>
          </linearGradient>
          <radialGradient id="earth-c" cx=".5" cy="1.25" r="1">
            <stop offset=".45" stop-color="#2f7be0"/><stop offset=".6" stop-color="#0f3a78"/><stop offset=".8" stop-color="#071628"/>
          </radialGradient>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#ff9f5a" stroke-width="1.4" opacity=".35"/>
          </pattern>
        </defs>
        <polygon points="102,19 288,19 381,180 288,341 102,341 9,180" class="frame"/>
        ${glass}
        <polygon points="161,121 229,121 263,180 229,239 161,239 127,180" class="hub"/>
        <circle cx="195" cy="180" r="56" fill="url(#earth-c)" stroke="var(--beacon)" stroke-width="1.5"/>
        <circle cx="195" cy="180" r="62" class="hub-ring"/>
        <g class="rivets"><circle cx="102" cy="19" r="2.5"/><circle cx="288" cy="19" r="2.5"/><circle cx="381" cy="180" r="2.5"/><circle cx="288" cy="341" r="2.5"/><circle cx="102" cy="341" r="2.5"/><circle cx="9" cy="180" r="2.5"/></g>
      </svg>
      ${labels}
      <div class="hub-label" aria-hidden="true">
        <span class="hub-num"><span data-count="${summary.measured}">0</span><small>/${summary.total}</small></span>
        <span class="hub-word">MEASURED</span>
      </div>
    </div>

    <a class="cta-wide" href="#log">${summary.measured ? "Continue today's check-in" : "Start today's check-in"}</a>

    <div class="mission-card">
      <div class="mc-row"><span class="eyebrow">Mission</span><span>${day ? `Day ${day}` : "Day —"}</span></div>
      <p class="fine">Counted from your first day on Geosfera. Tap a window to see that body system and NASA's risks for it.</p>
    </div>
  </section>`;

  host.querySelector(".cupola").addEventListener("click", (e) => {
    const b = e.target.closest(".pane-label");
    if (b) go(`body/${b.dataset.body}`);
  });

  const el = host.querySelector("[data-count]");
  const target = Number(el.dataset.count);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || target === 0) el.textContent = String(target);
  else {
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / 800);
      el.textContent = String(Math.round(target * t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
