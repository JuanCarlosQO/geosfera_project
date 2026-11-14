// Module 1 — the airlock hatch. Builds the access screen and drives it.
// All decisions (code rules, hashing, waits, fingerprint check) come from access-core.js.

import * as core from "./access-core.js";

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
  biometric: "Add your fingerprint or face to open faster"
};

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function markup() {
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
      <span class="mark"><img src="assets/mark.svg" width="22" height="22" alt=""><span>GEOSFERA</span></span>
      <time class="utc" data-utc>--:-- UTC</time>
    </div>
    <div class="hs-title">
      <h1 id="hs-heading">${timeOfDay()}, Commander</h1>
      <p data-ref="hint"></p>
    </div>
  </div>

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
    <p class="disclaimer">Device lock, not encryption. The code never leaves this device and is kept only as a salted hash.</p>
  </div>

  <div class="arrival" aria-hidden="true">
    <span class="eyebrow">Pressure equalised</span>
    <h2>Welcome aboard,<br>Commander.</h2>
    <p>Opening the station…</p>
  </div>

  <div class="veil" data-ref="veil" hidden>
    <div class="sheet" role="alertdialog" aria-labelledby="fg-h" aria-describedby="fg-p">
      <h2 id="fg-h">Forgot your code?</h2>
      <p id="fg-p">It cannot be recovered. Resetting erases everything Geosfera saved on this device, and then you choose a new code.</p>
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
  try { localStorage.clear(); } catch { /* nothing to erase */ }
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
      rp: { name: "Geosfera", id: location.hostname },
      user: { id: core.freshBytes(16), name: "crew-member", displayName: "Crew member" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      attestation: "none",
      timeout: 60_000
    }
  });
  const spki = cred.response.getPublicKey?.();
  if (!spki) throw new Error("This browser cannot keep a fingerprint for Geosfera.");
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
  constructor(root, { onEnter }) {
    this.root = root;
    this.onEnter = onEnter;
    this.saved = readStore();
    this.digits = [];
    this.pendingCode = null;
    this.working = false;
    this.countdown = null;
  }

  async show() {
    this.root.innerHTML = markup();
    this.screen = this.root.firstElementChild;
    const ref = (name) => this.screen.querySelector(`[data-ref="${name}"]`);
    this.ui = { hatch: ref("hatch"), hint: ref("hint"), readout: ref("readout"), choices: ref("choices"), veil: ref("veil") };
    this.keys = [...this.screen.querySelectorAll(".key")];
    this.bolts = [...this.screen.querySelectorAll(".bolt")];
    this.canBiometric = await biometricReady();

    this.screen.addEventListener("click", (e) => this.onClick(e));
    this.screen.addEventListener("keydown", (e) => this.onKey(e));

    this.goTo(this.saved.record ? "enter" : "create");
    if (!this.saved.record) this.tell("First time on this device: set your crew code.");
    this.screen.focus();
  }

  tell(text, warn = false) {
    this.ui.readout.textContent = text;
    this.ui.readout.classList.toggle("warn", warn);
  }

  drawBolts() {
    this.bolts.forEach((b, i) => b.classList.toggle("shot", i < this.digits.length));
  }

  lockKeys(off) {
    this.keys.forEach((k) => { k.disabled = off; });
  }

  goTo(step) {
    this.step = step;
    this.digits = [];
    this.drawBolts();
    this.ui.hint.textContent = HINTS[step];
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
    key.classList.add("lit");
    setTimeout(() => key.classList.remove("lit"), 240);
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
      writeStore(this.saved);
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
        writeStore(this.saved);
        this.open();
        return;
      }
      this.saved.misses = core.afterMiss(this.saved.misses, Date.now());
      writeStore(this.saved);
      this.reject();
      if (!this.watchWait()) {
        const left = core.attemptsRemaining(this.saved.misses);
        this.tell(`Wrong code. ${left} ${left === 1 ? "try" : "tries"} left before a wait.`, true);
      }
    }
  }

  async onClick(e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.key !== undefined) { this.press(Number(btn.dataset.key)); return; }

    switch (btn.dataset.do) {
      case "forgot":
        this.ui.veil.hidden = false;
        this.ui.veil.querySelector('[data-do="keep"]').focus();
        break;
      case "keep":
        this.ui.veil.hidden = true;
        break;
      case "erase":
        eraseDevice();
        this.saved = {};
        this.ui.veil.hidden = true;
        this.tell("Lock erased. Choose a new code.");
        this.goTo("create");
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
          writeStore(this.saved);
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
