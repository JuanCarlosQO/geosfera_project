// After the mission (#after): support for the return to Earth, with a suicide-prevention
// channel. Talk now (the mission's behavioral health team, the national line for the crew
// member's home country, the international directory), people they trust (kept on this device
// only), how to help someone else (the 988 Lifeline's five steps), and check-ins that continue
// for a year after landing. Resources only: no clinical advice, no method of harm is named.
// Rules: after-core.js. Quotes: data/after.js (docs/SOURCES.md).

import { current } from "./store.js";
import { getRole } from "./role.js";
import { sendAlert } from "./support.js";
import * as A from "./after-core.js";
import { AFTER_FACTS, ACTION_STEPS } from "./data/after.js";
import { SUPPORT_FACTS } from "./data/support.js";
import { mission } from "./crew-status.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const q = (f) => `<span class="af-q"><span data-no-i18n>“${f.quote}”</span> <a href="${f.url}" target="_blank" rel="noopener" data-no-i18n>${f.source}</a></span>`;

const trusted = () => A.cleanTrusted(read(A.TRUSTED_KEY, []));

function linesHtml(home) {
  const { lines, directory } = A.linesFor(home);
  return `<div class="af-lines">
    ${lines.map((l) => `<div class="af-line">
      <strong data-no-i18n>${esc(l.name)}</strong>
      <div class="af-acts">
        <a class="cta stop" href="tel:${l.call}">Call <span data-no-i18n>${l.call}</span></a>
        ${l.text ? `<a class="cta" href="sms:${l.text}">Text <span data-no-i18n>${l.text}</span></a>` : ""}
        ${l.chat ? `<a class="cta" href="${l.chat}" target="_blank" rel="noopener">Chat</a>` : ""}
      </div>
      <p class="fine">${l.facts.map((k) => q(AFTER_FACTS[k])).join(" ")}</p>
    </div>`).join("")}
    <div class="af-line">
      <strong>${lines.length ? "In another country" : home ? "Lines near you" : "Find a line near you"}</strong>
      <div class="af-acts"><a class="cta" href="${directory.url}" target="_blank" rel="noopener"><span data-no-i18n>${directory.name}</span> ›</a></div>
      <p class="fine">${q(AFTER_FACTS.helpline)}</p>
    </div>
    <p class="af-911">If your life or someone else's is in danger right now, call your local emergency number.</p>
  </div>`;
}

function trustedHtml() {
  const list = trusted();
  return `<section class="an-card af-trust" aria-labelledby="af-trust-h">
    <h2 id="af-trust-h">People I trust</h2>
    <p class="fine">Up to ${A.MAX_TRUSTED} people you would call on a hard day. Kept on this device only: the ground team does not see them.</p>
    ${list.length ? `<ul class="af-people">${list.map((p, i) => `<li><span><strong data-no-i18n>${esc(p.name)}</strong> <small data-no-i18n>${esc(p.phone)}</small></span><a class="cta main" href="${A.telOf(p.phone)}">Call</a><button type="button" class="textlink" data-af-del="${i}">Remove</button></li>`).join("")}</ul>` : ""}
    ${list.length < A.MAX_TRUSTED ? `<form class="af-add" data-af="add">
      <label>Name<input name="name" maxlength="40" autocomplete="off" required></label>
      <label>Phone<input name="phone" inputmode="tel" maxlength="24" autocomplete="off" required></label>
      <button type="submit" class="cta">Add</button>
    </form>` : ""}
  </section>`;
}

export function mountAfter(station) {
  station.innerHTML = `<div class="af-root"></div>`;
  const host = station.firstElementChild;
  const draw = (msg = "") => {
    const me = current();
    const crew = getRole().role === "crew";
    const ph = A.phase(mission());
    host.innerHTML = `<section class="after analysis">
      <header>
        <p class="eyebrow">Support after landing</p>
        <h1 tabindex="-1">After the mission</h1>
        <p class="ch-lead">${ph.phase === "after" ? `<span>Day ${ph.daysAfter} back on Earth.</span> ` : ph.phase === "during" ? `<span>Landing planned for ${ph.landing}.</span> ` : ""}<span>Coming home is a change too.</span> ${q(AFTER_FACTS.readjust)} ${q(AFTER_FACTS.team)}</p>
      </header>

      <section class="an-card af-now" aria-labelledby="af-now-h">
        <h2 id="af-now-h">Talk to someone now</h2>
        <p>If you are thinking about suicide, or you are worried about someone, you do not have to wait. Free, confidential and at any hour:</p>
        <div class="af-line af-team">
          <strong>Your mission's behavioral health team</strong>
          <div class="af-acts"><button type="button" class="cta main" data-af="call-me"${crew ? "" : " disabled"}>Ask them to call me</button></div>
          <p class="fine">${q(SUPPORT_FACTS.always)}</p>
          <p class="sh-msg" role="status" data-af-msg>${esc(msg)}</p>
        </div>
        ${linesHtml(me?.home)}
      </section>

      ${crew ? trustedHtml() : `<section class="an-card"><h2>People I trust</h2><p class="fine">Each crew member keeps their own list on their device. The ground team does not see it.</p></section>`}

      <section class="an-card af-help" aria-labelledby="af-help-h">
        <h2 id="af-help-h">If you are worried about a crewmate, a friend or family</h2>
        <p class="fine">${q(AFTER_FACTS.steps)}</p>
        <ol class="af-steps">${ACTION_STEPS.map((s) => `<li data-no-i18n>${s}</li>`).join("")}</ol>
        <p class="fine">${q(AFTER_FACTS.whoPrevent)}</p>
      </section>

      <section class="an-card" aria-labelledby="af-ci-h">
        <h2 id="af-ci-h">Check-ins keep going</h2>
        <p>The short check-in keeps coming every two weeks for a year after landing, and an answer that worries the questionnaire still reaches the flight surgeon the same day.</p>
        <p class="fine">${q(AFTER_FACTS.whoIsolation)} That is why loneliness is asked about too.</p>
        <p class="fine">How long the follow-up lasts is an app rule. The lines are those checked on their official pages; for other countries the directory lists the local ones.</p>
      </section>
    </section>`;
    host.querySelector("h1")?.focus({ preventScroll: true });
  };
  draw();
  host.addEventListener("click", (e) => {
    if (e.target.closest('[data-af="call-me"]')) {
      const a = sendAlert("talk", { reasons: ["low"], note: "Asked from After the mission: please call me." });
      draw(a ? "Sent: the team will call you." : "Could not send. Use a line below.");
      return;
    }
    const del = e.target.closest("[data-af-del]");
    if (del) { const l = trusted(); l.splice(Number(del.dataset.afDel), 1); write(A.TRUSTED_KEY, l); draw(); }
  });
  host.addEventListener("submit", (e) => {
    if (!e.target.matches('[data-af="add"]')) return;
    e.preventDefault();
    const f = e.target;
    const next = A.cleanTrusted([...trusted(), { name: f.elements.namedItem("name").value, phone: f.elements.namedItem("phone").value }]);
    write(A.TRUSTED_KEY, next);
    draw();
  });
}
