// SOS button: always on screen, even with the hatch closed. ONE gesture — press and hold for
// 2 seconds — sends the emergency; a ring fills while holding so it cannot go off by an
// accidental tap, and there is no second screen to get through. After sending, the crew
// member can add what is going on or cancel within 10 seconds if it was a mistake.
// Non-urgent "I'd like to talk to someone" lives on the Mind page (one tap there).
// Alerts are kept in geosfera.alerts; the team's station sync carries them to every linked
// crew device, where a banner asks "I'm on my way". Mission Control delivery is simulated.
// Also applies the comfort settings (calm motion, larger text, one thing at a time).

import * as P from "./support-core.js";
import { REASONS, LEVELS, SUPPORT_FACTS } from "./data/support.js";
import { current, getCrew } from "./store.js";

const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reasonLabel = (id) => REASONS.find((r) => r.id === id)?.label ?? id;
const changed = () => document.dispatchEvent(new CustomEvent("ergosphere:alerts"));

export const getAlerts = () => P.cleanAlerts(read(P.ALERTS_KEY, []));
export const saveAlerts = (list) => write(P.ALERTS_KEY, list);
export const linked = () => Boolean(read("geosfera.sync", null)?.stationId);

export function applyComfort(c = P.cleanComfort(read(P.COMFORT_KEY, {}))) {
  const html = document.documentElement;
  html.classList.toggle("comfort-calm", c.calm);
  html.classList.toggle("comfort-large", c.large);
  html.classList.toggle("comfort-focus", c.focus);
}

/** Sends a request right away (used by the SOS hold and by the Mind page's "talk" button). */
export function sendAlert(level, extra = {}) {
  const r = P.makeAlert({ level, member: current(), ...extra });
  if (!r.ok) return null;
  saveAlerts(P.addAlert(getAlerts(), r.alert));
  changed();
  return r.alert;
}

/** The person on the crew who holds a role (the commander, the crew medical officer), if any. */
const holder = (role) => (role ? getCrew().members.find((m) => m.role === role) : null);

// After the SOS: three big buttons (who should answer first), Cancel for a mistake, Close.
// Everything else (what is going on, a few words, where it went) is folded away.
function sentHtml(a, undo) {
  const lv = LEVELS[a.level];
  return `<div class="sp-sheet sp-sent" data-level="${a.level}" role="dialog" aria-modal="true" aria-labelledby="sp-sent-h">
    <p class="sp-big" id="sp-sent-h">${a.level === "emergency" ? "■ SOS sent" : "● Request sent"}</p>
    <p class="sp-lead">${a.level === "emergency" ? "Your crew and Mission Control have it. Who do you need first?" : "Who would you like to talk to?"}</p>
    <div class="sp-to" role="group" aria-label="Who do you need first">${P.TARGETS.map((t) => { const h = holder(t.role); return `<button type="button" class="sp-to-btn" data-to="${t.id}" aria-pressed="${(a.to ?? []).includes(t.id)}"><b>${t.label}</b><small>${h ? `<span data-no-i18n>${esc(h.name)}</span><br>` : ""}<span>${t.sub}</span></small></button>`; }).join("")}</div>
    <p class="sp-sub" role="status" data-ref="to-msg"></p>
    <div class="sp-acts">
      ${undo ? `<button type="button" class="sp-undo" data-sp="undo">Sent by mistake? Cancel · <span data-ref="undo-s">${P.UNDO_S}</span> s</button>` : ""}
      <button type="button" class="cta" data-sp="close">Close</button>
    </div>
    <details class="sp-more">
      <summary>Add details (optional)</summary>
      <form class="sp-details" novalidate autocomplete="off">
        <div class="chips">${REASONS.map((r) => `<label class="chip"><input type="checkbox" name="reason" value="${r.id}"><span>${r.label}</span></label>`).join("")}</div>
        <label class="sp-note"><span>A few words</span><textarea name="note" rows="2" maxlength="280"></textarea></label>
        <div class="sp-acts"><button type="submit" class="cta main">Add to the alert</button></div>
      </form>
      <p class="fine">${lv.note}</p>
      <p class="fine">${linked() ? "✓ Linked crew devices on this station" : "○ No station linked: only this device has it"} · ◌ Mission Control (simulated)</p>
      <p class="fine">“${SUPPORT_FACTS.delay.quote}” <a href="${SUPPORT_FACTS.delay.url}" target="_blank" rel="noopener">${SUPPORT_FACTS.delay.source}</a></p>
    </details>
  </div>`;
}

function bannerHtml(list) {
  return list.slice(0, 2).map((a) => `<div class="sp-banner" data-level="${a.level}" role="alert">
    <p><strong>${a.level === "emergency" ? "■ SOS" : "● Support"} · ${esc(a.from.name)}${a.from.role ? `, ${esc(a.from.role)}` : ""}</strong> <span>${P.ago(a.at)}</span></p>
    ${a.to?.length ? `<p class="sp-why"><strong>Needs first: ${a.to.map(P.targetLabel).join(" · ")}</strong></p>` : ""}
    ${a.reasons.length || a.note ? `<p class="sp-why">${a.reasons.map(reasonLabel).join(" · ")}${a.note ? ` — “${esc(a.note)}”` : ""}</p>` : ""}
    <div class="sp-acts"><button type="button" class="cta main" data-ack="${a.id}" data-kind="coming">I'm on my way</button><button type="button" class="textlink" data-ack="${a.id}" data-kind="seen">Seen</button></div>
  </div>`).join("");
}

