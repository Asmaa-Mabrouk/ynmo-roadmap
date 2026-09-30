# Changelog

## Unreleased – Sprints + Weekly executive report
- **Sprints page** (editors/admins): two-week sprints, work items grouped squad > person, quick add, bulk paste (bullets and Jira keys recognised), carry over unfinished items.
- **Weekly report page:** one report per WEEK (two per sprint, `rp<yyyymmdd>`) with a section per product, built from the sprint plan + the roadmap bars that overlap the week; optional Gemini wording through the `weekly-draft` Edge Function; every line/summary is editable and **manual edits always win** on re-sync and AI; executive view = gradient header, per-product status tiles and colour-coded read-only sections; items marked done get a date so an item finished in week 1 is not repeated as news in week 2; Copy text and Print/PDF; report settings (product to squad mapping, Jira base URL). Admins and editors can submit/reopen; viewers (executives) see submitted reports only.
- New tables `sprints`, `sprint_items`, `reports` (sql/06); new Edge Function `weekly-draft` (secret `GEMINI_API_KEY`); new log filters Sprints/Reports; new test `tests/features/sprints_reports.py`.

- **Weekly report UX:** sparkle "Generate with AI" button (gradient, visually the main action); explicit errors instead of silent fallbacks (no data for the week, AI function not deployed, key missing, not allowed); the AI is never called without data; the report shows what it was built from; a red "Database setup needed" banner when SQL 06 has not been run (previously shown as a misleading "offline" banner).

## Engineering hygiene
- **Person rows:** drag grip (⋮⋮) to reorder rows and a ⋯ menu (Move up/down, Hide from this roadmap) in the by-person roadmap; order shared via `ideas/peopleorder`, hidden rows per roadmap via `ideas/peoplehide` (only empty rows; "Show hidden" restores).
- **Fixes from the live QA run:** a realtime refresh could revert an edit that was still being saved (new roadmap not selected for Editors, column "Move left" appearing to do nothing) - now unsaved local documents are kept (`snapDocs`); deleting a roadmap returns its scheduled ideas to the backlog; leaving a dead share link by URL works; stale vacation notice cleared; "1 dependency" wording; partial-leave weeks flagged on Capacity (⚑); schedule/remove-column confirmations; reversed-date explanation; edit hint hidden for viewers/shared; rename box no longer clipped on narrow bars.
- Test suite consolidated: `tests/run_all.sh` (build check, lint, feature scripts, CSP check on `dist/`, 88 scenarios) – all green.
- **Native ES modules** (`src/esm`, 31 modules) with explicit imports/exports; shared mutable state consolidated in `core/state.js`; `lint.mjs` guards the module graph; esbuild bundles to the single-file deploy.
- Fixed latent name clash: the undo stack was called `history` (shadowing `window.history`); now `S.undoStack`.
- Source split into `src/` modules + `build.mjs`; `index.html` is now generated.
- SQL moved to `supabase/sql/01…05` (renamed from `supabase-setup*.sql`); docs added; E2E suite added to repo.
- Removed dead code (`openClear`, empty `online` listener). 05 no longer alters `realtime.messages` (fixes error 42501).

## Security hardening
Webhook secret, self-hosted pinned supabase-js, CSP + headers, forge-proof activity log, admin-after-confirmation, immutable baselines, private presence channel, colour validation.

## Ideas board
Editable/recolourable/reorderable columns, drag cards between products; overlap fixes; "Clear all" button removed.

## UX
Styled dropdowns, CEO/CTO/Executive job types, loading animations, hash routes for auth screens, clearer email rate-limit errors, responsive nav.

## Collaboration & governance
Viewer role + public read-only links, presence + soft lock, dependencies & milestones, capacity page, baselines + "Plan vs now", log export/undo/load-older, password meter, idle timeout, sign-out-everywhere, offline banner.

## Foundation
Gantt roadmap, multiple roadmaps, ideas, resources, vacations, log, Supabase auth with admin approval.
