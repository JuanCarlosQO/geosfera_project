// Crew: register members, and the crew status row on the dashboard — one silhouette per
// astronaut, tinted by their most urgent status, with key readings and a 14-day trend.

import * as S from "./store.js";
import { ROLES, initials } from "./crew-core.js";
import { silhouetteSvg } from "./anatomy.js";
import { summarise, series, sparkPath } from "./today-core.js";
import { judgeReading, dateKey } from "./log-core.js";
import { STATUS } from "./data/body-systems.js";

const ORDER = ["act", "again", "watch", "normal", "pending", "logged", "none"];

function worst(summary) {
  const all = Object.values(summary.status);
  return ORDER.find((s) => all.includes(s)) ?? "none";
}

const val = (e, k) => {
  const v = e?.[k]?.value;
  return v == null ? "—" : Array.isArray(v) ? `${v[0]}/${v[1]}` : String(v);
};

export function crewStatusHtml(crew) {
  const today = dateKey();
  const cards = crew.members.map((m, i) => {
    const log = S.readLog(m.id);
    const e = log[today] ?? {};
    const sum = summarise(e, judgeReading);
    const w = worst(sum);
    const st = STATUS[w === "logged" ? "normal" : w];
    const d = sparkPath(series(log, "heartRate", today, 14), 100, 26);
    return `<li>
      <button type="button" class="crew-card ${m.id === crew.active ? "on" : ""}" data-tone="${st.tone}" data-member="${m.id}" aria-pressed="${m.id === crew.active}" style="--i:${i}">
        <span class="cc-fig">${silhouetteSvg()}<span class="cc-init">${initials(m.name)}</span></span>
        <span class="cc-body">
          <span class="cc-name">${m.name}</span>
          <span class="cc-role">${m.role}</span>
          <span class="chip tone-${st.tone}"><span aria-hidden="true">${st.shape}</span> ${sum.measured ? st.word : "No check-in today"}</span>
          <span class="cc-vals"><span>HR <b>${val(e, "heartRate")}</b></span><span>BP <b>${val(e, "bloodPressure")}</b></span><span>SpO₂ <b>${val(e, "bloodOxygen")}</b></span></span>
          <svg class="cc-spark" viewBox="0 0 100 26" aria-hidden="true">${d ? `<path d="${d}" pathLength="1"/>` : `<line x1="0" y1="13" x2="100" y2="13"/>`}</svg>
        </span>
      </button></li>`;
  }).join("");
  return `<section class="crew-status" aria-labelledby="crew-h">
    <div class="rd-head"><h2 id="crew-h">Crew status</h2><span class="mono">${crew.members.length} aboard · tap to open</span></div>
    <ul class="crew-row">${cards}
      <li><button type="button" class="crew-card add" data-action="manage-crew"><span class="cc-plus" aria-hidden="true">+</span><span class="cc-body"><span class="cc-name">Manage crew</span><span class="cc-role">Add or remove members</span></span></button></li>
    </ul>
  </section>`;
}

export function crewFormHtml(first = false) {
  return `<form class="crew-form" data-ref="crew-form" novalidate>
    ${first ? `<p class="eyebrow">Crew registration</p><h1 id="today-title" tabindex="-1">Who is on board?</h1>
      <p class="lede">Register each crew member. Everyone gets their own daily log on this station device, and the dashboard shows the whole crew at a glance.</p>` : `<h2>Add a crew member</h2>`}
    <div class="cf-row">
      <label class="cf-field"><span>Name</span><input name="name" type="text" autocomplete="off" maxlength="40" placeholder="e.g. Ana Ruiz" required></label>
      <label class="cf-field"><span>Role</span><select name="role">${ROLES.map((r) => `<option>${r}</option>`).join("")}</select></label>
      <button type="submit" class="cta-wide cf-add">Add to crew</button>
    </div>
    <p class="cf-msg" role="status" aria-live="polite"></p>
  </form>`;
}

export function manageHtml(crew) {
  return `<div class="veil crew-veil" data-ref="crew-veil">
    <div class="sheet crew-sheet" role="dialog" aria-modal="true" aria-labelledby="mc-h">
      <div class="mc-head"><h2 id="mc-h">Crew roster</h2><button type="button" class="round-btn" data-action="close-crew" aria-label="Close">✕</button></div>
      <ul class="roster">${crew.members.map((m) => `<li><span class="r-init">${initials(m.name)}</span><span><b>${m.name}</b><small>${m.role}</small></span>
        <button type="button" class="textlink danger" data-remove="${m.id}">Remove</button></li>`).join("")}</ul>
      ${crewFormHtml(false)}
      <p class="fine">Removing a member erases their log on this device. Save a backup from the Log first. To try the demo crew, remove everyone: the empty station offers it.</p>
    </div></div>`;
}

/** Wires the add form inside root; calls done() after a member is added. */
export function bindCrewForm(root, done) {
  const form = root.querySelector('[data-ref="crew-form"]');
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const r = S.createMember({ name: form.name.value, role: form.role.value });
    if (!r.ok) { form.querySelector(".cf-msg").textContent = r.why; form.name.focus(); return; }
    done(r.member);
  });
}
