// Module 1 — the airlock hatch. Builds the access screen and drives it.
// All decisions (code rules, hashing, waits, fingerprint check) come from access-core.js.

import * as core from "./access-core.js";
import { current, getCrew, setActive } from "./store.js";
import { logKeyFor } from "./crew-core.js";
import { DEMO_CODES } from "./demo-core.js";
import { avatarHtml, AVATARS, avatarSrc } from "./avatar.js";
import { saveCrew } from "./store.js";
import { GROUND, GROUND_ID, signIn } from "./role-core.js";
import { setRole } from "./role.js";
import { isDemoId } from "./demo-core.js";

const GROUND_DEMO_CODE = "2046"; // the ground team's demo code, shown only with the demo crew

const STORE = "geosfera.crew-access";
const OPEN_DURATION = 3800;

const stationSvg = (panel, hull) => `
<svg viewBox="0 0 120 60" aria-hidden="true">
  <rect x="8" y="28" width="104" height="4" fill="#cbd3db"/>
  ${[10, 23, 86, 99].map((x) => `
  <rect x="${x}" y="4" width="11" height="22" fill="${panel}" stroke="#a3bbd9" stroke-width=".6"/>
  <rect x="${x}" y="34" width="11" height="22" fill="${panel}" stroke="#a3bbd9" stroke-width=".6"/>`).join("")}
  <rect x="50" y="22" width="20" height="16" rx="2" fill="${hull}"/>
  <rect x="57" y="10" width="6" height="40" rx="2" fill="#d6dde4"/>
</svg>`;

const fingerprintSvg = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M6.5 9.5a5.5 5.5 0 0 1 11 0v2"/><path d="M9 10a3 3 0 0 1 6 0v3c0 2.5-1 4.5-2.5 6"/><path d="M12 10v3.5c0 1.8-.6 3.5-1.6 4.8"/><path d="M6.5 13c0 2.2-.4 3.8-1.2 5"/><path d="M17.5 14.5c-.2 2-.8 3.8-1.8 5.3"/></svg>`;

const HINTS = {
  create: "Choose a four-digit code on the ring",
  repeat: "Tap the same code again to confirm",
  enter: "Tap your four digits on the ring",
  who: "Choose your profile",
  biometric: "Add your fingerprint or face to open faster"
};

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const initials = (n) => esc(n.split(" ").map((w) => w[0]).slice(0, 2).join(""));
const spaced = (code) => code.split("").join(" ");

/** The crew to choose from: each profile with its own code. Demo profiles show theirs. */
function crewHtml(members, store) {
  const demo = members.some((m) => isDemoId(m.id));
  const g = core.accessFor(store, GROUND_ID).record;
  const gLine = demo ? `<span class="hs-code">Demo code <b>${spaced(GROUND_DEMO_CODE)}</b></span>` : g ? `<span class="hs-code">Code set</span>` : `<span class="hs-code">First time: choose a code</span>`;
  return `<p class="hs-sec mono">ON THE GROUND · SEES EVERY READING</p>
  <ul class="hs-crew-list hs-ground"><li style="--i:0"><button type="button" class="hs-prof" data-pick="${GROUND_ID}">
      <span class="hs-pic hs-pic-ground" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.500 3 14.500 0 18M12 3c-3 3.500-3 14.500 0 18"/></svg></span>
      <span class="hs-prof-txt"><strong>${GROUND.name}</strong><small>${GROUND.role} · flight surgeon and biomedical engineers</small>${gLine}</span>
      <span class="hs-go" aria-hidden="true">›</span></button></li></ul>
  <p class="hs-sec mono">ON BOARD · REPORTS, NO READINGS</p>
  <ul class="hs-crew-list">${members.map((m, i) => {
    const rec = core.accessFor(store, m.id).record;
    const demo = DEMO_CODES[m.id];
    const line = demo ? `<span class="hs-code">Demo code <b>${spaced(demo)}</b></span>` : rec ? `<span class="hs-code">Code set</span>` : `<span class="hs-code">First time: choose a code</span>`;
    return `<li style="--i:${i}"><button type="button" class="hs-prof" data-pick="${esc(m.id)}">
      ${avatarHtml(m, "hs-pic")}
      <span class="hs-prof-txt"><strong>${esc(m.name)}</strong><small>${esc(m.role)}${m.age ? ` · ${m.age}` : ""}${m.home ? ` · ${esc(m.home)}` : ""}</small>${line}</span>
      <span class="hs-go" aria-hidden="true">›</span></button>
      <button type="button" class="hs-pic-btn" data-avatar-for="${esc(m.id)}" aria-label="Choose an avatar for ${esc(m.name)}">✎ Avatar</button></li>`;
  }).join("")}</ul>
  ${demo ? `<p class="hs-crew-note">Demo profiles: fictional astronauts with simulated readings. Their codes are shown so anyone can try them. Crew members see only what they report; the ground team sees the readings.</p>` : ""}`;
}

