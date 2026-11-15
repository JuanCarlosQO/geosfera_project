// A message from home is announced on whatever screen the crew member is on. This watches
// the inbox (a message written in this browser, a link opened, a file) and empties the crew
// member's mailbox on the sync server every few seconds while the app is open (mailbox.js).
// The notice says who it is from and what kind it is; the message itself stays sealed until
// the crew member taps "Open it", right there, or "Later". A paused channel announces nothing.
// Rules: family-core.js, mailbox-core.js.

import * as F from "./family-core.js";
import * as B from "./mailbox-core.js";
import { collect, existingMailbox } from "./mailbox.js";
import { current } from "./store.js";
import { sound } from "./alarm.js";

const POLL_MS = 8000;       // how often the mailbox is emptied while a server answers
const RETRY_MS = 60000;     // how long to wait before asking again where there is no server
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const readBox = () => { try { return F.cleanBox(JSON.parse(localStorage.getItem(F.FAMILY_KEY))); } catch { return {}; } };
const writeBox = (box) => { try { localStorage.setItem(F.FAMILY_KEY, JSON.stringify(box)); return true; } catch { return false; } };
const readSeen = () => { try { const v = JSON.parse(localStorage.getItem(B.SEEN_KEY)); return Array.isArray(v) ? v : []; } catch { return []; } };
const readFocus = () => { try { return F.cleanFocus(JSON.parse(localStorage.getItem(F.FOCUS_KEY))); } catch { return {}; } };
const writeSeen = (ids) => { try { localStorage.setItem(B.SEEN_KEY, JSON.stringify(ids)); } catch { /* storage blocked */ } };

export function mountFamilyNotify() {
  const card = Object.assign(document.createElement("div"), { className: "fn-card", hidden: true });
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "A message from home");
  document.body.append(card);
  let queue = [];   // messages waiting to be announced, oldest first
  let shown = null; // { memberId, message, open }

  function paint() {
    if (!shown) { card.hidden = true; return; }
    const m = shown.message;
    const extra = queue.length ? `<small class="fn-more">+${queue.length} more</small>` : "";
    card.hidden = false;
    card.dataset.open = String(shown.open);
    card.innerHTML = shown.open ? `
      <p class="fn-top"><span class="fn-env" aria-hidden="true">✉</span><strong>${esc(m.from)}</strong> · ${esc(m.rel)} <span class="fm-kind">${esc(F.kindLabel(m.kind))}</span></p>
      ${m.text ? `<p class="fn-text">${esc(m.text)}</p>` : ""}
      ${m.photo ? `<img class="fm-photo" src="${esc(m.photo)}" alt="Photo sent by ${esc(m.from)}">` : ""}
      ${m.audio ? `<audio class="fm-audio" controls preload="metadata" src="${esc(m.audio)}"></audio>` : ""}
      ${m.video ? `<video class="fm-video" controls playsinline preload="metadata" src="${esc(m.video)}"></video>` : ""}
      <div class="fn-acts"><button type="button" class="cta main" data-fn="close">Close</button><a class="textlink" href="#family" data-fn="all">All messages</a>${extra}</div>` : `
      <p class="fn-top"><span class="fn-env" aria-hidden="true">✉</span><strong>A message from home</strong>${extra}</p>
      <p class="fn-who"><strong>${esc(m.from)}</strong> · ${esc(m.rel)} <span class="fm-kind">${esc(F.kindLabel(m.kind))}</span>${F.mediaWords(m).map((w) => ` <span class="fm-kind">${w}</span>`).join("")}</p>
      <p class="fn-fine">Sealed. Open it now, or whenever you like.</p>
      <div class="fn-acts"><button type="button" class="cta main" data-fn="open">Open it</button><button type="button" class="cta" data-fn="later">Later</button></div>`;
  }

  function next() {
    shown = queue.length ? { ...queue.shift(), open: false } : null;
    paint();
  }

  /** Announces every sealed message of the active crew member that has not been announced yet. */
  function check() {
    const me = current();
    if (!me) return;
    const box = readBox();
    if (F.isPaused(box, me.id)) return; // kept sealed, and nothing is announced
    if (F.focusNow(readFocus(), me.id)) return; // a critical task: the notice waits until it is over
    const fresh = B.unannounced(box[me.id], readSeen());
    if (!fresh.length) return;
    writeSeen(B.markSeen(readSeen(), fresh.map((m) => m.id)));
    queue.push(...fresh.map((message) => ({ memberId: me.id, message })));
    sound("note");
    if (!shown) next(); else paint();
  }

  card.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fn]");
    if (!b || !shown) return;
    if (b.dataset.fn === "open") {
      writeBox(F.setState(readBox(), shown.memberId, shown.message.id, "open"));
      shown.open = true;
      paint();
      document.dispatchEvent(new CustomEvent("ergosphere:family-read"));
      return;
    }
    next(); // "Later", "Close" and "All messages" all put this notice away
  });

  /* the mailbox on the sync server */
  let timer = null;
  async function poll() {
    clearTimeout(timer);
    let wait = POLL_MS; // with no mailbox yet this costs nothing: it only looks again shortly
    const me = current();
    const mailbox = me && !document.hidden && navigator.onLine ? existingMailbox(me.id) : null;
    if (mailbox) {
      const got = await collect(mailbox);
      if (got.state === "none") wait = RETRY_MS; // no sync server on this host: ask again much later
      if (got.state === "ok") {
        let box = readBox(), added = false;
        for (const raw of got.messages) {
          const r = F.makeMessage({ ...raw, at: raw.at }); // everything from outside is validated again
          if (!r.ok) continue;
          const res = F.receive(box, me.id, r.message);
          if (res.added) { box = res.box; added = true; }
        }
        if (added && writeBox(box)) { check(); document.dispatchEvent(new CustomEvent("ergosphere:family-read")); }
      }
    }
    check(); // also lets a notice held during a critical task out once the task is over
    timer = setTimeout(poll, wait);
  }

  document.addEventListener("ergosphere:family", check);
  window.addEventListener("storage", (e) => { if (e.key === F.FAMILY_KEY || e.key === F.FOCUS_KEY) check(); });
  document.addEventListener("ergosphere:focus", check);
  window.addEventListener("hashchange", () => setTimeout(check, 50)); // a link just delivered, or another crew member chosen
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { check(); poll(); } });
  window.addEventListener("online", poll);
  check();
  poll();
  return { check, poll };
}
