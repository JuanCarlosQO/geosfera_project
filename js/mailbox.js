// Family mailbox, browser side: drops a message into a crew member's mailbox on the sync
// server (the family's page) and empties it (the crew member's device). Rules: mailbox-core.js.
// It talks to the same /api/sync the station sync uses, with the mailbox's own id and keys,
// so nothing was added to the server. Where there is no sync server (a static host such as
// GitHub Pages) every call answers "none" and the screens fall back to a link to send.

import * as B from "./mailbox-core.js";
import { seal, open } from "./sync-core.js";

const API = "api/sync";
const TRIES = 4;

async function call(method, box, body) {
  try {
    const r = await fetch(`${API}?station=${encodeURIComponent(box.id)}`, {
      method, headers: { Authorization: `Bearer ${box.token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined, cache: "no-store"
    });
    let data = null;
    try { data = await r.json(); } catch { /* not the sync server's JSON */ }
    return { status: r.status, data, server: B.fromServer(r.status, data) };
  } catch { return { status: 0, data: null, server: false }; }
}

/** Reads what waits in a mailbox. -> { state: "ok" | "none" | "error", messages, version } */
async function peek(box) {
  const got = await call("GET", box);
  if (!got.server) return { state: "none", messages: [], version: 0 };
  if (got.status === 404) return { state: "ok", messages: [], version: 0 };
  if (got.status !== 200) return { state: "error", messages: [], version: 0 };
  const content = await open(got.data.blob, box.key);
  return { state: content ? "ok" : "error", messages: B.cleanBag(content), version: got.data.version };
}

/** The family's side. -> "sent" | "none" (no server here) | "full" | "error" */
export async function drop(box, message) {
  for (let i = 0; i < TRIES; i += 1) {
    const now = await peek(box);
    if (now.state !== "ok") return now.state;
    const put = await call("PUT", box, { blob: await seal(B.bag(B.addToBag(now.messages, message)), box.key), baseVersion: now.version });
    if (put.status === 200) return "sent";
    if (put.status === 413) return "full";
    if (put.status !== 409) return put.server ? "error" : "none";
  }
  return "error";
}

/** The crew member's side: takes what waits and leaves the mailbox empty. -> { state, messages } */
export async function collect(box) {
  const now = await peek(box);
  if (now.state !== "ok" || !now.messages.length) return { state: now.state, messages: [] };
  const put = await call("PUT", box, { blob: await seal(B.bag([]), box.key), baseVersion: now.version });
  // if someone wrote in between, leave it: the next round takes everything again and the inbox ignores repeats
  return { state: "ok", messages: now.messages, emptied: put.status === 200 };
}

const readAll = () => { try { return B.cleanMailboxes(JSON.parse(localStorage.getItem(B.MAILBOX_KEY))); } catch { return {}; } };

/** This crew member's mailbox on this device, made the first time it is asked for. */
export function mailboxFor(memberId) {
  const all = readAll();
  if (!all[memberId]) {
    all[memberId] = B.newMailbox();
    try { localStorage.setItem(B.MAILBOX_KEY, JSON.stringify(all)); } catch { /* storage blocked: the link still works for this visit */ }
  }
  return all[memberId];
}
export const existingMailbox = (memberId) => readAll()[memberId] ?? null;

/** The one link a crew member gives their family. */
export const familyLink = (member) => `${new URL("family.html", location.href).href.split("#")[0]}#${B.makeInvite({ memberId: member.id, name: member.name }, mailboxFor(member.id))}`;
