// Module 3 — Daily check-in, styled as a flight procedure: three sequences of instrument
// modules. Each module has a glowing digital readout, − / + nudges, the last reading with the
// change since then, and a live check. Rules live in log-core.js (tested).

import * as L from "./log-core.js";
import * as S from "./store.js";
import { SOURCES } from "./devices-core.js";

const GROUPS = [
  { id: "vitals", code: "SEQ 01", name: "Vitals", keys: ["heartRate", "bloodPressure", "temperature", "bloodOxygen", "glucose"] },
  { id: "recovery", code: "SEQ 02", name: "Recovery", keys: ["sleepHours", "mood"] },
  { id: "counter", code: "SEQ 03", name: "Countermeasures", keys: ["exerciseMinutes", "radiationDose"] }
];

const ICONS = {
  heartRate: '<path d="M3 12h4l2-4 3 8 2-4h7"/>',
  bloodPressure: '<circle cx="12" cy="13" r="7"/><path d="M12 13l3-3M12 6V4"/>',
  temperature: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0Z"/><path d="M12 9v6"/>',
  bloodOxygen: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/><path d="M9.5 15h1.5l1-2 1 3 1-1h1"/>',
  glucose: '<path d="M7 4h10l-2 6v9l-3 1-3-1v-9Z"/><path d="M9 13h6"/>',
  sleepHours: '<path d="M16 4a8 8 0 1 0 4 12A6.5 6.5 0 0 1 16 4Z"/>',
  mood: '<circle cx="12" cy="12" r="8"/><path d="M9 14c1.5 1.5 4.5 1.5 6 0M9.5 10h.01M14.5 10h.01"/>',
  exerciseMinutes: '<path d="M6 9v6M18 9v6M3 11v2M21 11v2M6 12h12"/>',
  radiationDose: '<circle cx="12" cy="12" r="1.8"/><path d="M12 10 9 4.8A8 8 0 0 0 4.2 13H10M14 12h5.8A8 8 0 0 0 15 4.8L12 10M13 13.7 16 19a8 8 0 0 1-8 0l3-5.3"/>'
};
const icon = (k) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

const readLog = () => S.readLog();
const writeLog = (log) => S.writeLog(log);
const nice = (day) => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); };
const fmt = (v) => (Array.isArray(v) ? `${v[0]}/${v[1]}` : String(v));

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function nudge(key, part, dir, label) {
  return `<button type="button" class="nudge" data-nudge="${dir}" data-key="${key}" ${part != null ? `data-part="${part}"` : ""} aria-label="${dir > 0 ? "Increase" : "Decrease"} ${label}">${dir > 0 ? "+" : "−"}</button>`;
}

