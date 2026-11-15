// What a crew member may see, on screen (rules: share-core.js).
// Ground side, in each crew member's analysis: tick what they can see, and approve or decline
// their requests (an approval shows the one-time code to read to them).
// Crew side, on their home: what the ground shares with them, a request for more, and the box
// where they type the code the ground gave them.

import * as H from "./share-core.js";
import * as P from "./predict-core.js";
import * as C from "./sleepcheck-core.js";
import { readLog } from "./store.js";
import { dateKey } from "./log-core.js";
import { stamp } from "./clock-core.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export const getSharing = () => H.cleanSharing(read(H.SHARING_KEY, {}));
export const getRequests = () => H.cleanRequests(read(H.REQUESTS_KEY, []));
const saveSharing = (v) => { write(H.SHARING_KEY, v); document.dispatchEvent(new CustomEvent("ergosphere:share")); };
const saveRequests = (v) => { write(H.REQUESTS_KEY, v); document.dispatchEvent(new CustomEvent("ergosphere:share")); };

export const grantedNow = (member) => H.grantedItems(getSharing(), getRequests(), member);
export const grantedRoutesFor = (member) => H.grantedRoutes(grantedNow(member));

const STATUS_WORDS = { pending: "Waiting for the ground", approved: "Approved: code given", declined: "Declined", used: "Open now", expired: "Ended" };
const statusOf = (r) => (r.status === "used" && !H.activeNow(r) ? "expired" : r.status);
const itemsLine = (items) => items.map(H.itemLabel).join(" · ");
const checks = (name, chosen, kind) => H.ITEMS.filter((i) => i.kind === kind).map((i) => `<label class="sh-chk"><input type="checkbox" name="${name}" value="${i.id}"${chosen.includes(i.id) ? " checked" : ""}><span>${i.label}</span></label>`).join("");

/* ---------------- ground ---------------- */

export function groundShareHtml(member) {
  const shared = getSharing()[member.id]?.items ?? [];
  const reqs = H.forMember(getRequests(), member.id);
  return `<section class="an-card sh" aria-labelledby="sh-h" data-sh-member="${esc(member.id)}">
    <h2 id="sh-h">What they can see</h2>
    <p class="fine">By default a crew member sees none of their readings. Tick what to share with them; it shows on their home at once. The emergency code opens everything during an emergency.</p>
    <form class="sh-form" data-sh="share">
      <fieldset><legend>Readings</legend><div class="sh-chks">${checks("item", shared, "reading")}</div></fieldset>
      <fieldset><legend>Screens</legend><div class="sh-chks">${checks("item", shared, "screen")}</div></fieldset>
      <div class="sh-row"><button type="submit" class="cta main">Save what they can see</button><span class="sh-msg" role="status" data-sh-msg></span></div>
    </form>
    <h3 class="sh-h3">Their requests</h3>
    ${reqs.length ? `<ul class="sh-reqs">${reqs.slice(0, 6).map((r) => requestRow(r, "ground")).join("")}</ul>` : `<p class="fine">No requests yet.</p>`}
  </section>`;
}

function requestRow(r, view) {
  const st = statusOf(r);
  const left = H.minutesLeft(r);
  return `<li class="sh-req sh-${st}">
    <div class="sh-req-top"><strong>${itemsLine(r.items)}</strong><span class="mc-pill ${st === "pending" ? "mc-watch" : st === "declined" ? "mc-act" : "mc-ok"}">${STATUS_WORDS[st]}</span></div>
    ${r.reason ? `<p class="sh-why">“<span data-no-i18n>${esc(r.reason)}</span>”</p>` : ""}
    <p class="fine">Asked ${stamp(r.at)}</p>
    ${view === "ground" && st === "pending" ? `<div class="sh-decide">
      <label>For <select data-sh-min="${r.id}">${H.DURATIONS.map((d) => `<option value="${d.minutes}">${d.label}</option>`).join("")}</select></label>
      <button type="button" class="cta main" data-sh-approve="${r.id}">Approve</button>
      <button type="button" class="cta" data-sh-decline="${r.id}">Decline</button>
    </div>` : ""}
    ${view === "ground" && st === "approved" ? `<p class="sh-code">Read this code to them: <b data-no-i18n>${r.code.replace(/(\d{3})(\d{3})/, "$1 $2")}</b> <small>(${H.durationLabel(r.minutes)} from when they type it)</small></p>` : ""}
    ${st === "used" ? `<p class="fine">Open until ${stamp(r.until)}</p><p class="fine">${left} min left</p>` : ""}
    ${st === "declined" && r.note ? `<p class="fine">Note: <span data-no-i18n>${esc(r.note)}</span></p>` : ""}
  </li>`;
}

export function bindGroundShare(root, member, redraw) {
  const box = root.querySelector(`[data-sh-member="${CSS.escape(member.id)}"]`);
  if (!box) return;
  box.addEventListener("submit", (e) => {
    if (!e.target.matches('[data-sh="share"]')) return;
    e.preventDefault();
    const items = [...e.target.querySelectorAll('input[name="item"]:checked')].map((i) => i.value);
    saveSharing(H.setShared(getSharing(), member.id, items));
    const m = box.querySelector("[data-sh-msg]");
    if (m) m.textContent = items.length ? `Saved: ${items.length} shared` : "Saved: nothing shared";
  });
  box.addEventListener("click", (e) => {
    const a = e.target.closest("[data-sh-approve]");
    const d = e.target.closest("[data-sh-decline]");
    if (!a && !d) return;
    const id = (a ?? d).dataset[a ? "shApprove" : "shDecline"];
    const minutes = Number(box.querySelector(`[data-sh-min="${CSS.escape(id)}"]`)?.value);
    saveRequests(H.decide(getRequests(), id, { approve: Boolean(a), minutes }));
    redraw();
  });
}

