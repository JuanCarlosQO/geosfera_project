import { Hatch } from "./hatch.js";
import { mountBody } from "./body.js";
import { mountToday } from "./today.js";

const station = document.getElementById("station");
const hatchRoot = document.getElementById("hatch-root");
const nav = document.querySelector(".dock");

function stampUtc() {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  for (const el of document.querySelectorAll("[data-utc]")) el.textContent = `${hh}:${mm} UTC`;
}

function mountLog(host) {
  host.innerHTML = `
  <section class="intro" aria-labelledby="log-title">
    <p class="eyebrow">Module 3 · In progress</p>
    <h1 id="log-title" tabindex="-1">Daily log</h1>
    <p>This is where you will record heart rate, blood pressure, temperature, blood oxygen, sleep and exercise. Each reading will light up its window in the Cupola.</p>
    <p class="fine">Being built now. Until it is ready, every window shows "No data".</p>
    <a class="textlink" href="#today">Back to today</a>
  </section>`;
}

const go = (route) => { location.hash = route; };

function render() {
  const [view = "today", arg] = location.hash.replace(/^#/, "").split("/");
  const name = ["today", "body", "log"].includes(view) ? view : "today";
  if (name === "today") mountToday(station, { go });
  if (name === "body") {
    const body = mountBody(station);
    if (arg) body.select(arg);
  }
  if (name === "log") mountLog(station);
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
