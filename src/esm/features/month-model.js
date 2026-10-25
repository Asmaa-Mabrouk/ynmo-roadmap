/**
 * @module features/month-model
 * Pure logic of the Monthly deliverables board (no DOM, no network): the month a week belongs to, progress, the tags with their colours and
 * abbreviations, the tracking id of a card (DC#12) and the plain-text export.
 * A month is the doc `reports/mo<yyyymm>`: { mo:'2026-10', status:'submitted', pl:[{k,n,squads}],
 *   lines:[{ id, no (card number), k (tag key), t, pct (0-100), hp (business priority), sz ('quick'|'enh'), note, rid + rm (the roadmap bar made from the card), adhoc, w, src (older cards synced from the roadmap) }], by, ts, subAt, subBy } }.
 * It lives in the `reports` table; the board always saves a month as `submitted`, so executives (viewers) see every month.
 */
export const WEIGHTS = { 1: 'Normal', 2: 'High', 3: 'Critical' };
export const PCT_STEPS = [0, 25, 50, 75, 100];
const uid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const clampPct = v => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
/** Colour band of a percentage: nothing yet (grey), 1-50 yellow, 51-99 orange, 100 green. */
export const pctBand = v => { v = clampPct(v); return v >= 100 ? 'g' : v > 50 ? 'o' : v > 0 ? 'y' : 'n'; };
const addD = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export const isMonth = m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m || '');
export const monthId = m => 'mo' + m.replace('-', '');
/** The month a weekly report belongs to: the month of the middle of its week (a week that straddles two months counts for the larger part). */
export const monthOf = weekStart => addD(weekStart, 3).slice(0, 7);
export const monthLabel = m => isMonth(m) ? new Date(m + '-01T00:00:00Z').toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
export const prevMonth = m => { const d = new Date(m + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };
export const nextMonth = m => { const d = new Date(m + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 7); };
/** First and last day (ISO) of a month. */
export function monthRange(m) { const a = m + '-01'; return { a: a, b: addD(nextMonth(m) + '-01', -1) }; }

export function newLine(k, t, o) {
  o = o || {};
  return { id: uid(), k: k, t: String(t || '').replace(/\s+/g, ' ').trim().slice(0, 300), pct: 0, w: 1, adhoc: !!o.adhoc, by: String(o.by || '').replace(/\s+/g, ' ').trim().slice(0, 80), at: o.at || '', src: o.src || '', pe: false };
}
const live = ls => (ls || []).filter(l => String(l.t || '').trim());
/** Weighted percent of the planned (not ad hoc) deliverables: { pct, n, done }. Empty list: pct = null. */
export function monthProgress(lines) {
  const pl = live(lines).filter(l => !l.adhoc); if (!pl.length) return { pct: null, n: 0, done: 0 };
  const w = pl.reduce((a, l) => a + (l.w || 1), 0), s = pl.reduce((a, l) => a + (l.w || 1) * clampPct(l.pct), 0);
  return { pct: Math.round(s / w), n: pl.length, done: pl.filter(l => clampPct(l.pct) >= 100).length };
}
export function adhocStats(lines) { const a = live(lines).filter(l => l.adhoc); return { n: a.length, done: a.filter(l => clampPct(l.pct) >= 100).length }; }

/** The tags of the Monthly board, in the order of the dropdown. `squads` = the roadmap squads that sync into the tag. */
export const TAGS = [
  { k: 'daycare', n: 'Daycare', ab: 'DC', c: '#d6338a', squads: ['daycare'] },
  { k: 'tifli', n: 'Tifli', ab: 'TF', c: '#6d48a8', squads: ['tifli'] },
  { k: 'plan', n: 'Plan', ab: 'PL', c: '#0d8560', squads: ['plan'] },
  { k: 'ai', n: 'AI', ab: 'AI', c: '#2f6fe0', squads: ['ai'] },
  { k: 'finance', n: 'Finance', ab: 'FN', c: '#7b8099', squads: [] },
  { k: 'initiative', n: 'New initiative', ab: 'NI', c: '#d9a400', squads: [] }
];
/** Tag of a card made before the tags were split: the old combined Plan / Daycare card becomes Plan (or the tag of its roadmap squad when known). */
export const legacyTag = (k, squad) => { const t = TAGS.find(x => squad && x.squads.includes(squad)); return t ? t.k : k === 'plan_daycare' ? 'plan' : TAGS.some(x => x.k === k) ? k : 'initiative'; };
/** Tracking id of a card: the abbreviation of its tag and its number, e.g. DC#12 (the number never changes, the abbreviation follows the tag). '' for a card without a number yet. */
export const cardId = l => { if (!l || !l.no) return ''; const t = TAGS.find(x => x.k === l.k); return (t ? t.ab : String(l.k || '??').slice(0, 2).toUpperCase()) + '#' + l.no; };
export const SIZES = { quick: 'Quick win', enh: 'Small enhancement' };
/** Flags of a card as text: business priority, and a small piece of work (quick win / enhancement). */
const tagsOf = l => (l.hp ? ' [BUSINESS PRIORITY]' : '') + (SIZES[l.sz] ? ' [' + SIZES[l.sz].toUpperCase() + ']' : '');
/** Plain text of a month (for Copy text). `products` = [{k,n}]. Empty when there is nothing to show. */
export function monthText(doc, products, fmt) {
  if (!doc || !live(doc.lines).length) return [];
  const prog = monthProgress(doc.lines), out = ['MONTHLY DELIVERABLES - ' + monthLabel(doc.mo) + (prog.pct === null ? '' : ' - ' + prog.pct + '% complete (' + prog.done + ' of ' + prog.n + ' done)'), ''];
  (products || doc.pl || []).forEach(p => {
    const its = live(doc.lines).filter(l => l.k === p.k); if (!its.length) return;
    const pl = its.filter(l => !l.adhoc), ad = its.filter(l => l.adhoc), pp = monthProgress(pl);
    out.push(p.n + (pp.pct === null ? '' : ' - ' + pp.pct + '%'));
    pl.forEach(l => { out.push('- ' + (cardId(l) ? cardId(l) + ' ' : '') + l.t + ': ' + clampPct(l.pct) + '%' + tagsOf(l)); if (l.note) out.push('  Note: ' + String(l.note).replace(/\s+/g, ' ')); });
    if (ad.length) { out.push('Ad hoc requests:'); ad.forEach(l => out.push('- ' + l.t + (l.by ? ' (requested by ' + l.by + (l.at && fmt ? ', ' + fmt(l.at) : '') + ')' : '') + ': ' + clampPct(l.pct) + '%')); }
    out.push('');
  });
  return out;
}
