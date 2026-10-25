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
| **Ideas** | Trello-style board; editable/recolourable/reorderable product columns; drag cards between products; impact/effort score; schedule an idea onto the roadmap | Keeps the backlog next to the plan, no lost ideas |
| **Roadmaps** | Multiple roadmaps with own date ranges (H2, Q1, …) | Reuse the tool across periods |
| **Resources** | Team directory (roles, domain, avatar). In the by-person roadmap each row has a drag grip to reorder (shared by everyone) and a ⋯ menu: Move up/down and Hide from this roadmap (empty rows only; other roadmaps and the team are untouched; "Show hidden" brings it back) | Assignment source; rows ordered the way the team thinks |
| **Vacations** | Leave calendar, affected features per person | Realistic delivery dates |
| **Sprints** | Two-week sprint plan written like a document (product sections incl. Deployments and Quality scope, people, scopes, sub-sections, notes, tags, drag to reorder, per-user undo). Pull each person's tickets from Jira (read-only), carry over unfinished scopes, export the plan to a real Google Doc in your own Drive | Replaces the manual sprint doc and the copy/paste into Docs |
| **Weekly report** | One report per week, listed as cards like Sprints. Each opens as a sheet: auto-drafted from the sprint plan and the roadmap (optionally worded by AI), edited by the team, submitted by an editor/admin and read by executives (read-only, submitted only) | Replaces the manual weekly newsletter |
| **Monthly deliverables** (a board like Ideas: one column per month, from this month on; "+ Add month" adds the next) | The business's deliverables per month. Every card is one deliverable, coloured by its product, with a percentage 0-100 in steps of 10 (yellow 1-50, orange 51-99, green 100); each month shows its progress. "Sync from Roadmap" in a column brings the roadmap features that END in that month, once each: a feature written on several bars or people is one card, and a feature already on the board (any month) is never added again. Cards are added Trello-style ("+ Add a card" at the bottom of a column, Enter adds the next one, a pasted list makes one card per line), repainted by changing their product label, edited, marked as ad hoc requests, flagged high priority (gold flag), tagged Quick win or Enhancement (to see which items are small), given a note (green icon, shown on hover), re-ordered or moved to another month by dragging (or the menu), and deleted. Executives see every month read-only | Answers "how far along is what we committed each month, and what did we take on besides" in one board that is easy to present |
| **Log** | Every change with who/when; export; undo | Audit trail and safe experimentation |
| **Sharing** | Read-only public link per roadmap; Editor/Viewer access | Stakeholder transparency without accounts |
| **Presence** | See who is online; soft lock warning when two people edit one bar | Avoids overwriting each other |
| **Approvals** | Admin approval queue | Controlled access |

## 5. Key workflows
1. **Onboarding:** sign up → confirm email → "pending approval" screen → admin approves as Editor/Viewer → user enters.
2. **Planning a period:** create roadmap (range) → add features per squad → assign people → set dependencies.
3. **Weekly review:** open Roadmap → adjust → share link to leadership.
4. **Idea to plan:** capture on Ideas board → score → "Schedule" pushes it onto the roadmap as a feature.
5. **Monthly deliverables:** at the start of the month open Monthly, create the month and press "Sync from Roadmap" (or copy last month's unfinished), edit the percentages as work moves, add ad hoc requests with who asked, then submit. The weekly report shows the month read-only. Weeks can be deleted if created by mistake.
6. **Sprint to executive report:** write the sprint plan (pull Jira tickets) → open the week's report → Sync / Generate with AI → edit → Submit; optionally export the sprint plan to Google Docs.

## 6. Business rules
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
