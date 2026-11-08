/**
 * @module features/flow-model
 * Ynmo Flow, tickets: pure rules with no screen code (types, workflow, parent rules, keys, filters, sorting, My work, history).
 * A ticket is `{key, n, type, t, d, st, pr, as, rp, par, ep, pts, lb, due, prod, card, sev, env, steps, rn, req, bl, cr, up, hist}`:
 * key "YNMO-12", n 12, type id, title, description, status id, priority, assignee name, reporter name, parent id (sub-task / sub-bug), epic id, points, labels[],
 * due date ISO, product (Monthly tag key), Monthly card code ("TF#35"), bug severity / environment / steps, report name / requester (report tickets),
 * reason of the last Blocked move, created/updated ISO, history [{at,by,f,a,b,w?}].
 * The workflow (statuses, allowed moves, reasons) is a setting (`flow_cfg/main`); `setWorkflow` loads it. The default is the seven statuses with any move allowed.
 */
export const PREFIX = 'YNMO';
/** Ticket types in the order of the create menu. `parents` = which types a sub-ticket may sit under; `sub` = needs a parent. */
export const TYPES = [
  { id: 'story', n: 'Story', c: '#2a9d6f' },
  { id: 'task', n: 'Task', c: '#3b6fd4' },
  { id: 'bug', n: 'Bug', c: '#d64545' },
  { id: 'enhancement', n: 'Report enhancement', c: '#8a5cc7' },
  { id: 'hotfix', n: 'Report hotfix', c: '#e0782b' },
  { id: 'epic', n: 'Epic', c: '#6d48a8' },
  { id: 'subtask', n: 'Sub-task', c: '#5f8fe0', sub: true, parents: ['story', 'task', 'bug', 'enhancement', 'hotfix'] },
  { id: 'subbug', n: 'Sub-bug', c: '#e06a6a', sub: true, parents: ['story'] }
];
/** Status categories: todo (not started), progress, done (finished: counts as closed). */
export const CATS = [{ id: 'todo', n: 'To do' }, { id: 'progress', n: 'In progress' }, { id: 'done', n: 'Done' }];
export const DEFAULT_WF = {
  sts: [
    { id: 'open', n: 'Open', c: '#8b93a7', cat: 'todo' }, { id: 'progress', n: 'In progress', c: '#3b6fd4', cat: 'progress' }, { id: 'rfqa', n: 'RFQA', c: '#8a5cc7', cat: 'progress' },
    { id: 'blocked', n: 'Blocked', c: '#d64545', cat: 'progress' }, { id: 'ready', n: 'Ready for deployment', c: '#e0a02b', cat: 'progress' }, { id: 'deployed', n: 'Deployed', c: '#2a9d6f', cat: 'done' }, { id: 'done', n: 'Done', c: '#1f7a55', cat: 'done' }
  ],
  tr: null, reason: []
};
/** The statuses in use. This array is changed in place by setWorkflow, so importers always see the current list. */
export const STATUSES = DEFAULT_WF.sts.map(s => Object.assign({}, s));
let WF = { tr: null, reason: [] };
export const PRIORITIES = [{ id: 'highest', n: 'Highest' }, { id: 'high', n: 'High' }, { id: 'medium', n: 'Medium' }, { id: 'low', n: 'Low' }];
export const SEVERITIES = [{ id: '', n: 'Not set' }, { id: 'critical', n: 'Critical' }, { id: 'major', n: 'Major' }, { id: 'minor', n: 'Minor' }];
export const ENVS = [{ id: '', n: 'Not set' }, { id: 'production', n: 'Production' }, { id: 'staging', n: 'Staging' }, { id: 'dev', n: 'Development' }];
export const typeOf = id => TYPES.find(t => t.id === id) || TYPES[1];
export const statusOf = id => STATUSES.find(s => s.id === id) || { id: id, n: String(id || '?'), c: '#8b93a7', cat: 'todo' };
export const isClosed = i => statusOf(i.st).cat === 'done';
export const isReport = type => type === 'enhancement' || type === 'hotfix';

