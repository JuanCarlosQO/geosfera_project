// Devices — the rules, with no DOM so Node can test them. Readings arrive from devices instead
// of being typed: the actigraphy watch NASA uses on the station (Philips Actiwatch Spectrum),
// standard Bluetooth health sensors, and the simulated live sensors. What a device gives is
// written into the daily log with where it came from; what the crew member typed is never
// overwritten.
//
// The watch has no Bluetooth: Philips documents a USB connection, and NASA says its data stay
// in the watch's memory until downloaded. So the app reads the file that Philips' Actiware
// software exports, or (for the demo) a simulated download. Sources: docs/SOURCES.md.

/* ---------- the watch: what happened, in order ---------- */

// One watch event. `at` is an ISO time; awake/off periods also carry `until`.
export const EVENT_KINDS = {
  bed: "Went to bed",
  asleep: "Fell asleep",
  awake: "Woke up during the night",
  wake: "Woke up",
  up: "Got up",
  off: "Watch taken off",
  on: "Watch put back on",
  press: "Pressed the watch's button",
  rated: "How rested"
};

// Who said so. The screens keep the three apart: what the watch RECORDED (worn or not), what the
// app ESTIMATED from it (asleep, awake), and what the crew member REPORTED with a tap.
export const SELF = ["self", "self-sim"];
// the watch's own event-marker button is the crew member speaking too, through the watch
export const isSelf = (e) => SELF.includes(e?.src) || e?.kind === "press" || e?.kind === "rated";

// App rules (illustrative): a watch off this long outside sleep is worth a reminder; a night
// counts toward the day it ends on.
export const RULES = { offRemindMin: 60, nightFromHour: 18 };