function markup() {
  const who = current(); // the crew member last active on this device, if a crew is registered
  const name = who ? esc(who.name.split(" ")[0]) : "Commander";
  const keys = Array.from({ length: 10 }, (_, n) =>
    `<button type="button" class="key" style="--i:${n}" data-key="${n}" aria-label="Digit ${n}">${n}</button>`).join("");
  const bolts = [0, 1, 2, 3].map((i) => `<span class="bolt" style="--i:${i}"></span>`).join("");
  const rivets = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 15 * Math.PI) / 180;
    return `<circle cx="${(100 + 96 * Math.cos(a)).toFixed(1)}" cy="${(100 + 96 * Math.sin(a)).toFixed(1)}" r=".9" fill="#3d4753"/>`;
  }).join("");

  return `
<div class="hatch-screen" role="dialog" aria-modal="true" aria-labelledby="hs-heading" tabindex="-1">
  <div class="sky" aria-hidden="true"></div>
  <div class="hs-fade">
    <div class="hs-top">
      <span class="mark"><img src="assets/logo-mark.webp" width="34" height="34" alt=""><span class="mark-name">Ergosphere <i>Co</i></span></span>
      <time class="utc" data-utc>--:-- UTC</time>
    </div>
    <div class="hs-title">
      <p class="hs-who" data-ref="who" ${who ? "" : "hidden"}>${who ? `<span class="hs-avatar" aria-hidden="true">${initials(who.name)}</span>${esc(who.name)} · ${esc(who.role)}` : ""}</p>
      <h1 id="hs-heading" data-ref="heading">${timeOfDay()}, ${name}</h1>
      <p data-ref="hint"></p>
      <div class="hs-dots" data-ref="dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    </div>
  </div>

  <div class="hs-crew" data-ref="crew" hidden></div>

  <div class="hatch" data-ref="hatch">
    <svg class="hatch-art" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <radialGradient id="hg" cx=".5" cy=".5" r=".5">
          <stop offset=".58" stop-color="#0c1117"/><stop offset=".59" stop-color="#1c232c"/>
          <stop offset=".72" stop-color="#10151b"/><stop offset=".73" stop-color="#252d37"/><stop offset="1" stop-color="#0c1015"/>
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="99.5" fill="url(#hg)" stroke="#2a333d"/>
      <g class="slow"><circle cx="100" cy="100" r="95" fill="none" stroke="#2f3a46" stroke-dasharray="1.5 3"/></g>
      ${rivets}
    </svg>
    <div class="window">
      <div class="glow"></div>
      <div class="station-big">${stationSvg("#25518f", "#e7ecf1")}</div>
      <div class="leaf left"><i></i></div>
      <div class="leaf right"><i></i></div>
      <div class="porthole"><div class="station-small">${stationSvg("#5089da", "#ffffff")}</div><small>ISS · IN VIEW</small></div>
    </div>
    ${bolts}
    ${keys}
  </div>

  <div class="hs-foot">
    <p class="readout" role="status" aria-live="polite" data-ref="readout"></p>
    <div class="choices" data-ref="choices"></div>
    <p class="disclaimer">Device lock, not encryption. Your code never leaves this device.</p>
  </div>

  <div class="arrival" aria-hidden="true">
    <span class="eyebrow">Pressure equalised</span>
    <h2>Welcome aboard,<br><span data-ref="arrive-name">${name}</span>.</h2>
    <p>Opening the station…</p>
  </div>

  <div class="veil" data-ref="veil" hidden>
    <div class="sheet" role="alertdialog" aria-labelledby="fg-h" aria-describedby="fg-p">
      <h2 id="fg-h">Forgot your code?</h2>
      <p id="fg-p">It cannot be recovered. Resetting erases this profile's code and daily log on this device (the rest of the crew is not touched), and then you choose a new code. Save a backup first if you can still get in another way.</p>
      <div class="pair" style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="cta" data-do="keep">Keep trying</button>
        <button type="button" class="cta stop" data-do="erase">Erase and reset</button>
      </div>
    </div>
  </div>
</div>`;
}

