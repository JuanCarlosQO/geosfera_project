import { loadDemo, refreshDemoProfiles } from "./demo.js";
import { mountFamily } from "./family.js";
import { Hatch } from "./hatch.js";
import { mountBody } from "./body.js";
import { mountToday } from "./today.js";
import { mountLog } from "./log.js";
import { mountDevices, autoSync, followEva, refreshWatchAlerts } from "./devices.js";
import { subscribe } from "./feed.js";
import { mountMission } from "./mission.js";
import { mountMeds } from "./meds.js";
import { mountDuty } from "./duty.js";
import { mountLive } from "./telemetry.js";
import { mountFuture } from "./future.js";
import { mountSources } from "./sources.js";
import { mountSupport } from "./support.js";
import { mountMind } from "./mind.js";
import { startSync, mountSyncButton } from "./sync.js";
import { initFold } from "./fold.js";
import { mountAlarm } from "./alarm.js";
import { mountFamilyNotify } from "./family-notify.js";
import { initI18n } from "./i18n.js";
import { mountCrewHome } from "./crew-home.js";
import { mountGround } from "./ground.js";
import { getRole, setRole, isGround, openEmergency, closeEmergency } from "./role.js";
import { canSee, homeFor, emergencyLeft, inEmergency, reasonLabel } from "./role-core.js";
import { snapshot } from "./feed.js";
import { avatarHtml } from "./avatar.js";
import * as S from "./store.js";

initI18n(); // English as written, or Spanish from the dictionary (top-bar button)

const station = document.getElementById("station");
const hatchRoot = document.getElementById("hatch-root");
const nav = document.querySelector(".dock");

function stampUtc() {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  for (const el of document.querySelectorAll("[data-utc]")) el.textContent = `${hh}:${mm} UTC`;
}

const go = (route) => { location.hash = route; };

// Look: light or dark. Both are the same app with the same screens; only the colours change
// (css/dark.css). The structure is always data-theme="day"; data-mode says which palette.
// The saved value keeps its old names: "day" (light) and "night" (dark).
const THEME_KEY = "geosfera.theme";
function applyTheme(theme) {
  const dark = theme === "night";
  document.documentElement.dataset.theme = "day";
  document.documentElement.dataset.mode = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#07080d" : "#eef2f8");
}
let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_KEY); } catch { /* storage blocked */ }
applyTheme(savedTheme);

const roleBar = document.getElementById("role-bar");
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const actNow = () => Boolean(snapshot()?.steady?.some((a) => a.status === "act"));

/** The strip under the masthead: whose record the ground is looking at, or a crew member's open emergency. */
function paintRoleBar(name) {
  const st = getRole();
  const me = S.current();
  if (st.role === "ground" && me && name !== "ground") {
    const crew = S.getCrew().members;
    roleBar.hidden = false;
    roleBar.dataset.kind = "ground";
    roleBar.innerHTML = `<span class="rb-tag mono">GROUND</span><span class="rb-txt">Record of</span>
      <span class="rb-crew" role="group" aria-label="Crew member">${crew.map((m) => `<button type="button" class="rb-who" data-rb-who="${esc(m.id)}" aria-pressed="${m.id === me.id}">${avatarHtml(m, "rb-av")}<span data-no-i18n>${esc(m.name.split(" ")[0])}</span></button>`).join("")}</span>
      <a class="rb-link" href="#ground">All crew</a>`;
    return;
  }
  if (inEmergency(st)) {
    roleBar.hidden = false;
    roleBar.dataset.kind = "emergency";
    roleBar.innerHTML = `<span class="rb-tag mono">EMERGENCY</span><span class="rb-txt">Your own data is open · ${emergencyLeft(st)} min left · ${reasonLabel(st.emergency.reason)} · the ground team sees this opening</span>
      <button type="button" class="rb-link" data-rb="close">Hide my data</button>`;
    return;
  }
  roleBar.hidden = true;
  roleBar.innerHTML = "";
}

function paintDock(name) {
  const st = getRole();
  for (const a of nav.querySelectorAll("a")) {
    const v = a.dataset.view;
    // the ground has no "Home"; a crew member's dock is Home and Meds (everything, during an emergency)
    a.hidden = !canSee(st, v) || (st.role === "crew" && v === "ground") || (st.role !== "crew" && v === "crew") || (st.role !== "ground" && v === "ground");
  }
}

