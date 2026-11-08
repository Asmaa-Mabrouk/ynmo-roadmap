-- Ynmo Roadmaps - 10: Ynmo Flow comments, work logs and attachments. Safe to re-run. Run AFTER 09-flow.sql.
--
-- Three tables ({id, data jsonb}, one row per comment / log / file, so two people writing at once never overwrite each other):
--   flow_comments  {iss: ticket id, by: name, at, t: text, men: [mentioned names], ed: edited at}
--   flow_logs      {iss, by, at, day: 'YYYY-MM-DD', min: minutes, t: note}
--   flow_files     {iss, by, at, name, size, type, path: storage path}
-- Same access as the rest of Ynmo Flow (Permissions page): 1 view, 2 add and edit, 3 delete.
-- Attachments live in a PRIVATE Storage bucket `flow-files` (10 MB per file), read through short-lived signed links.

create table if not exists public.flow_comments (like public.items including all);
create table if not exists public.flow_logs     (like public.items including all);
create table if not exists public.flow_files    (like public.items including all);
alter table public.flow_comments enable row level security;
alter table public.flow_logs     enable row level security;
alter table public.flow_files    enable row level security;

do $$ declare t text; begin
  foreach t in array array['flow_comments', 'flow_logs', 'flow_files'] loop
    execute format('drop policy if exists "editor read" on public.%I', t);
    execute format('drop policy if exists "editor add" on public.%I', t);
    execute format('drop policy if exists "editor change" on public.%I', t);
    execute format('drop policy if exists "editor remove" on public.%I', t);
    execute format('create policy "editor read"   on public.%I for select to authenticated using (public.perm_level(%L) >= 1)', t, 'flow');
    execute format('create policy "editor add"    on public.%I for insert to authenticated with check (public.perm_level(%L) >= 2)', t, 'flow');
    execute format('create policy "editor change" on public.%I for update to authenticated using (public.perm_level(%L) >= 2) with check (public.perm_level(%L) >= 2)', t, 'flow', 'flow');
    execute format('create policy "editor remove" on public.%I for delete to authenticated using (public.perm_level(%L) >= 2)', t, 'flow');
  end loop;
end $$;
-- (Comments, logs and files can be removed by editors, level 2, because people delete their own; the page only offers it for your own or to level 3.)

do $$ declare t text; begin
  foreach t in array array['flow_comments', 'flow_logs', 'flow_files'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; when undefined_object then null; end;
  end loop;
end $$;

-- Storage bucket for attachments (private, 10 MB per file)
insert into storage.buckets (id, name, public, file_size_limit)
values ('flow-files', 'flow-files', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "flow files read"   on storage.objects;
drop policy if exists "flow files add"    on storage.objects;
drop policy if exists "flow files remove" on storage.objects;
create policy "flow files read"   on storage.objects for select to authenticated using (bucket_id = 'flow-files' and public.perm_level('flow') >= 1);
create policy "flow files add"    on storage.objects for insert to authenticated with check (bucket_id = 'flow-files' and public.perm_level('flow') >= 2);
create policy "flow files remove" on storage.objects for delete to authenticated using (bucket_id = 'flow-files' and public.perm_level('flow') >= 2);
