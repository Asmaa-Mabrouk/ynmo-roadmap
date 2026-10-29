# Deployment & Operations

## Environments
Single environment: Supabase project **YNMO_PM** + Vercel project **ynmo-roadmap** (branch `main` → production).

## 1. Supabase (one-time)
1. SQL Editor → run `supabase/sql/01` … `06` in order (each is re-runnable). If 05 prints *Skipped realtime policies*, add them in Dashboard → Realtime → Policies (topic `ynmo-presence`, authenticated, approved).
2. Auth → Providers → Email: **Confirm email ON**. Auth → URL Configuration: Site URL = production URL; add `…/**` to Redirect URLs.
3. Auth → SMTP: enable **Custom SMTP** (e.g. Gmail: host `smtp.gmail.com`, port `465`, username = mailbox, password = Google *App password*, minimum interval 30–60 s). The default sender is rate-limited to a few emails/hour → "email rate limit exceeded".
4. Realtime → Settings: disable *Allow public access*.
5. Admin allow-list: `insert into public.admin_emails values ('you@company.com');` (admin after email confirmation).

## 2. Approval e-mail (Edge Function)
```bash
supabase functions deploy notify-approval
supabase secrets set WEBHOOK_SECRET=<long random> SMTP_USER=<mailbox> SMTP_PASS=<app password> \
  SITE_URL=https://ynmo-roadmap.vercel.app ADMIN_NOTIFY_EMAIL=<who gets the alerts>
```
Dashboard → Database → Webhooks → on `profiles` INSERT → HTTP request to the function URL with header `x-webhook-secret: <same value>`.

## 2b. Weekly report AI (Edge Function `weekly-draft`)
Run `supabase/sql/07-reports-editor-delete.sql` after 06 (lets any editor delete a weekly report).
Run `supabase/sql/06-sprints-weekly-reports.sql` once, then:
```bash
supabase functions deploy weekly-draft
supabase secrets set GEMINI_API_KEY=<your key>      # or Dashboard > Edge Functions > Secrets. Never in the repo or in chat.
supabase secrets set GEMINI_MODEL=<model id>        # optional; the default is set in the function, change it if Google renames models
```
Troubleshooting: the red banner "Database setup needed" means SQL 06 was not run; "AI function is not deployed" means `weekly-draft` is missing; "GEMINI_API_KEY is missing" means the secret name is wrong.

The function accepts only signed-in editors/admins, sends **only item titles, Jira keys and status** to Gemini (no names, notes or dates) and never stores anything. If it fails, the app keeps the rule-based draft. Use a paid-tier Gemini project if the report content must not be used for model training.

