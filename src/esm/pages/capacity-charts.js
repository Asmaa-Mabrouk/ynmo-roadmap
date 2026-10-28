/**
 * @module pages/capacity-charts
 * Charts of the Dashboard, drawn with plain HTML and SVG (no library): two heat maps (tracks and people by month),
 * bars (points planned against what a track can take) and columns (planned against capacity over the months).
 * One hue (the brand green, light to dark) says how full something is; red with a triangle and the word "over" says it is past the limit,
 * so colour never carries the meaning alone. Every chart has a table twin and a hover / keyboard tooltip. Labels are set with textContent only.
 */
import { el } from '../core/model.js';
import { PRODUCT_ORDER, TAGS, monthLabel, monthRange } from '../features/month-model.js';
import { lostInfo, personCap, personLoads, personState, ptsOf, settings } from '../features/capacity.js';
import { fmtIso } from '../core/shared.js';

const LO = '#e6f3ee', HI = '#0a5c43', BAD = '#d03b3b', INK = '#1b1f33';
const fmt = n => String(Math.round(n * 10) / 10);
const pct = u => Math.round(u * 100) + '%';
export const util = (used, cap) => (cap > 0 ? used / cap : used > 0 ? Infinity : 0);
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(k => n.setAttribute(k, attrs[k])); if (text !== undefined) n.textContent = text; return n; };

/** Fill and text colour for how full something is (u = used / can take). Over the limit: red. */
export function shade(node, u) {
  node.classList.remove('over');
  if (u > 1 + 1e-9) { node.classList.add('over'); node.style.background = BAD; node.style.color = '#fff'; return; }
  const k = Math.round(Math.max(0, Math.min(1, u)) * 100);
  node.style.background = 'color-mix(in srgb, ' + HI + ' ' + k + '%, ' + LO + ')';
  node.style.color = u >= 0.7 ? '#fff' : INK;
}

/** One floating tooltip for the whole page; mark.dataset keeps nothing, lines are plain text. */
let tipEl = null;
export function tipHost(root) { tipEl = el('div', 'cptip2'); tipEl.hidden = true; tipEl.setAttribute('role', 'tooltip'); root.append(tipEl); }
export function tip(node, lines) {
  node.tabIndex = 0;
  const show = (x, y) => { if (!tipEl) return; tipEl.textContent = ''; lines.forEach((t, i) => tipEl.append(el(i ? 'div' : 'strong', '', t))); tipEl.hidden = false; const w = tipEl.offsetWidth; tipEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 12)) + 'px'; tipEl.style.top = Math.max(8, y - 8 - tipEl.offsetHeight) + 'px'; };
  node.addEventListener('pointermove', e => show(e.clientX, e.clientY));
  node.addEventListener('focus', () => { const r = node.getBoundingClientRect(); show(r.left + r.width / 2, r.top); });
  const hide = () => { if (tipEl) tipEl.hidden = true; };
  node.addEventListener('pointerleave', hide); node.addEventListener('blur', hide);
}

/** Line icons (static markup, no data in it). */
const ICONS = {
  ok: '<path d="M12 3 5 6v5c0 4.4 2.9 8.3 7 10 4.1-1.7 7-5.6 7-10V6l-7-3z" /><path d="m9 12 2 2 4-4" />',
  warn: '<path d="M12 4 2.8 20h18.4L12 4z" /><path d="M12 10v4.5M12 17.5v.5" />',
  over: '<path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2L8.2 3z" /><path d="M12 8v5M12 16v.5" />',
  points: '<rect x="3" y="4" width="18" height="12" rx="2" /><path d="M7 12l3-3 3 2 4-4M8 20h8M12 16v4" />',
  cap: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />',
  tracks: '<circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.3c1.8.8 3 2.6 3 4.7" />',
  away: '<rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" />'
};
export function icon(name) { const s = sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'cpico' }); s.innerHTML = ICONS[name] || ''; return s; }

