# Ynmo Ledger: Ynmo Roadmaps tool

The running memory of this tool: what is set up, what was decided, and what is still open. Newest entries first.
It uses the same block format as the Living Ledger (Section 11) of the `ynmo-master` skill, so an entry can be pasted there as is.
Product-wide facts (Plans, Daycare, Tifli, Wasl, design system) live in the skill; this file only records what concerns the Roadmaps tool.

**How to keep it current:** every change request ends with a Ledger Update block. Add it under "Ledger updates", move anything that is no longer open out of "Open items", and put anything that is now stable into "Current state". No secrets, tokens or passwords in this file.

## Current state (2026-10-18)

| Area | State |
|---|---|
| Live site | https://ynmo-roadmap.vercel.app (Vercel, auto-deploys `main`) |
| Repo | `Asmaa-Mabrouk/ynmo-roadmap`, branch `main`; last change: Monthly deliverables board (see CHANGELOG) |
| Backend | Supabase project **YNMO_PM**; SQL 01 to 07; Edge Functions `notify-approval`, `weekly-draft`, `jira-sync` (code in repo; deployment status per the open items below) |
| Owner | Asmaa (Senior PM, TrianglZ, Ynmo ecosystem, Riyadh) |
| Pages | Roadmap, Roadmaps, Sprints, Reports, Monthly deliverables, Dashboard, Resources, Vacations, Log, Users & permissions |
| Tests | `tests/run_all.sh`: last full run 88/88 scenarios and all feature scripts green (`sprints_reports.py` 94, `monthly_page.py` 79) |
| Jira | Site `tatralab.atlassian.net`; default projects DYC (Daycare), FAS (Tifli), AU (AI). Plan, Warif and Sharjah project keys not known yet. Rovo was considered; the API route was chosen |
| Google Drive export | Google Cloud project **YNMO PM** (trianglz.com, Internal consent), Drive API on, Web client created for `https://ynmo-roadmap.vercel.app`. Client ID to be pasted in the tool by an admin; the client secret is not used |

## Decisions locked

- **Bars use product colours only.** A bar's product is chosen in the bar menu; there is no toolbar toggle and no per-bar colour picker. Old per-bar colours stay in the data but are ignored.
- **Sprints and Reports share one design:** a list of cards, then a white sheet page per item with a breadcrumb.
- **Sprint sections** can also be Deployments and Quality scope (not only products); the weekly report gets a section for them when no product covers them.
- **Jira is read-only** and pulled on demand ("Pull from Jira"), never written back. Credentials live only in Supabase secrets.
- **Google Drive export uses each person's own Google sign-in** (scope `drive.file`, token in memory). The OAuth Client ID is public and entered once by an admin; no client secret is used anywhere.
- **Notes** (person and period) are not part of the sprint export or the report.
- **Meet / screen sharing:** a shared tab can only be scrolled from the tab itself. This is a browser limit, not a tool bug.

## Open items

1. Google: paste the Client ID in the tool (Sprints > a sprint > Export to Google Docs > Save), then run the first real export and press Allow. Confirm the `drive.file` scope is listed under Data Access. If a "Refused to load the script" error appears, adjust the CSP in `vercel.json`.
2. Google Cloud: multi-factor sign-in becomes mandatory on **2026-10-20**.
3. Jira go-live: create the API token (id.atlassian.com/manage-api-tokens, with an expiry), add the secrets `JIRA_BASE_URL=https://tatralab.atlassian.net`, `JIRA_EMAIL`, `JIRA_API_TOKEN` in Supabase, deploy `jira-sync`, then try "Pull from Jira" on a real sprint. Provide the Plan, Warif and Sharjah project keys.
4. Supabase to-dos: run SQL 04, 05 and 06 where not yet applied; redeploy `weekly-draft` with `GEMINI_API_KEY`; deploy `notify-approval` with SMTP; change the password of the test account; run `sprint-228.sql` if that sprint is still to be seeded. The Supabase login email is not known (the project may sit under another account or organisation).
5. Slack daily-standup feed into the weekly report: parked until Jira is live. Needs a Slack admin to provide a bot token and the channel ID, and to say whether standups are threads or a Workflow form.
6. Print / PDF from the redesigned report page has not been checked on paper yet.
7. Possible later: a presentation mode for meetings; undo for timeline notes; notes in read-only share links.
8. Not yet tested against the real services: Jira, Google sign-in and Drive.

## Ledger updates

### 2026-10-28 - New resource everywhere (tracks)
```
🔄 YNMO LEDGER UPDATE - 2026-10-28
Request: a new resource must show in Resources, Vacations, Roadmap (rows, features) and Monthly points; test all over; DB needs
Surface: Ynmo Roadmaps tool
Outcome: Dashboard tracks chosen when adding a member, in the Manage pop-up and for "+ Add person" (QA, UX); tested end to end; no SQL
New facts / decisions locked: the tracks of a person live in ideas/capacity > lanes (editors can write them under the existing policy)
Corrections to this skill: none
Open / flagged: people added before this change are in tracks only if they are in the Dashboard settings
Changelog: new resources get Dashboard tracks.
```

### 2026-10-28 - Leave priced at 2 points a day, palm in the heat map
```
🔄 YNMO LEDGER UPDATE - 2026-10-28
Request: unify how leave is deducted (month = 20 working days); show a palm and the days on the heat map; expected vacation as a Monthly card
Surface: Ynmo Roadmaps tool (Dashboard)
Outcome: 1 working day of leave or after leaving = 2 points; 🌴 + days on heat map cells with hover; no vacation card in Monthly (leave stays in Vacations)
New facts / decisions locked: STD month = 20 working days; day = ppp / 20 points
Corrections to this skill: none
Open / flagged: expected (not yet approved) leave is entered in Vacations
Changelog: leave = 2 points per day; palm on heat map.
```

### 2026-10-28 - Official team names in the code, dropdown "No matches" fix
```
🔄 YNMO LEDGER UPDATE - 2026-10-28
Request: use the official names; explain the points list screenshot
Surface: Ynmo Roadmaps tool
Outcome: built-in names and Dashboard defaults are the official names; "No matches" no longer always shows
New facts / decisions locked: official names list (see CHANGELOG); database rename goes after this is deployed
Corrections to this skill: none
Open / flagged: database rename still to be approved to the agent; names in old data stay old until then
Changelog: official names in code; dropdown No matches fix.
```

