// Server side of the ActiGraph CentrePoint connection, independent of the network so it can be
// tested. ActiGraph's API (docs: github.com/actigraph/CentrePoint3APIDocumentation) uses OAuth 2.0
// client credentials: a client ID and a client SECRET. The secret must never reach a browser, so
// it lives only in the server's environment variables (.env, never committed) and the app asks
// this function for one crew member's sleep periods and wear minutes.
//
// env: ACTIGRAPH_CLIENT_ID, ACTIGRAPH_CLIENT_SECRET, ACTIGRAPH_STUDY_ID,
//      ACTIGRAPH_PROXY_TOKEN (a code the crew types once, so strangers cannot query subjects),
//      optional ACTIGRAPH_SLEEP_SETTING_ID, ACTIGRAPH_MINUTE_SETTING_ID.

import { createHash, timingSafeEqual } from "node:crypto";

export const AUTH_URL = "https://auth.actigraphcorp.com/connect/token";
export const API_URL = "https://api.actigraphcorp.com";
export const PAGE = 100;        // the API returns at most 100 items per page
export const MAX_PAGES = 60;    // a safety cap: 60 x 100 minutes = 4 days of minute summaries
export const MAX_DAYS = 3;

const reply = (status, body) => ({ status, body });
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const same = (a, b) => { const x = createHash("sha256").update(String(a)).digest(), y = createHash("sha256").update(String(b)).digest(); return timingSafeEqual(x, y); };

async function token(env, fetchFn) {
  const r = await fetchFn(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.ACTIGRAPH_CLIENT_ID, client_secret: env.ACTIGRAPH_CLIENT_SECRET, scope: "Analytics", grant_type: "client_credentials" }).toString()
  });
  if (!r.ok) throw Object.assign(new Error("auth"), { status: r.status });
  return (await r.json()).access_token;
}

async function pages(url, bearer, fetchFn) {
  const out = [];
  for (let offset = 0, n = 0; n < MAX_PAGES; n += 1, offset += PAGE) {
    const sep = url.includes("?") ? "&" : "?";
    const r = await fetchFn(`${url}${sep}limit=${PAGE}&offset=${offset}`, { headers: { Authorization: `Bearer ${bearer}` } });
    if (!r.ok) throw Object.assign(new Error("api"), { status: r.status });
    const data = await r.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    out.push(...items);
    if (items.length < PAGE || out.length >= (data.totalCount ?? Infinity)) break;
  }
  return out;
}

/** -> { status, body }. body: { sleepPeriods, minutes } or { error }. */
export async function handleActigraph({ method, query, headers }, env, fetchFn = fetch) {
  if (method !== "GET") return reply(405, { error: "Only GET." });
  if (!env.ACTIGRAPH_CLIENT_ID || !env.ACTIGRAPH_CLIENT_SECRET || !env.ACTIGRAPH_STUDY_ID || !env.ACTIGRAPH_PROXY_TOKEN) return reply(503, { error: "ActiGraph is not set up on this server." });
  const code = String(headers?.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!code || !same(code, env.ACTIGRAPH_PROXY_TOKEN)) return reply(401, { error: "Wrong access code." });
  const subject = String(query?.subject ?? "");
  const from = String(query?.from ?? ""), to = String(query?.to ?? "");
  if (!/^\d{1,12}$/.test(subject)) return reply(400, { error: "Bad subject ID." });
  if (!DAY.test(from) || !DAY.test(to) || to < from || (Date.parse(to) - Date.parse(from)) / 86400000 > MAX_DAYS) return reply(400, { error: `Dates must be YYYY-MM-DD, at most ${MAX_DAYS} days apart.` });
  const study = encodeURIComponent(env.ACTIGRAPH_STUDY_ID);
  const base = `${API_URL}/analytics/v3/Studies/${study}/Subjects/${subject}`;
  const dates = `fromDate=${from}&toDate=${to}`;
  try {
    const bearer = await token(env, fetchFn);
    const sleepPeriods = await pages(`${base}/DustinTracySleepPeriods?${dates}${env.ACTIGRAPH_SLEEP_SETTING_ID ? `&algorithmSettingId=${encodeURIComponent(env.ACTIGRAPH_SLEEP_SETTING_ID)}` : ""}`, bearer, fetchFn);
    const minutes = await pages(`${base}/MinuteSummaries?${dates}${env.ACTIGRAPH_MINUTE_SETTING_ID ? `&minuteSummarySettingId=${encodeURIComponent(env.ACTIGRAPH_MINUTE_SETTING_ID)}` : ""}`, bearer, fetchFn);
    // only what the app uses leaves the server: no study, site or monitor details
    return reply(200, {
      sleepPeriods: sleepPeriods.map((p) => ({ inBedTime: p.inBedTime, outBedTime: p.outBedTime, timeAsleepMinutes: p.timeAsleepMinutes, timeAwakeMinutes: p.timeAwakeMinutes, awakeningCount: p.awakeningCount, averageAwakening: p.averageAwakening })),
      minutes: minutes.map((m) => ({ t: m.TimestampUtc ?? m.timestampUtc, wear: m.isWear, sleep: m.isSleep }))
    });
  } catch (e) {
    return reply(e.status === 429 ? 429 : 502, { error: e.status === 429 ? "ActiGraph asks to wait a minute (rate limit)." : "ActiGraph did not answer as expected." });
  }
}
