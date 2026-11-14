// Day-theme dashboard rules, with no DOM so Node can test them: the area charts, the
// check-in gauge and the "today's readings" list. Nothing here judges health: the gauge
// counts how much of today's check-in is logged, and readings keep the app's own statuses.

import { FIELDS } from "./log-core.js";

/**
 * Line and area paths for the days that have a value (gaps are bridged with a straight
 * line and the caller says so). Returns null with fewer than two readings.
 */
export function areaChart(values, w = 320, h = 130, pad = 12) {
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (pts.length < 2) return null;
  const nums = pts.map(([, v]) => v);
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  const step = w / (values.length - 1);
  const top = pad;
  const bottom = h * 0.62; // the line lives in the upper part; the fade fills the rest
  const xy = pts.map(([i, v]) => [Number((i * step).toFixed(1)), Number((bottom - ((v - lo) / span) * (bottom - top)).toFixed(1))]);
  const line = xy.map(([x, y], n) => `${n ? "L" : "M"}${x} ${y}`).join(" ");
  const area = `${line} L${xy.at(-1)[0]} ${h} L${xy[0][0]} ${h} Z`;
  return { line, area, last: xy.at(-1), min: lo, max: hi, points: pts.length, gaps: pts.length < values.length };
}

/** How much of today's check-in is in: { filled, total, fraction, percent }. */
export function completion(entry) {
  const filled = FIELDS.filter((f) => entry?.[f.key]?.value != null).length;
  return { filled, total: FIELDS.length, fraction: filled / FIELDS.length, percent: Math.round((filled / FIELDS.length) * 100) };
}

/** Half-circle gauge: the full track and the filled part, as SVG arcs from left to right. */
export function gaugeArc(fraction, cx = 120, cy = 120, r = 96) {
  const f = Math.max(0, Math.min(1, fraction));
  const at = (t) => { const a = Math.PI * (1 - t); return [Number((cx + r * Math.cos(a)).toFixed(2)), Number((cy - r * Math.sin(a)).toFixed(2))]; };
  const [x0, y0] = at(0);
  const [x1, y1] = at(1);
  const [xf, yf] = at(f);
  return { track: `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`, fill: f === 0 ? "" : `M${x0} ${y0} A${r} ${r} 0 0 1 ${xf} ${yf}` };
}

const show = (v) => (Array.isArray(v) ? `${v[0]}/${v[1]}` : String(v));

/** Rows for the readings list: every field except the two that have their own chart. */
export function readingList(entry, judge, charted = ["bloodPressure", "heartRate"]) {
  return FIELDS.filter((f) => !charted.includes(f.key)).map((f) => {
    const r = entry?.[f.key];
    const has = r?.value != null;
    return {
      key: f.key,
      label: f.key === "mood" ? "Mood" : f.label,
      value: has ? (f.scale ? `${r.value} · ${f.scale[r.value - 1]}` : show(r.value)) : "—",
      unit: has ? (f.scale ? "of 5" : f.unit) : "",
      status: has ? judge(f.key, r) : "none"
    };
  });
}
