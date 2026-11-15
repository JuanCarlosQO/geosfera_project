// Devices — where the readings come from, so the crew member does not type them.
//  · Actiwatch (the actigraphy watch NASA uses on the station): sleep, waking, awakenings and
//    when the watch was off. It has no Bluetooth: the app reads the file Philips' Actiware
//    software exports, or a simulated download for the demo.
//  · Bluetooth health sensors (standard Bluetooth SIG profiles): heart rate, blood pressure,
//    temperature, blood oxygen, read live by Web Bluetooth (Chrome on Android or a computer).
//  · The live sensors of the Live screen (simulated): heart rate and blood pressure.
// autoSync() runs whenever Today, the check-in or this screen opens. Rules: devices-core.js.

import * as D from "./devices-core.js";
import { current, readLog, writeLog } from "./store.js";
import { dateKey } from "./log-core.js";
import { snapshot, startFeed, toggle } from "./feed.js";
import * as F from "./family-core.js";
import { fold } from "./fold.js";
import { LIMIT_FACTS } from "./data/telemetry.js";
import { DEVICE_FACTS } from "./data/devices.js";

export const WATCH_KEY = "geosfera.watch"; // { [memberId]: { mode, events, lastSync, file } }
export const ACTIGRAPH_KEY = "geosfera.actigraph"; // { [memberId]: { subject, code } }, this device only
const MODES = [
  { id: "sim", label: "Simulated watch" },
  { id: "file", label: "Actiware file" },
  { id: "cloud", label: "ActiGraph cloud" },
  { id: "off", label: "Not using a watch" }
];
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const dur = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);
const shift = (day, n) => { const [y, m, d] = day.split("-").map(Number); return dateKey(new Date(y, m - 1, d + n)); };
const loc = () => (document.documentElement.lang === "es" ? "es-CO" : "en-GB"); // dates follow the ES/EN button
const quote = (f) => `<small class="src">“${f.quote}” <a href="${f.url}" target="_blank" rel="noopener">${f.source}</a></small>`;

function readAll() { try { return JSON.parse(localStorage.getItem(WATCH_KEY)) ?? {}; } catch { return {}; } }
/** Wrist activity in 15-minute sums, the last 14 days only. */
function cleanActivity(raw, now = Date.now()) {
  const out = {};
  for (const [k, v] of Object.entries(raw && typeof raw === "object" ? raw : {})) {
    const t = Date.parse(k);
    if (Number.isFinite(t) && Number.isFinite(v) && v >= 0 && now - t < 14 * 86400000) out[new Date(t).toISOString()] = Math.round(v);
  }
  return out;
}
function readWatch(id) {
  const w = readAll()[id] ?? {};
  return { mode: MODES.some((m) => m.id === w.mode) ? w.mode : "sim", events: D.cleanEvents(w.events), lastSync: w.lastSync ?? null, file: typeof w.file === "string" ? w.file.slice(0, 80) : null, activity: cleanActivity(w.activity) };
}
function writeWatch(id, w) {
  const all = readAll();
  all[id] = w;
  try { localStorage.setItem(WATCH_KEY, JSON.stringify(all)); return true; } catch { return false; }
}

/** The crew member's usual night from their log (median of the last 14 nights), else 7 h. */
function usualSleep(log, today) {
  const v = Array.from({ length: 14 }, (_, i) => log?.[shift(today, -1 - i)]?.sleepHours?.value).filter((x) => x != null).sort((a, b) => a - b);
  return v.length >= 3 ? v[Math.floor(v.length / 2)] : 7;
}

/* ---------- the spacewalk: the watch stays inside ---------- */

const evaRunning = (feed) => { const c = feed?.state?.active?.eva; return Boolean(c && c.phase !== "rec"); };
const readFocus = () => { try { return F.cleanFocus(JSON.parse(localStorage.getItem(F.FOCUS_KEY))); } catch { return {}; } };
const writeFocus = (f) => { try { localStorage.setItem(F.FOCUS_KEY, JSON.stringify(f)); } catch { /* storage blocked */ } document.dispatchEvent(new CustomEvent("ergosphere:focus")); };

/**
 * Follows the live simulator: when a spacewalk starts (from Live or from Devices) the watch comes
 * off and family notices are held; when it ends the watch goes back on and the hold ends.
 */
let sawEva = false; // a spacewalk seen running in this session (a reload restarts the simulator)

/** Back inside: the watch goes back on and the spacewalk's hold on family notices ends. */
export function finishEva(memberId = current()?.id) {
  if (!memberId) return;
  const w = readWatch(memberId);
  if (!D.offNow(w.events)?.eva) return;
  writeWatch(memberId, { ...w, events: D.endEva(w.events, new Date()) });
  if (F.focusNow(readFocus(), memberId)?.task === "eva") writeFocus(F.endFocus(readFocus(), memberId));
  document.dispatchEvent(new CustomEvent("ergosphere:watch"));
}

