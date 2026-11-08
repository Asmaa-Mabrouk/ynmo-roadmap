-- Ynmo Roadmaps - 09: Ynmo Flow (tickets). Safe to re-run. Run AFTER 01-08.
--
-- Two tables, same shape as the others ({id, data jsonb}):
--   flow_issues   one row per ticket: {key, n, type, t, d, st, pr, as, rp, par, ep, pts, lb[], cr, up, hist[]}
--   flow_cfg      settings: 'main' = {prefix, ...}   (workflow and statuses arrive in phase 2)
-- Access follows the Ynmo Flow module level (Permissions page): 1 view, 2 create and edit, 3 delete.

create table if not exists public.flow_issues (like public.items including all);
create table if not exists public.flow_cfg    (like public.items including all);
alter table public.flow_issues enable row level security;
alter table public.flow_cfg    enable row level security;

do $$ declare t text; begin
  foreach t in array array['flow_issues', 'flow_cfg'] loop
    execute format('drop policy if exists "editor read" on public.%I', t);
    execute format('drop policy if exists "editor add" on public.%I', t);
    execute format('drop policy if exists "editor change" on public.%I', t);
    execute format('drop policy if exists "editor remove" on public.%I', t);
    execute format('create policy "editor read"   on public.%I for select to authenticated using (public.perm_level(%L) >= 1)', t, 'flow');
    execute format('create policy "editor add"    on public.%I for insert to authenticated with check (public.perm_level(%L) >= 2)', t, 'flow');
    execute format('create policy "editor change" on public.%I for update to authenticated using (public.perm_level(%L) >= 2) with check (public.perm_level(%L) >= 2)', t, 'flow', 'flow');
    execute format('create policy "editor remove" on public.%I for delete to authenticated using (public.perm_level(%L) >= 3)', t, 'flow');
  end loop;
end $$;

-- Realtime (the client re-reads a table when it changes)
do $$ declare t text; begin
  foreach t in array array['flow_issues', 'flow_cfg'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when undefined_object then null; end;
  end loop;
end $$;
