// Weekly report: Monthly cards as a source (cards, dedupe, previous delivery, sections, checks).
import { monthText, carryText, assignees, pointsMatch } from '../src/esm/features/month-model.js';
import { sourceLines, buildProds, monthSections, prevDoneOf, reportChecks, tagKeysOf, linePct } from '../src/esm/features/report-model.js';
let bad = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) bad++; };
const prod = { k: 'tifli', n: 'Tifli', squads: ['tifli'] }, pd = { k: 'plan_daycare', n: 'Plan / Daycare', squads: ['plan', 'daycare'] };
const cards = [
  { id: 'c1', k: 'tifli', t: 'Parent invoice download page', pct: 50, rid: 'b1', no: 1 },
  { id: 'c2', k: 'tifli', t: 'Home sessions setup', pct: 100, no: 2 },
  { id: 'c3', k: 'tifli', t: 'Not started card', pct: 0, no: 3 },
  { id: 'c4', k: 'daycare', t: 'Daycare thing', pct: 25, no: 4, notes: [{ t: 'internal note' }], info: 'secret details' },
  { id: 'c5', k: 'schs', t: 'SCHS pilot', pct: 40, no: 5 }
];
ok('tags: Plan / Daycare covers the plan and daycare tags', tagKeysOf(pd).sort().join() === 'daycare,plan');
const ls = sourceLines(prod, [], [], NaN, NaN, '2026-10-11', '2026-10-17', cards, new Set());
ok('cards: started cards join, a 0% card does not', ls.length === 2 && !ls.some(l => l.src === 'mo:c3'));
ok('cards: 50% is in progress with its percent and a link to the card', ls.find(l => l.src === 'mo:c1').g === 'prog' && ls.find(l => l.src === 'mo:c1').pct === 50 && ls.find(l => l.src === 'mo:c1').fid === 'c1');
ok('cards: 100% is delivered', ls.find(l => l.src === 'mo:c2').g === 'done' && ls.find(l => l.src === 'mo:c2').st === 'done');
ok('cards: a card already delivered in the previous report is not delivered again', !sourceLines(prod, [], [], NaN, NaN, 'a', 'b', cards, new Set(['mo:c2'])).some(l => l.src === 'mo:c2'));
const road = [{ id: 'b1', t: 'Invoice page bar', sq: 'tifli', d0: 1, d1: 9, st: 'on' }, { id: 'b2', t: 'Other bar', sq: 'tifli', d0: 1, d1: 9, st: 'on' }];
const si = [{ id: 's1', squad: 'tifli', t: 'Parent invoice download page (DYC-7)', jira: 'DYC-7', st: 'progress' }, { id: 's2', squad: 'tifli', t: 'Unrelated fix', st: 'progress', kind: 'fix' }];
const m = sourceLines(prod, si, road, 0, 10, 'a', 'b', cards, new Set()), srcs = m.map(l => l.src).sort();
ok('dedupe: the roadmap bar of a card and the sprint item with the same words are replaced by the card', !srcs.includes('rf:b1') && !srcs.includes('si:s1') && srcs.includes('rf:b2') && srcs.includes('si:s2') && srcs.includes('mo:c1'));
ok('dedupe: the card keeps the Jira key of the sprint item', m.find(l => l.src === 'mo:c1').jira === 'DYC-7');
const pdl = sourceLines(pd, [], [], NaN, NaN, 'a', 'b', cards, new Set());
ok('product: a Daycare tag card goes under Plan / Daycare', pdl.length === 1 && pdl[0].src === 'mo:c4');
ok('privacy: notes and details of a card are never copied', !JSON.stringify(pdl).includes('internal note') && !JSON.stringify(pdl).includes('secret'));
const ms = monthSections(cards, [prod, pd]);
ok('sections: a started SCHS card gets its own section, covered tags do not', ms.length === 1 && ms[0].k === 'schs');
ok('sections: nothing added when the tag has no started card', monthSections([{ k: 'warif', pct: 0 }], [prod]).length === 0);
const b = buildProds([prod], {}, [], [], NaN, NaN, 'a', 'b', cards, new Set());
ok('build: lines carry pct and lk, unedited', b.tifli.items.length === 2 && linePct(b.tifli.items.find(l => l.src === 'mo:c1')) === 50 && b.tifli.items[0].lk && b.tifli.items[0].edited === false);
const b2 = buildProds([prod], b, [], [], NaN, NaN, 'a', 'b', cards.map(c => c.id === 'c1' ? Object.assign({}, c, { pct: 75 }) : c), new Set());
ok('build: an unedited line follows the card (50 to 75)', linePct(b2.tifli.items.find(l => l.src === 'mo:c1')) === 75);
b.tifli.items.find(l => l.src === 'mo:c1').edited = true; b.tifli.items.find(l => l.src === 'mo:c1').pct = 60;
const b3 = buildProds([prod], b, [], [], NaN, NaN, 'a', 'b', cards.map(c => c.id === 'c1' ? Object.assign({}, c, { pct: 90 }) : c), new Set());
ok('build: an edited line is never overwritten', linePct(b3.tifli.items.find(l => l.src === 'mo:c1')) === 60);
const reps = { rp20261004: { a: '2026-10-04', prods: { tifli: { items: [{ src: 'mo:c2', pct: 100, st: 'done' }, { src: 'mo:c1', pct: 50 }] } } }, rp20261011: { a: '2026-10-11', prods: { tifli: { items: [{ src: 'mo:c1', pct: 50, t: 'Parent invoice download page' }] } } } };
ok('previous: delivered cards come from the latest earlier report only', prevDoneOf(reps, '2026-10-11').has('mo:c2') && !prevDoneOf(reps, '2026-10-04').has('mo:c2') && prevDoneOf(reps, '2026-10-18').size === 0);
const ck = reportChecks({ a: '2026-10-11', prods: { tifli: { items: [{ src: 'mo:c1', t: 'Parent invoice download page', pct: 50 }] } } }, reps, cards, '2026-10');
ok('checks: a card at the same percent as last week is flagged', ck.some(x => x.includes('still at 50%')));
ok('checks: not-started cards are counted with the month name', ck.some(x => x.startsWith('1 card of October 2026 has not started')));
ok('checks: nothing to flag for a moving card', reportChecks({ a: '2026-10-11', prods: { tifli: { items: [{ src: 'mo:c1', t: 'x', pct: 70 }] } } }, reps, [], '2026-10').length === 0);
const co = { id: 'x', k: 'tifli', t: 'Late card', pct: 20, no: 9, co: { from: '2026-09', why: 'Scope grew: new screens' } };
ok('carry over: the tag text names last month and the reason', carryText(co) === 'Carry over from September 2026: Scope grew: new screens' && carryText({ t: 'a' }) === '');
ok('carry over: the month text shows the tag', monthText({ mo: '2026-10', lines: [co] }, [{ k: 'tifli', n: 'Tifli' }]).join('\n').includes('[CARRY OVER FROM SEPTEMBER 2026: SCOPE GREW: NEW SCREENS]'));
const w1 = { who: { fe: { 'Amal Saleem': 5 }, be: { 'Ahmed Soliman': 3 } } }, w2 = { who: { fe: { 'Amal Saleem': 0 } } }, w3 = { t: 'no who' };
ok('filter: assignees are the people with points, sorted', assignees([w1, w2, w3]).join() === 'Ahmed Soliman,Amal Saleem');
ok('filter: a person matches a card they have points on, not one where they have 0', pointsMatch(w1, 'Amal Saleem', 'all') && !pointsMatch(w2, 'Amal Saleem', 'all') && !pointsMatch(w3, 'Amal Saleem', 'all'));
ok('filter: with / none points', pointsMatch(w1, 'all', 'with') && !pointsMatch(w3, 'all', 'with') && pointsMatch(w3, 'all', 'none') && pointsMatch(w2, 'all', 'none') && !pointsMatch(w1, 'all', 'none'));
ok('filter: an exact value, for the person chosen or for anybody', pointsMatch(w1, 'Amal Saleem', '5') && !pointsMatch(w1, 'Amal Saleem', '3') && pointsMatch(w1, 'Ahmed Soliman', '3') && pointsMatch(w1, 'all', '3'));
process.exit(bad ? 1 : 0);
