// Ynmo Flow phase 1: ticket rules (types, parents, keys, history, filters, My work).
import { TYPES, STATUSES, parentProblem, epicProblem, nextNo, makeIssue, applyChange, list, filterIssues, myWork, childrenOf, countByStatus, initials, epicProgress, summaryStats, setWorkflow, workflowProblem, canMove, targets, needsReason, startStatus, DEFAULT_WF, parseLabels, sortIssues, deletePlan, fixDuplicateKeys, isOverdue, statusOf, isClosed } from '../src/esm/features/flow-model.js';
let bad = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) bad++; };
ok('eight ticket types, seven default statuses in order', TYPES.length === 8 && STATUSES.map(s => s.id).join() === 'open,progress,rfqa,blocked,ready,deployed,done');
const I = {}; const add = (o) => { const i = makeIssue(o, I, o.me || 'Asmaa', '2026-11-08T10:00:00Z'); const id = 'id' + (i.n); I[id] = i; return id; };
const e1 = add({ type: 'epic', t: 'Payments' });
ok('first key is YNMO-1 and the next one counts on', I[e1].key === 'YNMO-1' && nextNo(I) === 2);
const s1 = add({ type: 'story', t: 'Pay by card', ep: e1, as: 'Mona' });
ok('a story can sit in an epic', I[s1].ep === e1 && I[s1].key === 'YNMO-2');
const st1 = add({ type: 'subtask', t: 'Form', par: s1, as: 'Mona' });
const sb1 = add({ type: 'subbug', t: 'Form crashes', par: s1, as: 'Omar', me: 'Mona' });
ok('sub-task and sub-bug go under a story', I[st1].par === s1 && I[sb1].par === s1);
const bug = add({ type: 'bug', t: 'Totals wrong', as: 'Mona', me: 'Omar' });
const thr = (f) => { try { f(); return ''; } catch (e) { return e.message; } };
ok('sub-task without a parent is refused', /needs a parent/.test(thr(() => makeIssue({ type: 'subtask', t: 'x' }, I, 'a'))));
ok('sub-bug under a bug is refused (stories only)', /only go under: Story/.test(thr(() => makeIssue({ type: 'subbug', t: 'x', par: bug }, I, 'a'))));
ok('sub-task under a sub-task is refused', /only go under/.test(thr(() => makeIssue({ type: 'subtask', t: 'x', par: st1 }, I, 'a'))));
ok('a story with a parent is refused', /cannot have a parent/.test(thr(() => makeIssue({ type: 'story', t: 'x', par: s1 }, I, 'a'))));
ok('epic under an epic and sub-task in an epic are refused', epicProblem('epic', I[e1]) !== '' && epicProblem('subtask', I[e1]) !== '' && epicProblem('story', I[s1]) !== '' && epicProblem('story', I[e1]) === '');
ok('empty title is refused', /title/.test(thr(() => makeIssue({ type: 'task', t: '  ' }, I, 'a'))));
ok('parentProblem is empty for valid combos', parentProblem('task', null) === '' && parentProblem('subtask', I[bug]) === '');
const ch = applyChange(I[s1], { st: 'progress', t: 'Pay by card', as: 'Mona' }, 'Mona', '2026-11-09T09:00:00Z');
ok('status change is recorded once, unchanged fields are not', ch.st === 'progress' && ch.hist.length === 2 && ch.hist[1].f === 'status' && ch.hist[1].a === 'Open' && ch.hist[1].b === 'In progress' && ch.up === '2026-11-09T09:00:00Z');
ok('no change returns the same ticket', applyChange(I[s1], { st: 'open', t: I[s1].t, pts: null }, 'x') === I[s1]);
I[s1] = ch;
const rows = list(I);
ok('list is newest number first', rows[0].n === 5 && rows.at(-1).n === 1);
ok('text filter needs every word, any case, also in the key', filterIssues(rows, { q: 'PAY card' }).length === 1 && filterIssues(rows, { q: 'ynmo-3' }).length === 1 && filterIssues(rows, { q: 'zzz' }).length === 0);
ok('status, type, assignee and unassigned filters', filterIssues(rows, { st: 'progress' }).length === 1 && filterIssues(rows, { type: 'subtask' }).length === 1 && filterIssues(rows, { as: 'Mona' }).length === 3 && filterIssues(rows, { as: '@none' }).length === 1);
ok('epic filter', filterIssues(rows, { ep: e1 }).length === 1);
I[st1] = applyChange(I[st1], { st: 'done' }, 'Mona'); const rows2 = list(I);
ok('open filter hides Done and Deployed', filterIssues(rows2, { open: true }).length === 4 && filterIssues(rows2, { open: false }).length === 5);
const w = myWork(rows2, 'Mona');
ok('My work: tickets, sub-tasks (closed hidden), bugs, reported', w.tickets.length === 1 && w.subtasks.length === 0 && w.bugs.length === 1 && w.reported.length === 1 && w.reported[0].key === 'YNMO-4');
ok('My work with all shows the closed sub-task', myWork(rows2, 'Mona', true).subtasks.length === 1);
ok('children of a story are its sub-tickets; of an epic its tickets', childrenOf(rows2, s1).length === 2 && childrenOf(rows2, e1).length === 1);
ok('counts per status', countByStatus(rows2).find(c => c.id === 'done').count === 1 && countByStatus(rows2).find(c => c.id === 'open').count === 3);
ok('initials', initials('Aya Fathy') === 'AF' && initials('Mona') === 'M' && initials('') === '?');
ok('epic progress counts closed tickets', epicProgress(rows2, e1).total === 1 && epicProgress(rows2, e1).pct === 0 && epicProgress(rows2, 'none').total === 0);
const sm = summaryStats(rows2);
ok('summary: totals, open (epics left out), blocked, people, newest activity first', sm.total === 5 && sm.open === 3 && sm.closed === 1 && sm.blocked === 0 && sm.people.length >= 1 && sm.recent.length === 7 && sm.recent[0].at >= sm.recent[6].at);
ok('summary: types listed with counts', sm.types.find(t => t.id === 'epic').count === 1 && !sm.types.find(t => t.id === 'hotfix'));

