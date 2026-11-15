// Emergency drill (#drill): a simulated cardiac arrest on board. The alarm sounds, a crewmate
// types the crew's emergency code, the patient's data opens at once (last readings, medications
// in the last 24 hours, recent symptoms) and the ground team sees the opening. Then the drill ends
// with a summary: seconds to open the data, wrong codes. Rules: drill-core.js, role-core.js.
// Everything here is SIMULATED; nothing is written to anyone's log. No medical instructions:
// the crew follows the station's procedures and the flight surgeon leads.

import { getCrew, readLog, current } from "./store.js";
import { getRole, getOpenings } from "./role.js";
import { checkEmergencyCode, addOpening, OPENINGS_KEY, GROUND_ID } from "./role-core.js";
import * as D from "./drill-core.js";
import { MEDS_KEY, cleanStore, forMember } from "./meds-core.js";
import { KIT } from "./data/med-kit.js";
import { SUPPLEMENTS } from "./data/supplements.js";
import * as X from "./exercise-core.js";
import { exerciseStore } from "./exercise.js";
import { mission } from "./crew-status.js";
import { clocksHtml } from "./clock.js";
import { stamp } from "./clock-core.js";
import { avatarHtml } from "./avatar.js";
import * as C from "./sleepcheck-core.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const drills = () => D.cleanDrills(read(D.DRILLS_KEY, []));
const save = (list) => write(D.DRILLS_KEY, list);
const active = () => drills().find((d) => !d.endedAt) ?? null;
const who = (id) => (id === GROUND_ID ? { id, name: "Ground medical team" } : getCrew().members.find((m) => m.id === id) ?? { id, name: id });
const secs = (from) => Math.max(0, Math.round((Date.now() - new Date(from)) / 1000));

const FLAT = `<svg class="dr-ecg" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true"><path class="dr-trace" d="M0 60 L90 60 L100 40 L110 82 L120 60 L600 60"/><path class="dr-flat" d="M0 60 H600"/></svg>`;

/** The last value of each reading in the patient's log, with its day. */
function lastReadings(log) {
  const days = Object.keys(log).sort().reverse();
  const pick = (f) => { for (const d of days) { const v = f(log[d]); if (v != null) return { v, d }; } return null; };
  return [
    ["Heart rate", pick((e) => e?.heartRate?.value), "bpm"],
    ["Blood pressure", pick((e) => (e?.bloodPressure?.value ? e.bloodPressure.value.join("/") : null)), "mmHg"],
    ["Oxygen saturation", pick((e) => e?.bloodOxygen?.value), "%"],
    ["Temperature", pick((e) => e?.temperature?.value), "°C"],
    ["Last night's sleep", pick((e) => (e?.sleepHours?.value != null ? C.hm(e.sleepHours.value) : null)), ""]
  ];
}

function setupHtml() {
  const crew = getCrew().members;
  const st = getRole();
  const me = st.role === "crew" ? current() : null;
  const patientId = (crew.find((m) => m.id !== me?.id) ?? crew[0])?.id;
  const list = drills().filter((d) => d.endedAt).slice(0, 5);
  return `<div class="dr-setup an-card">
    <h2>Start a drill</h2>
    <p>One crew member collapses (simulated): the monitor shows no pulse and the alarm sounds. A crewmate opens their data with the crew's emergency code. The clock runs from the alarm.</p>
    <form class="dr-form" data-dr="start">
      <label>Patient <select name="patient">${crew.map((m) => `<option value="${esc(m.id)}"${m.id === patientId ? " selected" : ""} data-no-i18n>${esc(m.name)}</option>`).join("")}</select></label>
      <label>Responder <select name="responder">${crew.map((m) => `<option value="${esc(m.id)}"${(me ? me.id === m.id : m.id !== patientId && m.id === crew.find((x) => x.id !== patientId)?.id) ? " selected" : ""} data-no-i18n>${esc(m.name)}</option>`).join("")}</select></label>
      <button type="submit" class="cta stop">Start the drill</button>
    </form>
    ${mission().emergencyCode ? "" : `<p class="fine">No emergency code is set for this mission yet: the ground team sets it in Mission Control.</p>`}
  </div>
  ${list.length ? `<section class="an-card"><h2>Past drills</h2><ul class="dr-past">${list.map((d) => { const t = D.timings(d); return `<li><strong data-no-i18n>${esc(who(d.patient).name)}</strong><span>${stamp(d.startedAt)}</span><span>Data open in ${D.clockOf(t.toOpen)}</span><span>${t.wrongCodes} wrong ${t.wrongCodes === 1 ? "code" : "codes"}</span><span>${D.outcomeLabel(d.outcome)}</span></li>`; }).join("")}</ul></section>` : ""}`;
}

