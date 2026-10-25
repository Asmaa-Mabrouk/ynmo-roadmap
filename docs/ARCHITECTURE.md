# Architecture

## 1. Shape of the system
```
Browser (index.html, vanilla JS)
   │  supabase-js (vendored)  ── HTTPS / WSS ──►  Supabase
   │                                              ├─ Auth (email+password, confirm email, reset)
   │                                              ├─ Postgres (+ Row Level Security)  ← real authorization
   │                                              ├─ Realtime (postgres changes + presence)
   │                                              ├─ Edge Function notify-approval  ◄─ Database Webhook (profiles insert)
   │                                              ├─ Edge Function weekly-draft  ──► Gemini (report wording, editors only)
   │                                              └─ Edge Function jira-sync     ──► Jira Cloud (read-only, editors only)
   └─ Google Identity Services + Drive API (from the browser, scope drive.file, token in memory only)
Vercel: static hosting + security headers (vercel.json)
```
There is **no application server**. The browser is untrusted; every permission is enforced by Postgres RLS
(see [SECURITY.md](SECURITY.md)). The publishable key in the client is safe by design.

## 2. Why one file, no framework
Tiny team, zero-ops, instant deploy, works offline-first for reads. Sources are split into modules under `src/`
and concatenated by `build.mjs` into one `index.html` – readable in the repo, trivial to host, no bundler toolchain.

## 3. Modules and build
Source is **native ES modules** under `src/esm/` with explicit `import`/`export`. `node build.mjs` bundles `src/esm/main.js`
with esbuild into one classic IIFE and inlines it (plus the CSS) into `index.html`, so the deploy stays a single file that also
works from `file://`. `node lint.mjs` fails on a missing import, an import of a non-exported name, or an undefined identifier.