export function mountSupport() {
  applyComfort();
  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "sp-fab";
  fab.innerHTML = `<svg class="sp-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" pathLength="1"/></svg><span class="sp-fab-in"><b>SOS</b><small>hold</small></span>`;
  fab.setAttribute("aria-label", `SOS. Press and hold for ${P.HOLD_MS / 1000} seconds to send an emergency to your crew.`);
  const tip = Object.assign(document.createElement("p"), { className: "sp-tip", role: "status" });
  const banner = Object.assign(document.createElement("div"), { className: "sp-banners" });
  banner.setAttribute("aria-live", "assertive");
  document.body.append(fab, tip, banner);

  let hold = null;
  let veil = null;
  let undoTimer = null;
  let tipTimer = null;

  const showTip = (text) => {
    tip.textContent = text;
    tip.classList.add("on");
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => tip.classList.remove("on"), 3500);
  };

  function closeSheet() {
    clearInterval(undoTimer);
    veil?.remove();
    veil = null;
  }

  function showSent(alert) {
    closeSheet();
    document.body.insertAdjacentHTML("beforeend", `<div class="sp-veil">${sentHtml(alert, alert.level === "emergency")}</div>`);
    veil = document.body.lastElementChild;
    let left = P.UNDO_S;
    undoTimer = setInterval(() => {
      left -= 1;
      const s = veil?.querySelector('[data-ref="undo-s"]');
      if (s) s.textContent = left;
      if (left <= 0) { clearInterval(undoTimer); veil?.querySelector('[data-sp="undo"]')?.remove(); }
    }, 1000);
    veil.addEventListener("click", (e) => {
      const to = e.target.closest("[data-to]");
      if (to) {
        to.setAttribute("aria-pressed", String(to.getAttribute("aria-pressed") !== "true"));
        const picked = [...veil.querySelectorAll('[data-to][aria-pressed="true"]')].map((b) => b.dataset.to);
        saveAlerts(P.setTargets(getAlerts(), alert.id, picked));
        changed();
        veil.querySelector('[data-ref="to-msg"]').textContent = picked.length ? `✓ Asked first: ${picked.map(P.targetLabel).join(" · ")}` : "";
        return;
      }
      if (e.target.closest('[data-sp="close"]')) { closeSheet(); fab.focus(); return; }
      if (e.target.closest('[data-sp="undo"]')) {
        saveAlerts(P.closeAlert(getAlerts(), alert.id, new Date(), "mistake"));
        changed();
        closeSheet();
        showTip("SOS cancelled. Your crew sees it marked as sent by mistake.");
      }
    });
    veil.querySelector(".sp-details").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      const reasons = [...f.querySelectorAll('input[name="reason"]:checked')].map((i) => i.value);
      saveAlerts(P.addDetails(getAlerts(), alert.id, { reasons, note: f.note.value }));
      changed();
      f.innerHTML = `<p class="sp-sub">✓ Added to the alert.</p>`;
    });
    const title = veil.querySelector("#sp-sent-h");
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }

  // one gesture: press and hold; release early and nothing is sent
  const start = (e) => {
    if (hold) return;
    e.preventDefault();
    fab.classList.add("holding");
    hold = setTimeout(() => {
      hold = null;
      fab.classList.remove("holding");
      try { navigator.vibrate?.(200); } catch { /* no vibration */ }
      const a = sendAlert("emergency");
      if (a) showSent(a);
    }, P.HOLD_MS);
  };
  const stop = () => {
    if (!hold) return;
    clearTimeout(hold);
    hold = null;
    fab.classList.remove("holding");
    showTip(`Keep holding SOS for ${P.HOLD_MS / 1000} seconds to send an emergency. To talk to someone, open Mind & support.`);
  };
  fab.addEventListener("pointerdown", start);
  fab.addEventListener("pointerup", stop);
  fab.addEventListener("pointerleave", stop);
  fab.addEventListener("pointercancel", stop);
  fab.addEventListener("contextmenu", (e) => e.preventDefault());
  fab.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) start(e); });
  fab.addEventListener("keyup", (e) => { if (e.key === "Enter" || e.key === " ") stop(); });
  fab.addEventListener("click", (e) => e.preventDefault());

  function paintBanner() {
    banner.innerHTML = bannerHtml(P.forMe(getAlerts(), current()));
    document.body.classList.toggle("has-sp-banner", banner.children.length > 0);
  }
  banner.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ack]");
    if (!b) return;
    const me = current() ?? { id: "device", name: "Crewmate" };
    saveAlerts(P.acknowledge(getAlerts(), b.dataset.ack, me, b.dataset.kind));
    paintBanner();
    changed();
  });
  document.addEventListener("ergosphere:alerts", paintBanner);
  window.addEventListener("storage", (e) => { if (e.key === P.ALERTS_KEY) paintBanner(); });
  setInterval(paintBanner, 4000); // station sync writes in place: look again every few seconds
  paintBanner();
  return { talk: () => { const a = sendAlert("talk"); if (a) showSent(a); } };
}
