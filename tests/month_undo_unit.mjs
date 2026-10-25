import { diffDoc, undoChanges } from '../src/esm/features/month-undo.js';
const ok = (n, c) => console.log((c ? 'PASS ' : 'FAIL ') + n);
const L = (id, t, o) => Object.assign({ id, t, k: 'tifli', pct: 0 }, o);
const doc = ls => ({ mo: '2026-10', status: 'submitted', lines: ls });
const ids = d => d.lines.map(l => l.id).join();
// add
let a = doc([L('a', 'A')]), b = doc([L('a', 'A'), L('b', 'B')]);
let ch = diffDoc(a, b);
ok('adding a card is one change', ch.length === 1 && ch[0].t === 'add' && ch[0].lid === 'b');
// my add undone, while a colleague added c meanwhile
let cur = doc([L('a', 'A'), L('b', 'B'), L('c', 'C')]);
let r = undoChanges(cur, ch, '2026-10');
ok('undo removes only my card and keeps the colleague\'s', ids(r.doc) === 'a,c' && r.applied === 1);
// delete
ch = diffDoc(doc([L('a', 'A'), L('b', 'B'), L('c', 'C')]), doc([L('a', 'A'), L('c', 'C')]));
r = undoChanges(doc([L('a', 'A'), L('c', 'C'), L('d', 'D')]), ch, '2026-10');
ok('undo of a delete puts the card back in its place', ids(r.doc) === 'a,b,c,d' && r.doc.lines[1].t === 'B');
r = undoChanges(doc([L('a', 'A'), L('b', 'B')]), ch, '2026-10');
ok('a card that is already back is not duplicated', ids(r.doc) === 'a,b' && r.skipped === 1);
// field change
ch = diffDoc(doc([L('a', 'A', { pct: 0 })]), doc([L('a', 'A', { pct: 40, pe: true })]));
ok('a field change records only the fields that changed', ch.length === 1 && ch[0].keys.sort().join() === 'pct,pe');
r = undoChanges(doc([L('a', 'A', { pct: 40, pe: true, hp: true })]), ch, '2026-10');
ok('undo restores my fields (and removes a field that did not exist) and keeps what a colleague set on the card', r.doc.lines[0].pct === 0 && !('pe' in r.doc.lines[0]) && r.doc.lines[0].hp === true);
r = undoChanges(doc([L('a', 'A', { pct: 70, pe: true })]), ch, '2026-10');
ok('if a colleague changed the same field since, their value stays', r.doc.lines[0].pct === 70 && r.skipped >= 1);
r = undoChanges(doc([L('z', 'Z')]), ch, '2026-10');
ok('if the card is gone, nothing happens', r.applied === 0 && ids(r.doc) === 'z');
// order
ch = diffDoc(doc([L('a', 'A'), L('b', 'B'), L('c', 'C')]), doc([L('c', 'C'), L('a', 'A'), L('b', 'B')]));
ok('a move inside a column is an order change', ch.some(c => c.t === 'order'));
r = undoChanges(doc([L('c', 'C'), L('x', 'X'), L('a', 'A'), L('b', 'B')]), ch, '2026-10');
ok('undo restores the relative order and leaves the colleague\'s card where it is', ids(r.doc) === 'a,x,b,c' || ids(r.doc) === 'a,b,x,c' || ids(r.doc) === 'a,x,b,c');
// month-level notes
ch = diffDoc(doc([]), Object.assign(doc([]), { notes: [{ id: 'n1', t: 'hi' }] }));
ok('month notes are a meta change', ch.length === 1 && ch[0].t === 'meta');
r = undoChanges(Object.assign(doc([]), { notes: [{ id: 'n1', t: 'hi' }] }), ch, '2026-10');
ok('undo removes my month note', !('notes' in r.doc));
r = undoChanges(Object.assign(doc([]), { notes: [{ id: 'n1', t: 'hi' }, { id: 'n2', t: 'theirs' }] }), ch, '2026-10');
ok('but not when a colleague added another note meanwhile', r.doc.notes.length === 2 && r.skipped >= 1);
// month delete
ch = diffDoc(doc([L('a', 'A')]), null);
r = undoChanges(null, ch, '2026-10');
ok('undo of a deleted month brings it back', r.doc && ids(r.doc) === 'a');
r = undoChanges(doc([L('q', 'Q')]), ch, '2026-10');
ok('but not over a month somebody has created since', ids(r.doc) === 'q' && r.applied === 0);
ok('no change, no record', diffDoc(a, JSON.parse(JSON.stringify(a))).length === 0);
