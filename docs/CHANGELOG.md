# Changelog

## Unreleased – Sprints + Weekly executive report
- **Weekly report without the "Next" list; coloured percentages (2026-10-20):** the long "Next" group (every planned item) is no longer part of the weekly report; the report keeps Delivered, In progress, Risks & decisions and Roadmap milestones. Percentages on the Monthly page are colour-coded: 1 to 50 yellow, 51 to 99 orange, 100 green (0 grey).
- **Monthly page and Delete report (2026-10-20):** a Notion-style **Monthly** page like Sprints (list of month cards, then a white sheet; easy to present to executives). "Sync from Roadmap" brings the month's roadmap features per product with an estimated, editable percentage (edited values are never overwritten by a later sync); importance weights, ad hoc requests with requester, carry-forward of unfinished items, undo, copy text, print/PDF, submit/reopen, delete. The weekly report shows the month read-only (replacing the editor that sat inside the report). **Delete report** from the list menu and the report page (editors delete drafts, admins also submitted). No SQL change.
- **Docs refreshed:** README, ARCHITECTURE (sections 3 and 10), BUSINESS, DATABASE, SECURITY, DEPLOYMENT (Google setup details and troubleshooting), TESTING, and a new `LEDGER.md` (decision log, current setup state, open items).
- **Reports redesigned like Sprints:** `#/reports` is now a list of cards (one per week: dates, sprint, Draft/Submitted chip, product chips in their colours, delivered / in progress / at risk with a progress bar, a ⋯ menu with Open in new tab and Copy text). A card opens `#/reports/<id>` as a white sheet with a breadcrumb, the same toolbar row as a sprint, a flat title block, product tiles and product sections headed in the product colour (view-only for viewers and submitted reports). Lines are quiet until hovered. Nothing about the data changed: same `reports/<id>` docs, AI wording, undo, submit/reopen, settings, print/PDF. Deep links to a report work, browser Back returns to the list, and viewers can only open submitted reports.
- **Timeline notes (not features):** right-click a person's row > "Add note for <name>" puts an arrow-ended ribbon above their bars (for example "Full stack: backend + frontend"); right-click the date header > "Add period note" adds a chip in a new Notes row plus a tinted band over all rows (for example "Eid: many vacations"); the Notes row also shows an automatic leave heat strip (how many people are on leave each day, hover for names) from the Vacations data. Notes are draggable and resizable, editable by click, deletable, included in the PDF, kept when a person is renamed, and are never counted in the summary, overlap warnings or the weekly report. Stored as `ideas/tn-…` docs (`cfg:true, tn:true`), no SQL change. Test: `tests/features/notes.py`.
- **Roadmap toolbar:** removed Share, Export CSV and Today. Sharing a read-only link now lives on each card of the Roadmaps page (Share button). New **Export PDF**: a coloured, full-timeline A3-landscape layout (title, date range, summary tiles, product and status legend, one row per person with every bar scaled to the page width, today line, filters noted) opened in the print dialog; choose "Save as PDF". Header rows repeat on every page. Test: `tests/features/pdf_export.py`.
- **Dropdown search hardened:** matching ignores accents and Arabic letter variants and accepts several words; typing on a focused dropdown opens it with the typed text; the popup no longer closes when a phone keyboard changes the screen height; search works in the sprint menus and the assign-people list too.
- **Products module (Resources):** Tifli's default colour is now magenta (`#c2257f`) so it no longer looks like Daycare. Each product has a colour button (any colour) and an editable name, built-ins can be reset, and new products can be added with a name and a colour (they appear as roadmap filter chips, in the add-member and sprint menus, and bars use their colour). A product can be removed only when no roadmap feature uses it. The roadmap filter chips now redraw when products change. Test: `tests/features/products.py`. Note: a new product is not part of the weekly report until it is ticked in Report settings.
- **Drag a bar between people:** the chart now scrolls while a bar is held near its top, bottom or sides, so rows that start out of view can be reached; the drag tip names the target person ("· to Mona"). Test: `tests/features/drag_rows.py`.
- **Per-person dates on a shared epic:** when an epic has several owners, resizing, moving, arrow-keying or dating one person's bar changes only that person's dates (one may take longer, another only supports). Stored as `pd: {person: [d0, d1]}` on the item (no SQL change); the item's own `d0/d1` become the span of all owners so reports and the squad view still work. Editing in the squad view (no owner) moves everyone together; going down to one owner drops `pd`. Test: `tests/features/person_dates.py`.
- **Add member on Resources:** choose which roadmaps get a row for the new person (all by default; unticked ones hide the row via `ideas/peoplehide`). A name that was already added from the roadmap's "+ Add person" is not duplicated: the existing person is just shown on the chosen roadmaps. Test: `tests/features/add_member.py`.
- **Bar colours:** the bar menu now has a 52-colour palette plus a rainbow "pick any colour" circle. Stored as `#rrggbb` (validated) next to the old `p1..p6` keys; text colour switches to dark on light bars.
- **Removing a team member:** a confirmation dialog first; if the member still owns features on any roadmap, removal is blocked with a warning that lists them per roadmap and a button to open that roadmap filtered to the person. Test: `tests/features/colors_remove.py`.
- **Roadmap bars:** hovering (or focusing) a bar shows a card with its full text, squad, dates and status. Overlapping bars stack vertically in creation order, so a newly added bar goes under the existing ones and the row grows, instead of jumping to the top and shifting the others. Test: `tests/features/bar_stack.py`.
- **Rename team members and squads (Resources page):** a ✎ next to each name renames a person everywhere (roadmap features on every roadmap, vacations, sprint `@person` lines, saved row order and hidden rows); a new Squads card renames the four squads (display name only; keys and colours stay) with a Reset button. Duplicates are rejected. Saved in the new meta doc `ideas/squadnames` (no SQL change). Test: `tests/features/rename.py`.
- **Sprints page** (editors/admins): two-week sprints, work items grouped squad > person, quick add, bulk paste (bullets and Jira keys recognised), carry over unfinished items.
- **Weekly report page:** one report per WEEK (two per sprint, `rp<yyyymmdd>`) with a section per product, built from the sprint plan + the roadmap bars that overlap the week; optional Gemini wording through the `weekly-draft` Edge Function; every line/summary is editable and **manual edits always win** on re-sync and AI; executive view = gradient header, per-product status tiles and colour-coded read-only sections; items marked done get a date so an item finished in week 1 is not repeated as news in week 2; Copy text and Print/PDF; report settings (product to squad mapping, Jira base URL). Admins and editors can submit/reopen; viewers (executives) see submitted reports only.
- New tables `sprints`, `sprint_items`, `reports` (sql/06); new Edge Function `weekly-draft` (secret `GEMINI_API_KEY`); new log filters Sprints/Reports; new test `tests/features/sprints_reports.py`.

