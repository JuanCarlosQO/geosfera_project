// Family channel.
//  · #family              the crew member's inbox: messages from home arrive sealed and are
//                         opened only if and when they choose. It also gives the ONE link the
//                         crew member shares with their family;
//  · family.html#<invite> the family's own page (family-page.js): only the writing form,
//                         none of the app. Sending delivers the message: straight into the
//                         inbox when the crew member uses this same browser, through their
//                         mailbox on the sync server otherwise (mailbox.js), and as a link to
//                         send by hand where there is no server;
//  · #family/write        the crew member writing back (it becomes a link to send);
//  · #family/in/<data>    a message link being delivered to this device.
// A new message is announced on any screen by family-notify.js.
// Rules: family-core.js, mailbox-core.js. Inbox and mailbox keys stay on this device.

import { fold } from "./fold.js";
import * as F from "./family-core.js";
import { SUPPORT_FACTS } from "./data/support.js";
import { getCrew, current } from "./store.js";
import { confirmHere } from "./ask.js";
import { drop, familyLink } from "./mailbox.js";

const read = () => { try { return F.cleanBox(JSON.parse(localStorage.getItem(F.FAMILY_KEY))); } catch { return {}; } };
const write = (box) => { try { localStorage.setItem(F.FAMILY_KEY, JSON.stringify(box)); return true; } catch { return false; } };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const src = (f) => `<small class="src">“${f.quote}” <a href="${f.url}" target="_blank" rel="noopener">${f.source}</a></small>`;
const day = (t) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
/** Tells the rest of the app that the inbox changed (family-notify.js announces what is new). */
const arrived = () => document.dispatchEvent(new CustomEvent("ergosphere:family"));

export const familyWaiting = (memberId = current()?.id) => (memberId ? F.announced(read(), memberId) : 0);

let draft = null; // a reply being started from an opened message

