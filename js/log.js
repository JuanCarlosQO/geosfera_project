// Module 3 — Daily check-in. A numbered checklist: each step is checked as you type and a
// tick appears when the value is in. Empty steps are fine. Data stays on this device;
// backups and CSV exports let the crew member keep a copy (option A + B).

import * as L from "./log-core.js";

const STEP = (i) => `3.${String(i + 1).padStart(2, "0")}`;

function readLog() {
  try { return JSON.parse(localStorage.getItem(L.LOG_KEY)) ?? {}; } catch { return {}; }
}
function writeLog(log) {
  try { localStorage.setItem(L.LOG_KEY, JSON.stringify(log)); return true; } catch { return false; }
}

function niceDate(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stepRow(f, i, saved) {
  const id = `f-${f.key}`;
  let control;
  if (f.pair) {
    const [s, d] = saved?.value ?? ["", ""];
    control = `<span class="pair">
      <input id="${id}" data-key="${f.key}" data-part="0" class="num" type="text" inputmode="numeric" autocomplete="off" placeholder="top" value="${s}" aria-label="Systolic, top number">
      <span aria-hidden="true">/</span>
      <input data-key="${f.key}" data-part="1" class="num" type="text" inputmode="numeric" autocomplete="off" placeholder="bottom" value="${d}" aria-label="Diastolic, bottom number">
    </span>`;
  } else if (f.scale) {
    control = `<span class="scale" role="radiogroup" aria-labelledby="${id}-l">${f.scale.map((w, n) => `
      <label class="scale-opt"><input type="radio" name="${f.key}" data-key="${f.key}" value="${n + 1}" ${saved?.value === n + 1 ? "checked" : ""}><span>${n + 1}</span><small>${w}</small></label>`).join("")}
    </span>`;
  } else {
    control = `<input id="${id}" data-key="${f.key}" class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="—" value="${saved?.value ?? ""}">`;
  }
  return `<li class="step" data-step="${f.key}">
    <span class="tick" aria-hidden="true"></span>
    <div class="step-text">
      <label id="${id}-l" for="${id}"><span class="step-no">${STEP(i)}</span>${f.label}</label>
      <small>${f.how ?? "Pick the one that fits best."}</small>
      <p class="step-msg" role="status" aria-live="polite"></p>
    </div>
    <div class="step-input">${control}${f.unit ? `<span class="unit">${f.unit}</span>` : ""}</div>
  </li>`;
}

function rawFromForm(form) {
  const raw = {};
  for (const f of L.FIELDS) {
    if (f.pair) raw[f.key] = [0, 1].map((p) => form.querySelector(`[data-key="${f.key}"][data-part="${p}"]`).value);
    else if (f.scale) raw[f.key] = form.querySelector(`[name="${f.key}"]:checked`)?.value ?? "";
    else raw[f.key] = form.querySelector(`[data-key="${f.key}"]`).value;
  }
  return raw;
}

function history(log, today) {
  const days = Object.keys(log).filter((d) => d !== "importedFrom").sort().reverse().slice(0, 7);
  if (!days.length) return `<p class="fine">No saved days yet.</p>`;
  return `<ul class="history">${days.map((d) => {
    const n = L.countFilled(log[d]);
    const again = L.FIELDS.filter((f) => log[d][f.key]?.flag === "again").length;
    return `<li><span>${d === today ? "Today" : niceDate(d)}</span>
      <span class="h-meter" aria-hidden="true"><span style="width:${(n / L.FIELDS.length) * 100}%"></span></span>
      <span class="mono">${n}/${L.FIELDS.length}${again ? ` · <span class="tone-again">◌ ${again}</span>` : ""}</span>
      <button type="button" class="textlink" data-edit="${d}">Edit</button></li>`;
  }).join("")}</ul>`;
}

export function mountLog(host, { go }, day = L.dateKey()) {
  const today = L.dateKey();
  let log = readLog();
  const saved = log[day] ?? {};

  host.innerHTML = `
  <section class="checkin" aria-labelledby="ci-title">
    <p class="eyebrow">Module 3 · Daily check-in</p>
    <h1 id="ci-title" tabindex="-1">${day === today ? "Today's check-in" : `Correct ${niceDate(day)}`}</h1>
    <p class="lede">Work down the checklist. Leave a step empty if you could not measure it. Each value is checked as you type.</p>

    <div class="ci-progress" aria-hidden="true"><span data-ref="bar"></span></div>
    <p class="mono ci-count" data-ref="count"></p>

    <form data-ref="form" novalidate>
      <ol class="steps">${L.FIELDS.map((f, i) => stepRow(f, i, saved[f.key])).join("")}</ol>
      <div class="ci-actions">
        <button type="submit" class="cta-wide">Save check-in</button>
        ${day !== today ? `<button type="button" class="textlink" data-edit="${today}">Back to today's check-in</button>` : ""}
      </div>
    </form>
    <div data-ref="result" aria-live="polite"></div>

    <p class="fine rule-note">Limits that catch typos and sudden jumps are app rules, not medical ranges. Readings are not judged as normal or not until ranges from an approved official source are added.</p>

    <section class="data-card" aria-labelledby="data-h">
      <h2 id="data-h">Your data</h2>
      <p>Everything stays on this device. Keep a copy, or move it to another device.</p>
      <div class="data-btns">
        <button type="button" class="cta" data-do="csv">Export CSV</button>
        <button type="button" class="cta" data-do="backup">Save backup</button>
        <label class="cta file-btn">Restore backup<input type="file" accept="application/json,.json" data-do="restore"></label>
      </div>
      <p class="fine" data-ref="data-msg" role="status" aria-live="polite"></p>
      <h3>Recent days</h3>
      <div data-ref="history">${history(log, today)}</div>
    </section>
  </section>`;

  const $ = (r) => host.querySelector(`[data-ref="${r}"]`);
  const form = $("form");

  function refresh() {
    const raw = rawFromForm(form);
    let filled = 0;
    for (const f of L.FIELDS) {
      const row = form.querySelector(`[data-step="${f.key}"]`);
      const r = L.checkValue(f, raw[f.key]);
      row.dataset.state = r.state;
      row.querySelector(".step-msg").textContent = r.state === "impossible" ? `◌ Measure again: ${r.why}` : "";
      if (r.state === "ok") filled += 1;
    }
    $("bar").style.width = `${(filled / L.FIELDS.length) * 100}%`;
    $("count").textContent = `${filled} of ${L.FIELDS.length} steps in`;
  }

  form.addEventListener("input", refresh);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const { entry, problems } = L.buildEntry(rawFromForm(form), log, day);
    const bad = Object.keys(problems);
    if (bad.length) {
      refresh();
      form.querySelector(`[data-step="${bad[0]}"] input`)?.focus();
      $("result").innerHTML = `<p class="result warn">◌ ${bad.length} ${bad.length === 1 ? "value needs" : "values need"} measuring again before saving.</p>`;
      return;
    }
    log = L.saveDay(log, day, entry);
    if (!writeLog(log)) { $("result").innerHTML = `<p class="result warn">This browser blocked saving. Your check-in was not stored.</p>`; return; }
    const jumps = L.FIELDS.filter((f) => entry[f.key]?.flag === "again");
    $("result").innerHTML = `<div class="result ok">
      <p><strong>Saved for ${day === today ? "today" : niceDate(day)}.</strong> ${L.countFilled(entry)} of ${L.FIELDS.length} steps.</p>
      ${jumps.length ? `<p class="tone-again">◌ Measure again: ${jumps.map((f) => f.label.toLowerCase()).join(", ")} changed a lot since your last reading. Check the device and measure once more.</p>` : ""}
      <a class="textlink" href="#today">See it in the Cupola</a></div>`;
    $("history").innerHTML = history(log, today);
  });

  host.addEventListener("click", (e) => {
    const t = e.target.closest("[data-edit],[data-do]");
    if (!t) return;
    if (t.dataset.edit) { go(t.dataset.edit === today ? "log" : `log/${t.dataset.edit}`); return; }
    if (t.dataset.do === "csv") download(`geosfera-log-${today}.csv`, L.toCsv(log), "text/csv");
    if (t.dataset.do === "backup") download(`geosfera-backup-${today}.json`, L.toBackup(log), "application/json");
  });

  host.querySelector('[data-do="restore"]').addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = L.fromBackup(await file.text());
    e.target.value = "";
    if (!r.ok) { $("data-msg").textContent = r.why; return; }
    const merged = L.mergeLogs(log, r.log);
    log = merged.log;
    writeLog(log);
    $("history").innerHTML = history(log, today);
    $("data-msg").textContent = `Restored ${merged.added} new ${merged.added === 1 ? "day" : "days"}. Days already on this device were kept.${r.dropped ? ` ${r.dropped} impossible values were left out.` : ""}`;
  });

  refresh();
}
