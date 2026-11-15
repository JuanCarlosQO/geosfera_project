// One telemetry feed for the whole app. The Live screen used to own the simulator, so an
// alert existed only while that screen was open. Now the feed keeps running after the crew
// member leaves Live (or goes to sleep), and anything can listen to it: the Live screen
// paints it, and alarm.js shows and sounds its alerts on every screen.
// It starts the first time Live or sleep mode is opened, and stops by itself when nothing is
// simulated, nobody is asleep, no alert is up and no screen is watching.
// Rules: telemetry-core.js. Everything here is the SIMULATED feed plus the real dose replay.

import * as T from "./telemetry-core.js";
import { RADLAB_ISS } from "./data/radlab-iss.js";
import { dateKey } from "./log-core.js";
import { readLog, current } from "./store.js";

export const TYPICAL_DOSE = T.median(RADLAB_ISS.values);
const KEEP_EVENTS = 30;
const rand = T.rng(Date.now() % 100000);
const subs = new Map(); // listener -> { screen }
let feed = null;        // { memberId, state, bands, history, tracker, steady, events, readout, paused }
let timer = null;

function fresh() {
  const member = current();
  const log = member ? readLog(member.id) : {};
  const today = dateKey();
  const bands = { hr: T.baseline(log, "heartRate", today), sys: T.baseline(log, "bloodPressure", today, 0) };
  const dia = T.baseline(log, "bloodPressure", today, 1);
  feed = {
    memberId: member?.id ?? null,
    state: T.startState({ hr: bands.hr?.mean, sys: bands.sys?.mean, dia: dia?.mean }, RADLAB_ISS),
    bands, history: {}, tracker: T.makeTracker(), steady: [], events: [], readout: null, paused: false
  };
  look(false);
}

/** Reads the feed as it is now; `advance` also moves the steady-alert tracker one reading on. */
function look(advance) {
  const r = T.readout(feed.state, feed.bands, TYPICAL_DOSE, feed.history);
  feed.history = T.remember(feed.history, r);
  let raised = [];
  if (advance) {
    const out = T.track(feed.tracker, r.alerts);
    feed.tracker = out.tracker;
    feed.steady = out.active;
    raised = out.events;
    for (const ev of raised) feed.events.unshift({ ...ev, t: feed.state.t });
    feed.events.length = Math.min(feed.events.length, KEEP_EVENTS);
  }
  feed.readout = r;
  for (const fn of [...subs.keys()]) fn(feed, raised);
}

const watched = () => [...subs.values()].some((o) => o.screen);
const quiet = () => !Object.keys(feed.state.active).length && !feed.state.sleeping && !feed.steady.length;

function tick() {
  if (!feed || feed.paused) return;
  feed.state = T.step(feed.state, rand);
  look(true);
  if (!watched() && quiet()) { clearInterval(timer); timer = null; } // nothing to watch for: rest until someone opens Live again
}

/** Starts the feed (or carries on with it). A different active crew member starts a new one. */
export function startFeed() {
  if (!feed || feed.memberId !== (current()?.id ?? null)) fresh();
  timer ??= setInterval(tick, T.TICK_MS);
  return feed;
}

export const snapshot = () => feed;

function change(fn) {
  startFeed();
  feed.state = fn(feed.state);
  look(false);
}

/** Starts or stops one simulation; "nominal" stops them all. */
export const toggle = (id) => change((s) => (id === "nominal" ? T.resetAll(s) : T.toggleScenario(s, id)));
export const setSleeping = (on) => change((s) => T.setSleeping(s, on));
export function setPaused(paused) {
  startFeed();
  feed.paused = Boolean(paused);
  look(false);
}

/** fn(feed, raised) runs on every reading. `screen: true` marks a screen that keeps the feed awake. Returns a function that stops listening. */
export function subscribe(fn, { screen = false } = {}) {
  subs.set(fn, { screen });
  return () => subs.delete(fn);
}