### 2026-10-28 - Resources Manage pop-up, leavers, Gantt lines for linked cards
```
🔄 YNMO LEDGER UPDATE - 2026-10-28
Request: a small pop-up per resource to unify names or mark him as left; reflect on his assigned features and remind to plan them; a line between dependent features on the Gantt chart
Surface: Ynmo Roadmaps tool (Resources, Roadmap, Dashboard)
Outcome: Manage pop-up (name, merge, last working day); leavers' features flagged on the Gantt, Resources and Dashboard until reassigned; dashed Gantt line between bars of cards linked with Needs card
New facts / decisions locked:
  - The last working day is stored in the Dashboard settings (ideas/capacity > leaving); a leaver stays in the list (history kept) and is not deleted
  - The reminder is in the tool: it stays on the Dashboard under What needs fixing until the features have a new owner
  - A merge hides the duplicate row (editors cannot delete in people) and moves everything to the kept name
Corrections to this skill: none
Open / flagged:
  - Reassigning is still done on the roadmap (Plan them opens the person's row); no bulk reassign
  - Seed names from the code (Tramsi, Sahdy, Waradny) come back as seeds if their hidden record is removed
Changelog: Resources manage pop-up; leavers flagged; Gantt lines for linked cards.
```

### 2026-10-28 - Not-on-roadmap flag, log names, Dashboard address
```
🔄 YNMO LEDGER UPDATE - 2026-10-28
Request: flag Monthly cards that are not on the roadmap; log shows the feature name; Dashboard name in the address and online label; why December/January showed Altramsi 13 points
Surface: Ynmo Roadmaps tool (Monthly, Log, Dashboard)
Outcome: amber outline and chip on cards not on the roadmap; log names the card; #/dashboard and "Dashboard" in presence; overload items list their cards
New facts / decisions locked:
  - A card counts as planned on the roadmap when it is a bar on it or came from it
Corrections to this skill: none
Open / flagged:
  - Altramsi 13 in December and January with no points on those months: the cause in the live data is not known; the Dashboard item now lists the cards, and points left in who without track points are ignored
Changelog: Not-on-roadmap flag; log names cards; Dashboard address.
```

### 2026-10-28 - 1 point = 4 hours, 40 points a person
```
🔄 YNMO LEDGER UPDATE - 2026-10-28
Request: 20 working days a month, keep support and buffer monthly, 1 point = 4 hours, a day counted as 7 or 8 hours at most (117.6 was first given; with 8 h days it becomes 112)
Surface: Ynmo Roadmaps tool (Dashboard capacity)
Outcome: capacity default 40 points per person a month (160 h), less 20% support and 10% buffer = 28 points = 112 h; point list 1,2,3,5,8,13,21 with hours
New facts / decisions locked:
  - 1 point = 4 hours; 20 working days x 8 h = 160 h = 40 points; usable 28 points = 112 h
  - Month length no longer changes the capacity; leave still reduces it
Corrections to this skill: the earlier "8 points per person, 5.6 usable" is replaced by 40 and 28 (the 117.6 first discussed needs 8.4 h days; the user then said a day is 8 hours at most)
Open / flagged:
  - Points already on cards were given on the old scale and are not converted; they need re-estimating (1 old point was about 2.5 days = about 5 new points)
  - If Dashboard settings were saved with 8, change the number to 40
Changelog: 1 point = 4 hours; 40 points per person a month.
```

### 2026-10-28 - Dashboard restyle and Monthly version history
```
🔄 YNMO LEDGER UPDATE - 2026-10-28
Request: restyle the Dashboard like the Ynmo statistics dashboard; version history for Monthly to prevent a repeat of the data loss
Surface: Ynmo Roadmaps tool (Dashboard, Monthly)
Outcome: restyled Dashboard; automatic and named month versions with compare, restore and bring-back; warning when a save drops 3 or more cards
New facts / decisions locked:
  - Versions are stored as docs reports/mohist<yyyymm>_a0-a14 (no SQL); automatic ones at most one per 10 min of activity in 15 rotating slots (oldest overwritten, nothing deleted); named ones separate and kept
  - "Bring back only the missing cards" is the one-click fix for a stale-save loss; Restore keeps the board as a named version first
Corrections to this skill: none
Open / flagged:
  - Shrink warning is covered by a unit check of the count rule, not by a UI test (no screen removes 3 cards in one save)
  - History lives in the same table as the data (no point-in-time database backup); the backup patch 0003 is still not applied
Changelog: Dashboard restyled; Monthly version history added.
```

### 2026-10-27 - PMs removed from the Dashboard
```
🔄 YNMO LEDGER UPDATE — 2026-10-27
Request: remove PMs from the dashboard
Surface: cross-cutting (Roadmaps tool)
Outcome: Dashboard has six tracks (AI, Full Stack FE, Full Stack Mobile, BE, Design, Quality); PM people no longer listed
New facts / decisions locked:
  • PMs are not planned on the Dashboard; PM points already on cards are ignored
Corrections to this skill: the November team list in earlier entries included PMs; the Dashboard now excludes them
Open / flagged:
  • Khalid Nazim is no longer needed on the Dashboard; only Khalid Abdelfattah (Design, listed as "Khalid" in Resources) remains
Changelog: PMs removed from the Dashboard.
```
Paste this into Section 11 of the ynmo-master skill to keep it current.

### 2026-10-27 - Dashboard simpler; names follow Resources
```
🔄 YNMO LEDGER UPDATE — 2026-10-27
Request: very simple and easy to understand; Khalid Nazim is the PM, Khalid Abdelfattah is in Design; names must match Resources
Surface: cross-cutting (Roadmaps tool)
Outcome: track people picked from Resources, defaults matched to Resources names, missing names called out with an add button, clickable month cards, team merged into the people heat map
New facts / decisions locked:
  • Khalid Nazim (PMs) and Khalid Abdelfattah (Design) are two different people
  • Dashboard names must be Resources names; leave (Vacations) and the roadmap follow Resources spelling
Corrections to this skill: the earlier note "Khalid is one person counted twice" is wrong; they are two people
Open / flagged:
  • Resources lists Design's Khalid as "Khalid": rename him "Khalid Abdelfattah" in Resources, then re-pick him in Dashboard settings
  • Resources spellings differ from the November list for some people (Tramsi / Altramsi, Sahdy / Shady, Waradny / Wardany): choose the right ones in Dashboard settings
  • Card points saved before names changed keep the old name until the card is reopened and saved
Changelog: Dashboard simplified; names follow Resources; two Khalids.
```
Paste this into Section 11 of the ynmo-master skill to keep it current.