/* ---------- device storage ---------- */

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE)) ?? {}; } catch { return {}; }
}
function writeStore(value) {
  try { localStorage.setItem(STORE, JSON.stringify(value)); } catch { /* storage blocked: lock lasts for this visit */ }
}
function eraseDevice() {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    for (const k of core.appKeys(keys)) localStorage.removeItem(k);
  } catch { /* nothing to erase */ }
}
/** "Forgot your code?" for one profile: only that person's code and daily log are erased. */
function eraseMember(id) {
  try { localStorage.removeItem(logKeyFor(id)); } catch { /* nothing to erase */ }
}

/* ---------- platform authenticator ---------- */

async function biometricReady() {
  try {
    return Boolean(window.isSecureContext && window.PublicKeyCredential &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}

async function enrolBiometric() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: core.freshBytes(32),
      rp: { name: "Ergosphere", id: location.hostname },
      user: { id: core.freshBytes(16), name: "crew-member", displayName: "Crew member" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      attestation: "none",
      timeout: 60_000
    }
  });
  const spki = cred.response.getPublicKey?.();
  if (!spki) throw new Error("This browser cannot keep a fingerprint for Ergosphere.");
  return { id: core.b64u(cred.rawId), key: core.b64u(spki), alg: cred.response.getPublicKeyAlgorithm() };
}

async function confirmBiometric(saved) {
  const challenge = core.freshBytes(32);
  const answer = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: location.hostname,
      allowCredentials: [{ type: "public-key", id: core.unb64u(saved.id), transports: ["internal"] }],
      userVerification: "required",
      timeout: 60_000
    }
  });
  const r = answer.response;
  return core.checkAssertion(
    { challenge, origin: location.origin, rpId: location.hostname, key: saved.key, alg: saved.alg },
    { authenticatorData: new Uint8Array(r.authenticatorData), clientDataJSON: new Uint8Array(r.clientDataJSON), signature: new Uint8Array(r.signature) }
  );
}

/* ---------- the screen ---------- */

export class Hatch {
  constructor(root, { onEnter, memberId = null }) {
    this.root = root;
    this.onEnter = onEnter;
    this.all = core.migrateAccess(readStore(), current()?.id ?? null);
    this.members = getCrew().members;
    // a crew: everyone picks their own profile (or the one asked for); no crew: one device lock
    this.memberId = this.members.length ? (memberId && this.members.some((m) => m.id === memberId) ? memberId : null) : core.DEVICE_ID;
    this.saved = this.memberId ? core.accessFor(this.all, this.memberId) : {};
    this.digits = [];
    this.pendingCode = null;
    this.working = false;
    this.countdown = null;
  }

  async show() {
    this.root.innerHTML = markup();
    // the keys pop in once; after that a lit key only pulses (no replay of the entrance)
    setTimeout(() => this.root.querySelector(".hatch-screen")?.classList.add("settled"), 1100);
    this.screen = this.root.firstElementChild;
    const ref = (name) => this.screen.querySelector(`[data-ref="${name}"]`);
    this.ui = { hatch: ref("hatch"), hint: ref("hint"), readout: ref("readout"), choices: ref("choices"), veil: ref("veil"), crew: ref("crew"), who: ref("who"), heading: ref("heading"), arrive: ref("arrive-name") };
    this.keys = [...this.screen.querySelectorAll(".key")];
    this.bolts = [...this.screen.querySelectorAll(".bolt")];
    this.canBiometric = await biometricReady();

    // a digit counts the moment the finger touches it (no wait for the click that follows);
    // the click is then ignored, while a keyboard's Enter or Space still types through click
    this.screen.addEventListener("pointerdown", (e) => {
      const k = e.target.closest(".key");
      if (!k || k.disabled || e.button > 0) return;
      e.preventDefault(); // no text selection, no focus ring flash, no double-tap zoom
      this.pointerAt = Date.now();
      this.press(Number(k.dataset.key));
    });
    this.screen.addEventListener("click", (e) => this.onClick(e));
    this.screen.addEventListener("keydown", (e) => this.onKey(e));

    if (this.memberId) await this.pick(this.memberId);
    else this.goTo("who");
    this.screen.focus();
  }