## 2c. Pull from Jira (Edge Function `jira-sync`)
Read-only: the function only reads tickets, it never changes Jira.
1. Create an Atlassian API token (https://id.atlassian.com/manage-api-tokens, "Create API token", set an expiry and note the renewal date).
2. Supabase > Edge Functions > Secrets: `JIRA_BASE_URL` (for example `https://tatralab.atlassian.net`), `JIRA_EMAIL` (the account the token belongs to), `JIRA_API_TOKEN`.
3. Deploy: `supabase functions deploy jira-sync` (or create a function named `jira-sync` in the dashboard and paste `supabase/functions/jira-sync/index.ts`).
4. In a sprint, click "Pull from Jira", keep the projects (`DYC, FAS, AU`), choose Active / Upcoming sprints, and Pull. Tickets become scopes under each person; pulling again only adds new tickets and updates statuses.
Troubleshooting: "not deployed" = the function is missing; "(401)" = wrong email or token; "(403)" = that account cannot see the project; "not in the team list" = the Jira name did not match a Resources member, so the Jira name was used.

## 2d. Link a sprint task to Jira (Edge Function `jira-search`)

Uses the **same three secrets** as `jira-sync` (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`); nothing new to create. Deploy: `supabase functions deploy jira-search` (or create a function named `jira-search` and paste `supabase/functions/jira-search/index.ts`). Read-only, editors only. Without it, the Link to Jira picker says the function is not deployed.

## 2d. Google Drive export (one-time, an admin)
Setup done for this tool: Google Cloud project **YNMO PM** under the trianglz.com organisation, Google Drive API enabled, OAuth consent screen **Internal** (so every trianglz.com account can sign in with no Google review), one **Web application** client with the authorised JavaScript origin `https://ynmo-roadmap.vercel.app` and no redirect URIs.
1. console.cloud.google.com > create or choose a project. APIs & Services > Library > enable "Google Drive API".
2. OAuth consent (Google Auth platform): Internal (Google Workspace) or External (then click Publish app; the `drive.file` scope needs no Google review). Data Access > add scope `https://www.googleapis.com/auth/drive.file`.
3. Clients > Create client > Web application. Authorised JavaScript origins: `https://ynmo-roadmap.vercel.app` (exactly: no slash, no path, plus any other address the tool is served from). Leave redirect URIs empty.
4. Copy the **Client ID** (ends `.apps.googleusercontent.com`). Ignore the client secret: this flow does not use it, so keep it out of the tool, Supabase and chat.
5. In the tool: Sprints > open a sprint > "Export to Google Docs" (as an admin) > paste the Client ID > Save. Then click Export again and press Allow in the Google window. Everyone else just clicks Export and signs in with their own Google account.
Troubleshooting: "Could not load Google sign-in" with `net::ERR_NETWORK_CHANGED` in the console = the connection changed during the load, click Export again; `ERR_BLOCKED_BY_CLIENT` = an extension or ad blocker; "Refused to load the script" = fix the CSP in `vercel.json`; "popup blocked" = allow pop-ups for the site; "Google Drive API is not enabled" = step 1; "Error 400: origin_mismatch" = the site address is missing or different in step 3; "access blocked / not verified" = the app is External and still in Testing: Publish it or add the user as a test user. Google Cloud will require multi-factor sign-in for console users (deadline noted in the Ledger).

## 3. Vercel
Import the GitHub repo, framework *Other*. `vercel.json` sets install `npm ci`, build `node build.mjs --dist`, output `dist/` (index.html + vendor) and the security headers.
Every push to `main` deploys; Vercel rebuilds from `src/`, the committed `index.html` is only for local use and tests.

## 4. Release procedure
```bash
npm install && node build.mjs && node build.mjs --check && node lint.mjs
tests/run_all.sh        # about 12 minutes: build check, lint, 41 feature scripts, 6 unit files, CSP check, 79 scenarios
git add -A && git commit -m "feat: …" && git push origin main
```
Rollback: Vercel → Deployments → *Promote* a previous one, or `git revert` and push.

### Release checklist for data changes (2026-10)
1. Back up the tables first (`create table backup_<date>_<table> as select * from <table>`, then turn row-level security on for each copy).
2. Dry run (read-only), then apply one transaction per table, then re-check that nothing old is left.
3. Ask everybody to reload: an open tab with an older build can write the old values again.
4. Drop the backup tables when the team is happy. The health check prompt is `docs/DB_HEALTH_CHECK_PROMPT.md`.

## 5. Changing the Supabase project or key
Edit `SUPABASE_URL` / `SUPABASE_KEY` in `src/esm/core/supabase.js` (publishable key only), update `connect-src` in `vercel.json`, rebuild.

## 6. Operations runbook
| Symptom | Likely cause / action |
|---|---|
| "Email rate limit exceeded" | Configure Custom SMTP (step 1.3), wait an hour |
| Link in email opens localhost | Fix Site URL / Redirect URLs |
| User stuck on pending | Admin → Approvals, choose Editor/Viewer |
| Everyone read-only | Profile `access='viewer'` or RLS error → check Log/console |
| No presence avatars | realtime policies missing (05 step 5) |
| Changes not saving | Offline banner shown; edits retry with backoff (about 40 s in total) and stay pending in the browser |
| SQL Editor "must be owner of table…" | You touched a Supabase-managed schema table; use Dashboard policies instead |

## 7. Backups
Supabase daily backups (plan dependent). Baselines are extra in-app checkpoints; CSV export exists for the roadmap; log export for audit.

## Troubleshooting: an admin sees "Waiting for admin approval"

Sign-in worked (Supabase Auth logs show Login 200) but the person's row in `public.profiles` is not approved. This happens when the Auth user was deleted and created again (a new profile row is made unapproved) or the row was removed. Fix in the Supabase SQL editor (runs as the database owner, so the protection trigger allows it):

```sql
update public.profiles set approved = true, is_admin = true where lower(email) = lower('<the admin email>');
select id, email, approved, is_admin from public.profiles order by created_at;
```

If the select shows no row for that email, sign in once more (the app creates it), then run the update again.

## Runbook: nobody can open the tool, "Taking longer than expected" (data API down)

**What happened on 2026-10-27:** sign-in worked (`/auth/v1/token` 200) but every data request (`/rest/v1/*`) returned **503 with PGRST002 "Could not query the database for the schema cache"**. The database was healthy; the API layer (PostgREST) held one 27-day-old stuck connection. The project showed **Unhealthy** on the free Nano plan. **Fix: Project Settings > General > Restart project** (about a minute, no data lost).

**Quick check (30 seconds):**
1. Supabase dashboard: project status (Healthy / Unhealthy), then Logs > API / PostgREST for `PGRST002` or many 503s.
2. SQL editor: `select 1;` works and `select id, email, approved, is_admin from public.profiles;` returns quickly. If yes, the database is fine and the API needs the restart.

**What the app does now:** the sign-in check and profile read give up after 10-12 s, show "Taking longer than expected", and **retry by themselves every 15 s**, opening the tool the moment the server answers again. People do not need to refresh.

**Prevention (recommended, in this order):**
1. **Uptime monitor on the data API** (free): an external monitor (for example UptimeRobot or Better Stack) that requests `https://avgkenwdehtwynrswsck.supabase.co/rest/v1/profiles?select=id&limit=1` every 5 minutes with the **publishable** key in the `apikey` header and expects HTTP 200 (an unsigned request returns 200 with `[]` when RLS hides rows). Alert by email to the admins. A 503 here is exactly this incident. Never use the service-role key.
2. **Supabase email alerts:** Project Settings > Notifications, turn on status and usage emails.
3. **Upgrade from the free Nano plan** (Pro) before the executive demos: free projects have little compute and no support SLA, and a stuck API connection is the failure seen here.
4. **Restart the project on a calm day** (Settings > General) after large changes such as running a SQL file, so the schema cache is rebuilt cleanly.
5. **Pre-demo check:** open the live site in a private window and sign in 15 minutes before any executive session.
