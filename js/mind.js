// Mind & support (#mind): the psychological side in one place. Ask for support (the same
// sheet as the floating button), see your own and your crewmates' requests, your mood and
// sleep this week against your own history, and comfort settings for different sensory and
// attention needs. NASA quotes: data/support.js and docs/SOURCES.md.

import * as P from "./support-core.js";
import { SUPPORT_FACTS, LEVELS, COMFORT, REASONS } from "./data/support.js";
import { getAlerts, saveAlerts, applyComfort } from "./support.js";
import { current, readLog } from "./store.js";
import { dateKey, fieldByKey } from "./log-core.js";

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const src = (f) => `<small class="src">“${f.quote}” <a href="${f.url}" target="_blank" rel="noopener">${f.source}</a></small>`;
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };

function trendHtml(trend) {
  const moods = fieldByKey("mood").scale;
  return `<ul class="mind-week">${trend.map((d) => `<li>
    <span class="mw-day">${new Date(`${d.day}T12:00`).toLocaleDateString("en-GB", { weekday: "short" })}</span>
    <span class="mw-mood" data-mood="${d.mood ?? ""}" title="${d.mood ? moods[d.mood - 1] : "Not logged"}">${d.mood ?? "—"}</span>
    <span class="mw-sleep">${d.sleep != null ? `${d.sleep} h` : "—"}</span>
  </li>`).join("")}</ul>`;
}

function alertRow(a, me) {
  const lv = LEVELS[a.level];
  const acks = a.acks.length ? a.acks.map((k) => `${esc(k.name)} ${k.kind === "coming" ? "is on the way" : "saw it"}`).join(" · ") : "No answer yet";
  return `<li class="mind-alert" data-level="${a.level}">
    <p><strong>${a.level === "emergency" ? "⯃" : "●"} ${lv.short}</strong> · ${a.from.id === me?.id ? "you" : esc(a.from.name)} · ${P.ago(a.at)}${a.closed ? " · closed" : ""}</p>
    ${a.reasons.length || a.note ? `<p class="fine">${a.reasons.map((id) => REASONS.find((r) => r.id === id)?.label ?? id).join(" · ")}${a.note ? ` — “${esc(a.note)}”` : ""}</p>` : ""}
    <p class="fine">${acks}</p>
    ${a.from.id === me?.id && !a.closed ? `<button type="button" class="textlink" data-close="${a.id}">I'm OK now — close it</button>` : ""}
  </li>`;
}

export function mountMind(host, { openSupport }) {
  const me = current();
  const trend = P.mindTrend(readLog(), dateKey(), 7);
  const comfort = P.cleanComfort(read(P.COMFORT_KEY, {}));

  host.innerHTML = `
  <section class="mind" aria-labelledby="mi-h">
    <p class="eyebrow">Mind &amp; support</p>
    <h1 id="mi-h" tabindex="-1">The mind matters as much as the body</h1>
    <p class="lede">Isolation, confinement and distance weigh on everyone, differently. Ergosphere compares you with yourself, never with an average, and makes asking for help one tap away.</p>

    <button type="button" class="mind-help" data-mind="support"><span aria-hidden="true">♥</span><strong>Ask for support</strong><small>Talk to someone, or raise an emergency</small></button>

    <section class="data-card" aria-labelledby="mi-a">
      <h2 id="mi-a">Requests</h2>
      <div data-ref="alerts"></div>
    </section>

    <section class="data-card" aria-labelledby="mi-t">
      <h2 id="mi-t">Your week: mood and sleep</h2>
      ${trendHtml(trend)}
      <p class="fine">Mood 1–5 and hours of sleep from your daily check-in. <a href="#log">Add today's</a> · <a href="#duty">Fit for duty</a></p>
      ${src(SUPPORT_FACTS.baseline)}
    </section>

    <section class="data-card" aria-labelledby="mi-c">
      <h2 id="mi-c">Comfort settings</h2>
      <p>Brains differ in how much motion, text and input feel right. Set the app the way that works for you; it stays on this device.</p>
      <div class="mind-comfort">${COMFORT.map((c) => `<label class="mc-row"><input type="checkbox" data-comfort="${c.id}" ${comfort[c.id] ? "checked" : ""}><span><strong>${c.label}</strong><small>${c.help}</small></span></label>`).join("")}</div>
    </section>

    <section class="data-card" aria-labelledby="mi-n">
      <h2 id="mi-n">What NASA does today</h2>
      <ul class="fb-facts">
        <li>${src(SUPPORT_FACTS.ppc)}</li>
        <li>${src(SUPPORT_FACTS.always)}</li>
        <li>${src(SUPPORT_FACTS.longMissions)}</li>
      </ul>
    </section>

    <p class="fine rule-note">Ergosphere does not diagnose or treat. Support requests reach crewmates' devices through the team's station sync; delivery to Mission Control is simulated in this prototype. The buttons, reasons and comfort settings are app choices. Sources: docs/SOURCES.md.</p>
  </section>`;

  const root = host.querySelector(".mind");
  const paint = () => {
    const list = [...getAlerts()].reverse().slice(0, 8);
    root.querySelector('[data-ref="alerts"]').innerHTML = list.length ? `<ul class="mind-alerts">${list.map((a) => alertRow(a, me)).join("")}</ul>` : `<p class="fine">No requests yet. Asking early is part of the job, not a failure.</p>`;
  };
  root.addEventListener("click", (e) => {
    if (e.target.closest('[data-mind="support"]')) { openSupport(); return; }
    const c = e.target.closest("[data-close]");
    if (c) { saveAlerts(P.closeAlert(getAlerts(), c.dataset.close)); paint(); document.dispatchEvent(new CustomEvent("ergosphere:alerts")); }
  });
  root.addEventListener("change", (e) => {
    const box = e.target.closest("[data-comfort]");
    if (!box) return;
    const next = { ...P.cleanComfort(read(P.COMFORT_KEY, {})), [box.dataset.comfort]: box.checked };
    try { localStorage.setItem(P.COMFORT_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
    applyComfort(next);
  });
  document.addEventListener("ergosphere:alerts", () => { if (root.isConnected) paint(); });
  paint();
}