/** A chart with a "Table" button that swaps it for its table twin. table = {head: [..], rows: [[..]]} */
export function withTable(id, title, sub, chart, table) {
  const box = el('div', 'cpchart'); box.id = id;
  const head = el('div', 'cpchead'), t = el('div'); if (title) t.append(el('h3', '', title)); if (sub) t.append(el('p', 'sub', sub));
  const seg = el('div', 'cpseg'), bc = el('button', '', 'Chart'), bt = el('button', '', 'Table'); bc.type = bt.type = 'button'; bc.setAttribute('aria-pressed', 'true'); bt.setAttribute('aria-pressed', 'false'); seg.append(bc, bt); head.append(t, seg);
  const tb = el('table', 'cptable'); const hr = el('tr'); table.head.forEach(h => hr.append(el('th', '', h))); tb.append(el('thead')); tb.firstChild.append(hr);
  const body = el('tbody'); table.rows.forEach(r => { const tr = el('tr'); r.forEach((c, i) => tr.append(el(i ? 'td' : 'th', '', c))); body.append(tr); }); tb.append(body); tb.hidden = true;
  const flag = (e, v) => { if (v) e.setAttribute('hidden', ''); else e.removeAttribute('hidden'); };   // an SVG chart has no .hidden property, so the attribute is set directly
  const set = on => { flag(tb, !on); flag(chart, on); bt.setAttribute('aria-pressed', String(on)); bc.setAttribute('aria-pressed', String(!on)); };
  bt.addEventListener('click', () => set(true)); bc.addEventListener('click', () => set(false));
  box.append(head, chart, tb); return box;
}

export function legend() {
  const l = el('div', 'cpleg'); l.setAttribute('aria-label', 'Colour scale');
  l.append(el('span', '', 'Empty'));
  const bar = el('i', 'cpscale'); l.append(bar, el('span', '', 'Full (100%)'));
  const o = el('i', 'cpover'); o.textContent = '▲'; l.append(o, el('span', '', 'Over the limit'));
  return l;
}

/** Heat map 1: tracks by month, shade = share of capacity used; the cell also says used / can take. */
export function heatTracks(rev) {
  const g = el('div', 'cpheat'); g.id = 'cpheat'; g.style.gridTemplateColumns = '120px repeat(' + rev.length + ', minmax(84px, 1fr))';
  g.append(el('span', 'cphh'));
  rev.forEach(r => g.append(el('span', 'cphh', monthLabel(r.m))));
  const rows = [];
  rev[0].lanes.forEach((l, i) => {
    g.append(el('span', 'cprl', l.n)); const row = [l.n];
    rev.forEach(r => {
      const x = r.lanes[i], u = util(x.used, x.cap), c = el('div', 'cpcell'); c.dataset.lane = l.k; c.dataset.m = r.m;
      c.append(el('b', 'cppct', !x.cap && !x.used ? '–' : (u > 1 ? '▲ ' : '') + (Number.isFinite(u) ? pct(u) : 'over')), el('span', 'cpnum', fmt(x.used) + ' / ' + fmt(x.cap)));
      shade(c, u); const lines = [x.n + ', ' + monthLabel(r.m), fmt(x.used) + ' points planned of ' + fmt(x.cap) + ' (' + x.people + ' people)', x.st === 'over' ? fmt(x.over) + ' points over' : fmt(x.free) + ' points free'];
      c.setAttribute('aria-label', lines.join('. ')); tip(c, lines); g.append(c); row.push(fmt(x.used) + ' / ' + fmt(x.cap) + (x.st === 'over' ? ' (over ' + fmt(x.over) + ')' : ' (free ' + fmt(x.free) + ')'));
    });
    rows.push(row);
  });
  return { node: g, table: { head: ['Track'].concat(rev.map(r => monthLabel(r.m))), rows: rows } };
}