export function followEva(feed) {
  const me = current();
  if (!me) return;
  const w = readWatch(me.id);
  if (w.mode === "off") return;
  const now = new Date(), off = D.offNow(w.events, now), on = evaRunning(feed);
  if (on) sawEva = true;
  if (on && !off?.eva) {
    writeWatch(me.id, { ...w, events: D.startEva(w.events, now) });
    if (!F.focusNow(readFocus(), me.id)) writeFocus(F.startFocus(readFocus(), me.id, "eva", now));
    document.dispatchEvent(new CustomEvent("ergosphere:watch"));
  } else if (!on && off?.eva && sawEva) {
    sawEva = false; // the simulator's spacewalk ended: back inside
    finishEva(me.id);
  }
}

let lastAuto = 0;
/**
 * Brings in what the devices have, without asking: the watch's last nights (simulated mode)
 * and today's heart rate and blood pressure from the live sensors. Never replaces a value the
 * crew member typed. Returns the keys filled today.
 */
export function autoSync({ force = false } = {}) {
  const me = current();
  if (!me || (!force && Date.now() - lastAuto < 60000)) return [];
  lastAuto = Date.now();
  const now = new Date(), today = dateKey(now);
  let log = readLog(me.id);
  const filled = [];
  const w = readWatch(me.id);
  if (w.mode === "sim") {
    const usual = usualSleep(log, today);
    let events = w.events;
    for (const day of [shift(today, -2), shift(today, -1), today]) {
      const known = log?.[day]?.sleepHours;
      const night = D.simulateNight(day, { member: me.id, hours: known?.value ?? usual, exact: known?.value != null, now, ...(day === today ? { nightOff: true } : {}) }); // last night always shows a stretch with the watch off, for the demo
      events = D.addEvents(events.filter((e) => !(e.src === "simulated" && !e.reason && D.inNight(e, day))), night, now); // redraw that night
      const s = D.nightSummary(night, day);
      if (s) { const r = D.fillDay(log, day, { sleepHours: s.sleepHours }, "simulated", now); log = r.log; if (day === today) filled.push(...r.filled); }
    }
    const activity = { ...w.activity, ...D.simulateActivity(events, new Date(now.getTime() - 2 * 86400000), now, me.id) };
    writeWatch(me.id, { ...w, events, activity: cleanActivity(activity), lastSync: now.toISOString() });
  }
  // Heart rate, blood pressure, oxygen, temperature and sugar go into the log only when another
  // instrument measured them (a Bluetooth sensor, or typed by the crew member). The live screen's
  // sensors are a simulation for monitoring: they do not fill the daily log, so a field nobody
  // measured stays empty.
  writeLog(log, me.id);
  return filled;
}

/* ---------- the night, drawn ---------- */

// Who says what: the watch RECORDED whether it was worn; the app ESTIMATED asleep and awake from
// its movement; the crew member REPORTED going to bed, getting up and taking the watch off.
const LAYER = (e) => (D.isSelf(e) ? "you" : ["asleep", "wake", "awake"].includes(e.kind) ? "app" : "watch");
const LAYER_WORD = { you: "You reported", app: "App estimate", watch: "Watch recorded" };

