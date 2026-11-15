// Everything Mission Control knows about one crew member right now, gathered from the stores the
// rest of the app writes (daily log, morning answer, medication log, exercise, support requests,
// emergency openings) plus the analysis in predict-core.js. One function, used by the crew
// overview and by each crew member's analysis page, so both always tell the same story.

import { readLog } from "./store.js";
import { dateKey } from "./log-core.js";
import * as C from "./sleepcheck-core.js";
import * as P from "./predict-core.js";
import * as X from "./exercise-core.js";
import { exerciseStore } from "./exercise.js";
import { getAlerts } from "./support.js";
import { getOpenings } from "./role.js";
import { openingsFor, openNow, reasonLabel } from "./role-core.js";
import { MEDS_KEY, cleanStore, forMember, patterns } from "./meds-core.js";
import { KIT } from "./data/med-kit.js";
import { SUPPLEMENTS } from "./data/supplements.js";
import { REQUESTS_KEY, cleanRequests, itemLabel } from "./share-core.js";
import * as Q from "./screen-core.js";

const read = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const hhmm = (t) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
export const LEVELS = { act: 0, watch: 1, info: 2 };

export const mission = () => read("geosfera.mission", {});

/**
 * { member, log, today, sleep, answer, adherence, exToday, items: [{ level, kind, text }], level }
 * items are what to look at, most urgent first; level is the worst of them ("ok" when none).
 */
export function crewStatus(member, now = new Date()) {
  const today = dateKey(now);
  const log = readLog(member.id);
  const items = [];
  const add = (level, kind, text) => items.push({ level, kind, text });

  // what they asked for, in their own words
  for (const a of getAlerts().filter((x) => x.from?.id === member.id && !x.closed)) {
    add(a.level === "emergency" ? "act" : "watch", "request", `${a.level === "emergency" ? "SOS" : "Asked to talk to someone"} · ${hhmm(a.at)}${a.note ? ` · “${a.note}”` : ""}`);
  }
  for (const r of cleanRequests(read(REQUESTS_KEY, [])).filter((x) => x.member === member.id && x.status === "pending")) {
    add("watch", "access", `Asks to see: ${r.items.map(itemLabel).join(" · ")} · ${hhmm(r.at)}${r.reason ? ` · “${r.reason}”` : ""}`);
  }
  const op = openingsFor(getOpenings(), member.id)[0];
  if (op && openNow(op, now)) add(op.drill ? "info" : "act", "opening", `${op.drill ? "Drill: data opened with the emergency code" : "Has their own data open now"} · ${reasonLabel(op.reason)}`);
  else if (op && now - new Date(op.at) < 3 * 86400000) add("info", "opening", `Opened their own data · ${op.at.slice(5, 10)} ${hhmm(op.at)}${op.closedAt ? `–${hhmm(op.closedAt)}` : ""} · ${reasonLabel(op.reason)}`);

  // mental health check-ins (validated questionnaires, screen-core.js)
  const checkins = read(Q.CHECKINS_KEY, []);
  for (const f of Q.flags(checkins, member.id)) add(f.level, "mind", f.text);
  if (Q.due(checkins, read(Q.ASKS_KEY, []), member.id, now).due) add("info", "mind", "Check-in due: not answered yet");

  // the morning question
  const check = C.sleepCheck(log, today);
  const feel = log[today]?.feel?.value, note = log[today]?.note;
  if (feel === "very") add("watch", "answer", `Says “very tired”${note?.reasons?.length ? ` · ${note.reasons.map((id) => C.REASONS.find((r) => r.id === id)?.label).filter(Boolean).join(" · ")}` : ""}${note?.text ? ` · “${note.text}”` : ""}`);
  else if (check.ask && !feel) add("info", "answer", "Short night: the morning question is still unanswered");

  // exercise
  const ex = exerciseStore();
  const comp = X.compliance(ex, member.id, today, 7);
  const adherence = comp.sessions ? comp.doneSessions / comp.sessions : null;
  for (const e of X.recentSymptoms(ex, member.id, today, 2)) {
    if (!e.symptoms.length) continue;
    const urgent = e.symptoms.some((s) => X.TELL_NOW.includes(s));
    add(urgent ? "act" : "watch", "exercise", `After ${X.sessionLabel(e)} (${e.day.slice(5)}): ${e.symptoms.map(X.symptomLabel).join(", ")}${e.note ? ` · “${e.note}”` : ""}`);
  }

  // medication patterns the app raises
  const meds = forMember(cleanStore(read(MEDS_KEY, null), KIT, SUPPLEMENTS), member.id);
  for (const p of patterns(meds, KIT, now, log).filter((x) => x.level === "talk")) add("watch", "meds", p.text.replace(/ (NASA's kit list says|A NASA sleep-medication study says):$/, ""));

  // the readings against their own usual, and where they are heading
  for (const s of P.signals(log, today, { adherence })) add("watch", "trend", s.text);

  items.sort((a, b) => LEVELS[a.level] - LEVELS[b.level]);
  const level = items.length ? items[0].level : "ok";
  const rows = X.dayStatus(ex, member.id, today);
  return {
    member, log, today, check, answer: feel ?? null, adherence, comp,
    exToday: { done: rows.filter((r) => r.done).length, total: rows.length },
    sleep: P.analyse(log, "sleepHours", today), heart: P.analyse(log, "heartRate", today), mood: log[today]?.mood?.value ?? null,
    items, level: level === "info" ? "ok" : level, notes: items.filter((i) => i.level === "info")
  };
}
