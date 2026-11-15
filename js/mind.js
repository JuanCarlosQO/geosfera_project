// Mind & support (#mind): the psychological side in one place. On top, a 3D brain that maps
// five signals the crew member already produces in the app (sleep, mood, alertness, home,
// support); tap a zone or a chip to read one. Under it: ask to talk (one tap), the family
// channel, and, folded away until wanted, requests, comfort settings, how SOS works and what
// NASA does today. The brain is an illustration drawn by code, not a scan, and the zones are
// a map, not anatomy. Rules: mind-core.js. NASA quotes: data/support.js and docs/SOURCES.md.

import * as P from "./support-core.js";
import * as M from "./mind-core.js";
import { mountBrain } from "./brain3d.js";
import { fold } from "./fold.js";
import { SUPPORT_FACTS, LEVELS, COMFORT, REASONS } from "./data/support.js";
import { STATUS } from "./data/body-systems.js";
import { RANGES } from "./data/vital-ranges.js";
import { KIT } from "./data/med-kit.js";
import { SUPPLEMENTS } from "./data/supplements.js";
import { MEDS_KEY, cleanStore } from "./meds-core.js";
import { FAMILY_KEY, cleanBox } from "./family-core.js";
import { getAlerts, saveAlerts, applyComfort } from "./support.js";
import { current, readLog } from "./store.js";
import { familyWaiting } from "./family.js";
import { dateKey, fieldByKey } from "./log-core.js";

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const src = (f) => `<small class="src">“${f.quote}” <a href="${f.url}" target="_blank" rel="noopener">${f.source}</a></small>`;
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const tone = (status) => { const s = STATUS[status] ?? STATUS.none; return `<span class="tone-${s.tone}"><span aria-hidden="true">${s.shape}</span> ${s.word}</span>`; };

const BASIS = {
  ref: `Judged against an Earth reference: <a href="${RANGES.sleepHours.url}" target="_blank" rel="noopener">${RANGES.sleepHours.source}</a>, pending team review.`,
  nasa: "The cautions are quoted from NASA's ISS medical kit list; how many hours a dose counts is an app rule, longer for some medications after the team pharmacist's review.",
  app: "App rule, illustrative. It is not a clinical threshold and it does not diagnose.",
  none: "Nothing is judged until it is logged."
};

function trendHtml(trend, key) {
  const moods = fieldByKey("mood").scale;
  return `<ul class="mind-week" aria-label="Last 7 days">${trend.map((d) => `<li>
    <span class="mw-day">${new Date(`${d.day}T12:00`).toLocaleDateString("en-GB", { weekday: "narrow" })}</span>
    ${key === "mood"
      ? `<span class="mw-mood" data-mood="${d.mood ?? ""}" title="${d.mood ? moods[d.mood - 1] : "Not logged"}">${d.mood ?? "—"}</span>`
      : `<span class="mw-sleep${d.sleep != null && d.sleep < 7 ? " short" : ""}">${d.sleep != null ? d.sleep : "—"}</span>`}
  </li>`).join("")}</ul>`;
}

