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

## 3. Build & module order
`node build.mjs`: CSS `base → brand → skin → features`; JS files `src/js/NN-*.js` in numeric order, inside one
`<script>` → **one shared global scope**. Function declarations hoist; `const/let` are only usable after their file
runs, so keep load-time work out of top-level and put new modules **before** `29-ideas-columns.js`, which ends with `init()`.

| # | Module | Responsibility |
|---|---|---|
| 01 | time-and-lanes | Day axis, lanes, seed items, `over` overlay, selectors `items() visible() team() directory()` |
| 02 | saving | Write queue + retry, save pill, undo history (`commit`) |
| 03 | people | Assignee & time-off popovers |
| 04 | drag | Bar/row drag & drop |
| 05 | render | Gantt rendering, filters, zoom, bar packing, by-person view |
| 06 | editing | Inline edit, add/duplicate, context menus |
| 07 | export | CSV export |
| 08 | supabase | Client init, `makeDb()` adapter |
| 09 | avatars | Local SVG avatars |
| 10 | gate | Login/sign-up/forgot/pending screens, hash routes |
| 11 | profile | Profile load/edit |
| 12 | shared-state-and-log | `me`, helpers, toast, `logAct`, `describe` |
| 13–17 | page-* | Roadmaps, Ideas, Resources/Approvals, Vacations, Log pages |
| 18 | shell | Navigation, `start()`, `boot()` |
| 19 | dialogs-offline-hardening | Dialogs, offline banner, password meter, idle logout, permission helpers |
| 20 | presence | Online users, soft locks |
| 21 | dependencies | Milestones, dependency checks, SVG overlay |
| 22 | log-tools | Load older, export, undo from log |
| 23 | capacity | Capacity page |
| 24 | baselines | Snapshots & compare |
| 25 | sharing | Public links, access roles |
| 26 | wiring | `initExtras`, `startExtras` |
| 27 | dropdowns | Styled select popup |
| 28 | loading | Loader/progress |
| 29 | ideas-columns | Column CRUD/drag, **`init()` entry point** |

## 4. Data model in the client
- Static seed `ITEMS` (base features) + **`over`**: an overlay object `{id: {…changed fields}}` persisted per item. Views read through
  `items()` which merges seed + overlay, so seed data never needs migrating and any field can be overridden or unset.
- Other collections (`people`, `daysoff`, `roadmaps`, `ideas`, `vacations`, `activity`, `baselines`, `share_links`) are
  generic docs: `id text` + `data jsonb`. The adapter `makeDb()` exposes `doc(path).set/merge/delete` and `collection(t).get/onSnapshot`; `onSnapshot` re-queries the table on every Postgres-changes event plus a 30 s safety poll (simple and robust; cheap at this data size).
- Schema-less JSON keeps feature iteration fast (new fields need no migration); the trade-off is that validation lives in
  the client and in RLS/guards (see DATABASE.md).

## 5. Data flow of an edit
`UI event → canWrite() check → commit(id, fields)` → snapshot to undo history → update `over` → `logAct()` (with undo payload)
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
- Global scope instead of ES modules (simplicity vs. isolation) – a future step is native ES modules with `<script type=module>`.
- Free Supabase email limits require Custom SMTP for production sign-ups.
- Soft locks are advisory. `merge()` is read-modify-write, not atomic: two people changing *different fields of the same bar* within milliseconds can lose one change. A Postgres function using `jsonb ||` would make it atomic if this ever matters.
