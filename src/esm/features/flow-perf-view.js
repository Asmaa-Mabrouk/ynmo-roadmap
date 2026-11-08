/**
 * @module features/flow-perf-view
 * Ynmo Flow, "Performance" screen: team numbers from the tickets. Period/product/type filters, team tiles, per-person table, weekly trend, bugs, product split.
 */
import { el } from '../core/model.js';
import { TAGS } from './month-model.js';
import { TYPES } from './flow-model.js';
import { perfStats } from './flow-perf.js';
import { avatar } from './flow-views.js';

const PERIODS = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [0, 'All time']];
const fmt = (v, u) => (v == null ? '–' : v + (u || ''));
const panel = (title, ...kids) => { const d = el('section', 'fpanel card'); d.append(el('h3', '', title), ...kids); return d; };

/** Draw the screen. c = {rows, today, open}; ui = persistent state {pdays, pprod, ptype}. */
export function perfView(host, c, ui) {
  if (ui.pdays == null) ui.pdays = 30;
  const draw = () => {
    host.textContent = '';
    const bar = el('div', 'flowbar fperfbar');
    const sel = (id, label, opts, cur, set) => { const s = el('select'); s.id = id; s.setAttribute('aria-label', label); opts.forEach(([v, n]) => { const o = el('option', '', n); o.value = String(v); if (String(v) === String(cur)) o.selected = true; s.append(o); }); s.addEventListener('change', () => { set(s.value); draw(); }); return s; };
    bar.append(sel('perfperiod', 'Period', PERIODS, ui.pdays, v => { ui.pdays = Number(v); }),
      sel('perfprod', 'Product', [['', 'All products']].concat(TAGS.map(t => [t.k, t.n])), ui.pprod || '', v => { ui.pprod = v; }),
      sel('perftype', 'Type', [['', 'All types']].concat(TYPES.filter(t => t.id !== 'epic').map(t => [t.id, t.n])), ui.ptype || '', v => { ui.ptype = v; }));
    host.append(bar);
    const s = perfStats(c.rows, { days: ui.pdays, day: c.today, prod: ui.pprod || '', type: ui.ptype || '' }), t = s.team;
    const tiles = el('div', 'fstats');
    [['Closed', t.closed], ['Created', t.created], ['Open now', t.open], ['Overdue', t.overdue], ['Avg days to close', fmt(t.avgCycle)], ['Closed on time', fmt(t.onTimePct, '%')], ['Reopened', t.reopened]].forEach(([n, v]) => { const d = el('div', 'fstat card'); d.dataset.stat = n; d.append(el('b', '', String(v)), el('span', '', n)); tiles.append(d); });
    host.append(tiles);
    if (!t.closed && !t.open) { host.append(el('p', 'sub', 'No tickets match these filters.')); return; }
    const tb = el('table', 'flowtbl fperf'); tb.id = 'perftable';
    const hd = el('thead'), hr = el('tr'); ['Person', 'Closed', 'Open', 'Overdue', 'Blocked', 'Points done', 'Bugs fixed', 'Avg days', 'On time', 'Reopened'].forEach((n, i) => { const th = el('th', i ? 'num' : '', n); th.scope = 'col'; hr.append(th); });
    hd.append(hr); tb.append(hd); const bd = el('tbody');
    s.people.forEach(p => {
      const r = el('tr'); r.dataset.person = p.n; const nm = el('td'); nm.append(avatar(p.n), document.createTextNode(' ' + p.n)); r.append(nm);
      [p.closed, p.open, p.overdue, p.blocked, p.points, p.bugsFixed, fmt(p.avgCycle), fmt(p.onTimePct, '%'), p.reopened].forEach((v, i) => { const td = el('td', 'num', String(v)); if ((i === 2 || i === 3) && v > 0) td.classList.add('fwarn'); r.append(td); });
      bd.append(r);
    });
    if (!s.people.length) { const r = el('tr'); const td = el('td', 'sub', 'Nobody has tickets assigned.'); td.colSpan = 10; r.append(td); bd.append(r); }
    tb.append(bd); const wrap = el('div', 'flowtblwrap'); wrap.append(tb);
    const g = el('div', 'fgrid');
    const mw = Math.max(1, ...s.weeks.map(w => Math.max(w.created, w.closed))), tr = el('div', 'ftrend'); tr.id = 'perftrend';
    s.weeks.forEach(w => { const col = el('div', 'ftcol'); col.title = 'Week of ' + w.from + ': ' + w.created + ' created, ' + w.closed + ' closed'; const a = el('i', 'fta'), b = el('i', 'ftb'); a.style.height = (w.created * 100 / mw) + '%'; b.style.height = (w.closed * 100 / mw) + '%'; const bars = el('div', 'ftbars'); bars.append(a, b); col.append(bars, el('span', '', w.from.slice(5))); tr.append(col); });
    const lg = el('p', 'sub', 'Blue = created, green = closed, per week (last 8 weeks).');
    const mp = Math.max(1, ...s.products.map(x => x.closed)), pd = el('div', 'fbars');
    s.products.forEach(x => { const tg = TAGS.find(y => y.k === x.k), r = el('div', 'fbrow'), b = el('div', 'fbar'), i = el('i'); i.style.width = (x.closed * 100 / mp) + '%'; if (tg) i.style.background = tg.c; b.append(i); r.append(el('span', '', tg ? tg.n : 'No product'), b, el('b', '', String(x.closed))); pd.append(r); });
    const bg = el('div', 'frecent'); [['Opened', s.bugs.opened], ['Fixed', s.bugs.fixed], ['Still open', s.bugs.open]].forEach(([n, v]) => bg.append(el('p', 'sub', n + ': ' + v)));
    g.append(panel('Weekly trend', tr, lg), panel('Closed per product', s.products.length ? pd : el('p', 'sub', 'Nothing closed in this period.')), panel('Bugs (bug, sub-bug, hotfix)', bg));
    host.append(panel('Team members', wrap), g, el('p', 'sub fperfnote', 'Numbers come from ticket fields and history. "Closed" means a finished status; "on time" = closed on or before the due date. Use them to find where help is needed, not to rank people.'));
  };
  draw();
}
