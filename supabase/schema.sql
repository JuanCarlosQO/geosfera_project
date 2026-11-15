-- Ergosphere station sync on Supabase.
-- Paste this whole file in Supabase → SQL Editor → New query → Run. Safe to run more than once.
-- Each row holds one station: { authHash, version, blob, updatedAt }. The blob is AES-GCM
-- ciphertext made on the crew's devices; nobody with database access can read the records.

create table if not exists public.stations (
  id text primary key,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

-- Only the server (service role) may touch the table: RLS on, no policies for anon/authenticated.
alter table public.stations enable row level security;

-- Atomic compare-and-set used by /api/sync (create on first write, then version check).
create or replace function public.station_cas(p_id text, p_auth text, p_base int, p_value jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cur jsonb;
begin
  select record into cur from public.stations where id = p_id for update;
  if cur is null then
    if p_base <> 0 then
      return '{"version":0,"blob":null}';
    end if;
    insert into public.stations (id, record) values (p_id, p_value) on conflict (id) do nothing;
    if not found then
      return (select record::text from public.stations where id = p_id);
    end if;
    return 'OK';
  end if;
  if cur->>'authHash' <> p_auth then
    return 'AUTH';
  end if;
  if (cur->>'version')::int <> p_base then
    return cur::text;
  end if;
  update public.stations set record = p_value, updated_at = now() where id = p_id;
  return 'OK';
end;
$$;

revoke all on function public.station_cas(text, text, int, jsonb) from public, anon, authenticated;
grant execute on function public.station_cas(text, text, int, jsonb) to service_role;
