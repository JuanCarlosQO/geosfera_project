// The family's own page (family.html#<invite>): only the message form, none of the app.
// The invite after # comes from the crew member's "Copy my family's link"; it says who the
// message is for and where their mailbox is, so the family types no name and has no account.

import { readInvite } from "./mailbox-core.js";
import { mountWrite } from "./family.js";
import { initFold } from "./fold.js";
import { initI18n } from "./i18n.js";

initI18n();

const host = document.getElementById("station");
const invite = readInvite(location.hash.replace(/^#/, ""));

if (invite) {
  document.title = `Write to ${invite.name} · Ergosphere`;
  mountWrite(host, { invite });
} else {
  host.innerHTML = `<section class="family family-page"><p class="eyebrow">Ergosphere · Family channel</p>
    <h1 tabindex="-1">This link is not complete</h1>
    <p class="lede keep">Ask your crew member to copy their family link again and send you the whole of it. The link is long: some apps cut it.</p></section>`;
}
initFold(host);
host.querySelector("h1")?.focus({ preventScroll: true });
