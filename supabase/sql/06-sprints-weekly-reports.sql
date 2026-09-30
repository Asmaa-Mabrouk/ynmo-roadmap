-- Ynmo Roadmaps - 06: Sprint planning + Weekly executive reports (safe to re-run). Run AFTER 01-05.
-- Same document shape as every other table: id text + data jsonb.

create table if not exists public.sprints      (like public.items including all);   -- one row per sprint: {n, a, b, note}
create table if not exists public.sprint_items (like public.items including all);   -- work items: {sp, squad, person, t, jira, kind, st, tags[], rf}
create table if not exists public.reports      (like public.items including all);   -- weekly reports: {wk, sprint, status, sections{...}}

alter table public.sprints      enable row level security;
alter table public.sprint_items enable row level security;
alter table public.reports      enable row level security;

-- Sprint planning is internal: only editors (and admins) can read or write it. Viewers/executives never see it.
do $$ declare t text; begin
  foreach t in array array['sprints','sprint_items'] loop
    execute format('drop policy if exists "editor read" on public.%I', t);
    execute format('drop policy if exists "editor add" on public.%I', t);
    execute format('drop policy if exists "editor change" on public.%I', t);
    execute format('drop policy if exists "editor remove" on public.%I', t);
    execute format('create policy "editor read"   on public.%I for select to authenticated using (public.is_editor())', t);
    execute format('create policy "editor add"    on public.%I for insert to authenticated with check (public.is_editor())', t);
    execute format('create policy "editor change" on public.%I for update to authenticated using (public.is_editor()) with check (public.is_editor())', t);
    execute format('create policy "editor remove" on public.%I for delete to authenticated using (public.is_editor())', t);
  end loop;
end $$;

-- Reports:
--  * editors see drafts and submitted reports; approved viewers (executives) see SUBMITTED reports only
--  * editors create/edit drafts; only an ADMIN can submit (status -> 'submitted'), edit or reopen a submitted report, or delete one
drop policy if exists "report read"   on public.reports;
drop policy if exists "report add"    on public.reports;
drop policy if exists "report change" on public.reports;
drop policy if exists "report remove" on public.reports;
create policy "report read" on public.reports for select to authenticated
  using (public.is_editor() or (public.is_approved() and (data->>'status') = 'submitted'));
create policy "report add" on public.reports for insert to authenticated
  with check (public.is_editor() and ((data->>'status') <> 'submitted' or public.is_admin()));
create policy "report change" on public.reports for update to authenticated
  using (public.is_editor() and ((data->>'status') <> 'submitted' or public.is_admin()))
  with check (public.is_editor() and ((data->>'status') <> 'submitted' or public.is_admin()));
create policy "report remove" on public.reports for delete to authenticated using (public.is_admin());

-- Realtime (the client re-reads a table when it changes)
do $$ declare t text; begin
  foreach t in array array['sprints','sprint_items','reports'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when undefined_object then null; end;
  end loop;
end $$;
