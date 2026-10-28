/**
 * @module features/capacity
 * Monthly capacity in points, per role (lane). Tracks: AI, Full Stack FE, Full Stack Mobile, BE, Design, Quality (PMs are not planned on the Dashboard; old PM points on a card are ignored). Pure functions: no state, no DOM.
 * A card carries points per role (`l.pts = {fe: 5, be: 3}`); a month has a capacity per role from the people in that role,
 * their leave in the month, a points-per-person figure, and a reserve (bugs, support) plus a buffer.
 * `needs` on a card (the internal id of another card) says that card must be planned in the same month or earlier.
 */

/** Roles and the people available in them (November 2026 list from the owner). Editable in the app (settings doc `capacity`). */
export const LANES = [
  { k: 'ai', n: 'AI', people: ['Mohamed Altramsi', 'Aliaa Ibrahim', 'Shady Bassily'] },
  { k: 'fe', n: 'Full Stack FE', people: ['Amal Saleem', "Mo'men Sayeh", 'Abdelhamid Ali'] },
  { k: 'mob', n: 'Full Stack Mobile', people: ['Aya Fathy', 'Ahmed Adnan'] },
  { k: 'be', n: 'BE', people: ['Ahmed Soliman', 'Ahmed Wardany', 'Ahmed Hoseiny', 'Hamid Shahien'] },
  { k: 'des', n: 'Design', people: ['Saad Mohamed', 'Khalid Abdelfattah'] },
  { k: 'qa', n: 'Quality', people: ['Mona Mohamed', 'Dina Mousa', 'Mohamed Zahran', 'Dina Samy'] }
];
/** The Resources domain of each track: where a person of that track is listed in Resources. */
export const DOMAIN_OF = { ai: 'AI / ML', fe: 'Frontend', mob: 'Mobile', be: 'Backend', des: 'UX / Design', qa: 'QA' };
/** The name of the person in Resources (resources: [{name, domain}]) that `name` stands for, or ''.
 *  Exact match first; then a short name that starts a longer Resources name ("Hamid" for "Hamid Shahin"), told apart by the track's domain;
 *  a longer name for a shorter Resources name ("Khalid Nazim" for "Khalid") only when that person is listed in the track's domain. */
export function matchResource(name, resources, domain) {
  const f = fold(name), list = resources || [], exact = list.find(r => fold(r.name) === f); if (exact) return exact.name;
  const near = list.filter(r => sameName(r.name, name) && (fold(r.name).startsWith(f + ' ') || r.domain === domain));
  const pick = near.length > 1 ? near.filter(r => r.domain === domain) : near;
  return pick.length === 1 ? pick[0].name : '';
}
/** cfg with the people of every track spelled as Resources spells them (names Resources does not know stay as written). */
export function resolveDefaults(cfg, resources) {
  const s = settings(cfg), out = Object.assign({}, cfg || {});
  const saved = {}; ((cfg && cfg.lanes) || []).forEach(x => { if (x && x.k && Array.isArray(x.people)) saved[x.k] = true; });
  out.lanes = s.lanes.map(l => ({ k: l.k, people: (saved[l.k] ? l.people : l.people.map(n => matchResource(n, resources, DOMAIN_OF[l.k]) || n)).slice() }));
  return out;
}
/** The track a Resources domain belongs to ('' for PM, Full-stack, Engineering and Other: those are chosen by hand). */
export const trackOfDomain = d => Object.keys(DOMAIN_OF).find(x => DOMAIN_OF[x] === d) || '';
/** Names in the tracks that Resources does not list: [{k, track, name}] */
export function unmatched(cfg, resources) {
  const have = new Set((resources || []).map(r => fold(r.name))), out = [];
  settings(cfg).lanes.forEach(l => l.people.forEach(n => { if (!have.has(fold(n))) out.push({ k: l.k, track: l.n, name: n }); }));
  return out;
}
/** Points one person delivers in a month before the reserve; reserve and buffer are shares of the total kept free. */
/** One point is 4 hours. A person has 20 working days of 8 hours = 160 hours = 40 points a month; 20% support and 10% buffer come off (40 x 0.7 = 28 points = 112 hours). */
export const HOURS_PER_POINT = 4;
export const DEFAULTS = { ppp: 40, reserve: 0.2, buffer: 0.1 };
/** Allowed point values for one role of one card. */
export const SCALE = [0, 1, 2, 3, 5, 8, 13, 21];

