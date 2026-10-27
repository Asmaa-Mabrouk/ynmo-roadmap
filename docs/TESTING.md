# Testing

## Automated E2E (Playwright, Python)
```bash
pip install playwright && playwright install chromium
node build.mjs
tests/run_all.sh                   # build check + lint + feature scripts + CSP check + 88 scenarios
python3 tests/e2e_qa.py            # only the 88 scenarios; results in tests/out/qa_results.json
```
`tests/fake-supabase.js` replaces the real client in the browser (route intercept of `vendor/supabase-js.js`): an in-`localStorage`
Postgres/Auth/Realtime/RPC fake, so **no real project is touched** and multi-user scenarios run with two tabs.
The fake does not enforce RLS – RLS is verified manually (below).

Areas: Auth · Roadmap editing · Resources · Vacations · Monthly deliverables · Log/undo · Sharing/viewer · Multi-user (M*) · Security (S*) · Responsive.
All 88 scenarios are expected to pass.

## Test handles
The bundle is an IIFE, so tests reach internals through `window.__ynmo` (`items, directory, allRoadmaps, commit, removeItem, render, renderSprints, LANES, state, S, NDAYS, vacs`) defined in `src/esm/main.js`.

## Static checks
- `node lint.mjs` – module graph: missing imports/exports, undefined identifiers.
- `node build.mjs --check` – generated file matches `src/`.
- Syntax: extract the inline script and run `node --check`.
- CSP: serve the repo with `vercel.json` headers and confirm no violations in the console.
- Accessibility: axe-core on each page (only known contrast note: the "High" tag).

## Manual RLS checklist (real Supabase, 3 accounts: admin, editor, viewer)
1. Viewer: `PATCH items` via REST → 403/empty. 2. Editor: cannot set own `is_admin/approved`. 3. Editor: cannot insert `activity` with another `uid`.
4. Anyone: `UPDATE baselines set data = …` (other than `active`) → error. 5. Anonymous: `select * from items` → 0 rows; `rpc('shared_snapshot', {t:'bad'})` → null.
6. Unapproved user sees nothing.

7. Weekly report: as viewer, `select` on `reports` returns submitted rows only and `sprints`/`sprint_items` return none; as viewer, inserting/updating a report fails; calling `weekly-draft` as a viewer returns 403.

`tests/features/*.py` are focused scripts that print `PASS`/`FAIL` lines; `run_all.sh` fails on any `FAIL`. Key ones:
- `sprints_reports.py` (98): sprint document, report list and sheet (open a card, breadcrumb, Back), AI with a fake function (`window.__aiFail` simulates an outage), undo, viewers see only submitted reports, phone width.
- `qa_monthly_edge.py`, `qa_permissions_edge.py`, `qa_permissions_save.py` (QA: Monthly edge cases, view-only and live access changes, permissions really saved with and without the perms column; the fake database can simulate a missing column with `window.__noPerms`), `permissions_page.py`, `monthly_undo_users.py`, `tests/permissions_unit.mjs` and `tests/month_undo_unit.mjs` (permissions and per-user undo), `monthly_page.py` (add to roadmap, card ids, note bubble, no sync) and `tests/monthly_unit.mjs` (plain Node, no browser): delete a report (menu and page, confirm), the Monthly deliverables board (columns, add month, cards coloured by product, percentage colours, Sync from Roadmap per month without ever repeating a feature, move/delete cards, ad hoc, copy text, delete month, read-only for executives, phone width).
- `feature_link.py` (24 checks) and `tests/feature_link_unit.mjs`: linked features, admin approval, Check updates, Keep mine, reject.
- `smoke_monthly_exec.py` (14 checks): the executive demo path. An admin prepares a board (cards, percentages, flag, backlog, a card on the roadmap) and an executive (Viewer) reads it: everything visible, no editing control or internal wording, read-only backlog, phone width. Screenshots go to `tests/out/smoke_*.png`.
- `monthly_details.py` (15 checks): card details and the info icon (editor writes, executive reads, tooltip, Undo, long text) and the name on hover of online avatars.
- `login_hang.py` (6 checks): a sign-in check that never answers ends in the recovery screen (Try again / Sign out and start fresh); a normal start shows the login form at once.
- `jira_link.py` (14 checks): the Jira link picker on sprint tasks (live search, key search, pick, status, unlink, no match, Jira errors). Fake Jira only.
- `monthly_sort.py` (10 checks): the Sort by product button orders every column Tifli, AI, Daycare, Plan, SCHS, Warif, is remembered after reload, works with the product filter, is available to executives, and leaves the saved order untouched when switched off.
- `jira_pull.py`: the fake client answers `functions.invoke('jira-sync')` from `window.__jira` (or fails with `window.__jiraFail`).
- `google_drive.py`, `gdoc_export.py`: a fake Google Identity Services script and a routed Drive API; no real Google call is made.
- `prod_colors_sections.py`, `colors_remove.py`, `drag_rows.py`, `notes.py`, `sprint_scroll.py` (fails on the old code), plus the older `t*.py` scripts.
Not covered by automation: the real Jira, Google sign-in/Drive and Gemini services. Check them once by hand after go-live (Pull from Jira on a real sprint; Export to Google Docs as a normal user; Generate with AI).

Playwright gotchas: `page.evaluate("a;b=(u)=>{}")` calls a returned arrow function, so wrap statements as `()=>{...}`; menus are `.cmenu`; `todayK` is a number, not a function; the Reports page opens on a list, so tests click a `.rpcard a.splink` first.

## Adding a test
Use the `@T(area, id, title)` decorator in `tests/e2e_qa.py`, helpers `signup/login/nav/newpage`; keep scenarios independent (unique emails).