/** Heat map 2: each person by month, shade = personal points planned / what they can take. */
const short = iso => fmtIso(iso).replace(/ \d{4}$/, '');
export function heatPeople(rev, cfg, vacs, today) {
  const s = settings(cfg), seen = {}, people = [];
  s.lanes.forEach(l => l.people.forEach(p => { if (!seen[p]) { seen[p] = { n: p, tracks: [] }; people.push(seen[p]); } seen[p].tracks.push(l.n); }));
  const loads = rev.map(r => personLoads(r.lines));
  const g = el('div', 'cpheat cpheatp'); g.id = 'cpheatp'; g.style.gridTemplateColumns = '190px repeat(' + rev.length + ', minmax(72px, 1fr))';
  g.append(el('span', 'cphh')); rev.forEach(r => g.append(el('span', 'cphh', monthLabel(r.m))));
  const rows = [];
  people.forEach(p => {
    const lab = el('span', 'cprl'); lab.dataset.name = p.n; lab.append(el('b', '', p.n), el('small', '', p.tracks.join(' + ')));
    const ps = personState(p.n, today, vacs, s.leaving), tg = el('span', 'cptags');
    if (ps.leaving) tg.append(el('span', 'cptag ' + (ps.leaving.state === 'later' ? 'info' : 'bad'), ps.leaving.state === 'left' ? 'Left on ' + short(ps.leaving.date) : 'Leaving ' + short(ps.leaving.date) + (ps.leaving.state === 'soon' ? ' (soon)' : '')));
    if (ps.onLeave) tg.append(el('span', 'cptag warn', 'On leave until ' + short(ps.leave.a1))); else if (ps.leave) tg.append(el('span', 'cptag info', 'Leave ' + short(ps.leave.a0) + (ps.leave.a1 > ps.leave.a0 ? ' to ' + short(ps.leave.a1) : '')));
    if (tg.childNodes.length) lab.append(tg);
    g.append(lab); const row = [p.n + ' (' + p.tracks.join(' + ') + ')'];
    rev.forEach((r, i) => {
      const cap = personCap(p.n, monthRange(r.m), vacs, cfg), pl = loads[i][p.n] || 0, u = util(pl, cap), c = el('div', 'cpcell cpsmall'); c.dataset.name = p.n; c.dataset.m = r.m;
      if (!cap && !pl) { c.classList.add('na'); c.append(el('b', 'cppct', '–')); } else { c.append(el('b', 'cppct', (u > 1 ? '▲ ' : '') + (Number.isFinite(u) ? pct(u) : 'over')), el('span', 'cpnum', fmt(pl) + ' / ' + fmt(cap))); shade(c, u); }
      const li = lostInfo(p.n, monthRange(r.m), vacs, cfg), lines = [p.n + ', ' + monthLabel(r.m), !cap && !pl ? 'Not available this month (left, or on leave all month)' : fmt(pl) + ' points planned of ' + fmt(cap) + ' they can take'];
      if (!li.gone && li.leave > 0) { const lf = el('span', 'cpleaf', '\u{1F334} ' + li.leave + 'd'); c.append(lf); lines.push('\u{1F334} ' + li.leave + ' working day' + (li.leave === 1 ? '' : 's') + ' of leave = \u2212' + fmt(li.leave * li.perDay) + ' points (1 day = ' + fmt(li.perDay) + ' points)'); }
      if (!li.gone && li.after > 0) lines.push('Last working day is in this month: ' + li.after + ' working day' + (li.after === 1 ? '' : 's') + ' lost = \u2212' + fmt(li.after * li.perDay) + ' points');
      c.setAttribute('aria-label', lines.join('. ')); tip(c, lines); g.append(c); row.push(!cap && !pl ? 'not available' : fmt(pl) + ' / ' + fmt(cap));
    });
    rows.push(row);
  });
  return { node: g, table: { head: ['Person'].concat(rev.map(r => monthLabel(r.m))), rows: rows } };
}

/** Bars: for one month, points planned in each track, stacked by product (the colours of the Monthly cards), against what the track can take
 *  (pale bar and the dark tick). The part past the limit is hatched red and the value says how much. */
export function barsTracks(r) {
  const wrap = el('div', 'cpbars'); wrap.id = 'cpbars';
  const max = Math.max(1, ...r.lanes.map(x => Math.max(x.used, x.cap))), rows = [], used = {};
  const prodOf = (laneK) => { const out = {}; r.lines.forEach(l => { const v = ptsOf(l, laneK); if (v > 0) { const k = TAGS.some(t => t.k === l.k) ? l.k : 'other'; out[k] = (out[k] || 0) + v; } }); return out; };
  const order = PRODUCT_ORDER.concat(['other']), colour = k => (TAGS.find(t => t.k === k) || { c: '#9aa0b8' }).c, nameOf = k => (TAGS.find(t => t.k === k) || { n: 'Other' }).n;
  r.lanes.forEach(x => {
    const row = el('div', 'cpbrow'); row.dataset.lane = x.k; row.append(el('span', 'cprl', x.n));
    const track = el('span', 'cpbtrack'), pc = x.cap / max * 100, by = prodOf(x.k); track.style.setProperty('--cap', pc + '%');
    let left = 0; order.forEach(k => { if (!by[k]) return; used[k] = 1; const w = by[k] / max * 100, seg = el('i', 'cpbseg'); seg.style.left = left + '%'; seg.style.width = 'calc(' + w + '% - 2px)'; seg.style.background = colour(k); seg.dataset.product = k; track.append(seg); left += w; });
    if (x.used > x.cap + 1e-9) { const b = el('i', 'cpbover'); b.style.left = pc + '%'; b.style.width = (x.used - x.cap) / max * 100 + '%'; track.append(b); }
    const lim = el('i', 'cpblimit'); lim.style.left = pc + '%'; track.append(lim);
    const v = el('span', 'cpbval', fmt(x.used) + ' / ' + fmt(x.cap) + (x.st === 'over' ? '  ▲ ' + fmt(x.over) + ' over' : '')); if (x.st === 'over') v.classList.add('bad');
    row.append(track, v);
    const lines = [x.n + ', ' + monthLabel(r.m), fmt(x.used) + ' points planned of ' + fmt(x.cap), x.st === 'over' ? fmt(x.over) + ' over' : fmt(x.free) + ' free'].concat(order.filter(k => by[k]).map(k => nameOf(k) + ' ' + fmt(by[k])));
    row.setAttribute('aria-label', lines.join('. ')); tip(row, lines); wrap.append(row);
    rows.push([x.n, fmt(x.used), fmt(x.cap), x.st === 'over' ? 'over by ' + fmt(x.over) : 'free ' + fmt(x.free)].concat(order.map(k => (by[k] ? fmt(by[k]) : '–'))));
  });
  const shown = order.filter(k => used[k]), key = el('div', 'cpkey'); key.id = 'cpkey';
  shown.forEach(k => { const i = el('i', 'cpsw'); i.style.background = colour(k); key.append(el('span', 'cpkeyi', ''), ); key.lastChild.append(i, document.createTextNode(nameOf(k))); });
  if (shown.length) wrap.append(key);
  return { node: wrap, table: { head: ['Track', 'Planned', 'Can take', 'Room'].concat(order.map(nameOf)), rows: rows } };
}

