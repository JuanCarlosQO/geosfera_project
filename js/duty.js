// Module 9 — Fit for duty. Before a critical task the crew member sees, on one screen, what
// they already logged that is worth mentioning to a crewmate: short sleep, low mood, a
// medication NASA cautions about, or a heavy workload right now. Ergosphere never says "fit"
// or "unfit"; people decide. Rules live in duty-core.js; facts are in docs/SOURCES.md.

import * as D from "./duty-core.js";
import { TASKS, WORKLOAD, LEVELS, DUTY_FACTS } from "./data/duty.js";
import { KIT } from "./data/med-kit.js";
import { MEDS_KEY, cleanStore, dayOf, spanWords } from "./meds-core.js";
import { fieldByKey } from "./log-core.js";
import { readLog } from "./store.js";
import { STATUS } from "./data/body-systems.js";

const TONE = {
  ok: { ...STATUS.normal, word: "Nothing to mention" },
  flag: { ...STATUS.watch, word: "Mention it" },
  none: { ...STATUS.none, word: "No data" }
};
const HEAD = {
  ready: { ...STATUS.normal, title: "Nothing to mention from these checks", text: "Every check has data and none stands out. You and your crewmate decide." },
  gaps: { ...STATUS.pending, title: "Nothing flagged, but some checks have no data", text: "Fill the gaps if you can, or tell your crewmate what is missing." },
  talk: { ...STATUS.watch, title: "Talk it over before you start", text: "Tell your crewmate or crew medical officer about the points marked below. They are not a verdict: people decide." }
};

const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const link = (f) => `<a href="${f.url}" target="_blank" rel="noopener">${f.source}</a>`;
const src = (f) => `<small class="src">“${f.quote}” ${link(f)}</small>`;

function row(check, title, body) {
  const t = TONE[check.state];
  return `<li class="duty-row" data-state="${check.state}">
    <div class="duty-head"><span>${title}</span><span class="tone-${t.tone}">${t.shape} ${t.word}</span></div>
    <div class="duty-body">${body}</div>
  </li>`;
}

function sleepRow(c) {
  if (c.state === "none") return row(c, "Sleep last night", c.why === "again" ? `Your sleep entry is marked “Measure again”. <a href="#log">Check it in the log</a>.` : `Not logged today. <a href="#log">Add it in today's check-in</a>.`);
  const body = c.state === "flag"
    ? `${c.value} h, under the 7 to 9 hours NASA's sleep brief cites.${src(DUTY_FACTS.sleep)}${src(DUTY_FACTS.sleepWhy)}`
    : `${c.value} h.${src(DUTY_FACTS.sleep)}`;
  return row(c, "Sleep last night", body);
}

function moodRow(c) {
  if (c.state === "none") return row(c, "Mood today", `Not logged today. <a href="#log">Add it in today's check-in</a>.`);
  const word = fieldByKey("mood").scale[c.value - 1];
  return row(c, "Mood today", c.state === "flag" ? `${word} (${c.value} of 5). App rule: 1 or 2 is worth mentioning.` : `${word} (${c.value} of 5).`);
}

function medsRow(c, now) {
  if (c.state === "ok") return row(c, "Medication record", `No medication with a NASA performance caution in the last ${D.RULES.impairHours} hours of <a href="#meds">your record</a>. Doses you did not record are not counted.`);
  return row(c, "Medication record", `${c.items.map((i) => `<p class="duty-med"><strong>${i.med.name} ${i.med.strength}</strong>, ${spanWords(i.at, now)} ago.<small class="src">NASA kit list: “${i.med.performance.quote}” <a href="${i.med.performance.url}" target="_blank" rel="noopener">source</a></small></p>`).join("")}
    <p class="fine">App rule: a cautioned medication counts for ${D.RULES.impairHours} hours after the dose.</p>`);
}

function workloadRow(c) {
  const body = c.state === "flag"
    ? `High: ${c.high.map((k) => WORKLOAD.find((w) => w.id === k).label.toLowerCase()).join(", ")}.${src(DUTY_FACTS.workloadWhy)}`
    : c.state === "none" ? "Answer the three questions above." : "None of the three is high.";
  return row(c, "Workload right now", body);
}