function alertRow(a, me) {
  const lv = LEVELS[a.level];
  if (a.closedWhy === "mistake") return `<li class="mind-alert" data-level="${a.level}"><p><strong>${lv.short}</strong> · ${a.from.id === me?.id ? "you" : esc(a.from.name)} · ${P.ago(a.at)} · cancelled, sent by mistake</p></li>`;
  const acks = a.acks.length ? a.acks.map((k) => `${esc(k.name)} ${k.kind === "coming" ? "is on the way" : "saw it"}`).join(" · ") : "No answer yet";
  return `<li class="mind-alert" data-level="${a.level}">
    <p><strong>${a.level === "emergency" ? "⯃" : "●"} ${lv.short}</strong> · ${a.from.id === me?.id ? "you" : esc(a.from.name)} · ${P.ago(a.at)}${a.closed ? " · closed" : ""}</p>
    ${a.reasons.length || a.note ? `<p class="fine">${a.reasons.map((id) => REASONS.find((r) => r.id === id)?.label ?? id).join(" · ")}${a.note ? ` — “${esc(a.note)}”` : ""}</p>` : ""}
    <p class="fine">${acks}</p>
    ${a.from.id === me?.id && !a.closed ? `<button type="button" class="textlink" data-close="${a.id}">I'm OK now — close it</button>` : ""}
  </li>`;
}

export function mountMind(host, { talk }) {
  const me = current();
  const today = dateKey();
  const log = readLog();
  const trend = P.mindTrend(log, today, 7);
  const comfort = P.cleanComfort(read(P.COMFORT_KEY, {}));
  const waitingHome = familyWaiting();
  let chosen = null;

  const signalsNow = () => M.mindSignals({
    log, today, me,
    doses: cleanStore(read(MEDS_KEY, null), KIT, SUPPLEMENTS).doses,
    kit: KIT,
    alerts: getAlerts(),
    box: cleanBox(read(FAMILY_KEY, {})),
    scale: fieldByKey("mood").scale
  });

  host.innerHTML = `
  <section class="mind" aria-labelledby="mi-h">
    <p class="eyebrow">Mind &amp; support</p>
    <h1 id="mi-h" tabindex="-1">Your mind today</h1>
    <p class="lede">Isolation, confinement and distance weigh on everyone, differently. Ergosphere compares you with yourself, never with an average, and makes asking for help one tap away.</p>

    <div class="brain-wrap">
      <div class="brain-stage">
        <canvas class="brain-canvas" data-ref="brain" role="img"></canvas>
        <p class="brain-head" data-ref="head" aria-live="polite"></p>
        <p class="brain-tag mono">Illustration · not a scan</p>
        <p class="brain-hint" aria-hidden="true">Drag to turn</p>
      </div>
      <div class="brain-side">
        <div class="brain-signals scroll-row" role="group" aria-label="The five signals" data-ref="signals"></div>
        <div class="brain-detail data-card" data-ref="detail" aria-live="polite"></div>
      </div>
    </div>

    <button type="button" class="mind-help" data-mind="talk"><span aria-hidden="true">♥</span><strong>${LEVELS.talk.label}</strong><small>One tap. Not urgent.</small></button>

    <a class="fb-link mind-family" href="#family"><span>✉ Family channel<small>${waitingHome ? `${waitingHome} sealed ${waitingHome === 1 ? "message" : "messages"} from home` : "Messages from home, opened when you choose"}</small></span><span>Open →</span></a>

    ${fold(`Requests <span class="tab-badge" data-ref="alerts-n">0</span>`, `<div data-ref="alerts"></div>`, { cls: "block" })}
    ${fold("Comfort settings", `<p>Brains differ in how much motion, text and input feel right. Set the app the way that works for you; it stays on this device.</p>
      <div class="mind-comfort">${COMFORT.map((c) => `<label class="mc-row"><input type="checkbox" data-comfort="${c.id}" ${comfort[c.id] ? "checked" : ""}><span><strong>${c.label}</strong><small>${c.help}</small></span></label>`).join("")}</div>`, { cls: "block" })}
    ${fold("Emergency: how SOS works", `<div class="mind-sos"><span class="mind-sos-dot" aria-hidden="true">SOS</span><p>Press and hold the red SOS button for 2 seconds, on any screen, even with the app locked. One gesture, no second step; you can cancel for 10 seconds if it was a mistake.</p></div>
      <p>“${LEVELS.talk.label}” is for everything that is not an emergency: your crew medical officer is asked to reach you and to book a private conference with Earth.</p>`, { cls: "block" })}
    ${fold("What NASA does today", `<ul class="fb-facts mind-nasa">
        ${["ppc", "always", "longMissions", "baseline"].map((k) => `<li>“${SUPPORT_FACTS[k].quote}”</li>`).join("")}
      </ul>
      <p class="fine">All four: <a href="${SUPPORT_FACTS.ppc.url}" target="_blank" rel="noopener">${SUPPORT_FACTS.ppc.source}</a></p>`, { cls: "block" })}

    <p class="fine rule-note">The brain is an illustration drawn by code: it is not a scan, and nothing is measured in anyone's brain. Its zones are a map of five signals from your own log, not a claim about where they happen. Ergosphere does not diagnose or treat. The mood rules, “two in a row” for homesickness, the buttons, reasons and comfort settings are app choices. Support requests reach crewmates' devices through the team's station sync; delivery to Mission Control is simulated in this prototype. Sources: docs/SOURCES.md.</p>
  </section>`;

  const root = host.querySelector(".mind");
  const $ = (r) => root.querySelector(`[data-ref="${r}"]`);
  const brain = mountBrain($("brain"), {
    onPick(zone) { const s = signalsNow().find((x) => x.zones.includes(zone)); if (s) { chosen = s.id; paintMap(); } }
  });

  function detailHtml(s) {
    const week = s.id === "sleep" || s.id === "mood";
    return `<div class="bd-top"><h2>${s.label}</h2>${tone(s.status)}</div>
      <p class="bd-value"><strong>${esc(s.value)}</strong>${s.word ? ` <span>${esc(s.word)}</span>` : ""}${s.usual != null ? ` <span class="bd-usual">your usual ${s.usual} ${s.unit}</span>` : ""}</p>
      <p class="bd-text">${esc(s.text)}</p>
      ${week ? trendHtml(trend, s.id) : ""}
      ${s.href ? `<a class="tm-go" href="${s.href}">${s.cta} →</a>` : ""}
      ${s.alertId ? `<button type="button" class="textlink" data-close="${s.alertId}">I'm OK now — close it</button>` : ""}
      ${fold("How this is judged", `<p class="fine">${BASIS[s.basis]}</p>${week ? `<p class="fine">“Your usual” is your own average over the ${M.RULES.usualDays} days before the last ${M.RULES.recentDays} (app rule), in the spirit of NASA's own approach: “${SUPPORT_FACTS.baseline.quote}” <a href="${SUPPORT_FACTS.baseline.url}" target="_blank" rel="noopener">${SUPPORT_FACTS.baseline.source}</a></p>` : ""}`)}`;
  }

  function paintMap() {
    const signals = signalsNow();
    const all = M.overall(signals);
    chosen ??= M.firstSignal(signals);
    const s = signals.find((x) => x.id === chosen) ?? signals[0];
    const st = STATUS[all.status] ?? STATUS.none;
    $("head").innerHTML = `<span class="tone-${st.tone}" aria-hidden="true">${st.shape}</span> ${esc(all.title)}`;
    $("brain").setAttribute("aria-label", `3D illustration of a brain with five zones. ${all.title}. ${signals.map((x) => `${x.label}: ${(STATUS[x.status] ?? STATUS.none).word}`).join(". ")}.`);
    $("signals").innerHTML = signals.map((x) => { const t = STATUS[x.status] ?? STATUS.none; return `<button type="button" class="bs-chip" data-signal="${x.id}" data-tone="${t.tone}" aria-pressed="${x.id === s.id}"><span class="tone-${t.tone}" aria-hidden="true">${t.shape}</span><span>${x.label}<small>${esc(x.value)}</small></span><span class="sr-only">${t.word}</span></button>`; }).join("");
    $("detail").innerHTML = detailHtml(s);
    brain.set({ zones: M.zoneStatus(signals), selected: s.zones });
  }

  const paintAlerts = () => {
    const list = [...getAlerts()].reverse().slice(0, 8);
    $("alerts-n").textContent = list.filter((a) => !a.closed).length;
    $("alerts").innerHTML = list.length ? `<ul class="mind-alerts">${list.map((a) => alertRow(a, me)).join("")}</ul>` : `<p class="fine">No requests yet. Asking early is part of the job, not a failure.</p>`;
  };
  const paint = () => { paintAlerts(); paintMap(); };

  root.addEventListener("click", (e) => {
    if (e.target.closest('[data-mind="talk"]')) { talk(); return; }
    const chip = e.target.closest("[data-signal]");
    if (chip) { chosen = chip.dataset.signal; paintMap(); return; }
    const c = e.target.closest("[data-close]");
    if (c) { saveAlerts(P.closeAlert(getAlerts(), c.dataset.close)); paint(); document.dispatchEvent(new CustomEvent("ergosphere:alerts")); }
  });
  root.addEventListener("change", (e) => {
    const box = e.target.closest("[data-comfort]");
    if (!box) return;
    const next = { ...P.cleanComfort(read(P.COMFORT_KEY, {})), [box.dataset.comfort]: box.checked };
    try { localStorage.setItem(P.COMFORT_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
    applyComfort(next);
    paintMap();
  });
  document.addEventListener("ergosphere:alerts", function onAlerts() {
    if (root.isConnected) paint(); else { document.removeEventListener("ergosphere:alerts", onAlerts); brain.stop(); }
  });
  paint();
}
