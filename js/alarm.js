// Alerts that cannot be missed. Listens to the telemetry feed (feed.js) on every screen:
//  - a bar across the top names the most serious alert and links to what to do;
//  - an "Act now" alert pulses red round the edge of the screen and sounds, again and again,
//    until it clears or the crew member silences it; a "Watch" alert chimes once;
//  - sleep mode: a dim bedside screen that keeps the display on. While asleep, any "Act now"
//    alert becomes a wake alarm (louder, full screen, "I'm awake"); if nobody answers in
//    RULES.wakeEscalate seconds the crew is alerted through the same channel as an SOS.
// Sounds are made in the browser (Web Audio), no files. A web page cannot sound with the
// phone locked or the app closed: sleep mode works with this screen open, and says so.
// Everything shown here comes from the SIMULATED feed; the screens label it.

import * as T from "./telemetry-core.js";
import { subscribe, startFeed, snapshot, setSleeping, toggle } from "./feed.js";
import { RESPONSES } from "./data/telemetry.js";
import { STATUS } from "./data/body-systems.js";
import { sendAlert } from "./support.js";

const SOUND_KEY = "geosfera.sound";
const REPEAT_MS = { act: 3000, wake: 1900 };
const PATTERNS = {
  watch: { type: "sine", vol: 0.16, notes: [[660, 0, 0.18], [880, 0.2, 0.28]] },
  note: { type: "sine", vol: 0.14, notes: [[523, 0, 0.22], [659, 0.18, 0.22], [784, 0.36, 0.42]] }, // a message from home
  act: { type: "square", vol: 0.2, notes: [[880, 0, 0.2], [660, 0.24, 0.2], [880, 0.48, 0.2], [660, 0.72, 0.2]] },
  wake: { type: "sawtooth", vol: 0.3, notes: [[990, 0, 0.26], [740, 0.3, 0.26], [990, 0.6, 0.26], [740, 0.9, 0.26], [1180, 1.2, 0.4]] }
};

let ctx = null;
const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; } };
const setSound = (on) => { try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch { /* storage blocked */ } };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Browsers only allow sound after a tap: the first touch anywhere readies it. */
function unlock() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch { /* no audio on this device */ }
}

