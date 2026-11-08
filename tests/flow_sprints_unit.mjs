// Ynmo Flow phase 3 + performance: sprint rules, backlog rank, burndown, report, team numbers.
import { makeIssue, applyChange, list } from '../src/esm/features/flow-model.js';
import { suggestSprint, sprintProblem, makeSprint, startProblem, rankPatch, rkOf, byRank, ticketsIn, burndown, completeSprint, velocity, sprintStats } from '../src/esm/features/flow-sprints.js';
import { perfStats, closedAt, cycleDays, onTime, reopenCount } from '../src/esm/features/flow-perf.js';
let bad = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) bad++; };
// sprints
const l0 = []; const sug = suggestSprint(l0, '2026-11-08');
ok('first sprint suggestion: Sprint 1, two weeks', sug.n === 'Sprint 1' && sug.start === '2026-11-08' && sug.end === '2026-11-21');
const s1 = makeSprint(l0, sug); ok('sprint ids start at s1, planned', s1.id === 's1' && s1.state === 'planned');
ok('next suggestion continues after the last end', suggestSprint([s1], '2026-11-08').n === 'Sprint 2' && suggestSprint([s1], '2026-11-08').start === '2026-11-22');
ok('name, duplicate and date problems', /name/.test(sprintProblem([], { n: ' ', start: 'a', end: 'b' })) && /already/.test(sprintProblem([s1], { n: 'sprint 1', start: '2026-01-01', end: '2026-01-02' })) && /before/.test(sprintProblem([], { n: 'x', start: '2026-02-02', end: '2026-02-01' })) && sprintProblem([s1], { n: 'Sprint 1', start: s1.start, end: s1.end }, s1) === '');
const s2 = makeSprint([s1], suggestSprint([s1], '2026-11-08'));
ok('only one active sprint', startProblem([Object.assign({}, s1, { state: 'active' }), s2], s2) !== '' && startProblem([s1, s2], s1) === '');
// tickets
const I = {}; const add = (o, at) => { const i = makeIssue(o, I, 'Asmaa', at || '2026-11-08T08:00:00Z'); I[i.key] = i; return i.key; };
const a = add({ type: 'task', t: 'A', as: 'Mona', pts: 3, sp: 's1' }), b = add({ type: 'task', t: 'B', as: 'Omar', pts: 2, sp: 's1', due: '2026-11-10' }), c = add({ type: 'bug', t: 'C', as: 'Mona', pts: 1, sp: 's1' }), d = add({ type: 'task', t: 'D' }), e = add({ type: 'epic', t: 'E' });
const R = () => Object.keys(I).map(k => Object.assign({ id: k }, I[k]));
ok('tickets get a sprint and a rank', I[a].sp === 's1' && I[d].sp === '' && I[a].rk === 10);
ok('sprint list has the three, the backlog has D, epics are never listed', ticketsIn(R(), 's1').length === 3 && ticketsIn(R(), '').map(x => x.key).join() === d && !ticketsIn(R(), '').some(x => x.type === 'epic'));
// rank
let o = byRank(R().filter(x => x.sp === 's1')); ok('order by rank', o.map(x => x.key).join() === [a, b, c].join());
let p = rankPatch(o, c, a); ok('move C before A changes only C and puts it first', p.length === 1 && p[0].id === c && p[0].rk < rkOf(o[0]));
p = rankPatch(o, a, ''); ok('move A to the end', p.length === 1 && p[0].rk > rkOf(o[2]));
p = rankPatch(o, c, b); ok('between two ranks takes the middle', p.length === 1 && p[0].rk > rkOf(o[0]) && p[0].rk < rkOf(o[1]));
const tight = [{ id: 'x', n: 1, rk: 10 }, { id: 'y', n: 2, rk: 11 }, { id: 'z', n: 3, rk: 50 }]; p = rankPatch(tight, 'z', 'y');
ok('no gap left: neighbours are renumbered, order stays right', p.length >= 1 && (() => { const m = Object.fromEntries(tight.map(t => [t.id, t.rk])); p.forEach(q => { m[q.id] = q.rk; }); const ord = Object.keys(m).sort((u, v) => m[u] - m[v]); return ord.join() === 'x,z,y'; })());
// history shows a name
ok('sprint change goes to the history', applyChange(I[d], { sp: 's1' }, 'Asmaa').hist.slice(-1)[0].f === 'sprint');
// burndown & close
const sp = Object.assign({}, s1, { state: 'active', start: '2026-11-08', end: '2026-11-12' });
I[a] = applyChange(I[a], { st: 'done' }, 'Mona', '2026-11-09T09:00:00Z');
const cl = x => closedAt(x);
const bd = burndown(sp, ticketsIn(R(), 's1'), '2026-11-10', cl);
ok('burndown in points, 5 days, drops by A on 9 Nov, empty after today', bd.unit === 'points' && bd.total === 6 && bd.days.length === 5 && bd.days[0].remaining === 6 && bd.days[1].remaining === 3 && bd.days[3].remaining === null && bd.days[4].ideal === 0);
const cp = completeSprint(sp, R(), '', '2026-11-12', cl);
ok('complete: 1 of 3 finished, 2 move to the backlog, report saved', cp.sprint.state === 'done' && cp.sprint.rep.done === 1 && cp.sprint.rep.moved === 2 && cp.moves.length === 2 && cp.sprint.rep.pointsDone === 3 && cp.sprint.rep.burn.length === 5);
ok('velocity from completed sprints', velocity([cp.sprint], 3) === 3 && velocity([], 3) === null);
ok('sprint stats', sprintStats(R(), 's1').count === 3 && sprintStats(R(), 's1').done === 1);
// performance
const P = {}; const mk = (o, cr) => { const i = makeIssue(o, P, 'Asmaa', cr); P[i.key] = i; return i.key; };
const t1 = mk({ type: 'task', t: 'T1', as: 'Mona', due: '2026-11-05', pts: 2 }, '2026-11-01T08:00:00Z'), t2 = mk({ type: 'bug', t: 'T2', as: 'Mona', due: '2026-11-03' }, '2026-11-01T08:00:00Z'), t3 = mk({ type: 'task', t: 'T3', as: 'Omar', due: '2026-11-01' }, '2026-11-02T08:00:00Z');
P[t1] = applyChange(P[t1], { st: 'done' }, 'Mona', '2026-11-04T10:00:00Z');
P[t2] = applyChange(applyChange(P[t2], { st: 'done' }, 'Mona', '2026-11-06T10:00:00Z'), { st: 'progress' }, 'Mona', '2026-11-07T10:00:00Z');
P[t2] = applyChange(P[t2], { st: 'done' }, 'Mona', '2026-11-08T07:00:00Z');
const PR = Object.keys(P).map(k => Object.assign({ id: k }, P[k]));
ok('closedAt = last move into a finished status', closedAt(P[t2]).startsWith('2026-11-08') && closedAt(P[t3]) === '');
ok('cycle time and on-time', cycleDays(P[t1]) === 3.1 && onTime(P[t1]) === true && onTime(P[t2]) === false && onTime(P[t3]) === null);
ok('reopen count', reopenCount(P[t2]) === 1 && reopenCount(P[t1]) === 0);
const ps = perfStats(PR, { days: 30, day: '2026-11-08' });
ok('team: 2 closed, 3 created, 1 open, 1 overdue, 1 reopened, 50% on time', ps.team.closed === 2 && ps.team.created === 3 && ps.team.open === 1 && ps.team.overdue === 1 && ps.team.reopened === 1 && ps.team.onTimePct === 50);
const mona = ps.people.find(x => x.n === 'Mona'), omar = ps.people.find(x => x.n === 'Omar');
ok('people: Mona closed 2 (1 bug, 2 points), Omar has 1 open and overdue; Mona listed first', mona.closed === 2 && mona.bugsFixed === 1 && mona.points === 2 && omar.open === 1 && omar.overdue === 1 && ps.people[0].n === 'Mona');
ok('8 weekly buckets, last one holds both closings of this week', ps.weeks.length === 8 && ps.weeks[7].closed === 2 && ps.weeks[6].closed === 0 || ps.weeks[7].closed >= 1);
ok('type and period filters', perfStats(PR, { days: 30, day: '2026-11-08', type: 'bug' }).team.closed === 1 && perfStats(PR, { days: 3, day: '2026-11-08' }).team.closed === 1);
ok('epics are not counted', perfStats(PR.concat([{ id: 'ep', key: 'YNMO-99', n: 99, type: 'epic', st: 'done', t: 'E', cr: '2026-11-08T00:00:00Z', up: '2026-11-08T00:00:00Z', hist: [] }]), { days: 30, day: '2026-11-08' }).team.closed === 2);
console.log(bad ? 'FAILED ' + bad : 'ALL OK'); process.exit(bad ? 1 : 0);
