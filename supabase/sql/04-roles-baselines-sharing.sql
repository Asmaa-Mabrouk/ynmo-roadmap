-- Ynmo Roadmap — setup v4 (safe to re-run). Run in Supabase > SQL Editor AFTER v2 and v3.
-- Adds: viewer role, baselines (snapshots), public read-only share links.

-- 1) Access level on profiles: 'editor' (default) or 'viewer' (can look, cannot change anything)
alter table public.profiles add column if not exists access text not null default 'editor';
alter table public.profiles drop constraint if exists profiles_access_chk;
alter table public.profiles add constraint profiles_access_chk check (access in ('editor','viewer'));

create or replace function public.is_editor() returns boolean
language sql security definer set search_path = public stable
as $$ select coalesce((select approved and (access = 'editor' or is_admin) from public.profiles where id = auth.uid()), false) $$;

-- non-admins cannot change approved / is_admin / access / email on their own profile
create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if not public.is_admin() then
    new.approved := old.approved; new.is_admin := old.is_admin; new.email := old.email; new.access := old.access;
  end if;
  return new;
end $$;

-- 2) New tables (same shape as the others)
create table if not exists public.baselines   (like public.items including all);
create table if not exists public.share_links (like public.items including all);

-- 3) Row level security: everyone approved can READ; only editors can WRITE
do $$ declare t text; begin
  foreach t in array array['items','people','daysoff','roadmaps','ideas','vacations','baselines','share_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "team all" on public.%I', t);
    execute format('drop policy if exists "team read" on public.%I', t);
    execute format('drop policy if exists "editor add" on public.%I', t);
    execute format('drop policy if exists "editor change" on public.%I', t);
    execute format('drop policy if exists "editor remove" on public.%I', t);
    execute format('create policy "team read" on public.%I for select to authenticated using (public.is_approved())', t);
    execute format('create policy "editor add" on public.%I for insert to authenticated with check (public.is_editor())', t);
    execute format('create policy "editor change" on public.%I for update to authenticated using (public.is_editor()) with check (public.is_editor())', t);
    execute format('create policy "editor remove" on public.%I for delete to authenticated using (public.is_editor())', t);
  end loop;
end $$;

drop policy if exists "team add" on public.activity;
create policy "team add" on public.activity for insert to authenticated with check (public.is_editor());

-- 4) Public read-only view for a share link. Anyone holding the link (no account) can call this.
--    It returns ONLY that roadmap's bars, the people list and company days off. No leave details, no ideas, no log.
create or replace function public.shared_snapshot(t text) returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare v_rm text;
begin
  select data->>'rm' into v_rm from public.share_links where id = t;
  if v_rm is null then return null; end if;
  return jsonb_build_object(
    'rm', v_rm,
    'roadmap', (select data from public.roadmaps where id = v_rm),
    'items',   coalesce((select jsonb_object_agg(id, data) from public.items where coalesce(data->>'rm','h2-2026') = v_rm), '{}'::jsonb),
    'people',  coalesce((select jsonb_object_agg(id, data) from public.people), '{}'::jsonb),
    'daysoff', coalesce((select jsonb_object_agg(id, data) from public.daysoff), '{}'::jsonb)
  );
end $$;
revoke all on function public.shared_snapshot(text) from public;
grant execute on function public.shared_snapshot(text) to anon, authenticated;

-- 5) Realtime for the new tables
do $$ declare t text; begin
  foreach t in array array['baselines','share_links'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
