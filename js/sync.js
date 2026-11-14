// Station sync client: links this device to a station, keeps local data and the cloud copy
// together, and shows a status button in the masthead. Works offline; syncs when it can.

import * as Y from "./sync-core.js";

const API = "api/sync";
const listeners = new Set();
let state = { status: "off", message: "Not linked", last: null };
let timer = null;
let busy = false;
let again = false;
let applying = false;

const readCfg = () => { try { return JSON.parse(localStorage.getItem(Y.SYNC_KEY)) ?? null; } catch { return null; } };
const writeCfg = (c) => { try { localStorage.setItem(Y.SYNC_KEY, JSON.stringify(c)); } catch { /* ignore */ } };

function setState(s) { state = { ...state, ...s }; listeners.forEach((f) => f(state)); }
export const onSync = (f) => { listeners.add(f); f(state); return () => listeners.delete(f); };
export const linked = () => Boolean(readCfg()?.stationId);

function entries() {
  const out = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k?.startsWith("geosfera.")) out[k] = localStorage.getItem(k);
  }
  return out;
}

function apply(merged) {
  applying = true;
  try {
    for (const [k, st] of Object.entries(merged.stamps)) {
      if (st.deleted) localStorage.removeItem(k);
      else if (merged.keys[k] != null && localStorage.getItem(k) !== merged.keys[k]) localStorage.setItem(k, merged.keys[k]);
    }
  } finally { applying = false; }
}

