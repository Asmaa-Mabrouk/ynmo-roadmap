/**
 * @module features/month-history
 * Version history of a month (pure functions, no DOM). A version is a copy of a month doc kept as the doc `reports/mohist<yyyymm>_<time>`
 * (the id starts with `mo`, so it follows the Monthly permissions; it has no `mo` field, so it is never taken for a month or a weekly report).
 * Automatic versions are made from what is stored on the server just before a save overwrites it: at most one every 10 minutes, and always when a save
 * would drop 3 or more cards. A month has 15 automatic slots (`mohist<yyyymm>_a0` to `_a14`): when all are used, the oldest slot is overwritten, so nothing is ever deleted (editors may add and change docs; only the highest level may delete, and a refused delete would make the app think the person is view-only). Named versions ("Save a version") are separate docs and are never replaced.
 */
import { diffDoc } from './month-undo.js';
export const GAP_MS = 10 * 60 * 1000, KEEP_AUTO = 15, SHRINK_AT = 3;
const KEEP_OUT = new Set(['by', 'ts', 'subAt', 'subBy', 'status', 'pl', 'mo']);
const clone = o => JSON.parse(JSON.stringify(o));
export const isHistId = id => /^mohist\d{6}_/.test(String(id));
export const histId = (m, at, named, slot) => 'mohist' + m.replace('-', '') + '_' + (named ? 'n' + Math.random().toString(36).slice(2, 6) + at : 'a' + slot);
export const cards = doc => ((doc && doc.lines) || []).filter(l => l && String(l.t || '').trim());
export const cardCount = doc => cards(doc).length;
/** Does saving `next` over the stored `srv` need a version of `srv` first? Returns '' (no), 'shrink' or 'time'. */
export function snapReason(srv, next, lastAt, now) {
  if (!srv || !Array.isArray(srv.lines) || !cardCount(srv)) return '';
  if (cardCount(srv) - cardCount(next) >= SHRINK_AT) return 'shrink';
  const at = +srv.ts || now; return !lastAt || at - lastAt >= GAP_MS ? 'time' : '';
}
/** The version doc kept for a stored month doc. */
export function makeVersion(m, doc, named, name, who, now, slot) {
  const at = named ? now : (+doc.ts || now), d = clone(doc);
  return { id: histId(m, at, named, slot || 0), v: { hist: 1, of: m, at: at, by: named ? who : (doc.by || ''), n: cardCount(doc), named: !!named, name: name || '', doc: d } };
}
/** The versions of one month, newest first. */
export const versionsOf = (hist, m) => Object.keys(hist || {}).filter(id => isHistId(id) && hist[id] && hist[id].of === m).map(id => Object.assign({ id: id }, hist[id])).sort((a, b) => b.at - a.at);
/** Automatic versions beyond the newest KEEP_AUTO (to delete). Named versions are never listed. */
/** The automatic slot to write next: the first unused one, else the slot of the oldest automatic version (it is overwritten). `list` = versionsOf(...), newest first. */
export function autoSlot(list) {
  const autos = list.filter(v => !v.named), used = new Map(autos.map(v => [+(/_a(\d+)$/.exec(v.id) || [])[1], v]));
  for (let i = 0; i < KEEP_AUTO; i++) if (!used.has(i)) return i;
  const oldest = autos[autos.length - 1]; return oldest ? +(/_a(\d+)$/.exec(oldest.id) || [0, 0])[1] : 0;
}
/** What differs between a version and the month as it is now. missing = cards the version has that are gone now; newer = cards added since; changed = same card, different content. */
export function compare(version, cur) {
  const ch = diffDoc(version.doc, cur || { lines: [] }), title = l => String((l && l.t) || '').trim() || '(no title)';
  const byId = new Map(((version.doc && version.doc.lines) || []).map(l => [l.id, l]));
  const now = new Map(((cur && cur.lines) || []).map(l => [l.id, l]));
  return {
    missing: ch.filter(c => c.t === 'del').map(c => ({ id: c.lid, t: title(c.before) })).filter(c => String((byId.get(c.id) || {}).t || '').trim()),
    newer: ch.filter(c => c.t === 'add').map(c => ({ id: c.lid, t: title(now.get(c.lid)) })).filter(c => String((now.get(c.id) || {}).t || '').trim()),
    changed: ch.filter(c => c.t === 'mod').map(c => ({ id: c.lid, t: title(now.get(c.lid)), keys: c.keys })),
  };
}
/** The month with the cards of `version` that are missing now added at the end; nothing else changes. */
export function bringBack(cur, version) {
  const d = clone(cur || { lines: [] }), have = new Set((d.lines || []).map(l => l.id)); d.lines = d.lines || [];
  ((version.doc && version.doc.lines) || []).forEach(l => { if (l && l.id && !have.has(l.id)) d.lines.push(clone(l)); });
  return d;
}
/** The month made like `version`: its cards and month fields (notes), keeping who saved it and when for the saver to set. */
export function restoreOf(cur, version) {
  const d = clone(cur || { lines: [] }), v = clone(version.doc || { lines: [] });
  Object.keys(d).forEach(k => { if (!KEEP_OUT.has(k) && !(k in v)) delete d[k]; });
  Object.keys(v).forEach(k => { if (!KEEP_OUT.has(k)) d[k] = v[k]; });
  d.lines = v.lines || []; return d;
}
/** "Mon 27 Oct 17:02" */
export function stampOf(at) {
  const d = new Date(at); if (isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
/** The history from the server, plus versions this screen just wrote that the server has not sent back yet (so a new version does not vanish for a moment). */
export function keepPendingHist(fresh, local) {
  const out = Object.assign({}, fresh), now = Date.now();
  Object.keys(local || {}).forEach(id => { const v = local[id]; if (v && v._p && !(id in out) && now - v._p < 30000) out[id] = v; });
  return out;
}
