# Contributing & Clean-Code Rules

## Workflow
Branch → edit `src/` → `node build.mjs && node lint.mjs` → tests → commit `src/` **and** generated `index.html` → PR/push. Commit style: `type: summary` (`feat`, `fix`, `docs`, `refactor`, `security`, `test`).

## Code rules
1. **Every file starts with a `@module` header** (purpose + responsibilities). Every non-trivial function gets a short JSDoc (`@param`, `@returns`) explaining *why*, not what.
2. **Small functions, one job.** Prefer early returns. If a function needs a section comment inside, split it.
3. **No dead code.** Delete instead of commenting out (git remembers).
4. **Naming:** `camelCase` functions/vars, `UPPER_SNAKE` constants, `render*` draws a page, `open*` opens a dialog/popup, `bind*/wire*` attach listeners, `*Of/*For` are pure lookups.
5. **DOM safety:** build nodes with `el()` and `textContent`. Never concatenate user data into `innerHTML`.
6. **Permissions:** first line of any mutation is `if (!canWrite()) return;`. The DB must also enforce it – add/adjust RLS in `supabase/sql`.
7. **Every user-visible mutation calls `logAct(act, summary, undoPayload)`** so it appears in the Log and can be undone.
8. **Persist via `commit()`/`persist()`/`write()`** – never call `sb.from()` directly outside `core/supabase.js`.
9. **Dates:** ISO `YYYY-MM-DD` strings, UTC math only (`parseIso`, `iso`, `dayFromIso`).
10. **Colours & tokens:** CSS variables from `css/brand.css`; no hard-coded brand hex in JS except validated user colours.
11. **Accessibility:** buttons are `<button>`, dialogs via `openDlg` (focus trap + Esc), aria-labels for icon buttons, keep contrast ≥ AA.
12. **CSP-friendly:** no external scripts/styles other than Google Fonts; no `eval`.
13. **Explicit dependencies:** `import` what you use and `export` only what other modules need. State reassigned by more than one module goes on `S` (`core/state.js`). No new `window.*` globals. Run `node lint.mjs`.
14. **SQL:** idempotent (`if not exists`, `drop policy if exists`), numbered file, comment every section, never require ownership of Supabase-managed tables.
15. **Secrets:** none in the repo, chat or tickets (publishable key only).

## Adding a feature (checklist)
- [ ] New module under the right folder in `src/esm/` with `@module` header, imported from `main.js` if it registers listeners at load time
- [ ] Permission check + `logAct` (+ undo payload if reversible)
- [ ] Viewer behaviour decided (`VIEWER_PAGES` in `app/shell.js` for read-only pages)
- [ ] SQL migration + RLS if it needs storage
- [ ] Mobile layout checked (≤ 600 px) and keyboard usable
- [ ] E2E test added · docs updated (BUSINESS feature table, DATABASE if schema changed, CHANGELOG)

## Definition of done
Builds clean, tests pass (only the known 3 artifacts), no console errors, docs and changelog updated, no secrets, RLS reviewed.
