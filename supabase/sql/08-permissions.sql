-- Ynmo Roadmaps - 08: per-module permissions (none / view / edit / delete) managed by admins. Safe to re-run. Run AFTER 01-07.
--
-- Levels per module: 0 none, 1 view, 2 edit (add + change), 3 delete.   Stored in profiles.perms, for example {"roadmap":3,"monthly":2,"sprints":0}.
-- Nothing changes for anyone until an admin saves permissions for them: a person WITHOUT perms keeps the old rule
-- (access = 'editor' -> everything, access = 'viewer' -> view Roadmap, Reports, Monthly and Log). Admins always have everything.
--
--   module      tables / documents
--   roadmap     items, daysoff, share_links, baselines (and the shared settings in `ideas`, timeline notes)
--   roadmaps    roadmaps
--   sprints     sprints, sprint_items
--   reports     reports (weekly: ids not starting with 'mo')
--   monthly     reports (ids starting with 'mo': the months and the backlog)
--   resources   people
--   vacations   vacations
--   log         activity (everyone who can edit something may write to it; everyone approved may read it)

alter table public.profiles add column if not exists perms jsonb;

-- level of the signed-in person for one module (0..3)
create or replace function public.perm_level(m text) returns int
language sql security definer set search_path = public stable
as $$
  select coalesce((
    select case
      when not p.approved then 0
      when p.is_admin then 3
      when p.perms is not null and (p.perms ->> m) ~ '^[0-3]$' then (p.perms ->> m)::int
      when p.access = 'editor' then (case when m = 'log' then 1 else 3 end)
      when m in ('roadmap', 'reports', 'monthly', 'log') then 1
      else 0 end
    from public.profiles p where p.id = auth.uid()
  ), 0)
$$;

-- the highest level over several modules (for tables that several modules share)
create or replace function public.perm_max(ms text[]) returns int
language sql security definer set search_path = public stable
as $$ select coalesce(max(public.perm_level(x)), 0) from unnest(ms) as x $$;

-- which module a reports document belongs to
create or replace function public.report_module(doc_id text) returns text
language sql immutable as $$ select case when doc_id like 'mo%' then 'monthly' else 'reports' end $$;

-- profiles: only admins change perms; the last admin cannot be removed
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if not public.is_admin() then
    new.approved := old.approved; new.is_admin := old.is_admin; new.email := old.email; new.access := old.access; new.perms := old.perms;
  end if;
  if old.is_admin and old.approved and not new.is_admin
     and not exists (select 1 from public.profiles x where x.id <> old.id and x.is_admin and x.approved) then
    raise exception 'There must be at least one admin';
  end if;
  return new;
end $$;

-- generic tables: read = any approved person (the roadmap page needs them for everyone), write = by level of their module
do $$ declare r record; begin
  for r in select * from (values
      ('items', 'roadmap'), ('daysoff', 'roadmap'), ('share_links', 'roadmap'), ('baselines', 'roadmap'),
      ('roadmaps', 'roadmaps'), ('people', 'resources'), ('vacations', 'vacations')) as v(t, m) loop
    execute format('drop policy if exists "editor add" on public.%I', r.t);
    execute format('drop policy if exists "editor change" on public.%I', r.t);
    execute format('drop policy if exists "editor remove" on public.%I', r.t);
    execute format('create policy "editor add"    on public.%I for insert to authenticated with check (public.perm_level(%L) >= 2)', r.t, r.m);
    execute format('create policy "editor change" on public.%I for update to authenticated using (public.perm_level(%L) >= 2) with check (public.perm_level(%L) >= 2)', r.t, r.m, r.m);
    execute format('create policy "editor remove" on public.%I for delete to authenticated using (public.perm_level(%L) >= 3)', r.t, r.m);
  end loop;
end $$;

-- baselines: deleting stays admin-only (as in 05)
drop policy if exists "admin remove" on public.baselines;
create policy "admin remove" on public.baselines for delete to authenticated using (public.is_admin());

-- the shared settings store (product names and colours, report settings, people order, timeline notes): anyone who can edit one of these modules
drop policy if exists "editor add" on public.ideas;
drop policy if exists "editor change" on public.ideas;
drop policy if exists "editor remove" on public.ideas;
create policy "editor add"    on public.ideas for insert to authenticated with check (public.perm_max(array['roadmap','resources','reports','sprints','monthly']) >= 2);
create policy "editor change" on public.ideas for update to authenticated using (public.perm_max(array['roadmap','resources','reports','sprints','monthly']) >= 2) with check (public.perm_max(array['roadmap','resources','reports','sprints','monthly']) >= 2);
create policy "editor remove" on public.ideas for delete to authenticated using (public.perm_max(array['roadmap','resources','reports','sprints','monthly']) >= 2);

-- sprints: read and write need the Sprints module
do $$ declare t text; begin
  foreach t in array array['sprints', 'sprint_items'] loop
    execute format('drop policy if exists "editor read" on public.%I', t);
    execute format('drop policy if exists "editor add" on public.%I', t);
    execute format('drop policy if exists "editor change" on public.%I', t);
    execute format('drop policy if exists "editor remove" on public.%I', t);
    execute format('create policy "editor read"   on public.%I for select to authenticated using (public.perm_level(%L) >= 1)', t, 'sprints');
    execute format('create policy "editor add"    on public.%I for insert to authenticated with check (public.perm_level(%L) >= 2)', t, 'sprints');
    execute format('create policy "editor change" on public.%I for update to authenticated using (public.perm_level(%L) >= 2) with check (public.perm_level(%L) >= 2)', t, 'sprints', 'sprints');
    execute format('create policy "editor remove" on public.%I for delete to authenticated using (public.perm_level(%L) >= 3)', t, 'sprints');
  end loop;
end $$;

-- reports: weekly reports and the monthly board share one table
drop policy if exists "report read" on public.reports;
drop policy if exists "report add" on public.reports;
drop policy if exists "report change" on public.reports;
drop policy if exists "report remove" on public.reports;
create policy "report read" on public.reports for select to authenticated
  using (public.perm_level(public.report_module(id)) >= 2 or (public.perm_level(public.report_module(id)) >= 1 and (data ->> 'status') = 'submitted'));
create policy "report add" on public.reports for insert to authenticated
  with check (public.perm_level(public.report_module(id)) >= 2);
create policy "report change" on public.reports for update to authenticated
  using (public.perm_level(public.report_module(id)) >= 2) with check (public.perm_level(public.report_module(id)) >= 2);
create policy "report remove" on public.reports for delete to authenticated
  using (public.perm_level(public.report_module(id)) >= 3);

-- the log: anyone who can edit something writes to it
drop policy if exists "team add" on public.activity;
create policy "team add" on public.activity for insert to authenticated
  with check (public.perm_max(array['roadmap','roadmaps','sprints','reports','monthly','resources','vacations']) >= 2 and (data ->> 'uid') = auth.uid()::text);
