// Countermeasure exercise on screen (rules: exercise-core.js).
//  · crew member's home: today's prescribed sessions, "done" with the loads used, what was felt
//    after, and a problem with a machine;
//  · ground team (on Mission): write the prescription, see what was done, loads, reports, faults.

import * as X from "./exercise-core.js";
import { readLog, writeLog } from "./store.js";
import { dateKey } from "./log-core.js";
import { EXERCISE_FACTS } from "./data/exercise.js";
import { sendAlert } from "./support.js";
import { fold } from "./fold.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const read = () => { try { return X.cleanStore(JSON.parse(localStorage.getItem(X.EXERCISE_KEY)) ?? {}); } catch { return X.cleanStore({}); } };
const write = (s) => { try { localStorage.setItem(X.EXERCISE_KEY, JSON.stringify(s)); } catch { /* storage blocked */ } document.dispatchEvent(new CustomEvent("ergosphere:exercise")); };
export const exerciseStore = read;
const quote = (f) => `“${esc(f.quote)}” <a href="${f.url}" target="_blank" rel="noopener">${esc(f.source)}</a>`;
const hhmm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const short = (day) => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short" }); };

/** The day's minutes go into the daily log too (Mission's ring and streak read them). */
function syncLog(member, day, store) {
  const log = readLog(member);
  const entry = { ...(log[day] ?? {}) };
  entry.exerciseMinutes = { value: X.minutesOn(store, member, day), src: "exercise", at: new Date().toISOString() };
  writeLog({ ...log, [day]: { ...entry, savedAt: entry.savedAt ?? new Date().toISOString() } }, member);
}

/* ---------------- the crew member ---------------- */

function sessionForm(s, done) {
  const moves = X.FOCUS[s.focus].moves ?? [];
  const setOf = (m) => done?.sets?.find((x) => x.move === m);
  return `<form class="ex-form" data-ex-form="${esc(s.id)}" novalidate autocomplete="off">
    <label class="ex-min"><span>Minutes</span><input type="number" inputmode="numeric" name="minutes" min="0" max="${X.MAX_MINUTES}" value="${done?.minutes ?? s.minutes}"></label>
    ${moves.length ? `<p class="fu-sub">Loads you used <span class="fine">optional · as set on ARED</span></p>
      <div class="ex-sets">${moves.map((m) => `<div class="ex-set"><span>${X.MOVES[m]}</span>
        <label><input type="number" inputmode="numeric" name="load-${m}" min="0" max="${X.MAX_LOAD}" value="${setOf(m)?.load ?? ""}" placeholder="—"><small>lb</small></label>
        <label><input type="number" inputmode="numeric" name="reps-${m}" min="1" max="100" value="${setOf(m)?.reps ?? ""}" placeholder="—"><small>reps</small></label></div>`).join("")}</div>` : ""}
    <p class="fu-sub">Anything after the session? <span class="fine">optional · goes to the ground team</span></p>
    <div class="chips" role="group" aria-label="After the session">${X.SYMPTOMS.map((x) => `<label class="chip"><input type="checkbox" name="sym" value="${x.id}" ${done?.symptoms?.includes(x.id) ? "checked" : ""}><span>${x.label}</span></label>`).join("")}</div>
    <label class="sc-note"><span>Note <small>(${X.NOTE_MAX} characters)</small></span><input name="note" type="text" maxlength="${X.NOTE_MAX}" value="${esc(done?.note ?? "")}" placeholder="e.g. lower back after deadlifts"></label>
    <div class="sc-acts"><button type="submit" class="cta main">Save session</button><button type="button" class="textlink" data-ex="cancel">Cancel</button></div>
  </form>`;
}

/** The two halves of the day's countermeasure, each with its sessions (or a line saying none). */
function blocksHtml(rows, item, cls) {
  const g = X.byBlock(rows);
  return Object.entries(X.BLOCKS).map(([b, info]) => {
    const done = g[b].filter((r) => r.done).length;
    return `<div class="ex-block ex-${b}">
      <div class="ex-block-head"><h3>${info.label}</h3><span class="mono ex-count">${g[b].length ? `${done} of ${g[b].length}` : "—"}</span></div>
      <p class="fine">${info.sub}</p>
      ${g[b].length ? `<ul class="${cls}">${g[b].map(item).join("")}</ul>` : `<p class="fine ex-none">None prescribed today.</p>`}
    </div>`;
  }).join("");
}

