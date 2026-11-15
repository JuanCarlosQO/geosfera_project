// The crew member's own home (#crew). On the station the readings go to the ground medical
// team, so this screen shows none: it collects what only the crew member can report (how they
// feel this morning, when they went to bed or took the watch off, a dose, a wish to talk) and
// opens their own data only in an emergency, for a while, with the opening kept for the ground.
// Rules: role-core.js. Facts: data/devices.js and docs/SOURCES.md.

import { current } from "./store.js";
import { missionDay } from "./today-core.js";
import { missionStart } from "./today.js";
import { sleepCheckHtml, bindSleepCheck } from "./sleepcheck.js";
import { crewMarksHtml, applyMark, rateMark } from "./devices.js";
import { familyWaiting } from "./family.js";
import { sendAlert } from "./support.js";
import * as F from "./family-core.js";
import { EMERGENCY_REASONS, EMERGENCY_MIN } from "./role-core.js";
import { openEmergency } from "./role.js";
import { avatarHtml } from "./avatar.js";
import { crewExerciseHtml, bindCrewExercise } from "./exercise.js";
import { crewShareHtml, bindCrewShare } from "./share.js";
import { checkEmergencyCode, reasonLabel } from "./role-core.js";
import { clocksHtml } from "./clock.js";
import { snapshot } from "./feed.js";
import { crewCheckinHtml, bindCrewCheckin } from "./checkin.js";
import { crewConnectHtml, bindCrewConnect } from "./connect.js";
import { phase } from "./after-core.js";

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const readFocus = () => F.cleanFocus(read(F.FOCUS_KEY, {}));
const writeFocus = (f) => { try { localStorage.setItem(F.FOCUS_KEY, JSON.stringify(f)); } catch { /* storage blocked */ } document.dispatchEvent(new CustomEvent("ergosphere:focus")); };

const missionInfo = () => { try { return JSON.parse(localStorage.getItem("geosfera.mission")) ?? {}; } catch { return {}; } };
// a personal line: how many days until home, when the mission has a length
const homeCount = (mday) => { const m = missionInfo(); if (!m.length || !mday) return ""; const left = Math.max(0, m.length - mday); return `<p class="ch-home"><strong>${left}</strong> ${left === 1 ? "day" : "days"} until home · day ${mday} of ${m.length}</p>`; };
const missionName = () => { try { return JSON.parse(localStorage.getItem("geosfera.mission"))?.name ?? ""; } catch { return ""; } };

function timeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function html(me) {
  const mday = missionDay(missionStart(), new Date());
  const focus = F.focusNow(readFocus(), me.id);
  const fam = familyWaiting(me.id);
  const alarmOn = Boolean(snapshot()?.steady?.some((a) => a.status === "act"));
  return `<section class="crew-home">
    <header class="ch-head">
      <div class="ch-pic" aria-hidden="true">${avatarHtml(me, "ch-av")}</div>
      <div>
        <p class="eyebrow">${missionName() ? `<span data-no-i18n>${esc(missionName())}</span> · ` : ""}<span>Mission day ${mday}</span> · <span>${esc(me.role)}</span></p>
        <h1 tabindex="-1">${timeOfDay()}, <span data-no-i18n>${esc(me.name.split(" ")[0])}</span></h1>
        ${homeCount(mday)}
        <p class="ch-lead">Your readings go to the ground medical team and are not shown here. Tell them what only you know.</p>
      </div>
    </header>

    ${(() => { const ph = phase(missionInfo()); return ph.phase === "after" ? `<section class="ch-card af-back"><h2>Welcome back to Earth · day ${ph.daysAfter}</h2><p>Coming home takes time. Support, help lines and the people you trust are in one place.</p><a class="cta main" href="#after">After the mission ›</a></section>` : ""; })()}
    ${clocksHtml({ compact: true })}

    ${sleepCheckHtml(me, { missionDay: mday, view: "crew" })}

    <div data-ref="ci-wrap">${crewCheckinHtml(me)}</div>

    <div data-ref="sh-wrap">${crewShareHtml(me)}</div>

    <section class="ch-card" aria-labelledby="ch-watch-h">
      <h2 id="ch-watch-h">Your watch</h2>
      ${crewMarksHtml(me.id)}
      <p class="ch-msg" role="status" data-ref="ch-msg"></p>
    </section>

    <div data-ref="ex-wrap">${crewExerciseHtml(me)}</div>

    <div data-ref="cn-wrap">${crewConnectHtml(me)}</div>

    <div class="ch-grid">
      <a class="ch-tile" href="#meds"><strong>Log a medication</strong><small>What you took, what for, how many</small></a>
      <a class="ch-tile" href="#family"><strong>Messages from home</strong><small>${fam ? `${fam} sealed, open whenever you like` : "Nothing new"}</small></a>
      <button type="button" class="ch-tile" data-ch="talk"><strong>I'd like to talk to someone</strong><small>One tap. Not urgent.</small></button>
      <button type="button" class="ch-tile${focus ? " on" : ""}" data-ch="${focus ? "focus-end" : "focus"}"><strong>${focus ? "I'm done with the task" : "Starting a critical task"}</strong><small>${focus ? "Messages from home are held until you finish" : "Holds messages from home until you finish"}</small></button>
    </div>

    <section class="ch-card ch-emergency${alarmOn ? " ch-alarm" : ""}" aria-labelledby="ch-em-h">
      <h2 id="ch-em-h">${alarmOn ? "Alarm: open your data with the emergency code" : "Emergency: open the data with the crew's code"}</h2>
      <p>Only in an emergency, such as CPR on a crewmate: the crew's emergency code opens the readings for ${EMERGENCY_MIN} minutes, without waiting for the ground. The ground medical team sees who opened them, when, and why.</p>
      <form class="ch-em-form" data-em-form>
        <div class="ch-em-row" role="radiogroup" aria-label="Why are you opening the data">${EMERGENCY_REASONS.filter((r) => r.id !== "alarm" || alarmOn).map((r, i) => `<label class="ch-em-r"><input type="radio" name="reason" value="${r.id}"${(alarmOn ? r.id === "alarm" : i === 0) ? " checked" : ""}><span>${r.label}</span></label>`).join("")}</div>
        <div class="sh-row"><input name="code" inputmode="numeric" autocomplete="off" maxlength="7" placeholder="000 000" aria-label="Crew emergency code" required><button type="submit" class="cta stop">Open the data</button></div>
        <p class="sh-msg" role="status" data-em-msg></p>
      </form>
      <p class="fine">If you need help now, press and hold SOS. To rehearse, <a href="#drill">run a cardiac arrest drill</a> (simulated).</p>
    </section>
  </section>`;
}

