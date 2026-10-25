/**
 * @module features/month-model
 * Pure logic of the Monthly deliverables board (no DOM, no network): the month a week belongs to, progress, the estimated percentage
 * of a roadmap feature, merging a month's roadmap features into its column without ever repeating a feature (a percentage a person typed always wins),
 * and the plain-text export.
 * A month is the doc `reports/mo<yyyymm>`: { mo:'2026-10', status:'draft'|'submitted', pl:[{k,n,squads}],
 *   lines:[{ id, k (product key), t, pct (0-100), w (importance 1-3), adhoc, by (who asked), at (date added), src (roadmap bar id), pe (percentage edited by a person) }], by, ts, subAt, subBy, syncAt }.
 * It lives in the `reports` table; the board always saves a month as `submitted`, so executives (viewers) see every month.
 */
export const WEIGHTS = { 1: 'Normal', 2: 'High', 3: 'Critical' };
export const PCT_STEPS = [0, 25, 50, 75, 100];
const uid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const clampPct = v => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
/** Colour band of a percentage: nothing yet (grey), 1-50 yellow, 51-99 orange, 100 green. */
export const pctBand = v => { v = clampPct(v); return v >= 100 ? 'g' : v > 50 ? 'o' : v > 0 ? 'y' : 'n'; };
const dayN = iso => Math.round(Date.parse(iso + 'T00:00:00Z') / 864e5);
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

/**
 * Estimated percentage of a roadmap feature { a, b (ISO dates), st, ms }: 100 when marked Done, otherwise the share of its days that have passed,
 * rounded to 5 and never above 90 until it is marked Done. A milestone has no duration, so it is 0 until it is Done. This is only a starting
 * point: a person edits it, and an edited percentage is never overwritten by a later sync.
 */
export function assumePct(bar, today) {
  if (bar.st === 'done') return 100;
  if (bar.ms) return 0;
  const len = dayN(bar.b) - dayN(bar.a) + 1; if (!(len >= 1)) return 0;
  const passed = Math.min(len, dayN(today) - dayN(bar.a) + 1); if (passed <= 0) return 0;
  return Math.min(90, Math.round(100 * passed / len / 5) * 5);
}
const norm = t => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** Identity of a deliverable: its product and its title (case, spacing and punctuation do not matter), so the same feature is never listed twice. */
export const lineKey = (k, t) => k + '|' + norm(t);
/**
 * Roadmap bars `road` = [{ id, t, sq, a, b, st, ms }] folded into ONE feature per product and title, however many bars or people it is written on:
 * { ids, t, k (product), a (first start), b (last end), st ('done' only when every bar is done), ms }. Bars of no product are counted in `skipped`.
 */
export function groupRoad(road, pl) {
  const g = new Map(); let skipped = 0;
  road.forEach(b => {
    const p = pl.find(q => (q.squads || []).includes(b.sq)); if (!p) { skipped++; return; }
    const key = lineKey(p.k, b.t), x = g.get(key);
    if (!x) g.set(key, { ids: [b.id], t: b.t, k: p.k, a: b.a, b: b.b, st: b.st, ms: !!b.ms });
    else { x.ids.push(b.id); if (b.a < x.a) x.a = b.a; if (b.b > x.b) x.b = b.b; if (b.st !== 'done') x.st = b.st; x.ms = x.ms && !!b.ms; }
  });
  return { features: [...g.values()], skipped: skipped };
}
/**
 * Brings the roadmap features of month `m` into the lines. A feature is a deliverable of the month it ENDS in, so it lands in exactly one month, and it is
 * never added twice: not when it is written on several bars or people, not when the product already has a card with the same title in this month or in any
 * other month (`others` = the lines of the other months). New features come with their estimated percentage; a line already linked to the feature (`src`)
 * gets a new estimate only if nobody edited its percentage. Everything else a person changed is kept. Returns { lines, added, updated, skipped, dup }.
 */
export function mergeRoad(lines, road, pl, m, today, others) {
  const out = lines.map(l => Object.assign({}, l)), bySrc = new Map(), have = new Set(), haveSrc = new Set();
  out.forEach(l => { if (l.src) bySrc.set(l.src, l); have.add(lineKey(l.k, l.t)); });
  (others || []).forEach(l => { have.add(lineKey(l.k, l.t)); if (l.src) haveSrc.add(l.src); });
  const g = groupRoad(road, pl); let added = 0, updated = 0, dup = 0;
  g.features.sort((x, y) => (x.a < y.a ? -1 : x.a > y.a ? 1 : String(x.t).localeCompare(String(y.t)))).forEach(f => {
    const pct = assumePct(f, today), ex = f.ids.map(i => bySrc.get(i)).find(Boolean);
    if (ex) { if (!ex.pe && clampPct(ex.pct) !== pct) { ex.pct = pct; updated++; } return; }
    if (f.b.slice(0, 7) !== m) return;
    if (have.has(lineKey(f.k, f.t)) || f.ids.some(i => haveSrc.has(i))) { dup++; return; }
    const n = newLine(f.k, f.t, { src: f.ids[0] }); n.pct = pct; out.push(n); have.add(lineKey(f.k, f.t)); added++;
  });
  return { lines: out, added: added, updated: updated, skipped: g.skipped, dup: dup };
}
/** Plain text of a month (for Copy text). `products` = [{k,n}]. Empty when there is nothing to show. */
export function monthText(doc, products, fmt) {
  if (!doc || !live(doc.lines).length) return [];
  const prog = monthProgress(doc.lines), out = ['MONTHLY DELIVERABLES - ' + monthLabel(doc.mo) + (prog.pct === null ? '' : ' - ' + prog.pct + '% complete (' + prog.done + ' of ' + prog.n + ' done)'), ''];
  (products || doc.pl || []).forEach(p => {
    const its = live(doc.lines).filter(l => l.k === p.k); if (!its.length) return;
    const pl = its.filter(l => !l.adhoc), ad = its.filter(l => l.adhoc), pp = monthProgress(pl);
    out.push(p.n + (pp.pct === null ? '' : ' - ' + pp.pct + '%'));
    pl.forEach(l => out.push('- ' + l.t + ': ' + clampPct(l.pct) + '%'));
    if (ad.length) { out.push('Ad hoc requests:'); ad.forEach(l => out.push('- ' + l.t + (l.by ? ' (requested by ' + l.by + (l.at && fmt ? ', ' + fmt(l.at) : '') + ')' : '') + ': ' + clampPct(l.pct) + '%')); }
    out.push('');
  });
  return out;
}
