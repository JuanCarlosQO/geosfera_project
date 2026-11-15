// The morning sleep check (rules: sleepcheck-core.js). Shown only when the watch's estimate of
// last night was clearly shorter than the recent average. The crew member is asked, with no
// numbers, how they feel, and if "very tired", why (a shift change, for one) and a note, kept with
// today's log. The ground team sees the night, the answer, and can prepare a plain summary.

import * as C from "./sleepcheck-core.js";
import { readLog, writeLog } from "./store.js";
import { dateKey } from "./log-core.js";
import { SOURCES } from "./devices-core.js";

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SIM = ["simulated", "sensors"];

function originHtml(src) {
  if (!src) return `<span class="sc-src">✎ Typed by you</span>`;
  return `<span class="sc-src">⌁ ${esc(SOURCES[src] ?? "Device")}</span>${SIM.includes(src) ? ` <span class="sim">SIMULATED</span>` : ""}`;
}

/** The card, or "" when there is nothing to ask. */
// view "crew": the crew member's own home. No numbers: the ground team asks how they feel and
// the answer goes to them. view "ground": the flight surgeon's Today for that crew member, with
// the night, where it came from, and the answer (or that it is still waiting).
export function sleepCheckHtml(member, { missionDay, view = "ground" } = {}) {
  const today = dateKey();
  const c = C.sleepCheck(readLog(member.id), today);
  if (!c.ask) return "";
  return `<section class="sc-card sc-${view}" data-ref="sleepcheck" data-view="${view}" data-member="${esc(member.id)}" data-mday="${missionDay ?? ""}" aria-labelledby="sc-h">${view === "crew" ? crewHtml(member) : groundHtml(member, c)}</section>`;
}

function crewHtml(member, stage = null) {
  const log = readLog(member.id), today = dateKey();
  const ans = log[today]?.feel?.value ?? null;
  const note = log[today]?.note ?? null;
  const head = `<p class="mono sc-from">FROM THE GROUND MEDICAL TEAM</p><h2 id="sc-h">Good morning. How do you feel today?</h2>`;
  if (stage === "why" || (ans === "very" && !note && stage !== "done")) return `${head}${whyHtml(note)}`;
  if (ans) return `${head}${answerHtml(ans, note, "✓ Sent to the ground medical team:")}
      <div class="sc-acts"><button type="button" class="textlink" data-sc="change">Change my answer</button></div>`;
  return `${head}<div class="sc-feels" role="group" aria-label="How do you feel today">${C.FEELS.map((f) => `<button type="button" class="chip-btn" data-feel="${f.id}">${f.label}</button>`).join("")}</div>
    <p class="fine">Your answer goes to the ground medical team with today's record.</p>`;
}

function whyHtml(note) {
  return `<p class="sc-q">Very tired. Anything that explains it? <span class="fine">Optional</span></p>
      <div class="chips" role="group" aria-label="Reasons">${C.REASONS.map((r) => `<label class="chip"><input type="checkbox" name="sc-reason" value="${r.id}" ${note?.reasons?.includes(r.id) ? "checked" : ""}><span>${r.label}</span></label>`).join("")}</div>
      <label class="sc-note"><span>Note <small>(${C.NOTE_MAX} characters)</small></span><input name="sc-text" type="text" maxlength="${C.NOTE_MAX}" value="${esc(note?.text ?? "")}" placeholder="e.g. night shift for the docking"></label>
      <div class="sc-acts"><button type="button" class="cta main" data-sc="save-why">Send to the ground team</button></div>`;
}

function answerHtml(ans, note, lead) {
  const label = C.FEELS.find((f) => f.id === ans)?.label;
  const reasons = (note?.reasons ?? []).map((id) => C.REASONS.find((r) => r.id === id)?.label).filter(Boolean);
  return `<p class="sc-saved">${lead} <strong>${label}</strong>${reasons.map((r) => `<span class="sc-tag">${esc(r)}</span>`).join("")}${note?.text ? `<span class="sc-tag" data-no-i18n>“${esc(note.text)}”</span>` : ""}</p>`;
}

function groundHtml(member, c, msg = "") {
  const log = readLog(member.id), today = dateKey();
  const ans = log[today]?.feel?.value ?? null;
  const note = log[today]?.note ?? null;
  const first = esc(member.name.split(" ")[0]);
  return `<h2 id="sc-h">Estimated sleep shorter than usual</h2>
    <p class="sc-nums"><span>Last night: <strong>${C.hm(c.last)}</strong></span>${c.usual != null ? `<span>Recent average: <strong>${C.hm(c.usual)}</strong></span>` : ""}</p>
    <p class="sc-origin">${originHtml(c.src)}</p>
    ${ans ? answerHtml(ans, note, `<span data-no-i18n>${first}</span>:`) : `<p class="sc-q">Asked on the crew member's screen: “How do you feel today?” <span class="sc-tag">No answer yet</span></p>`}
    <div class="sc-acts"><button type="button" class="cta main" data-sc="summary">Prepare a summary</button></div>
    <div data-ref="sc-summary">${msg}</div>
    <p class="fine">The crew member does not see these numbers: their screen only asks how they feel.</p>`;
}

/** Wires the card (delegated: works after every Today repaint). */
export function bindSleepCheck(host, getMember, getNight) {
  host.addEventListener("click", (e) => {
    const card = e.target.closest(".sc-card");
    if (!card) return;
    const member = getMember();
    const today = dateKey();
    const c = C.sleepCheck(readLog(member.id), today);
    const crew = card.dataset.view === "crew";
    const paint = (stage, msg) => { card.innerHTML = crew ? crewHtml(member, stage) : groundHtml(member, c, msg); };
    const f = e.target.closest("[data-feel]");
    if (f) {
      writeLog(C.saveAnswer(readLog(member.id), today, { feel: f.dataset.feel }), member.id);
      paint(f.dataset.feel === "very" ? "why" : "done");
      return;
    }
    const b = e.target.closest("[data-sc]");
    if (!b) return;
    if (b.dataset.sc === "save-why") {
      const reasons = [...card.querySelectorAll('input[name="sc-reason"]:checked')].map((i) => i.value);
      const text = card.querySelector('input[name="sc-text"]').value;
      writeLog(C.saveAnswer(readLog(member.id), today, { feel: "very", reasons, text }), member.id);
      paint("done");
    }
    if (b.dataset.sc === "change") {
      const log = readLog(member.id);
      const entry = { ...(log[today] ?? {}) };
      delete entry.feel; delete entry.note;
      writeLog({ ...log, [today]: entry }, member.id);
      paint(null);
    }
    if (b.dataset.sc === "summary") {
      const log = readLog(member.id);
      const night = getNight?.();
      const text = C.summaryText({
        name: member.name, role: member.role, missionDay: Number(card.dataset.mday) || null, day: today, check: c,
        night, answer: { feel: log[today]?.feel?.value, ...(log[today]?.note ?? {}) }, simulated: SIM.includes(c.src)
      });
      paint("done", `<div class="sc-sum"><p class="mono">SUMMARY FOR THE MEDICAL RECORD</p><pre data-no-i18n>${esc(text)}</pre>
        <div class="sc-acts"><button type="button" class="cta main" data-sc="copy">Copy</button></div>
        <p class="fine">What was measured, what the crew member said, and nothing decided for anyone.</p></div>`);
      card.dataset.summary = text;
    }
    if (b.dataset.sc === "copy") {
      navigator.clipboard?.writeText(card.dataset.summary ?? "").then(() => { b.textContent = "Copied"; }, () => {});
    }
  });
}
