// The morning sleep check on Today (rules: sleepcheck-core.js). One card, shown only when the
// watch's estimate of last night was clearly shorter than the recent average: how do you feel,
// and if "very tired", why (a shift change, for one) and a note, kept with today's log. A plain
// summary can be prepared and sent to the crew medical officer through the app's support channel.

import * as C from "./sleepcheck-core.js";
import { readLog, writeLog } from "./store.js";
import { dateKey } from "./log-core.js";
import { SOURCES } from "./devices-core.js";
import { sendAlert } from "./support.js";

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SIM = ["simulated", "sensors"];

function originHtml(src) {
  if (!src) return `<span class="sc-src">✎ Typed by you</span>`;
  return `<span class="sc-src">⌁ ${esc(SOURCES[src] ?? "Device")}</span>${SIM.includes(src) ? ` <span class="sim">SIMULATED</span>` : ""}`;
}

/** The card, or "" when there is nothing to ask. */
export function sleepCheckHtml(member, { missionDay } = {}) {
  const today = dateKey();
  const c = C.sleepCheck(readLog(member.id), today);
  if (!c.ask) return "";
  return `<section class="sc-card" data-ref="sleepcheck" data-member="${esc(member.id)}" data-mday="${missionDay ?? ""}" aria-labelledby="sc-h">${bodyHtml(member, c)}</section>`;
}

function bodyHtml(member, c, stage = null, msg = "") {
  const log = readLog(member.id), today = dateKey();
  const ans = log[today]?.feel?.value ?? null;
  const note = log[today]?.note ?? null;
  const head = `<h2 id="sc-h">Your estimated sleep was shorter than usual.</h2>
    <p class="sc-nums"><span>Last night: <strong>${C.hm(c.last)}</strong></span>${c.usual != null ? `<span>Your recent average: <strong>${C.hm(c.usual)}</strong></span>` : ""}</p>
    <p class="sc-origin">${originHtml(c.src)}</p>`;
  if (stage === "why" || (ans === "very" && !note && stage !== "done")) {
    return `${head}<p class="sc-q">Very tired. Anything that explains it? <span class="fine">Optional</span></p>
      <div class="chips" role="group" aria-label="Reasons">${C.REASONS.map((r) => `<label class="chip"><input type="checkbox" name="sc-reason" value="${r.id}" ${note?.reasons?.includes(r.id) ? "checked" : ""}><span>${r.label}</span></label>`).join("")}</div>
      <label class="sc-note"><span>Note <small>(${C.NOTE_MAX} characters)</small></span><input name="sc-text" type="text" maxlength="${C.NOTE_MAX}" value="${esc(note?.text ?? "")}" placeholder="e.g. night shift for the docking"></label>
      <div class="sc-acts"><button type="button" class="cta main" data-sc="save-why">Save with today's log</button></div>`;
  }
  if (ans) {
    const label = C.FEELS.find((f) => f.id === ans)?.label;
    const reasons = (note?.reasons ?? []).map((id) => C.REASONS.find((r) => r.id === id)?.label).filter(Boolean);
    return `${head}<p class="sc-saved">✓ Saved with today's log: <strong>${label}</strong>${reasons.map((r) => `<span class="sc-tag">${esc(r)}</span>`).join("")}${note?.text ? `<span class="sc-tag" data-no-i18n>“${esc(note.text)}”</span>` : ""}</p>
      <div class="sc-acts"><button type="button" class="cta main" data-sc="summary">Prepare a summary</button><button type="button" class="textlink" data-sc="change">Change my answer</button></div>
      <div data-ref="sc-summary">${msg}</div>`;
  }
  return `${head}<p class="sc-q">How do you feel today?</p>
    <div class="sc-feels" role="group" aria-label="How do you feel today">${C.FEELS.map((f) => `<button type="button" class="chip-btn" data-feel="${f.id}">${f.label}</button>`).join("")}</div>`;
}

/** Wires the card (delegated: works after every Today repaint). */
export function bindSleepCheck(host, getMember, getNight) {
  host.addEventListener("click", (e) => {
    const card = e.target.closest(".sc-card");
    if (!card) return;
    const member = getMember();
    const today = dateKey();
    const c = C.sleepCheck(readLog(member.id), today);
    const paint = (stage, msg) => { card.innerHTML = bodyHtml(member, c, stage, msg); };
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
      paint("done", `<div class="sc-sum"><p class="mono">SUMMARY FOR THE CREW MEDICAL OFFICER</p><pre data-no-i18n>${esc(text)}</pre>
        <div class="sc-acts"><button type="button" class="cta main" data-sc="send">Send to the crew medical officer</button><button type="button" class="cta" data-sc="copy">Copy</button></div>
        <p class="fine">It goes through the app's support channel, like “I'd like to talk to someone”. Nothing is decided for you.</p></div>`);
      card.dataset.summary = text;
    }
    if (b.dataset.sc === "copy") {
      navigator.clipboard?.writeText(card.dataset.summary ?? "").then(() => { b.textContent = "Copied"; }, () => {});
    }
    if (b.dataset.sc === "send") {
      const log = readLog(member.id);
      const sent = sendAlert("talk", { reasons: ["sleep"], note: C.shortSummary({ check: c, answer: { feel: log[today]?.feel?.value, ...(log[today]?.note ?? {}) }, simulated: SIM.includes(c.src) }) });
      b.textContent = sent ? "Sent" : "Could not send";
      b.disabled = Boolean(sent);
    }
  });
}
