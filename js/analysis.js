// One crew member's analysis for the ground team (#analysis): what to look at, today against
// their own usual for every reading, the last two weeks with the next week forecast, and
// outlooks to the mission's end (sleep debt, exercise and bone, radiation). Then what they told
// us, with links to the detailed screens. Rules: crew-status.js, predict-core.js.

import { current } from "./store.js";
import { crewStatus, mission } from "./crew-status.js";
import * as P from "./predict-core.js";
import * as C from "./sleepcheck-core.js";
import { missionDay } from "./today-core.js";
import { avatarHtml } from "./avatar.js";
import { LEVEL_WORDS, KIND, usualWord, missionLine } from "./ground.js";
import { sleepCheckHtml, bindSleepCheck } from "./sleepcheck.js";
import { FUTURE_FACTS } from "./data/future.js";
import { EXERCISE_FACTS } from "./data/exercise.js";
import { fold } from "./fold.js";
import { groundShareHtml, bindGroundShare } from "./share.js";
import { exportHtml, bindExport } from "./export.js";
import { groundCheckinHtml, bindGroundCheckin, checkinAboutHtml } from "./checkin.js";
import { groundConnectHtml } from "./connect.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const quote = (f) => `“${f.quote}” <a href="${f.url}" target="_blank" rel="noopener">${f.source}</a>`;
const fmt = (v, unit) => (v == null ? "—" : unit === "h" ? C.hm(v) : `${v} ${unit}`);
const arrow = { rising: "↗", falling: "↘", steady: "→" };

