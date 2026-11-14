// Family channel. Two sides of one screen:
//  · #family            the crew member's inbox: messages from home arrive sealed and are
//                       opened only if and when they choose;
//  · #family/write      the page a family member uses to write one (it becomes a link);
//  · #family/in/<data>  a message link being delivered to this device.
// Rules: family-core.js. Messages stay on this device (sync-core LOCAL_ONLY) and are text only.

import * as F from "./family-core.js";
import { SUPPORT_FACTS } from "./data/support.js";
import { getCrew, current } from "./store.js";
import { confirmHere } from "./ask.js";

const read = () => { try { return F.cleanBox(JSON.parse(localStorage.getItem(F.FAMILY_KEY))); } catch { return {}; } };
const write = (box) => { try { localStorage.setItem(F.FAMILY_KEY, JSON.stringify(box)); return true; } catch { return false; } };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const src = (f) => `<small class="src">“${f.quote}” <a href="${f.url}" target="_blank" rel="noopener">${f.source}</a></small>`;
const day = (t) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const writeUrl = () => `${location.origin}${location.pathname}#family/write`;

export const familyWaiting = (memberId = current()?.id) => (memberId ? F.waiting(read(), memberId) : 0);

let draft = null; // a reply being started from an opened message

function head(m) {
  return `<p class="fm-from"><strong>${esc(m.from)}</strong> · ${esc(m.rel)} <span class="fm-kind">${esc(F.kindLabel(m.kind))}</span>${m.simulated ? ` <span class="fm-sim mono">SIMULATED</span>` : ""}</p>
    <p class="fine">Sent ${day(m.at)} · arrived ${F.ago(m.arrivedAt)}</p>`;
}

/* ---------- the crew member's inbox ---------- */

function inboxHtml(me, box, notice) {
  const { sealed, open, aside } = F.inbox(box, me.id);
  const first = esc(me.name.split(" ")[0]);
  return `<section class="family" aria-labelledby="fm-h">
    <p class="eyebrow">Mind &amp; support · Family channel</p>
    <h1 id="fm-h" tabindex="-1">Messages from home</h1>
    <p class="lede">They wait here sealed, ${first}. Open one when you want to, or not at all: nothing is ever marked overdue, and nobody is told whether you read it.</p>
    ${notice ? `<p class="fm-notice" role="status">${notice}</p>` : ""}

    <section class="data-card" aria-labelledby="fm-s">
      <h2 id="fm-s">Waiting, sealed${sealed.length ? ` · ${sealed.length}` : ""}</h2>
      ${sealed.length ? `<ul class="fm-list">${sealed.map((m) => `<li class="fm-msg sealed">
        <span class="fm-env" aria-hidden="true">✉</span><div class="fm-body">${head(m)}
        <div class="fm-acts"><button type="button" class="cta main" data-fm="open" data-id="${m.id}">Open it</button><button type="button" class="textlink" data-fm="aside" data-id="${m.id}">Set aside for later</button></div></div></li>`).join("")}</ul>`
      : `<p class="fine">Nothing waiting. That is fine too.</p>`}
    </section>

    ${open.length ? `<section class="data-card" aria-labelledby="fm-o"><h2 id="fm-o">Opened</h2>
      <ul class="fm-list">${open.map((m) => `<li class="fm-msg"><div class="fm-body">${head(m)}
        <p class="fm-text">${esc(m.text)}</p>
        <div class="fm-acts"><button type="button" class="cta" data-fm="reply" data-id="${m.id}">Write back</button><button type="button" class="textlink" data-fm="reseal" data-id="${m.id}">Seal it again</button><button type="button" class="textlink danger" data-fm="delete" data-id="${m.id}">Delete</button></div></div></li>`).join("")}</ul></section>` : ""}

    ${aside.length ? `<details class="data-card fm-aside"><summary>Set aside · ${aside.length}</summary>
      <ul class="fm-list">${aside.map((m) => `<li class="fm-msg sealed"><div class="fm-body">${head(m)}
        <div class="fm-acts"><button type="button" class="cta" data-fm="open" data-id="${m.id}">Open it</button><button type="button" class="textlink" data-fm="reseal" data-id="${m.id}">Back to waiting</button><button type="button" class="textlink danger" data-fm="delete" data-id="${m.id}">Delete unread</button></div></div></li>`).join("")}</ul></details>` : ""}

    <section class="data-card" aria-labelledby="fm-how">
      <h2 id="fm-how">How a message gets here</h2>
      <ol class="fm-steps">
        <li>Your family opens the writing page on their own phone: <a href="#family/write">Write a message</a>.</li>
        <li>The page turns what they wrote into a link. Nothing is uploaded: the message travels inside the link.</li>
        <li>The link is opened on your device and the message lands here, sealed.</li>
      </ol>
      <div class="fm-acts"><button type="button" class="cta" data-fm="copy-write">Copy the writing page's link</button></div>
      <p class="fine">In a mission the link would travel with Mission Control's uplink and its delay; in this prototype whoever has the link delivers it. For serious or urgent news, families go through the mission's support team, not this channel (app rule).</p>
      ${src(SUPPORT_FACTS.familyContact)}${src(SUPPORT_FACTS.carePackages)}
    </section>
    <p class="fine rule-note">The family channel is an app idea, not a NASA system. Messages are text only, stay on this device and are not sent to the other crew devices. It does not replace “I'd like to talk to someone” or the SOS button. <a href="#mind">Back to Mind &amp; support</a></p>
  </section>`;
}

