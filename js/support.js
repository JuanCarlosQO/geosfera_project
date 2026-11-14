// Support button: always on screen, even with the hatch closed. Two choices — "I'd like to
// talk to someone" or "Emergency" (hold to send) — plus optional reasons and a note. The
// alert is saved in geosfera.alerts; the team's station sync carries it to every linked crew
// device, where a banner asks "I'm on my way". Mission Control delivery is simulated.
// Also applies the comfort settings (calm motion, larger text, one thing at a time).

import * as P from "./support-core.js";
import { REASONS, LEVELS, SUPPORT_FACTS } from "./data/support.js";
import { current } from "./store.js";

const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reasonLabel = (id) => REASONS.find((r) => r.id === id)?.label ?? id;

export const getAlerts = () => P.cleanAlerts(read(P.ALERTS_KEY, []));
export const saveAlerts = (list) => write(P.ALERTS_KEY, list);
export const linked = () => Boolean(read("geosfera.sync", null)?.stationId);

export function applyComfort(c = P.cleanComfort(read(P.COMFORT_KEY, {}))) {
  const html = document.documentElement;
  html.classList.toggle("comfort-calm", c.calm);
  html.classList.toggle("comfort-large", c.large);
  html.classList.toggle("comfort-focus", c.focus);
}

function sheetHtml() {
  return `<div class="sp-veil" data-ref="sp-veil" role="dialog" aria-modal="true" aria-labelledby="sp-h">
    <form class="sp-sheet" novalidate autocomplete="off">
      <div class="sp-top"><h2 id="sp-h">Ask for support</h2><button type="button" class="round-btn" data-sp="close" aria-label="Close">✕</button></div>
      <p class="sp-lede">Your crew sees it first: Earth can be up to 20 minutes away. Nothing here is judged or scored.</p>
      <div class="sp-levels">
        <button type="button" class="sp-level sp-talk" data-sp="talk"><strong>${LEVELS.talk.label}</strong><small>${LEVELS.talk.note}</small></button>
        <button type="button" class="sp-level sp-emergency" data-sp="emergency"><span class="sp-fill" aria-hidden="true"></span><strong>${LEVELS.emergency.label}</strong><small>Hold for 1.5 seconds to send. ${LEVELS.emergency.note}</small></button>
      </div>
      <details class="sp-more"><summary>Add what is going on (optional)</summary>
        <div class="chips">${REASONS.map((r) => `<label class="chip"><input type="checkbox" name="reason" value="${r.id}"><span>${r.label}</span></label>`).join("")}</div>
        <label class="sp-note"><span>A few words, if you want</span><textarea name="note" rows="2" maxlength="280"></textarea></label>
      </details>
      <p class="sp-msg" data-ref="sp-msg" role="status" aria-live="assertive"></p>
      <p class="fine">${linked() ? "This device is linked to a station: linked crew devices show the alert." : "This device is not linked to a station: link one (Sync, top bar) so crewmates' devices receive alerts."} Mission Control delivery is simulated in this prototype. <a href="#mind">Mind &amp; support</a></p>
    </form>
  </div>`;
}

function sentHtml(a) {
  const lv = LEVELS[a.level];
  return `<div class="sp-sent" data-level="${a.level}">
    <p class="sp-big">${a.level === "emergency" ? "⯃ Emergency sent" : "● Request sent"}</p>
    <p>${lv.note}</p>
    <ul class="sp-route">
      <li>${linked() ? "✓ Linked crew devices on this station" : "○ No station linked: only this device has it"}</li>
      <li>◌ Mission Control (simulated) · up to 20 min one way</li>
    </ul>
    <p class="fine">“${SUPPORT_FACTS.delay.quote}” <a href="${SUPPORT_FACTS.delay.url}" target="_blank" rel="noopener">${SUPPORT_FACTS.delay.source}</a></p>
    <button type="button" class="cta" data-sp="close">Close</button>
  </div>`;
}

