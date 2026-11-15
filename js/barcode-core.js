// Reads the barcode on a medication box (EAN-13 / UPC-A, the one on US packages) from a photo.
// Pure functions, no DOM, no library: the photo is turned to grey levels by the page and handed
// here. The browser's own BarcodeDetector is used first where it exists (Chrome on Android and
// Mac); this reader covers the rest, Safari included. Only the number leaves the device, to look
// the label up in openFDA; the photo never does.

// widths of the four runs of each digit (space, bar, space, bar for the left side's "L" set;
// the right side's "R" set has the same widths starting with a bar; "G" is L reversed)
const L = ["3211", "2221", "2122", "1411", "1132", "1231", "1114", "1312", "1213", "3112"].map((p) => [...p].map(Number));
const G = L.map((p) => [...p].reverse());
// which of the six left digits use G, by the first (13th) digit
const FIRST = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
const RUNS = 3 + 24 + 5 + 24 + 3; // guards and digits: 59 runs of alternating bars and spaces

/** The check digit rule of EAN-13 (and UPC-A with a leading 0). */
export function validEan(code) {
  if (!/^\d{13}$/.test(code)) return false;
  const d = [...code].map(Number);
  const sum = d.slice(0, 12).reduce((s, v, i) => s + v * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === d[12];
}

function digitOf(widths, sets) {
  const total = widths.reduce((a, b) => a + b, 0);
  const scaled = widths.map((w) => (w * 7) / total);
  let best = null;
  for (const [set, table] of sets) table.forEach((p, n) => {
    const err = p.reduce((s, v, i) => s + Math.abs(v - scaled[i]), 0);
    if (!best || err < best.err) best = { n, set, err };
  });
  return best && best.err < 1.7 ? best : null;
}

/** Runs of light and dark along one line of grey levels: [{ dark, len }]. */
export function runsOf(line) {
  let lo = 255, hi = 0;
  for (const v of line) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (hi - lo < 40) return [];
  const t = (lo + hi) / 2;
  const runs = [];
  for (const v of line) {
    const dark = v < t;
    const last = runs[runs.length - 1];
    if (last && last.dark === dark) last.len += 1; else runs.push({ dark, len: 1 });
  }
  return runs;
}

/** Tries every place along one line where a barcode could start. Returns the 13 digits or null. */
export function decodeLine(line) {
  const runs = runsOf(line);
  for (let i = 0; i + RUNS <= runs.length; i += 1) {
    if (!runs[i].dark) continue;
    const r = runs.slice(i, i + RUNS).map((x) => x.len);
    const unit = r.reduce((a, b) => a + b, 0) / 95;
    const guard = (k) => r.slice(k, k + 3).every((w) => w > unit * 0.4 && w < unit * 1.8);
    if (!guard(0) || !guard(RUNS - 3)) continue;
    const mid = r.slice(27, 32);
    if (!mid.every((w) => w > unit * 0.4 && w < unit * 1.8)) continue;
    const left = [], parity = [];
    for (let k = 0; k < 6; k += 1) {
      const d = digitOf(r.slice(3 + k * 4, 7 + k * 4), [["L", L], ["G", G]]);
      if (!d) break;
      left.push(d.n); parity.push(d.set);
    }
    if (left.length < 6) continue;
    const right = [];
    for (let k = 0; k < 6; k += 1) {
      const d = digitOf(r.slice(32 + k * 4, 36 + k * 4), [["R", L]]);
      if (!d) break;
      right.push(d.n);
    }
    if (right.length < 6) continue;
    const first = FIRST.indexOf(parity.join(""));
    if (first < 0) continue;
    const code = `${first}${left.join("")}${right.join("")}`;
    if (validEan(code)) return code;
  }
  return null;
}

/**
 * Looks for a barcode in a photo given as grey levels (one byte a pixel, row by row): along
 * rows across the middle, both ways (a box held upside down), then along columns (held sideways).
 * Returns the 13 digits or null.
 */
export function decodeGray(gray, width, height) {
  const votes = new Map();
  const tryLine = (line) => {
    const code = decodeLine(line) ?? decodeLine(line.slice().reverse());
    if (code) votes.set(code, (votes.get(code) ?? 0) + 1);
  };
  for (let k = 1; k < 40; k += 1) {
    const y = Math.round((height * k) / 40);
    tryLine(gray.subarray(y * width, y * width + width));
  }
  if (!votes.size) for (let k = 1; k < 40; k += 1) {
    const x = Math.round((width * k) / 40);
    const col = new Uint8Array(height);
    for (let y = 0; y < height; y += 1) col[y] = gray[y * width + x];
    tryLine(col);
  }
  let best = null;
  for (const [code, n] of votes) if (!best || n > best.n) best = { code, n };
  return best?.code ?? null;
}

/** The forms openFDA may list a box's barcode under: 13 digits, with the leading 0 for UPC-A. */
export function upcForms(raw) {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 12) return [`0${d}`, d];
  if (d.length === 13) return d.startsWith("0") ? [d, d.slice(1)] : [d];
  return d.length >= 8 ? [d] : [];
}

/**
 * The kit medication whose active ingredient the label names, or why not:
 * { med, names } / { med: null, why }. A box with two or more active ingredients is never matched
 * to a single one: the crew member chooses.
 */
export function medFromLabel(openfda, meds) {
  const subs = (openfda?.substance_name ?? openfda?.generic_name ?? []).flatMap((s) => String(s).toLowerCase().split(/,|\band\b/)).map((s) => s.trim()).filter(Boolean);
  const names = [...(openfda?.brand_name ?? []), ...(openfda?.generic_name ?? [])].slice(0, 2).join(" · ");
  if (!subs.length) return { med: null, names, why: "The label does not list an active ingredient." };
  if (subs.length > 1) return { med: null, names, why: "This box has more than one active ingredient: choose what you took." };
  const hit = meds.find((m) => !m.own && m.ingredient && subs[0].includes(m.ingredient.toLowerCase()));
  return hit ? { med: hit, names } : { med: null, names, why: "It is not one of the medications on the station's kit list." };
}
