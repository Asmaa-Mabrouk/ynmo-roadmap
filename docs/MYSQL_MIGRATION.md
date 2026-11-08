# Self-hosting on MySQL (requirement from YNMO, 2026-11-08)

YNMO needs the database hosted on its own side, as **MySQL**. Today the tool runs on Supabase (PostgreSQL). Supabase is not only a database: the move means rebuilding what it gives us.

## What Supabase gives us today, and the MySQL-side replacement
| Today (Supabase) | Used for | Replacement |
|---|---|---|
| PostgreSQL, `{id, data jsonb}` tables | all data | MySQL 8, `{id VARCHAR PK, data JSON}`; DDL from `supabase/sql/01-11` rewritten (no `like ... including all`, no `jsonb`, no `security definer`) |
| Row level security + `perm_level()` / `is_editor()` / `is_admin()` | who can read / edit / delete per module | middleware in the API with the same rules (levels 1 view, 2 edit, 3 delete) |
| Auth (email + password, approval, profiles) | sign in, approval flow | API login (sessions or JWT); SSO if YNMO uses Google / Microsoft |
| Realtime | other people's changes appear live | WebSocket or SSE from the API (polling is already the fallback in `core/supabase.js`) |
| Storage (`flow-files`) | ticket attachments | folder or S3-compatible (MinIO), short-lived signed links |
| Edge Functions | `weekly-draft`, `flow-ai`, `flow-notify`, `notify-approval`, `jira-sync`, `jira-search` | endpoints in the API (same code, no Deno-specific parts) |
| Secrets | API keys, SMTP | environment variables of the API (never in the repo) |

## Why this is feasible
The pages never talk to Supabase directly: they use the small layer in `src/esm/core/supabase.js` (`collection(name).onSnapshot`, `write(path, data)`, `functions.invoke`, `storage.from`). `tests/fake-supabase.js` already proves a second backend can sit behind it. The plan is a second adapter, selected by one setting, so the screens and their ~100 tests stay as they are.

## Answers received from YNMO (2026-11-08)
- Runtime: **Docker** (we deliver a Docker Compose package).
- Database: **MySQL 8**.
- Attachments: **Google Cloud Storage (GCP)**. The API will write to a private bucket and hand out short-lived signed URLs (the same behaviour as the current `flow-files` bucket); credentials come from a service account set on the server, never in the repo.
- Still open: sign-in (SSO or email + password), AI allowed or not, cutover date and window. Assumed until answered: email + password with admin approval, AI switchable off, SMTP relay from environment variables.

## Proposed phases ("Phase 7")
1. **Decide**: backend language of the YNMO team, auth (SSO or password), where it runs (internal servers or cloud), who operates it.
2. **Spec + schema**: adapter contract (the calls above), MySQL DDL for all tables, import script from the Supabase backup (`scripts/export-backup.mjs`).
3. **API + Docker Compose** (MySQL, API, MinIO), permission rules ported with unit tests.
4. **Run the whole test suite against the new backend** (same tests, new adapter) before any real data moves.
5. **Cutover**: freeze, export, import, switch the setting, keep Supabase read-only for a week.

## Until then
Keep new features backend-neutral: data in `{id, data}` documents, rules in `src/esm/features/*` (pure), server logic small and in functions that can move to an API. SQL files in `supabase/sql` stay the source of truth for the Supabase version.
