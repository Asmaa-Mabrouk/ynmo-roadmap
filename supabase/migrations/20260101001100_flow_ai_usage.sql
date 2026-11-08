-- Ynmo Roadmaps - 11: Ynmo Flow assistant usage log (rate limit + cost tracking). Safe to re-run. Run AFTER 09 and 10.
--
-- The Edge Function `flow-ai` writes one row per request with the SERVICE ROLE (people cannot add, change or erase rows).
-- Only admins can read it. The function refuses a request (HTTP 429) when a person passes FLOW_AI_PER_HOUR (default 30) or
-- FLOW_AI_PER_DAY (default 150), or when the whole team passes FLOW_AI_TEAM_PER_DAY (default 600). Set those as Edge Function secrets to change them.

create table if not exists public.flow_ai_usage (
  id         bigint generated always as identity primary key,
  uid        uuid not null,
  at         timestamptz not null default now(),
  mode       text not null,
  ok         boolean not null default false,
  model      text,
  ms         integer
);
create index if not exists flow_ai_usage_uid_at on public.flow_ai_usage (uid, at desc);
create index if not exists flow_ai_usage_at on public.flow_ai_usage (at desc);
alter table public.flow_ai_usage enable row level security;
drop policy if exists "admin read" on public.flow_ai_usage;
create policy "admin read" on public.flow_ai_usage for select to authenticated using (public.is_admin());
-- no insert / update / delete policies: only the service role (the Edge Function) writes.

-- Per month, per person: how many calls (a rough cost guide). Admins only (the view runs with the caller's rights).
create or replace view public.flow_ai_usage_monthly with (security_invoker = true) as
select date_trunc('month', at) as month, uid, mode, count(*) as calls, count(*) filter (where ok) as ok_calls
from public.flow_ai_usage group by 1, 2, 3 order by 1 desc, 4 desc;