/* ---------------- crew ---------------- */

/** One shared reading on the crew member's home: today, their usual and the week. */
function readingTile(log, today, id) {
  if (id === "radiation") {
    const days = Object.keys(log).filter((d) => d <= today && Number.isFinite(log[d]?.radiationDose?.value)).sort();
    const last = days.at(-1);
    return `<div class="sh-tile"><small>${H.itemLabel(id)}</small><b>${last ? `${log[last].radiationDose.value} <i>mSv</i>` : "—"}</b><em>${last ? `Last logged ${last}` : "Nothing logged yet"}</em></div>`;
  }
  const a = P.analyse(log, id, today);
  const v = a.now == null ? "—" : a.unit === "h" ? C.hm(a.now) : `${a.now} <i>${a.unit}</i>`;
  const usual = a.base ? `Your usual ${a.unit === "h" ? C.hm(a.base.mean) : `${a.base.mean} ${a.unit}`}` : "No usual yet";
  return `<div class="sh-tile${a.concern ? " bad" : ""}"><small>${H.itemLabel(id)}</small><b>${v}</b><em>${usual}${a.direction !== "steady" && a.perWeek != null ? ` · ${a.direction === "rising" ? "rising" : "falling"} this week` : ""}</em></div>`;
}

export function crewShareHtml(me) {
  const items = grantedNow(me.id);
  const reqs = H.forMember(getRequests(), me.id);
  const pending = reqs.filter((r) => r.status === "pending");
  const approved = reqs.filter((r) => r.status === "approved");
  const open = reqs.filter((r) => H.activeNow(r));
  const log = readLog(me.id);
  const today = dateKey(new Date());
  const readings = items.filter((i) => H.ITEMS.find((x) => x.id === i)?.kind === "reading");
  const screens = H.ITEMS.filter((i) => i.kind === "screen" && items.includes(i.id));
  return `<section class="ch-card sh-crew" aria-labelledby="sh-crew-h">
    <h2 id="sh-crew-h">Your data</h2>
    ${items.length ? `<p class="fine">Shared with you by the ground medical team.</p>${open.length ? `<p class="fine">${open.map((r) => `${itemsLine(r.items)} · ${H.minutesLeft(r)} min left`).join(" · ")}</p>` : ""}
      ${readings.length ? `<div class="sh-tiles">${readings.map((id) => readingTile(log, today, id)).join("")}</div>` : ""}
      ${screens.length ? `<div class="sh-links">${screens.map((s) => `<a class="cta" href="#${s.route}">${s.label} ›</a>`).join("")}</div>` : ""}`
    : `<p class="fine">Nothing is shared with you right now. Your readings go to the ground medical team; you can ask them to see some.</p>`}

    ${approved.length ? `<form class="sh-codebox" data-sh="code">
      <label for="sh-code-in"><strong>The ground approved your request.</strong> Type the code they gave you:</label>
      <div class="sh-row"><input id="sh-code-in" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000 000" required><button type="submit" class="cta main">Open</button></div>
      <p class="sh-msg" role="status" data-sh-msg></p>
    </form>` : ""}

    ${pending.length ? `<p class="sh-wait"><span class="mc-pill mc-watch">Waiting for the ground</span> ${pending.map((r) => itemsLine(r.items)).join(" · ")}</p>` : ""}

    <details class="sh-ask"${items.length || pending.length ? "" : " open"}>
      <summary>Ask the ground to see more</summary>
      <form class="sh-form" data-sh="ask">
        <fieldset><legend>Readings</legend><div class="sh-chks">${checks("ask", [], "reading")}</div></fieldset>
        <fieldset><legend>Screens</legend><div class="sh-chks">${checks("ask", [], "screen")}</div></fieldset>
        <label class="sh-reason">Why (optional)<input name="reason" maxlength="${H.REASON_MAX}" placeholder="For example: I want to see how my sleep is doing"></label>
        <div class="sh-row"><button type="submit" class="cta main">Send the request</button><span class="sh-msg" role="status" data-sh-ask-msg></span></div>
      </form>
    </details>
  </section>`;
}

export function bindCrewShare(root, me, redraw) {
  const box = root.querySelector(".sh-crew");
  if (!box) return;
  let tries = 0;
  box.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.matches('[data-sh="ask"]')) {
      const items = [...f.querySelectorAll('input[name="ask"]:checked')].map((i) => i.value);
      const msg = f.querySelector("[data-sh-ask-msg]");
      if (!items.length) { msg.textContent = "Tick at least one thing to see."; return; }
      const { list, request } = H.requestAccess(getRequests(), { member: me.id, items, reason: f.reason.value });
      if (request) saveRequests(list);
      redraw();
      return;
    }
    if (f.matches('[data-sh="code"]')) {
      const msg = f.querySelector("[data-sh-msg]");
      if (tries >= 5) { msg.textContent = "Too many tries. Ask the ground to read the code again."; return; }
      const { list, ok } = H.useCode(getRequests(), me.id, f.code.value);
      if (!ok) { tries += 1; msg.textContent = "That code does not match. Check it with the ground."; return; }
      saveRequests(list);
      redraw();
    }
  });
}

/** Pending requests across the crew, for Mission Control's "Look at now". */
export const pendingRequests = () => getRequests().filter((r) => r.status === "pending");
