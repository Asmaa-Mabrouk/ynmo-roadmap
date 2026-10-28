import { monthOf, monthLabel, prevMonth, nextMonth, monthRange, monthId, isMonth, newLine, monthProgress, adhocStats, TAGS, cardId, legacyTag, monthText, clampPct, pctBand } from '../src/esm/features/month-model.js';
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
ok('every tag has a two-letter abbreviation', TAGS.map(t => t.ab).join() === 'DC,TF,PL,AI,FN,NI,SC,WR' && TAGS.length === 8);
ok('card id is the tag abbreviation # the card number', cardId({ k: 'daycare', no: 12 }) === 'DC#12' && cardId({ k: 'tifli', no: 3 }) === 'TF#3' && cardId({ k: 'initiative', no: 40 }) === 'NI#40');
ok('no number, no id; unknown tag uses its first two letters', cardId({ k: 'plan' }) === '' && cardId(null) === '' && cardId({ k: 'xyz', no: 5 }) === 'XY#5');
ok('the id follows the tag when the tag is changed', cardId(Object.assign({}, { k: 'daycare', no: 7 }, { k: 'plan' })) === 'PL#7');
ok('old combined card maps to Plan or Daycare', legacyTag('plan_daycare', 'daycare') === 'daycare' && legacyTag('plan_daycare') === 'plan');
// text
const prods = [{ k: 'tifli', n: 'Tifli' }];
a.no = 1; b.no = 2;
const t = monthText({ mo: '2026-10', pl: prods, lines: [a, b, Object.assign({}, c, { at: '2026-10-19' })] }, prods, x => x);
ok('text has the month, product percentage, lines and ad hoc requests', /MONTHLY DELIVERABLES - October 2026 - 85% complete \(1 of 2 done\)/.test(t.join('\n')) && /Tifli - 85%/.test(t.join('\n')) && /- TF#1 Onboarding v2: 40%/.test(t.join('\n')) && /Urgent export \(requested by Business, 2026-10-19\): 0%/.test(t.join('\n')));
ok('no text for an empty month', monthText({ mo: '2026-10', lines: [] }, prods).length === 0 && monthText(null, prods).length === 0);
ok('the weekly report text includes the month when given', /MONTHLY DELIVERABLES/.test(reportToText({ a: '2026-10-18', b: '2026-10-24', prods: {} }, prods, x => x, { mo: '2026-10', lines: [a] })) && !/MONTHLY/.test(reportToText({ a: '2026-10-18', b: '2026-10-24', prods: {} }, prods, x => x)));
ok('percentage colour: none grey, 1-50 yellow, 51-99 orange, 100 green', pctBand(0) === 'n' && pctBand(1) === 'y' && pctBand(50) === 'y' && pctBand(51) === 'o' && pctBand(99) === 'o' && pctBand(100) === 'g');
const d1 = Object.assign({}, a, { info: '  Nudge   parents\nbefore visits ' });
ok('copy text carries the details of a card', /  Details: Nudge parents before visits/.test(monthText({ mo: '2026-10', pl: prods, lines: [d1] }, prods, x => x).join('\n')));
import { sortByProduct, PRODUCT_ORDER } from '../src/esm/features/month-model.js';
const mk = (t, k) => ({ id: t, t, k });
const srt = sortByProduct([mk('w', 'warif'), mk('p1', 'plan'), mk('d', 'daycare'), mk('s', 'schs'), mk('a', 'ai'), mk('t', 'tifli'), mk('p2', 'plan'), mk('f', 'finance'), mk('x', 'nope')]);
ok('sort by product: Tifli, AI, Daycare, Plan, SCHS, Warif, then the others', srt.map(l => l.id).join() === 't,a,d,p1,p2,s,w,f,x' && PRODUCT_ORDER.slice(0, 6).join() === 'tifli,ai,daycare,plan,schs,warif');
const inp = [mk('b', 'plan'), mk('a', 'plan')]; sortByProduct(inp);
ok('sorting does not change the original list and keeps the order inside a product', inp[0].id === 'b' && sortByProduct(inp).map(l => l.id).join() === 'b,a');
import * as cap from '../src/esm/features/capacity.js';
const P8 = { ppp: 8 }; // the old 8 points a person; the new default is 40 (1 point = 4 hours)
{
  const rg = { a: '2026-11-01', b: '2026-11-30' };
  ok('capacity: working days are Sunday to Thursday (Nov 2026 = 22)', cap.workdays(rg.a, rg.b) === 22);
  const be = cap.LANES.find(l => l.k === 'be'), c0 = cap.laneCapacity(be, rg, [], P8);
  ok('capacity: 4 BE people x 8 points less 30% = 22.4', c0.people === 4 && c0.raw === 32 && c0.cap === 22.4);
  const c1 = cap.laneCapacity(be, rg, [{ p: 'Soliman Ahmed', a0: '2026-11-01', a1: '2026-11-12' }], P8);
  ok('capacity: leave reduces the capacity (8 working days of 21)', c1.raw < 32 && c1.raw > 25);
  ok('capacity: a full-name leave entry matches the short name', cap.sameName('Aya Fathy Ali', 'Aya Fathy') && !cap.sameName('Amal Hassan', 'Aya Fathy'));
  const lines = [{ id: 'a', pts: { be: 10, fe: 5 } }, { id: 'b', pts: { be: 8 } }];
  ok('capacity: loads add the points per role', JSON.stringify(cap.loads(lines)).includes('"be":18') && cap.loads(lines).fe === 5);
  ok('capacity: status ok / warn / over', cap.statusOf(5, 20) === 'ok' && cap.statusOf(19, 20) === 'warn' && cap.statusOf(21, 20) === 'over');
  const ov = cap.overAfter({ id: 'n', pts: { be: 6 } }, lines, rg, [], P8);
  ok('capacity: a card that pushes BE past 22.4 is reported', ov.length === 1 && ov[0].k === 'be' && ov[0].used === 24);
  ok('capacity: a card that fits is not reported', cap.overAfter({ id: 'n', pts: { be: 3 } }, lines, rg, [], {}).length === 0);
  const monthOf = id => ({ p: '2026-12', q: '' }[id] || '2026-11'), lab = id => 'X#' + id;
  ok('dependency: needing a card planned later is a problem', cap.dependencyProblems({ id: 'z', needs: 'p' }, '2026-11', monthOf, lab, []).length === 1);
  ok('dependency: a prerequisite planned earlier or the same month is fine', cap.dependencyProblems({ id: 'z', needs: 'a' }, '2026-11', monthOf, lab, []).length === 0);
  ok('dependency: moving a card later than one that needs it is a problem', cap.dependencyProblems({ id: 'a' }, '2026-12', monthOf, lab, [{ id: 'z' }]).length === 1);
  ok('capacity: settings can be overridden and bad values fall back', cap.settings({ ppp: 10, reserve: 5 }).ppp === 10 && cap.settings({ reserve: 5 }).reserve === 0.2);
  // leaving, person state, review and suggestions (Capacity dashboard)
  const BE = { k: 'be', people: ['Soliman', 'Wardany', 'Hosieny', 'Hamid'] };
  const gone = cap.laneCapacity(BE, rg, [], { ppp: 8, leaving: { Hamid: '2026-10-31' } });
  ok('leaving: someone who left before the month adds nothing (3 people, 24 raw, 16.8)', gone.people === 3 && gone.raw === 24 && gone.cap === 16.8);
  const half = cap.laneCapacity(BE, rg, [], { ppp: 8, leaving: { Hamid: '2026-11-15' } });
  ok('leaving: a last day inside the month counts only the days worked', half.people === 4 && half.raw > 24 && half.raw < 32);
  ok('leaving: bad dates are ignored', Object.keys(cap.settings({ leaving: { A: 'soon', B: '2026-12-01' } }).leaving).join() === 'B');
  const ps = (n, v, l) => cap.personState(n, '2026-10-20', v, l, 90, 60);
  ok('person: on leave today shows until when', ps('Amal', [{ p: 'Amal Hassan', a0: '2026-10-19', a1: '2026-10-22' }], P8).onLeave === true && ps('Amal', [{ p: 'Amal Hassan', a0: '2026-10-19', a1: '2026-10-22' }], P8).leave.a1 === '2026-10-22');
  ok('person: next leave inside 90 days is shown, one beyond is not', ps('Amal', [{ p: 'Amal', a0: '2026-11-03', a1: '2026-11-05' }], P8).leave.a0 === '2026-11-03' && ps('Amal', [{ p: 'Amal', a0: '2027-03-01', a1: '2027-03-02' }], P8).leave === null);
  ok('person: leaving soon, later and left', ps('A', [], { A: '2026-11-30' }).leaving.state === 'soon' && ps('A', [], { A: '2027-03-01' }).leaving.state === 'later' && ps('A', [], { A: '2026-10-01' }).leaving.state === 'left');
  const mk = (m, lines) => lines, boards = { '2026-11': [{ id: 'a', t: 'a', pts: { be: 15 } }, { id: 'b', t: 'b', pts: { be: 12 } }], '2026-12': [], '2027-01': [{ id: 'c', t: 'c', pts: { be: 22 } }] };
  const o = { linesOf: m => boards[m] || [], rangeOf: cap.monthRangeOf || (m => ({ a: m + '-01', b: m + '-30' })), vacs: [], cfg: P8, probsOf: () => [] };
  const rev = cap.review(['2026-11', '2026-12', '2027-01'], o);
  ok('review: November BE is over (27 of 22.4), December fits', rev[0].st === 'over' && rev[0].lanes.find(x => x.k === 'be').over === 4.6 && rev[1].st === 'ok' && rev[1].lanes.find(x => x.k === 'be').free > 20);
  const sug = cap.suggestMoves(rev, o);
  ok('suggest: moves the smallest card that clears the excess to the first month with room', sug.length === 1 && sug[0].line.id === 'b' && sug[0].to === '2026-12');
  ok('suggest: says so when no later month has room', cap.suggestMoves(rev, Object.assign({}, o, { probsOf: () => ['blocked'] }))[0].none === true);
  // per person (points dialog and Dashboard)
  const R = { a: '2026-11-01', b: '2026-11-30' };
  ok('person capacity: 8 points less 30% = 5.6', cap.personCap('Soliman', R, [], P8) === 5.6);
  ok('person capacity: leave lowers it, a last day before the month makes it 0', cap.personCap('Soliman', R, [{ p: 'Soliman', a0: '2026-11-01', a1: '2026-11-11' }], P8) < 5.6 && cap.personCap('Soliman', R, [], { leaving: { Soliman: '2026-10-31' } }) === 0);
  const pl = cap.personLoads([{ pts: { be: 8, fe: 2 }, who: { be: { Soliman: 5, Hamid: 3 }, fe: { Soliman: 2 } } }, { pts: { be: 1 }, who: { be: { Soliman: 1 } } }, { pts: { be: 4 } }]);
  ok('person loads: points add up per person across tracks and cards (Soliman 8, Hamid 3)', pl.Soliman === 8 && pl.Hamid === 3 && Object.keys(pl).length === 2);
  ok('who: a missing or bad value gives nobody', Object.keys(cap.whoOf({}, 'be')).length === 0 && Object.keys(cap.whoOf({ who: { be: 5 } }, 'be')).length === 0 && cap.whoOf({ who: { be: { A: 2 } } }, 'be').A === 2);
  // names follow Resources
  const RS = [{ name: 'Hamid Shahin', domain: 'Engineering' }, { name: 'Khalid', domain: 'UX / Design' }, { name: 'Saad', domain: 'UX / Design' }, { name: 'Wardany', domain: 'Backend' }];
  ok('resources: an exact name is kept', cap.matchResource('Saad', RS, 'UX / Design') === 'Saad');
  ok('resources: a short name finds the longer Resources name (Hamid is Hamid Shahin)', cap.matchResource('Hamid', RS, 'Backend') === 'Hamid Shahin');
  ok('resources: Khalid Abdelfattah is the Design Khalid', cap.matchResource('Khalid Abdelfattah', RS, 'UX / Design') === 'Khalid');
  ok('resources: Khalid Nazim (PM) is not the Design Khalid', cap.matchResource('Khalid Nazim', RS, 'PM') === '');
  ok('resources: an unknown name matches nothing', cap.matchResource('Nobody', RS, 'PM') === '');
  const rd = cap.resolveDefaults({}, RS), des = rd.lanes.find(l => l.k === 'des').people, beP = rd.lanes.find(l => l.k === 'be').people;
  ok('resources: defaults are resolved (Design uses Khalid, BE uses Hamid Shahin)', des.includes('Khalid') && !des.includes('Khalid Abdelfattah') && beP.includes('Hamid Shahin'));
  ok('resources: saved lanes are left exactly as saved', cap.resolveDefaults({ lanes: [{ k: 'be', people: ['Hamid'] }] }, RS).lanes.find(l => l.k === 'be').people.join() === 'Hamid');
  const um = cap.unmatched(rd, RS); ok('resources: names Resources does not list are reported', um.some(x => x.name === 'Altramsi') && !um.some(x => x.name === 'Saad'));
  ok('PMs are not a Dashboard track and their old points are ignored', !cap.LANES.some(l => l.k === 'pm') && cap.totalPts({ pts: { be: 3, pm: 5 } }) === 3 && Object.keys(cap.personLoads([{ pts: { be: 2, pm: 5 }, who: { pm: { Asmaa: 5 }, be: { Hamid: 2 } } }])).join() === 'Hamid');
}
// ---- version history (features/month-history.js)
{
  const h = await import('../src/esm/features/month-history.js');
  const L = (id, t) => ({ id, t }), mk = (ids, ts) => ({ mo: '2026-11', ts, by: 'Admin', lines: ids.map(i => L(i, 'card ' + i)) });
  ok('history: ids of versions are recognised and are not month ids', h.isHistId('mohist202611_123') && !h.isHistId('mo202611') && !h.isHistId('mobacklog') && h.histId('2026-11', 5, false, 0) === 'mohist202611_a0');
  ok('history: no version when nothing is stored or the month is empty', h.snapReason(null, mk(['a']), 0, 10) === '' && h.snapReason(mk([], 5), mk(['a']), 0, 10) === '');
  ok('history: the first version is kept, then one per 10 minutes of activity', h.snapReason(mk(['a'], 1000), mk(['a', 'b']), 0, 2000) === 'time' && h.snapReason(mk(['a'], 1000 + 5 * 60000), mk(['a']), 1000, 9e9) === '' && h.snapReason(mk(['a'], 1000 + 10 * 60000), mk(['a']), 1000, 9e9) === 'time');
  ok('history: a save that drops 3 cards always keeps a version, 2 cards does not force one', h.snapReason(mk(['a', 'b', 'c', 'd'], 1000), mk(['a']), 1000, 1500) === 'shrink' && h.snapReason(mk(['a', 'b', 'c'], 1000), mk(['a']), 1000, 1500) === '');
  const v = Object.assign({ id: 'x' }, h.makeVersion('2026-11', mk(['a', 'b', 'c'], 777), false, '', 'me', 999).v), cur = mk(['b', 'c', 'd'], 800); cur.lines[1].t = 'card c EDITED';
  const cmp = h.compare(v, cur);
  ok('history: compare finds missing, added and changed cards', cmp.missing.length === 1 && cmp.missing[0].t === 'card a' && cmp.newer.length === 1 && cmp.newer[0].t === 'card d' && cmp.changed.length === 1 && cmp.changed[0].t === 'card c EDITED');
  const bb = h.bringBack(cur, v);
  ok('history: bring back adds only the missing cards and changes nothing else', bb.lines.map(l => l.id).join() === 'b,c,d,a' && bb.lines.find(l => l.id === 'c').t === 'card c EDITED');
  const rs = h.restoreOf(cur, v);
  ok('history: restore makes the month like the version', rs.lines.map(l => l.id).join() === 'a,b,c' && rs.lines.find(l => l.id === 'c').t === 'card c' && rs.mo === '2026-11');
  const slots = n => Array.from({ length: n }, (_, i) => ({ id: 'mohist202611_a' + i, at: 100 - i, named: false })).concat([{ id: 'mohist202611_nx1', at: 1, named: true }]).sort((a, b) => b.at - a.at);
  ok('history: automatic versions use the first free slot, then overwrite the oldest one (nothing is deleted)', h.autoSlot([]) === 0 && h.autoSlot(slots(3)) === 3 && h.autoSlot(slots(15)) === 14 && h.autoSlot(slots(14)) === 14 && h.histId('2026-11', 9, false, 4) === 'mohist202611_a4');
  ok('history: a version written but not yet sent back stays in the list for 30 seconds', Object.keys(h.keepPendingHist({}, { k: { _p: Date.now() }, old: { _p: Date.now() - 60000 } })).join() === 'k');
}
// ---- new capacity default: 1 point = 4 hours, 20 days x 8 h = 160 h = 40 points, less 20% support and 10% buffer = 28 points = 112 h
{
  const R2 = { a: '2026-11-01', b: '2026-11-30' };
  ok('points are hours / 4 and a person has 40 points a month by default', cap.HOURS_PER_POINT === 4 && cap.DEFAULTS.ppp === 40 && cap.DEFAULTS.reserve === 0.2 && cap.DEFAULTS.buffer === 0.1);
  ok('a person can take 28 points = 112 hours after support and buffer', Math.abs(cap.personCap('Soliman', R2, [], {}) - 28) < 1e-9 && Math.abs(cap.personCap('Soliman', R2, [], {}) * cap.HOURS_PER_POINT - 112) < 1e-9);
  ok('the capacity does not depend on how many weekdays the month has (Oct 23 days, Nov 22 days)', cap.personCap('Soliman', { a: '2026-10-01', b: '2026-10-31' }, [], {}) === cap.personCap('Soliman', R2, [], {}));
  ok('the point list offers 1, 2, 3, 5, 8, 13 and 21', cap.SCALE.join() === '0,1,2,3,5,8,13,21');
}
// ---- a person only gets points from tracks the card still has points on, and the cards behind a load can be listed
{
  const ls = [{ id: 'a', t: 'Billing', pts: { be: 8 }, who: { be: { Soliman: 8 } } }, { id: 'b', t: 'Ghost', pts: null, who: { be: { Soliman: 13 } } }, { id: 'c', t: 'Wallet', pts: { be: 3, fe: 0 }, who: { be: { Soliman: 3 }, fe: { Soliman: 5 } } }];
  ok('person loads: points left in `who` after the card lost its track points are ignored', cap.personLoads(ls).Soliman === 11);
  ok('person cards: lists the cards behind the load, biggest first', JSON.stringify(cap.personCards(ls, 'Soliman').map(c => c.t + ':' + c.pts)) === '["Billing:8","Wallet:3"]');
}