### 2026-10-27 - Dashboard charts
```
🔄 YNMO LEDGER UPDATE — 2026-10-27
Request: charts and bars, like a heat map, on the dashboard
Surface: cross-cutting (Roadmaps tool)
Outcome: heat map of tracks by month, heat map of people by month, columns planned vs capacity, bars per track for a chosen month; month filter, tooltips, Table view for each
New facts / decisions locked:
  • Fullness = one green ramp; over the limit = red with a triangle and the word; no other colours carry meaning
  • Every chart has a table twin and a tooltip; labels set as text only
  • The month filter (default: first month with planned cards) drives the bars and the team
Corrections to this skill: none
Open / flagged:
  • Per-person capacity (default 8 points less reserve and buffer = 5.6) makes many people show over when a card gives one person 8 points: calibrate points per person
  • Charts not yet checked on the live site with real data
Changelog: Dashboard charts: two heat maps, columns, bars.
```
Paste this into Section 11 of the ynmo-master skill to keep it current.

### 2026-10-27 - Points per person; module renamed Dashboard
```
🔄 YNMO LEDGER UPDATE — 2026-10-27
Request: choose tracks first, then the people, then points for each person; rename the Capacity module to Dashboard
Surface: cross-cutting (Roadmaps tool)
Outcome: the points dialog is three steps (tracks, people, points per person); card field `who`; per-person load and capacity on the Dashboard with a month picker; module renamed Dashboard
New facts / decisions locked:
  • Points are given per person; the track total (sum of its people) is what the capacity meters use
  • A person's capacity = points per person less leave, last working day, reserve and buffer; a person in two tracks (Khalid) has one personal load across both
  • The Capacity module is called Dashboard (route stays `#/capacity`)
Corrections to this skill: none
Open / flagged:
  • Old cards with track totals only must be reopened to choose the people
  • Khalid counted in two track capacities (PMs and Design) but once as a person: confirm
Changelog: Points per person and the Dashboard rename.
```
Paste this into Section 11 of the ynmo-master skill to keep it current.

### 2026-10-27 - Capacity dashboard
```
🔄 YNMO LEDGER UPDATE — 2026-10-27
Request: move capacity out of the Monthly columns into a dashboard for business insights: what can move, what to fix, team names per track, leave, and who left or is leaving
Surface: cross-cutting (Roadmaps tool)
Outcome: new Capacity page (months at a glance, what needs fixing with suggested moves, room left per track, the team); meters removed from Monthly; `leaving` added to the capacity settings
New facts / decisions locked:
  • Capacity has its own page; Monthly only shows points on cards, the Points menu, the move warning and a Capacity button
  • A person who leaves (last working day in Capacity settings) stops counting after that day; leave comes from Vacations
  • Suggestions are rule-based: the smallest card that clears the excess, moved to the first later month where every role and the card order still fit
Corrections to this skill: none
Open / flagged:
  • Khalid is listed in PMs and Design and counted in both (shown with an "Also in" note): confirm
  • Points per person (default 8) still to be calibrated from three months of delivered points
Changelog: Capacity dashboard page with team, leave and leavers.
```
Paste this into Section 11 of the ynmo-master skill to keep it current.

### 2026-10-27 - Monthly capacity by role
```
🔄 YNMO LEDGER UPDATE — 2026-10-27
Request: capacity planning in points for the business, with November availability by role (AI, Full Stack FE, Full Stack Mobile, BE, PMs, Design, Quality)
Surface: cross-cutting (Roadmaps tool, Monthly)
Outcome: points by role on cards, capacity meters per month, move warnings, needs (order), Check plan (capacity, order, roadmap dates), settings
New facts / decisions locked:
  • Capacity is per role; default 8 points per person per month, 20% reserve, 10% buffer, working week Sunday to Thursday, leave from Vacations
  • November 2026 people per role: AI (Altramsi, Aliaa, Shady); FE (Amal, Sayeh, Abdelhamid); Mobile (Aya Fathy, Adnan); BE (Soliman, Wardany, Hosieny, Hamid); PMs (Asmaa, Engy, Emad, Khalid); Design (Saad, Khalid); Quality (Mona, Dina Mousa, Zahran, Dina Sam)
Corrections to this skill: none
Open / flagged:
  • Khalid is listed in both PMs and Design; confirm whether it is one person (then count once) or two
  • Points per person is a default, calibrate from delivered points over 3 months
  • The same people list applies to every month until edited in Capacity settings
  • AI review of conflicts was discussed and not built: rule-based Check plan first
