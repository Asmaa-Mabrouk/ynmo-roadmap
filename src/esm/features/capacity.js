/**
 * @module features/capacity
 * Monthly capacity in points, per role (lane). Pure functions: no state, no DOM.
 * A card carries points per role (`l.pts = {fe: 5, be: 3}`); a month has a capacity per role from the people in that role,
 * their leave in the month, a points-per-person figure, and a reserve (bugs, support) plus a buffer.
 * `needs` on a card (the internal id of another card) says that card must be planned in the same month or earlier.
 */

/** Roles and the people available in them (November 2026 list from the owner). Editable in the app (settings doc `capacity`). */
export const LANES = [
  { k: 'ai', n: 'AI', people: ['Altramsi', 'Aliaa', 'Shady'] },
  { k: 'fe', n: 'Full Stack FE', people: ['Amal', 'Sayeh', 'Abdelhamid'] },
  { k: 'mob', n: 'Full Stack Mobile', people: ['Aya Fathy', 'Adnan'] },
  { k: 'be', n: 'BE', people: ['Soliman', 'Wardany', 'Hosieny', 'Hamid'] },
  { k: 'pm', n: 'PMs', people: ['Asmaa', 'Engy', 'Emad', 'Khalid'] },
  { k: 'des', n: 'Design', people: ['Saad', 'Khalid'] },
  { k: 'qa', n: 'Quality', people: ['Mona', 'Dina Mousa', 'Zahran', 'Dina Sam'] }
];
/** Points one person delivers in a month before the reserve; reserve and buffer are shares of the total kept free. */
export const DEFAULTS = { ppp: 8, reserve: 0.2, buffer: 0.1 };
/** Allowed point values for one role of one card. */
export const SCALE = [0, 1, 2, 3, 5, 8, 13];

const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Working days (Sunday to Thursday) from a to b, both ISO dates, inclusive. */
export function workdays(a, b) { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) { const w = new Date(d + 'T00:00:00Z').getUTCDay(); if (w !== 5 && w !== 6) n++; } return n; }
const fold = s => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
/** Does a leave entry's person name (often the full name) belong to this first name or short name? */
export const sameName = (leaveName, name) => { const a = fold(leaveName), b = fold(name); return !!a && !!b && (a === b || a.startsWith(b + ' ') || b.startsWith(a + ' ')); };
/** Working days a person is on leave inside [a, b]. vacs: [{p, a0, a1}] */
export function leaveDays(vacs, name, a, b) {
  let n = 0; (vacs || []).forEach(v => { if (!sameName(v.p, name) || !v.a0) return; const s = v.a0 > a ? v.a0 : a, e = (v.a1 || v.a0) < b ? (v.a1 || v.a0) : b; if (s <= e) n += workdays(s, e); });
  return n;
}
/** Settings with defaults filled in. cfg may hold {ppp, reserve, buffer, lanes:[{k, people:[...]}]} */
export function settings(cfg) {
  const c = cfg || {}, byK = {}; (c.lanes || []).forEach(x => { if (x && x.k && Array.isArray(x.people)) byK[x.k] = x.people.map(String).filter(Boolean); });
  const num = (v, d, lo, hi) => { const n = +v; return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
  return { ppp: num(c.ppp, DEFAULTS.ppp, 0, 100), reserve: num(c.reserve, DEFAULTS.reserve, 0, 0.9), buffer: num(c.buffer, DEFAULTS.buffer, 0, 0.9), lanes: LANES.map(l => ({ k: l.k, n: l.n, people: byK[l.k] || l.people })) };
}
/** Plannable points of one role in a month: people x points each, less their leave, less reserve and buffer. */
export function laneCapacity(lane, range, vacs, cfg) {
  const s = settings(cfg), wd = Math.max(1, workdays(range.a, range.b)); let raw = 0;
  (lane.people || []).forEach(p => { raw += s.ppp * Math.max(0, 1 - leaveDays(vacs, p, range.a, range.b) / wd); });
  return { people: (lane.people || []).length, raw: Math.round(raw * 10) / 10, cap: Math.round(raw * (1 - s.reserve - s.buffer) * 10) / 10 };
}
export const ptsOf = (l, k) => Math.max(0, +(l && l.pts && l.pts[k]) || 0);
export const totalPts = l => Object.keys((l && l.pts) || {}).reduce((a, k) => a + ptsOf(l, k), 0);
/** Points of each role used by a list of cards: {ai: 3, fe: 5, ...} */
export function loads(lines) { const out = {}; LANES.forEach(l => { out[l.k] = 0; }); (lines || []).forEach(x => LANES.forEach(l => { out[l.k] += ptsOf(x, l.k); })); return out; }
/** ok / warn (above 90%) / over. A role with no capacity and no points is ok. */
export const statusOf = (used, cap) => used > cap + 1e-9 ? 'over' : cap > 0 && used >= cap * 0.9 ? 'warn' : 'ok';
/** Roles that would go over capacity when `line` joins a month that already holds `lines`. [{k, n, used, cap}] */
export function overAfter(line, lines, range, vacs, cfg) {
  const s = settings(cfg), base = loads((lines || []).filter(x => x.id !== line.id)), out = [];
  s.lanes.forEach(l => { const add = ptsOf(line, l.k); if (!add) return; const cap = laneCapacity(l, range, vacs, cfg).cap, used = base[l.k] + add; if (used > cap + 1e-9) out.push({ k: l.k, n: l.n, used: used, cap: cap }); });
  return out;
}
/** Order problems when `line` is placed in month `to`. monthOf(id) gives the month of another card ('' if unknown/backlog).
 *  needsOf: cards that need this one. Returns plain sentences. */
export function dependencyProblems(line, to, monthOf, labelOf, dependants) {
  const out = [];
  if (line.needs) { const pm = monthOf(line.needs); if (!pm) out.push('It needs ' + labelOf(line.needs) + ', which is not planned in a month yet.'); else if (pm > to) out.push('It needs ' + labelOf(line.needs) + ', which is planned later (' + pm + ').'); }
  (dependants || []).forEach(d => { const dm = monthOf(d.id); if (dm && dm < to) out.push(labelOf(d.id) + ' needs this card and is planned earlier (' + dm + ').'); });
  return out;
}
