# Deployment & Operations

## Environments
Single environment: Supabase project **YNMO_PM** + Vercel project **ynmo-roadmap** (branch `main` → production).

## 1. Supabase (one-time)
1. SQL Editor → run `supabase/sql/01` … `05` in order (each is re-runnable). If 05 prints *Skipped realtime policies*, add them in Dashboard → Realtime → Policies (topic `ynmo-presence`, authenticated, approved).
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

## 3. Vercel
Import the GitHub repo, framework *Other*. `vercel.json` sets install `npm ci`, build `node build.mjs --dist`, output `dist/` (index.html + vendor) and the security headers.
Every push to `main` deploys; Vercel rebuilds from `src/`, the committed `index.html` is only for local use and tests.

## 4. Release procedure
```bash
npm install && node build.mjs && node build.mjs --check && node lint.mjs
python3 tests/e2e_qa.py
git add -A && git commit -m "feat: …" && git push origin main
```
Rollback: Vercel → Deployments → *Promote* a previous one, or `git revert` and push.

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

## 2d. Google Drive export (one-time, an admin)
1. console.cloud.google.com > create a project. APIs & Services > Library > enable "Google Drive API".
2. OAuth consent screen: Internal (Google Workspace) or External (then click Publish app; the `drive.file` scope needs no Google review). Add scope `https://www.googleapis.com/auth/drive.file`.
3. Credentials > Create credentials > OAuth client ID > Web application. Authorized JavaScript origins: `https://ynmo-roadmap.vercel.app` (and any other address the tool is served from).
4. Copy the Client ID. In the tool: Sprints > open a sprint > "Export to Google Docs" (as an admin) > paste the Client ID > Save. Then click Export again and sign in.
Troubleshooting: "popup blocked" = allow pop-ups for the site; "Google Drive API is not enabled" = step 1; "Error 400: origin_mismatch" = the site address is missing in step 3; "access blocked / not verified" = the app is External and still in Testing: Publish it or add the user as a test user.