- **Weekly report UX:** sparkle "Generate with AI" button (gradient, visually the main action); explicit errors instead of silent fallbacks (no data for the week, AI function not deployed, key missing, not allowed); the AI is never called without data; the report shows what it was built from; a red "Database setup needed" banner when SQL 06 has not been run (previously shown as a misleading "offline" banner).

- **Report editing:** large summary box, rich text (bold, italic, underline, bullet/numbered lists, https links) via a shared toolbar, and a multi-line "Add items" box per section (paste a list, one line per item, Jira keys recognised). Rich text is stored as HTML but always rebuilt through a whitelist sanitizer (`features/rich-text.js`) before it is shown.

- **Sprint sheet = same editor as the report:** item titles are rich text (kept when the item flows into the report), each squad/person has a multi-line "Add items" box (one item per line; `Name: item` assigns to that person; Ctrl+Enter adds), and every add box grows while you type.

- **Toast messages** (`ui/notify.js`) for the result of actions: green for success, red for failure (kept 7 s, announced to screen readers). Save failures, view-only rejections and a missing database table now show a toast instead of only the small status text.
- **Sprints restructured:** `#/sprints` is a list of sprints (progress, product chips, Open, Open in new tab, Delete); a sprint has its own page `#/sprints/<id>` with From/To date pickers, product sections > resources (team members) > scopes > sub-sections. A scope's status is derived from its sub-sections. The Jira field was removed everywhere. The weekly report turns a scope with sub-sections into one line with a bullet list.
- **Sprint page is now a document** (`pages/sprints.js`, `features/sprint-doc.js`, `ui/menu.js`): type the plan like in Word. `/` menu (product section, person, scope, sub-section, note), `@` person, `#` coloured tags (click a chip to change its colour or remove it), Tab / Shift+Tab to indent, Enter to split, Backspace on an empty line to delete it, Alt+Up/Down to move a line with what is inside it, and pasting a list creates many lines (a product name is a section, `@Name` a person, deeper indentation a sub-section, `#word` a tag). Status is a searchable pill on each scope and sub-section. Tags `#fix` and `#support` set the type in the report, and tags travel to the report as chips. Sprints written in the first format (`squad/person/par`) are converted once, when opened. `sprint_items` keeps its table; new fields `k`, `sq`, `tags`.
- **Search in every dropdown:** each replaced dropdown (`ui/dropdowns.js`) now has a search box (type, Up/Down, Enter, Esc; "No matches" message). Fixed: opening a dropdown that was partly off-screen could close it at once because focusing it scrolled the page.
- **Cleaner breadcrumb:** `Sprints › Sprint 2` on a sprint page, identical whether it was opened in the same tab, a new tab or a reload. In the list the whole card is one link (Ctrl/Cmd-click or middle-click opens a new tab) and a "⋯" menu holds "Open in new tab" and "Delete sprint".
- **Editable sprint number:** the sprint page has a "Sprint number" field (1 to 9999, must be unique), so the team can start at Sprint 228; title, breadcrumb, list and new reports follow, and "New sprint" continues from the highest number. Carry-over now takes the nearest lower sprint.
- **Notion-like sprint page:** a sprint opens as a clean white page (centred column, no background artwork, light headings). The per-line ✕ is gone: hover a line and use its ⋮⋮ handle for Move up/down, Turn into scope/sub-section/note, and Delete. Backspace on an empty line still deletes it.
- **Undo / redo on the sprint page, per user** (`features/undo-stack.js`): Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z (or Ctrl+Y) and ↶ Undo / ↷ Redo buttons (their tooltip names the step, e.g. "Undo: Delete 3 lines"). Each user has their own history per sprint, kept in the browser session, so undo only reverts that person's own changes; a line someone else changed afterwards is skipped, never overwritten, and reported. One action is one step (a paste, a delete with its inner lines, a move); typing is grouped until a pause. Up to 100 steps; it is empty after a reload.
- **Drag to reorder, Notion-style:** press and drag the ⋮⋮ handle; the picked line (with what is inside it) is highlighted, a green line shows where it will land (above or below the line under the pointer, never inside another line's children), release to drop; Esc cancels; a click without moving still opens the options menu. **Ctrl/Cmd+Z** (redo: Shift+Z or Y) now works anywhere on a sprint page, not only while typing in a line; date, number and search boxes keep their own undo.
- **Undo on the Reports page** (per user and report): every edit, hide/show, status or group change, added lines, sync and AI wording is one step; ↶ Undo / ↷ Redo buttons plus Ctrl/Cmd+Z and Shift+Z. Submitting or reopening a report is never undone silently, and a report someone else changed afterwards is left alone. One router (`features/undo-router.js`) handles the shortcut for the page you are on, so the roadmap, sprints and reports never undo each other (before, the roadmap undo also fired on other pages). Text boxes keep their own typing undo.
- **Resources squads:** chips show a ✓ when the person is in the squad, have a tooltip, a toast on every change, a message when removing the last squad is refused, and a short explanation above the list.

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

## Notes are easier to find
- "Add note" button in the roadmap toolbar (period note starting today).
- Bar right-click menu now has "Add note for <person>…" and "Add period note…", with the bar's dates prefilled.

## Drag up, product colours, Deployments / Quality sections
- Fixed: dragging a bar UP to the person above did nothing. The moving bar stretched its own row's drop zone, so the origin row always won when going up. The dragged bar is now ignored when finding the target row (people and squad views).
- Bars use their product colour by default. A "Product colours" toolbar button (remembered per browser) switches to showing a bar's own colour. The PDF follows the same setting.
- Bar menu: new "Product" row assigns the epic to a product (sets squad, clears its own colour), so it can be done from the person view.
- Sprints: the section picker now offers "Deployments" and "Quality scope" next to the products. In the weekly report they get their own section automatically (or tick them under Report settings).

## Product colours only
- Removed the "Product colours" toolbar button and the bar colour palette / colour picker. A bar is always drawn in its product's colour (also in the PDF).
- The bar menu's Product row is the only colour choice: it assigns the epic to a product, and the bar takes that product's colour. Product colours are edited on the Resources page (Products card).
- Older per-bar colours stay in the data but are no longer shown.

## Pull from Jira
- Sprint page: "Pull from Jira" adds each person's tickets (projects DYC, FAS, AU by default; active, upcoming or a named sprint) as scopes under the right product section and person. Subtasks become sub-sections, bugs get the fix tag, statuses map from Jira (waiting/blocked statuses = Blocked).
- Pulling again never duplicates (matched by key); the status and done date follow Jira, your edited text is kept. People are matched to Resources by name, otherwise the Jira name is used. Unassigned tickets are skipped.
- New Edge Function `supabase/functions/jira-sync` (read-only, editors only; secrets JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN). Logic in `features/jira-merge.js` and `features/jira-pull.js`.

## Google Docs link and export (sprint page)
- A "Google Doc link" field on each sprint (saved on the sprint as `gdoc`, only Google Docs links accepted) and an "Open linked doc" button.
- "Export to Google Docs": copies the sprint plan as formatted text (title, product headings, person headings, scopes and sub-steps as lists, status, tags, Jira keys as links when the report's Jira address is set) and opens the linked doc, or a new Google Doc (docs.new). Paste once with Ctrl/Cmd+V. Free notes are not exported.
- No Google sign-in is needed. One-click automatic export would need a Google Cloud OAuth client (not set up).

## Google Drive: one-click export to a real Google Doc
- Sprint page: "Export to Google Docs" (Drive icon). First click asks Google to sign in (popup); then it creates a real Google Doc in the user's Drive from the plan and links it to the sprint (`gdoc`, `gdocId`). Exporting again updates the same doc. If the linked doc is one the tool cannot edit (made by hand or by someone else), a new doc is created and linked, and the user is told.
- Scope `drive.file` only: the tool sees just the docs it created. The sign-in token stays in memory (about an hour); nothing is stored.
- One-time admin setup in the app: paste the Google OAuth Client ID (public; saved in `ideas/googlecfg`). Steps are shown in the dialog. Non-admins are asked to get an admin to do it.
- The earlier paste flow stays as "Copy for Docs" (no sign-in needed).
- vercel.json CSP now also allows `https://accounts.google.com/gsi/*` (sign-in script, styles, frame) and `https://www.googleapis.com` (Drive API). Nothing else loosened.

## Sprint page: no more scroll jumps
- Fixed: clicking next to a line (not exactly on its text) put the caret in the empty line at the very end of the document, so the page jumped to the bottom. It now puts the caret in the nearest line and stays where you are.
- Focusing a line no longer lets the browser re-centre the page; the page scrolls only when the caret is really out of view.
- A redraw caused by someone else's change (or your own save arriving back) keeps your scroll position.