const rowHtml = ({ session: s, done }, open) => `<li class="ex-row${done ? " done" : ""}">
      <div class="ex-what"><strong>${X.sessionLabel(s)}</strong><small><span>${s.minutes} min</span>${done ? `<span>✓ ${done.minutes} min</span>${done.sets.length ? `<span>${done.sets.length} ${done.sets.length === 1 ? "lift logged" : "lifts logged"}</span>` : ""}${done.symptoms.length ? `<span class="rep">Reported:</span>${done.symptoms.map((x) => `<span>${X.symptomLabel(x)}</span>`).join("")}` : ""}` : ""}</small></div>
      <button type="button" class="${done ? "textlink" : "cta main"}" data-ex="open" data-sid="${esc(s.id)}">${done ? "Edit" : "Done"}</button>
      ${open === s.id ? sessionForm(s, done) : ""}
    </li>`;

/** The crew member's card: today's prescribed sessions. */
export function crewExerciseHtml(member, { open = null, faultOpen = false, msg = "" } = {}) {
  const store = read(), today = dateKey();
  const plan = X.planFor(store, member.id);
  const rows = X.dayStatus(store, member.id, today);
  const doneN = rows.filter((r) => r.done).length;
  return `<section class="ch-card ex-card" aria-labelledby="ex-h">
    <div class="ex-head"><h2 id="ex-h">Today's exercise</h2><span class="mono ex-count">${doneN} of ${rows.length} done</span></div>
    <p class="fine">${plan.set ? `Prescribed by the ground medical team${plan.at ? ` · ${hhmm(plan.at)}` : ""}` : "The station's starting plan until the ground team writes yours: 1.5 hours a day, as NASA asks."}</p>
    ${blocksHtml(rows, (r) => rowHtml(r, open), "ex-list")}
    <p class="ch-msg" role="status">${msg}</p>
    ${faultOpen ? `<form class="ex-fault" data-ex-fault novalidate autocomplete="off">
        <label class="when"><span>Machine</span><select name="device">${Object.entries(X.DEVICES).map(([id, d]) => `<option value="${id}">${d.label}</option>`).join("")}</select></label>
        <label class="sc-note"><span>What is wrong</span><input name="text" type="text" maxlength="${X.NOTE_MAX}" placeholder="e.g. a harness bungee is frayed"></label>
        <div class="sc-acts"><button type="submit" class="cta main">Report it</button><button type="button" class="textlink" data-ex="fault-cancel">Cancel</button></div>
      </form>` : `<button type="button" class="textlink ex-faultlink" data-ex="fault">Report a problem with a machine</button>`}
  </section>`;
}

/** Wires the crew card; `paint(opts)` redraws it. */
export function bindCrewExercise(host, member, paint) {
  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ex]");
    if (!b || !b.closest(".ex-card")) return;
    if (b.dataset.ex === "open") paint({ open: b.dataset.sid });
    if (b.dataset.ex === "cancel" || b.dataset.ex === "fault-cancel") paint({});
    if (b.dataset.ex === "fault") paint({ faultOpen: true });
  });
  host.addEventListener("submit", (e) => {
    const f = e.target.closest("[data-ex-form], [data-ex-fault]");
    if (!f) return;
    e.preventDefault();
    let store = read();
    const fd = new FormData(f);
    if (f.dataset.exFault !== undefined) {
      const r = X.addFault(store, { member: member.id, device: fd.get("device"), text: fd.get("text") });
      if (!r.ok) { paint({ faultOpen: true, msg: r.why }); return; }
      write(r.store);
      paint({ msg: "Reported to the ground team." });
      return;
    }
    const today = dateKey();
    const session = X.planFor(store, member.id).sessions.find((s) => s.id === f.dataset.exForm);
    const moves = X.FOCUS[session?.focus]?.moves ?? [];
    const symptoms = fd.getAll("sym");
    const r = X.logSession(store, {
      member: member.id, day: today, session, minutes: fd.get("minutes"), symptoms, note: fd.get("note"),
      sets: moves.map((m) => ({ move: m, load: fd.get(`load-${m}`) === "" ? null : fd.get(`load-${m}`), reps: fd.get(`reps-${m}`) === "" ? null : fd.get(`reps-${m}`) }))
    });
    if (!r.ok) { paint({ open: f.dataset.exForm, msg: r.why }); return; }
    store = r.store;
    write(store);
    syncLog(member.id, today, store);
    const urgent = r.entry.symptoms.filter((s) => X.TELL_NOW.includes(s));
    if (urgent.length) sendAlert("talk", { reasons: ["body"], note: `After ${X.sessionLabel(session)}: ${r.entry.symptoms.map(X.symptomLabel).join(", ")}${r.entry.note ? `. "${r.entry.note}"` : ""}` });
    paint({ msg: urgent.length ? "Saved. Your crew medical officer has been asked to reach you. If it gets worse, hold SOS." : r.entry.symptoms.length ? "Saved, with what you felt: the ground team will see it." : "Saved." });
  });
}

