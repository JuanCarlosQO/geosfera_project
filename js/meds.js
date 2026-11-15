// Module 8 — Medication log. It does not prescribe. It logs what the astronaut took, follows
// up on whether it worked, and flags patterns worth raising with the crew medical officer.
// Three steps: what it was for (tap the body), what you took (from NASA's ISS kit list, as
// 3D models, or one of your own), how many. Supplements in the mission plan are logged as
// taken or not. From NASA's Dose Tracker study: a weekly "anything not logged?" question,
// your own and every-day medications (one tap when taken as scheduled), and how strong a
// side effect was.
// Rules: meds-core.js. Words and sources: data/med-kit.js, data/supplements.js, SOURCES.md.

import { researchHtml } from "./research.js";
import { confirmHere } from "./ask.js";
import * as M from "./meds-core.js";
import { RED_FLAGS, KIT, SIDE_EFFECTS, KIT_FACTS } from "./data/med-kit.js";
import { SUPPLEMENTS } from "./data/supplements.js";
import { ZONES, OTHER_NAMES } from "./data/med-zones.js";
import { STATUS } from "./data/body-systems.js";
import { photoFigure, PHOTO_NOTE } from "./anatomy.js";
import { pill3d, enableDrag } from "./pill3d.js";
import { readLog } from "./store.js";
import { sendAlert } from "./support.js";
import { tabsHtml, showTab, fold } from "./fold.js";
import * as Q from "./quicklog-core.js";
import * as BC from "./barcode-core.js";
import { toBundle, bundleJson } from "./fhir-core.js";
import { FLOW_FACTS } from "./data/med-flow.js";
import { snapshot, startFeed } from "./feed.js";
import { current } from "./store.js";
import { missionDay } from "./today-core.js";

const WORKED = {
  yes: { ...STATUS.normal, word: "It worked" },
  partly: { ...STATUS.watch, word: "Partly" },
  no: { ...STATUS.act, word: "Did not work" }
};
const KIT_URL = KIT_FACTS.carried.url;

// The body picture (2:3) sits in the middle of the stage; a spot on it is given in % of the
// picture, and each "what for" button has its own height so none covers the open hands.
const FIG = { left: 12, width: 76, stage: 1.17 }; // stage height = 1.17 x its width
const ON_PHOTO = { sleep: [50, 3.2], head: [54, 6.5], nose: [50.5, 9.6], stomach: [53, 31.5], back: [43.5, 36.5], gut: [50, 39.6], skin: [26.5, 39] };
const BTN_TOP = { sleep: 0, head: 4.5, nose: 11.7, stomach: 16.7, back: 23.4, gut: 59, skin: 59 };
const px = (id) => FIG.left + (ON_PHOTO[id][0] / 100) * FIG.width;
const py = (id) => (ON_PHOTO[id][1] / 100) * ((FIG.width * 1.5) / FIG.stage);

