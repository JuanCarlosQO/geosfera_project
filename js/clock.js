// The three clocks on screen (rules: clock-core.js): UTC, Houston (Texas) and Cape Canaveral
// (Florida), ticking every second wherever a strip is drawn.

import { clocks } from "./clock-core.js";

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const off = (h) => (h === 0 ? "±0" : `${h > 0 ? "+" : "−"}${Math.abs(h)}`);

/** A strip of three clocks; `note` is a short line under it (e.g. why the clocks are there). */
export function clocksHtml({ note = "", compact = false } = {}) {
  const now = new Date();
  return `<section class="clk${compact ? " clk-compact" : ""}" aria-label="Clocks: UTC, Texas and Florida">
    ${clocks(now, true).map((c) => `<div class="clk-one clk-${c.id}">
      <small>${esc(c.place)}</small>
      <b data-clock="${c.id}" data-no-i18n>${c.time}</b>
      <em><span data-clock-abbr="${c.id}" data-no-i18n>${c.abbr}</span> · UTC <span data-clock-off="${c.id}" data-no-i18n>${off(c.offset)}</span> · <span data-clock-day="${c.id}" data-no-i18n>${c.day}</span></em>
    </div>`).join("")}
    ${note ? `<p class="clk-note fine">${note}</p>` : ""}
  </section>`;
}

function tick() {
  if (!document.querySelector("[data-clock]")) return;
  for (const c of clocks(new Date(), true)) {
    for (const el of document.querySelectorAll(`[data-clock="${c.id}"]`)) el.textContent = c.time;
    for (const el of document.querySelectorAll(`[data-clock-abbr="${c.id}"]`)) el.textContent = c.abbr;
    for (const el of document.querySelectorAll(`[data-clock-off="${c.id}"]`)) el.textContent = off(c.offset);
    for (const el of document.querySelectorAll(`[data-clock-day="${c.id}"]`)) el.textContent = c.day;
  }
}
let started = false;
export function startClocks() {
  if (started) return;
  started = true;
  setInterval(tick, 1000);
}
