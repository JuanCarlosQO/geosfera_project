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

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const readFocus = () => F.cleanFocus(read(F.FOCUS_KEY, {}));
const writeFocus = (f) => { try { localStorage.setItem(F.FOCUS_KEY, JSON.stringify(f)); } catch { /* storage blocked */ } document.dispatchEvent(new CustomEvent("ergosphere:focus")); };

function timeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function html(me) {
  const mday = missionDay(missionStart(), new Date());
  const focus = F.focusNow(readFocus(), me.id);
  const fam = familyWaiting(me.id);
  return `<section class="crew-home">
    <header class="ch-head">
      <div class="ch-pic" aria-hidden="true">${avatarHtml(me, "ch-av")}</div>
      <div>
        <p class="eyebrow">Mission day ${mday} · ${esc(me.role)}</p>
        <h1 tabindex="-1">${timeOfDay()}, <span data-no-i18n>${esc(me.name.split(" ")[0])}</span></h1>
        <p class="ch-lead">Your readings go to the ground medical team and are not shown here. Tell them what only you know.</p>
      </div>
    </header>

    ${sleepCheckHtml(me, { missionDay: mday, view: "crew" })}

    <section class="ch-card" aria-labelledby="ch-watch-h">
      <h2 id="ch-watch-h">Your watch</h2>
      ${crewMarksHtml(me.id)}
      <p class="ch-msg" role="status" data-ref="ch-msg"></p>
    </section>

    <div class="ch-grid">
      <a class="ch-tile" href="#meds"><strong>Log a medication</strong><small>What you took, what for, how many</small></a>
      <a class="ch-tile" href="#family"><strong>Messages from home</strong><small>${fam ? `${fam} sealed, open whenever you like` : "Nothing new"}</small></a>
      <button type="button" class="ch-tile" data-ch="talk"><strong>I'd like to talk to someone</strong><small>One tap. Not urgent.</small></button>
      <button type="button" class="ch-tile${focus ? " on" : ""}" data-ch="${focus ? "focus-end" : "focus"}"><strong>${focus ? "I'm done with the task" : "Starting a critical task"}</strong><small>${focus ? "Messages from home are held until you finish" : "Holds messages from home until you finish"}</small></button>
    </div>

    <section class="ch-card ch-emergency" aria-labelledby="ch-em-h">
      <h2 id="ch-em-h">Emergency: see my own data</h2>
      <p>In an emergency you can open your readings for ${EMERGENCY_MIN} minutes. The ground medical team sees that you opened them, when, and why.</p>
      <div class="ch-em-row" role="group" aria-label="Why are you opening your data">${EMERGENCY_REASONS.filter((r) => r.id !== "alarm").map((r) => `<button type="button" class="cta${r.id === "medical" ? " stop" : ""}" data-em="${r.id}">${r.label}</button>`).join("")}</div>
      <p class="fine">If you need help now, press and hold SOS. An “Act now” alarm opens your data by itself.</p>
    </section>
  </section>`;
}

export function mountCrewHome(host) {
  const me = current();
  if (!me) { host.innerHTML = ""; return; }
  host.innerHTML = html(me);
  const say = (t) => { const m = host.querySelector('[data-ref="ch-msg"]'); if (m) m.textContent = t; };
  bindSleepCheck(host.querySelector(".crew-home"), () => current()); // the card is redrawn with each mount
  host.onclick = (e) => {
    const mk = e.target.closest("[data-mark]");
    if (mk) { const t = applyMark(me.id, mk.dataset.mark); mountCrewHome(host); say(t); return; }
    const rt = e.target.closest("[data-rate]");
    if (rt) { const t = rateMark(me.id, Number(rt.dataset.rate)); mountCrewHome(host); say(t); return; }
    const em = e.target.closest("[data-em]");
    if (em) { if (openEmergency(em.dataset.em, me.id)) location.hash = "#today"; return; }
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