export const addIso = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
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
/** Settings with defaults filled in. cfg may hold {ppp, reserve, buffer, lanes:[{k, people:[...]}], leaving:{name: 'YYYY-MM-DD'}}
 *  `leaving` is the last working day of someone who is leaving or has left. */
export function settings(cfg) {
  const c = cfg || {}, byK = {}; (c.lanes || []).forEach(x => { if (x && x.k && Array.isArray(x.people)) byK[x.k] = x.people.map(String).filter(Boolean); });
  const num = (v, d, lo, hi) => { const n = +v; return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
  const leaving = {}; Object.keys(c.leaving && typeof c.leaving === 'object' ? c.leaving : {}).forEach(n => { if (/^\d{4}-\d{2}-\d{2}$/.test(c.leaving[n])) leaving[n] = c.leaving[n]; });
  const part = {}; Object.keys(c.part && typeof c.part === 'object' ? c.part : {}).forEach(n => { const v = +c.part[n]; if (Number.isFinite(v) && v > 0 && v < 1) part[n] = Math.round(v * 100) / 100; });
  return { part: part, ppp: num(c.ppp, DEFAULTS.ppp, 0, 100), reserve: num(c.reserve, DEFAULTS.reserve, 0, 0.9), buffer: num(c.buffer, DEFAULTS.buffer, 0, 0.9), leaving: leaving, lanes: LANES.map(l => ({ k: l.k, n: l.n, people: byK[l.k] || l.people })) };
}
/** A standard month has 20 working days whatever the calendar says (so 1 working day = ppp / 20 = 2 points, 8 hours). */
export const STD_DAYS = 20;
/** Share of a full month a person works (1 = full time, 0.5 = half time), from the Dashboard settings (`part`). */
export const shareOf = (name, cfg) => { const p = settings(cfg).part; return p[name] || 1; };
/** Points one working day is worth. */
export const dayPts = cfg => settings(cfg).ppp / STD_DAYS;
/** What a person loses in a month: working days of leave (inside the days they still work) and the working days after their last day.
 *  Every lost working day costs the same: ppp / 20 points. */
export function lostInfo(name, range, vacs, cfg) {
  const s = settings(cfg), until = s.leaving[name], end = until && until < range.b ? until : range.b, base = s.ppp * (s.part[name] || 1);
  if (end < range.a) return { leave: 0, after: workdays(range.a, range.b), gone: true, pts: base, perDay: s.ppp / STD_DAYS, base: base };
  const leave = leaveDays(vacs, name, range.a, end), after = end < range.b ? workdays(addDays(end, 1), range.b) : 0, perDay = s.ppp / STD_DAYS;
  return { leave: leave, after: after, gone: false, pts: Math.min(base, (leave + after) * perDay), perDay: perDay, base: base };
}
/** Points one person can deliver in a month before reserve and buffer: ppp x their share (half time = 0.5), less 2 points (one 8-hour day = ppp / 20, the same for everybody) for every working day of leave or after their last working day. */
export function personRaw(name, range, vacs, cfg) {
  const s = settings(cfg), li = lostInfo(name, range, vacs, cfg);
  return li.gone ? 0 : Math.max(0, li.base - li.pts);
}
/** Points one person can be planned for in a month (after reserve and buffer). */
export function personCap(name, range, vacs, cfg) { const s = settings(cfg); return Math.round(personRaw(name, range, vacs, cfg) * (1 - s.reserve - s.buffer) * 10) / 10; }
/** Who works on a card in a role: {name: points}. */
export const whoOf = (l, k) => { const w = l && l.who && l.who[k]; return w && typeof w === 'object' ? w : {}; };
/** Points of each person over a list of cards, all roles together: {name: points}. */
export function personLoads(lines) { const out = {}; (lines || []).forEach(l => Object.keys((l && l.who) || {}).filter(k => LANES.some(x => x.k === k) && ptsOf(l, k) > 0).forEach(k => { const w = whoOf(l, k); Object.keys(w).forEach(n => { out[n] = (out[n] || 0) + Math.max(0, +w[n] || 0); }); })); return out; }
/** Which cards give a person their points: [{id, t, pts}] biggest first (same rule as personLoads). */
export function personCards(lines, name) { const out = []; (lines || []).forEach(l => { let p = 0; Object.keys((l && l.who) || {}).filter(k => LANES.some(x => x.k === k) && ptsOf(l, k) > 0).forEach(k => { p += Math.max(0, +whoOf(l, k)[name] || 0); }); if (p > 0) out.push({ id: l.id, t: String(l.t || '').trim() || '(no title)', pts: p }); }); return out.sort((a, b) => b.pts - a.pts); }
/** Plannable points of one role in a month: people x points each, less their leave, less the days after their last working day,
 *  less reserve and buffer. `people` counts those still working at some point of the month. */
export function laneCapacity(lane, range, vacs, cfg) {
  const s = settings(cfg); let raw = 0, here = 0, fte = 0;
  (lane.people || []).forEach(p => { const until = s.leaving[p]; if (until && until < range.a) return; here++; fte += s.part[p] || 1; raw += personRaw(p, range, vacs, cfg); });
  return { people: here, fte: Math.round(fte * 100) / 100, raw: Math.round(raw * 10) / 10, cap: Math.round(raw * (1 - s.reserve - s.buffer) * 10) / 10 };
}
export const ptsOf = (l, k) => Math.max(0, +(l && l.pts && l.pts[k]) || 0);
export const totalPts = l => LANES.reduce((a, x) => a + ptsOf(l, x.k), 0);
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

/** Where one person stands today: on leave now, next leave in the coming days, and whether they are leaving or have left.
 *  leave: {a0, a1} of the current or next leave inside `horizon` days (or null). leaving: {date, state: 'left' | 'soon' | 'later'}. */
export function personState(name, today, vacs, leaving, horizon, soonDays) {
  const end = addIso(today, horizon || 90), mine = (vacs || []).filter(v => v && v.a0 && sameName(v.p, name) && (v.a1 || v.a0) >= today && v.a0 <= end).sort((x, y) => (x.a0 < y.a0 ? -1 : 1));
  const cur = mine.find(v => v.a0 <= today), next = mine.find(v => v.a0 > today), lv = leaving && leaving[name];
  return {
    onLeave: !!cur, leave: cur ? { a0: cur.a0, a1: cur.a1 || cur.a0 } : next ? { a0: next.a0, a1: next.a1 || next.a0 } : null,
    leaving: lv ? { date: lv, state: lv < today ? 'left' : lv <= addIso(today, soonDays || 60) ? 'soon' : 'later' } : null
  };
}
/** Review of the months: per month and role, points used, plannable points, room left, and ok / warn / over. */
export function review(months, o) {
  return months.map(m => {
    const lines = o.linesOf(m), rg = o.rangeOf(m), ld = loads(lines);
    const lanes = settings(o.cfg).lanes.map(l => { const c = laneCapacity(l, rg, o.vacs, o.cfg), used = ld[l.k]; return { k: l.k, n: l.n, used: used, cap: c.cap, people: c.people, fte: c.fte, free: Math.max(0, Math.round((c.cap - used) * 10) / 10), over: Math.max(0, Math.round((used - c.cap) * 10) / 10), st: statusOf(used, c.cap) }; });
    return { m: m, lines: lines, lanes: lanes, st: lanes.some(x => x.st === 'over') ? 'over' : lanes.some(x => x.st === 'warn') ? 'warn' : 'ok', pts: lanes.reduce((a, x) => a + x.used, 0) };
  });
}
/** For each role that is over in a month: cards that could go to a later month where everything still fits.
 *  probsOf(line, to) gives order problems of putting the card in month `to`. Suggests cards until the excess is cleared (at most two per role), never the same card twice. */
export function suggestMoves(rev, o) {
  const out = [], used = {};
  rev.forEach((r, i) => r.lanes.filter(x => x.st === 'over').forEach(x => {
    const cands = r.lines.filter(l => ptsOf(l, x.k) > 0 && !used[l.id]).sort((a, b) => { const fa = ptsOf(a, x.k) >= x.over, fb = ptsOf(b, x.k) >= x.over; return fa !== fb ? (fa ? -1 : 1) : fa ? ptsOf(a, x.k) - ptsOf(b, x.k) : ptsOf(b, x.k) - ptsOf(a, x.k); });
    let found = 0, cleared = 0;
    cands.forEach(l => { if (found >= 2 || cleared >= x.over) return; const to = rev.slice(i + 1).find(t => !overAfter(l, t.lines, o.rangeOf(t.m), o.vacs, o.cfg).length && !o.probsOf(l, t.m).length); if (to) { used[l.id] = 1; found++; cleared += ptsOf(l, x.k); out.push({ m: r.m, k: x.k, n: x.n, line: l, to: to.m, pts: ptsOf(l, x.k) }); } });
    if (!found) out.push({ m: r.m, k: x.k, n: x.n, none: true });
  }));
  return out;
}