function alarmHtml(d) {
  const p = who(d.patient), r = who(d.responder);
  return `<div class="dr-live">
    <div class="dr-monitor" role="img" aria-label="Simulated monitor: no pulse">
      <div class="dr-mon-top"><span class="dr-blink"></span><strong>ACT NOW · No pulse (simulated)</strong><span class="dr-timer" data-dr-timer>${D.clockOf(secs(d.startedAt))}</span></div>
      ${FLAT}
      <div class="dr-vals"><div><small>Heart rate</small><b data-no-i18n>0</b><i>bpm</i></div><div><small>Oxygen sat.</small><b data-no-i18n>--</b><i>%</i></div><div><small>Breathing</small><b data-no-i18n>--</b><i>/min</i></div></div>
      <p class="dr-who">${avatarHtml(p, "dr-av")}<span><strong data-no-i18n>${esc(p.name)}</strong><small>Responder: <span data-no-i18n>${esc(r.name)}</span></small></span></p>
    </div>
    <form class="dr-code an-card" data-dr="code">
      <h2>Open their data</h2>
      <p>Type the crew's emergency code. It opens their data at once, without waiting for the ground, and the ground team sees the opening.</p>
      <div class="sh-row"><input name="code" inputmode="numeric" autocomplete="off" maxlength="7" placeholder="000 000" aria-label="Emergency code" required><button type="submit" class="cta stop">Open data</button></div>
      <p class="sh-msg" role="status" data-dr-msg>${d.wrongCodes ? `${d.wrongCodes} wrong ${d.wrongCodes === 1 ? "code" : "codes"} so far.` : ""}</p>
      <button type="button" class="textlink" data-dr-end="stopped">Stop the drill</button>
    </form>
  </div>`;
}

function openHtml(d) {
  const p = who(d.patient);
  const log = readLog(p.id);
  const since = Date.now() - 86400000;
  const meds = forMember(cleanStore(read(MEDS_KEY, null), KIT, SUPPLEMENTS), p.id).doses.filter((x) => new Date(x.at).getTime() >= since).sort((a, b) => (a.at < b.at ? 1 : -1));
  const today = new Date().toISOString().slice(0, 10);
  const sym = X.recentSymptoms(exerciseStore(), p.id, today, 3).filter((e) => e.symptoms.length);
  return `<div class="dr-live">
    <div class="dr-monitor dr-open">
      <div class="dr-mon-top"><span class="dr-blink"></span><strong>Data open · drill running</strong><span class="dr-timer" data-dr-timer>${D.clockOf(secs(d.startedAt))}</span></div>
      ${FLAT}
      <p class="dr-who">${avatarHtml(p, "dr-av")}<span><strong data-no-i18n>${esc(p.name)}</strong><small>Opened in ${D.clockOf(D.timings(d).toOpen)} · ground team notified</small></span></p>
    </div>
    <section class="an-card">
      <h2>Last readings before the alarm</h2>
      <div class="dr-last">${lastReadings(log).map(([label, x, unit]) => `<div class="an-out"><small>${label}</small><b>${x ? `${x.v}${unit ? ` <i>${unit}</i>` : ""}` : "—"}</b><em>${x ? x.d : "Not logged"}</em></div>`).join("")}</div>
      <h3>Medications in the last 24 hours</h3>
      ${meds.length ? `<ul class="dr-meds">${meds.map((x) => { const k = KIT.find((m) => m.id === x.medId); return `<li><strong>${esc(k?.name ?? x.medId)}</strong> ${x.units} ${esc(k?.unit ?? "")} · <span class="fine">${stamp(x.at)}</span></li>`; }).join("")}</ul>` : `<p class="fine">None logged.</p>`}
      ${sym.length ? `<h3>Felt after exercise</h3><ul class="dr-meds">${sym.map((e) => `<li>${esc(X.sessionLabel(e))} (${e.day}): ${e.symptoms.map(X.symptomLabel).join(", ")}</li>`).join("")}</ul>` : ""}
      <p class="fine">Simulated drill. On a real station the crew follows the station's emergency procedures and the flight surgeon on the ground leads.</p>
      <div class="sh-row"><button type="button" class="cta main" data-dr-end="pulse">Pulse back: end the drill</button><button type="button" class="cta" data-dr-end="stopped">Stop the drill</button></div>
    </section>
  </div>`;
}

