# Prompt for the database agent: health check of the Ynmo Roadmaps database (read-only)

Project: Supabase YNMO_PM (ref `avgkenwdehtwynrswsck`), used by https://ynmo-roadmap.vercel.app.
You are doing a **read-only health check**. Do not change, insert, update or delete anything, do not change schema, policies, functions, settings or secrets, and do not print or ask for passwords, keys or tokens. If a check needs a change, list it under "Recommended actions" and wait for the owner's approval. Report per check: **PASS / WARN / FAIL**, the number you found, and for WARN and FAIL up to 10 example ids (ids only, not whole rows).

## 0. Context (how the data is stored)
- Generic document tables `id text primary key, data jsonb, updated_at, updated_by`: `items`, `people`, `daysoff`, `roadmaps`, `ideas`, `vacations`, `activity`, `baselines`, `sprints`, `sprint_items`, `reports`, `share_links`. Also `profiles` and `admin_emails`.
- `reports` holds weekly reports `rp<yyyymmdd>`, monthly deliverables `mo<yyyymm>` (and `mobacklog`), and monthly version copies `mohist<yyyymm>_a0..a14` (15 rotating automatic slots) and `mohist<yyyymm>_n<random>` (named).
- `ideas/capacity` is the Dashboard settings: `{cfg, ppp, reserve, buffer, lanes:[{k, people[]}], leaving:{name:'YYYY-MM-DD'}, part:{name:0.1..0.99}}`. It may not exist yet (then the app uses defaults).
- A month card: `{id, t, k (product), who:{track:{person:points}}, pts:{track:points}, needs, rid, …}`. Tracks are `ai, fe, mob, be, des, qa`. Points allowed: 0, 1, 2, 3, 5, 8, 13, 21. 1 point = 4 hours; one person = 40 points a month.
- Official team names (whole value, exact spelling): Mohamed Altramsi, Aliaa Ibrahim, Shady Bassily, Amal Saleem, Mo'men Sayeh, Abdelhamid Ali, Aya Fathy, Ahmed Adnan, Ahmed Soliman, Ahmed Wardany, Hamid Shahien, Ahmed Hoseiny, Saad Mohamed, Khalid Abdelfattah, Mona Mohamed, Dina Mousa, Dina Samy, Mohamed Zahran. Other people (Emad, Engy, Asmaa, Mario, Sherif, Mwrohan, Mostafa, Merihan) are valid and not in the list.

## 1. Structure and security
1. Every table above exists, has the three columns `id`, `data`, `updated_at`, and `data` is never null. Row counts per table.
2. **Row-level security is ON for every table** in `public`, including any `backup_*` table. List any table with RLS off.
3. Policies: list the policies per table and confirm there is no policy that allows `anon` to read or write app tables, and that `admin_emails` has no policy. Confirm `report_module(id)` maps ids like `mo%` to the monthly module and the functions `perm_level()` and `perm_max()` exist.
4. At least one approved admin exists in `profiles` (`is_admin and approved`). Count of profiles waiting for approval. Do not list emails, only counts.
5. Realtime is enabled for the app tables (publication `supabase_realtime`).
6. Extensions and settings: report nothing secret; only whether the Edge Functions `notify-approval`, `weekly-draft`, `jira-sync`, `jira-search` are deployed (name and status only).

## 2. Data integrity
7. Ids: no duplicate ids by case (`lower(id)` repeated) in any table; no id with leading or trailing spaces.
8. `updated_at` is not in the future and not older than the table's oldest legitimate row; count rows changed in the last 24 hours per table (for activity).
9. JSON shape per table (count rows that break the rule):
   - `people`: every visible row has a non-empty `n`; rows with `hidden: true` have `n`; no two **visible** rows with the same `n` (case-insensitive).
   - `items`: `res` is an array of strings when present; `pd` is an object whose keys are person names; dates are numbers or ISO strings, never null strings.
   - `vacations`: `p` (person), `a0` and `a1` are dates, `a1 >= a0`.
   - `sprint_items`: `sp` points to an existing sprint; `k` is one of h, p, s, u, n; `ord` is a number; `jk`, when present, looks like `ABC-123`.
   - `sprints`: `n`, `a`, `b` present, `b >= a`.
   - `reports` monthly docs `mo<yyyymm>`: `mo` equals the id's month, `lines` is an array, every line has an `id` and a title `t`, no duplicate card `id` inside a month, no card id repeated across two different months unless it is a version copy.
