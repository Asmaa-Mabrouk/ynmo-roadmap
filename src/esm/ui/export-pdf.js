/**
 * @module ui/export-pdf
 * "Export PDF": a clean, coloured, full-timeline picture of the roadmap for executives.
 * It builds a static print layout (#printrm) from the same data as the chart (filters respected), switches the page to print mode and opens the
 * browser's print dialog, where "Save as PDF" makes the file. The whole timeline is scaled to the page width (A3 landscape), so nothing is cut off.
 * Depends on the DOM and the model only; all text goes in as text nodes.
 */
import { DAYS, LANES, MGROUPS, NDAYS, STATUS, barColorCss, canEdit, directory, dlabel, el, eff, items, onColor, state, todayK, visible } from '../core/model.js';
import { curRm } from '../pages/roadmaps.js';
import { comparePeople, hiddenHere } from '../features/people-rows.js';
import { pack } from './gantt-render.js';
import { notify } from './notify.js';
import { fmtIso } from '../core/shared.js';
import { DEFAULT_COLOR, leaveRuns, notesHere, packNotes, personNotes, stripNeeded } from '../features/timeline-notes.js';

const H = 30, NH = 17;   // height of one bar lane / one note lane, px
const pct = n => (n / NDAYS * 100).toFixed(3) + '%';