function endedHtml(d) {
  const t = D.timings(d);
  return `<section class="an-card dr-sum">
    <h2>Drill summary</h2>
    <div class="dr-last">
      <div class="an-out"><small>Data open after</small><b>${D.clockOf(t.toOpen)}</b><em>From the alarm to the right code</em></div>
      <div class="an-out"><small>Wrong codes</small><b>${t.wrongCodes}</b><em>Typed before the right one</em></div>
      <div class="an-out"><small>Drill length</small><b>${D.clockOf(t.total)}</b><em>${D.outcomeLabel(d.outcome)}</em></div>
    </div>
    <p class="fine">Started ${stamp(d.startedAt)}. Saved for the ground team and in the Excel export.</p>
    <div class="sh-row"><button type="button" class="cta main" data-dr-new>Run another drill</button></div>
  </section>`;
}

export function mountDrill(station) {
  // listeners live on this wrapper, so they go away with the screen
  station.innerHTML = `<div class="dr-root"></div>`;
  const host = station.firstElementChild;
  let showEnded = null;
  const draw = () => {
    const d = active();
    const ended = showEnded ? drills().find((x) => x.id === showEnded) : null;
    host.innerHTML = `<section class="drill analysis">
      <header>
        <p class="eyebrow">Emergency drill · SIMULATED</p>
        <h1 tabindex="-1">Cardiac arrest drill</h1>
        <p class="ch-lead">Rehearse opening a crewmate's data with the emergency code, as in a CPR emergency. Nothing here is a real reading.</p>
      </header>
      ${clocksHtml({ compact: true })}
      ${d ? (d.openedAt ? openHtml(d) : alarmHtml(d)) : ended ? endedHtml(ended) : setupHtml()}
    </section>`;
    host.querySelector('[data-dr="code"] input')?.focus({ preventScroll: true });
  };
  draw();
  const timer = setInterval(() => {
    const el = host.querySelector("[data-dr-timer]");
    const d = active();
    if (!host.isConnected) { clearInterval(timer); return; }
    if (!el) return;
    if (d) el.textContent = D.clockOf(secs(d.startedAt));
  }, 1000);

  host.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.matches('[data-dr="start"]')) {
      const { list } = D.startDrill(drills(), { patient: f.patient.value, responder: f.responder.value });
      save(list);
      showEnded = null;
      draw();
      return;
    }
    if (f.matches('[data-dr="code"]')) {
      const d = active();
      if (!d) return draw();
      if (!checkEmergencyCode(mission(), f.code.value)) {
        save(D.wrongCode(drills(), d.id));
        f.querySelector("[data-dr-msg]").textContent = "Wrong code. Try again.";
        f.code.select();
        return;
      }
      save(D.opened(drills(), d.id));
      write(OPENINGS_KEY, addOpening(getOpenings(), { member: d.patient, reason: "cpr", drill: true, by: d.responder }));
      draw();
    }
  });
  host.addEventListener("click", (e) => {
    const end = e.target.closest("[data-dr-end]");
    if (end) {
      const d = active();
      if (!d) return;
      save(D.endDrill(drills(), d.id, end.dataset.drEnd));
      showEnded = d.id;
      draw();
      return;
    }
    if (e.target.closest("[data-dr-new]")) { showEnded = null; draw(); }
  });
}
