# Security

## Model
The browser is untrusted. **Authorization is enforced in Postgres (RLS + triggers)**; UI checks (`canWrite()`, hidden buttons) are
only usability. The only key in the client is the *publishable* key. Never commit a service-role / secret key or the Gmail App password.

## Controls
| Threat | Control | Where |
|---|---|---|
| Unauthorized data access | RLS on every table; read = approved, write = editor | sql/04, 05 |
| Self-approval / privilege escalation | `guard_profile` trigger; `p_ins` requires `approved=false,is_admin=false` | sql/02, 04 |
| Admin takeover by registering someone's email | Admin only if `email_confirmed_at` set (keep **Confirm email ON**) | sql/05 |
| Log forgery | activity insert requires `data.uid = auth.uid()` | sql/05 |
| Tampering with history | `guard_baseline`; delete = admin only | sql/05 |
| Presence eavesdropping | Private channel + realtime policies | sql/05 |
| XSS | User content set via `textContent`; no `innerHTML` with user data; strict CSP; column colours validated `^#[0-9a-f]{6}$` | src/js, vercel.json |
| Supply chain | supabase-js vendored at a pinned version (no CDN, no SRI drift) | vendor/ |
| Clickjacking / sniffing / referrer leaks | `frame-ancestors 'self'`, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS | vercel.json |
| Webhook abuse | Edge Function requires `x-webhook-secret` (constant-time compare); CR/LF stripped from email subject | supabase/functions |
| Brute force / stolen device | Password meter (min 8), idle logout 30 min, sign-out-everywhere | src/js/19 |
| Public link leakage | Token-based, revocable, RPC returns only one roadmap's bars, people, company days off | sql/04 |

## Known limits / residual risk
- CSP keeps `'unsafe-inline'` for script/style because the app is one inline file; moving to hashed/nonce inline or external files would remove it.
- Anyone with a share link can read that snapshot until revoked.
- Custom SMTP + CAPTCHA (Supabase → Auth) recommended against sign-up abuse.

## Operator checklist
- [ ] Confirm email ON · [ ] Custom SMTP configured · [ ] Realtime "Allow public access" OFF
- [ ] sql/01→05 applied · [ ] `WEBHOOK_SECRET` set on function **and** as `x-webhook-secret` header of the Database Webhook
- [ ] Only the publishable key in `src/js/08-supabase.js` · [ ] Rotate any key that was ever pasted in chat/tickets

## Reporting
Send findings privately to the product lead (asmaa.mabrouk.ibrahim@gmail.com). Don't open public issues for vulnerabilities.