/* ---------------- the ground team (on Mission) ---------------- */

function planEditor(plan) {
  const opt = (s) => Object.entries(X.BLOCKS).map(([b, info]) => `<optgroup label="${info.label}">${Object.entries(X.FOCUS).filter(([, f]) => f.block === b).map(([id, f]) => `<option value="${id}" ${s.focus === id ? "selected" : ""}>${X.DEVICES[f.device].name} · ${f.label}</option>`).join("")}</optgroup>`).join("");
  return `<form class="ex-plan" data-ex-plan novalidate>
    ${plan.sessions.map((s, i) => `<div class="ex-plan-row" data-row="${i}">
      <select name="focus-${i}" aria-label="Session ${i + 1}">${opt(s)}</select>
      <label><input type="number" inputmode="numeric" name="min-${i}" min="5" max="${X.MAX_MINUTES}" value="${s.minutes}" aria-label="Minutes"><small>min</small></label>
      <button type="button" class="textlink" data-exg="remove" data-i="${i}" aria-label="Remove session ${i + 1}">Remove</button>
      <input type="hidden" name="id-${i}" value="${esc(s.id)}"></div>`).join("")}
    <div class="sc-acts">${plan.sessions.length < X.MAX_SESSIONS ? `<button type="button" class="cta" data-exg="add">+ Add a session</button>` : ""}<button type="submit" class="cta main">Save prescription</button></div>
    <p class="fine" data-ref="plan-total">${plan.sessions.reduce((a, s) => a + s.minutes, 0)} min a day. NASA asks for 1.5 hours.</p>
  </form>`;
}

