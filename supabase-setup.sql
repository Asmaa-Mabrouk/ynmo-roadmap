-- Ynmo H2 roadmap: run once in Supabase > SQL Editor > New query > Run
create table if not exists public.items (
  id text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz default now(),
  updated_by uuid default auth.uid()
);
create table if not exists public.people  (like public.items including all);
create table if not exists public.daysoff (like public.items including all);

alter table public.items   enable row level security;
alter table public.people  enable row level security;
alter table public.daysoff enable row level security;

drop policy if exists "team all" on public.items;
drop policy if exists "team all" on public.people;
drop policy if exists "team all" on public.daysoff;
create policy "team all" on public.items   for all to authenticated using (true) with check (true);
create policy "team all" on public.people  for all to authenticated using (true) with check (true);
create policy "team all" on public.daysoff for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.items, public.people, public.daysoff;
