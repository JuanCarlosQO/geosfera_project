// Spanish look for the same app — the rules, with no DOM so Node can test them.
// The app is written in English. In Spanish, each piece of text on screen is looked up in a
// dictionary (js/data/es.js) and swapped; what is not in the dictionary stays in English.
// Quoted sources are never in the dictionary: a quote is shown word for word, in its language.
//
// Numbers do not belong to the wording, so they are taken out before the lookup:
//   "Mission day 14"  ->  key "Mission day #"  ->  "Día de misión #"  ->  "Día de misión 14"
// A translation may reorder them with #1, #2…

const NUM = /\d+(?:[.,:/-]\d+)*/g;

export const squash = (text) => String(text ?? "").replace(/\s+/g, " ").trim();

/** The dictionary key of a text and the numbers taken out of it, in order. */
export function keyOf(text) {
  const nums = [];
  const key = squash(text).replace(NUM, (n) => { nums.push(n); return "#"; });
  return { key, nums };
}

const fill = (template, nums) => { let i = 0; return template.replace(/#(\d)?/g, (_, n) => nums[n ? Number(n) - 1 : i++] ?? ""); };

/**
 * The text in Spanish, or null when the dictionary does not have it (it then stays as it is).
 * `rules` are [RegExp, (match, t) => string] for sentences built around a name or a date;
 * `t` translates a fragment and returns it unchanged when unknown.
 */
export function translate(text, dict, rules = []) {
  const flat = squash(text);
  if (!flat || !/[A-Za-z]/.test(flat)) return null;
  const { key, nums } = keyOf(flat);
  let out = Object.hasOwn(dict, key) ? fill(dict[key], nums) : null;
  if (out == null) {
    const t = (part) => translate(part, dict, rules) ?? part;
    for (const [re, to] of rules) {
      const m = flat.match(re);
      if (m) { out = to(m, t); break; }
    }
    // "Melatonin · 1 tablet · sleep": each part on its own
    if (out == null && flat.includes(" · ")) {
      const parts = flat.split(" · ");
      const es = parts.map(t);
      if (es.some((x, i) => x !== parts[i])) out = es.join(" · ");
    }
  }
  if (out == null || out === flat) return null;
  // the spaces at the edges separate this text from the inline elements beside it
  return `${/^\s/.test(text) ? " " : ""}${out}${/\s$/.test(text) ? " " : ""}`;
}

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Rules from templates: a key holds {tokens} for the parts that change (a name, a date, a
 * medication) and # for numbers. Each token's text is translated on its own (so "headache"
 * becomes Spanish and a medication's name stays as it is); numbers go back where # is.
 *   { "Last {m} in your log": "Último registro de {m}" }
 */
export function templateRules(templates) {
  const rules = [];
  for (const [key, value] of Object.entries(templates)) {
    const parts = [];
    const re = new RegExp(`^${esc(key).replace(/\\\{(\w+)\\\}|#/g, (m, name) => { parts.push(name ?? "#"); return name ? "(.+?)" : "(\\d+(?:[.,:/-]\\d+)*)"; })}$`);
    rules.push([re, (m, t) => {
      const got = {}; const nums = [];
      parts.forEach((p, i) => { if (p === "#") nums.push(m[i + 1]); else got[p] ??= m[i + 1]; });
      let n = 0;
      return value.replace(/\{(\w+)\}|#(\d)?/g, (x, name, k) => (name ? t(got[name] ?? "") : nums[k ? Number(k) - 1 : n++] ?? ""));
    }]);
  }
  // longest keys first, so a specific sentence wins over a looser one
  return rules.sort((a, b) => b[0].source.length - a[0].source.length);
}

/** Problems in a dictionary: a number that would be lost, invented or left as a digit. */
export function checkDictionary(dict) {
  const bad = [];
  for (const [key, value] of Object.entries(dict)) {
    const want = (key.match(/#/g) ?? []).length;
    const marks = [...value.matchAll(/#(\d)?/g)];
    const indexed = marks.filter((m) => m[1]);
    if (keyOf(key).nums.length) bad.push(`digits in key: ${key}`);
    if (/\d/.test(value.replace(/#\d/g, ""))) bad.push(`digits in value: ${key}`);
    if (indexed.length ? indexed.length !== marks.length || marks.length !== want || new Set(indexed.map((m) => m[1])).size !== want || indexed.some((m) => Number(m[1]) < 1 || Number(m[1]) > want) : marks.length !== want) bad.push(`numbers do not match: ${key}`);
    if (!value.trim()) bad.push(`empty: ${key}`);
  }
  return bad;
}