/** The ground team's countermeasure panel for one crew member. */
export function groundExerciseHtml(member, { draft = null, msg = "" } = {}) {
  const store = read(), today = dateKey();
  const plan = draft ?? X.planFor(store, member.id);
  const c = X.compliance(store, member.id, today, 7);
  const rows = X.dayStatus(store, member.id, today);
  const reports = X.recentSymptoms(store, member.id, today, 7);
  const faults = X.openFaults(store);
  const lifts = ["squat", "deadlift", "heel", "bench"].map((m) => ({ m, t: X.loadTrend(store, member.id, m, 6) })).filter((x) => x.t.length);
  return `<section class="ex-ground" aria-labelledby="exg-h">
    <div class="ex-head"><h2 id="exg-h">Countermeasure exercise</h2><span class="mono ex-count">${c.doneSessions} of ${c.sessions} sessions · 7 days</span></div>
    <div class="ex-grid">
      <div class="cl-card ex-box">
        <h3>Today</h3>
        ${blocksHtml(rows, ({ session: s, done }) => `<li class="${done ? "done" : ""}"><span>${X.sessionLabel(s)} · ${s.minutes} min</span><strong>${done ? `✓ ${done.minutes} min` : "Not yet"}</strong></li>`, "ex-today")}
        <div class="ex-week" role="img" aria-label="Sessions done each day of the last 7">${c.days.map((d) => `<span class="${d.done >= d.planned ? "full" : d.done ? "part" : ""}" title="${d.day}: ${d.done} of ${d.planned}"><i style="height:${Math.round((d.done / Math.max(1, d.planned)) * 100)}%"></i><small>${short(d.day)}</small></span>`).join("")}</div>
      </div>
      <div class="cl-card ex-box">
        <h3>Prescription for <span data-no-i18n>${esc(member.name.split(" ")[0])}</span></h3>
        ${planEditor(plan)}
        <p class="ch-msg" role="status">${msg}</p>
      </div>
      <div class="cl-card ex-box">
        <h3>After the sessions</h3>
        ${reports.length ? `<ul class="ex-reports">${reports.map((e) => `<li class="${e.symptoms.some((s) => X.TELL_NOW.includes(s)) ? "act" : "watch"}"><span>${short(e.day)} · ${X.sessionLabel(e)}</span><strong>${e.symptoms.map(X.symptomLabel).join(" · ") || "Note"}</strong>${e.note ? `<em data-no-i18n>“${esc(e.note)}”</em>` : ""}</li>`).join("")}</ul>` : `<p class="fine">Nothing reported in the last 7 days.</p>`}
        ${lifts.length ? `<h3>Heaviest load · lb</h3><ul class="ex-lifts">${lifts.map(({ m, t }) => `<li><span>${X.MOVES[m]}</span><strong>${t.map((p) => p.load).join(" → ")}</strong></li>`).join("")}</ul>` : ""}
      </div>
      <div class="cl-card ex-box">
        <h3>Machines</h3>
        ${faults.length ? `<ul class="ex-faults">${faults.map((f) => `<li><span><strong>${X.DEVICES[f.device].name}</strong> · ${hhmm(f.at)}</span><em data-no-i18n>“${esc(f.text)}”</em><button type="button" class="textlink" data-exg="fix" data-id="${esc(f.id)}">Mark fixed</button></li>`).join("")}</ul>` : `<p class="fine">No open problems reported.</p>`}
      </div>
    </div>
    ${fold("The machines and NASA's numbers", `<p>${quote(EXERCISE_FACTS.daily)}</p>${["ared", "aredMoves", "aredLoad", "cevis", "t2", "repair", "hardware"].map((k) => `<p>${quote(EXERCISE_FACTS[k])}</p>`).join("")}
      <p class="fine">The sessions, their lengths, the starting plan, the list of things to report after a session and the ones that ask the crew medical officer to call at once are app rules, not NASA's. Loads are what the crew member wrote, in pounds as ARED shows them; nothing here judges them.</p>`)}
  </section>`;
}

/** Wires the ground panel inside `host`; `paint(opts)` redraws it. */
export function bindGroundExercise(host, member, paint) {
  const draftFrom = (form) => {
    const fd = new FormData(form);
    const n = form.querySelectorAll(".ex-plan-row").length;
    return { sessions: Array.from({ length: n }, (_, i) => ({ id: fd.get(`id-${i}`), focus: fd.get(`focus-${i}`), minutes: Number(fd.get(`min-${i}`)) })), set: true };
  };
  host.addEventListener("click", (e) => {
    const b = e.target.closest("[data-exg]");
    if (!b || !b.closest(".ex-ground")) return;
    const form = host.querySelector("[data-ex-plan]");
    if (b.dataset.exg === "add") { const d = draftFrom(form); d.sessions.push({ id: `s${Date.now().toString(36)}`, focus: "steady", minutes: 30 }); paint({ draft: d }); }
    if (b.dataset.exg === "remove") { const d = draftFrom(form); d.sessions.splice(Number(b.dataset.i), 1); paint({ draft: d }); }
    if (b.dataset.exg === "fix") { write(X.fixFault(read(), b.dataset.id)); paint({ msg: "" }); }
  });
  host.addEventListener("submit", (e) => {
    const form = e.target.closest("[data-ex-plan]");
    if (!form) return;
    e.preventDefault();
    const r = X.setPlan(read(), member.id, draftFrom(form).sessions);
    if (!r.ok) { paint({ draft: draftFrom(form), msg: r.why }); return; }
    write(r.store);
    paint({ msg: "Saved: it shows on the crew member's screen." });
  });
}

/** One line for the ground's crew list: today's sessions and anything reported. */
export function exerciseFlags(member, today = dateKey()) {
  const store = read();
  const rows = X.dayStatus(store, member, today);
  const done = rows.filter((r) => r.done).length;
  const reported = X.recentSymptoms(store, member, today, 1).flatMap((e) => e.symptoms);
  return { done, total: rows.length, reported: [...new Set(reported)], faults: X.openFaults(store).filter((f) => f.member === member).length };
}
