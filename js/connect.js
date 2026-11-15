// Loneliness and connection on screen (rules: after-core.js, screen-core.js).
// Crew side, on their home: a private call with home, a private journal (this device only:
// nobody else reads it) and the way to "After the mission". Ground side, in the analysis: what
// the ground can see of loneliness without reading anything private, and ideas to consider.

import * as A from "./after-core.js";
import * as Q from "./screen-core.js";
import * as P from "./predict-core.js";
import * as C from "./sleepcheck-core.js";
import { CONNECT_FACTS } from "./data/after.js";
import { sendAlert, getAlerts } from "./support.js";
import { readLog } from "./store.js";
import { dateKey } from "./log-core.js";
import { stamp } from "./clock-core.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const q = (f) => `<span data-no-i18n>“${f.quote}”</span> <a href="${f.url}" target="_blank" rel="noopener" data-no-i18n>${f.source}</a>`;
// one journal per crew member on this device: { [member]: [entries] }
const journal = (id) => A.cleanJournal(read(A.JOURNAL_KEY, {})?.[id]);

/* ---------------- crew ---------------- */

export function crewConnectHtml(me, msg = "") {
  const j = journal(me.id);
  return `<section class="ch-card cn-card" aria-labelledby="cn-h">
    <h2 id="cn-h">Feeling far from home?</h2>
    <p class="fine">${q(CONNECT_FACTS.longing)}</p>
    <div class="sh-row">
      <button type="button" class="cta main" data-cn="call-home">Ask for a private call with home</button>
      <a class="cta" href="#family">Messages from home</a>
      <a class="cta" href="#after">After the mission ›</a>
    </div>
    <p class="sh-msg" role="status" data-cn-msg>${esc(msg)}</p>
    <details class="cn-journal">
      <summary>My private journal</summary>
      <p class="fine">${q(CONNECT_FACTS.journal)} Kept on this device only: the ground team, the sync and the Excel export never see it.</p>
      <form data-cn="write"><textarea name="text" rows="3" maxlength="2000" aria-label="Journal entry"></textarea><div class="sh-row"><button type="submit" class="cta">Save</button><span class="fine">${j.length ? `${j.length} ${j.length === 1 ? "entry" : "entries"}` : ""}</span></div></form>
      ${j.length ? `<ul class="cn-entries">${j.slice(0, 5).map((e) => `<li><small>${stamp(e.at)}</small><p data-no-i18n>${esc(e.text)}</p></li>`).join("")}</ul>` : ""}
    </details>
  </section>`;
}

export function bindCrewConnect(wrap, me, redraw) {
  wrap.addEventListener("click", (e) => {
    if (!e.target.closest('[data-cn="call-home"]')) return;
    const a = sendAlert("talk", { reasons: ["home"], note: "Would like a private call with home." });
    redraw(a ? "Sent: the ground team will set up a private call with home." : "Could not send.");
  });
  wrap.addEventListener("submit", (e) => {
    if (!e.target.matches('[data-cn="write"]')) return;
    e.preventDefault();
    const text = e.target.elements.namedItem("text").value;
    if (!text.trim()) return;
    const all = read(A.JOURNAL_KEY, {});
    write(A.JOURNAL_KEY, { ...(all && typeof all === "object" && !Array.isArray(all) ? all : {}), [me.id]: A.cleanJournal([{ at: new Date().toISOString(), text }, ...journal(me.id)]) });
    redraw("Saved in your journal.");
    wrap.querySelector(".cn-journal")?.setAttribute("open", "");
  });
}

/* ---------------- ground ---------------- */

export function groundConnectHtml(member) {
  const L = Q.latest(read(Q.CHECKINS_KEY, []), member.id);
  const c = A.connection({ alerts: getAlerts(), member: member.id, ucla: L.ucla3 });
  const log = readLog(member.id), today = dateKey(new Date());
  const mood = P.analyse(log, "mood", today), sleep = P.analyse(log, "sleepHours", today);
  const u = c.ucla;
  return `<section class="an-card cn-ground" aria-labelledby="cn-g-h">
    <h2 id="cn-g-h">Loneliness and connection</h2>
    <p class="fine">What the ground can see without reading anything private: the family channel and the crew member's journal never leave their device.</p>
    ${c.flag ? `<ul class="an-items"><li class="mc-watch"><span class="mc-kind">Connection</span><span>${esc(c.flag.text)}</span></li></ul>` : ""}
    <div class="dr-last">
      <div class="an-out${u && u.before != null && u.now - u.before >= Q.RULES.uclaRise ? " warn" : ""}"><small>Loneliness · UCLA-3</small><b>${u ? `${u.now} <i>of 9</i>` : "—"}</b><em>${!u ? "Not asked yet" : u.before == null ? "First answer" : `Before: ${u.before}`}</em></div>
      <div class="an-out${c.homeRequests >= A.RULES.homeRequests ? " warn" : ""}"><small>Asked about home, 14 days</small><b>${c.homeRequests}</b><em>Requests to talk that say “Missing home or family”</em></div>
      <div class="an-out"><small>Requests to talk, 14 days</small><b>${c.talkRequests}</b><em>All reasons</em></div>
      <div class="an-out${mood.concern ? " warn" : ""}"><small>Mood today</small><b>${mood.now ?? "—"} <i>of 5</i></b><em>${mood.base ? `Their usual ${mood.base.mean}` : "No usual yet"}</em></div>
      <div class="an-out${sleep.concern ? " warn" : ""}"><small>Last night</small><b>${sleep.now != null ? C.hm(sleep.now) : "—"}</b><em>${sleep.base ? `Their usual ${C.hm(sleep.base.mean)}` : "No usual yet"}</em></div>
    </div>
    <h3>Ideas to consider</h3>
    <ul class="cn-ideas">
      <li><strong>Offer a private call with home.</strong> ${q(CONNECT_FACTS.contact)}</li>
      <li><strong>Look at sleep and workload together.</strong> ${q(CONNECT_FACTS.compound)}</li>
      <li><strong>Ask for a check-in</strong> if the last one is old, and talk with them about it.</li>
    </ul>
    <p class="fine">${q(CONNECT_FACTS.confinement)}. The thresholds here (2 requests about home in 14 days, UCLA-3 up 2) are app rules; the flight surgeon decides.</p>
  </section>`;
}
