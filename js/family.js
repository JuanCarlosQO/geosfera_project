// Family channel. Two sides of one screen:
//  · #family            the crew member's inbox: messages from home arrive sealed and are
//                       opened only if and when they choose;
//  · #family/write      the page a family member uses to write one (it becomes a link);
//  · #family/in/<data>  a message link being delivered to this device.
// Rules: family-core.js. Messages stay on this device (sync-core LOCAL_ONLY) and are text only.

import { fold } from "./fold.js";
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

export const familyWaiting = (memberId = current()?.id) => (memberId ? F.announced(read(), memberId) : 0);

let draft = null; // a reply being started from an opened message

function head(m) {
  return `<p class="fm-from"><strong>${esc(m.from)}</strong> · ${esc(m.rel)} <span class="fm-kind">${esc(F.kindLabel(m.kind))}</span>${m.photo ? ` <span class="fm-kind">photo</span>` : ""}${m.audio ? ` <span class="fm-kind">voice note</span>` : ""}${m.simulated ? ` <span class="fm-sim mono">SIMULATED</span>` : ""}</p>
    <p class="fine">Sent ${day(m.at)} · arrived ${F.ago(m.arrivedAt)}</p>`;
}

/* ---------- the crew member's inbox ---------- */

function inboxHtml(me, box, notice) {
  const { sealed, open, aside } = F.inbox(box, me.id);
  const paused = F.isPaused(box, me.id);
  const first = esc(me.name.split(" ")[0]);
  return `<section class="family" aria-labelledby="fm-h">
    <p class="eyebrow">Mind &amp; support · Family channel</p>
    <h1 id="fm-h" tabindex="-1">Messages from home</h1>
    <p class="lede">They wait here sealed, ${first}. Open one when you want to, or not at all: nothing is ever marked overdue, and nobody is told whether you read it.</p>
    ${notice ? `<p class="fm-notice" role="status">${notice}</p>` : ""}
    ${F.homesick(box, me.id) ? `<div class="fm-notice fm-care" role="status"><p><strong>The last two messages left you more homesick.</strong> That happens, and it is worth telling someone. You can also pause this channel for a while.</p><div class="fm-acts"><a class="cta main" href="#mind">I'd like to talk to someone</a><button type="button" class="cta" data-fm="pause">Pause the channel</button></div></div>` : ""}

    ${paused ? `<section class="data-card fm-paused"><h2>The channel is paused</h2>
      <p>${sealed.length ? `${sealed.length} ${sealed.length === 1 ? "message is" : "messages are"} being kept for you, sealed.` : "Anything that arrives will be kept for you, sealed."} Nothing will be announced on Today or anywhere else until you resume.</p>
      <div class="fm-acts"><button type="button" class="cta main" data-fm="resume">Resume the channel</button></div></section>` : `
    <section class="data-card" aria-labelledby="fm-s">
      <h2 id="fm-s">Waiting, sealed${sealed.length ? ` · ${sealed.length}` : ""}</h2>
      ${sealed.length ? `<ul class="fm-list">${sealed.map((m) => `<li class="fm-msg sealed">
        <span class="fm-env" aria-hidden="true">✉</span><div class="fm-body">${head(m)}
        <div class="fm-acts"><button type="button" class="cta main" data-fm="open" data-id="${m.id}">Open it</button><button type="button" class="textlink" data-fm="aside" data-id="${m.id}">Set aside for later</button></div></div></li>`).join("")}</ul>`
      : `<p class="fine">Nothing waiting. That is fine too.</p>`}
      <p class="fine fm-pause-line">Need quiet, or have a critical task ahead? <button type="button" class="textlink" data-fm="pause">Pause the channel</button>: messages are kept, sealed, and nothing is announced.</p>
    </section>`}

    ${open.length ? `<section class="data-card" aria-labelledby="fm-o"><h2 id="fm-o">Opened</h2>
      <ul class="fm-list">${open.map((m) => `<li class="fm-msg"><div class="fm-body">${head(m)}
        ${m.text ? `<p class="fm-text">${esc(m.text)}</p>` : ""}
        ${m.photo ? `<img class="fm-photo" src="${esc(m.photo)}" alt="Photo sent by ${esc(m.from)}">` : ""}
        ${m.audio ? `<audio class="fm-audio" controls preload="metadata" src="${esc(m.audio)}"></audio>` : ""}
        <div class="fm-feel" role="group" aria-label="How did this message leave you?"><span>How did it leave you?</span>${F.FEELS.map((f) => `<button type="button" class="chip-btn" data-fm="feel" data-feel="${f.id}" data-id="${m.id}" aria-pressed="${m.feel === f.id}">${f.label}</button>`).join("")}</div>
        <div class="fm-acts"><button type="button" class="cta" data-fm="reply" data-id="${m.id}">Write back</button><button type="button" class="textlink" data-fm="reseal" data-id="${m.id}">Seal it again</button><button type="button" class="textlink danger" data-fm="delete" data-id="${m.id}">Delete</button></div></div></li>`).join("")}</ul></section>` : ""}

    ${aside.length ? `<details class="data-card fm-aside"><summary>Set aside · ${aside.length}</summary>
      <ul class="fm-list">${aside.map((m) => `<li class="fm-msg sealed"><div class="fm-body">${head(m)}
        <div class="fm-acts"><button type="button" class="cta" data-fm="open" data-id="${m.id}">Open it</button><button type="button" class="textlink" data-fm="reseal" data-id="${m.id}">Back to waiting</button><button type="button" class="textlink danger" data-fm="delete" data-id="${m.id}">Delete unread</button></div></div></li>`).join("")}</ul></details>` : ""}

    <div class="fm-acts fm-in"><button type="button" class="cta" data-fm="copy-write">Copy the writing page's link</button><button type="button" class="cta" data-fm="import">Open a message file</button><input type="file" accept=".json,application/json" data-ref="file" hidden></div>
    ${fold("How a message gets here", `<ol class="fm-steps">
        <li>Your family opens the writing page on their own phone: <a href="#family/write">Write a message</a>.</li>
        <li>The page turns what they wrote into a link. Nothing is uploaded: the message travels inside the link.</li>
        <li>The link is opened on your device and the message lands here, sealed.</li>
      </ol>
      <p class="fine">A message with a photo or a voice note is too big for a link, so it comes as a small file: open it here with “Open a message file”.</p>
      <p class="fine">In a mission the link would travel with Mission Control's uplink and its delay; in this prototype whoever has the link delivers it. For serious or urgent news, families go through the mission's support team, not this channel (app rule).</p>
      <p class="fine">“${SUPPORT_FACTS.familyContact.quote}” “${SUPPORT_FACTS.carePackages.quote}” <a href="${SUPPORT_FACTS.familyContact.url}" target="_blank" rel="noopener">${SUPPORT_FACTS.familyContact.source}</a></p>`, { cls: "block" })}
    <p class="fine rule-note">The family channel is an app idea, not a NASA system. Messages are text, a photo or a short voice note; they stay on this device and are not sent to the other crew devices. It does not replace “I'd like to talk to someone” or the SOS button. <a href="#mind">Back to Mind &amp; support</a></p>
  </section>`;
}

/* ---------- the family member's writing page ---------- */

function writeHtml(d = {}) {
  return `<section class="family" aria-labelledby="fm-h">
    <p class="eyebrow">Ergosphere · Family channel</p>
    <h1 id="fm-h" tabindex="-1">Write to your crew member</h1>
    <p class="lede">A few words from home. They will see who it is from and what kind of message it is, and open it when they choose.</p>
    <section class="data-card fm-guide" aria-labelledby="fm-g">
      <h2 id="fm-g">Before you write</h2>
      <ul><li><strong>Tell them something small and real</strong> from today: what you cooked, what the dog did, who asked about them.</li>
        <li><strong>Say you are proud and that things are fine</strong>, if they are. They cannot come home early, so “come back soon” can weigh on them.</li>
        <li><strong>Leave out problems they cannot fix from there.</strong> For anything serious, talk to the mission's family support team first.</li></ul>
      <p class="fine">App guidance, pending review by the team's psychology lead; not a NASA text.</p>
    </section>
    <form class="data-card fm-form" novalidate autocomplete="off">
      <div class="cf-row fm-row">
        <label class="cf-field"><span>Their name</span><input name="to" type="text" maxlength="40" placeholder="e.g. Valentina Reyes" value="${esc(d.to ?? "")}"></label>
        <label class="cf-field"><span>Your name</span><input name="from" type="text" maxlength="40" placeholder="e.g. Camila" value="${esc(d.from ?? "")}"></label>
        <label class="cf-field"><span>You are their</span><select name="rel">${F.RELATIONS.map((r) => `<option>${r}</option>`).join("")}</select></label>
      </div>
      <p class="fm-q">What kind of message is it?</p>
      <div class="chips" role="radiogroup" aria-label="Kind of message">${F.KINDS.map((k, i) => `<label class="chip"><input type="radio" name="kind" value="${k.id}" ${i === 0 ? "checked" : ""}><span>${k.label}</span></label>`).join("")}</div>
      <label class="fm-area"><span>Your message <small data-ref="count">0 / ${F.MAX_TEXT}</small></span><textarea name="text" rows="6" maxlength="${F.MAX_TEXT}" placeholder="Write as you would talk to them."></textarea></label>
      <div class="fm-attach">
        <div><button type="button" class="cta" data-fm="pick-photo">Add a photo</button><input type="file" accept="image/*" data-ref="photo" hidden><span class="fine" data-ref="photo-note"></span><img class="fm-photo" data-ref="photo-prev" alt="Your photo" hidden></div>
        <div data-ref="voice-box"><button type="button" class="cta" data-fm="record">Record a voice note</button><span class="fine" data-ref="voice-note">Up to ${F.MAX_VOICE_S} seconds.</span><audio class="fm-audio" controls data-ref="voice-prev" hidden></audio></div>
      </div>
      <button type="submit" class="cta main">Create the message</button>
      <p class="step-msg" data-ref="msg" role="status" aria-live="polite"></p>
    </form>
    <div data-ref="out"></div>
    <p class="fine rule-note">Nothing you write is uploaded or stored by Ergosphere: the message lives only inside the link, or inside the file you download. Up to ${F.MAX_TEXT} characters of text, one photo and one voice note of up to ${F.MAX_VOICE_S} seconds. Please keep serious or urgent news for the mission's family support team.</p>
  </section>`;
}

function fileOutHtml(message, name) {
  return `<section class="data-card fm-out" aria-labelledby="fm-out-h">
    <h2 id="fm-out-h">Your message is ready</h2>
    <p>It has ${message.photo && message.audio ? "a photo and a voice note" : message.photo ? "a photo" : "a voice note"}, so it travels as a small file: <strong>${esc(name)}</strong>. Send that file the way the mission's family support team tells you.</p>
    <div class="fm-acts"><a class="cta main" data-ref="dl" download="${esc(name)}">Download the message file</a>${navigator.canShare ? `<button type="button" class="cta" data-fm="share-file">Share…</button>` : ""}</div>
    <p class="fine">What they see before opening: <strong>${esc(message.from)}</strong> · ${esc(message.rel)} · ${esc(F.kindLabel(message.kind))}${message.photo ? " · photo" : ""}${message.audio ? " · voice note" : ""}.</p>
  </section>`;
}

/** Shrinks a photo in the browser to a JPEG that fits the cap; nothing is uploaded. */
async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    for (const [side, q] of [[1000, 0.72], [800, 0.66], [640, 0.6], [480, 0.55], [360, 0.5]]) {
      const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const c = Object.assign(document.createElement("canvas"), { width: Math.round(img.naturalWidth * k), height: Math.round(img.naturalHeight * k) });
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", q);
      if (F.cleanPhoto(data)) return data;
    }
    return null;
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}
const blobToDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });

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
    let link = "", photo = null, audio = null, file = null, rec = null, recTimer = null, starting = false;
    const $w = (r) => root.querySelector(`[data-ref="${r}"]`);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") $w("voice-box").hidden = true;
    $w("photo").addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      $w("photo-note").textContent = " Preparing the photo…";
      photo = await shrinkPhoto(f);
      $w("photo-note").textContent = photo ? " Photo added (made smaller to travel)." : " That photo could not be used. Try another one.";
      $w("photo-prev").hidden = !photo;
      if (photo) $w("photo-prev").src = photo;
    });
    root.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-fm]");
      if (!b) return;
      if (b.dataset.fm === "pick-photo") $w("photo").click();
      if (b.dataset.fm === "record") {
        if (rec) { rec.stop(); return; }
        if (starting) return; // the microphone permission is still being asked
        starting = true;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const chunks = [];
          rec = new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
          rec.ondataavailable = (ev) => chunks.push(ev.data);
          rec.onstop = async () => {
            clearInterval(recTimer); stream.getTracks().forEach((t) => t.stop());
            const data = await blobToDataUrl(new Blob(chunks, { type: rec.mimeType })); rec = null;
            audio = F.cleanAudio(data);
            b.textContent = audio ? "Record it again" : "Record a voice note";
            $w("voice-note").textContent = audio ? " Voice note added." : " That recording could not be used. Try a shorter one.";
            $w("voice-prev").hidden = !audio;
            if (audio) $w("voice-prev").src = audio;
          };
          let left = F.MAX_VOICE_S;
          rec.start(); starting = false; b.textContent = `Stop · ${left} s`;
          recTimer = setInterval(() => { left -= 1; b.textContent = `Stop · ${left} s`; if (left <= 0) rec?.stop(); }, 1000);
        } catch { $w("voice-note").textContent = " The microphone is not available here."; rec = null; starting = false; }
      }
    });
    form.text.addEventListener("input", () => { root.querySelector('[data-ref="count"]').textContent = `${form.text.value.length} / ${F.MAX_TEXT}`; });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const r = F.makeMessage({ to: form.to.value, from: form.from.value, rel: form.rel.value, kind: form.querySelector('input[name="kind"]:checked')?.value, text: form.text.value, photo, audio });
      root.querySelector('[data-ref="msg"]').textContent = r.ok ? "" : r.why;
      if (!r.ok) { out.innerHTML = ""; return; }
      if (F.hasMedia(r.message)) {
        const name = `ergosphere-message-${r.message.from.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "family"}.json`;
        file = new File([F.toFile(r.message)], name, { type: "application/json" });
        out.innerHTML = fileOutHtml(r.message, name);
        out.querySelector('[data-ref="dl"]').href = URL.createObjectURL(file);
        out.scrollIntoView({ block: "nearest" });
        return;
      }
      link = `${location.origin}${location.pathname}#family/in/${F.encode(r.message)}`;
      out.innerHTML = outHtml(r.message, link);
      out.scrollIntoView({ block: "nearest" });
    });
    out.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-fm]");
      if (!b) return;
      if (b.dataset.fm === "copy-link") { try { await navigator.clipboard.writeText(link); b.textContent = "Copied"; } catch { out.querySelector(".fm-link").select(); } }
      if (b.dataset.fm === "share-link") { try { await navigator.share({ title: "A message from home", url: link }); } catch { /* cancelled */ } }
      if (b.dataset.fm === "share-file" && file) { try { if (navigator.canShare({ files: [file] })) await navigator.share({ title: "A message from home", files: [file] }); } catch { /* cancelled */ } }
    });
    return;
  }

  /* the crew member's inbox */
  const me = current();
  if (!me) { host.innerHTML = `<section class="family"><h1 tabindex="-1">Messages from home</h1><p class="lede keep">Register the crew first: <a href="#today">open Today</a>. Family writing a message? <a href="#family/write">Write it here</a>.</p></section>`; return; }
  const paint = (notice) => {
    host.innerHTML = inboxHtml(me, read(), notice);
    host.querySelector('[data-ref="file"]').addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const r = F.fromFile(await f.text().catch(() => ""));
      if (!r.ok) { paint("That file is not an Ergosphere message, or it is damaged."); return; }
      const res = F.receive(read(), me.id, r.message);
      if (!res.added) { paint("That message was already delivered."); return; }
      paint(write(res.box) ? `✉ A message from ${esc(r.message.from)} arrived. It stays sealed until you choose to open it.` : "This device is out of space for messages. Delete an opened one and try again.");
    });
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
      if (fm === "pause") { write(F.setPaused(box, me.id, true)); paint("Paused. Messages will be kept for you, sealed, and nothing will be announced."); }
      if (fm === "resume") { write(F.setPaused(box, me.id, false)); paint(); }
      if (fm === "feel") { write(F.setFeel(box, me.id, id, b.dataset.feel)); paint(); }
      if (fm === "import") host.querySelector('[data-ref="file"]').click();
      if (fm === "copy-write") { try { await navigator.clipboard.writeText(writeUrl()); b.textContent = "Copied"; } catch { b.textContent = writeUrl(); } }
    });
  };
  paint(arguments[1]?.notice);
}