function head(m) {
  return `<p class="fm-from"><strong>${esc(m.from)}</strong> · ${esc(m.rel)} <span class="fm-kind">${esc(F.kindLabel(m.kind))}</span>${F.mediaWords(m).map((w) => ` <span class="fm-kind">${w}</span>`).join("")}${m.simulated ? ` <span class="fm-sim mono">SIMULATED</span>` : ""}</p>
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
    ${(() => { let f = null; try { f = F.focusNow(F.cleanFocus(JSON.parse(localStorage.getItem(F.FOCUS_KEY))), me.id); } catch { /* none */ }
      return f ? `<p class="fm-notice" role="status">☾ Notices are on hold until ${`${f.until.slice(11, 16)} UTC`}, after your Fit for duty check for a critical task. Messages still arrive here, sealed. <a href="#duty">End the hold</a></p>` : ""; })()}
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
      <p class="fine fm-pause-line">Need quiet? <button type="button" class="textlink" data-fm="pause">Pause the channel</button>: messages are kept, sealed, and nothing is announced. Before a spacewalk or a docking, the Fit for duty check holds the notices by itself until the task is over.</p>
    </section>`}

    ${open.length ? `<section class="data-card" aria-labelledby="fm-o"><h2 id="fm-o">Opened</h2>
      <ul class="fm-list">${open.map((m) => `<li class="fm-msg"><div class="fm-body">${head(m)}
        ${m.text ? `<p class="fm-text">${esc(m.text)}</p>` : ""}
        ${m.photo ? `<img class="fm-photo" src="${esc(m.photo)}" alt="Photo sent by ${esc(m.from)}">` : ""}
        ${m.audio ? `<audio class="fm-audio" controls preload="metadata" src="${esc(m.audio)}"></audio>` : ""}
        ${m.video ? `<video class="fm-video" controls playsinline preload="metadata" src="${esc(m.video)}" aria-label="Video sent by ${esc(m.from)}"></video>` : ""}
        <div class="fm-feel" role="group" aria-label="How did this message leave you?"><span>How did it leave you?</span>${F.FEELS.map((f) => `<button type="button" class="chip-btn" data-fm="feel" data-feel="${f.id}" data-id="${m.id}" aria-pressed="${m.feel === f.id}">${f.label}</button>`).join("")}</div>
        <div class="fm-acts"><button type="button" class="cta" data-fm="reply" data-id="${m.id}">Write back</button><button type="button" class="textlink" data-fm="reseal" data-id="${m.id}">Seal it again</button><button type="button" class="textlink danger" data-fm="delete" data-id="${m.id}">Delete</button></div></div></li>`).join("")}</ul></section>` : ""}

    ${aside.length ? `<details class="data-card fm-aside"><summary>Set aside · ${aside.length}</summary>
      <ul class="fm-list">${aside.map((m) => `<li class="fm-msg sealed"><div class="fm-body">${head(m)}
        <div class="fm-acts"><button type="button" class="cta" data-fm="open" data-id="${m.id}">Open it</button><button type="button" class="textlink" data-fm="reseal" data-id="${m.id}">Back to waiting</button><button type="button" class="textlink danger" data-fm="delete" data-id="${m.id}">Delete unread</button></div></div></li>`).join("")}</ul></details>` : ""}

    <section class="data-card fm-invite" aria-labelledby="fm-inv">
      <h2 id="fm-inv">Your family's link</h2>
      <p>One link, only for your family. It opens a page with nothing but the message form, already addressed to you.</p>
      <div class="fm-acts"><button type="button" class="cta main" data-fm="copy-invite">Copy my family's link</button>${navigator.share ? `<button type="button" class="cta" data-fm="share-invite">Share…</button>` : ""}<a class="textlink" data-ref="invite-open" href="${esc(familyLink(me))}" target="_blank" rel="noopener">Open it here</a></div>
      <p class="step-msg" data-ref="invite-msg" role="status" aria-live="polite"></p>
    </section>
    ${fold("How a message gets here", `<ol class="fm-steps">
        <li>Your family opens your link on their own phone and writes. They type no name: the link knows it is for you.</li>
        <li>When they tap Send, the message goes to your mailbox on the mission's server, encrypted, and this app picks it up the next time it is open.</li>
        <li>You get a notice on whatever screen you are on. The message stays sealed until you choose to open it.</li>
        <li>During a critical task (after a Fit for duty check for a spacewalk, a docking or another critical task) the notice waits until the task is over, for up to ${F.FOCUS_HOURS} hours (app rule).</li>
      </ol>
      <p class="fine">Store and forward, not a call: on a long mission a message cannot arrive live. “${SUPPORT_FACTS.delay.quote}” <a href="${SUPPORT_FACTS.delay.url}" target="_blank" rel="noopener">${SUPPORT_FACTS.delay.source}</a>. The family channel is kept apart from the medical record: the family's page has only the message form and never sees readings, medications or symptoms, and the mailbox has its own keys.</p>
      <p class="fine">Where this copy of the app has no server (a plain web host), the family's page gives them a link to send instead, and a message written in this same browser arrives directly. A message file can also be opened by hand: <button type="button" class="textlink" data-fm="import">Open a message file</button><input type="file" accept=".json,application/json" data-ref="file" hidden></p>
      <p class="fine">Anyone holding your link can write to you, so share it with family only. In a mission the message would travel with Mission Control's uplink and its delay. For serious or urgent news, families go through the mission's support team, not this channel (app rule).</p>
      <p class="fine">“${SUPPORT_FACTS.familyContact.quote}” “${SUPPORT_FACTS.carePackages.quote}” <a href="${SUPPORT_FACTS.familyContact.url}" target="_blank" rel="noopener">${SUPPORT_FACTS.familyContact.source}</a></p>`, { cls: "block" })}
    <p class="fine rule-note">The family channel is an app idea, not a NASA system. Messages are text, a photo, a short voice note or a few seconds of video; they stay on this device and are not sent to the other crew devices. It does not replace “I'd like to talk to someone” or the SOS button. <a href="#mind">Back to Mind &amp; support</a></p>
  </section>`;
}

/* ---------- the family member's writing page ---------- */

function writeHtml(d = {}, invite = null) {
  const who = invite ? esc(invite.name) : "your crew member";
  return `<section class="family${invite ? " family-page" : ""}" aria-labelledby="fm-h">
    <p class="eyebrow">Ergosphere · Family channel</p>
    <h1 id="fm-h" tabindex="-1">Write to ${invite ? esc(invite.name.split(" ")[0]) : "your crew member"}</h1>
    <p class="lede">A few words from home for ${who}. They will see who it is from and what kind of message it is, and open it when they choose.</p>
    ${fold("Before you write", `<ul class="fm-guide-list"><li><strong>Tell them something small and real</strong> from today: what you cooked, what the dog did, who asked about them.</li>
        <li><strong>Say you are proud and that things are fine</strong>, if they are. They cannot come home early, so “come back soon” can weigh on them.</li>
        <li><strong>Leave out problems they cannot fix from there.</strong> For anything serious, talk to the mission's family support team first.</li></ul>
      <p class="fine">App guidance, pending review by the team's psychology lead; not a NASA text.</p>`, { cls: "block", open: !invite })}
    <form class="data-card fm-form" novalidate autocomplete="off">
      ${invite ? `<p class="fm-to">To <strong>${esc(invite.name)}</strong></p>` : ""}
      <div class="cf-row fm-row">
        ${invite ? "" : `<label class="cf-field"><span>Their name</span><input name="to" type="text" maxlength="40" placeholder="e.g. Valentina Reyes" value="${esc(d.to ?? "")}"></label>`}
        <label class="cf-field"><span>Your name</span><input name="from" type="text" maxlength="40" placeholder="e.g. Camila" value="${esc(d.from ?? "")}"></label>
        <label class="cf-field"><span>You are their</span><select name="rel">${F.RELATIONS.map((r) => `<option>${r}</option>`).join("")}</select></label>
      </div>
      <p class="fm-q">What kind of message is it?</p>
      <div class="chips" role="radiogroup" aria-label="Kind of message">${F.KINDS.map((k, i) => `<label class="chip"><input type="radio" name="kind" value="${k.id}" ${i === 0 ? "checked" : ""}><span>${k.label}</span></label>`).join("")}</div>
      <label class="fm-area"><span>Your message <small data-ref="count">0 / ${F.MAX_TEXT}</small></span><textarea name="text" rows="6" maxlength="${F.MAX_TEXT}" placeholder="Write as you would talk to them."></textarea></label>
      <div class="fm-attach">
        <div><button type="button" class="cta" data-fm="pick-photo">Add a photo</button><input type="file" accept="image/*" data-ref="photo" hidden><span class="fine" data-ref="photo-note"></span><img class="fm-photo" data-ref="photo-prev" alt="Your photo" hidden></div>
        <div data-ref="voice-box"><button type="button" class="cta" data-fm="record">Record a voice note</button><span class="fine" data-ref="voice-note">Up to ${F.MAX_VOICE_S} seconds.</span><audio class="fm-audio" controls data-ref="voice-prev" hidden></audio></div>
        <div data-ref="video-box"><button type="button" class="cta" data-fm="record-video">Record a short video</button><span class="fine" data-ref="video-note">Up to ${F.MAX_VIDEO_S} seconds, made small to travel.</span>
          <video class="fm-video" data-ref="video-live" muted playsinline hidden></video><video class="fm-video" controls playsinline data-ref="video-prev" hidden></video></div>
      </div>
      <button type="submit" class="cta main fm-send">${invite ? "Send" : "Create the message"}</button>
      <p class="step-msg" data-ref="msg" role="status" aria-live="polite"></p>
    </form>
    <div data-ref="out" aria-live="polite"></div>
    <p class="fine rule-note">${invite
      ? `Your message is encrypted on this phone before it leaves, and only ${who}'s device can open it. Ergosphere keeps no copy once it is delivered.`
      : "Nothing you write is uploaded or stored by Ergosphere: the message lives only inside the link, or inside the file you download."} Up to ${F.MAX_TEXT} characters of text, one photo, one voice note of up to ${F.MAX_VOICE_S} seconds and one video of up to ${F.MAX_VIDEO_S} seconds. Please keep serious or urgent news for the mission's family support team.</p>
  </section>`;
}

const sentHtml = (message, name, how) => `<section class="data-card fm-out fm-sent" aria-labelledby="fm-out-h">
    <p class="fm-sent-mark" aria-hidden="true">✓</p>
    <h2 id="fm-out-h">${how === "here" ? `Delivered to ${esc(name)}` : `Sent to ${esc(name)}`}</h2>
    <p>${how === "here" ? "It is in their inbox on this device, sealed." : "It is waiting in their mailbox, encrypted. Their app picks it up the next time it is open and tells them a message from home arrived."} They will see <strong>${esc(message.from)}</strong> · ${esc(message.rel)} · ${esc(F.kindLabel(message.kind))}${F.mediaWords(message).map((w) => ` · ${w}`).join("")}, and open it when they choose.</p>
    <div class="fm-acts"><button type="button" class="cta" data-fm="another">Write another</button></div>
  </section>`;

function fileOutHtml(message, name) {
  return `<section class="data-card fm-out" aria-labelledby="fm-out-h">
    <h2 id="fm-out-h">Your message is ready</h2>
    <p>It has ${F.mediaWords(message).length > 1 ? "attachments" : F.mediaWords(message)[0] === "photo" ? "a photo" : F.mediaWords(message)[0] === "video" ? "a video" : "a voice note"}, so it travels as a small file: <strong>${esc(name)}</strong>. Send that file the way the mission's family support team tells you.</p>
    <div class="fm-acts"><a class="cta main" data-ref="dl" download="${esc(name)}">Download the message file</a>${navigator.canShare ? `<button type="button" class="cta" data-fm="share-file">Share…</button>` : ""}</div>
    <p class="fine">What they see before opening: <strong>${esc(message.from)}</strong> · ${esc(message.rel)} · ${esc(F.kindLabel(message.kind))}${F.mediaWords(message).map((w) => ` · ${w}`).join("")}.</p>
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

