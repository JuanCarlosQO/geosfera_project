// In-app sources page (#sources): every document behind a fact the app shows, grouped,
// with the modules that use it and its exact quotes. Built from the app's own data
// (sources-core.js), so it always matches what the screens show. Opened from the masthead.

import * as S from "./sources-core.js";

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const host = (url) => new URL(url).hostname.replace(/^www\./, "");

function docHtml(d) {
  return `<li class="src-doc">
    <a class="src-title" href="${d.url}" target="_blank" rel="noopener">${esc(d.title)}</a>
    <p class="src-meta"><span class="mono">${host(d.url)}</span>${d.modules.map((m) => `<a class="src-mod" href="${S.MODULES[m].href}">${S.MODULES[m].label}</a>`).join("")}</p>
    ${d.quotes.length ? `<details><summary>${d.quotes.length} exact ${d.quotes.length === 1 ? "quote" : "quotes"} used in the app</summary><ul class="src-quotes">${d.quotes.map((q) => `<li>“${esc(q)}”</li>`).join("")}</ul></details>` : `<p class="fine">Numbers only (reference range); the wording is not reproduced.</p>`}
  </li>`;
}

function groupsHtml(groups) {
  if (!groups.length) return `<p class="fine">No source matches that search.</p>`;
  return groups.map((g) => `<section class="src-group" aria-labelledby="sg-${g.id}">
    <h2 id="sg-${g.id}">${g.title} <span class="src-count">${g.docs.length}</span></h2>
    ${g.note ? `<p class="fine">${g.note}</p>` : ""}
    <ul class="src-list">${g.docs.map(docHtml).join("")}</ul>
  </section>`).join("");
}

export function mountSources(root) {
  const all = S.documents();
  const total = all.reduce((n, g) => n + g.docs.length, 0);
  const quotes = all.reduce((n, g) => n + g.docs.reduce((m, d) => m + d.quotes.length, 0), 0);

  root.innerHTML = `
  <section class="sources" aria-labelledby="src-title">
    <p class="eyebrow">Sources</p>
    <h1 id="src-title" tabindex="-1">Where every fact comes from</h1>
    <p class="lede">Ergosphere shows no number without a source. These are the ${total} documents behind the app's ${quotes} exact quotes, with the screens that use them. Tap a title to open the original.</p>

    <div class="src-legend">
      <p><strong>Exact quote</strong> NASA's or the agency's own words, linked.</p>
      <p><strong>Earth reference</strong> Clinical ranges and drug labels, used where NASA publishes no number.</p>
      <p><strong>Simulated</strong> Crew and cabin values in Live and the demo data are not real crew data, and say so.</p>
      <p><strong>App rule</strong> A choice of the app (for example a reminder after 60 minutes still), labelled where it appears.</p>
    </div>

    <label class="src-search"><span class="sr-only">Search the sources</span><input type="search" placeholder="Search a source or a word, e.g. CO2, bone, sleep" data-ref="q" autocomplete="off"></label>

    <section class="src-group" aria-labelledby="sg-data">
      <h2 id="sg-data">Real NASA data <span class="src-count">${S.DATA_SOURCES.length}</span></h2>
      <ul class="src-list">${S.DATA_SOURCES.map((d) => `<li class="src-doc"><a class="src-title" href="${d.url}" target="_blank" rel="noopener">${esc(d.title)}</a><p class="src-meta"><span class="mono">${host(d.url)}</span><a class="src-mod" href="${S.MODULES[d.module].href}">${S.MODULES[d.module].label}</a></p><p class="fine">${esc(d.what)}</p></li>`).join("")}</ul>
    </section>

    <div data-ref="groups">${groupsHtml(all)}</div>

    <p class="fine rule-note">The full list, with every quote, is also in the project's repository: docs/SOURCES.md. Ergosphere is not a medical device and does not diagnose or prescribe.</p>
  </section>`;

  const box = root.querySelector('[data-ref="groups"]');
  root.querySelector('[data-ref="q"]').addEventListener("input", (e) => { box.innerHTML = groupsHtml(S.filterGroups(all, e.target.value)); });
}
