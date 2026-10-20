import { monthOf, monthLabel, prevMonth, nextMonth, monthRange, monthId, isMonth, newLine, monthProgress, adhocStats, assumePct, mergeRoad, carryFromLastMonth, monthText, clampPct } from '../src/esm/features/month-model.js';
import { reportToText } from '../src/esm/features/report-model.js';
const ok = (n, c) => console.log((c ? 'PASS ' : 'FAIL ') + n);
ok('a week belongs to the month of its middle day', monthOf('2026-10-18') === '2026-10' && monthOf('2026-10-28') === '2026-10' && monthOf('2026-10-29') === '2026-11' && monthOf('2026-12-30') === '2027-01');
ok('month helpers', monthLabel('2026-10') === 'October 2026' && prevMonth('2027-01') === '2026-12' && nextMonth('2026-12') === '2027-01' && monthLabel('x') === '' && monthId('2026-10') === 'mo202610' && isMonth('2026-10') && !isMonth('2026-13'));
ok('month range handles month ends and leap years', JSON.stringify(monthRange('2026-10')) === '{"a":"2026-10-01","b":"2026-10-31"}' && monthRange('2028-02').b === '2028-02-29' && monthRange('2026-12').b === '2026-12-31');
ok('percent is clamped to 0-100', clampPct(150) === 100 && clampPct(-5) === 0 && clampPct('42.4') === 42 && clampPct('abc') === 0);
const a = Object.assign(newLine('tifli', '  Onboarding   v2 '), { pct: 40 }), b = Object.assign(newLine('tifli', 'Wallet'), { pct: 100, w: 3 }), c = Object.assign(newLine('tifli', 'Urgent export', { adhoc: true, by: 'Business' }), { pct: 0 });
ok('new line is trimmed and starts at 0%', a.t === 'Onboarding v2' && newLine('x', 'a').pct === 0 && newLine('x', 'a').w === 1 && !newLine('x', 'a').pe);
ok('month progress is weighted and leaves ad hoc and blank lines out', JSON.stringify(monthProgress([a, b, c, newLine('tifli', '  ')])) === JSON.stringify({ pct: 85, n: 2, done: 1 }));
ok('empty list has no percentage', monthProgress([]).pct === null && monthProgress([c]).pct === null);
ok('ad hoc statistics', JSON.stringify(adhocStats([a, b, c])) === JSON.stringify({ n: 1, done: 0 }));
// assumed percentage
const bar = (a, b, o) => Object.assign({ a: a, b: b, st: 'planned', ms: false }, o);
ok('done is 100, not started is 0', assumePct(bar('2026-10-01', '2026-10-10', { st: 'done' }), '2026-10-02') === 100 && assumePct(bar('2026-10-10', '2026-10-20'), '2026-10-05') === 0);
ok('in progress is the share of days passed, rounded to 5', assumePct(bar('2026-10-01', '2026-10-10'), '2026-10-05') === 50 && assumePct(bar('2026-10-01', '2026-10-30'), '2026-10-10') === 35);
ok('never above 90 until it is marked Done', assumePct(bar('2026-10-01', '2026-10-10'), '2026-10-10') === 90 && assumePct(bar('2026-10-01', '2026-10-10'), '2026-11-20') === 90);
ok('a milestone is 0 until Done', assumePct(bar('2026-10-05', '2026-10-05', { ms: true }), '2026-10-20') === 0 && assumePct(bar('2026-10-05', '2026-10-05', { ms: true, st: 'done' }), '2026-10-20') === 100);
// merge from the roadmap
const pl = [{ k: 'tifli', n: 'Tifli', squads: ['tifli'] }, { k: 'plan_daycare', n: 'Plan / Daycare', squads: ['plan', 'daycare'] }];
const road = [
  { id: 'r1', t: 'Home sessions', sq: 'tifli', a: '2026-10-01', b: '2026-10-20', st: 'planned' },
  { id: 'r2', t: 'Attendance report', sq: 'daycare', a: '2026-09-20', b: '2026-10-05', st: 'done' },
  { id: 'r3', t: 'Next quarter thing', sq: 'tifli', a: '2026-11-10', b: '2026-11-20', st: 'planned' },
  { id: 'r4', t: 'Sara voice', sq: 'ai', a: '2026-10-01', b: '2026-10-10', st: 'planned' },
  { id: 'r5', t: 'Overlaps the month end', sq: 'plan', a: '2026-10-28', b: '2026-11-04', st: 'planned' }
];
const m1 = mergeRoad([], road, pl, '2026-10', '2026-10-10');
ok('only features that overlap the month and belong to a product are added', m1.added === 3 && m1.skipped === 1 && m1.lines.map(l => l.src).sort().join() === 'r1,r2,r5');
ok('each is in the right product with an estimated percentage', m1.lines.find(l => l.src === 'r1').k === 'tifli' && m1.lines.find(l => l.src === 'r1').pct === 50 && m1.lines.find(l => l.src === 'r2').k === 'plan_daycare' && m1.lines.find(l => l.src === 'r2').pct === 100 && m1.lines.find(l => l.src === 'r5').pct === 0);
const edited = m1.lines.map(l => l.src === 'r1' ? Object.assign({}, l, { pct: 30, pe: true, t: 'Home sessions (renamed)' }) : l);
const m2 = mergeRoad(edited, road.map(r => r.id === 'r5' ? Object.assign({}, r, { a: '2026-10-05', b: '2026-10-15' }) : r), pl, '2026-10', '2026-10-14');
ok('a second sync adds nothing twice and keeps what a person edited', m2.added === 0 && m2.lines.length === 3 && m2.lines.find(l => l.src === 'r1').pct === 30 && m2.lines.find(l => l.src === 'r1').t === 'Home sessions (renamed)');
ok('a second sync refreshes estimates that nobody edited', m2.updated === 1 && m2.lines.find(l => l.src === 'r5').pct === 90);
ok('the input lines are not changed', m1.lines.find(l => l.src === 'r5').pct === 0 && edited.find(l => l.src === 'r5').pct === 0);
// carry
const oct = { mo: '2026-10', lines: [a, b, c, newLine('tifli', 'Done adhoc', { adhoc: true })].map(l => Object.assign({}, l)) };
oct.lines[3].pct = 100;
const nov = { mo: '2026-11', lines: [] }, cf = carryFromLastMonth(nov, [oct, nov]);
ok('carry brings only unfinished lines of the previous month, with new ids', cf && cf.from === '2026-10' && cf.lines.length === 2 && cf.lines.every(l => l.id !== a.id && l.id !== c.id) && cf.lines.some(l => l.t === 'Onboarding v2' && l.pct === 40) && !cf.lines.some(l => l.t === 'Wallet'));
ok('carry skips lines already present and months without a previous doc', carryFromLastMonth({ mo: '2026-11', lines: [{ t: 'onboarding V2' }, { t: 'urgent export' }] }, [oct]) === null && carryFromLastMonth({ mo: '2027-03', lines: [] }, [oct]) === null);
// text
const prods = [{ k: 'tifli', n: 'Tifli' }];
const t = monthText({ mo: '2026-10', pl: prods, lines: [a, b, Object.assign({}, c, { at: '2026-10-19' })] }, prods, x => x);
ok('text has the month, product percentage, lines and ad hoc requests', /MONTHLY DELIVERABLES - October 2026 - 85% complete \(1 of 2 done\)/.test(t.join('\n')) && /Tifli - 85%/.test(t.join('\n')) && /- Onboarding v2: 40%/.test(t.join('\n')) && /Urgent export \(requested by Business, 2026-10-19\): 0%/.test(t.join('\n')));
ok('no text for an empty month', monthText({ mo: '2026-10', lines: [] }, prods).length === 0 && monthText(null, prods).length === 0);
ok('the weekly report text includes the month when given', /MONTHLY DELIVERABLES/.test(reportToText({ a: '2026-10-18', b: '2026-10-24', prods: {} }, prods, x => x, { mo: '2026-10', lines: [a] })) && !/MONTHLY/.test(reportToText({ a: '2026-10-18', b: '2026-10-24', prods: {} }, prods, x => x)));