/* ---------- workflow ---------- */
/** Problem with a workflow setting ('' when fine): at least one status of each category, unique names, moves only between known statuses. */
export function workflowProblem(cfg) {
  const s = cfg && cfg.sts; if (!Array.isArray(s) || !s.length) return 'Add at least one status.';
  if (s.some(x => !String(x.n || '').trim())) return 'Every status needs a name.';
  if (new Set(s.map(x => x.n.trim().toLowerCase())).size !== s.length) return 'Two statuses have the same name.';
  if (new Set(s.map(x => x.id)).size !== s.length) return 'Two statuses have the same id.';
  if (!s.some(x => x.cat === 'todo')) return 'One status must be in the To do category (new tickets start there).';
  if (!s.some(x => x.cat === 'done')) return 'One status must be in the Done category.';
  return '';
}
/** Load the workflow from the saved setting (null or invalid = default). Returns the effective setting. */
export function setWorkflow(cfg) {
  const ok = cfg && !workflowProblem(cfg), src = ok ? cfg : DEFAULT_WF;
  STATUSES.length = 0; src.sts.forEach(s => STATUSES.push({ id: s.id, n: s.n, c: s.c || '#8b93a7', cat: s.cat }));
  const ids = new Set(STATUSES.map(s => s.id));
  WF = { tr: ok && src.tr ? Object.fromEntries(Object.keys(src.tr).map(k => [k, (src.tr[k] || []).filter(x => ids.has(x))])) : null, reason: ok ? (src.reason || []).filter(x => ids.has(x)) : [] };
  return { sts: STATUSES.map(s => Object.assign({}, s)), tr: WF.tr, reason: WF.reason.slice() };
}
/** Status a new ticket starts in: the first status of the To do category. */
export const startStatus = () => (STATUSES.find(s => s.cat === 'todo') || STATUSES[0]).id;
/** May a ticket move from one status to another? (Staying put is always fine.) */
export const canMove = (from, to) => from === to || !WF.tr || (WF.tr[from] || []).includes(to);
/** Statuses a ticket in `from` may be moved to, in order (including `from`). */
export const targets = from => STATUSES.filter(s => canMove(from, s.id));
/** Does moving into this status need a reason? */
export const needsReason = to => WF.reason.includes(to);

/* ---------- creating and changing tickets ---------- */
/** May a ticket of type `type` be created under the ticket `parent` (an issue or null)? Returns '' when fine, else the reason. */
export function parentProblem(type, parent) {
  const t = typeOf(type);
  if (t.sub) { if (!parent) return t.n + ' needs a parent ticket.'; if (!t.parents.includes(parent.type)) return t.n + ' can only go under: ' + t.parents.map(p => typeOf(p).n).join(', ') + '.'; return ''; }
  if (parent) return t.n + ' cannot have a parent ticket.';
  return '';
}
/** May a ticket have this epic? Only non-sub, non-epic tickets, and the epic must be an epic. */
export function epicProblem(type, epic) {
  if (!epic) return '';
  if (type === 'epic' || typeOf(type).sub) return 'Epics hold stories, tasks, bugs and reports, not ' + typeOf(type).n.toLowerCase() + 's.';
  return epic.type === 'epic' ? '' : 'The epic must be an Epic ticket.';
}
/** Next number for a key: one more than the biggest number in use. */
export function nextNo(issues) { let m = 0; Object.values(issues || {}).forEach(i => { if (i && i.n > m) m = i.n; }); return m + 1; }
export const keyOf = (n, prefix) => (prefix || PREFIX) + '-' + n;
export const newId = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** "a, b ; c" -> ['a','b','c'] (labels: trimmed, no repeats, no spaces inside). */
export const parseLabels = s => [...new Set(String(s || '').split(/[,;\n]/).map(x => x.trim().replace(/\s+/g, '-')).filter(Boolean))].slice(0, 12);
const isoDay = s => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : '');

/** Build a new ticket; throws Error(reason) when the title is empty or the parent/epic rules fail. */
export function makeIssue(o, issues, me, now) {
  const title = String(o.t || '').trim(); if (!title) throw new Error('Give the ticket a title.');
  const par = o.par ? issues[o.par] : null, ep = o.ep ? issues[o.ep] : null;
  let p = parentProblem(o.type, par); if (p) throw new Error(p);
  p = epicProblem(o.type, ep); if (p) throw new Error(p);
  const n = nextNo(issues), at = now || new Date().toISOString(), key = keyOf(n, o.prefix);
  return {
    key: key, n: n, type: o.type, t: title, d: String(o.d || ''), st: o.st || startStatus(), pr: o.pr || 'medium', as: o.as || '', rp: me || '', par: o.par || '', ep: o.ep || '',
    pts: o.pts === '' || o.pts == null ? null : Number(o.pts), lb: Array.isArray(o.lb) ? o.lb : parseLabels(o.lb), due: isoDay(o.due), prod: o.prod || '', card: o.card || '',
    sev: o.sev || '', env: o.env || '', steps: String(o.steps || ''), rn: String(o.rn || ''), req: String(o.req || ''), bl: '', sp: o.sp || '', rk: n * 10,
    cr: at, up: at, hist: [{ at: at, by: me || '', f: 'created', a: '', b: key }]
  };
}
const LABEL = { t: 'title', d: 'description', st: 'status', pr: 'priority', as: 'assignee', ep: 'epic', pts: 'points', lb: 'labels', type: 'type', due: 'due date', prod: 'product', card: 'card', sev: 'severity', env: 'environment', steps: 'steps', rn: 'report', req: 'requester', sp: 'sprint' };
let spName = id => id;
/** The app tells the model how to show a sprint id in the history (its name). */
export const setSprintNamer = f => { spName = f || (id => id); };
const show = (f, v) => (f === 'st' ? statusOf(v).n : f === 'sp' ? (v ? spName(v) : 'Backlog') : Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v)).slice(0, 80);
/**
 * Apply a change to a ticket: returns the new ticket (history extended, `up` set) or the same ticket when nothing changed.
 * `why` = the reason given for a move into a status that needs one (kept in the history and as `bl`).
 */