// ---- new in the Jira-expert round ----
ok('labels: trimmed, no repeats, spaces become dashes', JSON.stringify(parseLabels(' ui, Ui ,needs review;ui,')) === JSON.stringify(['ui', 'Ui', 'needs-review']));
const x1 = makeIssue({ type: 'bug', t: 'Crash', prod: 'tifli', card: 'TF#35', sev: 'critical', env: 'production', steps: '1. open', due: '2026-11-01', lb: 'a,b' }, {}, 'Me', '2026-11-08T10:00:00Z');
ok('a ticket carries product, card code, bug fields, due date and labels', x1.prod === 'tifli' && x1.card === 'TF#35' && x1.sev === 'critical' && x1.env === 'production' && x1.due === '2026-11-01' && x1.lb.length === 2 && x1.st === 'open');
ok('a bad due date is dropped', makeIssue({ type: 'task', t: 'x', due: 'tomorrow' }, {}, 'a').due === '');
ok('overdue: past due and not closed', isOverdue(x1, '2026-11-08') && !isOverdue(Object.assign({}, x1, { st: 'done' }), '2026-11-08') && !isOverdue(Object.assign({}, x1, { due: '' }), '2026-11-08'));
const ch2 = applyChange(x1, { due: '2026-11-20', prod: 'plan', lb: ['z'] }, 'Me', '2026-11-09T00:00:00Z');
ok('history names due date, product and labels', ch2.hist.map(h => h.f).join() === 'created,due date,product,labels');
// sorting and filters
const R = [{ id: 'a', n: 1, key: 'YNMO-1', type: 'task', t: 'beta', st: 'done', as: 'Zed', pr: 'low', up: '2' }, { id: 'b', n: 2, key: 'YNMO-2', type: 'bug', t: 'Alpha', st: 'open', as: '', pr: 'highest', up: '3', rp: 'Me', due: '2026-01-01' }, { id: 'c', n: 3, key: 'YNMO-3', type: 'story', t: 'gamma', st: 'progress', as: 'Amy', pr: 'medium', up: '1', prod: 'plan', lb: ['ui'] }];
ok('sort by title (case-insensitive), key desc, priority, assignee (unassigned last), status order', sortIssues(R, 't', 1).map(i => i.id).join('') === 'bac' && sortIssues(R, 'key', -1).map(i => i.id).join('') === 'cba' && sortIssues(R, 'pr', 1).map(i => i.id).join('') === 'bca' && sortIssues(R, 'as', 1).map(i => i.id).join('') === 'cab' && sortIssues(R, 'st', 1).map(i => i.id).join('') === 'bca');
ok('filters: product, reporter, overdue, label text', filterIssues(R, { prod: 'plan' }).length === 1 && filterIssues(R, { rp: 'Me' }).length === 1 && filterIssues(R, { od: true, today: '2026-11-08' }).length === 1 && filterIssues(R, { q: 'ui' }).length === 1);
// delete plan
const D = [{ id: 'e', type: 'epic' }, { id: 's', type: 'story', ep: 'e' }, { id: 'k', type: 'subtask', par: 's' }, { id: 'k2', type: 'subbug', par: 's' }];
ok('deleting a story takes its sub-tickets, deleting an epic only unlinks its tickets', JSON.stringify(deletePlan(D, 's')) === JSON.stringify({ del: ['s', 'k', 'k2'], unlink: [] }) && JSON.stringify(deletePlan(D, 'e')) === JSON.stringify({ del: ['e'], unlink: ['s'] }) && deletePlan(D, 'zz').del.length === 0);
// duplicate keys
const K = [{ id: 'a1', key: 'YNMO-7', n: 7, rp: 'Amy', cr: '2026-11-08T10:00:00Z' }, { id: 'b1', key: 'YNMO-7', n: 7, rp: 'Bo', cr: '2026-11-08T10:00:01Z' }, { id: 'c1', key: 'YNMO-8', n: 8, rp: 'Bo', cr: '2026-11-08T09:00:00Z' }];
ok('key clash: the later ticket gets the next number, only on its own reporter\'s browser', fixDuplicateKeys(K, 'Bo').length === 1 && fixDuplicateKeys(K, 'Bo')[0].id === 'b1' && fixDuplicateKeys(K, 'Bo')[0].key === 'YNMO-9' && fixDuplicateKeys(K, 'Amy').length === 0 && fixDuplicateKeys(K.slice(1), 'Bo').length === 0);
// workflow
ok('default workflow: any move allowed, no reasons', canMove('open', 'deployed') && !needsReason('blocked') && startStatus() === 'open');
const wf = { sts: [{ id: 'new', n: 'New', c: '#111111', cat: 'todo' }, { id: 'dev', n: 'Dev', c: '#222222', cat: 'progress' }, { id: 'blk', n: 'Blocked', c: '#333333', cat: 'progress' }, { id: 'fin', n: 'Finished', c: '#444444', cat: 'done' }], tr: { new: ['dev'], dev: ['blk', 'fin'], blk: ['dev'], fin: [] }, reason: ['blk'] };
setWorkflow(wf);
ok('custom workflow: statuses replaced in place, start status, closed by category', STATUSES.length === 4 && startStatus() === 'new' && isClosed({ st: 'fin' }) && !isClosed({ st: 'dev' }) && statusOf('zzz').n === 'zzz');
ok('allowed moves are enforced, staying put is fine, reasons asked', canMove('new', 'dev') && !canMove('new', 'fin') && canMove('dev', 'dev') && targets('new').map(s => s.id).join() === 'new,dev' && needsReason('blk') && !needsReason('dev'));
const mv = applyChange({ st: 'dev', hist: [], up: '' }, { st: 'blk' }, 'Me', '2026-11-08T10:00:00Z', 'waiting for API');
ok('a reason is kept in the history and on the ticket', mv.bl === 'waiting for API' && mv.hist[0].w === 'waiting for API' && mv.hist[0].b === 'Blocked');
ok('workflow checks: needs a To do and a Done status, unique names', workflowProblem({ sts: [{ id: 'a', n: 'A', cat: 'progress' }] }) !== '' && workflowProblem({ sts: [{ id: 'a', n: 'A', cat: 'todo' }, { id: 'b', n: 'a', cat: 'done' }] }) !== '' && workflowProblem(wf) === '' && workflowProblem(null) !== '');
setWorkflow({ sts: [] });
ok('a broken setting falls back to the default', STATUSES.length === 7 && canMove('open', 'done'));
setWorkflow(null);
process.exit(bad ? 1 : 0);