  persist() {
    this.all = core.withAccess(this.all, this.memberId, this.saved);
    writeStore(this.all);
  }

  /** A profile was chosen: greet that person and ask for their own code (a demo profile's is ready). */
  async pick(id) {
    this.memberId = id;
    const m = id === GROUND_ID ? GROUND : this.members.find((x) => x.id === id);
    if (m) {
      if (id !== GROUND_ID) setActive(id);
      this.ui.who.hidden = false;
      this.ui.who.innerHTML = `<span class="hs-avatar" aria-hidden="true">${initials(m.name)}</span>${esc(m.name)} · ${esc(m.role)}`;
      this.ui.heading.textContent = id === GROUND_ID ? `${timeOfDay()}, ground team` : `${timeOfDay()}, ${m.name.split(" ")[0]}`;
      this.ui.arrive.textContent = id === GROUND_ID ? "ground team" : m.name.split(" ")[0];
    }
    this.saved = core.accessFor(this.all, id);
    const demoCode = id === GROUND_ID ? (this.members.some((x) => isDemoId(x.id)) ? GROUND_DEMO_CODE : null) : DEMO_CODES[id];
    if (!this.saved.record && demoCode) {
      this.working = true;
      this.tell("Preparing the demo profile…");
      this.saved = { record: await core.deriveRecord(demoCode), misses: core.cleanSlate() };
      this.persist();
      this.working = false;
      this.tell(`Demo code: ${spaced(demoCode)}`);
    }
    this.goTo(this.saved.record ? "enter" : "create");
    if (!this.saved.record) this.tell(m ? `First time for ${m.name.split(" ")[0]}: choose a four-digit code.` : "First time on this device: set your crew code.");
  }

  tell(text, warn = false) {
    this.ui.readout.textContent = text;
    this.ui.readout.classList.toggle("warn", warn);
  }

  drawBolts() {
    this.bolts.forEach((b, i) => b.classList.toggle("shot", i < this.digits.length));
    this.screen.querySelectorAll(".hs-dots i").forEach((d, i) => d.classList.toggle("on", i < this.digits.length));
  }

  lockKeys(off) {
    this.keys.forEach((k) => { k.disabled = off; });
  }

  goTo(step) {
    this.step = step;
    this.digits = [];
    this.drawBolts();
    this.ui.hint.textContent = HINTS[step];
    this.screen.classList.toggle("picking", step === "who");
    this.ui.crew.hidden = step !== "who";
    if (step === "who") {
      this.ui.crew.innerHTML = crewHtml(this.members, this.all);
      this.ui.who.hidden = true;
      this.ui.heading.textContent = `${timeOfDay()}`;
      this.tell("");
    }
    this.lockKeys(step === "biometric");
    this.drawChoices();
    if (step === "enter") this.watchWait();
  }

  drawChoices() {
    const c = this.ui.choices;
    c.innerHTML = "";
    if (this.step === "enter" && this.saved.biometric && this.canBiometric) {
      c.insertAdjacentHTML("beforeend", `<button type="button" class="cta" data-do="biometric">${fingerprintSvg}Use fingerprint or face</button>`);
    }
    if (this.step === "biometric") {
      c.insertAdjacentHTML("beforeend", `<div class="pair"><button type="button" class="cta main" data-do="enrol">${fingerprintSvg}Add fingerprint</button><button type="button" class="cta" data-do="skip">Not now</button></div>`);
    }
    if (this.step === "enter") c.insertAdjacentHTML("beforeend", `<button type="button" class="textlink" data-do="forgot">Forgot your code?</button>`);
    if (["enter", "create"].includes(this.step) && this.members.length) c.insertAdjacentHTML("beforeend", `<button type="button" class="textlink" data-do="switch">Not you? Choose another profile</button>`);
    if (this.step === "repeat") c.insertAdjacentHTML("beforeend", `<button type="button" class="textlink" data-do="restart">Start again</button>`);
  }