10. Points: for every month card with `who`: each person's points is one of 0, 1, 2, 3, 5, 8, 13, 21; `pts[track]` equals the sum of `who[track]`; no `who` track without `pts`; no negative values. List the cards that break a rule.
11. `needs` on a card points to a card id that exists, and not to itself.
12. Version history: for each month, count of automatic slots used (`mohist<yyyymm>_a0..a14`) is at most 15; every version has `hist: 1`, `of`, `at`, `doc`; no version has a top-level `status` field or an `mo` field (viewers must not be able to read versions). Report the newest version time per month and flag a month whose newest version is older than its last save by more than a day.
13. Orphans: `sprint_items` whose sprint does not exist; `items` overrides whose feature id is not in any roadmap (report the count only, these can be old); `reports` weekly docs whose `sp` sprint is missing.

## 3. Names and people (after the 2026-10-28 rename)
14. Search every table and field below for any **old spelling** as a whole value or a whole object key: Tramsi, Altramsi (alone), Sahdy, Shady (alone), Waradny, Wardany (alone), Hamid, Hamid Shahin, Hosieny, Dina Sam, Samy, Khalid (alone), Saad (alone), Mona (alone), Amal (alone), Sayeh (alone), Adnan (alone), Soliman (alone), Zahran (alone), Aliaa (alone), Abdelhamid (alone). Fields: `people.n`, `items` `res` and `pd` keys, `vacations.p`, `sprint_items.t` (when `k = 'p'`), `ideas` (`peopleorder.ord`, `peoplehide.byRm`, timeline notes `p`, `capacity.lanes[].people`, `capacity.leaving` keys, `capacity.part` keys), `reports` monthly `who` keys. Expect zero. The activity log is history and is excluded.
15. Visible people: list the visible names per Dashboard track (from `ideas/capacity.lanes`, or say it does not exist). Flag any name in a track that has no visible `people` row or built-in team entry, and any visible person with a Backend, Frontend, Mobile, QA, UX / Design or AI / ML domain who is in no track (report as information, not as a fault: managers and others are fine).
16. Leavers and part time: list `leaving` and `part` entries (names and values only). Flag a `leaving` date in the past that still has features after it (count of `items` for that person with an end date after the last working day), and any `part` value outside 0.1 to 0.99.

## 4. Size, growth and performance
17. Size of each table (rows and total MB) and the 5 biggest rows by `pg_column_size(data)`; flag any row above 500 KB (the app loads whole tables).
18. `activity` growth: rows per day for the last 14 days, and the share of rows with an undo payload `u`; flag if the table is above 20,000 rows or 40 MB (suggest an archive, do not delete).
19. Index and vacuum: list tables without a primary key, and tables with more than 20% dead tuples.
20. Slow queries: if `pg_stat_statements` is available, the top 5 by total time (text trimmed to 100 characters); otherwise say it is not available.

## 5. Backups and cleanup
21. Point-in-time recovery or daily backups: say what is enabled and the time of the latest backup (the dashboard shows it). If neither is on, mark FAIL.
22. List all tables named `backup_*` with their row counts and creation date if known, and say whether RLS is on. Recommend dropping them only after the owner confirms.
23. Storage buckets (if any): names, public or private, total size.

## 6. Report format
Give a table: check number, name, PASS / WARN / FAIL, count, one-line note. Then "Recommended actions" in priority order (security first, then data errors, then clean-up), each with the exact change you would make, and **wait for approval**. Do not run any of them.