export function mountCrewHome(host) {
  const me = current();
  if (!me) { host.innerHTML = ""; return; }
  host.innerHTML = html(me);
  const say = (t) => { const m = host.querySelector('[data-ref="ch-msg"]'); if (m) m.textContent = t; };
  bindSleepCheck(host.querySelector(".crew-home"), () => current()); // the card is redrawn with each mount
  const ciWrap = host.querySelector('[data-ref="ci-wrap"]');
  const redrawCheckin = () => { ciWrap.innerHTML = crewCheckinHtml(me); ciWrap.querySelector(".ci-opt, [data-ci]")?.focus({ preventScroll: true }); };
  bindCrewCheckin(ciWrap, me, redrawCheckin);
  const cnWrap = host.querySelector('[data-ref="cn-wrap"]');
  bindCrewConnect(cnWrap, me, (msg) => { const open = cnWrap.querySelector(".cn-journal")?.open; cnWrap.innerHTML = crewConnectHtml(me, msg); if (open) cnWrap.querySelector(".cn-journal").open = true; });
  const shWrap = host.querySelector('[data-ref="sh-wrap"]');
  const redrawShare = () => { shWrap.innerHTML = crewShareHtml(me); bindCrewShare(shWrap, me, redrawShare); document.dispatchEvent(new CustomEvent("ergosphere:role")); };
  bindCrewShare(shWrap, me, redrawShare);
  let tries = 0;
  host.querySelector("[data-em-form]").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target, msg = f.querySelector("[data-em-msg]");
    if (tries >= 5) { msg.textContent = "Too many wrong codes. Press and hold SOS, or ask a crewmate."; return; }
    if (!checkEmergencyCode(missionInfo(), f.code.value)) { tries += 1; msg.textContent = missionInfo().emergencyCode ? "Wrong code." : "No emergency code is set for this mission: ask the ground."; f.code.select(); return; }
    const reason = f.reason.value;
    if (openEmergency(reason, me.id)) { msg.textContent = `Open: ${reasonLabel(reason)}`; location.hash = "#today"; }
  });
  const exWrap = host.querySelector('[data-ref="ex-wrap"]');
  bindCrewExercise(exWrap, me, (o) => { exWrap.innerHTML = crewExerciseHtml(me, o); exWrap.querySelector("form input, form select")?.focus({ preventScroll: true }); });
  host.onclick = (e) => {
    const mk = e.target.closest("[data-mark]");
    if (mk) { const t = applyMark(me.id, mk.dataset.mark); mountCrewHome(host); say(t); return; }
    const rt = e.target.closest("[data-rate]");
    if (rt) { const t = rateMark(me.id, Number(rt.dataset.rate)); mountCrewHome(host); say(t); return; }
    const b = e.target.closest("[data-ch]");
    if (!b) return;
    if (b.dataset.ch === "talk") {
      const a = sendAlert("talk");
      b.querySelector("small").textContent = a ? "Sent: your crew medical officer will reach you" : "Could not send";
      b.disabled = Boolean(a);
    }
    if (b.dataset.ch === "focus") { writeFocus(F.startFocus(readFocus(), me.id, "Critical task")); mountCrewHome(host); }
    if (b.dataset.ch === "focus-end") { writeFocus(F.endFocus(readFocus(), me.id)); mountCrewHome(host); }
  };
}
