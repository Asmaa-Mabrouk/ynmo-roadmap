-- Ynmo Roadmap — setup v5 (security hardening, safe to re-run). Run AFTER v2, v3 and v4.

-- 1) Admin allow-list only takes effect once the email address is CONFIRMED.
--    (Keep "Confirm email" turned ON in Supabase > Authentication > Sign In / Providers > Email.)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm boolean;
begin
  adm := new.email_confirmed_at is not null
     and exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email));
  insert into public.profiles(id,email,name,role,avatar,approved,is_admin)
  values (new.id,new.email,
    left(new.raw_user_meta_data->>'name',80), left(new.raw_user_meta_data->>'role',60), left(new.raw_user_meta_data->>'avatar',12),
    adm, adm)
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.promote_confirmed_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null
     and exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email)) then
    update public.profiles set approved = true, is_admin = true where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.promote_confirmed_admin();

-- 2) Log entries can only be written as yourself (no forging someone else's user id). Log stays append-only.
drop policy if exists "team add" on public.activity;
create policy "team add" on public.activity for insert to authenticated
  with check (public.is_editor() and (data->>'uid') = auth.uid()::text);

-- 3) Snapshots (baselines) are really history: content cannot change, only admins can delete.
create or replace function public.guard_baseline() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.data - 'active') is distinct from (old.data - 'active') then
    raise exception 'Snapshots cannot be edited';
  end if;
  return new;
end $$;
drop trigger if exists guard_baseline_t on public.baselines;
create trigger guard_baseline_t before update on public.baselines
  for each row execute function public.guard_baseline();
drop policy if exists "editor remove" on public.baselines;
drop policy if exists "admin remove" on public.baselines;
create policy "admin remove" on public.baselines for delete to authenticated using (public.is_admin());

-- 4) Profile text limits
alter table public.profiles drop constraint if exists profiles_len_chk;
alter table public.profiles add constraint profiles_len_chk
  check (char_length(coalesce(name,'')) <= 80 and char_length(coalesce(role,'')) <= 60 and char_length(coalesce(avatar,'')) <= 12) not valid;

-- 5) Presence channel is private: only approved signed-in members can join it.
--    Also turn OFF "Allow public access" in Supabase > Realtime > Settings.
alter table realtime.messages enable row level security;
drop policy if exists "ynmo presence read" on realtime.messages;
drop policy if exists "ynmo presence write" on realtime.messages;
create policy "ynmo presence read" on realtime.messages for select to authenticated
  using (realtime.topic() = 'ynmo-presence' and public.is_approved());
create policy "ynmo presence write" on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'ynmo-presence' and public.is_approved());
