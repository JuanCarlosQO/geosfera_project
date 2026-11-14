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
export const SEVERITY = ["act", "again", "watch", "pending", "normal", "none"];

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
  return { title: `${measured} of ${total} measured today, Commander.`, line: "Ranges are pending an approved official source, so readings are not judged yet." };
}

function names(wins) {
  const n = wins.map((w) => w.label);
  return n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} and ${n.at(-1)}`;
}

/** Mission day counted from the first day the crew member used Geosfera (day 1). */
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
