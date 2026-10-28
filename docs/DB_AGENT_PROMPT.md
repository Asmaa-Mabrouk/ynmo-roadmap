# Database check and set-up prompt for an agent (Claude in Chrome on the Supabase dashboard)

Project: **YNMO_PM** (ref `avgkenwdehtwynrswsck`). App: https://ynmo-roadmap.vercel.app (repo `Asmaa-Mabrouk/ynmo-roadmap`, branch `main`).

## Rules for the agent
- Work in the Supabase **SQL editor**. Run **read-only `select` queries only**, unless the owner approves a specific change in this chat. Never paste or print keys, passwords, tokens or the database URL.
- Never run `drop`, `truncate`, `delete` or `alter` on the tables. Never run any file from the repo unless the owner says so.
- Report every result as a short table: check, expected, found, OK / NOT OK.

## What the app stores (nothing new was added to the schema)
All documents live in the generic tables as rows `{id text, data jsonb}`. **No new table, column or SQL file is needed for the Dashboard, the points or the version history.**

| Where | What |
|---|---|
| `public.reports`, id `mo<yyyymm>` (for example `mo202611`) | one Monthly month: `{mo:'2026-11', lines:[…], by, ts, status, notes…}`. Each card in `lines` has `t` (title), `k` (product), `pct`, `rid`/`src` (roadmap link) and the points: **`pts`** `{ai, fe, mob, be, des, qa: number}` = total per track, **`who`** `{track: {personName: points}}` = who gave how many points, `needs` |
| `public.reports`, id `mobacklog` | the backlog (not a month) |
| `public.reports`, id `mohist<yyyymm>_a0 … _a14` | **automatic versions** of a month (15 slots per month; the oldest slot is overwritten, nothing is deleted). Doc: `{hist:1, of:'2026-11', at (ms), by, n (cards), named:false, doc:{the month doc}}` |
| `public.reports`, id `mohist<yyyymm>_n<rand><time>` | **named versions** ("Save a version"), never replaced. Same shape with `named:true, name` |
| `public.ideas`, id `capacity` | **Dashboard settings**: `{cfg:true, ppp, reserve, buffer, lanes:[{k, people:[names]}], leaving:{name:'YYYY-MM-DD'}}` |
| `public.ideas`, id `cardseq` | last card number given (`{cfg:true, n}`) |
| `public.people`, id `<id>` | people added to Resources (`{n, domain, sqs}`) that the Dashboard tracks use |
| `public.activity` | the log (it now names the deliverable that was added) |

The ids starting with `mo` belong to the **Monthly** permission (SQL 08 `report_module`), so version docs follow it: editors (level 2) add and change them, level 3 deletes, viewers cannot read them (they have no top-level `status`).

## The points rules (for reading the data)
- **1 point = 4 hours.** A person has **40 points a month** (20 working days x 8 hours = 160 h); **20% support and 10% buffer** come off, so a person can take **28 points = 112 hours**. A track takes the sum of its people. Leave and a last working day reduce it. The point list on a card is 1, 2, 3, 5, 8, 13, 21.
- The code default is `ppp = 40`. The old default was 8. If `ideas/capacity` was ever saved with `ppp = 8`, that old number still wins and must become 40.
- Six tracks: `ai, fe, mob, be, des, qa` (PMs are not a track; old `pm` points are ignored).

## 1. Checks to run (read-only)

