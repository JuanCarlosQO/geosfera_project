// Module 8 — Onboard medications. Pick what you notice; Geosfera lists the common in-flight
// complaints that fit, what to try first, what the kit holds and what each label says.
// Then it keeps the record NASA's Dose Tracker kept: what was taken and whether it worked.
// It never diagnoses. Rules live in meds-core.js; every fact shown is in docs/SOURCES.md.

import * as M from "./meds-core.js";
import { SYMPTOMS, RED_FLAGS, CONDITIONS, KIT, SIDE_EFFECTS, KIT_FACTS } from "./data/med-kit.js";
import { STATUS } from "./data/body-systems.js";

const STATE = {
  ok: { ...STATUS.normal, word: "Available" },
  wait: { ...STATUS.watch, word: "Wait" },
  max: { ...STATUS.watch, word: "Daily limit reached" },
  expired: { ...STATUS.watch, word: "Past its date" },
  check: { ...STATUS.watch, word: "Ask first" },
  out: { ...STATUS.none, word: "None left" }
};
const WORKED = {
  yes: { ...STATUS.normal, word: "It worked" },
  partly: { ...STATUS.watch, word: "Partly" },
  no: { ...STATUS.act, word: "Did not work" }
};

const med = (id) => KIT.find((k) => k.id === id);
const cond = (id) => CONDITIONS.find((c) => c.id === id);
const sym = (id) => SYMPTOMS.find((s) => s.id === id);
const units = (m, n) => `${n} ${m.unit}${n === 1 ? "" : "s"}`;
const link = (url, text) => `<a href="${url}" target="_blank" rel="noopener">${text}</a>`;
const quote = (f) => (f?.quote ? `<small class="src">“${f.quote}” ${link(f.url, f.source ?? "Source")}</small>` : "");

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(M.MEDS_KEY)); } catch { /* start with an empty record */ }
  return M.seedKit(M.cleanStore(raw, KIT), KIT);
}
function save(store) {
  try { localStorage.setItem(M.MEDS_KEY, JSON.stringify(store)); return true; } catch { return false; }
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function chips(list, name, type = "checkbox") {
  return list.map((x) => `<label class="chip"><input type="${type}" name="${name}" value="${x.id}"><span>${x.label}</span></label>`).join("");
}

function symptomForm() {
  const areas = [...new Set(SYMPTOMS.map((s) => s.area))];
  return `${areas.map((a) => `
    <fieldset class="sym-group"><legend>${a}</legend>
      <div class="chips">${chips(SYMPTOMS.filter((s) => s.area === a), "sym")}</div>
    </fieldset>`).join("")}
    <fieldset class="sym-group flags"><legend>Any of these?</legend>
      <div class="chips">${chips(RED_FLAGS, "sym")}</div>
    </fieldset>`;
}

function followUpHtml(store, now) {
  const { due, later } = M.followUps(store.doses, KIT, now);
  const cards = due.map(({ dose }) => {
    const m = med(dose.medId);
    return `<form class="followup" data-dose="${dose.id}">
      <p class="fu-q"><strong>Did it work?</strong> ${m.name} ${m.strength} · ${units(m, dose.units)} · ${M.spanWords(dose.at, now)} ago${dose.reason && cond(dose.reason) ? ` · for ${cond(dose.reason).name.toLowerCase()}` : ""}</p>
      <div class="chips" role="radiogroup" aria-label="How it went">${chips(M.OUTCOMES, "worked", "radio")}</div>
      <p class="fu-sub">Anything else you noticed?</p>
      <div class="chips">${chips(SIDE_EFFECTS, "effect")}</div>
      <button type="submit" class="cta main">Save answer</button>
      <p class="step-msg" role="status" aria-live="polite"></p>
    </form>`;
  }).join("");
  const waiting = later.map(({ dose, askAt }) => `<p class="fine">Geosfera will ask whether ${med(dose.medId).name.toLowerCase()} worked in ${M.spanWords(now, askAt)}.</p>`).join("");
  return cards + waiting;
}

function optionWhy(o, now) {
  const m = o.med;
  if (o.state === "out") return "The kit has none left.";
  if (o.state === "wait") return `Next dose in ${M.spanWords(now, o.dose.until)} (label interval).`;
  if (o.state === "max") return `Label limit for 24 hours reached. Free again in ${M.spanWords(now, o.dose.until)}.`;
  if (o.state === "expired") return `Past its labelled date (${o.item.expires}). Ask the flight surgeon before using it.${quote(KIT_FACTS.expired)}`;
  if (o.state === "check") return o.clash.map((c) => `You took ${med(c.medId).name.toLowerCase()} in the last 24 hours. NASA's kit list says: “${c.quote}”`).join(" ");
  const left = o.dose.room == null ? "" : `${units(m, o.dose.room)} left today by the label.`;
  return o.stock === "soon" ? `${left} Use first: ${M.daysBetween(M.dayOf(now), o.item.expires)} days to its date.` : left;
}

function optionRow(o, c, now) {
  const m = o.med;
  const st = STATE[o.state];
  const r = o.response;
  const top = Math.max(1, m.dose?.unitsPerDose?.[1] ?? 1);
  return `<li class="opt" data-state="${o.state}">
    <div class="opt-head">
      <span class="opt-name">${m.name} <span class="mono">${m.strength}</span></span>
      <span class="opt-state tone-${st.tone}">${st.shape} ${st.word}</span>
    </div>
    <p class="opt-why">${optionWhy(o, now)}</p>
    ${m.rx ? `<p class="opt-rx mono">Rx · prescription strength: use it as your flight surgeon directed</p>` : ""}
    ${m.noLabel ? `<p class="opt-rx mono">No official label dose: use it as your flight surgeon directed</p>` : ""}
    ${m.note ? `<p class="opt-note">${m.note}</p>` : ""}
    ${r.rated ? `<p class="opt-you mono">For you: worked ${r.yes} of ${r.rated} ${r.rated === 1 ? "time" : "times"}${r.partly ? `, partly ${r.partly}` : ""}</p>` : ""}
    ${m.reviewedBy ? `<p class="opt-review mono tone-normal">${STATUS.normal.shape} Label data checked by ${m.reviewedBy}</p>` : `<p class="opt-review mono tone-none">${STATUS.pending.shape} ${STATUS.pending.word}: label data awaiting the team pharmacist</p>`}
    <details>
      <summary>What the label says</summary>
      <dl class="label">
        <dt>For</dt><dd>${m.use.quote}</dd>
        <dt>Directions</dt><dd>${m.directions.quote}</dd>
        ${m.warnings.map((w) => `<dt>${w.head}</dt><dd>${w.quote}</dd>`).join("")}
      </dl>
      <p class="fine">${link(m.directions.url, `Source: ${m.labelName}`)}${m.inFlight ? ` · In flight: “${m.inFlight.quote}” ${link(m.inFlight.url, m.inFlight.source)}` : ""}</p>
    </details>
    ${o.state === "out" ? "" : `<div class="opt-take">
      <label>How many <select data-units aria-label="How many ${m.unit}s">${Array.from({ length: top }, (_, i) => `<option value="${i + 1}">${units(m, i + 1)}</option>`).join("")}</select></label>
      <button type="button" class="cta" data-med-act="take" data-med="${m.id}" data-cond="${c.id}">Record a dose</button>
    </div>`}
  </li>`;
}

function conditionCard(match, store, now) {
  const c = cond(match.id);
  const opts = M.options(c, KIT, store, now);
  return `<article class="cond">
    <p class="cond-kicker mono">Could be · ${match.hits.length} of ${c.signs.length} typical signs: ${match.hits.map((h) => sym(h).label).join(" · ")}</p>
    <h2>${c.name}</h2>
    <p class="cond-about">${quote(c.about)}</p>
    ${M.needsOfficer(store.doses, c.id) ? `<p class="result act">${STATUS.act.shape} ${STATUS.act.word}: your last ${M.RULES.noReliefRepeats} doses for this did not work. Tell your crew medical officer.</p>` : ""}
    <h3>First</h3>
    <ol class="first">${c.first.map((s) => `<li>${s.text}${quote(s)}</li>`).join("")}</ol>
    <h3>From the kit</h3>
    ${opts.length ? `<ul class="opts">${opts.map((o) => optionRow(o, c, now)).join("")}</ul>` : `<p class="fine">No kit medication is listed for this in Geosfera's sources.</p>`}
    <p class="cond-officer">${c.officer.text}${quote(c.officer)}</p>
  </article>`;
}

function answerHtml(picked, store, now) {
  if (!picked.length) return "";
  const flags = M.redFlags(RED_FLAGS, picked);
  if (flags.length) {
    return `<div class="result act"><p><strong>${STATUS.act.shape} ${STATUS.act.word}.</strong> ${flags.map((f) => f.label).join(", ")}: talk to your crew medical officer or the flight surgeon now. Geosfera does not handle this.</p></div>`;
  }
  const matches = M.matchConditions(CONDITIONS, picked).slice(0, 3);
  if (!matches.length) return `<div class="result warn"><p>These symptoms do not fit the common in-flight complaints Geosfera knows. Tell your crew medical officer.</p></div>`;
  return matches.map((m) => conditionCard(m, store, now)).join("");
}

function recordHtml(store) {
  const doses = [...store.doses].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);
  if (!doses.length) return `<p class="fine">No doses recorded yet.</p>`;
  return `<ul class="doses">${doses.map((d) => {
    const m = med(d.medId);
    const w = d.outcome ? WORKED[d.outcome.worked] : null;
    return `<li><span class="mono">${d.at.slice(0, 16).replace("T", " ")} UTC</span>
      <span>${m.name} · ${units(m, d.units)}</span>
      <span class="${w ? `tone-${w.tone}` : "tone-none"}">${w ? `${w.shape} ${w.word}` : `${STATUS.pending.shape} Not rated yet`}</span></li>`;
  }).join("")}</ul>`;
}

function kitHtml(store, today) {
  return `<ul class="kit">${KIT.map((m) => {
    const item = store.kit[m.id];
    const s = M.stockState(item, today);
    const note = s === "out" ? `<span class="tone-none">${STATUS.none.shape} None left</span>`
      : s === "expired" ? `<span class="tone-watch">${STATUS.watch.shape} Past its date since ${item.expires}</span>`
      : s === "soon" ? `<span class="tone-watch">${STATUS.watch.shape} Use first: ${M.daysBetween(today, item.expires)} days left</span>`
      : `<span class="tone-normal">${STATUS.normal.shape} In date until ${item.expires}</span>`;
    return `<li><span>${m.name} <span class="mono">${m.strength}</span></span><span class="mono">${item?.stock ?? 0} left</span>${note}</li>`;
  }).join("")}</ul>`;
}

export function mountMeds(host) {
  let store = load();
  save(store);

  host.innerHTML = `
  <section class="meds" aria-labelledby="md-title">
    <p class="eyebrow">Module 8 · Onboard medications</p>
    <h1 id="md-title" tabindex="-1">How do you feel?</h1>
    <p class="lede">Pick what you notice. Geosfera lists the common in-flight complaints that fit, what to try first and what the kit holds, in the label's own words. It does not diagnose.</p>

    <a class="duty-link" href="#duty"><span>Fit for duty check<small>Before a spacewalk, docking or another critical task</small></span><span>Open →</span></a>

    <div data-ref="due" aria-live="polite"></div>

    <form data-ref="symptoms" novalidate autocomplete="off">${symptomForm()}</form>
    <div data-ref="answer" aria-live="polite"></div>
    <p class="step-msg" data-ref="msg" role="status" aria-live="polite"></p>

    <section class="data-card" aria-labelledby="rec-h">
      <h2 id="rec-h">Your record</h2>
      <p>What you took and whether it worked. It stays on this device. ${KIT_FACTS.record.text}${quote(KIT_FACTS.record)}</p>
      <div data-ref="record"></div>
      <div class="data-btns"><button type="button" class="cta" data-med-act="csv">Export CSV</button></div>
    </section>

    <section class="data-card" aria-labelledby="kit-h">
      <h2 id="kit-h">Onboard kit</h2>
      <p>Demo kit: quantities and dates are <strong>simulated</strong>. ${KIT_FACTS.carried.text}${quote(KIT_FACTS.carried)}</p>
      <div data-ref="kit"></div>
      <p class="fine">${KIT_FACTS.shelfLife.text}${quote(KIT_FACTS.shelfLife)}</p>
      <button type="button" class="textlink" data-med-act="reset">Reset the demo kit and record</button>
    </section>

    <p class="fine rule-note">Geosfera does not diagnose or prescribe. Doses, intervals and limits are quoted from the official labels; waiting times before "Did it work?", the 30-day "Use first" notice and the two-doses rule are app rules, and so is the "Any of these?" list. NASA's technical briefs describe practice; they are not medical advice for one person. Sources: docs/SOURCES.md.</p>
  </section>`;

  const root = host.querySelector(".meds");
  const $ = (r) => root.querySelector(`[data-ref="${r}"]`);
  const picked = () => [...$("symptoms").querySelectorAll('input[name="sym"]:checked')].map((i) => i.value);

  function paint(keepMsg = false) {
    const now = new Date();
    $("due").innerHTML = followUpHtml(store, now);
    $("answer").innerHTML = answerHtml(picked(), store, now);
    $("record").innerHTML = recordHtml(store);
    $("kit").innerHTML = kitHtml(store, M.dayOf(now));
    if (!keepMsg) $("msg").textContent = "";
  }

  $("symptoms").addEventListener("change", () => paint());

  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-med-act]");
    if (!t) return;
    if (t.dataset.medAct === "csv") { download(`geosfera-medications-${M.dayOf()}.csv`, M.toCsv(store.doses, KIT), "text/csv"); return; }
    if (t.dataset.medAct === "reset") {
      store = M.seedKit(M.emptyStore(), KIT);
      save(store);
      paint();
      $("msg").textContent = "Demo kit and record reset.";
      return;
    }
    if (t.dataset.medAct === "take") {
      const m = med(t.dataset.med);
      const n = Number(t.closest(".opt-take").querySelector("[data-units]").value);
      const r = M.logDose(store, KIT, { medId: m.id, units: n, reason: t.dataset.cond });
      if (!r.ok) { $("msg").textContent = r.why; return; }
      store = r.store;
      if (!save(store)) { $("msg").textContent = "This browser blocked saving. The dose was not stored."; return; }
      paint(true);
      $("msg").textContent = `Recorded: ${m.name}, ${units(m, n)}. Geosfera will ask whether it worked in ${M.spanWords(new Date(), new Date(Date.now() + m.askAfterHours * 3600000))}.`;
    }
  });

  root.addEventListener("submit", (e) => {
    const form = e.target.closest(".followup");
    if (!form) return;
    e.preventDefault();
    const worked = form.querySelector('input[name="worked"]:checked')?.value;
    const effects = [...form.querySelectorAll('input[name="effect"]:checked')].map((i) => i.value);
    const r = M.setOutcome(store, form.dataset.dose, { worked, effects });
    if (!r.ok) { form.querySelector(".step-msg").textContent = r.why; return; }
    store = r.store;
    save(store);
    paint();
    $("msg").textContent = "Answer saved to your record.";
  });

  paint();
}
