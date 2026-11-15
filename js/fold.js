// Less text on screen, nothing lost. Three tools every screen shares:
//  - fold(label, html): a closed "tap to read" block for explanations and side notes;
//  - tabsHtml(name, tabs): one long screen split into tabs, so a phone shows one part at a time;
//  - tidy(root): runs after every render and tucks away what is not needed to use the screen:
//    the intro and the closing note go into "About this screen" under the title, and every
//    quoted source goes into a "Source" block beside the thing it supports.
// The words are all still there, one tap away, and screen readers reach them the same way.

export const fold = (label, html, { open = false, cls = "" } = {}) =>
  `<details class="fold${cls ? ` ${cls}` : ""}"${open ? " open" : ""}><summary>${label}</summary><div class="fold-in">${html}</div></details>`;

const TAB_KEY = (name) => `ergosphere.tab.${name}`;
const recall = (name) => { try { return sessionStorage.getItem(TAB_KEY(name)); } catch { return null; } };
const remember = (name, id) => { try { sessionStorage.setItem(TAB_KEY(name), id); } catch { /* storage blocked */ } };

/** tabs: [{ id, label, html, badge }]. The last tab opened on a screen is remembered for the session. */
export function tabsHtml(name, tabs, first) {
  const saved = recall(name);
  const active = tabs.some((t) => t.id === saved) ? saved : first ?? tabs[0].id;
  return `<div class="tabs" data-tabs="${name}">
    <div class="tab-row" role="tablist">${tabs.map((t) => `<button type="button" role="tab" class="tab" id="tab-${name}-${t.id}" data-tab="${t.id}" aria-selected="${t.id === active}" aria-controls="panel-${name}-${t.id}" tabindex="${t.id === active ? 0 : -1}">${t.label}${t.badge ? `<span class="tab-badge">${t.badge}</span>` : ""}</button>`).join("")}</div>
    ${tabs.map((t) => `<div class="tab-panel" role="tabpanel" id="panel-${name}-${t.id}" data-panel="${t.id}" aria-labelledby="tab-${name}-${t.id}"${t.id === active ? "" : " hidden"}>${t.html}</div>`).join("")}
  </div>`;
}

/** Opens one tab of a tab set (used by links such as "add one of your own"). */
export function showTab(root, name, id) {
  const box = root.querySelector(`[data-tabs="${name}"]`);
  if (!box || !box.querySelector(`:scope > .tab-row > [data-tab="${id}"]`)) return;
  for (const b of box.querySelectorAll(":scope > .tab-row > .tab")) {
    const on = b.dataset.tab === id;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  }
  for (const p of box.querySelectorAll(":scope > .tab-panel")) p.hidden = p.dataset.panel !== id;
  remember(name, id);
  box.dispatchEvent(new CustomEvent("ergosphere:tab", { bubbles: true, detail: { name, id } }));
}

function wrap(nodes, label, cls) {
  const d = document.createElement("details");
  d.className = `fold ${cls}`;
  const s = document.createElement("summary");
  s.textContent = label;
  const inner = document.createElement("div");
  inner.className = "fold-in";
  nodes[0].before(d);
  inner.append(...nodes);
  d.append(s, inner);
  return d;
}

/** Safe to run again and again: what is already tucked away is left alone. */
export function tidy(root) {
  for (const section of root.querySelectorAll(":scope > section")) {
    const parts = [...section.querySelectorAll(":scope > .lede:not(.keep), :scope > header .lede:not(.keep), :scope > .rule-note")];
    if (!parts.length) continue;
    let about = section.querySelector(":scope > .about-fold");
    if (!about) {
      about = wrap([parts[0]], "About this screen", "about-fold");
      const h1 = section.querySelector(":scope > h1");
      if (h1) h1.after(about); else section.append(about); // no title of its own: the note goes to the end
    }
    about.querySelector(".fold-in").append(...parts);
  }
  for (const s of root.querySelectorAll("small.src, p.source")) {
    if (s.closest(".fold")) continue;
    const p = s.parentElement;
    if (s.matches("p.source")) { wrap([s], "Source", "src-fold"); continue; }
    if (p.tagName === "P") { wrap([p], "Why · source", "src-fold"); continue; } // the sentence leads into the quote: keep them together
    const group = [s];
    for (let n = s.nextSibling; n; n = n.nextSibling) {
      if (n.nodeType === 3 && !n.textContent.trim()) continue;
      if (n.nodeType === 1 && n.matches("small.src")) { group.push(n); continue; }
      break;
    }
    wrap(group, group.length > 1 ? `Sources · ${group.length}` : "Source", "src-fold");
  }
}

/** Wires the tabs and keeps `root` tidy as its screens render and repaint. */
export function initFold(root) {
  root.addEventListener("click", (e) => {
    const b = e.target.closest(".tab-row > .tab");
    if (b) showTab(root, b.closest("[data-tabs]").dataset.tabs, b.dataset.tab);
  });
  root.addEventListener("keydown", (e) => {
    const b = e.target.closest?.(".tab-row > .tab");
    if (!b || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const all = [...b.parentElement.querySelectorAll(".tab")];
    const next = all[(all.indexOf(b) + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
    showTab(root, b.closest("[data-tabs]").dataset.tabs, next.dataset.tab);
    next.focus();
  });
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; tidy(root); });
  }).observe(root, { childList: true, subtree: true });
  tidy(root);
}
