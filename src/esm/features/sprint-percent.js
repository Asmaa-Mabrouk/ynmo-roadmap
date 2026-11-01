/**
 * @module features/sprint-percent
 * Completion percentage of sprint items and the proposals they make for the Monthly cards (pure functions, no DOM).
 * A sprint item (scope) has its own percent `pc` (0-100); a scope with sub-sections takes the average of them. A scope is linked to a Monthly
 * card by `fid` (the card's internal id) or, when it has no link, matched by the same words as the card title (shown as "matched by words"
 * and not ticked by default). The proposal for a card is the average percent of its items over the sprints of the card's month.
 */
import { norm, toks } from './sprint-cover.js';
import { clampPct, monthRange, cardId } from './month-model.js';

/** Percent of one item: 100 when it is done, else its own number (0 when none). */
export const itemPct = i => (i && i.st === 'done' ? 100 : Number.isFinite(i && i.pc) ? clampPct(i.pc) : 0);
/** Percent of a scope given its sub-sections (the average of them), or its own when it has none. */
export const scopePct = (scope, kids) => (kids && kids.length ? Math.round(kids.reduce((a, k) => a + itemPct(k), 0) / kids.length) : itemPct(scope));
/** Status that goes with a percent (done at 100; started when above 0 and still planned; planned again when it falls from done). */
export function statusFor(st, pc) {
  if (pc >= 100) return 'done';
  if (st === 'done') return pc > 0 ? 'progress' : 'planned';
  return pc > 0 && (!st || st === 'planned') ? 'progress' : st || 'planned';
}
/** Stricter than the coverage check (a short title that is part of a longer one does not count): the same text, or 3 of 4 words with at least two words each. */
export function sameTitle(a, b) {
  const x = norm(a), y = norm(b); if (!x || !y) return false; if (x === y) return true;
  const A = toks(a), B = toks(b); if (A.length < 2 || B.length < 2) return false;
  const [sm, lg] = A.length <= B.length ? [A, B] : [B, A]; return sm.filter(w => lg.includes(w)).length / sm.length >= 0.75;
}
const overlaps = (sp, r) => sp.a <= r.b && sp.b >= r.a;

/**
 * @param {Array<{id,n,a,b}>} sprints
 * @param {(spId:string)=>Array} itemsOf flat items of a sprint (id, t, par, pc, st, fid, kind)
 * @param {Array<{did:string, mo:string, l:object}>} cards Monthly cards with their month doc id and month
 * @returns {Array<{did, mo, card, from, to, down, items:[{t, pc, n, auto}], auto}>} only cards whose percent would change
 */
export function proposals(sprints, itemsOf, cards) {
  const per = (sprints || []).map(sp => { const all = itemsOf(sp.id) || [], ids = new Set(all.map(i => i.id)), kids = {}, tops = []; all.forEach(i => { if (i.par && ids.has(i.par)) (kids[i.par] = kids[i.par] || []).push(i); else tops.push(i); });
    const ent = []; tops.forEach(t => ent.push({ id: t.id, t: t.t, pc: scopePct(t, kids[t.id]), fid: t.fid || '', kind: t.kind, n: sp.n, sp: sp }));
    Object.keys(kids).forEach(k => kids[k].forEach(c => { if (c.fid) ent.push({ id: c.id, t: c.t, pc: itemPct(c), fid: c.fid, kind: c.kind, n: sp.n, sp: sp }); }));
    return ent; });
  const all = [].concat(...per), out = [];
  (cards || []).forEach(c => {
    const r = c.mo ? monthRange(c.mo) : null, mine = [];
    all.forEach(e => {
      if (e.fid) { if (e.fid === c.l.id) mine.push({ t: e.t, pc: e.pc, n: e.n, auto: false }); return; }
      if (e.kind === 'feature' && r && overlaps(e.sp, r) && sameTitle(e.t, c.l.t)) mine.push({ t: e.t, pc: e.pc, n: e.n, auto: true });
    });
    if (!mine.length) return;
    const to = clampPct(Math.round(mine.reduce((a, x) => a + x.pc, 0) / mine.length)), from = clampPct(c.l.pct);
    if (to === from) return;
    out.push({ did: c.did, mo: c.mo, card: c.l, id: cardId(c.l), from: from, to: to, down: to < from, items: mine, auto: mine.every(x => x.auto) });
  });
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}
