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

## 3. Vercel
Import the GitHub repo, framework *Other*, no build command, output = repo root. `vercel.json` adds the security headers.
Every push to `main` deploys. `index.html` is committed (generated) so no build step is needed on Vercel.

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
