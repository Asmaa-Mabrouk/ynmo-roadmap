# Database (Supabase / Postgres)

Run the scripts in `supabase/sql/` **in order**. All are safe to re-run. The SQL Editor runs a script in **one transaction**:
if any statement fails nothing from that script is applied.

| File | Adds |
|---|---|
| 01-setup-base | Generic doc tables `items, people, daysoff, roadmaps, ideas, vacations, activity`; first RLS |
| 02-auth-profiles-approval | `profiles`, `is_approved()`, `is_admin()`, `handle_new_user()` trigger, `guard_profile()`, approval RLS |
| 03-admin-emails | `admin_emails` allow-list; auto-admin on sign-up; back-fills existing admins |
| 04-roles-baselines-sharing | `profiles.access` (editor/viewer), `is_editor()`, editor-only writes, `baselines`, `share_links`, `shared_snapshot(t)` RPC, realtime publication |
| 05-security-hardening | Admin only after **confirmed** email; forge-proof activity log; immutable baselines; profile length limits; private presence channel policies |

## Tables

> Data state (2026-10-29): the team names in `items`, `people`, `vacations`, `sprint_items`, `ideas` and `reports` use the official spelling (migrated 2026-10-28; backups `backup_20261028_*` and `backup_20261028b_*` still exist and should be dropped when the team confirms). Health check: `docs/DB_HEALTH_CHECK_PROMPT.md`. Other agent prompts: `DB_AGENT_PROMPT.md` (settings, points, version history) and `DB_RENAME_PEOPLE_PROMPT.md` (the rename, applied).
Generic document tables: `id text PK, data jsonb, updated_at timestamptz, updated_by text`.
| Table | Holds |
|---|---|
| items | Per-feature overrides (dates, status, assignees, `dep`, `ms`, `pd` = per-person dates `{name:[d0,d1]}`, …) keyed by feature id |
| people | Team directory |
| daysoff | Time off per person |
| roadmaps | Roadmap definitions (name, range, kind) |
| ideas | Idea cards **and** meta docs: `col…` custom columns, `cfg_<lane>` built-in overrides, `colorder`, `peopleorder` (row order of the by-person roadmap), `peoplehide` (people hidden per roadmap: `byRm`), `tn-…` = timeline notes (`tn:true, rm, k:'person'|'period', p, a0, a1 (ISO), t, c`), `squadnames` (`names:{key:name}`, `colors:{key:#rrggbb}`, `extra:[{k,n,c}]` = added products; applied to `LANES` by `features/squad-names.js`), `reportcfg` (`products:[{k,n,squads}]`, `jira` base address for ticket links), `googlecfg` (`cid` = Google OAuth Client ID, public, set by an admin) |
| vacations | Leave entries |
| activity | Append-only audit log (`u` = undo payload, `ref` marks undone entries) |
| baselines | Frozen snapshots (no longer used by the app since the Baselines module was removed; the table and its data are kept) |
| sprints | Sprint definitions `sp<n>`: `{n, a, b, note, tags:{name:colour}, gdoc?, gdocId?}` (`gdoc` = linked Google Doc address, `gdocId` = doc created by the tool through Drive). The first version's `secs` is converted once. Editors/admins only |
| sprint_items | Outline blocks `{sp, k, sq, t, st, dn, tags[], ord, jk?}`: `k` = h (product section; `sq` = squad key or `x_deploy` / `x_quality`), p (person), s (scope), u (sub-section), n (note, never exported); `jk` = Jira key of a pulled ticket; `dn` = date marked done. Rows from the first version (`squad/person/par`) are converted when the sprint is opened. Editors/admins only |
| profiles.perms | jsonb `{roadmap:0..3, roadmaps, sprints, reports, monthly, resources, vacations, log}` (0 none, 1 view, 2 edit, 3 delete); null = the older `access` rule. Added by SQL 08, with `perm_level()`, `perm_max()`, `report_module()` and the guard that stops the last admin being removed |
| reports | Weekly reports `rp<yyyymmdd of week start>`: `{sp, n, a, b, status draft/submitted, pl, prods{key:{sum,sumEdited,items[]}}, ai, subBy, subAt}`, and monthly deliverables `mo<yyyymm>`: `{mo:'YYYY-MM', status, pl, lines:[{id,no,k,t,pct,w,adhoc,by,at,src,pe,hp,sz,note,rid,rm}], syncAt, subBy, subAt}` (`k` product key, `pct` percent complete, `w` importance 1 to 3, `adhoc` + `by` + `at` = a request added during the month, `no` = card number (shown as DC#no), `rid` + `rm` = the roadmap bar and roadmap made from the card, `src` = older cards synced from the roadmap, `pe` = percentage edited by a person so a sync keeps it, `hp` = business priority (gold flag), `sz` = 'quick' (quick win) or 'enh' (small enhancement, the star), `note` = card note). Editors read/write; approved viewers read `submitted` (= Saved) only; any editor can delete (RLS in sql/06, relaxed by sql/07) |
| (fields) linked features | Month card: `rid` (bar), `lk {t,pct}` (hidden record). Report item: `fid` (card id), `lk {t,pct}`. Roadmap bar (`items/<id>`): `pc` progress 0-100, `card` (card id). No schema change. |
| (fields) card details | Month card `info`: plain text, up to 4000 characters. |
| share_links | Public share tokens (readable only by approved members) |
| profiles | `id → auth.users`, email, name, role, avatar, `approved`, `is_admin`, `access` |
| admin_emails | Emails auto-promoted to admin after confirming (no policy ⇒ unreadable from the app) |

## Functions & triggers
| Name | Purpose |
|---|---|
| `is_approved()` / `is_admin()` / `is_editor()` | Security-definer predicates used by every policy |
| `handle_new_user()` (on auth.users insert) | Creates profile; admin only if email already confirmed |
| `promote_confirmed_admin()` (on email confirmed) | Promotes allow-listed emails after confirmation |
| `guard_profile()` | Users can't self-approve, self-promote or change `access`; only admins can |
| `guard_baseline()` | Snapshot content immutable; only `active` may change |
| `shared_snapshot(t)` | RPC for anonymous read-only links: validates token, returns one roadmap's data |

## RLS summary
- Read: any **approved** user. Write (insert/update/delete): **editor** (`is_editor()`); admins are editors.
- `activity` insert: editor and `data.uid = auth.uid()` (cannot forge another user).
- `baselines` delete: admin only. `profiles`: users read/update own row (guarded); admins update any.
- `realtime.messages`: channel `ynmo-presence` for approved users (created via 05, or Dashboard → Realtime → Policies).
- Anonymous visitors have **no** table access; only the `shared_snapshot` RPC.

## Realtime
Publication includes the doc tables; the client subscribes per table. Presence uses a private channel. Turn **off**
"Allow public access" in Dashboard → Realtime → Settings.

## Adding a new collection
1. `create table public.<name> (like public.items including all);`
2. Enable RLS + copy the read/editor-write policies from 04.
3. `alter publication supabase_realtime add table public.<name>;`
4. Use `db.collection`-style access via `makeDb()` in a new `src/esm` module; log changes with `logAct`.


Note (sprint document): `sprint_items` docs are now blocks `{sp,k,sq,t,st,dn,tags[],ord}` (k = h|p|s|u|n). Pulled Jira tickets carry `jk` (the Jira key, used to avoid duplicates; shown as the report's Jira reference). Rows saved by the first version (`squad/person/par`) are converted once when the sprint is opened. `sprints` docs gain `tags:{name:colour}` and optional `gdoc` (linked Google Doc address) / `gdocId` (set when the tool created that doc through Google Drive). Meta doc `ideas/googlecfg` = `{cfg:true, cid}` (Google OAuth Client ID, public). No SQL change.


### Concurrent edits of one month (2026-10-27)
A month is one document (`reports/mo<yyyymm>`). Each save reads the stored month first and keeps cards the screen has never seen (`writeMonth` in `pages/monthly.js`). Two people editing the **same card** at the same moment is still last-writer-wins; per-card documents would remove that and are not built. Free-tier Supabase has no point-in-time recovery, so a card lost before this change cannot be restored from the database (see the recovery steps in LEDGER 2026-10-27).


### Month versions (2026-10-28)
Docs `reports/mohist<yyyymm>_a<0-14>` (automatic: 15 slots per month, the oldest is overwritten) and `mohist<yyyymm>_n<rand><time>` (named): `{hist:1, of:'yyyy-mm', at, by, n (cards), named, name, doc (the month doc as it was)}`. The id starts with `mo`, so SQL 08 treats it as Monthly (editors write, others read); there is no `mo` field, so the board and weekly reports ignore it. The app keeps them out of `S.reports` (in `S.hist`). Nothing is deleted by the app. Agent prompt to check all of this: `docs/DB_AGENT_PROMPT.md`. No SQL change.
### Capacity (2026-10-27)
Card fields in the month doc: `who` {track: {name: points}} (points per person), `pts` {ai, fe, mob, be, pm, des, qa: points} (the total of each track, derived from `who`), `needs` (internal id of another card). Settings doc `ideas/capacity` {cfg: true, ppp, reserve, buffer, lanes: [{k, people: [...]}], leaving: {name: 'YYYY-MM-DD'}, part: {name: 0.1 to 0.99}}; missing values use the defaults in `features/capacity.js`. A lane saved here holds the people of that track; Resources > Add member / Manage and the roadmap's + Add person write it (saving all six lanes at once), and editors may write it under the existing `ideas` policy. No SQL change.

- Monthly cards may carry `co: {from: 'yyyy-mm', why, by, at}` (the carry-over tag). No SQL change.
### Browser outbox (2026-10-27)
`localStorage` key `ynmo-outbox` holds writes the server has not confirmed yet ({path: {copy, part, u, seq, at}}). Entries are removed once the server confirms, when the table is missing or the person has view-only access. `replayOutbox()` sends them again at start and every 30 s. Error classes (`core/supabase.js`): `temporary` (PGRST002, 503, "schema cache ... Retrying") is retried; `missing_table` only for PGRST205 / 42P01 / "Could not find the table".