function historyHtml(list) {
  if (!list.length) return `<p class="fine">No saved checks yet.</p>`;
  return `<ul class="duty-log">${[...list].reverse().slice(0, 5).map((c) => {
    const h = HEAD[c.headline];
    const task = TASKS.find((t) => t.id === c.task)?.label ?? "Task not chosen";
    return `<li><span class="mono">${c.at.slice(0, 16).replace("T", " ")} UTC</span><span>${task}</span><span class="tone-${h.tone}">${h.shape} ${c.flags.length ? `${c.flags.length} to mention` : c.gaps.length ? `${c.gaps.length} without data` : "nothing to mention"}</span></li>`;
  }).join("")}</ul>`;
}

export function mountDuty(host) {
  let saved = D.cleanChecks(read(D.DUTY_KEY));

  host.innerHTML = `
  <section class="duty meds" aria-labelledby="du-title">
    <p class="eyebrow">Module 9 · Fit for duty</p>
    <h1 id="du-title" tabindex="-1">Before a critical task</h1>
    <p class="lede">One minute to see what you already logged that is worth telling a crewmate. Ergosphere does not decide whether you are fit: it lists what to mention.</p>

    <form data-ref="form" novalidate autocomplete="off">
      <fieldset class="sym-group"><legend>The task</legend>
        <div class="chips">${TASKS.map((t) => `<label class="chip"><input type="radio" name="task" value="${t.id}"><span>${t.label}</span></label>`).join("")}</div>
      </fieldset>
      <fieldset class="sym-group"><legend>Right now</legend>
        <p class="duty-intro">NASA describes workload as the${src(DUTY_FACTS.workload)}</p>
        ${WORKLOAD.map((w) => `<div class="wl"><p id="wl-${w.id}">${w.ask}</p>
          <div class="wl-scale" role="radiogroup" aria-labelledby="wl-${w.id}">${LEVELS.map((l, i) => `<label class="wl-opt"><input type="radio" name="wl-${w.id}" value="${i + 1}"><span>${i + 1}</span><small>${l}</small></label>`).join("")}</div></div>`).join("")}
      </fieldset>
    </form>

    <div data-ref="head" aria-live="polite"></div>
    <ul class="duty-list" data-ref="list"></ul>

    <div class="duty-actions">
      <button type="button" class="cta main" data-duty-act="save">Save this check</button>
      <p class="step-msg" data-ref="msg" role="status" aria-live="polite"></p>
    </div>

    <section class="data-card" aria-labelledby="du-h">
      <h2 id="du-h">Recent checks</h2>
      <p>Kept on this device, so you can show them to your crew medical officer.</p>
      <div data-ref="history"></div>
    </section>

    <p class="fine rule-note">NASA requires that crew time for critical tasks, work, exercise and sleep${src(DUTY_FACTS.limits)} and that crew ${src(DUTY_FACTS.monitored)} The 7-hour sleep line and the medication cautions are NASA's words; the 1 to 5 scales, the mood and workload cut-offs and the ${D.RULES.impairHours}-hour medication window are app rules. This is not a medical or operational clearance.</p>
  </section>`;

  const root = host.querySelector(".duty");
  const $ = (r) => root.querySelector(`[data-ref="${r}"]`);
  const form = $("form");
  const answers = () => Object.fromEntries(WORKLOAD.map((w) => [w.id, Number(form.querySelector(`input[name="wl-${w.id}"]:checked`)?.value) || null]));
  const task = () => form.querySelector('input[name="task"]:checked')?.value ?? null;
  let result;

  function paint() {
    const now = new Date();
    const doses = cleanStore(read(MEDS_KEY), KIT).doses;
    result = D.assess({ log: readLog(), day: dayOf(now), doses, kit: KIT, workload: answers(), now });
    const by = Object.fromEntries(result.checks.map((c) => [c.id, c]));
    const h = HEAD[result.headline];
    $("head").innerHTML = `<div class="duty-verdict" data-headline="${result.headline}"><p class="tone-${h.tone}"><strong>${h.shape} ${h.title}</strong></p><p>${h.text}</p></div>`;
    $("list").innerHTML = sleepRow(by.sleep) + medsRow(by.meds, now) + moodRow(by.mood) + workloadRow(by.workload);
    $("history").innerHTML = historyHtml(saved);
  }

  form.addEventListener("change", () => { $("msg").textContent = ""; paint(); });
  root.addEventListener("click", (e) => {
    if (!e.target.closest('[data-duty-act="save"]')) return;
    saved = D.saveCheck(saved, { task: task(), result });
    try { localStorage.setItem(D.DUTY_KEY, JSON.stringify(saved)); $("msg").textContent = "Check saved."; } catch { $("msg").textContent = "This browser blocked saving."; }
    $("history").innerHTML = historyHtml(saved);
  });

  paint();
}
