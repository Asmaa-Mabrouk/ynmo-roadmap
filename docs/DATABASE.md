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
Generic document tables: `id text PK, data jsonb, updated_at timestamptz, updated_by text`.
| Table | Holds |
|---|---|
| items | Per-feature overrides (dates, status, assignees, `dep`, `ms`, …) keyed by feature id |
| people | Team directory |
| daysoff | Time off per person |
| roadmaps | Roadmap definitions (name, range, kind) |
| ideas | Idea cards **and** meta docs: `col…` custom columns, `cfg_<lane>` built-in overrides, `colorder` |
| vacations | Leave entries |
| activity | Append-only audit log (`u` = undo payload, `ref` marks undone entries) |
| baselines | Frozen snapshots (`active` flag is the only mutable field) |
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
4. Use `db.collection`-style access via `makeDb()` in a new `src/js` module; log changes with `logAct`.
