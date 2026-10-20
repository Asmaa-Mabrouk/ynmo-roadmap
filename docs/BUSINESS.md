# Business & Product Overview

## 1. Why this exists
Ynmo runs several products (Tifli, Plan · Warif · Sharjah, Daycare, AI) with separate squads. Roadmaps used to live in
slides and spreadsheets: outdated the day after a meeting, no single owner, no history, no view of who is free or on leave.
**Ynmo Roadmaps** is the single, always-current source of truth for *what ships when, who is on it, and what changed*.

## 2. Users and roles
| Role | Who | Can do |
|---|---|---|
| **Admin** | Product lead(s), listed in `admin_emails` | Everything + approve/revoke users, set Editor/Viewer, delete baselines |
| **Editor** | PMs, engineers, QA, UX | Create/edit/move/delete features, ideas, people, vacations, roadmaps, baselines |
| **Viewer** | Executives (CEO/CTO/…) and stakeholders | Read-only: Roadmap, Capacity, Baselines, Log, submitted Weekly reports |
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
| **Capacity** | Weekly heat-map of load vs. availability | Spot over-allocation before it hurts |
| **Sprints** | Two-week sprint plan written like a document (product sections incl. Deployments and Quality scope, people, scopes, sub-sections, notes, tags, drag to reorder, per-user undo). Pull each person's tickets from Jira (read-only), carry over unfinished scopes, export the plan to a real Google Doc in your own Drive | Replaces the manual sprint doc and the copy/paste into Docs |
| **Weekly report** | One report per week, listed as cards like Sprints. Each opens as a sheet: auto-drafted from the sprint plan and the roadmap (optionally worded by AI), edited by the team, submitted by an editor/admin and read by executives (read-only, submitted only) | Replaces the manual weekly newsletter |
| **Monthly deliverables** (in the weekly report) | The business's list of deliverables for the month per product, each with a percent complete and an importance; the month's progress is weighted; the change since last week is shown. Ad hoc requests added by the business during the month are listed separately with who asked. A new month can start from the unfinished items of the last one | Answers "how far along is what we committed this month, and what did we take on besides" |
| **Baselines** | Immutable checkpoints + "Plan vs now" diff and ghost bars on the Gantt | Accountability: what moved since we committed |
| **Log** | Every change with who/when; export; undo | Audit trail and safe experimentation |
| **Sharing** | Read-only public link per roadmap; Editor/Viewer access | Stakeholder transparency without accounts |
| **Presence** | See who is online; soft lock warning when two people edit one bar | Avoids overwriting each other |
| **Approvals** | Admin approval queue | Controlled access |

## 5. Key workflows
1. **Onboarding:** sign up → confirm email → "pending approval" screen → admin approves as Editor/Viewer → user enters.
2. **Planning a period:** create roadmap (range) → add features per squad → assign people → set dependencies → save baseline "Committed".
3. **Weekly review:** open Roadmap + Capacity → adjust → Baselines → compare "Plan vs now" → share link to leadership.
4. **Idea to plan:** capture on Ideas board → score → "Schedule" pushes it onto the roadmap as a feature.
5. **Monthly deliverables:** at the start of the month list what the business expects per product (or copy last month's unfinished), then each week update the percentages in that week's report, add ad hoc requests as they arrive with who asked, and submit.
6. **Sprint to executive report:** write the sprint plan (pull Jira tickets) → open the week's report → Sync / Generate with AI → edit → Submit; optionally export the sprint plan to Google Docs.

## 6. Business rules
- Approval is mandatory; unconfirmed emails never become admin.
- Viewers cannot mutate anything (enforced in UI *and* by database policies).
- A baseline never changes after creation (only its "active" flag) and only admins can delete it.
- Every mutation is logged; undo appends a new log entry instead of rewriting history.
- Weekend = Friday + Saturday (Saudi work week).
- Nov/Dec 2026 are flagged *low priority* on the seeded H2 roadmap.

## 7. Success measures (suggested)
Roadmap freshness (last edit < 7 days), % features with an owner, number of at-risk dependencies, stakeholder link views,
time to approve a new user.

## 8. Out of scope today / candidates
Per-bar allocation % in capacity, card layout for Resources on phones, list view instead of Gantt on small screens,
notifications for date changes, SSO, a presentation mode for sharing in meetings (a shared tab can only be scrolled from the tab itself), the Slack daily-standup feed into the weekly report (parked until Jira is live), undo for timeline notes, notes in read-only share links.

## Glossary
**Lane/squad** product team row · **Bar** a feature on the timeline · **Baseline** frozen plan snapshot ·
**Milestone** zero-length bar · **Soft lock** advisory warning, not a hard block · **RLS** Postgres Row Level Security.
