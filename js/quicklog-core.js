// Quick log — reads one typed or spoken sentence ("two ibuprofen for back pain") into a
// draft entry for the medication log. Pure functions, no DOM.
//
// It only finds words that were said. It never picks a medication from a symptom, never
// turns milligrams into a number of tablets and never fills in an amount on its own: what
// it could not read stays empty and the crew member completes it before anything is logged.

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: null,
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, media: null, medio: null
};
const UNIT_WORDS = ["tablet", "tablets", "tab", "tabs", "pill", "pills", "capsule", "capsules", "caplet", "caplets", "dose", "doses", "spray", "sprays", "drop", "drops", "patch", "patches", "application", "applications",
  "tableta", "tabletas", "pastilla", "pastillas", "capsula", "capsulas", "dosis", "gota", "gotas", "parche", "parches", "aplicacion", "aplicaciones"];
const TOOK_WORDS = ["took", "take", "taken", "log", "logged", "had", "used", "tome", "tomado", "registrar", "registra", "use"];
const STRENGTH = /(\d+(?:[.,]\d+)?)\s?(mg|milligrams?|miligramos?|mcg|micrograms?|microgramos?|g|grams?|gramos?|ml|millilit(?:er|re)s?|mililitros?|%|percent|por ciento)(?=\s)/;

export const MAX_SAID = 140;
export const MAX_UNITS = 12;

/** Lower case, no accents, punctuation to spaces (decimal points and % stay). */
export function norm(text) {
  return String(text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.,%]+/g, " ").replace(/[.,](?!\d)/g, " ").replace(/\s+/g, " ").trim();
}

/** Every way one medication can be said: its name, its first word, its ingredient, other names. */
export function namesOf(med, otherNames = {}) {
  const name = norm(med.name);
  const out = new Set([name, ...(otherNames[med.id] ?? []).map(norm)]);
  if (!med.own) { out.add(name.split(" ")[0]); if (med.ingredient) out.add(norm(med.ingredient)); }
  return [...out].filter((n) => n.length >= 3);
}

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

const has = (padded, phrase) => padded.includes(` ${phrase} `);

/**
 * How a word sounds, so a misheard medication still matches: Spanish and English spellings of
 * the same sound become one (c/k/qu, z/s/ce/ci, v/b, ph/f, th/t, y/ll/i, silent h, doubled letters).
 * "prometacina" and "promethazine" both become "prometasin".
 */
export function phon(word) {
  return norm(word).replace(/\s+/g, "")
    .replace(/ph/g, "f").replace(/th/g, "t").replace(/ch/g, "x").replace(/sh/g, "x")
    .replace(/qu/g, "k").replace(/c(?=[ei])/g, "s").replace(/c/g, "k").replace(/z/g, "s").replace(/x(?![aeiou])/g, "ks")
    .replace(/v/g, "b").replace(/ll/g, "y").replace(/y(?=[^aeiou]|$)/g, "i").replace(/h/g, "").replace(/w/g, "u")
    .replace(/(.)\1+/g, "$1")
    .replace(/[aeiou]+$/, ""); // Spanish adds an end vowel the English name lacks: "ibuprofeno" ~ "ibuprofen"
}

// how far off a heard word may be and still count as a near miss, by the name's length
const allowed = (n) => (n >= 9 ? 2 : n >= 7 ? 1 : 0); // short names ("ambien", "afrin") only when they sound exactly alike: "también" is not "ambien"

function findMed(padded, tokens, meds, otherNames) {
  let best = null;
  for (const med of meds) for (const n of namesOf(med, otherNames)) if (has(padded, n) && n.length > (best?.len ?? 0)) best = { med, len: n.length, word: n, close: false };
  if (best) return best;
  // speech recognition often splits or misspells a medication ("ibu profeno", "para setamol",
  // "mela tonina"): compare how one, two or three heard words sound, joined, with how each name
  // sounds, and say it was a near miss so the crew member checks it
  const heard = [];
  for (let i = 0; i < tokens.length; i += 1) for (let k = 1; k <= 3 && i + k <= tokens.length; k += 1) {
    const words = tokens.slice(i, i + k);
    if (words.some((w) => /^\d/.test(w))) continue;
    heard.push({ word: words.join(" "), key: phon(words.join("")) });
  }
  for (const med of meds) for (const n of namesOf(med, otherNames)) {
    const key = phon(n);
    if (key.length < 4) continue;
    for (const h of heard) {
      if (Math.abs(h.key.length - key.length) > 2) continue;
      const d = h.key === key ? 0 : distance(h.key, key);
      if (d <= allowed(key.length) && (d < (best?.d ?? 9) || (d === best.d && key.length > best.len))) best = { med, len: key.length, word: h.word, close: true, d };
    }
  }
  return best;
}

