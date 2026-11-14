import { Hatch } from "./hatch.js";
import { mountBody } from "./body.js";

const station = document.getElementById("station");
const hatchRoot = document.getElementById("hatch-root");

function stampUtc() {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  for (const el of document.querySelectorAll("[data-utc]")) el.textContent = `${hh}:${mm} UTC`;
}

async function closeHatch() {
  station.inert = true;
  const hatch = new Hatch(hatchRoot, {
    onEnter() {
      station.inert = false;
      station.querySelector("h1")?.focus();
      station.querySelector(".body-module")?.classList.remove("ready");
      requestAnimationFrame(() => station.querySelector(".body-module")?.classList.add("ready"));
    }
  });
  await hatch.show();
  stampUtc();
}

document.querySelector('[data-action="lock"]').addEventListener("click", closeHatch);
mountBody(station);
stampUtc();
setInterval(stampUtc, 1000);
closeHatch();