/** Columns: points planned each month (all tracks) against the capacity of all tracks (the dark tick). */
export function columnsTrend(rev) {
  const W = 120 + rev.length * 96, H = 230, pl = 44, pb = 30, pt = 18, ph = H - pb - pt;
  const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'cpcols', role: 'img', 'aria-label': 'Points planned each month against the capacity of all tracks' }); svg.id = 'cpcols';
  const tot = rev.map(r => ({ m: r.m, used: r.lanes.reduce((a, x) => a + x.used, 0), cap: r.lanes.reduce((a, x) => a + x.cap, 0) }));
  const top = Math.max(10, ...tot.map(t => Math.max(t.used, t.cap))), step = top <= 50 ? 10 : top <= 120 ? 20 : top <= 300 ? 50 : 100, maxY = Math.ceil(top / step) * step, y = v => pt + ph - v / maxY * ph;
  for (let v = 0; v <= maxY; v += step) { svg.append(sv('line', { x1: pl, x2: W - 8, y1: y(v), y2: y(v), class: v ? 'cpgrid' : 'cpbase' }), sv('text', { x: pl - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'cpax' }, String(v))); }
  const slot = (W - pl - 8) / rev.length, bw = Math.min(24, slot * 0.5), rows = [];
  tot.forEach((t, i) => {
    const cx = pl + slot * i + slot / 2, over = t.used > t.cap + 1e-9, h = Math.max(0, ph - (y(t.used) - pt));
    const g = sv('g', { class: 'cpcol' + (over ? ' over' : ''), 'data-m': t.m });
    if (h > 0) g.append(sv('path', { d: 'M' + (cx - bw / 2) + ',' + (pt + ph) + 'V' + (y(t.used) + 4) + 'a4,4 0 0 1 4,-4h' + (bw - 8) + 'a4,4 0 0 1 4,4V' + (pt + ph) + 'Z', class: 'cpcolfill' }));
    g.append(sv('line', { x1: cx - bw / 2 - 8, x2: cx + bw / 2 + 8, y1: y(t.cap), y2: y(t.cap), class: 'cpcap' }));
    if (t.used > 0) g.append(sv('text', { x: cx, y: Math.min(y(t.used), y(t.cap)) - 6, 'text-anchor': 'middle', class: 'cpval' }, (over ? '▲ ' : '') + fmt(t.used)));
    g.append(sv('text', { x: cx, y: H - 10, 'text-anchor': 'middle', class: 'cpax' }, monthLabel(t.m).replace(/ \d{2}(\d{2})$/, ' $1')));
    const hit = sv('rect', { x: cx - slot / 2, y: pt, width: slot, height: ph + pb, fill: 'transparent' }); g.append(hit);
    const lines = [monthLabel(t.m), fmt(t.used) + ' points planned of ' + fmt(t.cap) + ' (all tracks)', over ? fmt(t.used - t.cap) + ' over in total' : fmt(t.cap - t.used) + ' free in total'];
    g.setAttribute('aria-label', lines.join('. ')); tip(g, lines); svg.append(g); rows.push([monthLabel(t.m), fmt(t.used), fmt(t.cap), over ? 'over by ' + fmt(t.used - t.cap) : 'free ' + fmt(t.cap - t.used)]);
  });
  return { node: svg, table: { head: ['Month', 'Planned', 'Can take (all tracks)', 'Room'], rows: rows } };
}
