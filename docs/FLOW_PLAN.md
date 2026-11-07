# Ynmo Flow — task management to replace Jira (plan)

Status: **planning (phase 0).** The menu icon and an empty module page exist; nothing else is built. Written 2026-11-08.

## 1. Name

**Ynmo Flow** (menu label: *Flow*). It says what the product is for (tickets moving through a workflow you design), it fits the Ynmo family, and it is short in Arabic and English menus.
Alternatives if you prefer: *Ynmo Hive*, *Mahamm* (مهام, "tasks"). I cannot check trademarks from here: before it appears outside the team, search the name once (trademark office and app stores). The name is one constant (`FLOW_NAME` in `pages/flow.js`) and one menu entry, so renaming costs minutes.

## 2. What Jira does — and what Flow does about it

MVP = needed to switch off Jira for the PM team. Later = after the cutover. Skip = Jira features we will not rebuild.

### Issues
| Jira capability | Flow | Decision |
|---|---|---|
| Issue types: Epic, Story, Task, Bug, Sub-task | Same, plus **Enhancement** and **Hotfix** (your "report enhancement / hotfix") and **Sub-bug** (a bug below a story) | MVP |
| Hierarchy: Epic → Story/Task/Bug → Sub-task / Sub-bug | Same; a sub-task needs a parent; a sub-bug only sits under a story | MVP |
| Issue key (YNMO-123), numbering per project | Same. Import keeps existing keys (your tickets are YNMO-2xxxx) and continues the counter | MVP |
| Fields: summary, description (rich text), assignee, reporter, priority, labels, components, fix version, due date, estimate (story points), environment | Summary, description, assignee, reporter, priority, labels, due date, **points** (ties to your 1 point = 4 h model), epic. Components and fix versions later | MVP / Later |
| Custom fields and screens | Not at first; a small set of extra fields per issue type later | Later |
| Issue links (blocks, relates, duplicates, clones) | blocks / is blocked by, relates, duplicates | MVP (blocks, relates) |
| Watchers, voting | Watchers only (people who want notifications) | MVP |
| Clone, move, convert type, bulk change | Convert type and bulk change of status / assignee / sprint | Later |
| Issue history (audit of every change) | Full history per issue | MVP |
| Time tracking, worklogs | Points only; worklogs later if you need hours | Later |
| Rank (drag to order the backlog) | Drag to order | MVP |

