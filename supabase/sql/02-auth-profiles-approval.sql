-- Ynmo Roadmap — setup v2 (safe to re-run). Run in Supabase > SQL Editor.
create table if not exists public.items    (id text primary key, data jsonb, updated_at timestamptz default now(), updated_by text);
create table if not exists public.people   (like public.items including all);
create table if not exists public.daysoff  (like public.items including all);
create table if not exists public.roadmaps (like public.items including all);
create table if not exists public.ideas    (like public.items including all);
create table if not exists public.vacations(like public.items including all);
create table if not exists public.activity (like public.items including all);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, name text, role text, avatar text,
  approved boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

create or replace function public.is_approved() returns boolean
language sql security definer set search_path = public stable
as $$ select coalesce((select approved from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable
as $$ select coalesce((select is_admin and approved from public.profiles where id = auth.uid()), false) $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,email,name,role,avatar)
  values (new.id,new.email,
    new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'role', new.raw_user_meta_data->>'avatar')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if not public.is_admin() then
    new.approved := old.approved; new.is_admin := old.is_admin; new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists guard_profile_t on public.profiles;
create trigger guard_profile_t before update on public.profiles
  for each row execute function public.guard_profile();

alter table public.profiles enable row level security;
drop policy if exists p_sel on public.profiles;  drop policy if exists p_ins on public.profiles;
drop policy if exists p_upd on public.profiles;  drop policy if exists p_adm on public.profiles;
create policy p_sel on public.profiles for select to authenticated using (id = auth.uid() or public.is_approved());
create policy p_ins on public.profiles for insert to authenticated with check (id = auth.uid() and approved = false and is_admin = false);
create policy p_upd on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy p_adm on public.profiles for update to authenticated using (public.is_admin()) with check (true);

do $$ declare t text; begin
  foreach t in array array['items','people','daysoff','roadmaps','ideas','vacations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "team all" on public.%I', t);
    execute format('drop policy if exists "authenticated" on public.%I', t);
    execute format('create policy "team all" on public.%I for all to authenticated using (public.is_approved()) with check (public.is_approved())', t);
  end loop;
end $$;
alter table public.activity enable row level security;
drop policy if exists "team read" on public.activity; drop policy if exists "team add" on public.activity;
drop policy if exists "authenticated" on public.activity;
create policy "team read" on public.activity for select to authenticated using (public.is_approved());
create policy "team add"  on public.activity for insert to authenticated with check (public.is_approved());

-- Existing users (before v2) become approved members
insert into public.profiles(id,email,name,approved)
select u.id,u.email,split_part(u.email,'@',1),true from auth.users u
where not exists (select 1 from public.profiles p where p.id=u.id);

-- Admin: Asmaa (change email if needed); fallback = first user
update public.profiles set is_admin=true, approved=true
where lower(email)='asmaa.mabrouk.ibrahim@gmail.com';
update public.profiles set is_admin=true, approved=true
where id=(select id from public.profiles order by created_at limit 1)
  and not exists (select 1 from public.profiles where is_admin);

-- Realtime
do $$ declare t text; begin
  foreach t in array array['items','people','daysoff','roadmaps','ideas','vacations','activity','profiles'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