function timeline(events, day, activity = {}) {
  const [y, m, d] = day.split("-").map(Number);
  const from = new Date(y, m - 1, d - 1, 18).getTime(), to = new Date(y, m - 1, d, 12).getTime();
  const x = (t) => Math.max(0, Math.min(100, ((new Date(t).getTime() - from) / (to - from)) * 100));
  const w = (a, b) => Math.max(0.8, x(b) - x(a));
  const s = D.nightSummary(events, day);
  const offs = D.offPeriods(events, Math.min(Date.now(), to)).filter((p) => p.to > from && p.from < to);
  // lane 1: the watch on the wrist or not (what the device itself can tell)
  const bins = Object.entries(activity).map(([k, v]) => [Date.parse(k), v]).filter(([t]) => t >= from && t < to);
  const top = Math.max(1, ...bins.map(([, v]) => v));
  const worn = [`<span class="tl-worn" style="left:0;width:100%"></span>`,
    ...bins.map(([t, v]) => `<span class="tl-ac" style="left:${x(t)}%;width:${w(t, t + 15 * 60000)}%;height:${Math.max(4, Math.round((v / top) * 100))}%"></span>`), ...offs.filter((p) => !D.SELF.includes(p.src)).map((p) => `<span class="${p.reason === "eva" ? "tl-eva" : "tl-off"}" style="left:${x(p.from)}%;width:${w(p.from, p.to)}%" title="${p.reason === "eva" ? "Spacewalk" : "Off the wrist"} ${hm(p.from)}"></span>`)];
  // lane 2: the app's estimate of sleep from the watch's movement, with the awake periods
  const est = s ? [`<span class="tl-sleep${s.basis === "marks" ? " from-marks" : ""}" style="left:${x(s.asleep)}%;width:${w(s.asleep, s.wake)}%"></span>`,
    ...s.events.filter((e) => e.kind === "awake").map((e) => `<span class="tl-awake" style="left:${x(e.at)}%;width:${w(e.at, e.until ?? e.at)}%" title="Awake ${hm(e.at)}"></span>`),
    ...offs.map((p) => `<span class="tl-gap" style="left:${x(p.from)}%;width:${w(p.from, p.to)}%" title="Not counted: watch off"></span>`)] : [];
  // lane 3: the crew member's own taps
  const you = [...(s?.events ?? events.filter((e) => new Date(e.at) >= from && new Date(e.at) < to)).filter((e) => D.isSelf(e) && ["bed", "up", "press"].includes(e.kind)).map((e) => `<span class="tl-pin" data-kind="${e.kind}" style="left:${x(e.at)}%" title="${e.kind === "bed" ? "Went to bed" : e.kind === "up" ? "Got up" : "Pressed the watch's button"} ${hm(e.at)}"><i></i><b>${e.kind === "bed" ? "Bed" : e.kind === "up" ? "Up" : "◆"}</b></span>`),
    ...offs.filter((p) => D.SELF.includes(p.src)).map((p) => `<span class="tl-off self" style="left:${x(p.from)}%;width:${w(p.from, p.to)}%" title="You took the watch off ${hm(p.from)}"></span>`)];
  const ticks = [18, 21, 0, 3, 6, 9, 12].map((h, i) => `<span style="left:${(i * 3 / 18) * 100}%">${String(h).padStart(2, "0")}</span>`).join("");
  const lane = (cls, label, html) => `<div class="tl-lane ${cls}"><span class="tl-label">${label}</span><div class="tl-track">${html.join("")}</div></div>`;
  return `<div class="tl" role="img" aria-label="${s ? `Estimated asleep ${hm(s.asleep)} to ${hm(s.wake)}, ${s.awakenings} awakenings${s.offInSleepMin ? `, watch off ${s.offInSleepMin} min not counted` : ""}` : "No sleep recorded"}">
    ${lane("l-watch", "Watch recorded", worn)}${lane("l-app", "App estimate", est)}${lane("l-you", "You reported", you)}
    <div class="tl-ticks" aria-hidden="true">${ticks}</div></div>`;
}

const EVENT_ICON = { bed: "⏷", asleep: "☾", awake: "◌", wake: "☀", up: "⏶", off: "⌚✕", on: "⌚" };

function eventsHtml(events) {
  const list = [...events].reverse().slice(0, 16);
  if (!list.length) return `<p class="fine">Nothing from the watch yet.</p>`;
  return `<ol class="dv-events">${list.map((e) => `<li data-kind="${e.kind}" data-layer="${LAYER(e)}"${e.reason ? ` data-reason="${e.reason}"` : ""}><span class="mono">${hm(e.at)}</span><span class="dv-ic" aria-hidden="true">${e.reason === "eva" ? "EVA" : EVENT_ICON[e.kind]}</span><span>${D.eventLabel(e)}${e.until ? ` · ${dur(Math.round((new Date(e.until) - new Date(e.at)) / 60000))}` : ""}<em class="dv-layer">${LAYER_WORD[LAYER(e)]}</em></span><small>${new Date(e.at).toLocaleDateString(loc(), { weekday: "short", day: "numeric" })}</small></li>`).join("")}</ol>`;
}

