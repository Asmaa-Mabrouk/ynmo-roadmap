-- Ynmo Roadmaps — setup v3 (safe to re-run). Run in Supabase > SQL Editor AFTER v2.
-- 1) Emails that are always approved admins the moment they register
create table if not exists public.admin_emails (email text primary key);
insert into public.admin_emails (email) values ('asmaa.mabrouk.ibrahim@gmail.com') on conflict do nothing;
alter table public.admin_emails enable row level security;   -- no policy = not readable from the app

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare adm boolean;
begin
  adm := exists (select 1 from public.admin_emails a where lower(a.email) = lower(new.email));
  insert into public.profiles(id,email,name,role,avatar,approved,is_admin)
  values (new.id,new.email,
    new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'role', new.raw_user_meta_data->>'avatar',
    adm, adm)
  on conflict (id) do nothing;
  return new;
end $$;

-- 2) Make the accounts that already registered with those emails admins now
update public.profiles set approved = true, is_admin = true
where lower(email) in (select lower(email) from public.admin_emails);

-- Check: should list your admin account(s)
select email, approved, is_admin from public.profiles where is_admin;