/* ---------- the family member's writing page ---------- */

function writeHtml(d = {}) {
  return `<section class="family" aria-labelledby="fm-h">
    <p class="eyebrow">Ergosphere · Family channel</p>
    <h1 id="fm-h" tabindex="-1">Write to your crew member</h1>
    <p class="lede">A few words from home. They will see who it is from and what kind of message it is, and open it when they choose.</p>
    <form class="data-card fm-form" novalidate autocomplete="off">
      <div class="cf-row fm-row">
        <label class="cf-field"><span>Their name</span><input name="to" type="text" maxlength="40" placeholder="e.g. Valentina Reyes" value="${esc(d.to ?? "")}"></label>
        <label class="cf-field"><span>Your name</span><input name="from" type="text" maxlength="40" placeholder="e.g. Camila" value="${esc(d.from ?? "")}"></label>
        <label class="cf-field"><span>You are their</span><select name="rel">${F.RELATIONS.map((r) => `<option>${r}</option>`).join("")}</select></label>
      </div>
      <p class="fm-q">What kind of message is it?</p>
      <div class="chips" role="radiogroup" aria-label="Kind of message">${F.KINDS.map((k, i) => `<label class="chip"><input type="radio" name="kind" value="${k.id}" ${i === 0 ? "checked" : ""}><span>${k.label}</span></label>`).join("")}</div>
      <label class="fm-area"><span>Your message <small data-ref="count">0 / ${F.MAX_TEXT}</small></span><textarea name="text" rows="6" maxlength="${F.MAX_TEXT}" placeholder="Write as you would talk to them."></textarea></label>
      <button type="submit" class="cta main">Create the message link</button>
      <p class="step-msg" data-ref="msg" role="status" aria-live="polite"></p>
    </form>
    <div data-ref="out"></div>
    <p class="fine rule-note">Nothing you write is uploaded or stored by Ergosphere: the message lives only inside the link. Text only, up to ${F.MAX_TEXT} characters. Please keep serious or urgent news for the mission's family support team.</p>
  </section>`;
}

function outHtml(message, link) {
  return `<section class="data-card fm-out" aria-labelledby="fm-out-h">
    <h2 id="fm-out-h">Your message is ready</h2>
    <p>Send this link the way the mission's family support team tells you. Opened on their device, it arrives sealed.</p>
    <textarea class="fm-link" readonly rows="3" aria-label="Message link">${esc(link)}</textarea>
    <div class="fm-acts"><button type="button" class="cta main" data-fm="copy-link">Copy link</button>${navigator.share ? `<button type="button" class="cta" data-fm="share-link">Share…</button>` : ""}</div>
    <p class="fine">What they see before opening: <strong>${esc(message.from)}</strong> · ${esc(message.rel)} · ${esc(F.kindLabel(message.kind))}.</p>
  </section>`;
}