async function call(method, cfg, body) {
  const r = await fetch(`${API}?station=${encodeURIComponent(cfg.stationId)}`, {
    method, headers: { Authorization: `Bearer ${cfg.token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined, cache: "no-store"
  });
  let data = {};
  try { data = await r.json(); } catch { /* empty */ }
  return { status: r.status, data };
}

/** One full round: pull, merge, apply locally, push if the cloud copy is behind. */
export async function syncNow() {
  const cfg = readCfg();
  if (!cfg?.stationId) { setState({ status: "off", message: "Not linked" }); return; }
  if (busy) { again = true; return; }
  if (!navigator.onLine) { setState({ status: "offline", message: "Offline · will sync" }); return; }
  busy = true;
  setState({ status: "syncing", message: "Syncing…" });
  try {
    const local = Y.snapshot(entries(), cfg.stamps ?? {});
    let got = await call("GET", cfg);
    let remote = null;
    let version = 0;
    if (got.status === 200) {
      remote = await Y.open(got.data.blob, cfg.key);
      if (!remote) throw new Error("This device's station code no longer matches.");
      version = got.data.version;
    } else if (got.status === 403) throw new Error("Wrong station code.");
    else if (got.status !== 404) throw new Error(got.data.error || `Server error ${got.status}`);

    let merged = remote ? Y.mergeSnapshots(local, remote) : local;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (remote && Y.sameSnapshot(merged, remote)) break;
      const put = await call("PUT", cfg, { blob: await Y.seal(merged, cfg.key), baseVersion: version });
      if (put.status === 200) { version = put.data.version; break; }
      if (put.status === 409) {
        remote = await Y.open(put.data.blob, cfg.key);
        version = put.data.version;
        merged = Y.mergeSnapshots(local, remote ?? { keys: {}, stamps: {} });
        continue;
      }
      throw new Error(put.data.error || `Server error ${put.status}`);
    }
    const changed = !Y.sameSnapshot(local, merged);
    apply(merged);
    writeCfg({ ...cfg, version, stamps: Y.snapshot(entries(), merged.stamps).stamps, last: new Date().toISOString() });
    const t = new Date().toISOString().slice(11, 16);
    setState({ status: "ok", message: `Synced ${t} UTC`, last: t });
    if (changed) window.dispatchEvent(new CustomEvent("geosfera:synced"));
  } catch (err) {
    setState({ status: "error", message: err.message || "Sync failed" });
  } finally {
    busy = false;
    if (again) { again = false; syncNow(); }
  }
}

function soon() { clearTimeout(timer); timer = setTimeout(syncNow, 1500); }

/** Creates a new station, or joins one, from this device. Returns { ok, why? }. */
export async function link({ mode, stationId, code }) {
  if (!Y.validCode(code)) return { ok: false, why: "The station code needs at least 8 characters." };
  let id = mode === "create" ? Y.newStationId() : Y.normaliseId(stationId);
  if (!Y.validStationId(id)) return { ok: false, why: "Station IDs look like GSF-7K2QXM." };
  setState({ status: "syncing", message: "Linking…" });
  try {
    for (let tries = 0; tries < 3; tries += 1) {
      const sec = await Y.deriveSecrets(code, id);
      const cfg = { stationId: id, token: sec.token, key: sec.key, version: 0, stamps: {} };
      const got = await call("GET", cfg);
      if (got.status === 503) return { ok: false, why: got.data.error };
      if (mode === "join") {
        if (got.status === 404) return { ok: false, why: "No station with this ID yet. Check the ID, or create the station on the first device." };
        if (got.status === 403) return { ok: false, why: "Wrong station code." };
        if (got.status !== 200 || !(await Y.open(got.data.blob, sec.key))) return { ok: false, why: "Could not open this station's data with that code." };
      } else if (got.status !== 404) { id = Y.newStationId(); continue; }
      writeCfg(cfg);
      await syncNow();
      return { ok: state.status === "ok", id, why: state.status === "ok" ? null : state.message };
    }
    return { ok: false, why: "Could not create a station ID. Try again." };
  } catch {
    setState({ status: "error", message: "No connection to the sync server." });
    return { ok: false, why: "No connection to the sync server." };
  }
}

export function unlink() {
  try { localStorage.removeItem(Y.SYNC_KEY); } catch { /* ignore */ }
  setState({ status: "off", message: "Not linked", last: null });
}

export function startSync() {
  const proto = Storage.prototype;
  const set = proto.setItem;
  const remove = proto.removeItem;
  const touch = (k) => { if (!applying && typeof k === "string" && k.startsWith("geosfera.") && !Y.LOCAL_ONLY.includes(k) && linked()) soon(); };
  proto.setItem = function (k, v) { set.call(this, k, v); touch(k); };
  proto.removeItem = function (k) { remove.call(this, k); touch(k); };
  window.addEventListener("online", syncNow);
  window.addEventListener("offline", () => linked() && setState({ status: "offline", message: "Offline · will sync" }));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncNow(); });
  setInterval(() => { if (document.visibilityState === "visible") syncNow(); }, 45_000);
  syncNow();
}

/* ---------- UI: masthead button and station sheet ---------- */

export function sheetHtml() {
  const cfg = readCfg();
  if (cfg?.stationId) {
    return `<div class="veil sync-veil" data-ref="sync-veil"><div class="sheet sync-sheet" role="dialog" aria-modal="true" aria-labelledby="sy-h">
      <div class="mc-head"><h2 id="sy-h">Station sync</h2><button type="button" class="round-btn" data-sync="close" aria-label="Close">✕</button></div>
      <p class="sy-status" data-ref="sy-status">${state.message}</p>
      <div class="sy-id"><span class="eyebrow">Station ID</span><strong>${cfg.stationId}</strong><button type="button" class="cta" data-sync="copy">Copy</button></div>
      <p class="fine">On another device or browser: open Geosfera, tap the sync button, choose “Join a station” and type this ID and your station code. Data is encrypted on the device with that code; the server cannot read it.</p>
      <div class="data-btns"><button type="button" class="cta" data-sync="now">Sync now</button><button type="button" class="cta" data-sync="unlink">Unlink this device</button></div>
    </div></div>`;
  }
  return `<div class="veil sync-veil" data-ref="sync-veil"><div class="sheet sync-sheet" role="dialog" aria-modal="true" aria-labelledby="sy-h">
    <div class="mc-head"><h2 id="sy-h">Station sync</h2><button type="button" class="round-btn" data-sync="close" aria-label="Close">✕</button></div>
    <p class="fine">Link devices to one station so every crew member's records show on any device or browser. The station code encrypts the data before it leaves the device: share it only with your crew, and keep it safe — it cannot be recovered.</p>
    <form class="sy-form" data-mode="create" novalidate>
      <h3>New station <small>first device</small></h3>
      <label class="cf-field"><span>Station code (8+ characters)</span><input name="code" type="password" autocomplete="new-password" minlength="8" required></label>
      <button type="submit" class="cta-wide cf-add">Create station</button>
    </form>
    <form class="sy-form" data-mode="join" novalidate>
      <h3>Join a station <small>other devices</small></h3>
      <label class="cf-field"><span>Station ID</span><input name="station" type="text" autocomplete="off" placeholder="GSF-7K2QXM" required></label>
      <label class="cf-field"><span>Station code</span><input name="code" type="password" autocomplete="current-password" required></label>
      <button type="submit" class="cta-wide cf-add">Join station</button>
    </form>
    <p class="cf-msg" data-ref="sy-msg" role="status" aria-live="polite"></p>
  </div></div>`;
}

export function mountSyncButton(btn, host) {
  const label = btn.querySelector("[data-sync-label]");
  onSync((s) => { btn.dataset.state = s.status; label.textContent = s.status === "ok" ? s.last ?? "Synced" : s.status === "off" ? "Sync" : s.message.split(" ")[0]; btn.title = s.message; });
  btn.addEventListener("click", () => openSheet(host));
}

function openSheet(host) {
  host.querySelector('[data-ref="sync-veil"]')?.remove();
  host.insertAdjacentHTML("beforeend", sheetHtml());
  const veil = host.querySelector('[data-ref="sync-veil"]');
  const close = () => { veil.remove(); window.dispatchEvent(new CustomEvent("geosfera:synced")); };
  const off = onSync((s) => { const el = veil.querySelector('[data-ref="sy-status"]'); if (el) el.textContent = s.message; });
  veil.addEventListener("click", async (e) => {
    if (e.target === veil) { off(); close(); return; }
    const a = e.target.closest("[data-sync]")?.dataset.sync;
    if (a === "close") { off(); close(); }
    if (a === "now") syncNow();
    if (a === "copy") { try { await navigator.clipboard.writeText(readCfg().stationId); e.target.textContent = "Copied"; } catch { /* ignore */ } }
    if (a === "unlink" && confirm("Unlink this device? Its data stays here; it just stops syncing.")) { unlink(); off(); veil.remove(); openSheet(host); }
  });
  veil.querySelectorAll(".sy-form").forEach((form) => form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = veil.querySelector('[data-ref="sy-msg"]');
    msg.textContent = form.dataset.mode === "create" ? "Creating the station…" : "Joining…";
    const r = await link({ mode: form.dataset.mode, stationId: form.station?.value, code: form.code.value });
    if (!r.ok) { msg.textContent = r.why; return; }
    off(); veil.remove(); openSheet(host);
  }));
  veil.querySelector("input, [data-sync='close']")?.focus();
}
