import { Hatch } from "./hatch.js";
import { mountBody } from "./body.js";
import { mountToday } from "./today.js";
import { mountLog } from "./log.js";
import { mountMission } from "./mission.js";

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

function render() {
  const [view = "today", arg] = location.hash.replace(/^#/, "").split("/");
  const name = ["today", "body", "log", "mission"].includes(view) ? view : "today";
  if (name === "today") mountToday(station, { go }, /^\d{4}-\d{2}-\d{2}$/.test(arg ?? "") ? arg : undefined);
  if (name === "body") {
    const body = mountBody(station);
    if (arg) body.select(arg);
  }
  if (name === "log") mountLog(station, { go }, /^\d{4}-\d{2}-\d{2}$/.test(arg ?? "") ? arg : undefined);
  if (name === "mission") mountMission(station);
  for (const a of nav.querySelectorAll("a")) {
    if (a.dataset.view === name) a.setAttribute("aria-current", "page");
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

window.addEventListener("hashchange", render);
document.querySelector('[data-action="lock"]').addEventListener("click", closeHatch);
render();
stampUtc();
setInterval(stampUtc, 1000);
closeHatch();
