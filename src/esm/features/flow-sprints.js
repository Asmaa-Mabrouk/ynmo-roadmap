/**
 * @module features/flow-sprints
 * Ynmo Flow phase 3: backlog order and sprints (pure rules, no screen code).
 * Sprints live in one document `flow_cfg/sprints` = {sp:[{id, n, goal, start, end, state, doneAt, rep}]}; a ticket points to its sprint with `sp` ('' = backlog)
 * and has a rank `rk` (smaller = higher). state: planned -> active -> done. Only one sprint can be active.
 */
import { isClosed } from './flow-model.js';

export const STATES = { planned: 'Planned', active: 'Active', done: 'Completed' };
const DAY = 86400000;
const dayOf = iso => String(iso || '').slice(0, 10);
const addDays = (day, n) => new Date(new Date(day + 'T00:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10);

export const sprintList = cfg => ((cfg && cfg.sp) || []).slice();
export const activeSprint = list => list.find(s => s.state === 'active') || null;
export const sprintById = (list, id) => list.find(s => s.id === id) || null;
export const nextSprintId = list => 's' + (list.reduce((m, s) => Math.max(m, Number(String(s.id).slice(1)) || 0), 0) + 1);
/** Suggest the next sprint: "Sprint N", two weeks after the last end (or from `day`). */
export function suggestSprint(list, day) {
  const nums = list.map(s => Number((/(\d+)\s*$/.exec(s.n) || [])[1]) || 0), last = list.map(s => s.end).filter(Boolean).sort().pop();
  const start = last && last >= day ? addDays(last, 1) : day;
  return { n: 'Sprint ' + (Math.max(0, ...nums) + 1), goal: '', start: start, end: addDays(start, 13) };
}
/** Text of the problem with a sprint, or ''. `self` = the sprint being edited (its name may repeat itself). */
export function sprintProblem(list, s, self) {
  if (!String(s.n || '').trim()) return 'Give the sprint a name.';
  if (list.some(x => x.id !== (self && self.id) && x.n.trim().toLowerCase() === s.n.trim().toLowerCase())) return 'A sprint with this name already exists.';
  if (!s.start || !s.end) return 'Choose the start and end dates.';
  if (s.end < s.start) return 'The end date is before the start date.';
  return '';
}
export const makeSprint = (list, o) => ({ id: nextSprintId(list), n: String(o.n).trim(), goal: String(o.goal || '').trim().slice(0, 300), start: o.start, end: o.end, state: 'planned' });
/** Why this sprint cannot start (another one is active, or it is not planned), or ''. */
export const startProblem = (list, s) => (s.state !== 'planned' ? 'Only a planned sprint can be started.' : activeSprint(list) ? 'Complete "' + activeSprint(list).n + '" first: only one sprint can be active.' : '');

/** Rank used for ordering (tickets made before ranks existed use their number). */
export const rkOf = i => (i.rk != null ? i.rk : i.n * 10);
export const byRank = rows => rows.slice().sort((a, b) => rkOf(a) - rkOf(b) || a.n - b.n);
/**
 * Move ticket `id` so it sits just before `beforeId` ('' = at the end) within `ordered` (the list as shown).
 * Returns [{id, rk}] changes: normally only the moved ticket; all of them when there is no gap left between neighbours.
 */
export function rankPatch(ordered, id, beforeId) {
  const rest = ordered.filter(i => i.id !== id), at = beforeId ? rest.findIndex(i => i.id === beforeId) : rest.length, pos = at < 0 ? rest.length : at;
  const prev = pos > 0 ? rkOf(rest[pos - 1]) : null, next = pos < rest.length ? rkOf(rest[pos]) : null;
  let rk;
  if (prev == null && next == null) rk = 10; else if (prev == null) rk = next - 10; else if (next == null) rk = prev + 10; else rk = Math.floor((prev + next) / 2);
  if ((prev != null && rk <= prev) || (next != null && rk >= next)) {
    const seq = rest.slice(0, pos).concat([{ id: id }], rest.slice(pos));
    return seq.map((x, k) => ({ id: x.id, rk: (k + 1) * 10 })).filter(x => x.id === id || rkOf(ordered.find(o => o.id === x.id)) !== x.rk);
  }
  return [{ id: id, rk: rk }];
}

/** Tickets of one sprint ('' = backlog): not epics; the backlog hides finished tickets. */
export const ticketsIn = (rows, spId) => byRank(rows.filter(i => i.type !== 'epic' && (i.sp || '') === (spId || '') && (spId || !isClosed(i))));
const measure = (i, unit) => (unit === 'points' ? Number(i.pts) || 0 : 1);
export const unitOf = tickets => (tickets.some(i => Number(i.pts) > 0) ? 'points' : 'tickets');
/** Numbers shown on a sprint header. */
export function sprintStats(rows, spId) {
  const t = ticketsIn(rows, spId), u = unitOf(t), done = t.filter(isClosed);
  return { count: t.length, done: done.length, points: t.reduce((s, i) => s + (Number(i.pts) || 0), 0), pointsDone: done.reduce((s, i) => s + (Number(i.pts) || 0), 0), unit: u };
}
/**
 * Burndown of a sprint: [{d, remaining, ideal}] from its start to its end (or today if still running), measured in points when tickets have points, else in tickets.
 * `closedAtFn` gives the closing date of a ticket (features/flow-perf closedAt).
 */
export function burndown(sprint, tickets, day, closedAtFn) {
  const u = unitOf(tickets), total = tickets.reduce((s, i) => s + measure(i, u), 0), out = [];
  const span = Math.max(1, Math.round((new Date(sprint.end) - new Date(sprint.start)) / DAY)), last = sprint.state === 'done' ? sprint.end : (day < sprint.end ? day : sprint.end);
  for (let k = 0, d = sprint.start; d <= sprint.end && k < 400; k++, d = addDays(sprint.start, k)) {
    const past = d <= last;
    const gone = tickets.filter(i => isClosed(i) && dayOf(closedAtFn(i)) <= d).reduce((s, i) => s + measure(i, u), 0);
    out.push({ d: d, remaining: past ? total - gone : null, ideal: Math.round(total * (1 - k / span) * 10) / 10 });
  }
  return { unit: u, total: total, days: out };
}
/**
 * Completing a sprint: unfinished tickets go to `target` ('' = backlog, or another sprint id).
 * Returns {sprint (updated copy with a saved report), moves:[ticket ids]}.
 */
export function completeSprint(sprint, rows, target, day, closedAtFn) {
  const t = ticketsIn(rows, sprint.id), open = t.filter(i => !isClosed(i)), done = t.filter(isClosed), u = unitOf(t);
  const b = burndown(Object.assign({}, sprint, { state: 'done' }), t, day, closedAtFn);
  const rep = { total: t.length, done: done.length, moved: open.length, to: target || '', points: t.reduce((s, i) => s + (Number(i.pts) || 0), 0), pointsDone: done.reduce((s, i) => s + (Number(i.pts) || 0), 0), unit: u, burn: b.days.map(x => x.remaining) };
  return { sprint: Object.assign({}, sprint, { state: 'done', doneAt: day, rep: rep }), moves: open.map(i => i.id) };
}
/** Average points done in the last completed sprints (velocity), or null. */
export function velocity(list, n) {
  const d = list.filter(s => s.state === 'done' && s.rep).slice(-(n || 3)); if (!d.length) return null;
  return Math.round(d.reduce((s, x) => s + (x.rep.unit === 'points' ? x.rep.pointsDone : x.rep.done), 0) / d.length * 10) / 10;
}
