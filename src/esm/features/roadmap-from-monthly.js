/**
 * @module features/roadmap-from-monthly
 * "Sync from Monthly" on the Gantt: which Monthly cards are not on this roadmap yet, with the people on them, and the bar each would become.
 * Pure: the dialog and the saving live in pages/monthly.js (`syncFromMonthly`). One bar per card; the people are the ones with points on the card
 * (`who`); the dates are the card's month, cut to the roadmap; the squad comes from the card's tag, else from the first person.
 */
import { whoPairs, monthRange, TAGS, clampPct, cardId } from './month-model.js';

/** Plan rows. `o` = { cards:[{did, mo, l}], rm:{a,b}, onRoad(l), laneKeys:[], sqOf(name) }. Each row = { did, mo, l, id, t, people, a, b, sq, pct, tick }. Sorted by first person, then month, then title. */
export function planRows(o) {
  const out = [];
  (o.cards || []).forEach(c => {
    const l = c.l; if (!l || !String(l.t || '').trim() || c.mo === 'backlog' || o.onRoad(l)) return;
    const r = monthRange(c.mo), a = r.a < o.rm.a ? o.rm.a : r.a, b = r.b > o.rm.b ? o.rm.b : r.b; if (b < a) return;
    const seen = new Set(), people = []; whoPairs(l).filter(x => x[1] > 0).forEach(x => { if (!seen.has(x[0])) { seen.add(x[0]); people.push(x[0]); } });
    const tag = TAGS.find(t => t.k === l.k), fromTag = tag && (tag.squads || []).find(k => o.laneKeys.includes(k));
    const sq = fromTag || (people.length ? o.sqOf(people[0]) : '') || o.laneKeys[0];
    const pct = clampPct(l.pct);
    out.push({ did: c.did, mo: c.mo, l: l, id: cardId(l), t: String(l.t).trim(), people: people, a: a, b: b, sq: sq, pct: pct, tick: pct < 100 });
  });
  const key = r => (r.people[0] || '￿').toLowerCase();
  return out.sort((x, y) => key(x).localeCompare(key(y)) || x.mo.localeCompare(y.mo) || x.t.localeCompare(y.t));
}

/** The roadmap item (S.over entry) a plan row becomes. `ord` = order inside its squad. */
export function barOf(row, rmId, ord, noteText) {
  return { custom: true, rm: rmId, t: row.t, n: noteText || '', sq: row.sq, pr: row.sq === 'ai' ? ['tifli'] : [row.sq], d0: row.k0, d1: row.k1, st: 'planned', pc: row.pct, res: row.people.slice(), ord: ord, card: row.l.id };
}
