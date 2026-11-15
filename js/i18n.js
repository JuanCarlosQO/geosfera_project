// Spanish look — the part that touches the page. One button in the top bar switches the
// whole app between English (as written) and Spanish (dictionary, js/data/es.js, loaded only
// when asked for). Every text that appears later (a new screen, a live reading, an alert) is
// translated as it arrives. Rules: i18n-core.js.

import { translate } from "./i18n-core.js";

export const LANG_KEY = "geosfera.lang";
// Never translated: quoted sources (shown word for word), code, and what people typed.
export const SKIP = "script, style, noscript, code, pre, textarea, small.src, p.source, q, blockquote, [data-no-i18n]";
export const ATTRS = ["aria-label", "placeholder", "title", "alt"];

export function savedLang() {
  try { return localStorage.getItem(LANG_KEY) === "es" ? "es" : "en"; } catch { return "en"; }
}

/** Calls onText(node) and onAttr(element, name) for everything on the page that carries words. */
export function walk(root, onText, onAttr) {
  if (root.nodeType === 3) { if (!root.parentElement?.closest(SKIP)) onText(root); return; }
  if (root.nodeType !== 1 || root.closest(SKIP)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
  });
  for (let n = root; n; n = tw.nextNode()) {
    if (n.nodeType === 3) onText(n);
    else for (const a of ATTRS) if (n.hasAttribute(a)) onAttr(n, a);
  }
}

let dict = null, rules = [];

function textToSpanish(node) {
  const es = translate(node.nodeValue, dict, rules);
  if (es != null && es !== node.nodeValue) node.nodeValue = es;
}
function attrToSpanish(el, name) {
  const es = translate(el.getAttribute(name), dict, rules);
  if (es != null && es !== el.getAttribute(name)) el.setAttribute(name, es.trim());
}

function watch() {
  walk(document.documentElement, textToSpanish, attrToSpanish);
  const title = translate(document.title, dict, rules);
  if (title) document.title = title.trim();
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") walk(m.target, textToSpanish, attrToSpanish);
      else if (m.type === "attributes") { if (!m.target.closest(SKIP)) attrToSpanish(m.target, m.attributeName); }
      else for (const n of m.addedNodes) walk(n, textToSpanish, attrToSpanish);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

function paintButtons(lang) {
  for (const b of document.querySelectorAll('[data-action="lang"]')) {
    b.textContent = lang === "es" ? "EN" : "ES";
    b.setAttribute("aria-label", lang === "es" ? "Switch to English" : "Cambiar a español");
    b.setAttribute("title", lang === "es" ? "English" : "Español");
    b.dataset.noI18n = "";
  }
}

/** Starts in the saved language and wires every [data-action="lang"] button. */
export async function initI18n() {
  const lang = savedLang();
  document.documentElement.lang = lang;
  paintButtons(lang);
  document.addEventListener("click", (e) => {
    if (!e.target.closest('[data-action="lang"]')) return;
    try { localStorage.setItem(LANG_KEY, lang === "es" ? "en" : "es"); } catch { return; } // storage blocked: the app stays in English
    location.reload();
  });
  if (lang !== "es") return;
  try {
    const es = await import("./data/es.js");
    dict = es.ES;
    rules = es.ES_RULES ?? [];
    watch();
  } catch { document.documentElement.lang = "en"; /* dictionary did not load: English stays */ }
}
