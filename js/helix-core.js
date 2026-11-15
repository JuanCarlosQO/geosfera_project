// The DNA double helix on the Radiation tab — numbers only, no DOM, so Node can test it.
// The helix is DRAWN BY CODE: two spiral strands joined by rungs. It is an illustration of
// the molecule, not anyone's DNA and not a measurement; nothing in the app measures DNA.
// Axis: y runs along the helix, from -1 to 1.

export const KINDS = ["strandA", "strandB", "rungA", "rungB"];

/** Two strands, and one rung per base pair made of two halves (the two bases). */
export function buildHelix({ turns = 2.2, pairs = 22, perPair = 6, radius = 0.42, perRung = 9 } = {}) {
  const pos = [], kind = [], rung = [];
  const offset = Math.PI; // the strands face each other, so every rung crosses the axis: the familiar twisted ladder
  const at = (t, phase) => { const a = t * turns * Math.PI * 2 + phase; return [Math.cos(a) * radius, -1 + 2 * t, Math.sin(a) * radius]; };
  const add = (p, k, r) => { pos.push(p[0], p[1], p[2]); kind.push(k); rung.push(r); };
  const steps = pairs * perPair;
  for (let i = 0; i <= steps; i++) { const t = i / steps; add(at(t, 0), 0, -1); add(at(t, offset), 1, -1); }
  for (let r = 0; r < pairs; r++) {
    const t = (r + 0.5) / pairs;
    const a = at(t, 0), b = at(t, offset);
    for (let j = 1; j < perRung; j++) { const k = j / perRung; add([a[0] + (b[0] - a[0]) * k, a[1], a[2] + (b[2] - a[2]) * k], k < 0.5 ? 2 : 3, r); }
  }
  return { n: kind.length, pairs, pos: Float32Array.from(pos), kind: Uint8Array.from(kind), rung: Int16Array.from(rung) };
}

export const RULES = {
  tracksUsual: 0.5,   // streaks a second drawn at the usual dose rate (a drawing choice, not a count of particles)
  tracksMin: 0.12,
  tracksMax: 9
};

/**
 * How many particle streaks a second the drawing shows: in step with the live dose rate
 * compared with its usual value, within limits that keep the picture readable.
 */
export function tracksPerSecond(rate, usual) {
  if (rate == null || !(usual > 0) || !(rate >= 0)) return 0;
  return Math.max(RULES.tracksMin, Math.min(RULES.tracksMax, RULES.tracksUsual * (rate / usual)));
}

/** "1.4× the usual", "about the usual", "38× the usual". */
export function versusUsual(rate, usual) {
  if (rate == null || !(usual > 0)) return "";
  const k = rate / usual;
  if (k >= 0.8 && k <= 1.25) return "about the usual";
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}× the usual`;
}