function render() {
  const [view = "", arg, rest] = location.hash.replace(/^#/, "").split("/");
  const known = ["today", "body", "log", "mission", "meds", "duty", "live", "future", "sources", "mind", "family", "devices", "crew", "ground"];
  const st = getRole();
  let name = known.includes(view) ? view : homeFor(st);
  if (!canSee(st, name)) {
    // a crew member whose alarm says "Act now" gets their data at once; otherwise, back home
    if (st.role === "crew" && actNow() && S.current() && openEmergency("alarm", S.current().id)) return render();
    if (location.hash !== `#${homeFor(st)}`) { location.hash = homeFor(st); return; }
    name = homeFor(st);
  }
  paintRoleBar(name);
  paintDock(name);
  if (name === "crew") mountCrewHome(station);
  if (name === "ground") mountGround(station);
  if (["today", "log", "mind"].includes(name)) autoSync(); // readings from the devices arrive before the screen is drawn
  setTimeout(refreshWatchAlerts, 0); // and the watch's alerts follow the profile that is open
  if (name === "devices") mountDevices(station);
  if (name === "today") mountToday(station, { go }, /^\d{4}-\d{2}-\d{2}$/.test(arg ?? "") ? arg : undefined);
  if (name === "meds") mountMeds(station);
  if (name === "duty") mountDuty(station);
  if (name === "live") mountLive(station, arg);
  if (name === "future") mountFuture(station);
  if (name === "sources") mountSources(station);
  if (name === "family") mountFamily(station, { arg, payload: rest });
  if (name === "mind") mountMind(station, { talk: () => support.talk() });
  if (name === "body") {
    const body = mountBody(station);
    if (arg) body.select(arg);
  }
  if (name === "log") mountLog(station, { go }, /^\d{4}-\d{2}-\d{2}$/.test(arg ?? "") ? arg : undefined);
  if (name === "mission") mountMission(station);
  for (const a of nav.querySelectorAll("a")) {
    if (a.dataset.view === ({ duty: "meds", future: "mission", mind: "body", family: getRole().role === "crew" ? "crew" : "body", devices: "log" }[name] ?? name)) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  if (!station.inert) station.querySelector("h1")?.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

/** Signs out (or asks for one profile's code when memberId is given) and shows the hatch. */
async function closeHatch(memberId = null) {
  station.inert = true;
  nav.inert = true;
  if (S.getCrew().members.length) { setRole({}); refreshWatchAlerts(); } // signed out: no readings behind the hatch
  const hatch = new Hatch(hatchRoot, {
    memberId: typeof memberId === "string" ? memberId : null,
    onEnter() {
      station.inert = false;
      nav.inert = false;
      const home = homeFor(getRole());
      if (location.hash !== `#${home}`) location.hash = home; else render();
    }
  });
  await hatch.show();
  stampUtc();
}

// a shared link ending in ?demo opens with the demo crew (only on a device with no crew yet)
if (new URLSearchParams(location.search).has("demo")) {
  loadDemo();
  history.replaceState(null, "", location.pathname + location.hash); // so a reload after "Remove demo crew" stays empty
}
refreshDemoProfiles(); // a demo crew saved by an older version gets the fields added since (Valentina's body)
const support = mountSupport(); // the support button works even with the hatch closed
mountAlarm(); // telemetry alerts on every screen, with sound, and sleep mode
subscribe(followEva); // a spacewalk in the simulator takes the watch off and holds family notices
// the watch's own alerts (watch off too long, short night) join the alert bar on every screen
refreshWatchAlerts();
setInterval(refreshWatchAlerts, 60000);
document.addEventListener("ergosphere:watch", refreshWatchAlerts);
window.addEventListener("hashchange", () => setTimeout(refreshWatchAlerts, 50));
mountFamilyNotify(); // a message from home is announced on whatever screen is open
initFold(station); // tabs, and intros and sources tucked away on every screen
window.addEventListener("hashchange", render);
document.addEventListener("ergosphere:family-read", () => { if (["#family", "#mind", "#today", ""].includes(location.hash.split("/")[0])) render(); }); // the inbox changed under an open screen
window.addEventListener("geosfera:synced", () => { if (!document.querySelector(".veil:not([hidden])")) render(); });
mountSyncButton(document.querySelector('[data-action="sync"]'), document.body);
startSync();
document.querySelector('[data-action="lock"]').addEventListener("click", () => closeHatch()); // sign out: back to the profiles
// another crew member's profile is opened with that person's own code
document.addEventListener("click", (e) => { if (e.target.closest('[data-action="signout"]')) closeHatch(); }); // "Sign out" inside the app
// the ground team opens any crew member's record at once; a crew member needs that person's own code
document.addEventListener("ergosphere:switch", (e) => {
  if (!e.detail || e.detail === S.current()?.id) return;
  if (isGround()) { S.setActive(e.detail); render(); } else closeHatch(e.detail);
});
roleBar.addEventListener("click", (e) => {
  const w = e.target.closest("[data-rb-who]");
  if (w) { S.setActive(w.dataset.rbWho); render(); return; }
  if (e.target.closest('[data-rb="close"]')) { closeEmergency(); location.hash = "#crew"; render(); }
});
// an emergency opening ends by itself: check each minute
setInterval(() => { const st = getRole(); if (st.emergency && !inEmergency(st)) { closeEmergency(); render(); } else if (inEmergency(st)) paintRoleBar(); }, 60000);
// an "Act now" alarm while a crew member is on their own home opens their data
subscribe((f, raised) => {
  const st = getRole();
  if (st.role === "crew" && !inEmergency(st) && raised?.some((ev) => ev.type === "raised" && ev.status === "act") && S.current()) {
    openEmergency("alarm", S.current().id);
    render();
  }
});
document.querySelector('[data-action="theme"]').addEventListener("click", () => {
  const next = document.documentElement.dataset.mode === "dark" ? "day" : "night";
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* storage blocked */ }
  render();
});
render();
stampUtc();
setInterval(stampUtc, 1000);

// Preview mode for the hackathon: the app starts already inside the station so anyone with
// the link can look around at once. The hatch is still there: the lock button closes it and
// asks for the crew code. Set START_UNLOCKED to false to start behind the hatch again.
// With a crew on the device the app now opens on the profiles, each with its own code (the demo
// profiles show theirs). A device with no crew yet opens straight on "create your crew".
const START_UNLOCKED = !S.getCrew().members.length;
if (START_UNLOCKED) {
  station.inert = false;
  nav.inert = false;
} else {
  closeHatch();
}
