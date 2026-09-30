# Architecture

## 1. Shape of the system
```
Browser (index.html, vanilla JS)
   │  supabase-js (vendored)  ── HTTPS / WSS ──►  Supabase
   │                                              ├─ Auth (email+password, confirm email, reset)
   │                                              ├─ Postgres (+ Row Level Security)  ← real authorization
   │                                              ├─ Realtime (postgres changes + presence)
   │                                              └─ Edge Function notify-approval  ◄─ Database Webhook (profiles insert)
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
  ui/      gantt-render · editing · drag · people-picker · export · avatars · dropdowns · loading
  pages/   roadmaps · ideas · ideas-columns · resources · vacations · log
  features/ safety · presence · dependencies · log-tools · capacity · baselines · sharing
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
| pages/* | One file per page; `ideas-columns` adds Trello-style column management |
| features/* | Cross-cutting features: safety (dialogs, offline, idle logout, permissions), presence, dependencies, log tools, capacity, baselines, sharing, people-rows (row reorder + remove) |
| app/shell | `showPage`, navigation, `start()`, `boot()`; app/extras-wiring: `initExtras/startExtras` |

**Rules of the module graph**
1. Import what you use; never rely on globals. Cycles exist (render ↔ editing ↔ saving) and are safe because they only call each other from functions, never at load time.
2. A value reassigned from more than one module lives on `S` (imports are read-only bindings). Module-private `let`s stay private.
3. Load-time (top-level) side effects are limited to registering listeners; they run in the order of the imports in `main.js`.
4. Only `main.js` touches `window.__ynmo`; nothing in the app reads it.

## 4. Data model in the client
- Static seed `ITEMS` (base features) + **`over`**: an overlay object `{id: {…changed fields}}` persisted per item. Views read through
  `items()` which merges seed + overlay, so seed data never needs migrating and any field can be overridden or unset.
- Other collections (`people`, `daysoff`, `roadmaps`, `ideas`, `vacations`, `activity`, `baselines`, `share_links`) are
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
Hash routes only (`#/login`, `#/signup`, `#/forgot`, `#/pending`, `#/share/<token>`); app pages are in-memory state (`showPage`).
Static hosting therefore needs no rewrites.

## 8. Conventions that keep this maintainable
See [CONTRIBUTING.md](CONTRIBUTING.md). Highlights: all DOM text via `textContent`/`el()` (no `innerHTML` with user data),
every mutation begins with `canWrite()`, every mutation calls `logAct`, UI strings in English, dates as ISO `YYYY-MM-DD` in UTC.

## 9. Known trade-offs
- Bundled IIFE instead of shipping `<script type=module>` files: keeps one-file deploy and `file://` testing; modules still isolate names and dependencies at source level.
- Free Supabase email limits require Custom SMTP for production sign-ups.
- Soft locks are advisory. `merge()` is read-modify-write, not atomic: two people changing *different fields of the same bar* within milliseconds can lose one change. A Postgres function using `jsonb ||` would make it atomic if this ever matters.