export function applyChange(i, ch, by, now, why) {
  const at = now || new Date().toISOString(), hist = (i.hist || []).slice(), out = Object.assign({}, i); let changed = false;
  Object.keys(ch).forEach(f => {
    const a = i[f], b = ch[f];
    if (JSON.stringify(a == null ? '' : a) === JSON.stringify(b == null ? '' : b)) return;
    changed = true; out[f] = b;
    const h = { at: at, by: by || '', f: LABEL[f] || f, a: show(f, a), b: show(f, b) }; if (f === 'st' && why) { h.w = String(why).slice(0, 300); out.bl = h.w; }
    hist.push(h);
  });
  if (!changed) return i;
  out.hist = hist; out.up = at; return out;
}
/** Tickets as a sorted array [{id, ...ticket}] (newest number first). */
export const list = issues => Object.keys(issues || {}).filter(k => issues[k] && issues[k].key).map(k => Object.assign({ id: k }, issues[k])).sort((a, b) => b.n - a.n);
export const today = () => { const n = new Date(), z = v => (v < 10 ? '0' : '') + v; return n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate()); };
/** Past its due date and not closed. */
export const isOverdue = (i, day) => !!i.due && i.due < (day || today()) && !isClosed(i);
/**
 * Filter tickets. f = {q, st, type, as, ep, prod, rp, od, open}; `as` can be '' (all), '@none' (unassigned) or a name; `rp` a reporter name; `od` true = overdue only; `open` hides closed ones.
 * The text matches key, title, description and labels (every word, any case).
 */
export function filterIssues(rows, f) {
  const words = String((f && f.q) || '').toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(i => {
    if (f.st && i.st !== f.st) return false;
    if (f.type && i.type !== f.type) return false;
    if (f.as === '@none' ? i.as : f.as && i.as !== f.as) return false;
    if (f.ep && i.ep !== f.ep) return false;
    if (f.prod && i.prod !== f.prod) return false;
    if (f.sp === '@none' ? i.sp : f.sp && i.sp !== f.sp) return false;
    if (f.rp && i.rp !== f.rp) return false;
    if (f.od && !isOverdue(i, f.today)) return false;
    if (f.open && isClosed(i)) return false;
    if (words.length) { const hay = (i.key + ' ' + i.t + ' ' + (i.d || '') + ' ' + (i.lb || []).join(' ')).toLowerCase(); if (!words.every(w => hay.includes(w))) return false; }
    return true;
  });
}
const PR_RANK = { highest: 0, high: 1, medium: 2, low: 3 };
/** Sort by a column: key|type|t|st|as|pr|up ; dir 1 = ascending, -1 = descending. Returns a new array. */
export function sortIssues(rows, key, dir) {
  const d = dir === 1 ? 1 : -1;
  const val = { key: i => i.n, type: i => typeOf(i.type).n, t: i => String(i.t).toLowerCase(), st: i => STATUSES.findIndex(s => s.id === i.st), as: i => String(i.as || '~').toLowerCase(), pr: i => (PR_RANK[i.pr] == null ? 9 : PR_RANK[i.pr]), up: i => String(i.up || '') }[key] || (i => i.n);
  return rows.slice().sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * d || b.n - a.n; });
}
/** My work: what is assigned to me, split into main tickets, sub-tasks and bugs; plus what I reported that is still open. Closed tickets are left out unless `all`. */
export function myWork(rows, name, all) {
  const mine = rows.filter(i => i.as === name && (all || !isClosed(i)));
  return {
    tickets: mine.filter(i => !typeOf(i.type).sub && i.type !== 'bug' && i.type !== 'epic'),
    subtasks: mine.filter(i => typeOf(i.type).sub),
    bugs: mine.filter(i => i.type === 'bug'),
    epics: mine.filter(i => i.type === 'epic'),
    reported: rows.filter(i => i.rp === name && i.as !== name && (all || !isClosed(i)))
  };
}
/** Children of a ticket (its sub-tickets, or for an epic the tickets in it), oldest first. */
export const childrenOf = (rows, id) => rows.filter(i => i.par === id || i.ep === id).sort((a, b) => a.n - b.n);
/**
 * What deleting a ticket does: its sub-tickets go with it (like Jira); the tickets of an epic stay and only lose the epic.
 * Returns {del: [ids to delete, the ticket first], unlink: [ids that lose their epic]}.
 */
