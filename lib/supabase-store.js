// Station store on Supabase (Postgres through its REST API), used by api/sync.js.
// Needs the project URL and the service-role key, which stay on the server.
// Table and compare-and-set function: supabase/schema.sql.

export function supabaseStore({ url, key, fetchImpl = fetch }) {
  const base = url.replace(/\/+$/, "");
  // New keys (sb_secret_…) go only in the apikey header; legacy service_role JWTs also as Bearer.
  const headers = key.startsWith("sb_")
    ? { apikey: key, "Content-Type": "application/json" }
    : { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  async function check(r) {
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }

  return {
    async get(id) {
      const rows = await check(await fetchImpl(`${base}/rest/v1/stations?id=eq.${encodeURIComponent(id)}&select=record`, { headers }));
      return rows.length ? JSON.stringify(rows[0].record) : null;
    },
    async cas(id, authHash, baseVersion, value) {
      return check(await fetchImpl(`${base}/rest/v1/rpc/station_cas`, {
        method: "POST", headers,
        body: JSON.stringify({ p_id: id, p_auth: authHash, p_base: Number(baseVersion), p_value: JSON.parse(value) })
      }));
    }
  };
}

/** Reads the Supabase settings Vercel's Supabase integration (or the team) puts in the environment. */
export function supabaseEnv(env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}