/** Plays one pattern now. Returns false when sound is off or the browser has not allowed it yet. */
export function sound(kind) {
  if (!soundOn()) return false;
  try { navigator.vibrate?.(kind === "watch" || kind === "note" ? 120 : [300, 140, 300, 140, 300]); } catch { /* no vibration */ }
  if (!ctx || ctx.state !== "running") return false;
  const p = PATTERNS[kind];
  for (const [freq, at, dur] of p.notes) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at;
    o.type = p.type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(p.vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  return true;
}

let openSleepScreen = () => {};
/** Opens sleep mode (the bedside screen). */
export const goToSleep = () => openSleepScreen();

export function mountAlarm() {
  const bar = Object.assign(document.createElement("div"), { className: "al-bar", hidden: true });
  bar.setAttribute("role", "alert");
  const bed = Object.assign(document.createElement("div"), { className: "al-sleep", hidden: true });
  bed.setAttribute("role", "dialog");
  bed.setAttribute("aria-label", "Sleep mode");
  document.body.append(bar, bed);
  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("keydown", unlock, true);

  let silenced = "";      // the "Act now" alerts the crew member silenced, as "id,id"
  let barSig = "";
  let lastSound = 0;
  let wakeSince = 0;      // when the wake alarm started (0 = no wake alarm)
  let escalated = false;
  let lock = null;        // screen wake lock while asleep

  const acts = (f) => f.steady.filter((a) => a.status === "act");
  const asleep = (f) => Boolean(f?.state.sleeping);

  async function keepScreenOn(on) {
    try {
      if (on && !lock && navigator.wakeLock) { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); }
      if (!on && lock) { await lock.release(); lock = null; }
    } catch { lock = null; }
  }

  function paintBar(f) {
    const top = acts(f)[0] ?? f.steady[0];
    document.body.classList.toggle("al-on", Boolean(top));
    document.body.classList.toggle("al-act", Boolean(top) && top.status === "act");
    if (!top) { bar.hidden = true; barSig = ""; return; }
    const quiet = acts(f).map((a) => a.id).join(",") === silenced || !acts(f).length;
    const sig = `${f.steady.map((a) => `${a.id}:${a.status}`).join(",")}|${quiet}|${soundOn()}`;
    if (sig === barSig) return;
    barSig = sig;
    const st = STATUS[top.status];
    const more = f.steady.length - 1;
    bar.hidden = false;
    bar.dataset.level = top.status;
    bar.innerHTML = `<span class="al-icon" aria-hidden="true">${top.status === "act" ? "!" : st.shape}</span>
      <a class="al-text" href="#live" data-al="open"><strong>${st.word}</strong><span>${esc(RESPONSES[top.id].title)}${more > 0 ? ` <small>+${more} more</small>` : ""}</span><small class="al-go">What to do →</small></a>
      ${top.status === "act" && !quiet && soundOn() ? `<button type="button" class="al-btn" data-al="silence">Silence</button>` : `<button type="button" class="al-btn al-ghost" data-al="sound" aria-pressed="${soundOn()}">${soundOn() ? "Sound on" : "Sound off"}</button>`}`;
  }

  function paintBed(f) {
    const on = asleep(f);
    if (on === bed.hidden) { bed.hidden = !on; document.body.classList.toggle("al-sleeping", on); keepScreenOn(on); if (!on) { wakeSince = 0; escalated = false; bed.dataset.mode = ""; } }
    if (!on) return;
    const r = f.readout, c = r.channels;
    const wake = acts(f);
    const waking = wake.length > 0;
    if (waking && !wakeSince) { wakeSince = Date.now(); escalated = false; }
    if (!waking) wakeSince = 0;
    const waited = wakeSince ? Math.floor((Date.now() - wakeSince) / 1000) : 0;
    if (waking && !escalated && waited >= T.RULES.wakeEscalate) {
      escalated = true;
      sendAlert("emergency", { note: `Automatic: no answer to the wake alarm (${RESPONSES[wake[0].id].title}).` });
    }
    // The screen is built once per mode and only its numbers change, so a tap is never lost to a redraw.
    const mode = waking ? `wake:${wake[0].id}` : "night";
    if (bed.dataset.mode !== mode) {
      bed.dataset.mode = mode;
      bed.dataset.wake = String(waking);
      const top = waking && RESPONSES[wake[0].id];
      bed.innerHTML = waking ? `
      <div class="al-wake">
        <p class="al-wake-big">WAKE UP</p>
        <p class="al-wake-title">${STATUS.act.shape} ${esc(top.title)}</p>
        <ol>${top.steps.slice(0, 2).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
        <button type="button" class="al-awake" data-al="awake">I'm awake</button>
        <p class="al-fine" data-bed="count"></p>
        <p class="al-fine"><span class="tm-tag">SIMULATED</span> App rule, illustrative.</p>
      </div>` : `
      <div class="al-night">
        <p class="al-moon" aria-hidden="true">☾</p>
        <p class="al-clock"><span data-bed="clock"></span><small> UTC</small></p>
        <p class="al-state">Sleep mode · watching while you sleep</p>
        <ul class="al-rows" data-bed="rows"></ul>
        <p class="al-fine"><span data-bed="linked"></span> · <span class="tm-tag">SIMULATED</span></p>
        <button type="button" class="al-awake al-soft" data-al="awake">I'm awake · end sleep mode</button>
        <button type="button" class="al-demo" data-al="pocket" aria-pressed="false">Simulate: a CO₂ pocket forms</button>
        <p class="al-fine">Any “Act now” alert sounds a wake alarm. Keep this screen open and the sound up: a web page cannot sound with the phone locked.${navigator.wakeLock ? " The screen stays on." : ""}</p>
      </div>`;
    }
    const set = (k, html) => { const el = bed.querySelector(`[data-bed="${k}"]`); if (el && el.innerHTML !== html) el.innerHTML = html; };
    if (waking) {
      set("count", escalated ? "No answer: your crew has been alerted." : `No answer in ${Math.max(0, T.RULES.wakeEscalate - waited)} s and your crew is alerted.`);
      return;
    }
    const now = new Date();
    const row = (label, ch, unit) => { const st = STATUS[ch.status] ?? STATUS.none; return `<li><span>${label}</span><strong>${ch.value ?? "—"} <small>${unit}</small></strong><span class="tone-${st.tone}">${st.shape} ${ch.value == null ? "No data" : st.word}</span></li>`; };
    set("clock", `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`);
    set("rows", row("CO₂ near you", c.co2Personal, "mmHg") + row("Cabin CO₂", c.co2, "mmHg") + row("Heart rate", c.heartRate, "bpm"));
    set("linked", `${Object.values(r.sensors).filter((x) => x.link === "ok").length} of ${Object.keys(r.sensors).length} sensors linked`);
    bed.querySelector('[data-al="pocket"]').setAttribute("aria-pressed", String(Boolean(f.state.active.pocket)));
  }

  function soundLoop(f, raised) {
    const wake = asleep(f) && acts(f).length > 0;
    const ids = acts(f).map((a) => a.id).join(",");
    if (!ids) silenced = "";
    for (const ev of raised) {
      if (ev.type !== "raised") continue;
      if (ev.status === "act") { silenced = ""; lastSound = 0; }      // a new serious alert is never born silent
      else if (!acts(f).length) sound("watch");
    }
    const kind = wake ? "wake" : ids && ids !== silenced ? "act" : null;
    if (kind && Date.now() - lastSound >= REPEAT_MS[kind]) { lastSound = Date.now(); sound(kind); }
  }

  subscribe((f, raised) => { soundLoop(f, raised); paintBar(f); paintBed(f); });

  bar.addEventListener("click", (e) => {
    const f = snapshot();
    if (e.target.closest('[data-al="silence"]')) { silenced = acts(f).map((a) => a.id).join(","); barSig = ""; paintBar(f); return; }
    if (e.target.closest('[data-al="sound"]')) { setSound(!soundOn()); unlock(); barSig = ""; paintBar(f); return; }
    if (e.target.closest('[data-al="open"]') && location.hash.startsWith("#live")) { e.preventDefault(); document.querySelector(".tm-alerts")?.scrollIntoView({ block: "center" }); }
  });
  bed.addEventListener("click", (e) => {
    if (e.target.closest('[data-al="awake"]')) { silenced = acts(snapshot()).map((a) => a.id).join(","); setSleeping(false); return; }
    if (e.target.closest('[data-al="pocket"]')) toggle("pocket");
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && asleep(snapshot())) keepScreenOn(true); });

  openSleepScreen = () => { unlock(); startFeed(); setSleeping(true); };
}
