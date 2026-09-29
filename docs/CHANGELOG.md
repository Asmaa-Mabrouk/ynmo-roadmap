# Changelog

## Unreleased – Engineering hygiene
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
