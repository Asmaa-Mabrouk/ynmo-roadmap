/**
 * @module pages/capacity-charts
 * Charts of the Dashboard, drawn with plain HTML and SVG (no library): two heat maps (tracks and people by month),
 * bars (points planned against what a track can take) and columns (planned against capacity over the months).
 * One hue (the brand green, light to dark) says how full something is; red with a triangle and the word "over" says it is past the limit,
 * so colour never carries the meaning alone. Every chart has a table twin and a hover / keyboard tooltip. Labels are set with textContent only.
 */
import { el } from '../core/model.js';
import { monthLabel, monthRange } from '../features/month-model.js';
import { personCap, personLoads, personState, settings } from '../features/capacity.js';
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

/** A chart with a "Table" button that swaps it for its table twin. table = {head: [..], rows: [[..]]} */
export function withTable(id, title, sub, chart, table) {
  const box = el('div', 'cpchart'); box.id = id;
  const head = el('div', 'cpchead'), t = el('div'); if (title) t.append(el('h3', '', title)); if (sub) t.append(el('p', 'sub', sub));
  const btn = el('button', 'btn sm', 'Table'); btn.type = 'button'; btn.setAttribute('aria-pressed', 'false'); head.append(t, btn);
  const tb = el('table', 'cptable'); const hr = el('tr'); table.head.forEach(h => hr.append(el('th', '', h))); tb.append(el('thead')); tb.firstChild.append(hr);
  const body = el('tbody'); table.rows.forEach(r => { const tr = el('tr'); r.forEach((c, i) => tr.append(el(i ? 'td' : 'th', '', c))); body.append(tr); }); tb.append(body); tb.hidden = true;
  btn.addEventListener('click', () => { const on = tb.hidden; tb.hidden = !on; chart.hidden = on; btn.textContent = on ? 'Chart' : 'Table'; btn.setAttribute('aria-pressed', String(on)); });
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
      const lines = [p.n + ', ' + monthLabel(r.m), !cap && !pl ? 'Not available this month (left, or on leave all month)' : fmt(pl) + ' points planned of ' + fmt(cap) + ' they can take'];
      c.setAttribute('aria-label', lines.join('. ')); tip(c, lines); g.append(c); row.push(!cap && !pl ? 'not available' : fmt(pl) + ' / ' + fmt(cap));
    });
    rows.push(row);
  });
  return { node: g, table: { head: ['Person'].concat(rev.map(r => monthLabel(r.m))), rows: rows } };
}

/** Bars: for one month, points planned against what each track can take. The pale track is capacity, the fill is planned, the part past capacity is red. */
export function barsTracks(r) {
  const wrap = el('div', 'cpbars'); wrap.id = 'cpbars';
  const max = Math.max(1, ...r.lanes.map(x => Math.max(x.used, x.cap))), rows = [];
  r.lanes.forEach(x => {
    const row = el('div', 'cpbrow'); row.dataset.lane = x.k; row.append(el('span', 'cprl', x.n));
    const track = el('span', 'cpbtrack'), pc = x.cap / max * 100, within = Math.min(x.used, x.cap) / max * 100, past = Math.max(0, x.used - x.cap) / max * 100;
    track.style.setProperty('--cap', pc + '%');
    const a = el('i', 'cpbfill'); a.style.width = within + '%'; track.append(a);
    if (past > 0) { const b = el('i', 'cpbover'); b.style.left = within + '%'; b.style.width = past + '%'; track.append(b); }
    const lim = el('i', 'cpblimit'); lim.style.left = pc + '%'; track.append(lim);
    const v = el('span', 'cpbval', fmt(x.used) + ' / ' + fmt(x.cap) + (x.st === 'over' ? '  ▲ ' + fmt(x.over) + ' over' : ''));
    if (x.st === 'over') v.classList.add('bad');
    row.append(track, v); const lines = [x.n + ', ' + monthLabel(r.m), fmt(x.used) + ' points planned of ' + fmt(x.cap), x.st === 'over' ? fmt(x.over) + ' over' : fmt(x.free) + ' free']; row.setAttribute('aria-label', lines.join('. ')); tip(row, lines); wrap.append(row);
    rows.push([x.n, fmt(x.used), fmt(x.cap), x.st === 'over' ? 'over by ' + fmt(x.over) : 'free ' + fmt(x.free)]);
  });
  return { node: wrap, table: { head: ['Track', 'Planned', 'Can take', 'Room'], rows: rows } };
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