```sql
-- 1.1 tables that must exist
select table_name from information_schema.tables where table_schema='public'
  and table_name in ('items','people','daysoff','roadmaps','ideas','vacations','activity','baselines','share_links','sprints','sprint_items','reports','profiles') order by 1;

-- 1.2 SQL 08 is applied: report_module maps ids starting with 'mo' to monthly
select pg_get_functiondef('public.report_module(text)'::regprocedure);

-- 1.3 policies on reports (expect read / add / change / remove using report_module(id); remove needs level >= 3)
select policyname, cmd, qual, with_check from pg_policies where schemaname='public' and tablename='reports' order by cmd, policyname;

-- 1.4 Dashboard settings (expect ppp = 40 or no row; reserve 0.2; buffer 0.1)
select id, data from public.ideas where id in ('capacity','cardseq');

-- 1.5 the months, how many cards, who saved last
select id, data->>'mo' as month, jsonb_array_length(coalesce(data->'lines','[]'::jsonb)) as cards,
       data->>'by' as last_by, to_timestamp((data->>'ts')::bigint/1000) as last_saved
from public.reports where id ~ '^mo[0-9]{6}$' or id='mobacklog' order by id;

-- 1.6 version history: which versions exist (a month with edits should have some)
select id, data->>'of' as month, data->>'named' as named, data->>'name' as name, data->>'n' as cards,
       data->>'by' as by, to_timestamp((data->>'at')::bigint/1000) as at
from public.reports where id like 'mohist%' order by data->>'of', (data->>'at')::bigint desc;

-- 1.7 cards that carry people but no track points (they are ignored by the Dashboard; this is how a person can show points in a month that has none)
select r.id as month_doc, l->>'t' as card, l->'pts' as pts, l->'who' as who
from public.reports r, jsonb_array_elements(r.data->'lines') l
where r.id ~ '^mo[0-9]{6}$' and l ? 'who' and l->'who' <> 'null'::jsonb
  and (l->'pts' is null or l->'pts' = 'null'::jsonb or l->'pts' = '{}'::jsonb);

-- 1.8 everything Altramsi has, month by month (to see where December and January points come from)
select r.id as month_doc, l->>'t' as card, l->'pts' as pts, l->'who' as who
from public.reports r, jsonb_array_elements(r.data->'lines') l
where r.id ~ '^mo[0-9]{6}$' and l::text ilike '%Altramsi%' order by r.id;

-- 1.9 cards with points given on the OLD scale (1 point = about 2.5 days). They now count as 4 hours each and need re-estimating
select r.id as month_doc, count(*) as cards_with_points
from public.reports r, jsonb_array_elements(r.data->'lines') l
where r.id ~ '^mo[0-9]{6}$' and l->'pts' is not null and l->'pts' <> 'null'::jsonb and l->'pts' <> '{}'::jsonb group by r.id order by r.id;

-- 1.10 version docs must not be readable by viewers: no top-level 'status' key
select count(*) filter (where data ? 'status') as versions_with_status, count(*) as versions from public.reports where id like 'mohist%';
```

## 2. Changes that need the owner's approval (do not run on your own)
1. **Dashboard settings number:** if 1.4 shows `ppp` = 8 (or any value other than 40), the owner changes it in the app (**Dashboard → Dashboard settings → Points per person per month = 40**). Prefer the app. Only if the owner asks for SQL: `update public.ideas set data = jsonb_set(data,'{ppp}','40'::jsonb) where id='capacity';`
2. **Old points:** do not rewrite them. The owner re-estimates the cards listed by 1.9 in the app (card ⋯ → Points and people…).
3. **Cards from 1.7:** report them; the owner decides (open the card, Points and people…, Save, or clear the points).
4. **Names:** the Dashboard names must match Resources. In **Resources**: rename Design's "Khalid" to "Khalid Abdelfattah", and pick the right spellings for Tramsi/Altramsi, Sahdy/Shady, Waradny/Wardany. Then in Dashboard settings re-pick them.

## 3. Safety nets to confirm (report only)
- Point-in-time recovery / daily backups: are they on for this plan? (Supabase → Database → Backups.) Version history in the app lives in the same table as the data, so it is **not** a database backup.
- Realtime is on for `reports`, `ideas`, `vacations` (the Dashboard refreshes live from them).

## 4. App checks (as an admin and as an executive, https://ynmo-roadmap.vercel.app)
1. Menu has **Dashboard** (between Monthly and Resources); the address becomes `#/dashboard`; "Who is online" says "Dashboard".
2. Dashboard: month cards (Fits / Tight / Over), "<Month> in numbers", What needs fixing (people over their points list the cards behind the number), track and people heat maps with Chart / Table switches, bars by product, columns by month.
3. Monthly: a card that is not on the roadmap has an amber outline and "⚠ Not on roadmap"; ⋯ → Points and people… (tracks, then people, then points per person; list shows hours, for example "2 · 8 h").
4. Monthly month menu ⋯ → **Version history…**: lists versions; pick one: missing / added / changed cards; **Bring back only the missing cards**, **Restore this version**, **Save a version**. Executives do not see ⋯.
5. Log: "added "<card name>" to <Month>".
Report anything that differs. Do not change data to make a check pass.