const ms = (t) => new Date(t).getTime();
const iso = (t) => new Date(t).toISOString();
const MIN = 60000;
const round1 = (v) => Math.round(v * 10) / 10;
const pad = (n) => String(n).padStart(2, "0");
export const dayOf = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/** Keeps only well-formed events, sorted, without repeats. */
export function cleanEvents(raw) {
  const seen = new Set();
  const out = [];
  for (const e of Array.isArray(raw) ? raw : []) {
    if (!EVENT_KINDS[e?.kind] || Number.isNaN(ms(e.at))) continue;
    const ev = { kind: e.kind, at: iso(e.at) };
    if (e.until != null && !Number.isNaN(ms(e.until)) && ms(e.until) > ms(e.at)) ev.until = iso(e.until);
    if (e.src) ev.src = String(e.src).slice(0, 20);
    if (e.reason === "eva") ev.reason = "eva";
    if (e.kind === "rated") { const v = Number(e.value); if (!Number.isInteger(v) || v < 1 || v > 5) continue; ev.value = v; }
    const key = `${ev.kind}@${ev.at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }
  return out.sort((a, b) => ms(a.at) - ms(b.at));
}

/** Adds events to a list, keeping the last `days` days only. */
export function addEvents(list, events, now = new Date(), days = 14) {
  const from = ms(now) - days * 24 * 60 * MIN;
  return cleanEvents([...(list ?? []), ...events]).filter((e) => ms(e.at) >= from);
}

/** Off-the-wrist periods: each "off" closes at its `until`, or at the next "on", or at `end`. */
export function offPeriods(events, end = Date.now()) {
  const list = cleanEvents(events);
  return list.filter((e) => e.kind === "off").map((e) => {
    const next = list.find((x) => x.kind === "on" && ms(x.at) > ms(e.at));
    const stop = e.until ? ms(e.until) : next ? ms(next.at) : ms(end);
    return { from: ms(e.at), to: Math.max(ms(e.at), stop), reason: e.reason ?? null, src: e.src ?? null };
  });
}
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/**
 * The night that ends on `day` (from 18:00 the evening before to 18:00 that day), or null.
 * The sleep window is the watch's "fell asleep" to "woke up" (basis "watch"); with no watch
 * night, the crew member's own "went to bed" to "got up" (basis "marks"). Sleep = the window
 * minus the awake periods minus any time the watch was off the wrist inside it (that stretch
 * was not measured, so it is not counted as sleep).
 *   { day, basis, asleep, wake, bed, up, latencyMin, sleepHours, awakenings, awakeMin,
 *     offInSleepMin, offMin, efficiency, events }
 */
export function nightSummary(events, day) {
  const [y, m, d] = day.split("-").map(Number);
  const to = new Date(y, m - 1, d, RULES.nightFromHour).getTime();
  const from = to - 24 * 60 * MIN;
  const all = cleanEvents(events);
  const inside = all.filter((e) => ms(e.at) >= from && ms(e.at) < to);
  const asleep = inside.find((e) => e.kind === "asleep" && !isSelf(e));
  const wake = asleep && inside.find((e) => e.kind === "wake" && !isSelf(e) && ms(e.at) > ms(asleep.at));
  const bed = inside.find((e) => e.kind === "bed");
  const up = bed ? inside.find((e) => e.kind === "up" && ms(e.at) > ms(bed.at)) : inside.find((e) => e.kind === "up");
  let start, end, basis;
  if (asleep && wake) { start = ms(asleep.at); end = ms(wake.at); basis = "watch"; }
  else if (bed && up) { start = ms(bed.at); end = ms(up.at); basis = "marks"; }
  else return null;
  const span = end - start;
  const awakes = inside.filter((e) => e.kind === "awake" && ms(e.at) > start && ms(e.at) < end);
  const awakeMs = awakes.reduce((n, e) => n + Math.max(0, Math.min(ms(e.until ?? e.at), end) - ms(e.at)), 0);
  const offs = offPeriods(all, to).filter((p) => p.to > from && p.from < to);
  const offInSleep = offs.reduce((n, p) => n + overlap(p.from, p.to, start, end), 0);
  const offMs = offs.reduce((n, p) => n + overlap(p.from, p.to, from, to), 0);
  const sleepMs = Math.max(0, span - awakeMs - offInSleep);
  return {
    day, basis,
    asleep: iso(start),
    wake: iso(end),
    bed: bed?.at ?? null,
    up: up?.at ?? null,
    bedBy: bed ? (isSelf(bed) ? "you" : "file") : null, // the crew member's tap, or the file's time in bed
    upBy: up ? (isSelf(up) ? "you" : "file") : null,
    latencyMin: bed && basis === "watch" && ms(bed.at) <= start ? Math.round((start - ms(bed.at)) / MIN) : null,
    sleepHours: round1(sleepMs / 3600000),
    awakenings: awakes.length,
    awakeMin: Math.round(awakeMs / MIN),
    offInSleepMin: Math.round(offInSleep / MIN),
    offMin: Math.round(offMs / MIN),
    efficiency: span ? Math.round((sleepMs / span) * 100) : 0,
    rested: [...inside].reverse().find((e) => e.kind === "rated" && ms(e.at) >= start)?.value ?? null,
    events: inside
  };
}

/**
 * A tap by the crew member: "bed", "up", "off" or "on". Taking the watch off when it already is,
 * or putting it on when it is on, changes nothing; putting it on closes the open off period.
 */
export function selfMark(events, kind, now = new Date(), value = null) {
  const list = cleanEvents(events);
  if (kind === "rated") { const v = Number(value); return Number.isInteger(v) && v >= 1 && v <= 5 ? cleanEvents([...list, { kind, at: iso(now), value: v, src: "self" }]) : list; }
  if (!["bed", "up", "off", "on"].includes(kind)) return list;
  const off = offNow(list, now);
  if (kind === "off" && off) return list;
  if (kind === "on") {
    if (!off) return list;
    const open = [...list].reverse().find((e) => e.kind === "off" && !e.until);
    const rest = open ? list.filter((e) => e !== open) : list;
    return cleanEvents([...rest, ...(open ? [{ ...open, until: iso(now) }] : []), { kind: "on", at: iso(now), src: "self" }]);
  }
  return cleanEvents([...list, { kind, at: iso(now), src: "self" }]);
}

/** True when an event falls in the night that ends on `day` (18:00 the day before to 18:00). */
export function inNight(e, day) {
  const [y, m, d] = day.split("-").map(Number);
  const to = new Date(y, m - 1, d, RULES.nightFromHour).getTime();
  return ms(e.at) >= to - 24 * 60 * MIN && ms(e.at) < to;
}

/** The watch is off right now: { since, minutes, remind, eva } or null. No reminder during a spacewalk. */
export function offNow(events, now = new Date()) {
  const last = [...cleanEvents(events)].reverse().find((e) => e.kind === "off" || e.kind === "on");
  if (!last || last.kind !== "off" || (last.until && ms(last.until) <= ms(now)) || ms(last.at) > ms(now)) return null;
  const minutes = Math.floor((ms(now) - ms(last.at)) / MIN);
  const eva = last.reason === "eva";
  return { since: last.at, minutes, remind: !eva && minutes >= RULES.offRemindMin, eva };
}

/* ---------- a spacewalk: the watch stays inside (team statement, pending a source) ---------- */

/** The label of an event, naming the spacewalk when the watch came off for one. */
export const eventLabel = (e) => (e.kind === "off" && e.reason === "eva" ? "Watch off for the spacewalk" : e.kind === "on" && e.reason === "eva" ? "Watch back on after the spacewalk" : EVENT_KINDS[e.kind]);

/** Suit-up: the watch comes off for the spacewalk. Nothing changes if it already is. */
export function startEva(events, now = new Date(), src = "simulated") {
  const off = offNow(events, now);
  if (off?.eva) return cleanEvents(events);
  return cleanEvents([...(events ?? []), { kind: "off", at: iso(now), reason: "eva", src }]);
}
/** Back inside: the spacewalk's off period closes and the watch goes back on. */
export function endEva(events, now = new Date(), src = "simulated") {
  const list = cleanEvents(events);
  const open = [...list].reverse().find((e) => e.kind === "off" && e.reason === "eva" && !e.until);
  if (!open || ms(now) <= ms(open.at)) return list;
  return cleanEvents([...list.filter((e) => e !== open), { ...open, until: iso(now) }, { kind: "on", at: iso(now), reason: "eva", src }]);
}

/* A small seeded random generator, so a simulated night is the same every time it is drawn. */
function rng(seedText) {
  let h = 2166136261;
  for (const c of seedText) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

/**
 * SIMULATED: what the watch would record for the night ending on `day`, plus the morning:
 * falling asleep, one to three short awakenings, waking, and the watch off for a while after
 * waking (exercise or hygiene). `hours` steers the night's length (the crew member's usual);
 * with `exact` the night lasts exactly that long (to match a night already in the log).
 * Deterministic for a given member and day. Only events up to `now` are returned.
 */
export function simulateNight(day, { member = "crew", hours = 7, exact = false, nightOff: forceOff, now = new Date() } = {}) {
  const r = rng(`${member}:${day}`);
  const [y, m, d] = day.split("-").map(Number);
  const asleep = new Date(y, m - 1, d - 1, 22, 0).getTime() + Math.round((r() * 90 - 20) * MIN);
  const awakes = [];
  const n = 1 + Math.floor(r() * 3);
  let awakeTotal = 0;
  for (let i = 0; i < n; i += 1) {
    const at = asleep + Math.round((1.2 + r() * (hours - 2)) * 60) * MIN;
    const len = Math.round(3 + r() * 14) * MIN;
    awakes.push({ kind: "awake", at: iso(at), until: iso(at + len), src: "simulated" });
    awakeTotal += len;
  }
  const jitter = (r() - 0.55) * 1.6;
  const sleepMs = Math.round((hours + (exact ? 0 : jitter)) * 60) * MIN; // exact: the night the log already holds
  // about one night in three the watch comes off for a while in the night (it is not counted as sleep)
  const offRoll = r();
  const nightOff = (forceOff ?? offRoll < 0.34) ? { at: asleep + Math.round((2 + r() * 2) * 60) * MIN, len: Math.round((18 + r() * 25) * MIN) } : null;
  const wake = asleep + sleepMs + awakeTotal + (nightOff?.len ?? 0);
  if (nightOff) {
    // keep it clear of the awakenings
    for (const a of awakes) if (ms(a.at) < nightOff.at + nightOff.len && ms(a.until) > nightOff.at) { a.at = iso(ms(a.at) + nightOff.len + 5 * MIN); a.until = iso(ms(a.until) + nightOff.len + 5 * MIN); }
  }
  const bedAt = asleep - Math.round((8 + r() * 20) * MIN), upAt = wake + Math.round((4 + r() * 12) * MIN);
  const offAt = wake + Math.round((35 + r() * 60) * MIN);
  const offLen = Math.round((15 + r() * 40) * MIN);
  const all = [
    { kind: "bed", at: iso(bedAt), src: "self-sim" },
    { kind: "asleep", at: iso(asleep), src: "simulated" },
    ...awakes,
    ...(nightOff ? [{ kind: "off", at: iso(nightOff.at), until: iso(nightOff.at + nightOff.len), src: "simulated" }, { kind: "on", at: iso(nightOff.at + nightOff.len), src: "simulated" }] : []),
    { kind: "wake", at: iso(wake), src: "simulated" },
    { kind: "up", at: iso(upAt), src: "self-sim" },
    { kind: "off", at: iso(offAt), until: iso(offAt + offLen), src: "simulated" },
    { kind: "on", at: iso(offAt + offLen), src: "simulated" }
  ];
  return cleanEvents(all.filter((e) => ms(e.at) <= ms(now)).map((e) => (e.until && ms(e.until) > ms(now) ? { ...e, until: undefined } : e)));
}

/* ---------- the file Actiware exports ---------- */

// Column names of Actiware's interval export, as an R importer reads them (docs/SOURCES.md):
// interval type, interval number, start date, start time, end date, end time, duration,
// efficiency, sleep time. Headers are matched loosely (case, spaces and symbols ignored).
const COLS = {
  type: ["intervaltype", "type", "intname"],
  startDate: ["startdate", "sdate"],
  startTime: ["starttime", "stime"],
  endDate: ["enddate", "edate"],
  endTime: ["endtime", "etime"],
  sleep: ["sleeptime", "totalsleeptime", "smin"],
  efficiency: ["efficiency", "sleepefficiency"]
};
const norm = (h) => String(h ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function splitLine(line, sep) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i += 1; } else q = !q; }
    else if (c === sep && !q) { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/** "13/11/2026" (day first, as Actiware writes it in the R importer) or "2026-11-13" + "22:41" / "10:41:00 PM". */
export function parseStamp(date, time) {
  let y, mo, d;
  let m = String(date ?? "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) [, y, mo, d] = m.map(Number);
  else if ((m = String(date ?? "").trim().match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/))) { [, d, mo, y] = m.map(Number); if (y < 100) y += 2000; }
  else return null;
  const t = String(time ?? "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/);
  if (!t) return null;
  let h = Number(t[1]);
  if (t[4]) { const pm = /p/i.test(t[4]); if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
  const at = new Date(y, mo - 1, d, h, Number(t[2]), Number(t[3] ?? 0));
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h < 24 && !Number.isNaN(at.getTime()) ? at : null;
}

// The epoch-by-epoch list, as Philips' Actiware manual defines its columns (docs/SOURCES.md):
// Off-Wrist Status 0 on-wrist / 1 off-wrist; Activity counts; Event Marker when the button was
// pushed; Sleep/Wake 0 sleep / 1 wake; Interval Status Active, Rest, Rest-Sleep or Excluded.
const ECOLS = {
  date: ["date"], time: ["time"],
  off: ["offwriststatus", "offwrist"],
  activity: ["activity", "activitycounts"],
  marker: ["eventmarker", "marker"],
  sw: ["sleepwake", "sleepwakescore", "sw"],
  interval: ["intervalstatus"]
};
export const AWAKE_MIN = 2; // app rule: a run of WAKE epochs this long inside the night counts as an awakening
export const BIN_MIN = 15;  // activity is kept in 15-minute sums for the screen

const num = (v) => { const n = Number(String(v ?? "").trim().replace(",", ".")); return Number.isFinite(n) ? n : null; };

/** Activity summed into 15-minute bins: { [ISO start of bin]: counts }. */
export function binActivity(samples) {
  const out = {};
  for (const { t, ac } of samples) {
    if (ac == null) continue;
    const b = Math.floor(t / (BIN_MIN * MIN)) * BIN_MIN * MIN;
    const k = iso(b);
    out[k] = (out[k] ?? 0) + ac;
  }
  return out;
}

/**
 * Reads Actiware's epoch-by-epoch list. -> { ok, kind: "epoch", events, nights, rows, epochSec, activity }
 * Everything here comes from the watch file, so the crew member types none of it:
 *  - off-wrist runs become "watch taken off" / "put back on" (the watch knows);
 *  - Rest intervals (Actiware's time in bed) become "went to bed" / "got up";
 *  - SLEEP epochs give "fell asleep" / "woke up", and WAKE runs inside become awakenings;
 *  - each event-marker press is kept as the crew member's own mark, made on the watch;
 *  - activity counts are kept in 15-minute bins.
 */
export function parseActiwareEpochs(text, opts = {}) {
  const lines = String(text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const sep = [",", ";", "\t"].find((c) => lines[i].includes(c));
    if (!sep) continue;
    const head = splitLine(lines[i], sep).map(norm);
    const idx = Object.fromEntries(Object.entries(ECOLS).map(([k, names]) => [k, head.findIndex((h) => names.includes(h))]));
    if (idx.date < 0 || idx.time < 0 || (idx.activity < 0 && idx.off < 0 && idx.sw < 0)) continue;
    const rows = [];
    for (const line of lines.slice(i + 1)) {
      if (!line.trim()) continue;
      const c = splitLine(line, sep);
      const at = parseStamp(c[idx.date], c[idx.time]);
      if (!at) continue;
      const sw = num(c[idx.sw]), off = num(c[idx.off]);
      rows.push({
        t: at.getTime(),
        ac: idx.activity >= 0 ? num(c[idx.activity]) : null,
        off: off === 1 ? 1 : off === 0 ? 0 : null,
        sw: sw === 0 ? "S" : sw === 1 ? "W" : null,
        mark: idx.marker >= 0 && (num(c[idx.marker]) ?? 0) > 0,
        int: idx.interval >= 0 ? String(c[idx.interval] ?? "").trim().toUpperCase() : ""
      });
    }
    if (rows.length < 2) return { ok: false, why: "The file has the epoch table, but too few rows could be read." };
    rows.sort((a, b) => a.t - b.t);
    return { ok: true, kind: "epoch", ...fromRows(rows, opts), packed: packRows(rows, rows[rows.length - 1].t - 4 * 24 * 60 * MIN) };
  }
  return { ok: false, why: "No epoch table (date, time and activity, off-wrist or sleep/wake columns)." };
}

/* ---------- calibration: Actiware's own sleep/wake scoring with a chosen wake threshold ---------- */

// Actiware's manual: an epoch is WAKE when its "total activity counts" exceed the wake threshold;
// for 1-minute epochs the total weighs the two minutes on each side: 1/25, 1/5, 1, 1/5, 1/25.
// Thresholds: Low 20, Medium 40, High 80 ("The higher the Wake Threshold, the fewer the number of
// epochs scored as wake"). Only the 1-minute formula is written out in the manual, so other epoch
// lengths keep the score already in the file. Raising the threshold for microgravity (floating
// arms) is a team hypothesis, NOT validated.
export const WAKE_THRESHOLDS = { low: 20, medium: 40, high: 80 };
const WEIGHTS_1MIN = [1 / 25, 1 / 5, 1, 1 / 5, 1 / 25];

/** Rescored copy of the rows (1-minute epochs only); off-the-wrist minutes get no score. */
export function scoreSleepWake(rows, step, threshold) {
  if (!Number.isFinite(threshold) || Math.round(step / 1000) !== 60) return { rows, rescored: false };
  const out = rows.map((r, i) => {
    if (r.off === 1 || r.ac == null) return { ...r, sw: null };
    let total = 0;
    for (let k = -2; k <= 2; k += 1) {
      const n = rows[i + k];
      if (!n || n.off === 1 || n.ac == null || Math.abs(n.t - r.t - k * step) > step / 2) continue; // only true neighbours
      total += n.ac * WEIGHTS_1MIN[k + 2];
    }
    return { ...r, sw: total <= threshold ? "S" : "W" };
  });
  return { rows: out, rescored: true };
}

/** Everything the reader builds from the epoch rows; `threshold` rescores sleep/wake. */
export function fromRows(rows0, { threshold = null } = {}) {
  const gaps = rows0.slice(1).map((r, k) => r.t - rows0[k].t).filter((g) => g > 0).sort((a, b) => a - b);
  const step = gaps[Math.floor(gaps.length / 2)] ?? MIN;
  const { rows, rescored } = scoreSleepWake(rows0, step, threshold);
  const events = [];
  const src = "actiware";
  const runs = (test) => {
    const out = [];
    let start = null;
    rows.forEach((r, k) => {
      const on = test(r);
      if (on && start == null) start = r.t;
      const last = k === rows.length - 1 || rows[k + 1].t - r.t > step * 1.5;
      if (start != null && (!on || last)) { out.push([start, on ? r.t + step : r.t]); start = null; }
    });
    return out;
  };
  for (const [a, b] of runs((r) => r.off === 1)) events.push({ kind: "off", at: iso(a), until: iso(b), src }, { kind: "on", at: iso(b), src });
  const rests = runs((r) => r.int === "REST" || r.int === "REST-SLEEP" || r.int === "REST-S");
  for (const [a, b] of rests) events.push({ kind: "bed", at: iso(a), src: "actiware-rest" }, { kind: "up", at: iso(b), src: "actiware-rest" });
  for (const r of rows) if (r.mark) events.push({ kind: "press", at: iso(r.t), src });
  const windows = rests.length ? rests : runs((r) => r.sw === "S").filter(([a, b]) => b - a >= 3 * 60 * MIN);
  for (const [a, b] of windows) {
    const inside = rows.filter((r) => r.t >= a && r.t < b && r.sw);
    const sleeps = inside.filter((r) => r.sw === "S");
    if (!sleeps.length) continue;
    const s0 = sleeps[0].t, s1 = sleeps[sleeps.length - 1].t + step;
    events.push({ kind: "asleep", at: iso(s0), src }, { kind: "wake", at: iso(s1), src });
    let w0 = null;
    for (const r of inside.filter((x) => x.t >= s0 && x.t < s1)) {
      if (r.sw === "W" && w0 == null) w0 = r.t;
      if (r.sw === "S" && w0 != null) { if (r.t - w0 >= AWAKE_MIN * MIN) events.push({ kind: "awake", at: iso(w0), until: iso(r.t), src }); w0 = null; }
    }
  }
  const clean = cleanEvents(events);
  const nights = [...new Set(clean.filter((e) => e.kind === "wake" || e.kind === "up").map((e) => dayOf(e.at)))].map((d) => nightSummary(clean, d)).filter(Boolean);
  return { events: clean, nights, rows: rows.length, epochSec: Math.round(step / 1000), activity: binActivity(rows), scoredBy: rescored ? threshold : "file" };
}

/** The rows kept on the device so the night can be rescored later: [t, ac, off, sw, mark, int]. */
export const packRows = (rows, keepFrom = 0) => rows.filter((r) => r.t >= keepFrom).map((r) => [r.t, r.ac, r.off, r.sw === "S" ? 0 : r.sw === "W" ? 1 : null, r.mark ? 1 : 0, r.int?.[0] === "R" ? (r.int.includes("S") ? "RS" : "R") : r.int?.[0] === "E" ? "E" : "A"]);
export const unpackRows = (packed) => (Array.isArray(packed) ? packed : []).filter((x) => Array.isArray(x) && Number.isFinite(x[0])).map(([t, ac, off, sw, mark, int]) => ({ t, ac: Number.isFinite(ac) ? ac : null, off: off === 1 ? 1 : off === 0 ? 0 : null, sw: sw === 0 ? "S" : sw === 1 ? "W" : null, mark: mark === 1, int: int === "R" ? "REST" : int === "RS" ? "REST-SLEEP" : int === "E" ? "EXCLUDED" : "ACTIVE" }));

/** Reads either Actiware export: the epoch-by-epoch list or the interval statistics. */
export function readActiwareFile(text, opts = {}) {
  const e = parseActiwareEpochs(text, opts);
  if (e.ok) return e;
  const r = parseActiware(text);
  return r.ok ? { ...r, kind: "intervals" } : { ok: false, why: "This file is neither Actiware's epoch-by-epoch list nor its interval statistics." };
}

/**
 * When a watch file arrives, what it knows replaces the crew member's taps for the same thing:
 * bed and up taps go where the file has its own time in bed, off and on taps go where the file
 * covers the time (it knows the wrist status itself). Ratings always stay.
 */
export function mergeFile(events, fileEvents, { coverFrom = null, coverTo = null } = {}) {
  const file = cleanEvents(fileEvents);
  const bedDays = new Set(file.filter((e) => e.kind === "bed" || e.kind === "up").map((e) => dayOf(e.at)));
  const covered = (e) => coverFrom != null && ms(e.at) >= coverFrom && ms(e.at) <= coverTo;
  const keep = cleanEvents(events).filter((e) => {
    if (e.kind === "rated") return true;
    if (!SELF.includes(e.src)) return !covered(e) && e.src !== "simulated"; // the file replaces the watch's own older data for that time
    if ((e.kind === "bed" || e.kind === "up") && bedDays.has(dayOf(e.at))) return false;
    if ((e.kind === "off" || e.kind === "on") && covered(e)) return false;
    return true;
  });
  return cleanEvents([...keep, ...file]);
}

/** SIMULATED activity counts for the demo watch: busy by day, low in sleep, nothing off the wrist. */
export function simulateActivity(events, from, to, member = "crew") {
  const r = rng(`${member}:ac:${iso(from).slice(0, 10)}`);
  const offs = offPeriods(events, to);
  const sleeps = [];
  const list = cleanEvents(events);
  for (const a of list.filter((e) => e.kind === "asleep")) { const w = list.find((e) => e.kind === "wake" && ms(e.at) > ms(a.at)); if (w) sleeps.push([ms(a.at), ms(w.at)]); }
  const out = {};
  for (let t = Math.floor(ms(from) / (BIN_MIN * MIN)) * BIN_MIN * MIN; t < ms(to); t += BIN_MIN * MIN) {
    if (offs.some((p) => t >= p.from && t < p.to)) { out[iso(t)] = 0; continue; }
    const asleep = sleeps.some(([a, b]) => t >= a && t < b);
    const h = new Date(t).getHours();
    out[iso(t)] = Math.round(asleep ? r() * 40 : (h >= 7 && h < 22 ? 300 + r() * 900 : 60 + r() * 200));
  }
  return out;
}

/**
 * Reads an Actiware interval export. -> { ok, events, nights, rows, why? }
 * SLEEP intervals become "fell asleep" and "woke up"; EXCLUDED intervals (time the watch could
 * not use, usually off the wrist) become "watch taken off" and "put back on". Rest and active
 * intervals are not events. PENDING a real export from the team to confirm the exact layout.
 */
export function parseActiware(text) {
  const lines = String(text ?? "").replace(/^﻿/, "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const sep = [",", ";", "\t"].find((s) => lines[i].includes(s));
    if (!sep) continue;
    const head = splitLine(lines[i], sep).map(norm);
    const idx = Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, head.findIndex((h) => names.includes(h))]));
    if ([idx.type, idx.startDate, idx.startTime, idx.endDate, idx.endTime].some((x) => x < 0)) continue;
    const events = [];
    let rows = 0;
    for (const line of lines.slice(i + 1)) {
      if (!line.trim()) continue;
      const c = splitLine(line, sep);
      const type = String(c[idx.type] ?? "").toUpperCase();
      const start = parseStamp(c[idx.startDate], c[idx.startTime]);
      const end = parseStamp(c[idx.endDate], c[idx.endTime]);
      if (!start || !end || end <= start) continue;
      rows += 1;
      if (type === "SLEEP" || type === "O - O") {
        events.push({ kind: "asleep", at: iso(start), src: "actiware" }, { kind: "wake", at: iso(end), src: "actiware" });
        const sleepMin = Number(String(c[idx.sleep] ?? "").replace(",", "."));
        const gap = (end - start) / MIN - sleepMin;
        // the export gives the time asleep, not when the awakenings were: record their total as one awake period
        if (idx.sleep >= 0 && Number.isFinite(sleepMin) && gap >= 1) {
          const mid = start.getTime() + (end - start) / 2;
          events.push({ kind: "awake", at: iso(mid), until: iso(mid + gap * MIN), src: "actiware" });
        }
      } else if (type === "EXCLUDED") {
        events.push({ kind: "off", at: iso(start), until: iso(end), src: "actiware" }, { kind: "on", at: iso(end), src: "actiware" });
      }
    }
    const clean = cleanEvents(events);
    const nights = [...new Set(clean.filter((e) => e.kind === "wake").map((e) => dayOf(e.at)))].map((d) => nightSummary(clean, d)).filter(Boolean);
    if (!rows) return { ok: false, why: "The file has the interval table, but no rows could be read." };
    return { ok: true, events: clean, nights, rows };
  }
  return { ok: false, why: "This is not an Actiware interval export (no table with interval type, start and end)." };
}

/* ---------- ActiGraph CentrePoint (cloud API, through the server) ---------- */

/**
 * Turns what api/actigraph returns into watch events.
 *  sleepPeriods: [{ inBedTime, outBedTime, awakeningCount, averageAwakening }] (Dustin Tracy sleep periods)
 *  minutes: [{ t, wear }] (minute summaries: isWear false = the monitor was not worn)
 * The API gives how many awakenings and their average length, not when they were: they are
 * spread evenly across the night. -> { ok, events, nights, why? }
 */
export function parseCentrePoint({ sleepPeriods = [], minutes = [] } = {}) {
  const events = [];
  for (const p of Array.isArray(sleepPeriods) ? sleepPeriods : []) {
    const a = ms(p?.inBedTime), b = ms(p?.outBedTime);
    if (Number.isNaN(a) || Number.isNaN(b) || b <= a) continue;
    events.push({ kind: "asleep", at: iso(a), src: "centrepoint" }, { kind: "wake", at: iso(b), src: "centrepoint" });
    const n = Math.max(0, Math.min(30, Math.round(Number(p.awakeningCount) || 0)));
    const len = Math.max(0, Number(p.averageAwakening) || 0) * MIN;
    for (let i = 1; i <= n && len > 0; i += 1) {
      const at = a + ((b - a) * i) / (n + 1);
      events.push({ kind: "awake", at: iso(at), until: iso(Math.min(b, at + len)), src: "centrepoint" });
    }
  }
  const mins = (Array.isArray(minutes) ? minutes : []).filter((m) => !Number.isNaN(ms(m?.t)) && typeof m.wear === "boolean").sort((x, y) => ms(x.t) - ms(y.t));
  for (let i = 0; i < mins.length; i += 1) {
    if (mins[i].wear) continue;
    let j = i;
    while (j + 1 < mins.length && !mins[j + 1].wear && ms(mins[j + 1].t) - ms(mins[j].t) <= MIN) j += 1;
    const end = ms(mins[j].t) + MIN;
    events.push({ kind: "off", at: iso(mins[i].t), until: iso(end), src: "centrepoint" });
    if (j + 1 < mins.length) events.push({ kind: "on", at: iso(end), src: "centrepoint" });
    i = j;
  }
  const clean = cleanEvents(events);
  if (!clean.length) return { ok: false, why: "ActiGraph sent no sleep periods or wear minutes for these days." };
  const nights = [...new Set(clean.filter((e) => e.kind === "wake").map((e) => dayOf(e.at)))].map((d) => nightSummary(clean, d)).filter(Boolean);
  return { ok: true, events: clean, nights };
}

/* ---------- standard Bluetooth health sensors (Bluetooth SIG GATT) ---------- */

/** IEEE 11073 16-bit SFLOAT: 4-bit exponent, 12-bit mantissa, both signed. Special values -> null. */
export function sfloat(raw) {
  if ([0x07ff, 0x0800, 0x07fe, 0x0802, 0x0801].includes(raw)) return null;
  let m = raw & 0x0fff, e = raw >> 12;
  if (m >= 0x0800) m -= 0x1000;
  if (e >= 0x8) e -= 0x10;
  return Number((m * 10 ** e).toFixed(Math.max(0, -e)));
}
/** IEEE 11073 32-bit FLOAT: 8-bit exponent, 24-bit mantissa, both signed. Special values -> null. */
export function float32(raw) {
  const m0 = raw & 0xffffff;
  if ([0x7fffff, 0x800000, 0x7ffffe, 0x800002, 0x800001].includes(m0)) return null;
  let m = m0, e = (raw >>> 24) & 0xff;
  if (m >= 0x800000) m -= 0x1000000;
  if (e >= 0x80) e -= 0x100;
  return Number((m * 10 ** e).toFixed(Math.max(0, -e)));
}
const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const bytes = (v) => (v instanceof Uint8Array ? v : new Uint8Array(v.buffer ?? v, v.byteOffset ?? 0, v.byteLength ?? v.length));

/** Heart Rate Measurement (0x2A37): flags, 8- or 16-bit rate, optional energy, optional RR intervals. */
export function parseHeartRate(value) {
  const b = bytes(value);
  if (b.length < 2) return null;
  const f = b[0];
  let i = 1;
  const bpm = f & 0x01 ? u16(b, i) : b[i];
  i += f & 0x01 ? 2 : 1;
  if (f & 0x08) i += 2;
  const rr = [];
  if (f & 0x10) for (; i + 1 < b.length; i += 2) rr.push(Math.round((u16(b, i) / 1024) * 1000));
  return { bpm, contact: (f & 0x06) === 0x06 ? true : (f & 0x06) === 0x04 ? false : null, rr };
}
/** Blood Pressure Measurement (0x2A35): flags, systolic, diastolic, mean (SFLOAT), optional time and pulse. */
export function parseBloodPressure(value) {
  const b = bytes(value);
  if (b.length < 7) return null;
  const f = b[0], kpa = f & 0x01;
  const k = kpa ? 7.50062 : 1; // kPa -> mmHg
  const sys = sfloat(u16(b, 1)), dia = sfloat(u16(b, 3));
  if (sys == null || dia == null) return null;
  let i = 7;
  if (f & 0x02) i += 7;
  const pulse = f & 0x04 && b.length >= i + 2 ? sfloat(u16(b, i)) : null;
  return { systolic: Math.round(sys * k), diastolic: Math.round(dia * k), pulse: pulse == null ? null : Math.round(pulse) };
}
/** Temperature Measurement (0x2A1C): flags (bit 0: Fahrenheit), FLOAT value. Returns °C. */
export function parseTemperature(value) {
  const b = bytes(value);
  if (b.length < 5) return null;
  const v = float32(u32(b, 1));
  if (v == null) return null;
  return { celsius: Number((b[0] & 0x01 ? (v - 32) / 1.8 : v).toFixed(1)) };
}
/** PLX Spot-check (0x2A5E) or Continuous (0x2A5F) Measurement: flags, SpO2 and pulse rate (SFLOAT). */
export function parsePlx(value) {
  const b = bytes(value);
  if (b.length < 5) return null;
  const spo2 = sfloat(u16(b, 1)), pr = sfloat(u16(b, 3));
  return spo2 == null ? null : { spo2: Math.round(spo2), pulse: pr == null ? null : Math.round(pr) };
}

// What the app can connect to by Web Bluetooth (Chrome on Android or a computer). 16-bit ids
// assigned by the Bluetooth SIG; `field` is the daily-log reading each one fills.
export const BLE = [
  { id: "hr", label: "Heart-rate strap or watch", service: 0x180d, chars: [0x2a37], field: "heartRate", parse: parseHeartRate },
  { id: "bp", label: "Blood-pressure cuff", service: 0x1810, chars: [0x2a35], field: "bloodPressure", parse: parseBloodPressure },
  { id: "temp", label: "Thermometer", service: 0x1809, chars: [0x2a1c], field: "temperature", parse: parseTemperature },
  { id: "spo2", label: "Pulse oximeter", service: 0x1822, chars: [0x2a5e, 0x2a5f], field: "bloodOxygen", parse: parsePlx }
];

/** The log value a Bluetooth reading gives, or null. */
export function bleValue(id, r) {
  if (!r) return null;
  if (id === "hr") return r.bpm >= 20 && r.bpm <= 250 ? r.bpm : null;
  if (id === "bp") return r.systolic > r.diastolic ? [r.systolic, r.diastolic] : null;
  if (id === "temp") return r.celsius >= 30 && r.celsius <= 43 ? r.celsius : null;
  if (id === "spo2") return r.spo2 >= 50 && r.spo2 <= 100 ? r.spo2 : null;
  return null;
}

/** Resting heart rate from a stream: the median of the last readings once there are enough (app rule). */
export function restingFrom(bpms, need = 20) {
  if (bpms.length < need) return null;
  const s = [...bpms.slice(-need)].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/* ---------- into the daily log ---------- */

// Where a reading came from, as the screens name it.
export const SOURCES = {
  actiwatch: "Actiwatch",
  actiware: "Actiwatch file",
  bluetooth: "Bluetooth",
  sensors: "Live sensors (simulated)",
  simulated: "Actiwatch (simulated)",
  marks: "Your marks (estimated)",
  centrepoint: "ActiGraph CentrePoint"
};

/**
 * Writes device readings into one day of the log. readings: { key: value }. A reading typed by
 * the crew member (no `src`) is never replaced; an earlier device reading is.
 * -> { log, filled: [keys written] }
 */
export function fillDay(log, day, readings, src, now = new Date()) {
  const entry = { ...(log?.[day] ?? {}) };
  const filled = [];
  for (const [key, value] of Object.entries(readings ?? {})) {
    if (value == null) continue;
    const old = entry[key];
    if (old && old.value != null && !old.src) continue; // typed by hand: the person's word stands
    if (old?.src === src && JSON.stringify(old.value) === JSON.stringify(value)) continue;
    entry[key] = { value, src, at: iso(now) };
    filled.push(key);
  }
  if (!filled.length) return { log, filled };
  return { log: { ...(log ?? {}), [day]: { ...entry, savedAt: entry.savedAt ?? iso(now) } }, filled };
}