/** Two weeks measured, a week forecast: the line, the crew member's usual band, the forecast band. */
function chart(log, key, today, base) {
  const past = P.series(log, key, today, 14), next = P.forecast(log, key, today, 7);
  const vals = [...past.map((p) => p.v), ...next.flatMap((p) => [p.lo, p.hi])].filter((v) => v != null);
  if (vals.length < 3) return `<p class="fine">Not enough days to draw.</p>`;
  const W = 520, H = 170, L = 34, R = 8, T = 10, B = 24, n = past.length + next.length;
  const lo = Math.min(...vals, base ? base.mean - base.sd : Infinity), hi = Math.max(...vals, base ? base.mean + base.sd : -Infinity);
  const x = (i) => L + (i / (n - 1)) * (W - L - R), y = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  let d = "", pen = false;
  past.forEach((p, i) => { if (p.v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)} `; pen = true; });
  const off = past.length;
  const lastI = past.map((p) => p.v).lastIndexOf(past.filter((p) => p.v != null).at(-1)?.v);
  const fLine = next.length ? `M${x(off - 1).toFixed(1)} ${y(past[off - 1].v ?? next[0].v).toFixed(1)} ` + next.map((p, k) => `L${x(off + k).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ") : "";
  const fBand = next.length ? `M${next.map((p, k) => `${x(off + k).toFixed(1)} ${y(p.hi).toFixed(1)}`).join(" L")} L${[...next].reverse().map((p, k) => `${x(off + next.length - 1 - k).toFixed(1)} ${y(p.lo).toFixed(1)}`).join(" L")} Z` : "";
  const band = base ? `<rect x="${L}" y="${y(base.mean + base.sd).toFixed(1)}" width="${W - L - R}" height="${Math.max(1, y(base.mean - base.sd) - y(base.mean + base.sd)).toFixed(1)}" class="an-usual"/>` : "";
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => `<text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${Math.round(v * 10) / 10}</text>`).join("");
  return `<svg class="an-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(P.metric(key).label)}: last 14 days and the next 7 forecast">
    ${band}<line x1="${x(off - 0.5).toFixed(1)}" x2="${x(off - 0.5).toFixed(1)}" y1="${T}" y2="${H - B}" class="an-now"/>
    ${fBand ? `<path d="${fBand}" class="an-fband"/>` : ""}<path d="${d}" class="an-line"/>${fLine ? `<path d="${fLine}" class="an-fline"/>` : ""}
    ${lastI >= 0 ? `<circle cx="${x(lastI).toFixed(1)}" cy="${y(past[lastI].v).toFixed(1)}" r="3.5" class="an-dot"/>` : ""}
    <g class="an-ticks">${ticks}</g>
    <text x="${L}" y="${H - 6}" class="an-cap">14 days ago</text><text x="${x(off - 0.5).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="an-cap">today</text><text x="${W - R}" y="${H - 6}" text-anchor="end" class="an-cap">+7 days</text>
  </svg>`;
}

export function mountAnalysis(host) {
  const me = current();
  if (!me) { location.hash = "#ground"; return; }
  const s = crewStatus(me);
  const m = mission();
  const lv = LEVEL_WORDS[s.level];
  const rows = P.METRICS.map((x) => P.analyse(s.log, x.key, s.today));
  const debt = P.sleepDebt(s.log, s.today);
  const bone = P.boneOutlook(s.adherence, m);
  const rad = P.radiationOutlook(s.log, s.today, m);
  const mday = m.start ? missionDay(m.start, new Date()) : null;

  host.innerHTML = `<section class="analysis">
    <header class="an-head">
      ${avatarHtml(me, "an-av")}
      <div>
        <p class="eyebrow">Analysis · ${esc(me.role)}${mday ? ` · Mission day ${mday}` : ""}</p>
        <h1 tabindex="-1"><span data-no-i18n>${esc(me.name)}</span> <span class="mc-pill mc-${lv.cls}">${lv.word}</span></h1>
        ${missionLine(0)}
      </div>
    </header>

    <section class="an-card" aria-labelledby="an-look">
      <h2 id="an-look">Look at</h2>
      ${s.items.length ? `<ul class="an-items">${s.items.map((i) => `<li class="mc-${i.level}"><span class="mc-kind">${KIND[i.kind]}</span><span>${esc(i.text)}</span></li>`).join("")}</ul>` : `<p class="fine">Nothing to look at: every reading is within their usual and nothing was reported.</p>`}
    </section>

    <section class="an-card" aria-labelledby="an-table">
      <h2 id="an-table">Today against their usual</h2>
      <div class="an-scroll"><table class="an-tbl">
        <thead><tr><th>Reading</th><th>Today</th><th>Their usual · 14 days</th><th>This week</th><th>Next 3 days</th></tr></thead>
        <tbody>${rows.map((a) => `<tr class="${a.concern ? "bad" : a.worsening ? "warn" : ""}">
          <th>${a.label}</th>
          <td><b>${fmt(a.now, a.unit)}</b><small>${usualWord(a)}</small></td>
          <td>${a.base ? `${a.unit === "h" ? C.hm(a.base.mean) : a.base.mean} ± ${a.base.sd} <small>${a.unit === "h" ? "h" : a.unit}</small>` : "—"}</td>
          <td>${a.perWeek == null ? "—" : `<span class="an-arrow">${arrow[a.direction]}</span> ${a.direction === "steady" ? "steady" : `${a.perWeek > 0 ? "+" : ""}${a.perWeek} ${a.unit}`}`}</td>
          <td>${a.forecast.length ? `${a.forecast.slice(0, 3).map((p) => p.v).join(" · ")} <small>${a.unit}</small>` : "—"}</td>
        </tr>`).join("")}</tbody>
      </table></div>
      <p class="fine">Today is compared with their own last two weeks (average ± spread). Red: two spreads or more from their usual, in the direction that matters. Amber: a steady week-long change in that direction.</p>
    </section>

    <div class="an-charts">
      <section class="an-card"><h2>Sleep</h2>${chart(s.log, "sleepHours", s.today, s.sleep.base)}</section>
      <section class="an-card"><h2>Heart rate</h2>${chart(s.log, "heartRate", s.today, s.heart.base)}</section>
    </div>
    <p class="fine an-legend"><span class="an-k usual"></span><span>Their usual</span> <span class="an-k line"></span><span>Measured</span> <span class="an-k fore"></span><span>Forecast if nothing changes, with its range</span></p>

    <section class="an-card" aria-labelledby="an-out">
      <h2 id="an-out">To the end of the mission</h2>
      <div class="an-outs">
        <div class="an-out${debt.hours >= P.RULES.sleepDebtWatch ? " warn" : ""}"><small>Sleep missing, 7 nights</small><b>${debt.hours} h</b><em>Against 7 h a night (NASA cites 7–9 h for an adult).</em></div>
        <div class="an-out${s.adherence != null && s.adherence < P.RULES.adherenceWatch ? " warn" : ""}"><small>Exercise done, 7 days</small><b>${s.adherence == null ? "—" : `${Math.round(s.adherence * 100)} %`}</b><em>${s.comp.doneSessions} of ${s.comp.sessions} prescribed sessions.</em></div>
        <div class="an-out${bone.atEnd < 95 ? " warn" : ""}"><small>Hip and spine bone at mission's end</small><b>${bone.atEnd} %</b><em>Of pre-mission, at ${bone.rate} % a month for ${bone.months} months. App's illustrative model${bone.extrapolated ? ", extrapolated past 6 months" : ""}. NASA requires 95 %.</em></div>
        <div class="an-out"><small>Radiation at mission's end</small><b>${rad ? `${rad.atEnd} mSv` : "—"}</b><em>${rad ? `${rad.pctAtEnd} % of NASA's ${rad.limit} mSv career limit, at ${rad.perDay} mSv a day logged so far.` : "No dosimeter reading logged yet."}</em></div>
      </div>
    </section>

    <section class="an-card" aria-labelledby="an-told">
      <h2 id="an-told">What they told us</h2>
      ${sleepCheckHtml(me, { missionDay: mday, view: "ground" }) || `<p class="fine">No short night this morning, so no question was asked.</p>`}
      <div class="an-links">
        <a href="#meds"><strong>Medication log</strong><small>Doses, how they worked, patterns raised</small></a>
        <a href="#mission"><strong>Exercise</strong><small>Prescription, sessions, loads, reports</small></a>
        <a href="#live"><strong>Live sensors</strong><small>Heart, pressure, CO₂ near them, radiation</small></a>
        <a href="#body"><strong>Body systems</strong><small>NASA's risks for each part of the body</small></a>
      </div>
    </section>

    ${groundCheckinHtml(me)}
    ${fold("About these questionnaires", checkinAboutHtml())}
    ${groundConnectHtml(me)}

    ${groundShareHtml(me)}
    ${exportHtml({ only: me.id })}

    ${fold("How this analysis works", `<p><strong>Their usual:</strong> the average and spread of their own readings over the 14 days before today (at least 5 days). <strong>Away from usual:</strong> two spreads or more from it. <strong>This week:</strong> a straight line fitted through the last 7 days; "steady" when it moves less than one spread a week or fits poorly. <strong>Forecast:</strong> that line carried forward 7 days, with a 95 % band that widens with the scatter and with distance. It says where the readings go if nothing changes; it is not a prediction of illness.</p>
      <p><strong>Bone outlook</strong> (app's illustrative model, not a NASA prediction): with no exercise, NASA's ${quote(FUTURE_FACTS.loss)}; with every prescribed session done, NASA's ${quote(FUTURE_FACTS.withCountermeasures)}; in between, a straight line by the share of sessions done. ${quote(EXERCISE_FACTS.daily)}</p>
      <p class="fine">All thresholds here are app rules for a first look (docs/SOURCES.md). The flight surgeon decides.</p>`)}
  </section>`;
  bindSleepCheck(host.querySelector(".analysis"), () => me, () => null);
  bindGroundShare(host, me, () => { const y = scrollY; mountAnalysis(host); scrollTo(0, y); });
  bindExport(host);
  bindGroundCheckin(host, me, () => { const y = scrollY; mountAnalysis(host); scrollTo(0, y); });
}
