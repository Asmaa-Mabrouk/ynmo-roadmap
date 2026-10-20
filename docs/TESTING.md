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

Areas: Auth · Roadmap editing · Ideas · Resources · Vacations · Capacity · Baselines · Log/undo · Sharing/viewer · Multi-user (M*) · Security (S*) · Responsive.
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
- `monthly_page.py` (25) and `tests/monthly_unit.mjs` (22, plain Node, no browser): delete a report (menu and page, confirm), the Monthly page, Sync from Roadmap with estimated percentages (edited ones kept), ad hoc requests, undo, copy text, submit/read-only, month shown in the weekly report, delete month, phone width.
- `jira_pull.py`: the fake client answers `functions.invoke('jira-sync')` from `window.__jira` (or fails with `window.__jiraFail`).
- `google_drive.py`, `gdoc_export.py`: a fake Google Identity Services script and a routed Drive API; no real Google call is made.
- `prod_colors_sections.py`, `colors_remove.py`, `drag_rows.py`, `notes.py`, `sprint_scroll.py` (fails on the old code), plus the older `t*.py` scripts.
Not covered by automation: the real Jira, Google sign-in/Drive and Gemini services. Check them once by hand after go-live (Pull from Jira on a real sprint; Export to Google Docs as a normal user; Generate with AI).

Playwright gotchas: `page.evaluate("a;b=(u)=>{}")` calls a returned arrow function, so wrap statements as `()=>{...}`; menus are `.cmenu`; `todayK` is a number, not a function; the Reports page opens on a list, so tests click a `.rpcard a.splink` first.

## Adding a test
Use the `@T(area, id, title)` decorator in `tests/e2e_qa.py`, helpers `signup/login/nav/newpage`; keep scenarios independent (unique emails).
