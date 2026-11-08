/**
 * @module features/flow-model
 * Ynmo Flow, tickets: pure rules with no screen code (types, statuses, parent rules, keys, filters, My work, history).
 * A ticket is `{key, n, type, t, d, st, pr, as, rp, par, ep, pts, lb, cr, up, hist}`:
 * key "YNMO-12", n 12, type id, title, description, status, priority, assignee name, reporter name, parent id (sub-task / sub-bug), epic id, points, labels, created/updated ISO, history [{at,by,f,a,b}].
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
export const STATUSES = [
  { id: 'open', n: 'Open', c: '#8b93a7' },
  { id: 'progress', n: 'In progress', c: '#3b6fd4' },
  { id: 'rfqa', n: 'RFQA', c: '#8a5cc7' },
  { id: 'blocked', n: 'Blocked', c: '#d64545' },
  { id: 'ready', n: 'Ready for deployment', c: '#e0a02b' },
  { id: 'deployed', n: 'Deployed', c: '#2a9d6f' },
  { id: 'done', n: 'Done', c: '#1f7a55' }
];
export const PRIORITIES = [{ id: 'highest', n: 'Highest' }, { id: 'high', n: 'High' }, { id: 'medium', n: 'Medium' }, { id: 'low', n: 'Low' }];
export const CLOSED = ['deployed', 'done'];
export const typeOf = id => TYPES.find(t => t.id === id) || TYPES[1];
export const statusOf = id => STATUSES.find(s => s.id === id) || STATUSES[0];
export const isClosed = i => CLOSED.includes(i.st);

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

/** Build a new ticket; throws Error(reason) when the title is empty or the parent/epic rules fail. */
export function makeIssue(o, issues, me, now) {
  const title = String(o.t || '').trim(); if (!title) throw new Error('Give the ticket a title.');
  const par = o.par ? issues[o.par] : null, ep = o.ep ? issues[o.ep] : null;
  let p = parentProblem(o.type, par); if (p) throw new Error(p);
  p = epicProblem(o.type, ep); if (p) throw new Error(p);
  const n = nextNo(issues), at = now || new Date().toISOString();
  const i = { key: keyOf(n, o.prefix), n: n, type: o.type, t: title, d: String(o.d || ''), st: 'open', pr: o.pr || 'medium', as: o.as || '', rp: me || '', par: o.par || '', ep: o.ep || '', pts: o.pts === '' || o.pts == null ? null : Number(o.pts), lb: o.lb || [], cr: at, up: at, hist: [{ at: at, by: me || '', f: 'created', a: '', b: keyOf(n, o.prefix) }] };
  return i;
}
const LABEL = { t: 'title', d: 'description', st: 'status', pr: 'priority', as: 'assignee', ep: 'epic', pts: 'points', lb: 'labels', type: 'type' };
/** Apply a change to a ticket: returns the new ticket (history extended, `up` set) or the same ticket when nothing changed. */
export function applyChange(i, ch, by, now) {
  const at = now || new Date().toISOString(), hist = (i.hist || []).slice(), out = Object.assign({}, i); let changed = false;
  Object.keys(ch).forEach(f => {
    const a = i[f], b = ch[f];
    if (JSON.stringify(a == null ? '' : a) === JSON.stringify(b == null ? '' : b)) return;
    changed = true; out[f] = b; hist.push({ at: at, by: by || '', f: LABEL[f] || f, a: f === 'st' ? statusOf(a).n : f === 'pr' ? String(a || '') : (Array.isArray(a) ? a.join(', ') : String(a == null ? '' : a)).slice(0, 80), b: f === 'st' ? statusOf(b).n : (Array.isArray(b) ? b.join(', ') : String(b == null ? '' : b)).slice(0, 80) });
  });
  if (!changed) return i;
  out.hist = hist; out.up = at; return out;
}
/** Tickets as a sorted array [{id, ...ticket}] (newest number first). */
export const list = issues => Object.keys(issues || {}).filter(k => issues[k] && issues[k].key).map(k => Object.assign({ id: k }, issues[k])).sort((a, b) => b.n - a.n);
/**
 * Filter tickets. f = {q, st, type, as, ep, open} ; `as` can be '' (all), '@none' (unassigned) or a name ; `open` hides closed ones.
 * The text matches key, title and description (every word, any case).
 */
export function filterIssues(rows, f) {
  const words = String((f && f.q) || '').toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(i => {
    if (f.st && i.st !== f.st) return false;
    if (f.type && i.type !== f.type) return false;
    if (f.as === '@none' ? i.as : f.as && i.as !== f.as) return false;
    if (f.ep && i.ep !== f.ep) return false;
    if (f.open && isClosed(i)) return false;
    if (words.length) { const hay = (i.key + ' ' + i.t + ' ' + (i.d || '')).toLowerCase(); if (!words.every(w => hay.includes(w))) return false; }
    return true;
  });
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
/** Counts per status for a set of tickets, in the status order. */
export const countByStatus = rows => STATUSES.map(s => ({ id: s.id, n: s.n, count: rows.filter(i => i.st === s.id).length }));

/** Two-letter initials of a name ("Aya Fathy" -> "AF"; "" -> "?"). */
export const initials = n => { const w = String(n || '').trim().split(/\s+/).filter(Boolean); return w.length ? (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() : '?'; };
/** Epic progress: how many of its tickets are closed. {total, done, pct}. */
export function epicProgress(rows, epicId) {
  const k = rows.filter(i => i.ep === epicId), done = k.filter(i => i.st === 'done' || i.st === 'deployed').length;
  return { total: k.length, done: done, pct: k.length ? Math.round(done * 100 / k.length) : 0 };
}
/** Numbers for the Summary page: totals, open, by status, by type, open work per person, latest changes. */
export function summaryStats(rows) {
  const open = rows.filter(i => !isClosed(i) && i.type !== 'epic');
  const byAs = {}; open.forEach(i => { const k = i.as || 'Unassigned'; byAs[k] = (byAs[k] || 0) + 1; });
  const recent = []; rows.forEach(i => (i.hist || []).forEach(h => recent.push({ at: h.at, by: h.by, key: i.key, id: i.id, f: h.f, a: h.a, b: h.b })));
  recent.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return {
    total: rows.length, open: open.length, progress: rows.filter(i => i.st === 'progress').length, blocked: rows.filter(i => i.st === 'blocked').length, closed: rows.filter(isClosed).length,
    status: countByStatus(rows), types: TYPES.map(t => ({ id: t.id, n: t.n, c: t.c, count: rows.filter(i => i.type === t.id).length })).filter(t => t.count),
    people: Object.keys(byAs).map(n => ({ n: n, count: byAs[n] })).sort((a, b) => b.count - a.count || a.n.localeCompare(b.n)),
    recent: recent.slice(0, 8)
  };
}
