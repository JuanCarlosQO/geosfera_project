import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { supabaseStore, supabaseEnv } from "../lib/supabase-store.js";
import { handle } from "../lib/sync-handler.js";

// A fake Supabase REST API that runs the same rules as supabase/schema.sql.
function fakeSupabase() {
  const rows = new Map();
  const calls = [];
  const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data, text: async () => JSON.stringify(data) });
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (opts.headers?.apikey !== "service-key") return json({ message: "no key" }, 401);
    if (url.includes("/rest/v1/stations?id=eq.")) {
      const id = decodeURIComponent(url.split("id=eq.")[1].split("&")[0]);
      return json(rows.has(id) ? [{ record: rows.get(id) }] : []);
    }
    if (url.endsWith("/rest/v1/rpc/station_cas")) {
      const { p_id, p_auth, p_base, p_value } = JSON.parse(opts.body);
      const cur = rows.get(p_id);
      if (!cur) {
        if (p_base !== 0) return json('{"version":0,"blob":null}');
        rows.set(p_id, p_value); return json("OK");
      }
      if (cur.authHash !== p_auth) return json("AUTH");
      if (cur.version !== p_base) return json(JSON.stringify(cur));
      rows.set(p_id, p_value); return json("OK");
    }
    return json({ message: "not found" }, 404);
  };
  return { fetchImpl, rows, calls };
}

describe("Supabase store", () => {
  const T = "c".repeat(64);
  const req = (method, body) => ({ method, query: { station: "ERG-ABCDEF" }, headers: { authorization: `Bearer ${T}` }, body });

  it("creates, reads and version-checks a station through the REST API", async () => {
    const fake = fakeSupabase();
    const store = supabaseStore({ url: "https://x.supabase.co/", key: "service-key", fetchImpl: fake.fetchImpl });
    assert.equal((await handle(req("GET"), store)).status, 404);
    assert.equal((await handle(req("PUT", { blob: { iv: "i", ct: "c" }, baseVersion: 0 }), store)).status, 200);
    const got = await handle(req("GET"), store);
    assert.equal(got.status, 200);
    assert.equal(got.body.version, 1);
    assert.equal((await handle(req("PUT", { blob: { iv: "i", ct: "d" }, baseVersion: 0 }), store)).status, 409);
    assert.ok(fake.calls.every((c) => c.url.startsWith("https://x.supabase.co/rest/v1/")), "no double slash, right host");
  });

  it("stores only ciphertext and a hashed token", async () => {
    const fake = fakeSupabase();
    const store = supabaseStore({ url: "https://x.supabase.co", key: "service-key", fetchImpl: fake.fetchImpl });
    await handle(req("PUT", { blob: { iv: "i", ct: "secret-ciphertext" }, baseVersion: 0 }), store);
    const row = JSON.stringify([...fake.rows.values()][0]);
    assert.ok(!row.includes(T), "raw token never stored");
  });

  it("sends new sb_secret keys only in the apikey header", async () => {
    const seen = [];
    const store = supabaseStore({ url: "https://x.supabase.co", key: "sb_secret_abc", fetchImpl: async (u, o) => { seen.push(o.headers); return { ok: true, json: async () => [] }; } });
    await store.get("k");
    assert.equal(seen[0].apikey, "sb_secret_abc");
    assert.equal(seen[0].Authorization, undefined);
  });

  it("reads the settings Vercel's Supabase integration provides", () => {
    assert.deepEqual(supabaseEnv({ SUPABASE_URL: "u", SUPABASE_SERVICE_ROLE_KEY: "k" }), { url: "u", key: "k" });
    assert.deepEqual(supabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "u", SUPABASE_SECRET_KEY: "k" }), { url: "u", key: "k" });
    assert.equal(supabaseEnv({ SUPABASE_URL: "u" }), null);
  });
});
