/**
 * @module features/flow-perf
 * Ynmo Flow, team performance: pure numbers computed from the tickets (no screen code). Everything comes from ticket fields and history,
 * nothing is stored. Closed = a status of category "done". Epics are not counted (they are containers, not work).
 */
import { isClosed, isOverdue, statusOf, STATUSES } from './flow-model.js';

const DAY = 86400000;
const dayOf = iso => String(iso || '').slice(0, 10);
const ms = iso => new Date(iso || 0).getTime();
const doneNames = () => new Set(STATUSES.filter(s => s.cat === 'done').map(s => s.n));

/** When a closed ticket was closed: the last status change into a finished status; its last update when the history has none; '' when open. */
export function closedAt(i) {
  if (!isClosed(i)) return '';
  const nm = statusOf(i.st).n; let at = '';
  (i.hist || []).forEach(h => { if (h.f === 'status' && h.b === nm) at = h.at; });
  return at || i.up || i.cr || '';
}
/** Times a finished ticket was moved back to unfinished work. */
export function reopenCount(i) {
  const d = doneNames(); return (i.hist || []).filter(h => h.f === 'status' && d.has(h.a) && !d.has(h.b)).length;
}
/** Days between creation and closing (one decimal), or null. */
export function cycleDays(i) {
  const c = closedAt(i); if (!c || !i.cr) return null;
  return Math.max(0, Math.round((ms(c) - ms(i.cr)) / DAY * 10) / 10);
}
/** Closed on or before its due date (null when it has no due date or is not closed). */
export function onTime(i) { const c = closedAt(i); return c && i.due ? dayOf(c) <= i.due : null; }
const avg = a => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null);
const pct = (a, b) => (b ? Math.round(a * 100 / b) : null);
const addDays = (day, n) => new Date(new Date(day + 'T00:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10);

/**
 * Performance numbers.
 * opts = {days: 7|30|90|0 (0 = all time), day: 'YYYY-MM-DD' (today), prod: '' | product key, type: '' | ticket type}
 * Returns {from, team:{created, closed, open, overdue, blocked, avgCycle, onTimePct, reopened}, people:[...], weeks:[{from, created, closed}], products:[{k, closed}], bugs:{opened, fixed}}
 * people rows: {n, closed, open, overdue, blocked, points, avgCycle, onTimePct, reopened, bugsFixed}, sorted by closed then name.
 */
export function perfStats(rows, opts) {
  const o = opts || {}, day = o.day || new Date().toISOString().slice(0, 10), from = o.days ? addDays(day, -o.days + 1) : '';
  const base = rows.filter(i => i.type !== 'epic' && (!o.prod || i.prod === o.prod) && (!o.type || i.type === o.type));
  const inPeriod = iso => !!iso && (!from || dayOf(iso) >= from) && dayOf(iso) <= day;
  const closed = base.filter(i => inPeriod(closedAt(i)));
  const created = base.filter(i => inPeriod(i.cr));
  const open = base.filter(i => !isClosed(i));
  const sum = (set) => {
    const cyc = set.map(cycleDays).filter(x => x != null), ot = set.map(onTime).filter(x => x != null);
    return { avgCycle: avg(cyc), onTimePct: pct(ot.filter(Boolean).length, ot.length), reopened: set.reduce((n, i) => n + reopenCount(i), 0) };
  };
  const team = Object.assign({ created: created.length, closed: closed.length, open: open.length, overdue: open.filter(i => isOverdue(i, day)).length, blocked: open.filter(i => i.st === 'blocked').length }, sum(closed));
  const names = [...new Set(base.map(i => i.as).filter(Boolean))];
  const people = names.map(n => {
    const c = closed.filter(i => i.as === n), op = open.filter(i => i.as === n);
    return Object.assign({ n: n, closed: c.length, open: op.length, overdue: op.filter(i => isOverdue(i, day)).length, blocked: op.filter(i => i.st === 'blocked').length, points: c.reduce((s, i) => s + (Number(i.pts) || 0), 0), bugsFixed: c.filter(i => i.type === 'bug' || i.type === 'subbug' || i.type === 'hotfix').length }, sum(c));
  }).sort((a, b) => b.closed - a.closed || a.n.localeCompare(b.n));
  const weeks = [];
  for (let w = 7; w >= 0; w--) {
    const end = addDays(day, -w * 7), start = addDays(end, -6);
    weeks.push({ from: start, created: base.filter(i => dayOf(i.cr) >= start && dayOf(i.cr) <= end).length, closed: base.filter(i => { const c = dayOf(closedAt(i)); return c && c >= start && c <= end; }).length });
  }
  const pk = [...new Set(closed.map(i => i.prod || ''))];
  const products = pk.map(k => ({ k: k, closed: closed.filter(i => (i.prod || '') === k).length })).sort((a, b) => b.closed - a.closed);
  const isBug = i => i.type === 'bug' || i.type === 'subbug' || i.type === 'hotfix';
  return { from: from, team: team, people: people, weeks: weeks, products: products, bugs: { opened: created.filter(isBug).length, fixed: closed.filter(isBug).length, open: open.filter(isBug).length } };
}
