/**
 * @module pages/flow
 * Ynmo Flow: the task management module that is meant to replace Jira (plan: docs/FLOW_PLAN.md).
 * Phase 0: the menu entry and this page only. It shows what is coming and where the plan is; it reads and writes no data.
 */
import { $, el } from '../core/model.js';
import { pageHead } from '../core/shared.js';

export const FLOW_NAME = 'Ynmo Flow';
/** What each phase will bring, in build order (the same list as the plan). */
export const FLOW_PHASES = [
  { n: 1, t: 'Issues', d: 'Projects, stories, tasks, bugs, sub-tasks, epics. Filters, saved filters and My work.' },
  { n: 2, t: 'Workflow', d: 'Your own statuses (Open, In progress, RFQA, Blocked, Ready for deployment, Deployed, Done) and who can move a ticket where.' },
  { n: 3, t: 'Backlog and sprints', d: 'Backlog, create and run a sprint, board, sprint report.' },
  { n: 4, t: 'Collaboration', d: 'Comments, @mentions, notifications, images, PDF and video.' },
  { n: 5, t: 'AI assistant', d: 'Ask about workload, closure time and reported tickets, with charts.' },
  { n: 6, t: 'Jira import', d: 'Bring the tickets across, keep the keys, switch Jira off.' }
];

export function renderFlow() {
  const pg = $('pg-flow'); pg.textContent = '';
  pg.append(pageHead(FLOW_NAME, 'Tasks and tickets for the team, built to replace Jira. Planning stage: nothing to use yet.'));
  const c = el('div', 'flowhero card'); c.id = 'flowhero';
  c.append(el('div', 'flowtag', 'Phase 0 · Planning'), el('h2', '', 'Coming step by step'), el('p', 'sub', 'The full plan, with every Jira capability and what Flow will do about it, is in docs/FLOW_PLAN.md in the repository.'));
  const ol = el('ol', 'flowphases'); FLOW_PHASES.forEach(p => { const li = el('li', ''); li.append(el('b', '', p.t), el('span', '', p.d)); ol.append(li); });
  c.append(ol); pg.append(c);
}