function outHtml(message, link, noServer = false) {
  return `<section class="data-card fm-out" aria-labelledby="fm-out-h">
    <h2 id="fm-out-h">Your message is ready</h2>
    <p>${noServer ? "This copy of Ergosphere has no message server, so it cannot be sent from here. Send them this link yourself: opened on their device, it arrives sealed and they are told." : "Send this link the way the mission's family support team tells you. Opened on their device, it arrives sealed."}</p>
    <textarea class="fm-link" readonly rows="3" aria-label="Message link">${esc(link)}</textarea>
    <div class="fm-acts"><button type="button" class="cta main" data-fm="copy-link">Copy link</button>${navigator.share ? `<button type="button" class="cta" data-fm="share-link">Share…</button>` : ""}</div>
    <p class="fine">What they see before opening: <strong>${esc(message.from)}</strong> · ${esc(message.rel)} · ${esc(F.kindLabel(message.kind))}.</p>
  </section>`;
}

/**
 * The writing form. With an `invite` (the crew member's own link) Send delivers the message;
 * without one it becomes a link or a file to send by hand.
 */
export function mountWrite(host, { invite = null, draft: d = {} } = {}) {
    host.innerHTML = writeHtml(d, invite);
    const root = host.querySelector(".family"), form = root.querySelector("form"), out = root.querySelector('[data-ref="out"]');
    let link = "", photo = null, audio = null, video = null, file = null, rec = null, recTimer = null, starting = false, sending = false;
    let vrec = null, vTimer = null;
    const $w = (r) => root.querySelector(`[data-ref="${r}"]`);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { $w("voice-box").hidden = true; $w("video-box").hidden = true; }
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
      if (b.dataset.fm === "record-video") {
        if (vrec) { vrec.stop(); return; }
        if (starting) return;
        starting = true;
        try {
          // small and short on purpose: a message must fit the crew member's mailbox (and, on a mission, the uplink)
          const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 20 }, facingMode: "user" }, audio: true });
          const live = $w("video-live");
          live.srcObject = stream; live.hidden = false; live.play().catch(() => {});
          const type = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
          const chunks = [];
          vrec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 200000, audioBitsPerSecond: 24000 });
          vrec.ondataavailable = (ev) => chunks.push(ev.data);
          vrec.onstop = async () => {
            clearInterval(vTimer); stream.getTracks().forEach((t) => t.stop());
            live.srcObject = null; live.hidden = true;
            const mime = (vrec.mimeType || type || "video/webm").replace(/;\s+/g, ";");
            const data = await blobToDataUrl(new Blob(chunks, { type: mime })); vrec = null;
            video = F.cleanVideo(data);
            b.textContent = video ? "Record it again" : "Record a short video";
            $w("video-note").textContent = video ? " Video added." : " That video was too big to travel. Try a shorter one.";
            $w("video-prev").hidden = !video;
            if (video) $w("video-prev").src = video;
          };
          let left = F.MAX_VIDEO_S;
          vrec.start(); starting = false; b.textContent = `Stop · ${left} s`;
          vTimer = setInterval(() => { left -= 1; b.textContent = `Stop · ${left} s`; if (left <= 0) vrec?.stop(); }, 1000);
        } catch { $w("video-note").textContent = " The camera is not available here."; vrec = null; starting = false; $w("video-live").hidden = true; }
      }
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

    /** Without a server: the message becomes a link (or a file, with a photo or a voice note) to send by hand. */
    function byHand(message, noServer) {
      if (F.hasMedia(message)) {
        const name = `ergosphere-message-${message.from.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "family"}.json`;
        file = new File([F.toFile(message)], name, { type: "application/json" });
        out.innerHTML = fileOutHtml(message, name);
        out.querySelector('[data-ref="dl"]').href = URL.createObjectURL(file);
      } else {
        link = `${new URL("./", location.href).href}#family/in/${F.encode(message)}`;
        out.innerHTML = outHtml(message, link, noServer);
      }
      out.scrollIntoView({ block: "nearest" });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (sending) return;
      const say = root.querySelector('[data-ref="msg"]');
      const r = F.makeMessage({ to: invite ? invite.name : form.to.value, from: form.from.value, rel: form.rel.value, kind: form.querySelector('input[name="kind"]:checked')?.value, text: form.text.value, photo, audio, video });
      say.textContent = r.ok ? "" : r.why;
      if (!r.ok) { out.innerHTML = ""; return; }
      if (!invite) { byHand(r.message, false); return; }

      // 1. the crew member uses this very browser: straight into their inbox
      if (getCrew().members.some((m) => m.id === invite.memberId)) {
        const res = F.receive(read(), invite.memberId, r.message);
        if (!res.added || write(res.box)) { arrived(); form.hidden = true; out.innerHTML = sentHtml(r.message, invite.name, "here"); return; }
      }
      // 2. their mailbox on the sync server
      sending = true;
      say.textContent = "Sending…";
      const how = await drop(invite.mailbox, r.message);
      sending = false;
      say.textContent = "";
      if (how === "sent") { form.hidden = true; out.innerHTML = sentHtml(r.message, invite.name, "server"); return; }
      if (how === "full") { say.textContent = "Their mailbox is full for now. Try again later, or send it without the video, the photo or the voice note."; return; }
      if (how === "error") { say.textContent = "It could not be sent just now. Check the connection and tap Send again."; return; }
      // 3. no server on this host: a link to send by hand
      byHand(r.message, true);
    });
    out.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-fm]");
      if (!b) return;
      if (b.dataset.fm === "another") { mountWrite(host, { invite, draft: { from: form.from.value } }); return; }
      if (b.dataset.fm === "copy-link") { try { await navigator.clipboard.writeText(link); b.textContent = "Copied"; } catch { out.querySelector(".fm-link").select(); } }
      if (b.dataset.fm === "share-link") { try { await navigator.share({ title: "A message from home", url: link }); } catch { /* cancelled */ } }
      if (b.dataset.fm === "share-file" && file) { try { if (navigator.canShare({ files: [file] })) await navigator.share({ title: "A message from home", files: [file] }); } catch { /* cancelled */ } }
    });
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
      if (res.added) { write(res.box); arrived(); }
      notice = res.added
        ? `✉ A message from ${esc(r.message.from)} arrived for ${esc(to.name)}. It stays sealed until ${to.id === current()?.id ? "you choose" : "they choose"} to open it.`
        : "That message was already delivered.";
    }
    history.replaceState(null, "", `${location.pathname}#family`);
    return mountFamily(host, { notice });
  }

  /* the crew member writing back */
  if (arg === "write") { const d = draft; draft = null; mountWrite(host, { draft: d ?? {} }); return; }

  /* the crew member's inbox */
  const me = current();
  if (!me) { host.innerHTML = `<section class="family"><h1 tabindex="-1">Messages from home</h1><p class="lede keep">Register the crew first: <a href="#today">open Today</a>. Family writing a message? Ask your crew member for their family link.</p></section>`; return; }
  const paint = (notice) => {
    host.innerHTML = inboxHtml(me, read(), notice);
    host.querySelector('[data-ref="file"]').addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const r = F.fromFile(await f.text().catch(() => ""));
      if (!r.ok) { paint("That file is not an Ergosphere message, or it is damaged."); return; }
      const res = F.receive(read(), me.id, r.message);
      if (!res.added) { paint("That message was already delivered."); return; }
      const saved = write(res.box);
      if (saved) arrived();
      paint(saved ? `✉ A message from ${esc(r.message.from)} arrived. It stays sealed until you choose to open it.` : "This device is out of space for messages. Delete an opened one and try again.");
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
      if (fm === "copy-invite") { const say = host.querySelector('[data-ref="invite-msg"]'); try { await navigator.clipboard.writeText(familyLink(me)); say.textContent = "Copied. Send it to your family."; } catch { say.textContent = familyLink(me); } }
      if (fm === "share-invite") { try { await navigator.share({ title: `Write to ${me.name}`, text: `Write to ${me.name} on their mission:`, url: familyLink(me) }); } catch { /* cancelled */ } }
    });
  };
  paint(arguments[1]?.notice);
}
