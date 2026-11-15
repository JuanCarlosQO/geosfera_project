// The ground medical team's crew list (#ground): one card per crew member with what needs a
// look this morning (a short night, how they said they feel, a request to talk, an emergency
// opening of their own data). Tapping a card opens that crew member's record (Today, Log, Live…).
// Nothing here is a diagnosis: it lists what was measured and what the crew member said.

import { getCrew, setActive, readLog } from "./store.js";
import { dateKey } from "./log-core.js";
import * as C from "./sleepcheck-core.js";
import { SOURCES } from "./devices-core.js";
import { getAlerts } from "./support.js";
import { getOpenings } from "./role.js";
import { openingsFor, reasonLabel, openNow } from "./role-core.js";
import { avatarHtml } from "./avatar.js";
import { DEVICE_FACTS } from "./data/devices.js";
import { fold } from "./fold.js";
import { demoNoticeHtml, demoLoaded } from "./demo.js";
import { exerciseFlags } from "./exercise.js";
import { symptomLabel, TELL_NOW } from "./exercise-core.js";

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SIM = ["simulated", "sensors"];
const hhmm = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const quote = (f) => `“${f.quote}” <a href="${f.url}" target="_blank" rel="noopener">${f.source}</a>`;

function card(m, today, alerts, openings) {
  const log = readLog(m.id);
  const c = C.sleepCheck(log, today);
  const feel = log[today]?.feel?.value;
  const note = log[today]?.note;
  const flags = [];
  if (c.ask) flags.push(`<li class="gf-watch">Sleep shorter than usual: <strong>${C.hm(c.last)}</strong>${c.usual != null ? ` (average ${C.hm(c.usual)})` : ""}</li>`);
  if (feel) {
    const reasons = (note?.reasons ?? []).map((id) => C.REASONS.find((r) => r.id === id)?.label).filter(Boolean);
    flags.push(`<li${feel === "very" ? ' class="gf-watch"' : ""}>Says this morning: <strong>${C.FEELS.find((f) => f.id === feel)?.label}</strong>${reasons.map((r) => ` · <span>${r}</span>`).join("")}${note?.text ? ` · <span data-no-i18n>“${esc(note.text)}”</span>` : ""}</li>`);
  } else if (c.ask) flags.push(`<li>Asked how they feel: <strong>no answer yet</strong></li>`);
  const mine = alerts.filter((a) => a.from?.id === m.id && !a.closed);
  for (const a of mine.slice(0, 2)) flags.push(`<li class="${a.level === "emergency" ? "gf-act" : "gf-watch"}">${a.level === "emergency" ? "SOS" : "Asked to talk to someone"} · ${hhmm(a.at)}</li>`);
  const op = openingsFor(openings, m.id)[0];
  if (op) {
    const live = openNow(op);
    flags.push(`<li class="${live ? "gf-act" : ""}">${live ? "Has their own data open now" : "Opened their own data"} · ${hhmm(op.at)}${op.closedAt ? `–${hhmm(op.closedAt)}` : ""} · ${reasonLabel(op.reason)}</li>`);
  }
  const ex = exerciseFlags(m.id, today);
  flags.push(`<li class="${ex.reported.some((s) => TELL_NOW.includes(s)) ? "gf-act" : ex.reported.length ? "gf-watch" : ""}"><span>Exercise today:</span> <strong>${ex.done} of ${ex.total} sessions</strong>${ex.reported.length ? ` <span class="gf-sep">·</span> <span>After a session:</span> ${ex.reported.map((s) => `<span class="gf-tag">${symptomLabel(s)}</span>`).join(" ")}` : ""}${ex.faults ? ` <span class="gf-sep">·</span> <span>${ex.faults} ${ex.faults === 1 ? "machine problem reported" : "machine problems reported"}</span>` : ""}</li>`);
  const night = log[today]?.sleepHours;
  return `<li><button type="button" class="gf-card" data-open="${esc(m.id)}">
    <span class="gf-pic">${avatarHtml(m, "gf-av")}</span>
    <span class="gf-txt">
      <strong data-no-i18n>${esc(m.name)}</strong><small>${esc(m.role)}${m.age ? ` · ${m.age}` : ""}${m.home ? ` · ${esc(m.home)}` : ""}</small>
      <span class="gf-night">Last night ${night?.value != null ? `<b>${C.hm(night.value)}</b> <span>asleep</span> · <span>${esc(SOURCES[night.src] ?? "typed")}</span>${SIM.includes(night.src) ? ' <span class="sim">SIMULATED</span>' : ""}` : "<b>—</b> no watch data yet"}</span>
      ${flags.length ? `<ul class="gf-flags">${flags.join("")}</ul>` : `<span class="gf-ok">Nothing to look at this morning</span>`}
    </span>
    <span class="gf-go" aria-hidden="true">›</span>
  </button></li>`;
}

export function mountGround(host) {
  const members = getCrew().members;
  const today = dateKey();
  const alerts = getAlerts();
  const openings = getOpenings();
  host.innerHTML = `<section class="ground">
    <header>
      <p class="eyebrow">Ground medical team · flight surgeon console</p>
      <h1 tabindex="-1">Crew this morning</h1>
      <p class="lead">Every crew member's readings come here. On board, their own screens show no readings: they report how they feel and what the watch cannot know, and can open their data only in an emergency, which is listed here.</p>
    </header>
    ${demoLoaded() ? demoNoticeHtml() : ""}
    <ul class="gf-list">${members.map((m) => card(m, today, alerts, openings)).join("")}</ul>
    ${fold("Where the watch's data comes from", `<p>${quote(DEVICE_FACTS.groundDownload)}</p>
      <p>${quote(DEVICE_FACTS.nonDominant)}</p>
      <p>${quote(DEVICE_FACTS.restricted)} That is why the demo crew's nights are simulated.</p>
      <p class="fine">On the ISS today the watch is read every 32 days. Ergosphere proposes a daily download so the morning question can be asked the same day: that is our proposal, not NASA's schedule. The 60-minute emergency opening is an app rule.</p>`)}
  </section>`;
  host.onclick = (e) => {
    const b = e.target.closest("[data-open]");
    if (!b) return;
    setActive(b.dataset.open);
    location.hash = "#today";
  };
}
