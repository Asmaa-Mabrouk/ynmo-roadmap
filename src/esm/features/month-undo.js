/**
 * @module features/month-undo
 * Undo for the Monthly board that only takes back the person's OWN changes. Instead of putting an old copy of a whole month back (which would also wipe what
 * colleagues did meanwhile), every save is compared with the previous version and recorded as small changes: card added, card deleted, fields of a card changed,
 * order changed, fields of the month changed (its notes), month deleted. Undoing applies the opposite of each change to the CURRENT version, and leaves alone
 * anything a colleague has touched since (a field they changed, a card they deleted). Pure functions (no DOM) so they can be tested with plain Node.
 */
const SKIP = new Set(['lines', 'by', 'ts', 'subAt', 'subBy', 'status', 'pl', 'mo']);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pick = (o, keys) => { const r = {}; keys.forEach(k => { if (o && k in o) r[k] = o[k]; }); return r; };
const clone = o => JSON.parse(JSON.stringify(o));
const changedKeys = (a, b, skip) => [...new Set(Object.keys(a || {}).concat(Object.keys(b || {})))].filter(k => !(skip && skip.has(k)) && !same(a && a[k], b && b[k]));

/** What changed between two versions of a month doc (`nw` null = the month was deleted). */
export function diffDoc(old, nw) {
  if (!nw) return old ? [{ t: 'doc', before: clone(old) }] : [];
  const ol = (old && old.lines) || [], nl = nw.lines || [], om = new Map(ol.map(l => [l.id, l])), nm = new Map(nl.map(l => [l.id, l])), out = [];
  ol.forEach((l, i) => { if (!nm.has(l.id)) out.push({ t: 'del', lid: l.id, before: clone(l), next: ol[i + 1] ? ol[i + 1].id : null }); });
  nl.forEach(l => {
    const o = om.get(l.id); if (!o) { out.push({ t: 'add', lid: l.id }); return; }
    const ks = changedKeys(o, l); if (ks.length) out.push({ t: 'mod', lid: l.id, keys: ks, before: clone(pick(o, ks)), after: clone(pick(l, ks)) });
  });
  const co = ol.filter(l => nm.has(l.id)).map(l => l.id), cn = nl.filter(l => om.has(l.id)).map(l => l.id);
  if (!same(co, cn)) out.push({ t: 'order', ids: co });
  const mk = changedKeys(old, nw, SKIP); if (old && mk.length) out.push({ t: 'meta', keys: mk, before: clone(pick(old, mk)), after: clone(pick(nw, mk)) });
  return out;
}

/** Applies the opposite of `changes` to the current doc. Returns { doc, applied, skipped } (doc is null when the month is removed). */
export function undoChanges(cur, changes, mo) {
  let applied = 0, skipped = 0;
  if (changes.length === 1 && changes[0].t === 'doc') { if (cur) return { doc: cur, applied: 0, skipped: 1 }; return { doc: clone(changes[0].before), applied: 1, skipped: 0 }; }
  const d = cur ? clone(cur) : { mo, lines: [] }; d.lines = d.lines || [];
  changes.slice().reverse().forEach(c => {
    if (c.t === 'add') { const i = d.lines.findIndex(l => l.id === c.lid); if (i >= 0) { d.lines.splice(i, 1); applied++; } else skipped++; }
    else if (c.t === 'del') {
      if (d.lines.some(l => l.id === c.lid)) { skipped++; return; }
      const i = c.next ? d.lines.findIndex(l => l.id === c.next) : -1; if (i >= 0) d.lines.splice(i, 0, clone(c.before)); else d.lines.push(clone(c.before)); applied++;
    } else if (c.t === 'mod') {
      const l = d.lines.find(x => x.id === c.lid); if (!l) { skipped++; return; }
      c.keys.forEach(k => { if (!same(l[k], c.after[k])) { skipped++; return; } if (k in c.before) l[k] = clone(c.before[k]); else delete l[k]; applied++; });
    } else if (c.t === 'order') {
      const pos = []; d.lines.forEach((l, i) => { if (c.ids.includes(l.id)) pos.push(i); });
      const present = c.ids.filter(id => d.lines.some(l => l.id === id)), byId = new Map(d.lines.map(l => [l.id, l]));
      if (present.length === pos.length && present.length > 1) { const before = d.lines.map(l => l.id).join(); present.forEach((id, k) => { d.lines[pos[k]] = byId.get(id); }); if (d.lines.map(l => l.id).join() !== before) applied++; } else skipped++;
    } else if (c.t === 'meta') {
      c.keys.forEach(k => { if (!same(d[k], c.after[k])) { skipped++; return; } if (k in c.before) d[k] = clone(c.before[k]); else delete d[k]; applied++; });
    }
  });
  return { doc: d, applied, skipped };
}
