/**
 * @module features/undo-stack
 * Undo / redo for a document (pure logic, no DOM). One stack belongs to ONE user on ONE sprint, so undo only ever reverts
 * that user's own changes. A step groups every change made in the same action. When someone else changed a line after the
 * user did, that line is skipped (never overwritten) and reported back.
 */
const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
const canon = d => (d ? Object.keys(d).sort().reduce((o, k) => (o[k] = d[k], o), {}) : null);

export function createUndo(limit) {
  const max = limit || 100; let undo = [], redo = [], open = null; const subs = new Set();
  const tell = () => subs.forEach(f => f());
  const finalize = step => { if (step.ops.length) { undo.push(step); if (undo.length > max) undo.shift(); redo = []; tell(); } };
  /** Everything recorded in the same synchronous action becomes one step (closed at the end of the current task's microtasks). */
  const begin = () => { if (!open) { const step = open = { label: 'Edit', ops: [] }; queueMicrotask(() => { if (open === step) { open = null; finalize(step); } }); } return open; };
  return {
    /** Name the step being recorded, e.g. "Delete 3 lines" (call before the changes). */
    mark(label) { if (label) begin().label = label; },
    /** Record one change: `before` / `after` are the whole doc (null = did not exist / was deleted). */
    rec(id, before, after) {
      if (same(canon(before), canon(after))) return;
      const o = begin(), prev = o.ops.find(x => x.id === id); if (prev) prev.after = after; else o.ops.push({ id: id, before: before, after: after });
    },
    canUndo: () => undo.length > 0, canRedo: () => redo.length > 0,
    nextUndo: () => (undo.length ? undo[undo.length - 1].label : ''), nextRedo: () => (redo.length ? redo[redo.length - 1].label : ''),
    clear() { undo = []; redo = []; open = null; tell(); },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    /**
     * Revert (dir 'undo') or re-apply (dir 'redo') the latest step.
     * @param {(id:string)=>object|undefined} current the doc as it is now
     * @param {(id:string, doc:object|null)=>void} apply write a doc (null = delete)
     * @returns {{label:string, done:number, skipped:number}|null}
     */
    step(dir, current, apply) {
      if (open) { const st = open; open = null; finalize(st); }
      const from = dir === 'undo' ? undo : redo, to = dir === 'undo' ? redo : undo; const s = from.pop(); if (!s) return null;
      let done = 0, skipped = 0;
      (dir === 'undo' ? s.ops.slice().reverse() : s.ops).forEach(o => {
        const want = dir === 'undo' ? o.after : o.before, then = dir === 'undo' ? o.before : o.after;
        if (!same(canon(current(o.id) || null), canon(want))) { skipped++; return; }
        apply(o.id, then); done++;
      });
      if (done) to.push(s); tell();
      return { label: s.label, done: done, skipped: skipped };
    }
  };
}
