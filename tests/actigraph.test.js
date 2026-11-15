import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { handleActigraph, AUTH_URL } from "../lib/actigraph-handler.js";
import { parseCentrePoint, nightSummary } from "../js/devices-core.js";

const ENV = { ACTIGRAPH_CLIENT_ID: "cid", ACTIGRAPH_CLIENT_SECRET: "secret-xyz", ACTIGRAPH_STUDY_ID: "2196", ACTIGRAPH_PROXY_TOKEN: "crew-code" };
const ask = (over = {}) => ({ method: "GET", query: { subject: "21670", from: "2026-11-13", to: "2026-11-15" }, headers: { authorization: "Bearer crew-code" }, ...over });

// A fake ActiGraph: records the calls, answers like the documentation's examples.
function fakeApi({ minutes = 230 } = {}) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (url === AUTH_URL) return { ok: true, status: 200, json: async () => ({ access_token: "tok", expires_in: 3600, token_type: "Bearer" }) };
    const u = new URL(url);
    const offset = Number(u.searchParams.get("offset")), limit = Number(u.searchParams.get("limit"));
    if (u.pathname.endsWith("DustinTracySleepPeriods")) return { ok: true, status: 200, json: async () => ({ items: offset ? [] : [{ id: 1, studyId: 2196, activityMonitorSerial: "CPW1A00000001", inBedTime: "2026-11-14T03:40:00+00:00", outBedTime: "2026-11-14T11:10:00+00:00", timeAsleepMinutes: 420, timeAwakeMinutes: 30, awakeningCount: 3, averageAwakening: 10 }], totalCount: 1 }) };
    const all = Array.from({ length: minutes }, (_, i) => ({ TimestampUtc: new Date(Date.UTC(2026, 10, 14, 12, 0) + i * 60000).toISOString(), isWear: !(i >= 100 && i < 130), isSleep: false, activityMonitorSerial: "X" }));
    return { ok: true, status: 200, json: async () => ({ items: all.slice(offset, offset + limit), totalCount: all.length }) };
  };
  return { fn, calls };
}

describe("ActiGraph CentrePoint through the server", () => {
  it("keeps the client secret on the server and returns only what the app needs", async () => {
    const api = fakeApi();
    const out = await handleActigraph(ask(), ENV, api.fn);
    assert.equal(out.status, 200);
    assert.equal(out.body.sleepPeriods.length, 1);
    assert.equal(out.body.minutes.length, 230, "all pages of 100 were read");
    assert.equal(api.calls[0].url, AUTH_URL);
    assert.match(api.calls[0].opts.body, /grant_type=client_credentials/);
    assert.match(api.calls[0].opts.body, /scope=Analytics/);
    assert.ok(api.calls.slice(1).every((c) => c.opts.headers.Authorization === "Bearer tok"));
    const text = JSON.stringify(out.body);
    assert.doesNotMatch(text, /secret-xyz|activityMonitorSerial|studyId|CPW1A/, "no secret, no study or monitor details");
  });
  it("refuses strangers, bad input and a server with no credentials", async () => {
    const api = fakeApi();
    assert.equal((await handleActigraph(ask({ headers: {} }), ENV, api.fn)).status, 401);
    assert.equal((await handleActigraph(ask({ headers: { authorization: "Bearer wrong" } }), ENV, api.fn)).status, 401);
    assert.equal((await handleActigraph(ask({ query: { subject: "1; DROP", from: "2026-11-13", to: "2026-11-14" } }), ENV, api.fn)).status, 400);
    assert.equal((await handleActigraph(ask({ query: { subject: "1", from: "2026-11-01", to: "2026-11-15" } }), ENV, api.fn)).status, 400, "too many days");
    assert.equal((await handleActigraph(ask({ method: "POST" }), ENV, api.fn)).status, 405);
    assert.equal((await handleActigraph(ask(), {}, api.fn)).status, 503);
    assert.equal(api.calls.length, 0, "nothing reached ActiGraph");
  });
  it("passes on ActiGraph's rate limit", async () => {
    const out = await handleActigraph(ask(), ENV, async () => ({ ok: false, status: 429, json: async () => ({}) }));
    assert.equal(out.status, 429);
  });
});

describe("ActiGraph data into the watch timeline", () => {
  it("turns sleep periods and non-wear minutes into events and a night", async () => {
    const api = fakeApi();
    const { body } = await handleActigraph(ask(), ENV, api.fn);
    const r = parseCentrePoint(body);
    assert.equal(r.ok, true);
    const kinds = r.events.map((e) => e.kind);
    assert.equal(kinds.filter((k) => k === "awake").length, 3);
    const off = r.events.find((e) => e.kind === "off");
    assert.equal(off.at, "2026-11-14T13:40:00.000Z");
    assert.equal(off.until, "2026-11-14T14:10:00.000Z", "30 minutes not worn");
    assert.ok(r.events.some((e) => e.kind === "on" && e.at === off.until));
    const day = r.nights[0].day;
    const s = nightSummary(r.events, day);
    assert.equal(s.awakenings, 3);
    assert.equal(s.awakeMin, 30);
    assert.equal(s.sleepHours, 7);
    assert.ok(r.events.every((e) => e.src === "centrepoint"));
  });
  it("says so when there is nothing", () => {
    assert.equal(parseCentrePoint({}).ok, false);
    assert.equal(parseCentrePoint({ sleepPeriods: [{ inBedTime: "x" }], minutes: [{ t: "y", wear: false }] }).ok, false);
  });
});