function legend(list) {
  const lg = el('div', 'prm-legend');
  const used = new Set(list.map(i => i.sq));
  LANES.filter(l => used.has(l.k)).forEach(l => { const s = el('span'); const i = el('i', 'prm-dot'); i.style.background = l.c; s.append(i, document.createTextNode(l.n)); lg.append(s); });
  [['planned', 'Planned'], ['decide', 'Needs decision'], ['contract', 'Waiting on contract'], ['done', 'Done']].forEach(x => { const s = el('span'); const i = el('i', 'prm-sw prm-st-' + x[0]); i.style.setProperty('--c', '#5a6180'); s.append(i, document.createTextNode(STATUS[x[0]] || x[1])); lg.append(s); });
  return lg;
}
function noteEl(n, laneIdx, chip) {
  const b = el('div', 'prm-note ' + (chip ? 'prm-chip' : 'prm-rib')); b.style.left = pct(n.d0); b.style.width = pct(n.d1 - n.d0 + 1); b.style.top = (laneIdx * NH + 2) + 'px'; b.style.setProperty('--c', /^#[0-9a-f]{6}$/i.test(n.c || '') ? n.c : DEFAULT_COLOR[n.k]); b.append(el('span', 'prm-t', n.t)); return b;
}
function bar(it, laneIdx, top0) {
  const l = LANES.find(x => x.k === it.sq) || LANES[0], col = barColorCss(it.c) || l.c, b = el('div', 'prm-bar prm-st-' + it.st + (it.ms ? ' prm-ms' : ''));
  b.style.left = pct(it.d0); b.style.width = pct(it.d1 - it.d0 + 1); b.style.top = ((top0 || 0) + laneIdx * H + 3) + 'px'; b.style.height = (H - 6) + 'px'; b.style.setProperty('--c', col);
  const on = onColor(it.c); if (on) b.style.setProperty('--on', on);
  const t = (it.st === 'done' ? '✓ ' : '') + it.t; b.append(el('span', 'prm-t', t));
  return b;
}
/** Build the print layout from what the roadmap currently shows. */
export function buildPrintView() {
  const list = visible(), root = el('div'); root.id = 'printrm';
  const rm = curRm();
  const head = el('div', 'prm-head'), ttl = el('div'); ttl.append(el('h1', '', 'Ynmo roadmap · ' + rm.n), el('p', '', fmtIso(rm.a) + ' to ' + fmtIso(rm.b) + ' · prepared ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })));
  head.append(ttl);
  const cnt = k => list.filter(i => i.st === k).length, tiles = el('div', 'prm-tiles');
  [[list.length, 'features'], [cnt('planned'), 'planned'], [cnt('decide'), 'need a decision'], [cnt('contract'), 'wait on contract'], [cnt('done'), 'done']].forEach(p => { const t = el('div', 'prm-tile'); t.append(el('b', '', String(p[0])), el('span', '', p[1])); tiles.append(t); });
  head.append(tiles); root.append(head);
  const sq = LANES.filter(l => !state.sq.has(l.k)).map(l => l.n);
  const notes = [state.person !== 'all' ? 'Person: ' + state.person : '', state.status !== 'all' ? 'Status: ' + (STATUS[state.status] || state.status) : '', state.q.trim() ? 'Search: ' + state.q.trim() : '', sq.length ? 'Hidden products: ' + sq.join(', ') : ''].filter(Boolean);
  if (notes.length) root.append(el('p', 'prm-filter', 'Filtered view · ' + notes.join(' · ')));
  root.append(legend(list));

  // rows: same people and order as the chart; only people who have a bar are listed
  const dir = directory(), map = new Map();
  list.forEach(it => { if (!it.res.length) { if (!map.has('__none')) map.set('__none', { name: '__none', its: [] }); map.get('__none').its.push(it); } else it.res.forEach(n => { if (!map.has(n)) map.set(n, { name: n, its: [] }); map.get(n).its.push(eff(it, n)); }); });
  const hid = hiddenHere();
  let people = [...map.values()].filter(p => p.name !== '__none' && (!hid.includes(p.name) || p.its.length)); people.sort(comparePeople);
  if (map.has('__none')) people.push(map.get('__none'));

  const tb = el('table', 'prm'), th = el('thead'), r1 = el('tr'), n1 = el('th', 'prm-name', 'Team member'), t1 = el('th', 'prm-tl');
  const months = el('div', 'prm-months'), weeks = el('div', 'prm-weeks');
  MGROUPS.forEach(m => { const d = el('div', 'prm-mo'); d.style.left = pct(m.from); d.style.width = pct(m.to - m.from + 1); d.append(el('span', '', m.n)); months.append(d); });
  DAYS.forEach(x => { if (x.dow === 0) { const w = el('div', 'prm-wk', String(x.d.getUTCDate())); w.style.left = pct(x.k); weeks.append(w); } });
  t1.append(months, weeks); r1.append(n1, t1); th.append(r1); tb.append(th);
  const body = el('tbody'), periods = packNotes(notesHere('period')), bands = periods.out.map(x => x.n);
  const addBands = cell => bands.forEach(n => { const d = el('i', 'prm-band'); d.style.left = pct(n.d0); d.style.width = pct(n.d1 - n.d0 + 1); d.style.setProperty('--c', /^#[0-9a-f]{6}$/i.test(n.c || '') ? n.c : DEFAULT_COLOR.period); cell.append(d); });
  if (stripNeeded()) {   // the Notes row: period notes and how many people are on leave each day
    const tr = el('tr'), td1 = el('td', 'prm-name'), td2 = el('td', 'prm-tl'), cell = el('div', 'prm-cell'); td1.append(el('b', '', 'Notes'), el('small', '', 'periods and leave'));
    cell.style.height = (Math.max(1, periods.lanes) * NH + 16) + 'px';
    leaveRuns().forEach(r => { const d = el('i', 'prm-heat'); d.style.left = pct(r.d0); d.style.width = pct(r.d1 - r.d0 + 1); d.style.opacity = String(0.35 + 0.65 * Math.min(1, r.n / 4)); d.title = r.who.join(', '); if (r.d1 > r.d0) d.textContent = String(r.n); cell.append(d); });
    periods.out.forEach(x => cell.append(noteEl(x.n, x.lane, true))); td2.append(cell); tr.append(td1, td2); body.append(tr);
  }
  people.forEach(p => {
    const pk = pack(p.its), pn = p.name === '__none' ? { out: [], lanes: 0 } : personNotes(p.name), nh = pn.lanes * NH, tr = el('tr'), td1 = el('td', 'prm-name'), d = dir.get(p.name);
    td1.append(el('b', '', p.name === '__none' ? 'Unassigned' : p.name)); if (d) td1.append(el('small', '', d.domain));
    const td2 = el('td', 'prm-tl'), cell = el('div', 'prm-cell'); cell.style.height = (nh + pk.n * H + 4) + 'px'; addBands(cell);
    DAYS.forEach(x => { if (x.dow === 0) { const g = el('i', 'prm-grid'); g.style.left = pct(x.k); cell.append(g); } });
    if (todayK >= 0) { const t = el('i', 'prm-today'); t.style.left = pct(todayK); cell.append(t); }
    pn.out.forEach(x => cell.append(noteEl(x.n, x.lane, false)));
    pk.out.forEach(x => cell.append(bar(x.it, x.lane, nh)));
    td2.append(cell); tr.append(td1, td2); body.append(tr);
  });
  if (!people.length) { const tr = el('tr'), td = el('td'); td.colSpan = 2; td.textContent = 'No features match the current filters.'; tr.append(td); body.append(tr); }
  tb.append(body); root.append(tb);
  root.append(el('p', 'prm-foot', 'Ynmo Roadmaps · bars are coloured by product · ' + (todayK >= 0 ? 'the red line is ' + dlabel(todayK) : 'today is outside this roadmap')));
  return root;
}
/** Open the print dialog with the executive layout; choose "Save as PDF" there. */
export function exportPdf() {
  if (document.getElementById('printrm')) return;
  const view = buildPrintView(); document.body.append(view); document.body.classList.add('print-roadmap');
  const done = () => { document.body.classList.remove('print-roadmap'); view.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  notify('In the print window choose "Save as PDF" (landscape). Colours are kept automatically.');
  setTimeout(() => { try { window.print(); } catch (e) { done(); } if (!('onafterprint' in window)) setTimeout(done, 1500); }, 150);
}
