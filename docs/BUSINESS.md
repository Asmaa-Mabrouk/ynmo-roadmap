# Business & Product Overview

## 1. Why this exists
Ynmo runs several products (Tifli, Plan · Warif · Sharjah, Daycare, AI) with separate squads. Roadmaps used to live in
slides and spreadsheets: outdated the day after a meeting, no single owner, no history, no view of who is free or on leave.
**Ynmo Roadmaps** is the single, always-current source of truth for *what ships when, who is on it, and what changed*.

## 2. Users and roles
| Role | Who | Can do |
|---|---|---|
| **Admin** | Product lead(s), listed in `admin_emails` | Everything + approve/revoke users, set Editor/Viewer |
| **Editor** | PMs, engineers, QA, UX | Create/edit/move/delete features, ideas, people, vacations, roadmaps |
| **Viewer** | Executives (CEO/CTO/…) and stakeholders | Read-only: Roadmap, Log, submitted Weekly reports, Monthly deliverables |
| **Public link visitor** | Anyone with a share link | Read-only snapshot of one roadmap, no login, revocable |

Sign-up is open to anyone, but **nobody sees data until an admin approves** them (email notification to admins).
Job types offered at sign-up: Product Manager, Engineer, QA, UX / Design, CEO, CTO, Executive, Other.

## 3. Squads and reference data
Lanes: **Tifli · AI · Plan · Warif · Sharjah · Daycare**. Statuses: *Planned, Needs decision, Waiting on contract, Done*.
Team roles per squad: PM, Engineer, Quality, UX. The current H2-2026 plan is seeded (Oct 2026 – Jan 2027) and can be
replaced by creating new roadmaps with their own date range.

## 4. Feature catalogue (what a user can do)
| Area | Capability | Business value |
|---|---|---|
| **Roadmap** | Day-level Gantt grouped by squad or by person; drag to move/resize and between people or squads; inline edit; filters; zoom; bars take their product's colour (set the product in the bar menu); timeline notes and automatic leave strip; coloured full-timeline PDF export | Fast planning, one view for everyone |
| Milestones & dependencies | Diamond milestones; "depends on" arrows; warning when a bar starts before its predecessor ends | Surfaces schedule risk early |
| **Roadmaps** | Multiple roadmaps with own date ranges (H2, Q1, …) | Reuse the tool across periods |
| **Resources** | Team directory (roles, domain, avatar). In the by-person roadmap each row has a drag grip to reorder (shared by everyone) and a ⋯ menu: Move up/down and Hide from this roadmap (empty rows only; other roadmaps and the team are untouched; "Show hidden" brings it back) | Assignment source; rows ordered the way the team thinks |
| **Vacations** | Leave calendar, affected features per person | Realistic delivery dates |
| **Sprints** | Two-week sprint plan written like a document (product sections incl. Deployments and Quality scope, people, scopes, sub-sections, notes, tags, drag to reorder, per-user undo). Pull each person's tickets from Jira (read-only), carry over unfinished scopes, export the plan to a real Google Doc in your own Drive | Replaces the manual sprint doc and the copy/paste into Docs |
| **Weekly report** | One report per week, listed as cards like Sprints. Each opens as a sheet: built in one click from the sprint plan, the roadmap and the Monthly cards of the month (optionally worded by AI), kept up to date while it is a draft, edited by the team, submitted by an editor/admin and read by executives (read-only, submitted only) | Replaces the manual weekly newsletter |
| **Monthly deliverables** (a Trello-style board: one column per month, from this month on; "+ Add month" adds the next) | The business's deliverables per month. Every card is one deliverable with a tag chosen from a dropdown (Daycare pink, Tifli purple, Plan green, AI blue, Finance grey, New initiative gold, SCHS teal and Warif aqua for the on-premise products; the arrow on a card's tag changes it) that colours the card, with a percentage 0-100 in steps of 10 (yellow 1-50, orange 51-99, green 100); each month shows its progress. The **Backlog** (button in the toolbar, closed until opened) holds ideas not planned yet; plan one by dragging it into a month or with ⋯ → Plan in month. Every card has an id such as DC#12 (tag abbreviation # number; click it to copy) for easy tracking, and can be put on the roadmap from its menu ("Add to roadmap": assignee, squad, start and end dates), after which it shows "On roadmap". Cards are added Trello-style ("+ Add a card" at the bottom of a column, Enter adds the next one, a pasted list makes one card per line), repainted by changing their product label, edited, marked as ad hoc requests, flagged as business priority (gold flag with a ribbon), starred as a small enhancement or tagged Quick win (to see which items are small), given a note (green icon with a red bubble, shown on hover), re-ordered or moved to another month by dragging (or the menu), and deleted. Executives see every month read-only | Answers "how far along is what we committed each month, and what did we take on besides" in one board that is easy to present |
| Monthly: **Carry over**, **filters by person and points** | An unfinished card moved to a later month asks why and gets the tag "Carry over from <month>: reason" (also settable by hand in ⋯). Editors can filter the board by **Assigned to** (anyone given points) and **Points** (with, none, or exactly 1-21). The Dashboard's people heat map lists only people who get points (no Design or Quality rows) | Shows what slipped and why; finds one person's cards quickly |
| Monthly: **Sort by product** and **card details** | A button beside the filters lists every column as Tifli, AI, Daycare, Plan, SCHS, Warif (on by default; adding a card turns it off until clicked again). Each card can carry **details** shown as an ⓘ icon (hover to read, click for all), read-only for executives | The business reads the board in a fixed product order and understands a feature without asking |
| **Dashboard** (own page, was Capacity; six tracks, PMs are not planned there; with a heat map of tracks and of people by month, columns of planned against capacity, bars per track, and a Table view of each) | Points on each Monthly card chosen in three steps (tracks, people, points per person); a dashboard with the months at a glance (Fits / Tight / Over), what needs fixing (with a suggested card to move), the room left in each track, and the team per track with leave and who has left or is leaving; a warning before a move that overloads a role or breaks card order | The business can shuffle features freely and see the effect on each team before committing |
| Sprints: **Link to Jira** | A sprint task is linked to a Jira ticket by searching as you type (or its key); shows the key as a link and takes the Jira status. Read-only, editors only | Tasks stay connected to Jira without retyping |
| **Reliability** | If the server does not answer, the sign-in screen retries by itself every 15 s; a Monthly save keeps cards others added; presence avatars show names on hover | Nobody is locked out or loses a colleague's cards during an outage |
| **Log** | Every change with who/when; export; undo | Audit trail and safe experimentation |
| **Sharing** | Read-only public link per roadmap; Editor/Viewer access | Stakeholder transparency without accounts |
| **Presence** | See who is online; soft lock warning when two people edit one bar | Avoids overwriting each other |
| **Users & permissions** (admins) | Approve registered people; per person and per module View / Edit / Delete switches; make other people admins | Controlled access: each person sees and changes only their modules |

