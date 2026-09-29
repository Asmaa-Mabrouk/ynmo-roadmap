# Ynmo Roadmaps

Shared, editable, real-time **Gantt roadmap and planning workspace** for the Ynmo product team
(Tifli · Plan/Warif/Sharjah · Daycare · AI squads). One static HTML file + Supabase. No build framework, no server to run.

| | |
|---|---|
| Live | https://ynmo-roadmap.vercel.app |
| Hosting | Vercel (auto-deploys `main`) |
| Backend | Supabase (Auth + Postgres + Realtime + one Edge Function) |
| Stack | Vanilla JS (native ES modules, bundled by esbuild) + CSS, no framework, Supabase JS v2 (vendored) |

## What it does (30 seconds)
Plan features on a day-level timeline, assign people, track dependencies/milestones, see capacity vs. time-off,
keep an ideas board (Trello-style), freeze baselines and compare "plan vs now", share a read-only link with
stakeholders, and audit every change with undo. Access is by **admin approval** with **Editor / Viewer** roles.
Full product description: [docs/BUSINESS.md](docs/BUSINESS.md).

## Quick start
```bash
git clone https://github.com/Asmaa-Mabrouk/ynmo-roadmap && cd ynmo-roadmap
npm install                     # esbuild + lint deps (dev only)
node build.mjs                  # src/  ->  index.html   (Node >= 18)
npx serve .                     # or: python3 -m http.server 3000
```
The app talks to the Supabase project configured in `src/esm/core/supabase.js` (publishable key only).
First-time backend setup: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Repository layout
```
src/
  index.template.html     page shell ({{STYLES}}, {{SCRIPTS}} slots)
  css/                    base -> brand -> skin -> features
  esm/                    ES modules: core/ auth/ ui/ pages/ features/ app/ + main.js (see docs/ARCHITECTURE.md)
build.mjs                 esbuild bundle + CSS -> index.html   (node build.mjs [--check])
lint.mjs                  module-graph lint (missing imports / undefined names)
index.html                GENERATED deploy artifact (committed; Vercel serves it as-is)
vendor/supabase-js.js     pinned, self-hosted client (no CDN => strict CSP, no supply-chain drift)
supabase/sql/*.sql        numbered migrations, run in order
supabase/functions/       notify-approval Edge Function (email admins on new sign-up)
tests/                    Playwright E2E suite + in-browser fake Supabase
vercel.json               security headers + CSP
docs/                     BUSINESS, ARCHITECTURE, DATABASE, SECURITY, DEPLOYMENT, TESTING, CONTRIBUTING, CHANGELOG
```

## Daily workflow
1. Edit files in `src/`. **Never edit `index.html` by hand.**
2. `node build.mjs` and open `index.html`.
3. `node lint.mjs` and `python3 tests/e2e_qa.py` (see [docs/TESTING.md](docs/TESTING.md)).
4. Commit **both** `src/` and `index.html`; `node build.mjs --check` must pass. Push to `main` to deploy.

## Documentation map
- [Business & product](docs/BUSINESS.md) · [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md)
- [Security](docs/SECURITY.md) · [Deployment & operations](docs/DEPLOYMENT.md)
- [Testing](docs/TESTING.md) · [Contributing / clean-code rules](docs/CONTRIBUTING.md) · [Changelog](docs/CHANGELOG.md)