function bannerHtml(list) {
  return list.slice(0, 2).map((a) => `<div class="sp-banner" data-level="${a.level}" role="alert">
    <p><strong>${a.level === "emergency" ? "⯃ EMERGENCY" : "● Support"} · ${esc(a.from.name)}${a.from.role ? `, ${esc(a.from.role)}` : ""}</strong> <span>${P.ago(a.at)}</span></p>
    ${a.reasons.length || a.note ? `<p class="sp-why">${a.reasons.map(reasonLabel).join(" · ")}${a.note ? ` — “${esc(a.note)}”` : ""}</p>` : ""}
    <div class="sp-acts"><button type="button" class="cta main" data-ack="${a.id}" data-kind="coming">I'm on my way</button><button type="button" class="textlink" data-ack="${a.id}" data-kind="seen">Seen</button></div>
  </div>`).join("");
}

export function mountSupport() {
  applyComfort();
  const fab = Object.assign(document.createElement("button"), { type: "button", className: "sp-fab", innerHTML: `<span aria-hidden="true">♥</span><span>Support</span>` });
  fab.setAttribute("aria-label", "Ask for support or raise an emergency");
  const banner = Object.assign(document.createElement("div"), { className: "sp-banners" });
  banner.setAttribute("aria-live", "assertive");
  document.body.append(fab, banner);

  let holdTimer = null;
  let veil = null;

  function closeSheet() { veil?.remove(); veil = null; fab.focus(); }

  function send(level) {
    const form = veil.querySelector("form");
    const reasons = [...form.querySelectorAll('input[name="reason"]:checked')].map((i) => i.value);
    const r = P.makeAlert({ level, member: current(), reasons, note: form.note.value });
    if (!r.ok) return;
    saveAlerts(P.addAlert(getAlerts(), r.alert));
    form.innerHTML = sentHtml(r.alert);
    document.dispatchEvent(new CustomEvent("ergosphere:alerts"));
  }

  function openSheet() {
    if (veil) return;
    document.body.insertAdjacentHTML("beforeend", sheetHtml());
    veil = document.body.lastElementChild;
    veil.querySelector(".sp-talk").focus();
    veil.addEventListener("click", (e) => {
      if (e.target === veil || e.target.closest('[data-sp="close"]')) { closeSheet(); return; }
      if (e.target.closest('[data-sp="talk"]')) send("talk");
    });
    const em = veil.querySelector(".sp-emergency");
    const start = (e) => {
      e.preventDefault();
      em.classList.add("holding");
      veil.querySelector('[data-ref="sp-msg"]').textContent = "Keep holding…";
      holdTimer = setTimeout(() => { em.classList.remove("holding"); send("emergency"); }, P.HOLD_MS);
    };
    const stop = () => {
      if (!holdTimer) return;
      clearTimeout(holdTimer); holdTimer = null;
      if (em.isConnected && em.classList.contains("holding")) { em.classList.remove("holding"); veil.querySelector('[data-ref="sp-msg"]').textContent = "Hold the emergency button until it fills."; }
    };
    em.addEventListener("pointerdown", start);
    em.addEventListener("pointerup", stop);
    em.addEventListener("pointerleave", stop);
    em.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) start(e); });
    em.addEventListener("keyup", (e) => { if (e.key === "Enter" || e.key === " ") stop(); });
    veil.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
  }

  function paintBanner() {
    banner.innerHTML = bannerHtml(P.forMe(getAlerts(), current()));
    document.body.classList.toggle("has-sp-banner", banner.children.length > 0);
  }

  fab.addEventListener("click", openSheet);
  banner.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ack]");
    if (!b) return;
    const me = current() ?? { id: "device", name: "Crewmate" };
    saveAlerts(P.acknowledge(getAlerts(), b.dataset.ack, me, b.dataset.kind));
    paintBanner();
    document.dispatchEvent(new CustomEvent("ergosphere:alerts"));
  });
  document.addEventListener("ergosphere:alerts", paintBanner);
  window.addEventListener("storage", (e) => { if (e.key === P.ALERTS_KEY) paintBanner(); });
  setInterval(paintBanner, 4000); // station sync writes in place: look again every few seconds
  paintBanner();
  return { open: openSheet };
}