  waiting() {
    return core.msLeft(this.saved.misses, Date.now()) > 0;
  }

  watchWait() {
    clearInterval(this.countdown);
    if (!this.waiting()) { this.lockKeys(false); return false; }
    this.lockKeys(true);
    const show = () => {
      const ms = core.msLeft(this.saved.misses, Date.now());
      if (ms === 0) { clearInterval(this.countdown); this.lockKeys(false); this.tell("You can try again."); return; }
      const s = Math.ceil(ms / 1000);
      this.tell(`Too many wrong codes. Wait ${s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`}.`, true);
    };
    show();
    this.countdown = setInterval(show, 1000);
    return true;
  }

  open() {
    clearInterval(this.countdown);
    // who just came in: the ground team sees every reading, a crew member only what they report
    if (this.members.length) setRole(signIn(this.memberId === GROUND_ID ? "ground" : "crew"));
    this.tell("All four bolts locked · opening the hatch");
    this.screen.classList.add("opening");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => { this.root.innerHTML = ""; this.onEnter(); }, reduced ? 600 : OPEN_DURATION);
  }

  reject() {
    this.ui.hatch.classList.add("denied");
    setTimeout(() => { this.ui.hatch.classList.remove("denied"); this.digits = []; this.drawBolts(); }, 700);
  }

  press(n) {
    if (this.working || this.step === "biometric" || this.screen.classList.contains("opening")) return;
    if (this.digits.length >= core.DIGITS || this.waiting()) return;
    this.digits.push(n);
    this.drawBolts();
    const key = this.keys[n];
    clearTimeout(key._litTimer);
    key.classList.add("lit");
    key._litTimer = setTimeout(() => key.classList.remove("lit"), 180);
    if (this.digits.length === core.DIGITS) {
      const code = this.digits.join("");
      setTimeout(() => this.submit(code), 240);
    }
  }

  async submit(code) {
    if (this.step === "create") {
      if (core.guessable(code)) {
        this.tell("That code is easy to guess. Avoid 1111, 1234 or 1212.", true);
        this.reject();
        return;
      }
      this.pendingCode = code;
      this.tell("");
      this.goTo("repeat");
      return;
    }

    if (this.step === "repeat") {
      if (code !== this.pendingCode) {
        this.pendingCode = null;
        this.tell("The two codes were different. Choose a code again.", true);
        this.reject();
        setTimeout(() => this.goTo("create"), 700);
        return;
      }
      this.working = true;
      this.tell("Sealing the hatch…");
      this.saved = { record: await core.deriveRecord(code), misses: core.cleanSlate() };
      this.persist();
      this.pendingCode = null;
      this.working = false;
      if (this.canBiometric) { this.tell("Code saved."); this.goTo("biometric"); } else this.open();
      return;
    }

    if (this.step === "enter") {
      this.working = true;
      this.tell("Checking…");
      const right = await core.matches(code, this.saved.record);
      this.working = false;
      if (right) {
        this.saved.misses = core.cleanSlate();
        this.persist();
        this.open();
        return;
      }
      this.saved.misses = core.afterMiss(this.saved.misses, Date.now());
      this.persist();
      this.reject();
      if (!this.watchWait()) {
        const left = core.attemptsRemaining(this.saved.misses);
        this.tell(`Wrong code. ${left} ${left === 1 ? "try" : "tries"} left before a wait.`, true);
      }
    }
  }

  /** A small sheet of portraits to choose from (only the ones whose file exists show). */
  chooseAvatar(id) {
    const m = this.members.find((x) => x.id === id);
    if (!m) return;
    const sheet = this.ui.crew.querySelector(".hs-avs") ?? Object.assign(document.createElement("div"), { className: "hs-avs" });
    // women's avatars first for a woman's body, men's first for a man's; any can be chosen
    const order = [...AVATARS].sort((a, b) => (b.body === m.body) - (a.body === m.body));
    sheet.innerHTML = `<p><strong>Avatar for ${esc(m.name.split(" ")[0])}</strong> <span class="fine">Shown on the health screens</span></p>
      <div class="hs-av-grid">${order.map((a) => `<button type="button" class="hs-av-opt" data-avatar="${a.id}" data-for="${esc(id)}" aria-pressed="${m.avatar === a.id}" aria-label="Avatar ${a.id}"><img src="${avatarSrc(a.id)}" alt="" onerror="this.closest('button').hidden=true"></button>`).join("")}
        <button type="button" class="hs-av-opt ini" data-avatar="" data-for="${esc(id)}" aria-pressed="${!m.avatar}">${avatarHtml({ ...m, avatar: null }, "hs-pic")}<small>Initials</small></button></div>
      <p class="fine hs-av-wait" hidden>The avatar pictures are not in the app yet: until they are, profiles show initials.</p>`;
    this.ui.crew.append(sheet);
    sheet.scrollIntoView({ block: "nearest" });
    setTimeout(() => { if (!sheet.querySelector(".hs-av-opt:not(.ini):not([hidden])")) sheet.querySelector(".hs-av-wait").hidden = false; }, 1200);
  }

  async onClick(e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.avatarFor !== undefined) { this.chooseAvatar(btn.dataset.avatarFor); return; }
    if (btn.dataset.avatar !== undefined) {
      const crew = getCrew();
      const m = crew.members.find((x) => x.id === btn.dataset.for);
      if (m) { if (btn.dataset.avatar) m.avatar = btn.dataset.avatar; else delete m.avatar; saveCrew(crew); this.members = crew.members; }
      this.goTo("who");
      return;
    }
    if (btn.dataset.pick !== undefined) { if (!this.working) await this.pick(btn.dataset.pick); return; }
    if (btn.dataset.key !== undefined) { if (Date.now() - (this.pointerAt ?? 0) > 700) this.press(Number(btn.dataset.key)); return; }

    switch (btn.dataset.do) {
      case "forgot":
        this.ui.veil.hidden = false;
        this.ui.veil.querySelector('[data-do="keep"]').focus();
        break;
      case "keep":
        this.ui.veil.hidden = true;
        break;
      case "erase":
        if (this.memberId === core.DEVICE_ID) eraseDevice();
        else { eraseMember(this.memberId); this.all = core.withoutAccess(this.all, this.memberId); writeStore(this.all); }
        this.saved = {};
        this.ui.veil.hidden = true;
        this.tell("Code erased. Choose a new code.");
        this.goTo("create");
        break;
      case "switch":
        this.pendingCode = null;
        this.goTo("who");
        break;
      case "restart":
        this.pendingCode = null;
        this.tell("");
        this.goTo("create");
        break;
      case "skip":
        this.open();
        break;
      case "enrol":
        btn.classList.add("busy");
        this.tell("Follow the prompt on your phone…");
        try {
          this.saved.biometric = await enrolBiometric();
          this.persist();
          this.tell("Fingerprint added.");
          this.open();
        } catch (err) {
          btn.classList.remove("busy");
          this.tell(err?.name === "NotAllowedError" ? "Fingerprint not added. You can add it next time." : (err?.message || "Fingerprint not added."), true);
        }
        break;
      case "biometric":
        if (this.waiting()) break;
        btn.classList.add("busy");
        this.tell("Follow the prompt on your phone…");
        try {
          const res = await confirmBiometric(this.saved.biometric);
          btn.classList.remove("busy");
          if (res.ok) this.open(); else this.tell(`${res.why} Use your code.`, true);
        } catch {
          btn.classList.remove("busy");
          this.tell("Fingerprint cancelled. Use your code.", true);
        }
        break;
      default:
    }
  }

  onKey(e) {
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); this.press(Number(e.key)); return; }
    if (e.key === "Backspace" && this.digits.length && !this.working) { this.digits.pop(); this.drawBolts(); return; }
    if (e.key === "Escape") {
      if (!this.ui.veil.hidden) this.ui.veil.hidden = true;
      else if (!this.working) { this.digits = []; this.drawBolts(); }
    }
  }
}