## 5. Key workflows

**Keeping a feature in step:** a feature on the roadmap has one id (for example DC#12) shown on its Monthly card and in the weekly report. Title and progress stay linked. People in Monthly or the report propose changes and an admin approves them onto the roadmap; changes made on the roadmap are checked and applied by the team one by one in Monthly and the report.
1. **Onboarding:** sign up → confirm email → "pending approval" screen → admin approves as Editor/Viewer → user enters.
2. **Planning a period:** create roadmap (range) → add features per squad → assign people → set dependencies.
3. **Weekly review:** open Roadmap → adjust → share link to leadership.
4. **Idea to plan:** park it in the Monthly **Backlog**, then plan it into a month and use "Add to roadmap" on its card.
5. **Monthly deliverables:** at the start of the month open Monthly, create the month and add the cards (or copy last month's unfinished); use "Add to roadmap" on a card to schedule it, edit the percentages as work moves, add ad hoc requests with who asked, move unfinished cards to the next month (the card gets the tag "Carry over from <month>" and you say why), then submit. The weekly report shows the month read-only. Weeks can be deleted if created by mistake.
6. **Sprint to executive report:** write the sprint plan (pull Jira tickets) → open the week's report → Sync / Generate with AI → edit → Submit; optionally export the sprint plan to Google Docs.

## 6. Business rules
- **People who leave:** in Resources, ⋯ → Left the company, set the last working day. The Dashboard stops counting them from that day; features they own after it are flagged (Gantt bar, Resources tag, Dashboard item) until reassigned. Duplicates are merged from the same pop-up. Nobody is deleted, so history stays.
- **Sprint lines must be on the plan:** a scope written under a person in a sprint is expected to exist as a roadmap feature or a Monthly card with that person assigned. If not, it is highlighted (red: not on the plan, amber: not assigned to that person) so the plan and the sprint agree. Unplanned urgent work is tagged #fix or #support and is not flagged.
- **Points are hours:** 1 point = 4 hours. A person has 20 working days x 8 h = 160 h = 40 points a month; 20% support and 10% buffer come off, leaving 28 points (112 h). A track takes the sum of its people.
- **Leave and leaving use the same rule:** every month counts as 20 working days (Sunday to Thursday), whatever the calendar says. Every working day of leave, and every working day after someone's last working day, takes 2 points (1 day = 8 h) off that person for the month (40 points a month, less 2 per lost day, then 30% off for support and buffer). In the people heat map a month with leave shows 🌴 and the days; hover to see the days and the points. Leave is entered once, in Vacations; Monthly has no separate vacation card (it would count the same days twice).
- **Part time:** a person marked at 50% in Resources > ⋯ takes half of the month's points (14 usable instead of 28), a leave day still costs 2 points (8 hours), and the Dashboard shows "Part time 50%" and counts the track in full-time equivalents.
- **Monthly version history:** every change to a month is kept as a version (time, who, cards). Editors can open **Version history** from the month menu, see what differs from now, **Bring back only the missing cards** (keeps newer work), **Restore this version**, or **Save a version** with a name (never deleted automatically). A save that would remove 3 or more cards at once asks first.
- Approval is mandatory; unconfirmed emails never become admin.
- Viewers cannot mutate anything (enforced in UI *and* by database policies).
- Every mutation is logged; undo appends a new log entry instead of rewriting history.
- Weekend = Friday + Saturday (Saudi work week).
- Nov/Dec 2026 are flagged *low priority* on the seeded H2 roadmap.

## 7. Success measures (suggested)
Roadmap freshness (last edit < 7 days), % features with an owner, number of at-risk dependencies, stakeholder link views,
time to approve a new user.

## 8. Out of scope today / candidates
card layout for Resources on phones, list view instead of Gantt on small screens,
notifications for date changes, SSO, a presentation mode for sharing in meetings (a shared tab can only be scrolled from the tab itself), the Slack daily-standup feed into the weekly report (parked until Jira is live), undo for timeline notes, notes in read-only share links.

## Glossary
**Lane/squad** product team row · **Bar** a feature on the timeline · **Baseline** frozen plan snapshot ·
**Milestone** zero-length bar · **Soft lock** advisory warning, not a hard block · **RLS** Postgres Row Level Security.
