// "Export to Excel" for the ground team: pick the dates and the crew, get one .xlsx with a sheet
// per kind of record (rules and file format: export-core.js).

import { getCrew, readLog } from "./store.js";
import * as E from "./export-core.js";
import { MEDS_KEY, cleanStore } from "./meds-core.js";
import { KIT } from "./data/med-kit.js";
import { SUPPLEMENTS } from "./data/supplements.js";
import * as X from "./exercise-core.js";
import { exerciseStore } from "./exercise.js";
import { getRequests } from "./share.js";
import { getOpenings } from "./role.js";
import { reasonLabel } from "./role-core.js";
import { DRILLS_KEY, cleanDrills, outcomeLabel } from "./drill-core.js";
import { itemLabel } from "./share-core.js";
import { addDays } from "./predict-core.js";
import { getCheckins } from "./checkin.js";
import { phq9Band, gad7Band } from "./screen-core.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const todayUtc = () => new Date().toISOString().slice(0, 10);

/** The panel; `only` preselects one crew member (from their analysis). */
export function exportHtml({ only = null } = {}) {
  const crew = getCrew().members;
  const to = todayUtc(), from = addDays(to, -13);
  return `<section class="an-card xp" aria-labelledby="xp-h">
    <h2 id="xp-h">Export to Excel</h2>
    <p class="fine">One .xlsx file with a sheet each for readings, medications, exercise, mental health check-ins, data access, emergency openings and drills. Times in UTC, with Houston and Florida beside them.</p>
    <form class="xp-form" data-xp>
      <div class="xp-dates">
        <label>From (UTC) <input type="date" name="from" value="${from}" max="${to}"></label>
        <label>To (UTC) <input type="date" name="to" value="${to}" max="${to}"></label>
        <div class="xp-quick" role="group" aria-label="Quick ranges">
          <button type="button" class="chip-btn" data-xp-days="7">Last 7 days</button>
          <button type="button" class="chip-btn" data-xp-days="14">Last 14 days</button>
          <button type="button" class="chip-btn" data-xp-days="30">Last 30 days</button>
          <button type="button" class="chip-btn" data-xp-days="0">Whole mission</button>
        </div>
      </div>
      <fieldset class="xp-crew"><legend>Crew</legend>${crew.map((m) => `<label class="sh-chk"><input type="checkbox" name="m" value="${esc(m.id)}"${!only || only === m.id ? " checked" : ""}><span data-no-i18n>${esc(m.name)}</span></label>`).join("")}</fieldset>
      <div class="sh-row"><button type="submit" class="cta main">Download Excel</button><span class="sh-msg" role="status" data-xp-msg></span></div>
    </form>
  </section>`;
}

function gather() {
  const meds = cleanStore(read(MEDS_KEY, null), KIT, SUPPLEMENTS);
  const members = getCrew().members;
  return {
    members, logs: Object.fromEntries(members.map((m) => [m.id, readLog(m.id)])),
    doses: meds.doses, kit: KIT, exercise: exerciseStore(), requests: getRequests(), openings: getOpenings(), drills: cleanDrills(read(DRILLS_KEY, [])), checkins: getCheckins(), phq9Band, gad7Band,
    itemLabel, reasonLabel, outcomeLabel, sessionLabel: X.sessionLabel, symptomLabel: X.symptomLabel, moveLabel: (id) => X.MOVES[id] ?? id
  };
}

export function bindExport(root) {
  const f = root.querySelector("[data-xp]");
  if (!f) return;
  f.addEventListener("click", (e) => {
    const q = e.target.closest("[data-xp-days]");
    if (!q) return;
    const n = Number(q.dataset.xpDays);
    f.to.value = todayUtc();
    f.from.value = n ? addDays(todayUtc(), -(n - 1)) : (read("geosfera.mission", {}).start ?? "");
  });
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = f.querySelector("[data-xp-msg]");
    const members = [...f.querySelectorAll('input[name="m"]:checked')].map((i) => i.value);
    if (!members.length) { msg.textContent = "Choose at least one crew member."; return; }
    let { value: from } = f.from, { value: to } = f.to;
    if (from && to && from > to) [from, to] = [to, from];
    const sheets = E.buildSheets(gather(), { from, to, members });
    const rows = sheets.reduce((a, s) => a + s.rows.length, 0);
    const bytes = E.xlsx(sheets, { title: `Ergosphere export ${from || "start"} to ${to || todayUtc()}` });
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: E.fileName(from, to, todayUtc()) });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    msg.textContent = `Downloaded: ${rows} rows`;
  });
}