export function deletePlan(rows, id) {
  const t = rows.find(i => i.id === id); if (!t) return { del: [], unlink: [] };
  return { del: [id, ...rows.filter(i => i.par === id).map(i => i.id)], unlink: t.type === 'epic' ? rows.filter(i => i.ep === id).map(i => i.id) : [] };
}
/**
 * Key clashes (two people created a ticket at the same moment): for every key used twice, the later ticket(s) made by `me` get the next free number.
 * Returns [{id, key, n}] to write. Only tickets reported by `me` are changed, so two browsers never fight over the same ticket.
 */
export function fixDuplicateKeys(rows, me) {
  const by = {}; rows.forEach(i => { (by[i.key] = by[i.key] || []).push(i); });
  let next = rows.reduce((m, i) => Math.max(m, i.n || 0), 0) + 1; const out = [];
  Object.keys(by).forEach(k => {
    const g = by[k]; if (g.length < 2) return;
    g.sort((a, b) => String(a.cr).localeCompare(String(b.cr)) || a.id.localeCompare(b.id));
    g.slice(1).forEach(i => { if (i.rp === me) { out.push({ id: i.id, key: keyOf(next, i.key.replace(/-\d+$/, '')), n: next }); next++; } });
  });
  return out;
}
/** Counts per status for a set of tickets, in the status order. */
export const countByStatus = rows => STATUSES.map(s => ({ id: s.id, n: s.n, count: rows.filter(i => i.st === s.id).length }));
/** Two-letter initials of a name ("Aya Fathy" -> "AF"; "" -> "?"). */
export const initials = n => { const w = String(n || '').trim().split(/\s+/).filter(Boolean); return w.length ? (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() : '?'; };
/** Epic progress: how many of its tickets are closed. {total, done, pct}. */
export function epicProgress(rows, epicId) {
  const k = rows.filter(i => i.ep === epicId), done = k.filter(isClosed).length;
  return { total: k.length, done: done, pct: k.length ? Math.round(done * 100 / k.length) : 0 };
}
/** Numbers for the Summary page: totals, open, by status, type, product, open work per person, overdue, latest changes. */
export function summaryStats(rows, prods, day) {
  const open = rows.filter(i => !isClosed(i) && i.type !== 'epic');
  const byAs = {}; open.forEach(i => { const k = i.as || 'Unassigned'; byAs[k] = (byAs[k] || 0) + 1; });
  const recent = []; rows.forEach(i => (i.hist || []).forEach(h => recent.push({ at: h.at, by: h.by, key: i.key, id: i.id, f: h.f, a: h.a, b: h.b })));
  recent.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return {
    total: rows.length, open: open.length, progress: rows.filter(i => statusOf(i.st).cat === 'progress').length, blocked: rows.filter(i => i.st === 'blocked').length, closed: rows.filter(isClosed).length,
    status: countByStatus(rows), types: TYPES.map(t => ({ id: t.id, n: t.n, c: t.c, count: rows.filter(i => i.type === t.id).length })).filter(t => t.count),
    products: (prods || []).map(p => ({ id: p.k, n: p.n, c: p.c, count: open.filter(i => i.prod === p.k).length })).filter(p => p.count).concat((() => { const n = open.filter(i => !i.prod).length; return n ? [{ id: '', n: 'No product', c: '#8b93a7', count: n }] : []; })()),
    people: Object.keys(byAs).map(n => ({ n: n, count: byAs[n] })).sort((a, b) => b.count - a.count || a.n.localeCompare(b.n)),
    overdue: rows.filter(i => isOverdue(i, day)).sort((a, b) => a.due.localeCompare(b.due)),
    recent: recent.slice(0, 8)
  };
}
