// Crew avatars: full-body game-style characters in assets/avatars (made for the demo with AI,
// see docs/AI_USE.md), drawn in the same pose and framing as the body picture so the health
// screens can show them. Round pictures show the head and shoulders of the same file. Until
// those files exist, or with none chosen, the avatar is the crew member's initials.

import { photoFor } from "./anatomy.js";

export const AVATARS = [
  { id: "f1", body: "f" }, { id: "f2", body: "f" }, { id: "f3", body: "f" },
  { id: "m1", body: "m" }, { id: "m2", body: "m" }, { id: "m3", body: "m" }
];
export const avatarSrc = (id) => (AVATARS.some((a) => a.id === id) ? `assets/avatars/${id}.webp` : null);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const initials = (name) => esc(String(name ?? "").split(" ").map((w) => w[0]).slice(0, 2).join(""));

/** The crew member's picture, falling back to initials if the image is missing. */
export function avatarHtml(member, cls = "") {
  const src = avatarSrc(member?.avatar);
  const ini = `<span class="av-ini">${initials(member?.name)}</span>`;
  return `<span class="av ${cls}" data-body="${member?.body ?? ""}" aria-hidden="true">${ini}${src ? `<img class="av-full" src="${src}" alt="" decoding="async" onerror="this.remove()">` : ""}</span>`;
}

/** A whole avatar, for the picker. */
export const avatarFull = (id) => `<img src="${avatarSrc(id)}" alt="" decoding="async">`;

/** The small full-body figure for crew cards: the woman's or the man's picture. */
export const bodyThumb = (member) => { const p = photoFor(member); return `<img class="cc-photo" src="${p.src}" alt="" decoding="async"${p.fallback ? ` onerror="this.onerror=null;this.src='${p.fallback}'"` : ""}>`; };