### Workflow
| Jira capability | Flow | Decision |
|---|---|---|
| Statuses and categories (To do / In progress / Done) | Your own statuses, each with a category: **Open, In progress, RFQA (ready for QA), Blocked, Ready for deployment, Deployed, Done**, and any you add | MVP |
| Transitions (which status can go to which) | A visual designer: boxes and arrows; one workflow per issue type (or shared) | MVP |
| Conditions (who may move it), validators (must have an assignee / a comment), post-functions (set field, notify) | Who may transition (by role) and "required fields on entering a status" (for example a reason when moving to Blocked). Post-functions: notify assignee / reporter | MVP (roles, required fields) |
| Resolutions (Done, Won't do, Duplicate) | A resolution when moving to a Done-category status | MVP |
| Workflow schemes per project | One scheme per project | MVP |

### Boards, backlog, sprints
| Jira capability | Flow | Decision |
|---|---|---|
| Backlog | Ordered list, epics panel, drag into a sprint | MVP |
| Scrum board with sprints | Columns = statuses grouped as you choose, swimlanes by assignee or epic | MVP |
| Create, start, complete a sprint; unfinished issues move to the next sprint or the backlog | Same | MVP |
| Kanban board, WIP limits | Kanban view of the same data; WIP limits later | Later |
| Velocity, burndown, sprint report, cumulative flow | Burndown and sprint report first, velocity next | MVP (sprint report) / Later |
| Epics, versions / releases, roadmap | Epics with progress; releases later | MVP (epics) |
| Link with **your Sprints page and Monthly cards** | A sprint line can point to a Flow issue (like Jira keys today); a Monthly card can list its epic / stories and take its percentage from them | MVP (link), Later (automatic) |

### Search and "my work"
| Jira capability | Flow | Decision |
|---|---|---|
| JQL and saved filters | A simple filter bar (assignee, reporter, status, type, sprint, epic, label, text) that can be saved by name. No query language | MVP |
| "Assigned to me", "reported by me", recent | One-click chips and a **My work** page: assigned tickets, sub-tasks, bugs reported by me | MVP |
| Dashboards and gadgets | A few fixed reports (workload, closure time, reported per person) and the AI assistant | MVP / Later |

### Collaboration
| Jira capability | Flow | Decision |
|---|---|---|
| Comments, edit, delete | Same, rich text | MVP |
| @mention → notification | Same: typing @ lists people; the mentioned person gets a notification | MVP |
| Assignment notification | Inside the system (bell with a count, list, mark read); email later | MVP (in system) / Later (email) |
| Attachments (images, PDF, video) | Upload, preview image / PDF, play video — see section 5 | MVP (images, PDF), Later (video) |
| Notification schemes, email digests, Slack / Teams | In-system bell first; email and Slack later | Later |

### Administration
| Jira capability | Flow | Decision |
|---|---|---|
| Projects, project roles, permission schemes | Projects; roles use your existing permission levels (a new **Flow** module: view, edit, delete) plus project roles (member, lead) | MVP |
| Automation rules (when X, do Y) | Two built-ins first: "child done → ask to close parent", "assigned → notify". A rule builder later | Later |
| Import / export (CSV, Jira) | **Import from Jira** (API, read-only) for cutover; CSV export | MVP (import) |
| REST API, webhooks, apps marketplace, dev panel (branches / PRs) | Not needed | Skip (GitHub link later) |
| Service desk, SLAs, Confluence, Advanced Roadmaps, Insight | Not needed | Skip |

## 3. Design principles

- **One tool, one data set.** Flow is a module of this app (same sign-in, same people and permissions, same look), not a separate site.
- **Simple by default.** A ticket is created with a summary and a type; everything else is optional. Statuses and transitions are edited in one screen.
- **Your words.** Statuses, resolutions and issue types are data you edit, not code.
- **Nothing changes in live data without you.** Imports show a preview first; database scripts are run by you in Supabase; tests only use the fake database.

## 4. Data model (Supabase)

> **Decision 2026-11-08:** phase 1 stores tickets in the app's generic `{id, data}` tables (`flow_issues`, `flow_cfg`; see `supabase/sql/09-flow.sql` and DATABASE.md) and filters in the browser, which ships in one step with the same realtime, permissions and save queue. Phase 1 is built; relational tables and views below stay the target if volume (thousands of tickets) or reporting (phase 5) needs them.

The tool's current tables are generic `{id, data jsonb}` documents. Tickets need real filtering, counting, ordering and history, so Flow gets proper tables (all with row level security; one SQL file, `supabase/sql/09-flow.sql`, that you run once):

- `flow_projects` (key, name, lead, workflow scheme, next number)
- `flow_issue_types` (name, icon, level: epic / standard / subtask, can-parent rules)
- `flow_workflows`, `flow_statuses` (name, category, colour, order), `flow_transitions` (from, to, name, allowed roles, required fields)
- `flow_issues` (project, number, type, parent, epic, summary, description, status, resolution, assignee, reporter, priority, points, labels, due, sprint, rank, created / updated / resolved timestamps)
- `flow_sprints` (project, name, goal, start, end, state), `flow_links`, `flow_watchers`
- `flow_comments` (issue, author, body, mentions), `flow_attachments` (issue, path, name, size, type)
- `flow_history` (issue, field, from, to, by, at) — also feeds "closure time"
- `flow_notifications` (recipient, kind, issue, from, read)
- `flow_saved_filters`, `flow_ai_log` (who asked what, tokens used)

Closure time = resolved − created (and time in each status from `flow_history`). Numbers for the assistant come from these tables only.

## 5. Attachments: where to host (cost and quality)

Prices below are from the providers' pages on 2026-11-08; check them before you commit.

| Option | Storage | Download (egress) | Notes |
|---|---|---|---|
| **Supabase Storage** (already your platform) | Free: 1 GB, 50 MB per file. Pro (from $25 / month): 100 GB, then $0.0213 per GB | Free: 5 GB. Pro: 250 GB, then $0.09 per GB | Same sign-in and permissions as the rest; private files with signed links. You already need Pro for backups |
| **Cloudflare R2** | $0.015 per GB-month; 10 GB free | **No egress fee** | Cheapest for video that many people open. Needs a small upload / download function and a Cloudflare account |
| Video platform (Cloudflare Stream, Mux) | per minute stored and watched | included | Adaptive streaming; only worth it for long videos watched by many |

**Recommendation.** Phase 1: Supabase Storage (private bucket, signed links, 25 MB limit, images compressed in the browser before upload; PDF and images only). Bug videos are short screen recordings: allow them in phase 4 with a 100 MB limit on the same storage once you are on Pro. If storage or downloads grow past the Pro allowance, move only the video bucket to R2 (the upload code is written against one small interface, so the switch does not touch the screens). A dedicated video platform is not needed for screen recordings.

## 6. AI assistant

A chat panel inside Flow ("Ask Flow"): "what is Mona working on?", "average closure time per person last sprint", "how many bugs did each QA report this month", answered in text with **charts** and a table, and links to the tickets.

- **Key safety.** Your API key is stored as a **secret of a Supabase Edge Function** (`flow-ai`), never in the repo, the page or the chat. You add it yourself in Supabase; I never ask for it.
- **How it answers.** The model does not read the database freely. The function offers it a fixed set of read-only tools (my open tickets, tickets by assignee, closure time by person or sprint, reported tickets by person, sprint summary, workload against capacity) that run under the signed-in person's rights, so row level security still applies. The model chooses the tool and the filters, the function runs the query and returns rows plus a chart definition, and the page draws the chart with the same chart code as the Dashboard.
- **Who may ask what.** Everyone can ask about their own work; team-wide and per-person numbers need the Flow *view* level or higher.
- **Cost and privacy controls.** Per-person daily message limit, a log of questions and token use, and an option to replace names with codes before text leaves for the model (you have not decided this yet; see open decisions). Model choice (Claude or Gemini) is a setting in the function.

## 7. How it plugs into what you already have

- **Sprints page:** a sprint line can link to a Flow issue instead of a Jira key (the multi-ticket dialog gets a second tab). Sprint status follows the issue.
- **Monthly cards:** a card can be linked to an epic; its percentage can be proposed from the epic's stories, in the same Review dialog as the sprint updates.
- **Weekly report:** done and in-progress issues of the week feed the report the way sprint lines do now.
- **People and permissions:** same members, same Users page; Flow is one more module with levels none / view / edit / delete.
- **Jira import:** for cutover, one-way, by key, with a preview; Jira stays untouched until you switch it off.

## 8. Build order

Each phase ends with working screens, tests and docs, and can be used on its own.

| Phase | What you get | Size |
|---|---|---|
| 0 (done) | Name, menu icon, empty page, this plan, Flow permission module | S |
| 1 Core | Projects, issue types, create / edit issue, key numbering, list with filters and saved filters, **My work**, issue page with history | L |
| 2 Workflow designer | Statuses, transitions, roles, required fields, resolutions; moving a ticket follows the rules | M |
| 3 Backlog and sprints | Backlog with drag order, epics panel, create / start / complete sprint, board with swimlanes, sprint report | L |
| 4 Collaboration | Comments, @mentions, watchers, notification bell, images and PDF, then video | M |
| 5 AI assistant | Edge Function, tools, chat panel, charts, limits | M |
| 6 Jira import and cutover | Preview and import, key continuity, links from Sprints / Monthly / Reports, the switch-over checklist | M |

Rough guide: phases 1 and 3 are each several working days of build and test; the others are shorter. A parallel run (Jira and Flow side by side for one sprint) before the cutover is strongly recommended.

## 9. Risks

- **Scope.** Jira is a huge product; the table in section 2 is the contract. Anything marked Later waits until the team has lived in Flow for a sprint.
- **Single-file app size.** The app ships as one HTML file (about 760 KB). Flow adds a lot of code; if loading slows, Flow is split into its own lazily loaded file (the build supports adding one).
- **History and trust.** Years of Jira history do not come across fully (comments and attachments in phase 6 at best). Decide what must be kept; the rest stays readable in Jira in read-only mode.
- **Data safety.** Tickets are the team's daily record: the Pro plan with backups is a precondition before the cutover.

## 10. Decisions needed from you

1. The name: Ynmo Flow, or one of the alternatives?
2. Project key for imported tickets: keep **YNMO** (continuing from your highest number)?
3. Which Jira projects and how much history to import (open tickets only, or the last N months)?
4. AI: Claude or Gemini, and should people's names be replaced with codes before a question leaves for the model?
5. Hosting: confirm Supabase Pro (for backups and storage), with R2 held back for video?
6. Who tests first (suggestion: PM squad for one sprint, in parallel with Jira)?