/** The crew member's own taps: they count even when the watch says nothing. */
function marksHtml(events, w) {
  const off = D.offNow(events);
  const last = [...events].reverse().find((e) => e.kind === "bed" || e.kind === "up");
  const inBed = last?.kind === "bed";
  const fileKnows = w.mode === "file" || w.mode === "cloud";
  return `<div class="dv-marks" role="group" aria-label="Tap what you do">
    <p class="mono dv-kind">TAP WHAT YOU DO</p>
    <div class="dv-mark-row">
      <button type="button" class="cta${inBed ? "" : " main"}" data-mark="bed" ${inBed ? "disabled" : ""}>☾ I went to bed</button>
      <button type="button" class="cta${inBed ? " main" : ""}" data-mark="up" ${inBed ? "" : "disabled"}>☀ I got up</button>
      <button type="button" class="cta" data-mark="off" ${off ? "disabled" : ""}>⌚✕ I took the watch off</button>
      <button type="button" class="cta${off && !off.eva ? " main" : ""}" data-mark="on" ${off && !off.eva ? "" : "disabled"}>⌚ I put it back on</button>
    </div>
    <p class="dv-rate-q">How rested do you feel?</p>
    <div class="dv-rate" role="group" aria-label="How rested do you feel, 1 to 5">${[1, 2, 3, 4, 5].map((v) => `<button type="button" class="chip-btn" data-rate="${v}">${v}</button>`).join("")}<span class="fine">1 not at all · 5 fully</span></div>
    <p class="fine">${fileKnows ? "The watch's file already brings time in bed, sleep, awakenings, wrist activity and time off the wrist: tap only what it cannot know, like how rested you feel, or a moment it missed. When the file arrives, it replaces your taps for what it covers." : "The watch knows its wrist activity and, when its file arrives, time in bed, sleep and time off the wrist: those come in by themselves and replace your taps for what they cover. Tap what it cannot know, like how rested you feel. Either way, time with the watch off is left out of the sleep count."}</p>
  </div>`;
}