let LIST = KIT; // kit list plus the crew member's own medications, refreshed on every paint
const med = (id) => LIST.find((k) => k.id === id);
const dayWords = (iso) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const zone = (id) => ZONES.find((z) => z.id === id);
const units = (m, n) => `${n} ${m.unit}${n === 1 ? "" : "s"}`;
const link = (url, text) => `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
const quote = (f) => (f?.quote ? `<small class="src">“${f.quote}” ${link(f.url, f.source ?? "Source")}</small>` : "");
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const chip = (x, name, type = "checkbox") => `<label class="chip"><input type="${type}" name="${name}" value="${x.id}"><span>${x.label}</span></label>`;

// the device keeps every crew member's doses; this screen reads and writes only the open profile's
function loadAll() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(M.MEDS_KEY)); } catch { /* start with an empty log */ }
  return M.cleanStore(raw, KIT, SUPPLEMENTS);
}
function load() { return M.forMember(loadAll(), current()?.id ?? ""); }
function save(store) {
  try { localStorage.setItem(M.MEDS_KEY, JSON.stringify(M.mergeMember(loadAll(), current()?.id ?? "", store))); return true; } catch { return false; }
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- quick log: one sentence, typed or spoken ---------- */

const MIC = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>`;
const CAM = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`;
const QUICK_NOTE = "Name what you took, or take a photo of the box's barcode. Nothing is logged until you confirm it.";
const LABELS = "https://api.fda.gov/drug/label.json";

const quickHtml = () => `<form class="quick" novalidate autocomplete="off">
    <label class="mono step-label" for="md-quick">QUICK LOG · SAY IT OR TYPE IT</label>
    <div class="quick-row">
      <input id="md-quick" name="said" type="text" maxlength="${Q.MAX_SAID}" placeholder="two ibuprofen for back pain" enterkeyhint="go" autocapitalize="off" spellcheck="false">
      <button type="button" class="quick-mic" data-med-act="mic" aria-pressed="false" aria-label="Speak instead of typing" hidden>${MIC}</button>
      <label class="quick-mic quick-cam" title="Photo of the box's barcode"><span class="sr-only">Photo of the box's barcode</span>${CAM}<input id="md-cam" type="file" accept="image/*" capture="environment" hidden></label>
      <button type="submit" class="cta main">Read it</button>
    </div>
    <p class="fine" data-ref="quick-note" role="status" aria-live="polite">${QUICK_NOTE}</p>
    ${fold("Why a quick log", `<p>NASA's own medication app for ISS crews collected far more entries than recall interviews, ${quote(FLOW_FACTS.usability)}</p>
      <p>Its authors expect that ${quote(FLOW_FACTS.better)}</p>
      <p>So the shortest path here is one sentence and one tap. The sentence is only read for a medication name, a count and what it was for: Ergosphere never picks a medication from a symptom and never turns milligrams into a number of tablets.</p>
      <p>The camera reads the barcode printed on a medication box and looks it up in the FDA's public label database (openFDA). Only the number is sent, never the photo; a box with two or more active ingredients is never matched to one, and a flight version would carry the kit's barcodes on board.</p>
      ${researchHtml(["Rx_Metabolism", "Sleep_Meds_Pilot", "Sleep_Meds_Phase_II"])}
      <p class="voice-note" hidden>Voice uses this browser's speech recognition, which may send the audio to the browser maker's servers; a flight version would recognise speech on board. Typing stays on this device.</p>`)}
  </form>
  <div data-ref="draft" aria-live="polite"></div>`;

/* ---------- what is logged next to a dose ---------- */

function missionDayOn(at) {
  let start = null;
  try { start = JSON.parse(localStorage.getItem("geosfera.mission"))?.start ?? null; } catch { /* no mission start saved */ }
  return start ? missionDay(start, at) : null;
}

/** Readings of the moment for one entry. A dose remembered later gets that day's log, not today's sensors. */
function contextFor(store, m, when) {
  const co2 = when.recalled ? null : (snapshot() ?? startFeed())?.readout?.channels?.co2?.value ?? null;
  return M.logContext({ med: m, doses: store.doses, kit: LIST, now: when.at, log: readLog(), co2, missionDay: missionDayOn(when.at) });
}

function contextHtml(ctx, added, recalled) {
  return `<div class="ctx">
    <p class="mono step-label">LOGGED WITH THIS ENTRY</p>
    <dl class="ctx-rows">${ctx.rows.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}${r.simulated ? ` <span class="sim">SIMULATED</span>` : ""}</dd></div>`).join("")}</dl>
    ${recalled ? `<p class="fine">Remembered later: the sensors' readings of today are not attached.</p>` : ""}
    ${added.length ? `<div class="ctx-raise"><p><strong>${STATUS.watch.shape} This entry adds to “Patterns to raise”.</strong> It is still logged as you took it.</p>${added.map((p) => `<p>${p.text}${p.quote ? ` “${p.quote}” ${link(p.url, p.source ?? "NASA kit list")}` : ""}${p.illustrative ? ` <span class="fine">Illustrative app rule.</span>` : ""}</p>`).join("")}</div>` : ""}
    <p class="fine">Readings, not reasons. Ergosphere does not say what caused a symptom or what to take: your crew medical officer reads them together.</p>
  </div>`;
}

const beforeHtml = (m) => (m.beforeTaking ? `<strong>Before you take it.</strong> ${m.beforeTaking} <span class="fine">Pharmacist review (${m.reviewedBy}).</span>` : "");

function draftHtml(d) {
  const m = d.med;
  const differs = Q.strengthDiffers(d.strength, m);
  const counts = [...new Set([1, 2, 3, d.units].filter(Boolean))].sort((a, b) => a - b);
  const picked = d.units ?? (differs ? null : 1);
  return `<div class="draft">
    <p class="mono step-label">CHECK IT · NOTHING IS LOGGED YET</p>
    <p class="draft-said">${d.via === "photo" ? `From the box's barcode ${esc(d.box.code)}: <span data-no-i18n>${esc(d.box.names || "label found")}</span>` : `${d.via === "voice" ? "Heard" : "Read"}: “${esc(d.said)}”`}</p>
    <div class="draft-med">${pill3d(m, 64)}<div><strong>${esc(m.name)}</strong><span class="mono">${m.own ? "your own" : `${m.strength}${m.rx ? " · Rx" : ""}`}</span>${d.close ? `<span class="fine">Closest name to “${esc(d.word)}”. Not it? Cancel and try again.</span>` : !Q.norm(m.name).includes(d.word) ? `<span class="fine">“${esc(d.word)}” is listed here as ${esc(m.name)}.</span>` : ""}</div></div>
    ${differs ? `<p class="before-take"><strong>You said ${esc(d.strength)}.</strong> The log counts ${m.unit}s, and the kit's ${m.unit} is ${m.strength}. Ergosphere does not convert one into the other: choose how many you took.</p>` : ""}
    ${m.beforeTaking ? `<p class="before-take">${beforeHtml(m)}</p>` : ""}
    <p class="fu-sub">How many</p>
    <div class="chips" role="radiogroup" aria-label="How many">${counts.map((n) => `<label class="chip"><input type="radio" name="d-units" value="${n}" ${n === picked ? "checked" : ""}><span>${units(m, n)}</span></label>`).join("")}</div>
    <p class="fu-sub">What for</p>
    <div class="chips" role="radiogroup" aria-label="What it was for">${ZONES.map((z) => `<label class="chip"><input type="radio" name="d-zone" value="${z.id}" ${z.id === d.zoneId ? "checked" : ""}><span>${z.reason}</span></label>`).join("")}</div>
    <label class="when"><span>When</span><select name="d-when">${M.WHEN.map((w) => `<option value="${w.id}">${w.label}</option>`).join("")}</select></label>
    <div data-ref="draft-ctx"></div>
    <div class="sp-acts"><button type="button" class="cta main" data-med-act="draft-log">Log it</button><button type="button" class="cta" data-med-act="draft-cancel">Cancel</button></div>
  </div>`;
}

/* ---------- step 1: what it was for ---------- */

function stageHtml() {
  const lines = ZONES.map((z) => `<line data-zone-line="${z.id}" x1="${z.side === "left" ? 23 : 77}" y1="${BTN_TOP[z.id] + 4.6}" x2="${px(z.id).toFixed(1)}" y2="${py(z.id).toFixed(1)}"/>`).join("");
  const dots = ZONES.map((z) => `<span class="zone-dot" data-zone-dot="${z.id}" style="left:${px(z.id).toFixed(1)}%;top:${py(z.id).toFixed(1)}%" aria-hidden="true"></span>`).join("");
  const labels = ZONES.map((z) => `<button type="button" class="zone-btn" data-zone="${z.id}" data-side="${z.side}" style="top:${BTN_TOP[z.id]}%" aria-pressed="false">${z.label}</button>`).join("");
  return `<div class="body-stage with-photo" data-ref="stage">
    <div class="stage-fig" aria-hidden="true">${photoFigure()}</div>
    <svg class="zone-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
    ${dots}${labels}
  </div>
  <p class="fine stage-note">${PHOTO_NOTE}</p>`;
}

/* ---------- steps 2 and 3: what you took, how many ---------- */

const takeOpt = (m) => `<label class="take-opt">
        <input type="radio" name="take" value="${m.id}">
        ${pill3d(m, 78)}
        <strong>${esc(m.name)}</strong>
        <span class="mono">${m.own ? (m.daily ? "your own · every day" : "your own") : `${m.strength}${m.rx ? " · Rx" : ""}`}</span>
      </label>`;

function pickHtml(z) {
  const meds = M.inCategories(KIT, z.categories);
  const own = LIST.filter((m) => m.own && !m.removed);
  const cats = [...new Set(meds.map((m) => m.category))];
  return `<div class="zone-panel">
    <div class="zone-head"><div><p class="mono">STEP 1 · WHAT FOR</p><h2>${z.reason}</h2></div><button type="button" class="textlink" data-med-act="close">Change</button></div>
  </div>
  <div class="log-step">
    <p class="mono step-label">STEP 2 · WHAT YOU TOOK</p>
    <p class="fine">NASA's ISS medical kit list, category “${cats.join("”, “")}”. ${link(KIT_URL, "NASA kit list")}</p>
    <div class="take-grid" role="radiogroup" aria-label="Medication you took">
      ${meds.map(takeOpt).join("")}
      ${own.map(takeOpt).join("")}
    </div>
    <button type="button" class="textlink own-add-link" data-med-act="goto-own">+ Not in the list? Add one of your own</button>
  </div>
  <div class="log-step" data-ref="howmany" hidden>
    <p class="mono step-label">STEP 3 · HOW MANY</p>
    <p class="before-take" data-ref="before" hidden></p>
    <div class="chips" role="radiogroup" aria-label="How many">${[1, 2, 3].map((n) => `<label class="chip"><input type="radio" name="units" value="${n}" ${n === 1 ? "checked" : ""}><span data-unit-label="${n}">${n}</span></label>`).join("")}</div>
    <label class="when"><span>When</span><select name="when">${M.WHEN.map((w) => `<option value="${w.id}">${w.label}</option>`).join("")}</select></label>
    <div data-ref="ctx"></div>
    <button type="button" class="cta main log-btn" data-med-act="log">Log it</button>
  </div>`;
}

const HINT = `<div class="hint"><p><strong>Log something you took</strong></p><p>Step 1: tap what it was for on the figure.</p></div>`;

/* ---------- follow-up ---------- */

function weeklyHtml(store, now) {
  if (!M.weeklyDue(store, now)) return "";
  return `<div class="followup weekly">
    <p class="mono step-label">ONCE A WEEK</p>
    <p class="fu-q"><strong>Did you take anything in the last 7 days that is not in your log?</strong><br>From the kit, your own medications, vitamins: anything.</p>
    <div class="sp-acts"><button type="button" class="cta main" data-med-act="week-yes">Yes, add it</button><button type="button" class="cta" data-med-act="week-none">No, nothing</button></div>
    <p class="fine">Why every week, from NASA's own medication app for ISS crews: ${quote(KIT_FACTS.weekly)}</p>
  </div>`;
}

function scheduledHtml(store, today) {
  return M.scheduledToday(store, today).filter((x) => !x.taken).map(({ own }) => {
    const m = med(own.id);
    return `<div class="followup sched">
      <div class="fu-top">${pill3d(m, 48)}<p class="fu-q"><span class="mono">EVERY DAY · YOUR OWN</span><br><strong>${esc(m.name)}</strong> · today</p></div>
      <button type="button" class="cta main" data-sched="${m.id}">✓ Took it as scheduled</button>
    </div>`;
  }).join("");
}

function followUpHtml(store, now) {
  const { due, later } = M.followUps(store.doses, LIST, now);
  const cards = due.map(({ dose }) => {
    const m = med(dose.medId);
    const effects = M.effectsFor(m).map((label, i) => ({ id: `k${i}`, label }));
    const name = esc(m.name);
    return `<form class="followup" data-dose="${dose.id}">
      <div class="fu-top">${pill3d(m, 56)}<p class="fu-q"><strong>Did it work?</strong><br>${name} · ${units(m, dose.units)} · ${dose.recalled ? `${dayWords(dose.at)} (remembered later)` : `${M.spanWords(dose.at, now)} ago`}${dose.reason ? ` · for ${dose.reason.toLowerCase()}` : ""}</p></div>
      <div class="chips" role="radiogroup" aria-label="How it went">${M.OUTCOMES.map((o) => chip(o, "worked", "radio")).join("")}</div>
      <p class="fu-sub">Did you notice any of these? <span class="fine">${m.own ? "One of your own: NASA's kit list has no side-effect list for it." : effects.length ? `Possible side effects NASA's kit list gives for ${name.toLowerCase()}.` : `NASA's kit list gives no significant side effects for ${name.toLowerCase()}.`}</span></p>
      <div class="chips">${[...effects, ...SIDE_EFFECTS].map((x) => chip(x, "effect")).join("")}</div>
      <div class="fu-sev" hidden>
        <p class="fu-sub">How strong was it?</p>
        <div class="chips" role="radiogroup" aria-label="How strong">${M.SEVERITY.map((x) => `<label class="chip"><input type="radio" name="severity" value="${x.id}"><span>${x.label} <small>· ${x.hint}</small></span></label>`).join("")}</div>
        ${quote(KIT_FACTS.severity)}
      </div>
      <button type="submit" class="cta main">Save answer</button>
      <p class="step-msg" role="status" aria-live="polite"></p>
    </form>`;
  }).join("");
  const waiting = later.map(({ dose, askAt }) => `<p class="fine">Ergosphere will ask whether ${esc(med(dose.medId).name.toLowerCase())} worked in ${M.spanWords(now, askAt)}.</p>`).join("");
  return cards + waiting;
}

/* ---------- patterns ---------- */

function patternsHtml(store, now) {
  const list = M.patterns(store, LIST, now, readLog());
  if (!list.length) return `<p class="calm-line">${STATUS.normal.shape} Nothing to raise right now.</p>`;
  return `<ul class="patterns">${list.map((p) => `<li class="pattern" data-level="${p.level}">
    <p class="pt-head">${p.level === "talk" ? `${STATUS.watch.shape} ${M.LEVELS.talk}` : `↗ ${M.LEVELS.downlink}`}</p>
    <p>${p.text}${p.quote ? ` “${p.quote}” ${link(p.url, p.source ?? "NASA kit list")}` : ""}</p>
    ${p.illustrative ? `<p class="fine">Illustrative app rule, not a NASA limit.</p>` : ""}
    ${p.level === "talk" ? (store.raised?.[p.id]
      ? `<p class="pt-sent">${STATUS.logged.shape} Sent to your crew medical officer · ${new Date(store.raised[p.id]).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>`
      : `<button type="button" class="cta pt-send" data-raise="${p.id}">Tell the crew medical officer</button>`) : ""}
    ${p.reviewed ? `<p class="fine">From the team pharmacist's review (${typeof p.reviewed === "string" ? p.reviewed : "team"}), not a NASA quote.</p>` : ""}
  </li>`).join("")}</ul>`;
}

/* ---------- supplements ---------- */

function supplementsHtml(store, today) {
  return SUPPLEMENTS.map((s) => {
    const days = M.supplementDays(store, s.id, today, 7);
    const taken = days.at(-1).taken;
    return `<div class="supp">
      <div class="supp-top">
        <div><p class="mono">IN YOUR MISSION PLAN · ${s.plan.toUpperCase()}</p><h3>${s.name}</h3></div>
        <button type="button" class="cta ${taken ? "" : "main"}" data-supp="${s.id}" aria-pressed="${taken}">${taken ? "✓ Taken today" : "Mark as taken today"}</button>
      </div>
      <ul class="supp-week" aria-label="Last 7 days">${days.map((d) => `<li class="${d.taken ? "on" : ""}" title="${d.day}${d.taken ? ": taken" : ""}"><span>${new Date(`${d.day}T12:00`).toLocaleDateString("en-GB", { weekday: "narrow" })}</span></li>`).join("")}</ul>
      <p class="supp-why">${s.why.text}</p>
      ${s.why.facts.map(quote).join("")}
      <p class="fine">Logged as taken or not. There is no “Did it work?” for a supplement: its effect does not show the next day.</p>
    </div>`;
  }).join("");
}

/* ---------- your own medications ---------- */

function ownHtml() {
  const own = LIST.filter((m) => m.own && !m.removed);
  if (!own.length) return `<p class="fine">None yet.</p>`;
  return `<ul class="doses own-list">${own.map((m) => `<li><span><strong>${esc(m.name)}</strong> <span class="mono">${m.unit} · ${m.daily ? "every day" : "when needed"}</span></span>
    <button type="button" class="textlink danger" data-own-remove="${m.id}">Remove</button></li>`).join("")}</ul>`;
}

/* ---------- history ---------- */

function recordHtml(store) {
  const doses = [...store.doses].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);
  if (!doses.length) return `<p class="fine">Nothing logged yet.</p>`;
  return `<ul class="doses">${doses.map((d) => {
    const m = med(d.medId);
    const w = d.outcome ? WORKED[d.outcome.worked] : null;
    const fx = (d.outcome?.effects ?? []).filter((e) => e !== "Nothing");
    const sev = d.outcome?.severity ? ` (${d.outcome.severity})` : "";
    const how = d.recalled ? " · remembered later" : "";
    const rated = w ? `<span class="tone-${w.tone}">${w.shape} ${w.word}${fx.length ? ` · ${esc(fx.join(", ").toLowerCase())}${sev}` : ""}</span>`
      : d.scheduled ? `<span class="tone-normal">${STATUS.logged?.shape ?? "✓"} Taken as scheduled</span>` : `<span class="tone-none">${STATUS.pending.shape} Not rated yet</span>`;
    return `<li><span class="mono">${d.recalled ? `${d.at.slice(0, 10)} (day)` : `${d.at.slice(0, 16).replace("T", " ")} UTC`}</span>
      <span>${esc(m.name)} · ${units(m, d.units)}${d.reason ? ` · ${esc(d.reason.toLowerCase())}` : ""}${how}</span>
      ${rated}</li>`;
  }).join("")}</ul>`;
}

export function mountMeds(host) {
  let store = load();
  let open = null;
  let draft = null; // the quick-log entry being checked: { said, med, units, strength, zoneId, close, via }
  let rec = null;   // speech recognition while it listens

  host.innerHTML = `
  <section class="meds" aria-labelledby="md-title">
    <p class="eyebrow">Module 8 · Medication log</p>
    <h1 id="md-title" tabindex="-1">What did you take?</h1>
    <p class="lede">It does not prescribe. It logs what you took, follows up on whether it worked, and flags patterns worth raising with your crew medical officer.</p>

    <div data-ref="due" aria-live="polite"></div>

    ${tabsHtml("meds", [
      { id: "log", label: "Log a dose", html: `${quickHtml()}
    <div class="meds-main">
      <div class="meds-left">
        ${stageHtml()}
        <form class="alarm" novalidate autocomplete="off">
          <p class="alarm-h"><strong>Alarm signs.</strong> Any of these? Tap it.</p>
          <div class="chips">${RED_FLAGS.map((f) => chip(f, "flag")).join("")}</div>
          <div data-ref="alarm"></div>
        </form>
      </div>
      <div class="meds-right">
        <div data-ref="panel" aria-live="polite">${HINT}</div>
        <p class="step-msg" data-ref="msg" role="status" aria-live="polite"></p>
        <section class="data-card" aria-labelledby="pt-h">
          <h2 id="pt-h">Patterns to raise</h2>
          <div data-ref="patterns"></div>
          <p class="fine">Why follow up early: ${quote(KIT_FACTS.surveillance)}</p>
        </section>
      </div>
    </div>` },
      { id: "supps", label: "Supplements", html: `<section class="data-card" aria-labelledby="sp-h">
      <h2 id="sp-h">Supplements</h2>
      <div data-ref="supps"></div>
    </section>` },
      { id: "own", label: "Your own", html: `<section class="data-card" aria-labelledby="own-h" data-ref="own-card">
      <h2 id="own-h">Your own medications</h2>
      <p>From your personal pack, outside NASA's kit list, so they go in the same log. ${quote(KIT_FACTS.own)}</p>
      <div data-ref="own"></div>
      <form class="own-form" novalidate autocomplete="off">
        <div class="cf-row">
          <label class="cf-field"><span>Name</span><input name="name" type="text" maxlength="40" placeholder="e.g. Allergy tablet"></label>
          <label class="cf-field"><span>Comes as</span><select name="unit">${M.OWN_UNITS.map((u) => `<option>${u}</option>`).join("")}</select></label>
          <button type="submit" class="cta main cf-add">Add</button>
        </div>
        <label class="chip own-daily"><input type="checkbox" name="daily"><span>I take it every day</span></label>
        <p class="step-msg" data-ref="own-msg" role="status" aria-live="polite"></p>
      </form>
      <p class="fine">Every-day ones appear at the top each day: one tap if you took it as scheduled. Dose Tracker's chronic medications ${quote(KIT_FACTS.scheduled)}</p>
    </section>` },
      { id: "record", label: "History", html: `<section class="data-card" aria-labelledby="rec-h">
      <h2 id="rec-h">Your log</h2>
      <p>It stays on this device. ${KIT_FACTS.record.text}${quote(KIT_FACTS.record)}</p>
      <div data-ref="record"></div>
      <div class="data-btns"><button type="button" class="cta" data-med-act="csv">Export CSV</button><button type="button" class="textlink" data-med-act="reset">Clear the demo log</button></div>
    </section>
    <section class="data-card" aria-labelledby="fs-h">
      <h2 id="fs-h">For the flight surgeon</h2>
      <p>Your log as HL7 FHIR R4 <em>MedicationStatement</em> records, a standard health-record format. It holds what you say you took, never an instruction.</p>
      <p data-ref="queue"></p>
      <div class="data-btns"><button type="button" class="cta" data-med-act="fhir">Export FHIR (JSON)</button></div>
      ${fold("About this format", `<p>What a MedicationStatement is: ${quote(FLOW_FACTS.fhirWhat)}</p>
      <p>Who may report it: ${quote(FLOW_FACTS.fhirSource)}</p>
      <p>Crews already used NASA's own medication app ${quote(FLOW_FACTS.share)}</p>
      <p>That study stopped early: ${quote(FLOW_FACTS.ended)}</p>`)}
      <p class="fine"><span class="sim">SIMULATED</span> link. Ergosphere has no connection to the ground: the file is what would wait for the next link window, and nothing leaves this device until you export it. Medications and reasons are written as text, with no clinical codes.</p>
    </section>` }
    ])}

    <a class="duty-link" href="#duty"><span>Fit for duty check<small>Before a spacewalk, docking or another critical task</small></span><span>Open →</span></a>

    <p class="fine rule-note">Ergosphere never suggests a medication or a dose and never interprets a symptom. The quick log only reads the words you say; the readings stored next to an entry are facts for your crew medical officer, with no conclusion drawn. Names and categories come from NASA's ISS medical kit list (2015); the 3D shapes are illustrations, not the real products. Warnings quote that list or are marked as illustrative app rules; the waiting time before "Did it work?" and the alarm-sign list are app rules too. Sources: docs/SOURCES.md.</p>
  </section>`;

  const root = host.querySelector(".meds");
  const $ = (r) => root.querySelector(`[data-ref="${r}"]`);
  const stage = $("stage");

  function lightZone(id) {
    const z = id ? zone(id) : null;
    stage.classList.toggle("focused", Boolean(z));
    stage.querySelectorAll(".region").forEach((r) => r.classList.toggle("lit", Boolean(z?.lit.includes(r.dataset.region))));
    stage.querySelectorAll("[data-zone]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zone === id)));
    stage.querySelectorAll("[data-zone-dot]").forEach((d) => d.classList.toggle("on", d.dataset.zoneDot === id));
    stage.querySelectorAll("[data-zone-line]").forEach((l) => l.classList.toggle("on", l.dataset.zoneLine === id));
  }

  function openZone(id) {
    open = id;
    lightZone(id);
    $("panel").innerHTML = pickHtml(zone(id));
    if (matchMedia("(max-width: 859px)").matches) $("panel").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  function closeZone() {
    open = null;
    lightZone(null);
    $("panel").innerHTML = HINT;
  }

  const picked = (name) => root.querySelector(`input[name="${name}"]:checked`)?.value;
  const quickNote = (text) => { $("quick-note").textContent = text; };

  /** The tap-by-tap entry as it stands, or null while no medication is picked. */
  function stepEntry() {
    const medId = picked("take");
    if (!medId) return null;
    const when = M.whenToAt(root.querySelector('select[name="when"]')?.value ?? "0");
    return { m: med(medId), when, entry: { medId, units: Number(picked("units") ?? 1), reason: zone(open)?.reason ?? null, ...when } };
  }

  function draftEntry() {
    const when = M.whenToAt(root.querySelector('select[name="d-when"]')?.value ?? "0");
    const n = Number(picked("d-units"));
    return { m: draft.med, when, entry: { medId: draft.med.id, units: Number.isInteger(n) && n > 0 ? n : null, reason: zone(picked("d-zone"))?.reason ?? null, said: draft.said, ...when } };
  }

  /** Fills "Logged with this entry" for whichever entry is on screen and returns its snapshot. */
  function paintContext(ref, x) {
    const ctx = contextFor(store, x.m, x.when);
    const added = x.entry.units ? M.patternsAfter(store, LIST, x.entry, new Date(), readLog()) : [];
    if ($(ref)) $(ref).innerHTML = contextHtml(ctx, added, x.when.recalled);
    return ctx.snapshot;
  }

  function closeDraft() {
    draft = null;
    $("draft").innerHTML = "";
  }

  function readQuick(text, via) {
    LIST = M.medList(KIT, store);
    const p = Q.parseQuick(text, LIST, ZONES, OTHER_NAMES);
    if (!p.said) { quickNote("Say or type what you took, for example “two ibuprofen for back pain”."); return; }
    if (!p.med) {
      closeDraft();
      if (p.zone) { openZone(p.zone.id); quickNote(`No medication name in that. Opened “${p.zone.reason}”: pick what you took below.`); }
      else quickNote("No medication from the kit list or your own list in that. Say its name, or tap the figure below.");
      return;
    }
    closeZone();
    draft = { ...p, zoneId: p.zone?.id ?? null, via };
    $("draft").innerHTML = draftHtml(draft);
    paintContext("draft-ctx", draftEntry());
    quickNote(QUICK_NOTE);
    $("draft").scrollIntoView({ block: "nearest" });
  }

  /** A photo of the box: its barcode (the browser's own reader, else ours) looked up in openFDA. */
  async function fromPhoto(file) {
    quickNote("Reading the barcode…");
    let code = null;
    try {
      const bmp = await createImageBitmap(file);
      if ("BarcodeDetector" in globalThis) {
        try { code = (await new globalThis.BarcodeDetector({ formats: ["ean_13", "upc_a"] }).detect(bmp))[0]?.rawValue ?? null; } catch { /* use our own reader */ }
      }
      if (!code) {
        const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
        const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
        const cv = Object.assign(document.createElement("canvas"), { width: w, height: h });
        const cx = cv.getContext("2d", { willReadFrequently: true });
        cx.drawImage(bmp, 0, 0, w, h);
        const px = cx.getImageData(0, 0, w, h).data, gray = new Uint8Array(w * h);
        for (let i = 0; i < gray.length; i += 1) gray[i] = (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000;
        code = BC.decodeGray(gray, w, h);
      }
    } catch { /* not an image this browser can open */ }
    if (!code) { quickNote("No barcode found in that photo. Fill the picture with the barcode, in good light and in focus, or say or type the name."); return; }
    quickNote(`Barcode ${code}: looking it up in openFDA…`);
    let label = null;
    for (const upc of BC.upcForms(code)) {
      try {
        const r = await fetch(`${LABELS}?search=openfda.upc:%22${upc}%22&limit=1`, { cache: "no-store" });
        if (r.ok) { label = (await r.json()).results?.[0]?.openfda ?? null; if (label) break; }
      } catch { quickNote("Could not reach openFDA (offline?). Say or type the name."); return; }
    }
    if (!label) { quickNote(`Barcode ${code} is not in openFDA's labels. Say or type the name.`); return; }
    LIST = M.medList(KIT, store);
    const hit = BC.medFromLabel(label, LIST);
    if (!hit.med) { quickNote(`${hit.names || `Barcode ${code}`}: ${hit.why}`); return; }
    closeZone();
    draft = { said: "", med: hit.med, close: false, d: 0, word: Q.norm(hit.med.name), units: null, strength: null, zone: null, zoneId: null, via: "photo", box: { code, names: hit.names } };
    $("draft").innerHTML = draftHtml(draft);
    paintContext("draft-ctx", draftEntry());
    quickNote(QUICK_NOTE);
    $("draft").scrollIntoView({ block: "nearest" });
  }
  root.querySelector("#md-cam")?.addEventListener("change", (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) fromPhoto(f); });

  const SR = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;
  const speechLang = () => {
    let lang = "en";
    try { lang = localStorage.getItem("geosfera.lang") ?? "en"; } catch { /* storage blocked */ }
    if (lang !== "es") return "en-US";
    return (navigator.languages ?? [navigator.language]).find((l) => /^es-/i.test(l)) ?? "es-CO";
  };
  if (SR) {
    root.querySelector(".quick-mic").hidden = false;
    root.querySelector(".voice-note").hidden = false;
  }

  function listen() {
    const mic = root.querySelector(".quick-mic"), input = root.querySelector("#md-quick");
    if (rec) { rec.stop(); return; }
    let heard = "";
    try {
      rec = new SR();
      // listen in the language the app is in (it was always English, so Spanish was misheard)
      rec.lang = speechLang();
      rec.interimResults = true;
      rec.maxAlternatives = 5; // several guesses: the one that names a medication wins (quicklog-core bestHeard)
      rec.onresult = (ev) => {
        const all = [...ev.results];
        const clean = (t) => t.replace(/\s+/g, " ").trim().slice(0, Q.MAX_SAID);
        input.value = clean(all.map((r) => r[0].transcript).join(" "));
        if (!all.length || !all.every((r) => r.isFinal)) return;
        // each guess of the whole sentence: the other pieces keep their best guess
        const guesses = [];
        for (let a = 0; a < 5; a += 1) for (let i = 0; i < all.length; i += 1) {
          if (!all[i][a]) continue;
          guesses.push(clean(all.map((r, j) => (j === i ? r[a] : r[0]).transcript).join(" ")));
        }
        const best = Q.bestHeard([...new Set(guesses)], M.medList(KIT, store), ZONES, OTHER_NAMES);
        heard = best?.text ?? input.value;
        input.value = heard;
      };
      rec.onerror = (ev) => {
        quickNote(ev.error === "not-allowed" || ev.error === "service-not-allowed" ? "The microphone is blocked for this page. Type it instead."
          : ev.error === "no-speech" ? "Nothing heard. Tap the microphone and try again, or type it." : "Voice did not work here. Type it instead.");
      };
      rec.onend = () => {
        rec = null;
        mic.setAttribute("aria-pressed", "false");
        if (heard) readQuick(heard, "voice");
      };
      rec.start();
      mic.setAttribute("aria-pressed", "true");
      quickNote("Listening… say the medication, how many, and what it was for. Speak the name clearly; you can correct it before saving.");
    } catch {
      rec = null;
      mic.setAttribute("aria-pressed", "false");
      quickNote("Voice did not work here. Type it instead.");
    }
  }

  function paint(keepMsg = false) {
    const now = new Date();
    LIST = M.medList(KIT, store);
    $("due").innerHTML = weeklyHtml(store, now) + scheduledHtml(store, M.dayOf(now)) + followUpHtml(store, now);
    $("own").innerHTML = ownHtml();
    $("patterns").innerHTML = patternsHtml(store, now);
    $("supps").innerHTML = supplementsHtml(store, M.dayOf(now));
    $("record").innerHTML = recordHtml(store);
    const waiting = M.queued(store).length;
    $("queue").innerHTML = !store.doses.length ? "Nothing logged yet." : waiting ? `<strong>${waiting} of ${store.doses.length}</strong> ${store.doses.length === 1 ? "entry" : "entries"} waiting for the next export.` : `Nothing waiting: all ${store.doses.length} ${store.doses.length === 1 ? "entry is" : "entries are"} in your last export.`;
    if (!keepMsg) $("msg").textContent = "";
  }

  root.addEventListener("change", (e) => {
    if (e.target.name === "take") {
      const m = med(e.target.value);
      $("howmany").hidden = false;
      root.querySelectorAll("[data-unit-label]").forEach((s) => { s.textContent = units(m, Number(s.dataset.unitLabel)); });
      $("before").innerHTML = beforeHtml(m);
      $("before").hidden = !m.beforeTaking;
      paintContext("ctx", stepEntry());
      $("howmany").scrollIntoView({ block: "nearest" });
    }
    if (["units", "when"].includes(e.target.name) && stepEntry()) paintContext("ctx", stepEntry());
    if (["d-units", "d-zone", "d-when"].includes(e.target.name) && draft) paintContext("draft-ctx", draftEntry());
    if (e.target.name === "effect") {
      const form = e.target.closest(".followup");
      const real = [...form.querySelectorAll('input[name="effect"]:checked')].some((i) => i.value !== "none");
      form.querySelector(".fu-sev").hidden = !real;
    }
    if (e.target.name === "flag") {
      const flags = M.redFlags(RED_FLAGS, [...root.querySelectorAll('input[name="flag"]:checked')].map((i) => i.value));
      $("alarm").innerHTML = flags.length ? `<p class="result act"><strong>${STATUS.act.shape} ${STATUS.act.word}.</strong> ${flags.map((f) => f.label).join(", ")}: talk to your crew medical officer or the flight surgeon now. Ergosphere does not handle this.</p>` : "";
    }
  });

  root.addEventListener("click", (e) => {
    const z = e.target.closest("[data-zone]");
    if (z) { if (open === z.dataset.zone) closeZone(); else openZone(z.dataset.zone); return; }
    const rz = e.target.closest("[data-raise]");
    if (rz) {
      const p = M.patterns(store, LIST, new Date(), readLog()).find((x) => x.id === rz.dataset.raise);
      const sent = p && sendAlert("talk", { reasons: ["body"], note: M.patternNote(p) });
      if (sent) { store = M.markRaised(store, p.id); save(store); paint(true); $("msg").textContent = "Sent. Linked crew devices show it now; your crew medical officer is asked to reach you."; }
      return;
    }
    const sc = e.target.closest("[data-sched]");
    if (sc) {
      const r = M.logDose(store, LIST, { medId: sc.dataset.sched, units: 1, reason: "As scheduled", scheduled: true });
      if (r.ok) { store = r.store; save(store); paint(true); $("msg").textContent = `Logged: ${med(sc.dataset.sched).name}, as scheduled.`; }
      return;
    }
    const rm = e.target.closest("[data-own-remove]");
    if (rm) {
      const m = med(rm.dataset.ownRemove);
      if (m) confirmHere(rm, `Take ${m.name} off your list? Past doses stay in the log.`).then((yes) => { if (yes) { store = M.removeOwn(store, m.id); save(store); paint(); } });
      return;
    }
    const sp = e.target.closest("[data-supp]");
    if (sp) {
      store = M.markSupplement(store, sp.dataset.supp, M.dayOf(), sp.getAttribute("aria-pressed") !== "true");
      save(store);
      paint();
      return;
    }
    const t = e.target.closest("[data-med-act]");
    if (!t) return;
    const act = t.dataset.medAct;
    if (act === "close") { closeZone(); stage.scrollIntoView({ block: "nearest" }); return; }
    if (act === "mic") { listen(); return; }
    if (act === "draft-cancel") { closeDraft(); quickNote(QUICK_NOTE); root.querySelector("#md-quick").focus({ preventScroll: true }); return; }
    if (act === "draft-log") {
      if (!draft) return;
      const x = draftEntry();
      if (!x.entry.units) { $("msg").textContent = "Choose how many you took."; $("msg").scrollIntoView({ block: "nearest" }); return; }
      const r = M.logDose(store, LIST, { ...x.entry, context: paintContext("draft-ctx", x) });
      if (!r.ok) { $("msg").textContent = r.why; return; }
      store = r.store;
      if (!save(store)) { $("msg").textContent = "This browser blocked saving. The dose was not stored."; return; }
      const m = x.m;
      closeDraft();
      root.querySelector("#md-quick").value = "";
      paint(true);
      $("msg").textContent = x.when.recalled
        ? `Logged for ${dayWords(x.when.at.toISOString())}: ${m.name}, ${units(m, x.entry.units)}, marked as remembered later. Did it work? is waiting at the top.`
        : `Logged: ${m.name}, ${units(m, x.entry.units)}. Ergosphere will ask whether it worked in ${M.spanWords(new Date(), new Date(Date.now() + m.askAfterHours * 3600000))}.`;
      $("msg").scrollIntoView({ block: "nearest" });
      return;
    }
    if (act === "fhir") {
      if (!store.doses.length) { $("msg").textContent = "Nothing to export yet."; return; }
      download(`ergosphere-medications-${M.dayOf()}.fhir.json`, bundleJson(toBundle(store.doses, LIST, { who: `${current()?.name ?? "Crew member"} (simulated crew profile)` })), "application/fhir+json");
      store = M.markExported(store, store.doses.map((d) => d.id));
      save(store);
      paint(true);
      return;
    }
    if (act === "csv") { download(`ergosphere-medications-${M.dayOf()}.csv`, M.toCsv(store.doses, LIST), "text/csv"); return; }
    if (act === "goto-own") { showTab(root, "meds", "own"); $("own-card").scrollIntoView({ block: "start" }); root.querySelector('.own-form input[name="name"]').focus({ preventScroll: true }); return; }
    if (act === "week-none" || act === "week-yes") {
      store = M.answerWeekly(store, act === "week-none" ? "none" : "yes");
      save(store);
      paint(true);
      $("msg").textContent = act === "week-none" ? "Noted for this week. Thank you." : "Tap what it was for on the figure, pick what you took, and choose the day under “When”.";
      if (act === "week-yes") { showTab(root, "meds", "log"); stage.scrollIntoView({ block: "nearest" }); }
      return;
    }
    if (act === "reset") { store = M.emptyStore(); save(store); paint(); $("msg").textContent = "Demo log cleared."; return; }
    if (act === "log") {
      const medId = root.querySelector('input[name="take"]:checked')?.value;
      const n = Number(root.querySelector('input[name="units"]:checked')?.value ?? 1);
      const when = M.whenToAt(root.querySelector('select[name="when"]')?.value ?? "0");
      const r = M.logDose(store, LIST, { medId, units: n, reason: zone(open)?.reason ?? null, ...when, context: medId ? contextFor(store, med(medId), when).snapshot : null });
      if (!r.ok) { $("msg").textContent = r.why; return; }
      store = r.store;
      if (!save(store)) { $("msg").textContent = "This browser blocked saving. The dose was not stored."; return; }
      const m = med(medId);
      closeZone();
      paint(true);
      $("msg").textContent = when.recalled
        ? `Logged for ${dayWords(when.at.toISOString())}: ${m.name}, ${units(m, n)}, marked as remembered later. Did it work? is waiting at the top.`
        : `Logged: ${m.name}, ${units(m, n)}. Ergosphere will ask whether it worked in ${M.spanWords(new Date(), new Date(Date.now() + m.askAfterHours * 3600000))}.`;
    }
  });

  root.addEventListener("submit", (e) => {
    const qf = e.target.closest(".quick");
    if (qf) { e.preventDefault(); readQuick(qf.said.value, "typed"); return; }
    const of = e.target.closest(".own-form");
    if (of) {
      e.preventDefault();
      const r = M.addOwn(store, { name: of.name.value, unit: of.unit.value, daily: of.daily.checked });
      if (!r.ok) { $("own-msg").textContent = r.why; return; }
      store = r.store;
      save(store);
      of.reset();
      paint(true);
      $("own-msg").textContent = r.item.daily ? `Added. ${r.item.name} will appear at the top each day.` : `Added. ${r.item.name} now appears in step 2 for any part of the body.`;
      return;
    }
    const form = e.target.closest(".followup");
    if (!form) return;
    e.preventDefault();
    const worked = form.querySelector('input[name="worked"]:checked')?.value;
    const effects = [...form.querySelectorAll('input[name="effect"]:checked')].map((i) => i.closest("label").textContent.trim());
    const real = effects.some((x) => x !== "Nothing");
    const severity = form.querySelector('input[name="severity"]:checked')?.value ?? null;
    if (real && !severity) { form.querySelector(".step-msg").textContent = "How strong was it? Choose one."; return; }
    const r = M.setOutcome(store, form.dataset.dose, { worked, effects, severity });
    if (!r.ok) { form.querySelector(".step-msg").textContent = r.why; return; }
    store = r.store;
    save(store);
    paint();
    $("msg").textContent = severity === "severe" ? "Answer saved. A severe side effect is now under “Patterns to raise”: you can send it to your crew medical officer from there." : "Answer saved to your log.";
  });

  enableDrag(root);
  paint();
}
