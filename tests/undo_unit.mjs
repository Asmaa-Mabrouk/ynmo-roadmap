import { createUndo } from '../src/esm/features/undo-stack.js';
const ok = (n, c) => console.log((c ? 'PASS ' : 'FAIL ') + n);
const db = { a: { t: 'one' } }, apply = (id, d) => { if (d) db[id] = d; else delete db[id]; };
const u = createUndo(3);
u.rec('a', db.a, { t: 'two' }); db.a = { t: 'two' }; u.rec('b', null, { t: 'new' }); db.b = { t: 'new' };
await Promise.resolve();
ok('changes in one action form one step', u.canUndo() && u.nextUndo() === 'Edit');
let r = u.step('undo', id => db[id], apply); ok('undo reverts both', r.done === 2 && db.a.t === 'one' && !db.b && u.canRedo());
r = u.step('redo', id => db[id], apply); ok('redo re-applies', r.done === 2 && db.a.t === 'two' && db.b.t === 'new');
db.a = { t: 'edited by someone else' };
r = u.step('undo', id => db[id], apply); ok("undo never overwrites someone else's change", r.skipped === 1 && r.done === 1 && db.a.t === 'edited by someone else' && !db.b);
for (let i = 0; i < 5; i++) { u.mark('step ' + i); u.rec('c', { t: i }, { t: i + 1 }); await Promise.resolve(); }
let n = 0; while (u.canUndo()) { u.step('undo', () => ({ t: 999 }), () => {}); n++; if (n > 10) break; }
ok('history is capped (limit 3)', n <= 3);
const v = createUndo(); v.rec('x', null, { t: 1 }); await Promise.resolve(); v.clear(); ok('clear empties both stacks', !v.canUndo() && !v.canRedo());
const w = createUndo(); w.rec('x', { t: 1 }, { t: 1 }); await Promise.resolve(); ok('no-op changes are not recorded', !w.canUndo());
