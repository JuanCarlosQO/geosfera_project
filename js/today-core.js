import { FIELDS, fieldByKey, bandFor } from "./log-core.js";
// Main dashboard ("Today") rules, with no DOM so Node can test them.
// The six Cupola windows, what each reads from the daily log, and how today is summarised.

export const WINDOWS = [
  { id: "heart", label: "Heart", readings: ["heartRate", "bloodPressure"], body: "heart" },
  { id: "lungs", label: "Lungs", readings: ["bloodOxygen"], body: "lungs" },
  { id: "metabolism", label: "Metabolism", readings: ["glucose"], body: "immune" },
  { id: "radiation", label: "Radiation", readings: ["radiationDose"], body: "radiation" },
  { id: "body", label: "Body", readings: ["temperature"], body: "immune" },
  { id: "mind", label: "Mind", readings: ["sleepHours", "mood"], body: "mind" }
];

// Worst first: the window shows the most urgent status among its readings.
export const SEVERITY = ["act", "again", "watch", "pending", "logged", "normal", "none"];

/**
 * Status of one window.
 * readings: { heartRate: {value}, ... } for today. judge(key, reading) returns a status key;
 * until the health rules have an approved source, every reading is "pending" (Pending check).
 */
export function windowStatus(win, readings, judge = () => "pending") {
  const found = win.readings.filter((k) => readings?.[k] != null);
  if (found.length === 0) return "none";
  const statuses = found.map((k) => judge(k, readings[k]));
  return SEVERITY.find((s) => statuses.includes(s)) ?? "pending";
}

export function summarise(readings, judge) {
  const status = Object.fromEntries(WINDOWS.map((w) => [w.id, windowStatus(w, readings, judge)]));
  const values = Object.values(status);
  const measured = values.filter((s) => s !== "none").length;
  const normal = values.filter((s) => s === "normal").length;
  const flagged = WINDOWS.filter((w) => ["act", "again", "watch"].includes(status[w.id]));
  return { status, measured, normal, flagged, total: WINDOWS.length };
}

/** One honest sentence for the top of the dashboard. */
export function headline(summary) {
  const { measured, total, normal, flagged, status } = summary;
  if (measured === 0) return { title: "No readings yet today, Commander.", line: "Start today's check-in to light up the Cupola." };
  const act = flagged.filter((w) => status[w.id] === "act");
  if (act.length) return { title: "Act now, Commander.", line: `${names(act)} needs attention. Follow the steps in that window.` };
  const again = flagged.filter((w) => status[w.id] === "again");
  if (again.length) return { title: "Measure again, Commander.", line: `${names(again)} looked unusual. Check the device and measure once more.` };
  const watch = flagged.filter((w) => status[w.id] === "watch");
  if (watch.length) return { title: "Mostly good today, Commander.", line: `${names(watch)} ${watch.length === 1 ? "is" : "are"} in the watch range.` };
  if (normal === total) return { title: "All clear today, Commander.", line: "Every window is normal." };
  return { title: `${measured} of ${total} measured today, Commander.`, line: "Everything measured so far is in the normal range." };
}

function names(wins) {
  const n = wins.map((w) => w.label);
  return n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} and ${n.at(-1)}`;
}

/** Mission day counted from the first day the crew member used Ergosphere (day 1). */
export function missionDay(startIso, now = new Date()) {
  const start = new Date(`${startIso}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.floor((today - start) / 86_400_000) + 1);
}

/** Hexagonal Cupola geometry: six trapezoid windows around a central disc. */
export function cupolaGeometry({ cx = 195, cy = 180, inner = 74, outer = 178, inset = 0.88 } = {}) {
  const pt = (r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  return WINDOWS.map((w, i) => {
    const a0 = -120 + 60 * i;
    const a1 = a0 + 60;
    const raw = [pt(inner, a0), pt(inner, a1), pt(outer, a1), pt(outer, a0)];
    const mx = raw.reduce((s, p) => s + p[0], 0) / 4;
    const my = raw.reduce((s, p) => s + p[1], 0) / 4;
    const points = raw.map(([x, y]) => [mx + (x - mx) * inset, my + (y - my) * inset]);
    return { id: w.id, points, centre: [mx, my] };
  });
}

/* ---------- full dashboard: actions, radiation, series, reasons ---------- */


export const CORE_FIELDS = ["heartRate", "bloodPressure", "temperature", "bloodOxygen", "sleepHours"];
export const EXERCISE_GOAL_MIN = 90; // NASA: 1.5 hours per day (docs/SOURCES.md)

/** "What to do now": measuring steps only, never medical advice. */
export function actionsFor(entry) {
  const out = [];
  for (const f of FIELDS) {
    if (entry?.[f.key]?.flag === "again") {
      out.push({ tone: "again", title: `Measure again: ${f.label.toLowerCase()}`, text: `It changed a lot since your last reading. ${f.how ?? ""}`.trim() });
    }
  }
  const missing = CORE_FIELDS.filter((k) => entry?.[k]?.value == null).map((k) => fieldByKey(k).label.toLowerCase());
  if (missing.length) out.push({ tone: "none", title: "Not measured yet", text: `${missing.join(", ")}.` });
  const ex = entry?.exerciseMinutes?.value ?? 0;
  if (ex < EXERCISE_GOAL_MIN) out.push({ tone: "none", title: "Exercise", text: `${EXERCISE_GOAL_MIN - ex} min left to reach NASA's 1.5 hours today.` });
  return out;
}

/** Dosimeter totals from the log, up to and including a day. */
export function radiationTotals(log, day) {
  let total = 0;
  let days = 0;
  for (const d of Object.keys(log ?? {})) {
    const v = log[d]?.radiationDose?.value;
    if (d <= day && v != null) { total += v; days += 1; }
  }
  return { today: log?.[day]?.radiationDose?.value ?? null, total: Number(total.toFixed(2)), days };
}

/** Values of one reading for the n days ending on a day (null where not measured). */
export function series(log, key, day, n = 14) {
  const [y, m, d] = day.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const dt = new Date(y, m - 1, d - (n - 1 - i));
    const k = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const v = log?.[k]?.[key]?.value;
    if (v == null) return null;
    return Array.isArray(v) ? v[0] : v;
  });
}

/** SVG path for a sparkline; gaps where a day was not measured. */
export function sparkPath(values, w = 120, h = 32) {
  const nums = values.filter((v) => v != null);
  if (nums.length === 0) return "";
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v == null) { pen = false; return; }
    const x = (i * step).toFixed(1);
    const y = (h - 3 - ((v - lo) / span) * (h - 6)).toFixed(1);
    d += `${pen ? "L" : "M"}${x} ${y} `;
    pen = true;
  });
  return d.trim();
}

/** One line explaining a reading's status. */
export function reasonFor(key, reading) {
  if (reading?.value == null) return "Not measured on this day.";
  if (reading.flag === "again") return "Changed a lot since the last reading (app rule). Check the device and measure again.";
  if (key === "exerciseMinutes") return (reading.value >= EXERCISE_GOAL_MIN) ? "NASA's 1.5 hours reached." : `${EXERCISE_GOAL_MIN - reading.value} min short of NASA's 1.5 hours.`;
  if (key === "mood") return "Self-reported on a 1–5 scale.";
  if (key === "radiationDose") return "Dosimeter reading. Typical on the ISS: about 0.5 mSv per day.";
  const b = bandFor(key, reading);
  return b ? `${b.band} · ${b.source} (Earth reference, pending team review).` : "Pending check: no approved official range yet.";
}