function watchHtml(w, log, today) {
  // the most recent night the watch (or the crew member) recorded, even from an older file
  const days = [...new Set(w.events.filter((e) => e.kind === "wake" || e.kind === "up").map((e) => D.dayOf(e.at)))].sort().reverse();
  const s = D.nightSummary(w.events, today) ?? days.map((d) => D.nightSummary(w.events, d)).find(Boolean) ?? null;
  const off = D.offNow(w.events);
  return `<section class="data-card dv-card" aria-labelledby="dv-w">
    <div class="dv-head"><div><p class="mono dv-kind">ACTIGRAPHY WATCH</p><h2 id="dv-w">Actiwatch-Plus</h2></div>
      <span class="dv-state" data-on="${w.mode !== "off"}">${w.mode === "sim" ? "SIMULATED" : w.mode === "file" ? "FROM FILE" : w.mode === "cloud" ? "ACTIGRAPH CLOUD" : "OFF"}</span></div>
    ${off?.eva ? `<div class="dv-alert dv-eva" role="status"><p><strong>Spacewalk in progress since ${hm(off.since)}</strong> (${dur(off.minutes)}). The watch stays inside, not in the suit: sleep and activity are not recorded until it is back on. Heart rate keeps coming from the body sensors on the Live screen; family notices wait until you are back.</p>
      <div class="dv-acts"><a class="cta" href="#live">Watch the live sensors</a><button type="button" class="cta main" data-dv="eva-end">Back inside: end the spacewalk</button></div></div>`
      : off ? `<p class="dv-alert${off.remind ? " remind" : ""}" role="status">⌚ The watch has been off since ${hm(off.since)} (${dur(off.minutes)}).${off.remind ? " Put it back on: sleep and activity are not being recorded." : ""}</p>` : ""}
    ${s ? `<p class="dv-basis">${s.basis === "marks" ? "Estimated from your own marks: the watch recorded no night." : "Sleep estimated by the app from the watch's movement."}${s.offInSleepMin ? ` <strong>${dur(s.offInSleepMin)} with the watch off in the night: not counted.</strong>` : ""}</p>
    <div class="dv-night">
      <div><strong>${s.sleepHours} h</strong><small>estimated asleep${s.day === today ? " last night" : ` · night to ${s.day}`}</small></div>
      <div><strong>${hm(s.asleep)}</strong><small>${s.basis === "marks" ? "went to bed (you)" : "fell asleep (estimate)"}${s.latencyMin != null ? ` · in bed ${hm(s.bed)} (${s.bedBy === "you" ? "you" : "watch file"})` : ""}</small></div>
      <div><strong>${hm(s.wake)}</strong><small>${s.basis === "marks" ? "got up (you)" : "woke up (estimate)"}${s.up && s.basis === "watch" ? ` · up ${hm(s.up)} (${s.upBy === "you" ? "you" : "watch file"})` : ""}</small></div>
      <div><strong>${s.awakenings}</strong><small>${s.awakenings === 1 ? "awakening" : "awakenings"} · ${dur(s.awakeMin)} awake</small></div>
      ${s.rested ? `<div><strong>${s.rested}/5</strong><small>how rested you felt (you)</small></div>` : ""}
    </div>${timeline(w.events, s.day, w.activity)}
    <p class="tl-key"><span class="k-ac"></span>wrist activity <span class="k-sleep"></span>estimated asleep <span class="k-awake"></span>awake <span class="k-off"></span>watch off <span class="k-gap"></span>not counted <span class="k-pin"></span>your marks <span class="k-eva"></span>spacewalk</p>` : `<p class="fine">No night recorded yet.</p>`}
    ${w.mode === "off" ? "" : marksHtml(w.events, w)}
    ${fold("Everything the watch recorded", eventsHtml(w.events))}
    <div class="chips" role="radiogroup" aria-label="Where the watch data comes from">${MODES.map((m) => `<label class="chip"><input type="radio" name="watch-mode" value="${m.id}" ${w.mode === m.id ? "checked" : ""}><span>${m.label}</span></label>`).join("")}</div>
    ${off?.eva || w.mode === "off" ? "" : `<div class="dv-acts dv-eva-start"><button type="button" class="cta" data-dv="eva-start">Start a simulated spacewalk</button><span class="fine">The watch comes off at suit-up and goes back on when you are inside.</span></div>`}
    <div class="dv-acts"><button type="button" class="cta" data-dv="import">Import an Actiware file</button><input type="file" accept=".csv,.txt,text/csv" data-ref="file" hidden><a class="textlink" href="samples/actiware-epochs-sample.csv" download>Sample minute-by-minute file</a><a class="textlink" href="samples/actiware-sample.csv" download>Sample interval file</a>
      ${w.lastSync ? `<span class="fine">Last download ${new Date(w.lastSync).toLocaleString(loc(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}${w.file ? ` · ${esc(w.file)}` : ""}</span>` : ""}</div>
    <p class="step-msg" data-ref="watch-msg" role="status" aria-live="polite"></p>
    ${fold("How the watch reaches the app", `<p>What it is: ${quote(DEVICE_FACTS.actiwatch)} ${quote(DEVICE_FACTS.sleep)}</p>
      <p>On the station NASA calls it the Actiwatch-Plus (AWP): ${quote(DEVICE_FACTS.onStation)}</p>
      <p>It has no Bluetooth. ${quote(DEVICE_FACTS.memory)} For its Actiwatch Spectrum Plus, Philips lists the connection as ${quote(DEVICE_FACTS.usb)}</p>
      <p>So the watch is plugged into the station's computer, Philips' Actiware software exports a file, and this app reads that file: the sleep intervals become "fell asleep" and "woke up", and the intervals the software excluded (usually the watch off the wrist) become "watch taken off". In this demo a simulated watch does the same every morning.</p>
      <p class="fine">Whether NASA's AWP is exactly Philips' Spectrum Plus is our reading of the two names, not a NASA statement. The file reader follows the column names of Actiware's interval export as a published R importer reads them; it is pending a real export from the team to confirm the exact layout. The timeline, the 60-minute "put it back on" reminder and the simulated nights are app rules, not NASA's.</p>`)}
  </section>`;
}

function readAg(id) { try { const v = JSON.parse(localStorage.getItem(ACTIGRAPH_KEY))?.[id]; return { subject: String(v?.subject ?? ""), code: String(v?.code ?? "") }; } catch { return { subject: "", code: "" }; } }
function writeAg(id, v) { try { const all = JSON.parse(localStorage.getItem(ACTIGRAPH_KEY)) ?? {}; all[id] = v; localStorage.setItem(ACTIGRAPH_KEY, JSON.stringify(all)); } catch { /* storage blocked */ } }

function actigraphHtml(id) {
  const ag = readAg(id);
  return `<section class="data-card dv-card" aria-labelledby="dv-a">
    <div class="dv-head"><div><p class="mono dv-kind">CLOUD API · OTHER ACTIGRAPHY WATCHES</p><h2 id="dv-a">ActiGraph CentrePoint</h2></div><span class="dv-state" data-on="false">NEEDS A SERVER</span></div>
    <p>ActiGraph watches upload to ActiGraph's cloud, and its API gives each night (in bed, out of bed, awakenings) and, minute by minute, whether the watch was worn. The app asks through its own server, which holds the secret key.</p>
    <form class="dv-ag" novalidate autocomplete="off">
      <label class="cf-field"><span>Subject ID in the study</span><input name="subject" inputmode="numeric" maxlength="12" value="${esc(ag.subject)}" placeholder="e.g. 21670"></label>
      <label class="cf-field"><span>Crew access code</span><input name="code" type="password" maxlength="80" value="${esc(ag.code)}" placeholder="from the mission team"></label>
      <button type="submit" class="cta">Bring the last 3 days</button>
    </form>
    <p class="step-msg" data-ref="ag-msg" role="status" aria-live="polite"></p>
    ${fold("How this connection works", `<p>ActiGraph's API uses OAuth 2.0 with a client ID and a client <em>secret</em>; ActiGraph enables it per account. A secret cannot live in a web page, so the request goes to this app's server function (api/actigraph), which keeps the keys in its environment, asks ActiGraph for the sleep periods and the minute summaries, and returns only times, wear and sleep: no study, site or device details. The crew access code keeps strangers from asking for someone's data.</p>
      <p class="fine">It needs the copy of the app deployed with a server (Vercel) and an ActiGraph account with API access; the public demo page has neither, so the button there says so. NASA's station watch is Philips' Actiwatch, not an ActiGraph: this connection is for teams or analog missions that use ActiGraph watches. Tested against a fake server built from ActiGraph's published documentation, not against ActiGraph itself.</p>`)}
  </section>`;
}

const bleSupported = () => typeof navigator !== "undefined" && Boolean(navigator.bluetooth);

function bleHtml() {
  return `<section class="data-card dv-card" aria-labelledby="dv-b">
    <div class="dv-head"><div><p class="mono dv-kind">BLUETOOTH · STANDARD HEALTH SENSORS</p><h2 id="dv-b">Sensors you pair</h2></div>
      <span class="dv-state" data-on="${bleSupported()}">${bleSupported() ? "AVAILABLE" : "NOT IN THIS BROWSER"}</span></div>
    <ul class="dv-ble">${D.BLE.map((p) => `<li data-ble="${p.id}"><span><strong>${p.label}</strong><small data-ref="ble-${p.id}">Not connected</small></span>
      <button type="button" class="cta" data-dv="ble" data-id="${p.id}" ${bleSupported() ? "" : "disabled"}>Connect</button></li>`).join("")}</ul>
    <p class="fine">${bleSupported() ? "Keep this screen open while measuring: each reading goes into today's log by itself, marked “Bluetooth”." : "This browser cannot reach Bluetooth sensors. It works in Chrome on Android or on a computer; iPhone browsers do not allow it."}</p>
    ${fold("Which sensors work", `<p>Any sensor that follows the Bluetooth SIG's standard health profiles: heart rate, blood pressure, health thermometer or pulse oximeter. Many chest straps, cuffs, thermometers and finger oximeters sold for home use do; some brands only talk to their own app.</p>
      <p>${quote(DEVICE_FACTS.webBluetooth)} ${quote(DEVICE_FACTS.webBluetoothWhere)}</p>
      <p class="fine">The readings are decoded with the Bluetooth SIG's formats (IEEE 11073 numbers) and checked against the same limits as a typed value. Tested with sample bytes, not yet with a real sensor. The resting heart rate is the middle value of 20 readings (app rule).</p>`)}
  </section>`;
}

function liveHtml() {
  return `<section class="data-card dv-card" aria-labelledby="dv-l">
    <div class="dv-head"><div><p class="mono dv-kind">BODY SENSORS · LIVE SCREEN</p><h2 id="dv-l">Live sensors</h2></div><span class="dv-state" data-on="true">SIMULATION</span></div>
    <p>The live sensors are a simulation for monitoring (alerts, spacewalk, sleep mode). They do not fill your daily log: heart rate, blood pressure, oxygen, temperature and blood sugar go in only when another instrument measured them, from a Bluetooth sensor above or typed by you; otherwise the field stays empty. On the station the equivalent would be a system like the Canadian Space Agency's Bio-Monitor: ${quote(LIMIT_FACTS.wearParts)}</p>
    <a class="tm-go" href="#live">Open the live sensors →</a>
  </section>
  <section class="data-card dv-card" aria-labelledby="dv-n">
    <h2 id="dv-n">Still typed by you</h2>
    <ul class="dv-manual"><li><strong>How you feel</strong><small>No device can say it. NASA's own studies pair the watch with a daily log.</small></li>
      <li><strong>Heart rate, blood pressure, oxygen, temperature, blood sugar</strong><small>Only when measured with another instrument: a Bluetooth sensor fills them by itself, or type what the cuff, thermometer, oximeter or glucometer says. Not measured: the field stays empty.</small></li>
      <li><strong>Radiation dose</strong><small>Type it from your personal dosimeter.</small></li>
      <li><strong>Exercise</strong><small>The watch records movement, not a workout: type the minutes.</small></li></ul>
    <a class="cta" href="#log">Review today's readings</a>
  </section>`;
}

export function mountDevices(host) {
  const me = current();
  autoSync({ force: true });
  const today = dateKey();
  const render = () => {
    const w = readWatch(me.id);
    host.innerHTML = `<section class="devices" aria-labelledby="dv-title">
      <p class="eyebrow">Module 3 · Devices</p>
      <h1 id="dv-title" tabindex="-1">Readings that arrive by themselves</h1>
      <p class="lede">Your watch, your sensors and the station's instruments fill your daily log. You only check it, and add how you feel.</p>
      ${watchHtml(w, readLog(me.id), today)}
      ${actigraphHtml(me.id)}
      ${bleHtml()}
      ${liveHtml()}
      <p class="fine rule-note">Not a medical device. The watch nights are simulated unless you import an Actiware file; the live sensors are simulated; Bluetooth readings are real when a real sensor is connected. A value you typed is never replaced by a device. Sources: docs/SOURCES.md.</p>
    </section>`;
  };
  render();
  const root = () => host.querySelector(".devices");
  const $ = (r) => host.querySelector(`[data-ref="${r}"]`);
  const hr = []; // heart-rate stream from a Bluetooth strap

  function save(field, value, src) {
    const r = D.fillDay(readLog(me.id), dateKey(), { [field]: value }, src);
    if (r.filled.length) writeLog(r.log, me.id);
    return r.filled.length > 0;
  }

  async function connect(p, btn) {
    const note = $(`ble-${p.id}`);
    try {
      btn.disabled = true; note.textContent = "Choose the sensor…";
      const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [p.service] }] });
      note.textContent = `Connecting to ${device.name ?? "the sensor"}…`;
      const svc = await (await device.gatt.connect()).getPrimaryService(p.service);
      let ok = false;
      for (const id of p.chars) {
        try {
          const c = await svc.getCharacteristic(id);
          c.addEventListener("characteristicvaluechanged", (e) => {
            const v = D.bleValue(p.id, p.parse(e.target.value));
            if (v == null) return;
            if (p.id === "hr") {
              hr.push(v);
              const rest = D.restingFrom(hr);
              note.textContent = `${device.name ?? "Strap"} · ${v} bpm now${rest ? ` · resting ${rest} bpm saved` : ` · ${20 - Math.min(20, hr.length)} more readings for the resting rate`}`;
              if (rest) save("heartRate", rest, "bluetooth");
            } else {
              const shown = Array.isArray(v) ? `${v[0]}/${v[1]} mmHg` : p.id === "temp" ? `${v} °C` : `${v} %`;
              const saved = save(p.field, v, "bluetooth");
              note.textContent = `${device.name ?? "Sensor"} · ${shown}${saved ? " · saved to today" : ""}`;
            }
          });
          await c.startNotifications();
          ok = true;
          break;
        } catch { /* try the next characteristic */ }
      }
      if (!ok) throw new Error("no measurement");
      note.textContent = `${device.name ?? "Sensor"} connected. Measure now.`;
      btn.textContent = "Connected";
      device.addEventListener("gattserverdisconnected", () => { note.textContent = "Disconnected."; btn.textContent = "Connect"; btn.disabled = false; });
    } catch (err) {
      btn.disabled = false;
      note.textContent = err?.name === "NotFoundError" ? "No sensor chosen." : "It could not connect. Is the sensor on and close by?";
    }
  }

  host.addEventListener("change", async (e) => {
    if (e.target.name === "watch-mode") {
      const w = readWatch(me.id);
      writeWatch(me.id, { ...w, mode: e.target.value });
      if (e.target.value === "sim") autoSync({ force: true });
      render();
      return;
    }
    if (e.target.matches('[data-ref="file"]')) {
      const f = e.target.files?.[0];
      if (!f) return;
      const r = D.readActiwareFile(await f.text());
      if (!r.ok) { $("watch-msg").textContent = r.why; return; }
      const w = readWatch(me.id);
      const times = r.events.map((x) => Date.parse(x.at));
      const events = D.mergeFile(w.events.filter((x) => x.src !== "simulated" && x.src !== "self-sim"), r.events, r.kind === "epoch" ? { coverFrom: Math.min(...times), coverTo: Math.max(...times) } : {});
      let log = readLog(me.id);
      for (const n of r.nights.map((x) => D.nightSummary(events, x.day)).filter(Boolean)) log = D.fillDay(log, n.day, { sleepHours: n.sleepHours }, "actiware").log;
      writeLog(log, me.id);
      writeWatch(me.id, { mode: "file", events: D.addEvents([], events, new Date(), 60), activity: cleanActivity({ ...(r.activity ?? {}) }), lastSync: new Date().toISOString(), file: f.name });
      render();
      $("watch-msg").textContent = r.kind === "epoch"
        ? `Read ${r.rows} epochs of ${r.epochSec} s: ${r.nights.length} ${r.nights.length === 1 ? "night" : "nights"}, wrist activity and time off the wrist added from the file.`
        : `Read ${r.rows} intervals: ${r.nights.length} ${r.nights.length === 1 ? "night" : "nights"} added to your log.`;
    }
  });
  host.addEventListener("submit", async (e) => {
    const f = e.target.closest(".dv-ag");
    if (!f) return;
    e.preventDefault();
    const subject = f.subject.value.trim(), code = f.code.value.trim();
    const say = (t) => { $("ag-msg").textContent = t; };
    if (!/^\d{1,12}$/.test(subject) || !code) { say("Type the subject ID (numbers) and the crew access code."); return; }
    writeAg(me.id, { subject, code });
    const to = dateKey(), from = shift(to, -2);
    say("Asking ActiGraph…");
    let r, data = null;
    try { r = await fetch(`api/actigraph?subject=${subject}&from=${from}&to=${to}`, { headers: { Authorization: `Bearer ${code}` }, cache: "no-store" }); data = await r.json().catch(() => null); } catch { r = null; }
    if (!r || !data || (r.status === 404 && !data?.error)) { say("This copy of the app has no server, so it cannot reach ActiGraph. It works on the deployment with a server (Vercel) and ActiGraph credentials."); return; }
    if (r.status !== 200) { say(data?.error ?? "ActiGraph did not answer."); return; }
    const got = D.parseCentrePoint(data);
    if (!got.ok) { say(got.why); return; }
    let log = readLog(me.id);
    for (const n of got.nights) log = D.fillDay(log, n.day, { sleepHours: n.sleepHours }, "centrepoint").log;
    writeLog(log, me.id);
    const w = readWatch(me.id);
    writeWatch(me.id, { mode: "cloud", events: D.addEvents(w.events.filter((x) => x.src !== "simulated"), got.events, new Date(), 60), lastSync: new Date().toISOString(), file: "ActiGraph CentrePoint" });
    render();
    $("ag-msg").textContent = `${got.nights.length} ${got.nights.length === 1 ? "night" : "nights"} and the wear minutes added from ActiGraph.`;
  });
  host.addEventListener("click", (e) => {
    const rt = e.target.closest("[data-rate]");
    if (rt) {
      const w = readWatch(me.id);
      writeWatch(me.id, { ...w, events: D.selfMark(w.events, "rated", new Date(), Number(rt.dataset.rate)) });
      render();
      $("watch-msg").textContent = `Noted: rested ${rt.dataset.rate} of 5.`;
      return;
    }
    const mk = e.target.closest("[data-mark]");
    if (mk) {
      const w = readWatch(me.id), now = new Date();
      const events = D.selfMark(w.events, mk.dataset.mark, now);
      writeWatch(me.id, { ...w, events });
      // with no watch night, the crew member's own marks give the estimate (src "marks")
      if (mk.dataset.mark === "up" || mk.dataset.mark === "on") {
        const n = D.nightSummary(events, dateKey(now));
        if (n) { const r = D.fillDay(readLog(me.id), dateKey(now), { sleepHours: n.sleepHours }, n.basis === "marks" ? "marks" : w.mode === "sim" ? "simulated" : w.mode === "file" ? "actiware" : w.mode === "cloud" ? "centrepoint" : "marks"); if (r.filled.length) writeLog(r.log, me.id); }
      }
      render();
      $("watch-msg").textContent = { bed: "Noted: you went to bed.", up: "Noted: you got up.", off: "Noted: the watch is off. That time will not count as sleep.", on: "Noted: the watch is back on." }[mk.dataset.mark];
      return;
    }
    const b = e.target.closest("[data-dv]");
    if (!b) return;
    if (b.dataset.dv === "import") $("file").click();
    if (b.dataset.dv === "eva-start") {
      if (!evaRunning(snapshot() ?? startFeed())) toggle("eva"); // the simulator's spacewalk; followEva takes the watch off
      followEva(snapshot());
      render();
    }
    if (b.dataset.dv === "eva-end") {
      if (evaRunning(snapshot() ?? startFeed())) toggle("eva"); // the suit's effort goes into recovery
      finishEva(me.id);
      render();
    }
    if (b.dataset.dv === "ble") connect(D.BLE.find((p) => p.id === b.dataset.id), b);
  });
  const onWatch = () => { if (host.querySelector(".devices")) render(); else document.removeEventListener("ergosphere:watch", onWatch); };
  document.addEventListener("ergosphere:watch", onWatch);
  root()?.querySelector("h1")?.focus({ preventScroll: true });
}

/** One line for Today: the watch's last night and whether it is on the wrist now. */
export function watchLine(memberId) {
  const w = readWatch(memberId);
  if (w.mode === "off") return null;
  const today = dateKey();
  const s = D.nightSummary(w.events, today);
  const off = D.offNow(w.events);
  return { night: s, off, mode: w.mode };
}