/**
 * Speech recognition offers several guesses of what was said. Keeps the one that reads best:
 * a medication by name, then a near miss, then what it was for and how many. Ties keep the
 * recogniser's own order (its most confident guess first).
 */
export function bestHeard(guesses, meds, zones, otherNames = {}) {
  let best = null;
  guesses.filter(Boolean).forEach((text, i) => {
    const p = parseQuick(text, meds, zones, otherNames);
    const score = (p.med ? (p.close ? 6 - Math.min(2, findMedD(p)) : 10) : 0) + (p.zone ? 2 : 0) + (p.units ? 1 : 0) + (p.strength ? 0.5 : 0) - i * 0.01;
    if (!best || score > best.score) best = { text, parsed: p, score };
  });
  return best;
}
const findMedD = (p) => (p.close ? p.d ?? 1 : 0);

function findUnits(tokens, medWord) {
  const first = medWord?.split(" ")[0];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const n = /^\d{1,2}$/.test(t) ? Number(t) : NUMBER_WORDS[t];
    if (!Number.isInteger(n) || n < 1 || n > MAX_UNITS) continue;
    const next = tokens[i + 1], prev = tokens[i - 1];
    if (UNIT_WORDS.includes(next) || (first && next === first) || (TOOK_WORDS.includes(prev) && !["hour", "hours", "day", "days", "minute", "minutes", "week", "weeks", "hora", "horas", "dia", "dias", "minuto", "minutos", "semana", "semanas"].includes(next))) return n;
  }
  return null;
}

function findZone(padded, zones) {
  let best = null;
  for (const z of zones) for (const w of [z.reason, z.label, ...(z.words ?? [])].map(norm)) if (w && has(padded, w) && w.length > (best?.len ?? 0)) best = { zone: z, len: w.length };
  return best?.zone ?? null;
}

/**
 * { said, med, close, word, units, strength, zone }:
 *   med      the medication whose name was said (or null), `close` when it was a near miss,
 *            `word` the name as it was said ("paracetamol", "ibuprofin")
 *   units    how many were said ("two tablets", "took 2"), or null
 *   strength a strength that was said ("500 mg"), kept as words and never converted
 *   zone     the "what for" whose words were said, or null
 */
export function parseQuick(text, meds, zones, otherNames = {}) {
  const said = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SAID);
  let t = norm(said);
  const sm = ` ${t} `.match(STRENGTH);
  const strength = sm ? `${sm[1].replace(",", ".")} ${/^(percent|por ciento)$/.test(sm[2]) ? "%" : sm[2].replace(/^mill?igra(m|mo)s?$/, "mg").replace(/^microgra(m|mo)s?$/, "mcg").replace(/^gra(m|mo)s?$/, "g").replace(/^(millilit(?:er|re)s?|mililitros?)$/, "ml")}` : null;
  if (sm) t = ` ${t} `.replace(sm[0], " ").replace(/\s+/g, " ").trim();
  const tokens = t.split(" ").filter(Boolean);
  const padded = ` ${t} `;
  const found = findMed(padded, tokens, meds.filter((m) => !m.removed), otherNames);
  return {
    said,
    med: found?.med ?? null,
    close: Boolean(found?.close),
    d: found?.d ?? 0,
    word: found?.word ?? null,
    units: findUnits(tokens, found?.word),
    strength,
    zone: findZone(padded, zones)
  };
}

/** True when the strength that was said is not the strength of the kit's own unit ("500 mg" vs a 325 mg tablet). */
export function strengthDiffers(strength, med) {
  if (!strength || !med?.strength || med.own) return false;
  const a = norm(strength).replace(/\s/g, ""), b = norm(med.strength).replace(/\s/g, "");
  return a !== b;
}