Changelog: Monthly capacity in points per role with meters and checks.
```
Paste this into Section 11 of the ynmo-master skill to keep it current.

### 2026-10-27 - Docs and skill brought up to date
```
🔄 YNMO LEDGER UPDATE — 2026-10-27
Request: update all skills and docs needed
Surface: cross-cutting (Roadmaps tool)
Outcome: BUSINESS and ARCHITECTURE updated (sort, details, Jira link, reliability); the outbox fix is pushed on branch fix/outage-outbox (not main, awaiting the owner's choice vs the extension patches); ynmo-master v1.3 proposed
New facts / decisions locked:
  • Main has: sorted-by-default Monthly, Jira link, login retry, merge-safe Monthly saves; the outbox is only on the branch
Corrections to this skill: none
Open / flagged:
  • Choose: regenerate the extension patches against main, or open a PR from fix/outage-outbox
  • Restored cards TF#108..DC#112: comments of TF#108 and PL#109 still missing
Changelog: Docs and skill updated; outbox on a branch.
```
Paste this into Section 11 of the ynmo-master skill to keep it current.

### 2026-10-27 - Cards added by the CTO yesterday not found
```
🔄 YNMO LEDGER UPDATE — 2026-10-27
Request: business cards added yesterday at about 5:00 by Dr Abdullah (CTO) are missing
Surface: cross-cutting (Roadmaps tool, Monthly)
Outcome: cause not confirmed from here; added a guard so a save keeps cards others added; recovery steps given
New facts / decisions locked:
  • Monthly saves read the stored month first and keep unseen cards (writeMonth); same-card edits remain last-writer-wins
Corrections to this skill: none
Open / flagged:
  • Find the lost cards: activity Log for 26 Oct about 17:00, Dr Abdullah's browser tab (do not refresh it), the reports row mo202610 / mo202611 in Supabase
  • Likely causes: his saves failed during the API outage (503), or a stale screen overwrote the month before this fix
Changelog: Monthly saves now keep cards added by others.
```
Paste this into Section 11 of the ynmo-master skill to keep it current.

### 2026-10-27 - Login outage root cause and prevention
```
🔄 YNMO LEDGER UPDATE — 2026-10-27
Request: the outage was fixed (project restarted from the Claude extension); add actions to prevent it in future
Surface: cross-cutting (Roadmaps tool, Supabase)
Outcome: stuck screen retries automatically every 15 s; runbook and prevention list added (monitor, alerts, plan, pre-demo check)
New facts / decisions locked:
  • Root cause: PostgREST (data API) 503 PGRST002 with a healthy database; one stale 27-day-old connection; project status Unhealthy on the free Nano plan; fix = restart the project (no data lost)
  • Prevention: external uptime monitor on /rest/v1 with the publishable key, Supabase email alerts, consider Pro plan, restart after big SQL changes, private-window sign-in check before demos
Corrections to this skill: the earlier entry guessed a missing/unapproved admin profile; the profile was fine (approved, admin), the data API was down
Open / flagged:
  • Set up the uptime monitor and Supabase alerts (needs the owner's accounts; not done from here)
  • Decide on upgrading the plan before executive demos
Changelog: Login outage fixed by restart; auto-retry and prevention runbook added.
```
Paste this into Section 11 of the ynmo-master skill to keep it current.

### 2026-10-27 - Login screen stuck on loading
```
🔄 YNMO LEDGER UPDATE — 2026-10-27
Request: the system keeps loading on the login screen, check the issue
Surface: cross-cutting (Roadmaps tool, sign-in)
Outcome: the screenshots showed sign-in succeeding but the admin's profile unapproved ("Waiting for admin approval"), so the cause is data, not a hang; fix is one SQL update (DEPLOYMENT troubleshooting); app also now times out into a recovery screen and a profile read error is shown instead of being treated as a missing profile
New facts / decisions locked:
  • Boot never waits on the server without a limit; the recovery screen offers Try again and Sign out and start fresh
Corrections to this skill: none
Open / flagged:
  • Run the SQL update that approves the admin profile in YNMO_PM and confirm the login opens the tool
Changelog: Login no longer hangs forever; recovery screen added.
```
Paste this into Section 11 of the ynmo-master skill to keep it current.

### 2026-10-26 - Link sprint tasks to Jira (search as you type)
```
🔄 YNMO LEDGER UPDATE — 2026-10-26
Request: link sprints with Jira so tasks are always connected; type the start of a task and see Jira issues like a connector
Surface: cross-cutting (Roadmaps tool, Sprints)
Outcome: Link to Jira… on sprint tasks with live search (jira-search Edge Function), key chip linking to the issue, status from Jira, Unlink
New facts / decisions locked:
  • Jira Cloud + API token as Supabase secrets (same as jira-sync); read-only; one Jira board per product, so search can be limited by project keys
  • The link is stored as jk on the sprint line; no database change
Corrections to this skill: none
Open / flagged:
  • Deploy the jira-search function in Supabase (same secrets as jira-sync); not yet verified against the real Jira
  • Not built: two-way sync, automatic status refresh without Pull from Jira, typing-in-line suggestions (picker is in the line options)
Changelog: Sprint tasks can be linked to Jira issues by live search.
```
Paste this into Section 11 of the ynmo-master skill to keep it current.

### 2026-10-26 - Sorted by default, off when a card is added
```
🔄 YNMO LEDGER UPDATE — 2026-10-26
Request: make Monthly sorted by product by default; adding a card turns sorting off until the user clicks it again
Surface: cross-cutting (Roadmaps tool, Monthly)
Outcome: default view sorted; adding a card switches sorting off (remembered per browser)
New facts / decisions locked:
  • Sort by product is ON by default; any add-card action sets it OFF; clicking the button turns it on again
Corrections to this skill: the earlier entry said "off by default"; it is now on by default
Open / flagged: none
Changelog: Monthly sorted by default; adding a card turns sort off.
```
Paste this into Section 11 of the ynmo-master skill to keep it current.

### 2026-10-26 - Sort by product (Monthly)
```
🔄 YNMO LEDGER UPDATE — 2026-10-26
Request: add a button beside the filters to sort each Monthly column by product: Tifli, AI, Daycare, Plan, then SCHS and Warif
Surface: cross-cutting (Roadmaps tool, Monthly)
Outcome: Sort by product button; per-column display sort, remembered per browser, no database change
New facts / decisions locked:
  • Product order: Tifli, AI, Daycare, Plan, SCHS, Warif, then Finance, New initiative; stable inside a product
  • Display-only sort; saved card order is unchanged; dropping while sorted appends to the month
Corrections to this skill: none
Open / flagged:
  • Reordering by drag has no visible effect while sorting is on (by design)
Changelog: Monthly: Sort by product button, per column, display only.
```
Paste this into Section 11 of the ynmo-master skill to keep it current.

### 2026-10-26 - Card details and avatar names
```
🔄 YNMO LEDGER UPDATE — 2026-10-26
Request: show the name when hovering the avatars of people online; add per-card details shown as an info icon for the business
Surface: cross-cutting (Roadmaps tool)
Outcome: instant name tooltip on online avatars; Details field + info icon on Monthly cards; Viewers no longer see empty note icons
New facts / decisions locked:
  • Card details are stored on the card as `info` (text up to 4000 chars); executives see the icon only when details exist
Corrections to this skill: none
Open / flagged:
  • Details are plain text (no formatting or images)
Changelog: Card details info icon; avatar names on hover
```

### 2026-10-26 - Monthly smoke test for the executive demo
```
🔄 YNMO LEDGER UPDATE — 2026-10-26
Request: end-to-end and smoke test of Monthly before the executive demo
Surface: cross-cutting (Roadmaps tool)
Outcome: all Monthly suites green; one fix (editing hint hidden from Viewers); new smoke_monthly_exec.py
New facts / decisions locked:
  • Executives (Viewers) see no editing control or internal wording on Monthly
Corrections to this skill: none
Open / flagged:
  • Drag-handle dots overlap the Business priority ribbon on editor view (cosmetic, not shown to executives)
Changelog: Monthly smoke test; viewer hint fixed
```

### 2026-10-25 - Linked features (roadmap, Monthly, weekly report)
```
🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: link feature ids across the roadmap gantt, weekly report and Monthly (title and progress both ways, admin approval, check updates, hidden record per card)
Surface: cross-cutting (Roadmaps tool)
Outcome: shared feature id; roadmap bars have progress; Monthly/report edits wait for admin approval; roadmap changes are checked one by one
New facts / decisions locked:
  • Linked fields: title and progress %. The roadmap bar is the master; progress lives on the bar (pc)
  • Report items link by typing the card id (DC#12); each card/item keeps a hidden record lk {t, pct}
  • Monthly/report -> roadmap needs admin approval; roadmap -> Monthly/report is checked and applied one by one (or Keep mine = request)
Corrections to this skill: none
Open / flagged:
  • Dates and assignee are not linked (only title and progress); only cards added to the roadmap can be linked
  • Roadmap editors can still change a bar directly; approval applies to changes coming from Monthly and the report
Changelog: Feature ids link roadmap, Monthly and report; admin approval queue
```

### 2026-10-25 - QA pass: Monthly and permissions
```
🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: QA engineer pass (end-to-end, edge cases), fix issues without touching live data; "edit permission is not saved" check
Surface: cross-cutting (Roadmaps tool)
Outcome: 6 issues found and fixed (Q1-Q6), 3 new test scripts, full suite green
New facts / decisions locked:
  • Card numbers are never reused (ideas/cardseq); Add to roadmap validates dates inside the roadmap
  • No module access shows a "No access yet" screen; access changes by an admin apply within ~20 s
  • Before 08-permissions.sql, saving permissions stores legacy access only (Edit = every module)
Corrections to this skill: none
Open / flagged:
  • Run supabase/sql/08-permissions.sql (after 07) so per-module levels are enforced and stored
Changelog: QA pass; card numbers, dates, no-access, live access, perms fallback fixed
```

🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: Permission module (per user, per module View / Edit / Delete switches; admins can grant admin to approve users and manage permissions); Monthly Undo only for the user's own actions; remove the Monthly subtitle.
Surface: cross-cutting (Roadmaps tool)
Outcome: Users & permissions page; profiles.perms + core/permissions.js levels enforced in the app and in SQL 08 (tested on a local Postgres); Undo is per-user and change-based; subtitle removed.
New facts / decisions locked:
  • Levels: 0 none, 1 view, 2 edit, 3 delete per module; no perms = the older Editor / Viewer rule; admin = everything. Log is view-only.
  • A person waiting for approval defaults to Viewer in the permissions screen.
  • Last admin cannot be removed (UI and database trigger).
Corrections to this skill:
  • Admin page is "Users & permissions"; Approvals is a card inside it.
Open / flagged:
  • RUN supabase/sql/08-permissions.sql (after 07) in the Supabase SQL editor to enforce levels in the database; until then they are enforced in the app only.
  • Roadmap editors who add a team member need Resources Edit (people table maps to Resources).
Changelog: Users & permissions, per-user Monthly undo, subtitle removed.

🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: Remove the Ideas module; typed "delete" and undo for deleting a month; notes as a comment list (author, date); backlog button above the months; notes on a month column.
Surface: cross-cutting (Roadmaps tool)
Outcome: Ideas page/nav/drawer removed (collection kept as settings store; start-up code moved to app/start.js); month delete needs "delete" and is undoable; card and month notes are threads {id,t,by,at}; Backlog is a bar above the board.
New facts / decisions locked:
  • Ideas module is retired; the Monthly Backlog is the place for unplanned ideas. Old idea cards are still in the `ideas` collection but no longer shown.
  • Notes: card.notes / monthDoc.notes = [{id,t,by,at}]; an old `note` string is read as the first entry.
Corrections to this skill:
  • Pages list no longer includes Ideas.
Open / flagged:
  • Existing idea data is not migrated into the Backlog (say if you want it copied over).
  • Undo restores whole month docs, so it can revert a colleague's edit to that month.
Changelog: Ideas removed; safe month delete; note threads; backlog bar; month notes.

🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: Simplify the UI; add a collapsed Backlog in the Monthly module that the business can drag from, or choose an action on the card, to plan a specific month.
Surface: cross-cutting (Roadmaps tool)
Outcome: Collapsible Backlog column (sticky, remembered), drag or "Plan in month", "Back to backlog"; stored as reports/mobacklog.
New facts / decisions locked:
  • Backlog lives inside Monthly as a pseudo-month doc (mo 'backlog'); its cards have no percentage and are not scheduled on the roadmap.
Corrections to this skill:
  • none
Open / flagged:
  • Backlog and months are still one doc each (same-save overwrite risk); per-card documents not decided.
Changelog: Monthly: collapsible Backlog with drag and Plan in month.

🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: Dragging a card from the top to the bottom does not scroll automatically; fix it.
Surface: cross-cutting (Roadmaps tool)
Outcome: Auto-scroll while dragging a Monthly card (page vertical, board horizontal) near the edges.
New facts / decisions locked:
  • none
Corrections to this skill:
  • none
Open / flagged:
  • Same as before: per-card documents, SQL 07, Auth session limit >= 48 h.
Changelog: Monthly: auto-scroll while dragging a card.

🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: Change a card's tag from a dropdown with an arrow; add SCHS #2e818d and Warif #5dd9d2 tags; add Undo; fix a card disappearing when moved inside one column.
Surface: cross-cutting (Roadmaps tool)
Outcome: ▾ arrow on the tag button; 8 tags (SC#, WR#); Undo button + Ctrl+Z (50 steps, this session); same-column move is one atomic save.
New facts / decisions locked:
  • On-premise products SCHS (#2e818d) and Warif (#5dd9d2) are Monthly tags, ids SC#n and WR#n.
  • Board undo is per browser session; it does not undo "Add to roadmap" or the one-time card numbering.
Corrections to this skill:
  • none
Open / flagged:
  • Undo restores a whole month doc, so it also reverts a colleague's change made to that month since; per-card documents would fix this and the overwrite risk.
Changelog: Monthly: undo, move-bug fix, SCHS and Warif tags.

🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: Remove Sync from Roadmap (add to roadmap from a card instead, with dates and assignee); green note with red bubble; card ids Product abbreviation#ID.
Surface: cross-cutting (Roadmaps tool)
Outcome: Sync removed; card menu "Add to roadmap…" (assignee, squad, start, end) creates a linked bar; ids DC/TF/PL/AI/FN/NI#n; red bubble on notes.
New facts / decisions locked:
  • Card id = tag abbreviation + # + a number that never changes (max+1 across all months); abbreviation follows the tag.
  • Roadmap scheduling is per card, not per month; a card stores rid/rm of its bar.
Corrections to this skill:
  • none
Open / flagged:
  • Same-month overwrite risk (one doc per month); per-card documents not decided. Run supabase/sql/07; check Supabase Auth session limits are not below 48 h.
Changelog: Monthly: add-to-roadmap replaces sync; card ids; note bubble.

🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: Split Plan and Daycare in the Monthly module; tags chosen from a dropdown: Daycare pink, Tifli purple, Plan green, AI blue, Finance grey, New initiative gold
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: The Monthly board has six fixed tags with those colours (dropdown on each card, chips when adding); old combined Plan / Daycare cards are converted to Plan.
New facts / decisions locked:
  • Monthly tags: Daycare #d6338a pink, Tifli #6d48a8 purple, Plan #0d8560 green, AI #2f6fe0 blue, Finance #7b8099 grey, New initiative #d9a400 gold. Sync maps squads daycare / tifli / plan / ai to their tag; Finance and New initiative are chosen by hand.
  • The weekly report still uses its own products (Plan / Daycare combined there).
Corrections to this skill:
  • none
Open / flagged:
  • Should the weekly report also split Plan and Daycare?
  • Roadmap squads other than daycare / tifli / plan / ai (custom lanes) are skipped by the Monthly sync; say if they should map to a tag.
Changelog: Monthly: six colour tags (Plan and Daycare split).

🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: Keep every user signed in for 48 hours (no direct sign-out); rename the gold flag "Business priority"; replace "Mark as ad hoc request" with a small-enhancement star icon beside the flag
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: Idle sign-out is now 48 hours (was 30 min), still with the 60-second warning. Gold flag = Business priority (ribbon). Star button = Small enhancement; ad hoc item removed from the card menu.
New facts / decisions locked:
  • Session rule: signed out only after 48 hours without activity; activity time survives closing the tab (stored in the browser) or is the sign-in time if newer.
  • Gold flag is called Business priority; the star is Small enhancement (`sz:'enh'`); Quick win stays in the menu.
Corrections to this skill:
  • Idle logout is 48 hours, not 30 minutes.
Open / flagged:
  • In Supabase (Authentication > Sessions) make sure no time-box or inactivity timeout is set shorter than 48 hours, and that the JWT/refresh settings allow it; the app cannot change that.
  • Still pending: run supabase/sql/07-reports-editor-delete.sql; unfinished features carrying to next month; green threshold (100%); per-card documents to remove the same-month overwrite risk.
Changelog: 48h sessions; Business priority flag; small-enhancement star.

🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: Monthly cards: Quick win / Enhancement flag, notes with green icon and hover tooltip, gold high-priority flag
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: Cards carry `hp` (gold flag, high priority), `sz` ('quick' / 'enh') and `note`; flag filter and copy text include them; executives see all of it read-only.
New facts / decisions locked:
  • Gold = high priority (set by the business, one click). Quick win and Enhancement are one-at-a-time size tags in the card menu. A card note shows as a tooltip and its icon is green.
Corrections to this skill:
  • none
Open / flagged:
  • Still pending: run supabase/sql/07-reports-editor-delete.sql; unfinished features carrying to next month; green threshold (100%); per-card documents to remove the same-month overwrite risk.
Changelog: Monthly cards: gold high-priority flag, Quick win/Enhancement tags, notes.

🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: Make sure every user working on the Monthly module sees the others' changes
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: Tested two editors and an executive on the board at once. Changes reached everyone, but a user with the "Add a card" box open did not see others' cards until closing it; fixed (live refresh, draft text kept).
New facts / decisions locked:
  • A month is one document, so two people saving the same month within the same split second can overwrite one card (last write wins, same as weekly reports). Different months never clash.
Corrections to this skill:
  • none
Open / flagged:
  • Decide whether to store each card as its own document to remove the same-month overwrite risk (a bigger change).
Changelog: Monthly board refreshes live while typing in the composer.

🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: Make the Monthly board more like Trello: change a card's product colour, insert a new card smoothly
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: "+ Add a card" composer at the bottom of each column (product colour chips, Enter adds and stays open, pasted list = cards, Esc closes); product label on a card opens a product menu and repaints the card; drag cards to re-order or into another month with a drop line.
New facts / decisions locked:
  • Card order inside a month is the order of `lines` in the month doc (drag changes it).
Corrections to this skill:
  • none
Open / flagged:
  • Still pending: run supabase/sql/07-reports-editor-delete.sql; decide whether unfinished features carry to the next month; green threshold (100%).
Changelog: Monthly board: Trello-style composer, product relabel, drag re-order.

🔄 YNMO LEDGER UPDATE — 2026-10-25
Request: Remove Capacity and Baselines; new Monthly deliverables module like Ideas, one column per month (October, November, + add month), cards coloured by product, Sync from Roadmap per month, never replicate a feature written on several people
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: Capacity and Baselines pages (and "Plan vs now" ghost bars) removed; Monthly deliverables is a board with a column per month, product-coloured cards, per-month sync, move/drag, ad hoc, search/filter; executives see it read-only.
New facts / decisions locked:
  • A roadmap feature is a deliverable of the month it ENDS in, and exists once on the whole board: bars with the same product and title (several people) are one card; a feature already in any month is skipped by sync.
  • Months live in `reports/mo<yyyymm>` and are always saved as `submitted` (executives see every month); old drafts are switched to submitted when an editor opens the board.
  • The `baselines` table and its data stay in the database, unused.
  • Board shows this month, the next, then added months; earlier months are behind "Show past months".
Corrections to this skill:
  • Capacity and Baselines no longer exist in the tool.
Open / flagged:
  • Should a feature that is not finished stay on its month (current) or carry to the next month?
  • The board has no undo (like Ideas); say if you want it.
Changelog: Monthly deliverables board; Capacity and Baselines removed.

🔄 YNMO LEDGER UPDATE — 2026-10-21
Request: Remove hide/delete duplication on items; out-of-scope flag; rename/remove products (Sara); remove rich text; Submit becomes Save; delete only from the list menu for editors; professional PDF
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: Plain-text items with ✕ delete, out-of-scope flag, renamable/removable sections, Save button (shares with executives, stays editable), delete only in the list ⋯ menu for editors, new print/PDF document. New SQL 07.
New facts / decisions locked:
  • "Save" = status `submitted` (visible to executives) but the report stays editable; no Reopen. Reports have `hidePl` (removed product keys) and items carry `rk` (at risk, red), `fl` (out of scope, grey, greys the row) and `note`.
  • Any editor may delete a report (SQL 07 replaces the admin-only rule for saved reports). Delete exists only in the list menu.
  • Print/PDF is a separate document built from data (features/report-print.js), not the editing screen.
Corrections to this skill:
  • none
Open / flagged:
  • Run supabase/sql/07-reports-editor-delete.sql in the Supabase SQL Editor, otherwise deleting a saved report fails for editors.
  • (closed 2026-10-25) The Monthly deliverables board replaced the month sheet: no Submit/Reopen, months are always saved as submitted.
Changelog: Plain items, out-of-scope flag, renamable sections, Save, list-only delete, professional PDF.

🔄 YNMO LEDGER UPDATE — 2026-10-21
Request: The formatting bar is not working; allow resizing and bold, just basics
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: Per-product bar reduced to Bold, smaller/larger text and Normal, applied to the whole clicked item and saved.
New facts / decisions locked:
  • Weekly report items carry `fb` (bold) and `fs` (size step -1..3); formatting is per item, not per selection.
Corrections to this skill:
  • none
Open / flagged:
  • none
Changelog: Basic bold and size formatting per item that works reliably.

🔄 YNMO LEDGER UPDATE — 2026-10-21
Request: Remove "Open the month"; progress calculated from the items written below (0 until items exist); add product sections that show in the bars; formatting per product; per-item note with hover tooltip
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: Weekly report progress block computed from its own items; "+ Product section"; formatting bar inside each product; item notes as icon + tooltip.
New facts / decisions locked:
  • Weekly progress = average of the items' percentages (overall: all items; per product: its items); no weighting, 0% when empty. The Monthly page keeps its own weighted figures and is not shown in the weekly report any more.
  • Report products may be custom (`custom:true`, own `c` colour) and live only in that report; items may carry `note` (plain text, up to 1000 characters).
Corrections to this skill:
  • none
Open / flagged:
  • The weekly report and the Monthly page now show different percentages by design; say if the weekly report should link or reuse the Monthly figures.
Changelog: Weekly progress from its own items; product sections; per-product formatting; item notes.

🔄 YNMO LEDGER UPDATE — 2026-10-20
Request: Make the report dates/label editable; per product no big text, only items; each item a coloured percentage dropdown
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: Weekly report = per-product item list with coloured 0-100% dropdown; product header and tiles show the average; dates (From/To) and label editable; AI button and summary box removed.
New facts / decisions locked:
  • Weekly report doc gains `label` (free text, default "Sprint n · week w of 2"); `a`/`b` can be edited (the doc id stays `rp<original start>`).
  • Product summaries, group headings and the AI button are gone from the weekly report; `sum` is no longer shown.
Corrections to this skill:
  • none
Open / flagged:
  • `weekly-draft` Edge Function and Gemini key are no longer used by the UI; can be left undeployed.
Changelog: Weekly report is a simple item list with coloured percentages; editable dates and label.

🔄 YNMO LEDGER UPDATE — 2026-10-20
Request: Remove all generated items from all products (only I will add items); line dropdown as percentage 10, 20, 30 ... 100; more padding on the report toolbar
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: New weekly reports start with empty product sections; Sync from Sprint & Roadmap is optional; Clear all items button; per-line percentage dropdown (0-100 step 10, coloured); toolbar padding fixed.
New facts / decisions locked:
  • Weekly report lines carry `pct`; choosing 100 marks the line done, a lower value un-does done. Old lines without `pct` show 100 if done, else 0.
  • A new report is empty by design; the AI button only rewrites existing items.
Corrections to this skill:
  • none
Open / flagged:
  • The per-line status (On Track / At Risk / Delayed) is no longer a dropdown; risks go in the "Risks & decisions" group. Say if you want the status back as a second control.
Changelog: Empty weekly reports by default; percentage dropdown per line; clear all items.

🔄 YNMO LEDGER UPDATE — 2026-10-20
Request: Where to add the percentage; remove the heavy section from the weekly report; leave Monthly product sections empty to fill by hand; colour each percentage (yellow 1-50, orange above 50, then green)
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: "Next" group removed from the weekly report; percentages on the Monthly page are colour-coded; a new month starts with empty product sections (Sync from Roadmap stays optional).
New facts / decisions locked:
  • Weekly report groups: Delivered this week, In progress, Risks & decisions, Roadmap milestones (no "Next").
  • Percentage colours: 0 grey, 1-50 yellow, 51-99 orange, 100 green.
Corrections to this skill:
  • none
Open / flagged:
  • Confirm that green should start at 100 (the request said "after that green"); easy to change to e.g. 75+.
Changelog: Dropped Next list from weekly report; colour-coded monthly percentages.

🔄 YNMO LEDGER UPDATE — 2026-10-20
Request: Delete a weekly report; make the monthly view easy to show to executives as a Notion-style page like Sprints, with "Sync from Roadmap" per product and an editable assumed percentage
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: New Monthly page (list of cards + white sheet, nav item, #/monthly/YYYY-MM) with Sync from Roadmap, estimated editable percentages, weights, ad hoc requests, carry-forward, undo, copy, print, submit/reopen, delete; weekly report shows it read-only; Delete report added (list menu and page). No SQL change.
New facts / decisions locked:
  • Monthly lives in its own doc `reports/mo<yyyymm>` (same table and RLS as weekly reports); the editor inside the weekly report was removed.
  • Assumed percentage: Done = 100; otherwise share of days passed, rounded to 5, at most 90 until Done; milestones 0 until Done. A percentage a person edits is never overwritten by a later sync.
  • Deleting: editors delete drafts, only admins delete submitted reports/months.
Corrections to this skill:
  • none
Open / flagged:
  • Confirm with the business that the estimate rule (days passed) is acceptable as a starting point.
  • Confirm "complete" definition and importance weights.
Changelog: Monthly page with roadmap sync and editable percentages; delete weekly report.

🔄 YNMO LEDGER UPDATE — 2026-10-20
Request: The business wants each month's deliverables in the weekly report with a percentage of completion (a list that stays the same over the month, only the percentages change) and the ad hoc requests they add
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: Monthly deliverables section on the weekly report: per product, percent complete + importance weight, weekly change, carried forward each week; ad hoc requests with requester listed separately; read-only for executives after submit; copy text, list card and undo covered. No SQL change.
New facts / decisions locked:
  • The month's progress counts planned deliverables only (weighted by importance); ad hoc requests have their own percentage and count.
  • Percent complete is entered by the team (research: automatic or equal-weight percentages mislead; milestone-style checkpoints and weights are the common practice). Not derived from Jira.
  • A week belongs to the month of its middle day.
Corrections to this skill:
  • none
Open / flagged:
  • Ask the business whether they want a different definition of "complete", different weights, or the percentage tied to Jira epics later.
  • Check the section with the business on a real week and adjust wording.
Changelog: Monthly deliverables with percent complete and ad hoc requests in the weekly report.

🔄 YNMO LEDGER UPDATE — 2026-10-18
Request: Update the ledger and the project docs in GitHub
Surface: cross-cutting (Ynmo Roadmaps internal tool)
Outcome: Added this ledger; refreshed README, ARCHITECTURE, BUSINESS, DATABASE, SECURITY, DEPLOYMENT, TESTING and CHANGELOG to match the code.
New facts / decisions locked:
  • The ledger for this tool lives in `docs/LEDGER.md`; the skill's Section 11 stays the home of product-wide facts.
Corrections to this skill:
  • none
Open / flagged:
  • See "Open items" above.
Changelog: Ledger and project docs brought fully up to date.

🔄 YNMO LEDGER UPDATE — 2026-10-18
Request: Sharing the tool from Google Meet: scrolling the shared tab
Surface: cross-cutting
Outcome: Explained the browser limit and workarounds (own window, share the window, "Switch to this tab", PDF or share link); offered a presentation mode.
New facts / decisions locked:
  • A shared tab is scrolled only from the tab itself; not a tool bug.
Corrections to this skill:
  • none
Open / flagged:
  • Does she want a presentation mode, or is there a scroll bug on a specific page while sharing?
Changelog: Meet tab-sharing scroll limit explained; presentation mode offered.

🔄 YNMO LEDGER UPDATE — 2026-10-18
Request: Redesign the Reports module like Sprints
Surface: cross-cutting
Outcome: Reports is a list of week cards plus a `#/reports/<id>` sheet page with breadcrumb, sprint-style toolbar and product-coloured sections (`e4131fc`). 88/88 e2e and all feature scripts pass.
New facts / decisions locked:
  • Report data, AI wording, undo, submit/reopen and settings are unchanged.
  • Viewers can only open submitted reports.
Corrections to this skill:
  • The old single-page Reports layout (report dropdown, gradient hero, boxed product cards) no longer exists.
Open / flagged:
  • Check Print / PDF from the new layout.
Changelog: Reports redesigned: list of week cards, sprint-style report sheet.

🔄 YNMO LEDGER UPDATE — 2026-10-18
Request: Google Drive export setup and errors (Client ID vs secret; "Could not load Google sign-in")
Surface: cross-cutting
Outcome: Guided the Google Cloud setup (project YNMO PM, Drive API, Internal consent, Web client with the production origin). Client ID goes into the tool; the secret is unused and stays private. The sign-in script error was `net::ERR_NETWORK_CHANGED` (a transient connection change), not the CSP or a blocker.
New facts / decisions locked:
  • The loader clears its cached promise on failure, so a retry works without a page reload.
Corrections to this skill:
  • none
Open / flagged:
  • Item 1 and 2 of the open items.
Changelog: Google Cloud client created; Client ID in tool, secret unused; load error was transient.

🔄 YNMO LEDGER UPDATE — 2026-10-18
Request: Link a Google Doc and export the sprint plan; fix the sprint page scroll jump
Surface: cross-cutting
Outcome: Link field and "Copy for Docs" (`045eb04`), then a real Google Drive export through sign-in (`ae2b2ff`); the scroll jump when clicking beside a line or after a redraw is fixed (`7ffbc1b`).
New facts / decisions locked:
  • Export creates a native Google Doc in the user's Drive and updates only docs the tool created; otherwise it makes a new one and links it.
Corrections to this skill:
  • none
Open / flagged:
  • First real export not yet run; the hover-only scroll jump could not be reproduced (ask for browser and what is hovered if it returns).
Changelog: Google Docs link and Drive export; sprint page scroll fix.

🔄 YNMO LEDGER UPDATE — 2026-10-15
Request: Jira sync of each resource's tickets while sprint planning
Surface: cross-cutting
Outcome: Read-only `jira-sync` Edge Function and a "Pull from Jira" button on the sprint page (`1936856`): tickets become scopes under each person, subtasks become sub-sections, Bug becomes a `#fix` tag, pulling again only adds new tickets and updates statuses.
New facts / decisions locked:
  • API token route chosen over Rovo.
  • Project to squad mapping: DYC to Daycare, FAS to Tifli, AU to AI, otherwise the person's own squad.
Corrections to this skill:
  • none
Open / flagged:
  • Jira go-live (open item 3).
Changelog: Pull from Jira (read-only) added to sprints.

🔄 YNMO LEDGER UPDATE — 2026-10-15
Request: Drag up between people; sections for Deployments and Quality scope; assign an epic to a product and colour bars by product; no colour buttons
Surface: cross-cutting
Outcome: Dragging up now works like dragging down (`e25dec6`); sprints can have Deployments and Quality scope sections; bars are coloured by product, chosen in the bar menu; the Product colours button and the per-bar palette were removed (`fdde6c6`).
New facts / decisions locked:
  • Product colours only, no toolbar button.
Corrections to this skill:
  • The 52-colour bar palette and rainbow picker (2026-10-01) no longer exist.
Open / flagged:
  • none
Changelog: Upward drag fix; Deployments and Quality sections; product-coloured bars.

🔄 YNMO LEDGER UPDATE — 2026-10-05
Request: Timeline notes (person ribbons, period notes) and making them easy to find
Surface: cross-cutting
Outcome: Person ribbons, period notes with bands and an automatic leave strip, also in the PDF (`0f169d2`); "Add note" toolbar button and bar-menu items (`421e924`).
New facts / decisions locked:
  • Notes live in `ideas` meta docs (`tn-…`).
Corrections to this skill:
  • none
Open / flagged:
  • Notes are not covered by roadmap Undo or by read-only share links.
Changelog: Timeline notes added and made discoverable.

🔄 YNMO LEDGER UPDATE — 2026-10-01 to 2026-10-04
Request: Roadmap polish: products module, PDF export, per-person dates, rename, add member, drag auto-scroll
Surface: cross-cutting
Outcome: Products can be recoloured, renamed and added (Tifli has its own colour); coloured full-timeline PDF export replaced Share/CSV/Today toolbar buttons (sharing is on each Roadmaps card); per-person dates on shared epics; people and squads can be renamed on Resources; add member lets you choose roadmaps; member removal is confirmed and blocked while features are assigned; the chart scrolls while dragging; hover card on bars.
New facts / decisions locked:
  • Sharing a read-only link lives on each card of the Roadmaps page.
Corrections to this skill:
  • none
Open / flagged:
  • none
Changelog: Products module, PDF export, per-person dates, rename, add member, drag auto-scroll.

🔄 YNMO LEDGER UPDATE — 2026-09-30
Request: Sprints and the weekly executive report
Surface: cross-cutting
Outcome: Sprint list and per-sprint document editor (sections, people, scopes, sub-sections, tags, paste a list, drag to reorder, per-user undo, editable sprint number), weekly report built from the sprint plan and the roadmap with optional Gemini wording (`weekly-draft`, retries then falls back), rich-text editing, report undo, toasts, searchable dropdowns.
New facts / decisions locked:
  • One report per week (a sprint lasts two weeks); executives (viewers) see only submitted reports; editors and admins submit.
Corrections to this skill:
  • none
Open / flagged:
  • Deploy `weekly-draft` with `GEMINI_API_KEY` (open item 4).
Changelog: Sprints document editor and weekly executive report with AI wording.