function module(f, n, saved, prev) {
  const id = `f-${f.key}`;
  let control;
  if (f.pair) {
    const [s, d] = saved?.value ?? ["", ""];
    control = `<div class="readout pair">
      <div class="dial">${nudge(f.key, 0, -1, "systolic")}<input id="${id}" class="num" data-key="${f.key}" data-part="0" type="text" inputmode="numeric" autocomplete="off" placeholder="SYS" value="${s}" aria-label="Systolic, top number">${nudge(f.key, 0, 1, "systolic")}</div>
      <span class="slash" aria-hidden="true">/</span>
      <div class="dial">${nudge(f.key, 1, -1, "diastolic")}<input class="num" data-key="${f.key}" data-part="1" type="text" inputmode="numeric" autocomplete="off" placeholder="DIA" value="${d}" aria-label="Diastolic, bottom number">${nudge(f.key, 1, 1, "diastolic")}</div>
      <span class="unit">${f.unit}</span></div>`;
  } else if (f.scale) {
    control = `<div class="orbit-scale" role="radiogroup" aria-labelledby="${id}-l">${f.scale.map((w, i) => `
      <label class="orb-opt" style="--s:${i}"><input type="radio" name="${f.key}" data-key="${f.key}" value="${i + 1}" ${saved?.value === i + 1 ? "checked" : ""}>
        <span class="orb" aria-hidden="true"></span><b>${i + 1}</b><small>${w}</small></label>`).join("")}</div>`;
  } else {
    control = `<div class="readout"><div class="dial">${nudge(f.key, null, -1, f.label)}<input id="${id}" class="num" data-key="${f.key}" type="text" inputmode="decimal" autocomplete="off" placeholder="— —" value="${saved?.value ?? ""}">${nudge(f.key, null, 1, f.label)}</div><span class="unit">${f.unit}</span></div>`;
  }
  return `<li class="mod" data-step="${f.key}" data-state="empty" style="--n:${n}">
    <div class="mod-head">
      <span class="hex" aria-hidden="true"><span>${String(n + 1).padStart(2, "0")}</span></span>
      <span class="mod-icon">${icon(f.key)}</span>
      <div class="mod-title"><label id="${id}-l" for="${id}">${f.label}</label><small>${f.how ?? "Pick the one that fits best."}</small></div>
      <span class="lock" aria-hidden="true"></span>
    </div>
    ${control}
    <div class="mod-foot">
      <span class="last">${saved?.value != null && !saved?.src ? `<span class="src-chip typed" title="Measured with another instrument and typed">✎ Typed by you</span> ` : ""}${saved?.src ? `<span class="src-chip" title="Change it if it looks wrong: your value replaces the device's">⌁ ${SOURCES[saved.src] ?? "Device"}${saved.at ? ` · ${new Date(saved.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</span> ` : ""}${prev != null ? `Last <b>${fmt(prev)}</b>${f.unit ? ` ${f.unit}` : ""}` : "No earlier reading"}</span>
      <span class="delta" data-delta></span>
    </div>
    <p class="mod-msg" role="status" aria-live="polite"></p>
  </li>`;
}

function rawFromForm(form) {
  const raw = {};
  for (const f of L.FIELDS) {
    if (f.pair) raw[f.key] = [0, 1].map((p) => form.querySelector(`input[data-key="${f.key}"][data-part="${p}"]`).value);
    else if (f.scale) raw[f.key] = form.querySelector(`[name="${f.key}"]:checked`)?.value ?? "";
    else raw[f.key] = form.querySelector(`input[data-key="${f.key}"]`).value;
  }
  return raw;
}

function history(log, today) {
  const days = Object.keys(log).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse().slice(0, 7);
  if (!days.length) return `<p class="fine">No saved days yet.</p>`;
  return `<ul class="history">${days.map((d) => {
    const n = L.countFilled(log[d]);
    const again = L.FIELDS.filter((f) => log[d][f.key]?.flag === "again").length;
    return `<li><span>${d === today ? "Today" : nice(d)}</span>
      <span class="h-meter" aria-hidden="true">${L.FIELDS.map((f) => `<i class="${log[d][f.key]?.value != null ? (log[d][f.key].flag === "again" ? "again" : "in") : ""}"></i>`).join("")}</span>
      <span class="mono">${n}/${L.FIELDS.length}${again ? ` <span class="tone-again">◌${again}</span>` : ""}</span>
      <button type="button" class="textlink" data-edit="${d}">Edit</button></li>`;
  }).join("")}</ul>`;
}

export function mountLog(host, { go }, day = L.dateKey()) {
  const crew = S.getCrew();
  if (!crew.members.length) { go("today"); return; }
  const member = S.current();
  const today = L.dateKey();
  let log = readLog();
  const saved = log[day] ?? {};
  let n = 0;
  const order = GROUPS.flatMap((g) => g.keys);

  host.innerHTML = `
  <section class="checkin" aria-labelledby="ci-title">
    <header class="ci-hud">
      <div class="hud-left">
        <p class="eyebrow">Module 3 · Daily procedure</p>
        <div class="who" role="group" aria-label="Who is checking in">${crew.members.map((m) => `<button type="button" class="who-pill ${m.id === member.id ? "on" : ""}" data-who="${m.id}" aria-pressed="${m.id === member.id}">${m.name}<small>${m.role}</small></button>`).join("")}</div>
        <h1 id="ci-title" tabindex="-1">${day === today ? "Today's readings" : `Correct ${nice(day)}`}</h1>
        <p class="lede keep">Most of this arrives by itself from your watch and sensors (marked ⌁). Check it, change anything that looks wrong, and add how you feel. <a href="#devices">Your devices →</a></p>
      </div>
      <div class="hud-ring" aria-hidden="true">
        <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" class="hr-track"/><circle cx="60" cy="60" r="50" class="hr-fill" pathLength="100" data-ref="ring"/></svg>
        <div class="hr-text"><strong data-ref="pct">0</strong><span>% complete</span></div>
      </div>
    </header>
    <ol class="segments" aria-hidden="true">${order.map((k) => `<li data-seg="${k}"></li>`).join("")}</ol>
    <p class="mono ci-count" data-ref="count" aria-live="polite"></p>

    <form data-ref="form" novalidate>
      ${GROUPS.map((g) => `
        <fieldset class="seq">
          <legend><span class="seq-code">${g.code}</span>${g.name}<span class="seq-line" aria-hidden="true"></span><span class="seq-count mono" data-seq="${g.id}"></span></legend>
          <ol class="mods">${g.keys.map((k) => module(L.fieldByKey(k), n++, saved[k], L.previousValue(log, k, day))).join("")}</ol>
        </fieldset>`).join("")}
      <div class="ci-actions">
        <button type="submit" class="transmit"><span class="tx-glow" aria-hidden="true"></span><span>Transmit to log</span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6"/></svg></button>
        ${day !== today ? `<button type="button" class="textlink" data-edit="${today}">Back to today's check-in</button>` : ""}
      </div>
    </form>
    <div data-ref="result" aria-live="polite"></div>

    <p class="fine rule-note">Typo limits and the sudden-jump check are app rules, not medical ranges. Readings are not judged normal or abnormal until ranges from an approved official source are added.</p>

    <section class="data-card" aria-labelledby="data-h">
      <div class="dc-head"><h2 id="data-h">Data vault</h2><span class="chip tone-normal"><span aria-hidden="true">●</span> On this device only</span></div>
      <p>Nothing leaves this device. Keep a copy, or move it to another device.</p>
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
    const perGroup = Object.fromEntries(GROUPS.map((g) => [g.id, 0]));
    for (const f of L.FIELDS) {
      const row = form.querySelector(`[data-step="${f.key}"]`);
      const r = L.checkValue(f, raw[f.key]);
      const prev = L.previousValue(log, f.key, day);
      const jump = r.state === "ok" && L.isJump(f, r.value, prev);
      row.dataset.state = r.state === "ok" ? (jump ? "jump" : "ok") : r.state;
      row.querySelector(".mod-msg").textContent = r.state === "impossible" ? `◌ Measure again: ${r.why}`
        : jump ? "◌ Big change since your last reading. Check the device and measure again; it will be saved with a Measure again flag." : "";
      const delta = row.querySelector("[data-delta]");
      if (r.state === "ok" && prev != null && !f.scale) {
        const a = f.pair ? r.value[0] - prev[0] : r.value - prev;
        const dec = String(f.step ?? 1).split(".")[1]?.length ?? 0;
        delta.textContent = a === 0 ? "= same" : `${a > 0 ? "▴ +" : "▾ "}${a.toFixed(dec)}`;
      } else delta.textContent = "";
      host.querySelector(`[data-seg="${f.key}"]`).className = row.dataset.state;
      if (r.state === "ok") { filled += 1; perGroup[GROUPS.find((g) => g.keys.includes(f.key)).id] += 1; }
    }
    const pct = Math.round((filled / L.FIELDS.length) * 100);
    $("ring").style.strokeDashoffset = String(100 - pct);
    $("pct").textContent = String(pct);
    $("count").textContent = `${filled} of ${L.FIELDS.length} steps in`;
    for (const g of GROUPS) host.querySelector(`[data-seq="${g.id}"]`).textContent = `${perGroup[g.id]}/${g.keys.length}`;
  }

  form.addEventListener("input", refresh);
  form.addEventListener("click", (e) => {
    const b = e.target.closest("[data-nudge]");
    if (!b) return;
    const f = L.fieldByKey(b.dataset.key);
    const sel = b.dataset.part != null ? `input[data-key="${f.key}"][data-part="${b.dataset.part}"]` : `input[data-key="${f.key}"]`;
    const input = form.querySelector(sel);
    const step = f.step ?? 1;
    const prev = L.previousValue(log, f.key, day);
    const base = input.value.trim() === "" ? (prev != null ? (f.pair ? prev[Number(b.dataset.part)] : prev) : (f.pair ? [120, 80][Number(b.dataset.part)] : f.min)) : Number(input.value.replace(",", "."));
    const dec = String(step).split(".")[1]?.length ?? 0;
    const lo = f.pair ? f.min[Number(b.dataset.part)] : f.min;
    const hi = f.pair ? f.max[Number(b.dataset.part)] : f.max;
    const next = input.value.trim() === "" ? base : base + Number(b.dataset.nudge) * step;
    input.value = Math.min(hi, Math.max(lo, next)).toFixed(dec);
    refresh();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const { entry, problems } = L.buildEntry(rawFromForm(form), log, day);
    // a value left as the device gave it keeps its origin; one the person changed becomes theirs
    for (const [k, r] of Object.entries(entry)) {
      const before = log[day]?.[k];
      if (before?.src && JSON.stringify(before.value) === JSON.stringify(r.value)) { r.src = before.src; if (before.at) r.at = before.at; }
    }
    const bad = Object.keys(problems);
    if (bad.length) {
      refresh();
      form.querySelector(`[data-step="${bad[0]}"] input`)?.focus();
      $("result").innerHTML = `<p class="result warn">◌ ${bad.length} ${bad.length === 1 ? "value needs" : "values need"} measuring again before transmitting.</p>`;
      return;
    }
    log = L.saveDay(log, day, entry);
    if (!writeLog(log)) { $("result").innerHTML = `<p class="result warn">This browser blocked saving. The check-in was not stored.</p>`; return; }
    const jumps = L.FIELDS.filter((f) => entry[f.key]?.flag === "again");
    $("result").innerHTML = `<div class="result ok telemetry">
      <p class="eyebrow">Telemetry received · ${new Date().toISOString().slice(11, 16)} UTC</p>
      <p><strong>Saved for ${member.name}, ${day === today ? "today" : nice(day)}.</strong> ${L.countFilled(entry)} of ${L.FIELDS.length} steps logged.</p>
      <ul class="tm-chips">${L.FIELDS.filter((f) => entry[f.key]).map((f) => `<li class="${entry[f.key].flag === "again" ? "again" : ""}">${f.label}: <b>${fmt(entry[f.key].value)}</b>${f.unit ? ` ${f.unit}` : ""}</li>`).join("")}</ul>
      ${jumps.length ? `<p class="tone-again">◌ Measure again: ${jumps.map((f) => f.label.toLowerCase()).join(", ")}.</p>` : ""}
      <a class="cta" href="#today">See it in the Cupola</a></div>`;
    $("result").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    $("history").innerHTML = history(log, today);
  });

  host.querySelector(".who").addEventListener("click", (e) => {
    const b = e.target.closest("[data-who]");
    if (b && b.dataset.who !== member.id) document.dispatchEvent(new CustomEvent("ergosphere:switch", { detail: b.dataset.who })); // their own code
  });

  host.addEventListener("click", (e) => {
    const t = e.target.closest("[data-edit],[data-do]");
    if (!t) return;
    if (t.dataset.edit) { go(t.dataset.edit === today ? "log" : `log/${t.dataset.edit}`); return; }
    if (t.dataset.do === "csv") download(`ergosphere-log-${member.name.replace(/\s+/g, "-").toLowerCase()}-${today}.csv`, L.toCsv(log), "text/csv");
    if (t.dataset.do === "backup") download(`ergosphere-backup-${member.name.replace(/\s+/g, "-").toLowerCase()}-${today}.json`, L.toBackup(log), "application/json");
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
  requestAnimationFrame(() => host.querySelector(".checkin")?.classList.add("ready"));
}
