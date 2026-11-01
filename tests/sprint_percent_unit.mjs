// Sprint item percent -> proposals for Monthly cards.
import { itemPct, scopePct, statusFor, proposals } from '../src/esm/features/sprint-percent.js';
let bad = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) bad++; };
ok('item: done is 100, an own number counts, nothing is 0', itemPct({ st: 'done', pc: 40 }) === 100 && itemPct({ st: 'progress', pc: 40 }) === 40 && itemPct({ st: 'planned' }) === 0 && itemPct({ pc: 150 }) === 100);
ok('scope: the average of its sub-sections, or its own', scopePct({ pc: 10 }, [{ pc: 20 }, { st: 'done' }]) === 60 && scopePct({ pc: 10 }, []) === 10);
ok('status: 100 is done, above 0 starts a planned item, a fall from done reopens it', statusFor('planned', 100) === 'done' && statusFor('planned', 30) === 'progress' && statusFor('blocked', 30) === 'blocked' && statusFor('done', 50) === 'progress' && statusFor('done', 0) === 'planned');
const sprints = [{ id: 'a', n: 229, a: '2026-11-01', b: '2026-11-14' }, { id: 'b', n: 230, a: '2026-11-15', b: '2026-11-28' }, { id: 'c', n: 228, a: '2026-10-04', b: '2026-10-17' }];
const data = {
  a: [{ id: 'i1', t: 'Parent invoice download page', par: '', pc: 60, st: 'progress', kind: 'feature' }, { id: 'i2', t: 'Reports export', par: '', st: 'progress', kind: 'feature', fid: 'k2', pc: 40 }, { id: 'i3', t: 'Quick fix', par: '', st: 'done', kind: 'fix' }],
  b: [{ id: 'j1', t: 'Parent invoice download page', par: '', pc: 100, st: 'done', kind: 'feature' }, { id: 'j2', t: 'Export work part two', par: '', st: 'progress', kind: 'feature', fid: 'k2', pc: 80 }, { id: 'j3', t: 'Parent', par: '', st: 'planned', kind: 'feature' }, { id: 'j4', t: 'child one', par: 'j3', st: 'done', kind: 'feature' }, { id: 'j5', t: 'child two', par: 'j3', pc: 50, st: 'progress', kind: 'feature', fid: 'k3' }],
  c: [{ id: 'o1', t: 'Parent invoice download page', par: '', pc: 10, st: 'progress', kind: 'feature' }]
};
const cards = [{ did: 'mo202611', mo: '2026-11', l: { id: 'k1', no: 1, k: 'tifli', t: 'Parent invoice download page', pct: 20 } }, { did: 'mo202611', mo: '2026-11', l: { id: 'k2', no: 2, k: 'tifli', t: 'Reports export card', pct: 60 } }, { did: 'mo202611', mo: '2026-11', l: { id: 'k3', no: 3, k: 'tifli', t: 'Unrelated card title', pct: 0 } }, { did: 'mo202611', mo: '2026-11', l: { id: 'k4', no: 4, k: 'tifli', t: 'Same percent', pct: 100 } }];
const pr = proposals(sprints, id => data[id], cards), by = id => pr.find(p => p.card.id === id);
ok('words: the card matched by words averages the items of the sprints of its month (60 and 100 = 80), not October', by('k1') && by('k1').to === 80 && by('k1').auto === true && by('k1').items.length === 2);
ok('link: a card linked by id averages its linked items (40 and 80 = 60) which equals its percent, so no proposal', !by('k2'));
ok('link: a sub-section linked by id counts for its card (50)', by('k3') && by('k3').to === 50 && by('k3').auto === false && by('k3').from === 0);
ok('fix items are never matched by words', !pr.some(p => p.items.some(x => x.t === 'Quick fix')));
ok('a card whose percent already matches is not proposed', !by('k4'));
ok('the proposals are sorted by card id', pr.map(p => p.id).join() === [...pr.map(p => p.id)].sort().join());
process.exit(bad ? 1 : 0);
