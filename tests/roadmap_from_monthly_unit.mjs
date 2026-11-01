// Sync from Monthly: plan rows for the Gantt.
import { planRows, barOf } from '../src/esm/features/roadmap-from-monthly.js';
let bad = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) bad++; };
const lanes = ['tifli', 'daycare', 'plan', 'ai'], sqOf = n => (n === 'Ali' ? 'plan' : 'tifli');
const c = (id, t, k, who, pct) => ({ did: 'mo202611', mo: '2026-11', l: { id, t, k, pct, no: +id.slice(1), who: who } });
const cards = [c('k1', 'Invoice page', 'daycare', { des: { Mona: 4, Ali: 2 } }, 30), c('k2', 'Export', 'initiative', { dev: { Ali: 6 } }, 0), c('k3', 'No people', 'tifli', {}, 100),
  c('k4', 'On roadmap', 'tifli', { dev: { Mona: 2 } }, 0), c('k5', '  ', 'tifli', {}, 0), { did: 'mobacklog', mo: 'backlog', l: { id: 'k6', t: 'Backlog thing', k: 'tifli', pct: 0 } }, { did: 'mo202701', mo: '2027-01', l: { id: 'k7', t: 'Outside', k: 'tifli', pct: 0 } }];
const rows = planRows({ cards, rm: { a: '2026-10-01', b: '2026-12-31' }, onRoad: l => l.id === 'k4', laneKeys: lanes, sqOf });
ok('backlog, empty titles, cards already on the roadmap and months outside the roadmap are left out', rows.map(r => r.l.id).sort().join() === 'k1,k2,k3');
const r1 = rows.find(r => r.l.id === 'k1'), r2 = rows.find(r => r.l.id === 'k2'), r3 = rows.find(r => r.l.id === 'k3');
ok('people are the ones with points, in card order', r1.people.join() === 'Mona,Ali' && r2.people.join() === 'Ali' && r3.people.length === 0);
ok('dates are the month, squad comes from the tag, else from the first person, else the first lane', r1.a === '2026-11-01' && r1.b === '2026-11-30' && r1.sq === 'daycare' && r2.sq === 'plan' && r3.sq === 'tifli');
ok('cards at 100% are not ticked by default', r1.tick && r2.tick && !r3.tick);
ok('rows are grouped by first person, people-less last', rows.map(r => r.l.id).join() === 'k2,k1,k3');
const cut = planRows({ cards: [c('k1', 'x', 'tifli', { dev: { Ali: 1 } }, 0)], rm: { a: '2026-11-10', b: '2026-11-20' }, onRoad: () => false, laneKeys: lanes, sqOf })[0];
ok('dates are cut to the roadmap', cut.a === '2026-11-10' && cut.b === '2026-11-20');
const bar = barOf(Object.assign({}, r1, { k0: 5, k1: 9 }), 'h2', 3, 'n'); ok('the bar is a custom item linked to the card', bar.custom && bar.card === 'k1' && bar.res.join() === 'Mona,Ali' && bar.pc === 30 && bar.d0 === 5 && bar.ord === 3 && bar.rm === 'h2');
process.exit(bad ? 1 : 0);