export function mountFamily(host, { arg, payload } = {}) {
  /* a link being delivered */
  if (arg === "in") {
    const r = F.decode(payload);
    const crew = getCrew();
    let notice;
    if (!r.ok) notice = "That message link is damaged or incomplete. Ask your family to copy it again.";
    else if (!crew.members.length) notice = "A message arrived, but no crew is registered on this device. Open the link on the crew member's own device.";
    else {
      const to = F.matchMember(crew.members, r.message.to) ?? current();
      const res = F.receive(read(), to.id, r.message);
      if (res.added) write(res.box);
      notice = res.added
        ? `✉ A message from ${esc(r.message.from)} arrived for ${esc(to.name)}. It stays sealed until ${to.id === current()?.id ? "you choose" : "they choose"} to open it.`
        : "That message was already delivered.";
    }
    history.replaceState(null, "", `${location.pathname}#family`);
    return mountFamily(host, { notice });
  }

  /* the family member's side */
  if (arg === "write") {
    host.innerHTML = writeHtml(draft ?? {});
    draft = null;
    const root = host.querySelector(".family"), form = root.querySelector("form"), out = root.querySelector('[data-ref="out"]');
    let link = "";
    form.text.addEventListener("input", () => { root.querySelector('[data-ref="count"]').textContent = `${form.text.value.length} / ${F.MAX_TEXT}`; });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const r = F.makeMessage({ to: form.to.value, from: form.from.value, rel: form.rel.value, kind: form.querySelector('input[name="kind"]:checked')?.value, text: form.text.value });
      root.querySelector('[data-ref="msg"]').textContent = r.ok ? "" : r.why;
      if (!r.ok) { out.innerHTML = ""; return; }
      link = `${location.origin}${location.pathname}#family/in/${F.encode(r.message)}`;
      out.innerHTML = outHtml(r.message, link);
      out.scrollIntoView({ block: "nearest" });
    });
    out.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-fm]");
      if (!b) return;
      if (b.dataset.fm === "copy-link") { try { await navigator.clipboard.writeText(link); b.textContent = "Copied"; } catch { out.querySelector(".fm-link").select(); } }
      if (b.dataset.fm === "share-link") { try { await navigator.share({ title: "A message from home", url: link }); } catch { /* cancelled */ } }
    });
    return;
  }

  /* the crew member's inbox */
  const me = current();
  if (!me) { host.innerHTML = `<section class="family"><h1 tabindex="-1">Messages from home</h1><p class="lede">Register the crew first: <a href="#today">open Today</a>. Family writing a message? <a href="#family/write">Write it here</a>.</p></section>`; return; }
  const paint = (notice) => {
    host.innerHTML = inboxHtml(me, read(), notice);
    host.querySelector(".family").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-fm]");
      if (!b) return;
      const { fm, id } = b.dataset;
      const box = read();
      if (fm === "open") { write(F.setState(box, me.id, id, "open")); paint(); host.querySelector(`[data-id="${id}"]`)?.closest(".fm-msg")?.scrollIntoView({ block: "center" }); }
      if (fm === "aside") { write(F.setState(box, me.id, id, "aside")); paint("Set aside. It stays unread until you want it."); }
      if (fm === "reseal") { write(F.setState(box, me.id, id, "sealed")); paint(); }
      if (fm === "delete" && await confirmHere(b, "Delete this message for good?", "Yes, delete")) { write(F.remove(box, me.id, id)); paint(); }
      if (fm === "reply") { const m = (box[me.id] ?? []).find((x) => x.id === id); draft = { to: m?.from ?? "", from: me.name }; location.hash = "family/write"; }
      if (fm === "copy-write") { try { await navigator.clipboard.writeText(writeUrl()); b.textContent = "Copied"; } catch { b.textContent = writeUrl(); } }
    });
  };
  paint(arguments[1]?.notice);
}
