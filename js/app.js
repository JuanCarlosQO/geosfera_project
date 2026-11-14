import { loadDemo } from "./demo.js";
import { mountFamily } from "./family.js";
import { Hatch } from "./hatch.js";
import { mountBody } from "./body.js";
import { mountToday } from "./today.js";
import { mountLog } from "./log.js";
import { mountMission } from "./mission.js";
import { mountMeds } from "./meds.js";
import { mountDuty } from "./duty.js";
import { mountLive } from "./telemetry.js";
import { mountFuture } from "./future.js";
import { mountSources } from "./sources.js";
import { mountSupport } from "./support.js";
import { mountMind } from "./mind.js";
import { startSync, mountSyncButton } from "./sync.js";

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

// Look: "day" (clinical, the default) or "night" (the original low-orbit look with the Cupola).
const THEME_KEY = "geosfera.theme";
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "night" ? "night" : "day";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "night" ? "#05070a" : "#eef2f8");
}
let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_KEY); } catch { /* storage blocked */ }
applyTheme(savedTheme);

function render() {
  const [view = "today", arg, rest] = location.hash.replace(/^#/, "").split("/");
  const name = ["today", "body", "log", "mission", "meds", "duty", "live", "future", "sources", "mind", "family"].includes(view) ? view : "today";
  if (name === "today") mountToday(station, { go }, /^\d{4}-\d{2}-\d{2}$/.test(arg ?? "") ? arg : undefined);
  if (name === "meds") mountMeds(station);
  if (name === "duty") mountDuty(station);
  if (name === "live") mountLive(station);
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
    if (a.dataset.view === ({ duty: "meds", future: "mission", mind: "body", family: "body" }[name] ?? name)) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  if (!station.inert) station.querySelector("h1")?.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

async function closeHatch() {
  station.inert = true;
  nav.inert = true;
  const hatch = new Hatch(hatchRoot, {
    onEnter() {
      station.inert = false;
      nav.inert = false;
      render();
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
const support = mountSupport(); // the support button works even with the hatch closed
window.addEventListener("hashchange", render);
window.addEventListener("geosfera:synced", () => { if (!document.querySelector(".veil:not([hidden])")) render(); });
mountSyncButton(document.querySelector('[data-action="sync"]'), document.body);
startSync();
document.querySelector('[data-action="lock"]').addEventListener("click", closeHatch);
document.querySelector('[data-action="theme"]').addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "night" ? "day" : "night";
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
const START_UNLOCKED = true;
if (START_UNLOCKED) {
  station.inert = false;
  nav.inert = false;
} else {
  closeHatch();
}