```
src/esm/
  main.js                 entry: imports modules in boot order, exposes window.__ynmo (test/debug handles), calls init()
  core/    model · state · shared · saving · supabase          data model, shared state, persistence, client
  auth/    gate · profile                                       login/sign-up screens, profile
  ui/      gantt-render · editing · drag · people-picker · export · export-pdf · avatars · dropdowns · loading · menu · notify · crumbs
  pages/   roadmaps · ideas (only saveIdea, the settings store) · resources · vacations · log · sprints · reports
  features/ safety · presence · dependencies · log-tools · sharing · people-rows · squad-names · timeline-notes
            sprint-doc · sprint-export · report-model · rich-text · undo-stack · undo-router · jira-merge · jira-pull · google-drive
  app/     shell · extras-wiring                                navigation, boot, extras start-up
```
| Module | Responsibility |
|---|---|
| core/model | Day axis, lanes, seed items, `items() visible() team() directory()` selectors |
| core/state | **`S`**: the only object holding state reassigned across modules (`S.me, S.over, S.db, S.roadmaps, S.readonly, …`) |
| core/shared | Helpers (`el`, `toast`, dates), `PAGES`, `logAct`, `describe` |
| core/saving | Write queue + retry, `commit`, undo (`S.undoStack`) |
| core/supabase | Client init, `makeDb()` adapter |
| auth/gate, auth/profile | Auth screens & hash routes; profile load/edit |
| ui/* | Rendering & interaction primitives (Gantt, editing, drag, pickers, dropdown popup, loader) |
| pages/* | One file per page; `ideas.js` is now only `saveIdea` (the `ideas` collection is the shared settings store: product names, report settings, people order, notes); the roadmap start-up wiring lives in `app/start.js` (last import, ends with `init()`) |
| features/* | Cross-cutting features: safety (dialogs, offline, idle logout, permissions), presence, dependencies, log tools, sharing, people-rows (row reorder + hide per roadmap), squad-names (editable squad labels), timeline-notes (person/period notes and the leave strip), sprint-doc / sprint-export / report-model (sprint outline, Google Docs copy, report rules), jira-merge / jira-pull (Pull from Jira), google-drive (Drive export), rich-text (sanitised formatted text), undo-stack / undo-router (per-user undo for sprints and reports) |
| app/shell | `showPage`, navigation, `start()`, `boot()`; app/extras-wiring: `initExtras/startExtras` |

**Rules of the module graph**
1. Import what you use; never rely on globals. Cycles exist (render ↔ editing ↔ saving) and are safe because they only call each other from functions, never at load time.
2. A value reassigned from more than one module lives on `S` (imports are read-only bindings). Module-private `let`s stay private.
3. Load-time (top-level) side effects are limited to registering listeners; they run in the order of the imports in `main.js`.
4. Only `main.js` touches `window.__ynmo`; nothing in the app reads it.

## 4. Data model in the client
- Static seed `ITEMS` (base features) + **`over`**: an overlay object `{id: {…changed fields}}` persisted per item. Views read through
  `items()` which merges seed + overlay, so seed data never needs migrating and any field can be overridden or unset.
- Toasts: `ui/notify.js` (`notify(msg,'ok'|'err'|'info')`). Sprints use hash sub-routes (`#/sprints/<id>`) handled inside `pages/sprints.js`.
- Sprint document: outline of blocks (`h` section, `p` person, `s` scope, `u` sub-section, `n` note) in `sprint_items`; pure logic (`derive`, `parseOutline`, `migrate`) in `features/sprint-doc.js`; popup menus `ui/menu.js`; breadcrumb `ui/crumbs.js`. `itemsOf()` flattens the outline for the report.
- Sprints/Reports (both are a list of cards plus a `.sheet` page per item: `#/sprints/<id>`, `#/reports/<id>`): `pages/sprints.js`, `pages/reports.js`, pure logic in `features/report-model.js`; AI wording via Edge Function `weekly-draft` (Gemini).
- Other collections (`people`, `daysoff`, `roadmaps`, `ideas`, `vacations`, `activity`, `share_links`) are
  generic docs: `id text` + `data jsonb`. The adapter `makeDb()` exposes `doc(path).set/merge/delete` and `collection(t).get/onSnapshot`; `onSnapshot` re-queries the table on every Postgres-changes event plus a 30 s safety poll (simple and robust; cheap at this data size).
- Schema-less JSON keeps feature iteration fast (new fields need no migration); the trade-off is that validation lives in
  the client and in RLS/guards (see DATABASE.md).

## 5. Data flow of an edit
`UI event → canWrite() check → commit(id, fields)` → snapshot to undo stack → update `S.over` → `logAct()` (with undo payload)
→ `render()` → `persist(id)` → `write()` (serial per path, retry with backoff) → Postgres (RLS) → Realtime → other clients' `onSnap` → `softRender()`.

## 6. Boot sequence
`init()` → `boot()` → (a) `#/share/<token>` ⇒ `bootShared()` read-only snapshot via RPC; else (b) get session → `loadProfile()` →
approved? `start()` : pending screen → `start()` subscribes to collections, hides the loader on first snapshot, calls `startExtras()`
(presence, idle timer, offline probe).

## 7. Routing
Hash routes (`#/login`, `#/signup`, `#/forgot`, `#/pending`, `#/share/<token>`); app pages are in-memory state (`showPage`).
Sprints and Reports each have a list (`#/sprints`, `#/reports`) and a page per item (`#/sprints/<id>`, `#/reports/<id>`), handled inside their page modules; `showPage` keeps such a deep link on first load and the nav button always returns to the list.
Static hosting therefore needs no rewrites.

## 8. Conventions that keep this maintainable
See [CONTRIBUTING.md](CONTRIBUTING.md). Highlights: all DOM text via `textContent`/`el()` (no `innerHTML` with user data),
every mutation begins with `canWrite()`, every mutation calls `logAct`, UI strings in English, dates as ISO `YYYY-MM-DD` in UTC.

## 9. Known trade-offs
- Bundled IIFE instead of shipping `<script type=module>` files: keeps one-file deploy and `file://` testing; modules still isolate names and dependencies at source level.
- Free Supabase email limits require Custom SMTP for production sign-ups.
- Soft locks are advisory. `merge()` is read-modify-write, not atomic: two people changing *different fields of the same bar* within milliseconds can lose one change. A Postgres function using `jsonb ||` would make it atomic if this ever matters.

## 10. Sprints, Reports, Jira and Google Docs
- **Pattern shared by Sprints and Reports:** a list of cards (the whole card is one link, a ⋯ menu has the extras), then a white `.sheet` page with a breadcrumb, a toolbar row and the content. `renderSprints` / `renderReports` read the route from the hash; both keep the scroll position on redraws caused by other people's edits.
- **Sprint document:** an outline of blocks (`h` product section, `p` person, `s` scope, `u` sub-section, `n` note) in `sprint_items`; pure logic (`derive`, `parseOutline`, `migrate`) in `features/sprint-doc.js`; popup menus `ui/menu.js`. `EXTRA_SECTIONS` (`x_deploy`, `x_quality`) are non-product sections stored as a normal `h` block whose `sq` is that key; `pages/reports.js` adds a report section for them when no product covers them.
- **Weekly report:** `pages/reports.js` + `features/report-model.js`. One report per week (`rp<yyyymmdd>`), rules build the draft from the sprint plan and the roadmap, optional Gemini wording through `weekly-draft`, per-user undo, submit/reopen, print/PDF. Sections are headed in the product colour (`colOf`).
- **Monthly deliverables (own page, `#/monthly`, a Trello-style board):** one column per month (this month, the next, then any added with "+ Add month"; past months behind "Show past months"). A month is a doc `reports/mo<yyyymm>` in the same `reports` table (no new table; month docs have `mo` and no `a`, so the weekly list ignores them). The board always saves a month as `submitted`, so executives (viewers) see every month through the existing RLS; old drafts are switched to submitted when an editor opens the board. Pure rules in `features/month-model.js` (`monthOf`, `monthProgress`, `cardId`, `legacyTag`, `monthText`), page in `pages/monthly.js` (columns, cards tagged and coloured by `TAGS` (month-model.js; the weekly report keeps its own products), Trello-style composer per column, drag to re-order or move with a drop line, delete, "Add to roadmap"); `features/month-view.js` now only holds the progress block of the weekly report. **Backlog: pseudo-month `BL='backlog'` (doc `reports/mobacklog`), excluded from `docs()` (months) but included in `rawDocs()` (numbering, lookups); rendered by `column(BL)` as a sticky first column when `blOpen` (localStorage `ynmo-backlog`). Undo: `saveMonth` remembers the month doc before each save (grouped per action, 50 steps) and `undoMonthly` restores it (button + Ctrl+Z); a same-month move is one save. There is no sync.** A card is put on the roadmap from its menu (**Add to roadmap…**: assignee, squad, start, end): the dialog creates a custom item `S.over[nid]` (with `card:<card id>`) on the open roadmap, and the card stores `rid` (bar id) and `rm` (roadmap id), so it shows an "On roadmap" chip and a "Show on roadmap" menu item while the bar exists. **Card ids:** every card has a number `no` (max over all months + 1, assigned at creation, and once for older cards by `fixCards` when an editor opens the board), shown as `<tag abbreviation>#<no>` (DC, TF, PL, AI, FN, NI) via `cardId`; the abbreviation follows the tag, the number never changes. A card with a note shows a green icon with a red bubble. There is no undo on the board (like Ideas); delete asks to confirm.
- **Delete a weekly report:** `deleteReport` in `pages/reports.js` (list menu and report page, confirm dialog from `ui/confirm.js`); editors delete drafts, only admins delete submitted ones.
- **Colours:** roadmap bars are always drawn in their product (lane) colour; the per-bar `c` field is kept in old data but ignored. A bar's product is set in the bar menu (`squadPatch`).
- **Jira:** `features/jira-merge.js` (pure merge of tickets into the sprint outline, dedupe by `jk`), `features/jira-pull.js` (dialog and apply), Edge Function `jira-sync` (read-only Jira Cloud search; secrets only in Supabase).
- **Google Docs:** `features/sprint-export.js` (`sprintDoc` builds the formatted copy, `docUrl` validates a link, `copyRich` writes HTML + text to the clipboard) and `features/google-drive.js` (Google Identity Services token client, Drive multipart upload converted to a native Doc, updates only docs the tool created). The OAuth Client ID is stored once by an admin in `ideas/googlecfg`; there is no client secret in this flow.
