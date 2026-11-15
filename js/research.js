// "NASA research behind this": the NLSP experiments a feature follows (data/research.js).
import { RESEARCH } from "./data/research.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** A short block quoting each experiment, linked to its page on NASA's Life Sciences Portal. */
export function researchHtml(ids, heading = "NASA research behind this") {
  const items = ids.map((id) => [id, RESEARCH[id]]).filter(([, r]) => r);
  if (!items.length) return "";
  return `<div class="rs-box"><p class="mono rs-h">${heading}</p>${items.map(([id, r]) => `<p class="rs-item">“${esc(r.quote)}” <a href="${r.url}" target="_blank" rel="noopener"><span data-no-i18n>${esc(r.title)}</span> (<span data-no-i18n>${esc(id)}</span>), ${esc(r.pi)} · NLSP</a></p>`).join("")}<p class="fine">The study's data are not public: the app follows the idea, it does not show the study's results.</p></div>`;
}
