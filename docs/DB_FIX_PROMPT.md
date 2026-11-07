# Prompt for the database agent: fix the Ynmo Roadmaps database (with approval at each step)

Project: Supabase YNMO_PM (ref `avgkenwdehtwynrswsck`), used by https://ynmo-roadmap.vercel.app. Work in the Supabase **SQL Editor** only.

## Rules
- Never print, paste or ask for keys, passwords, tokens or the database URL.
- Every step is: **(a)** run the read-only check, **(b)** show me the result as a small table, **(c)** wait for me to write "approve step N", **(d)** only then run the change, **(e)** re-run the check and show it is fixed. Never run a change before I approve that step.
- Never `drop`, `truncate` or `alter` any table. The only delete allowed is the single row named in step 4. Every `update` and `delete` must have a `where` that names exact ids, and must be run inside `begin; ... commit;` after showing the number of rows it will touch (it must match the check).
- If a number differs from what I expect, stop and tell me instead of continuing.

## Step 0: safety copy (run first, after I approve)
```sql
create table if not exists public.backup_20261108_sprint_items as select * from public.sprint_items;
create table if not exists public.backup_20261108_items        as select * from public.items;
create table if not exists public.backup_20261108_people       as select * from public.people;
create table if not exists public.backup_20261108_reports      as select * from public.reports;
alter table public.backup_20261108_sprint_items enable row level security;
alter table public.backup_20261108_items        enable row level security;
alter table public.backup_20261108_people       enable row level security;
alter table public.backup_20261108_reports      enable row level security;
```
Tell me the row counts of each backup next to the source table. (RLS with no policy keeps the copies private.)

## Step 1: turn on Ynmo Flow tickets (new tables, nothing existing is touched)
Check first:
```sql
select table_name from information_schema.tables where table_schema='public' and table_name in ('flow_issues','flow_cfg');
select proname from pg_proc where proname in ('perm_level','perm_max');   -- both must exist (SQL 08)
```
If `perm_level` is missing, stop and tell me (SQL 08 has to be run first). Otherwise, after I approve, run this whole script once (safe to re-run):
```sql
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
```
Then check: both tables exist, RLS is on (`select relname, relrowsecurity from pg_class where relname in ('flow_issues','flow_cfg')`), four policies each (`select tablename, policyname from pg_policies where tablename in ('flow_issues','flow_cfg')`), and both are in the `supabase_realtime` publication.

## Step 2: short names in sprint items
The sprint document keeps blocks `{k:'p', t:'<person name>'}`. Official names are Aya Fathy and Mo'men Sayeh.
```sql
select id, data->>'sp' as sprint, data->>'k' as kind, data->>'t' as name
from public.sprint_items
where data->>'k' = 'p' and data->>'t' in ('Aya', 'Mo''men', 'Moamen', 'Mo’men', 'Sayeh')
order by 1;
```
List every row. After I approve, for exactly those ids only:
```sql
begin;
update public.sprint_items set data = jsonb_set(data, '{t}', to_jsonb('Aya Fathy'::text))     where data->>'k'='p' and data->>'t' = 'Aya';
update public.sprint_items set data = jsonb_set(data, '{t}', to_jsonb('Mo''men Sayeh'::text)) where data->>'k'='p' and data->>'t' in ('Mo''men','Moamen','Mo’men','Sayeh');
-- the row counts shown must equal the check above; then:
commit;
```
Re-run the check (expect 0 rows) and show the names now in use: `select data->>'t', count(*) from public.sprint_items where data->>'k'='p' group by 1 order by 1;`.

## Step 3: null `pd`
Find where a `pd` key exists but is null, in every document table (read-only):
```sql
select 'items' as t, count(*) from public.items where data ? 'pd' and jsonb_typeof(data->'pd') = 'null'
union all select 'people', count(*) from public.people where data ? 'pd' and jsonb_typeof(data->'pd') = 'null'
union all select 'sprint_items', count(*) from public.sprint_items where data ? 'pd' and jsonb_typeof(data->'pd') = 'null'
union all select 'reports', count(*) from public.reports where data ? 'pd' and jsonb_typeof(data->'pd') = 'null'
union all select 'ideas', count(*) from public.ideas where data ? 'pd' and jsonb_typeof(data->'pd') = 'null';
```
For each table with a count above 0, list the ids (limit 50) and what the rest of the document looks like (`data - 'pd'`, first 200 characters). **Do not change anything in this step on your own**: tell me what you found, and I will say whether to remove the empty `pd` key (`data - 'pd'` on exactly those ids) or leave it.

## Step 4: the empty row `simv9hd3i5ko58`
```sql
select 'sprint_items' as t, id, data from public.sprint_items where id = 'simv9hd3i5ko58'
union all select 'sprints', id, data from public.sprints where id = 'simv9hd3i5ko58'
union all select 'reports', id, data from public.reports where id = 'simv9hd3i5ko58';
```
Show me the row and which table it is in. Only if `data` is empty (`{}`, null, or has no title/name/sprint and no children point to it: `select count(*) from public.sprint_items where data->>'par' = 'simv9hd3i5ko58'`), and after I approve, delete that one row:
```sql
begin;
delete from public.sprint_items where id = 'simv9hd3i5ko58' and (data is null or data = '{}'::jsonb);   -- adjust the table to the one found; must delete exactly 1 row
commit;
```
If the row has content, do not delete it; show it to me.

## Step 5: final read-only report
A table with: backups created (counts), Flow tables and policies present, short names left in sprint items (expect 0), null `pd` rows left (as I decided), the empty row gone, no table in `public` with RLS off (`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`), and the number of rows per app table.

## Not in this prompt (do not do)
- Do not drop the old `backup_20261028_*` and `backup_20261028b_*` tables: I will ask for that separately when the team confirms.
- Do not change the Dashboard settings (`ideas/capacity`) or re-score points: I do those in the app.
