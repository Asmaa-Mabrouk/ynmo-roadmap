/**
 * @module features/flow-inbox
 * Ynmo Flow, the PM's inbox ("what needs my reply"): pure rules that collect the tickets that need an answer or a decision from one person,
 * and the helpers that prepare a ticket for the AI (hide names, trim, rebuild the answer). No screen code.
 */
import { isClosed, isOverdue, needsReason, statusOf } from './flow-model.js';

/** Inbox kinds in priority order: id, short label, the question to answer. */
export const KINDS = [
  { id: 'blocked', n: 'Blocked', ask: 'Unblock it or answer what it is waiting for.', c: '#d64545' },
  { id: 'overdue', n: 'Overdue', ask: 'Ask for a new date or help it finish.', c: '#e0782b' },
  { id: 'confirm', n: 'Confirm', ask: 'Confirm it is what was asked for, or say what is missing.', c: '#2a9d6f' },
  { id: 'new', n: 'Not started', ask: 'Acknowledge it and say when it will start.', c: '#3b6fd4' },
  { id: 'stale', n: 'No news', ask: 'Ask for a short status.', c: '#8a5cc7' },
  { id: 'triage', n: 'Needs an owner', ask: 'Decide who takes it and the priority.', c: '#8b93a7' }
];
export const kindOf = id => KINDS.find(k => k.id === id) || KINDS[0];
const DAY = 86400000;
const age = (iso, now) => Math.max(0, Math.floor(((now || Date.now()) - new Date(iso || 0).getTime()) / DAY));

/**
 * The tickets that need `me`: [{id, key, t, kind, why, days}] sorted by kind priority then oldest first.
 * - blocked: blocked tickets assigned to me or that I reported (the reason is shown)
 * - overdue: assigned to me, past the due date
 * - confirm: I reported it, someone else moved it to QA, ready or a finished status in the last 7 days
 * - new: assigned to me, still in the first status, no change since it was created, 2+ days old
 * - stale: assigned to me, in progress, not updated for 7+ days
 * - triage: nobody owns it, someone else reported it, 2+ days old
 * A ticket appears once, under its most urgent kind. `now` (ms) and `day` (YYYY-MM-DD) can be passed for tests.
 */
export function inboxItems(rows, me, now, day) {
  const out = [], seen = new Set(), n = now || Date.now();
  const add = (i, kind, why) => { if (seen.has(i.id)) return; seen.add(i.id); out.push({ id: i.id, key: i.key, t: i.t, kind: kind, why: why, days: age(i.up, n) }); };
  rows.forEach(i => { if (i.st === 'blocked' && !isClosed(i) && (i.as === me || i.rp === me)) add(i, 'blocked', i.bl ? 'Reason: ' + i.bl : 'Blocked, no reason written'); });
  rows.forEach(i => { if (i.as === me && isOverdue(i, day)) add(i, 'overdue', 'Due ' + i.due); });
  rows.forEach(i => { const last = (i.hist || [])[i.hist ? i.hist.length - 1 : 0]; if (i.rp === me && (isClosed(i) || i.st === 'rfqa' || i.st === 'ready') && last && last.by && last.by !== me && age(last.at, n) <= 7) add(i, 'confirm', statusOf(i.st).n + ' by ' + last.by + ' ' + age(last.at, n) + ' d ago'); });
  rows.forEach(i => { if (i.as === me && !isClosed(i) && statusOf(i.st).cat === 'todo' && (i.hist || []).length <= 1 && age(i.cr, n) >= 2) add(i, 'new', 'Created ' + age(i.cr, n) + ' d ago, nothing done yet'); });
  rows.forEach(i => { if (i.as === me && statusOf(i.st).cat === 'progress' && age(i.up, n) >= 7) add(i, 'stale', 'No update for ' + age(i.up, n) + ' days'); });
  rows.forEach(i => { if (!i.as && !isClosed(i) && i.type !== 'epic' && i.rp !== me && age(i.cr, n) >= 2) add(i, 'triage', 'No assignee for ' + age(i.cr, n) + ' days'); });
  const rank = Object.fromEntries(KINDS.map((k, x) => [k.id, x]));
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || b.days - a.days);
}

/** Replace the given names with Person A, Person B... (longest names first) and give back the reverse function. */
export function makeMasker(names) {
  const list = [...new Set(names.filter(x => x && String(x).trim().length > 1))].sort((a, b) => b.length - a.length), map = {}, back = {};
  list.forEach((n, i) => { const p = 'Person ' + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : ''); map[n] = p; back[p] = n; });
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const to = s => list.reduce((t, n) => t.replace(new RegExp(esc(n), 'g'), map[n]), String(s == null ? '' : s));
  const from = s => Object.keys(back).sort((a, b) => b.length - a.length).reduce((t, p) => t.replace(new RegExp('\\b' + esc(p) + '\\b', 'g'), back[p]), String(s == null ? '' : s));
  return { mask: to, unmask: from, map: map };
}

/**
 * What is sent to the AI for one ticket. `mask` = a function that hides names (identity when masking is off).
 * Only the ticket's own text and facts: no ids, no other tickets, no account data.
 */
export function replyContext(i, item, mask) {
  const m = mask || (s => s);
  return {
    key: i.key, type: i.type, title: m(i.t), description: m(String(i.d || '').slice(0, 1500)), status: statusOf(i.st).n, priority: i.pr, assignee: m(i.as || ''), reporter: m(i.rp || ''), due: i.due || '',
    product: i.prod || '', labels: i.lb || [], blockedReason: m(i.bl || ''), why: m(item ? item.why : ''), ask: item ? kindOf(item.kind).ask : '',
    history: (i.hist || []).slice(-6).map(h => m(h.f === 'created' ? h.by + ' created it' : h.by + ' changed ' + h.f + (h.a || h.b ? ' from ' + (h.a || 'empty') + ' to ' + (h.b || 'empty') : '') + (h.w ? ' (' + h.w + ')' : '')))
  };
}
/** Items sent for the digest (titles only, names hidden). */
export const digestItems = (items, mask) => items.slice(0, 60).map(x => ({ key: x.key, kind: kindOf(x.kind).n, title: (mask || (s => s))(x.t), why: (mask || (s => s))(x.why) }));
