/**
 * @module pages/monthly
 * Monthly deliverables: a board like Ideas, one column per month (this month first, then the next ones; "+ Add month" adds one more).
 * Each card is a deliverable, coloured by its product, with its own percentage. "Sync from Roadmap" in a column brings the roadmap features that END in
 * that month, once each (a feature written on several bars or people is one card), with an estimated percentage a person can change.
 * A month is the doc `reports/mo<yyyymm>` (see features/month-model.js). The board always saves a month as `submitted`, so executives (viewers) see it all.
 */
import { S } from '../core/state.js';
import { $, LANES, el, iso, items } from '../core/model.js';
import { fmtIso, logAct, pageHead, todayIso } from '../core/shared.js';
import { write } from '../core/saving.js';
import { canWrite, isViewer } from '../features/safety.js';
import { allRoadmaps, withRm } from './roadmaps.js';
import { notify } from '../ui/notify.js';
import { openCtx, mi } from '../ui/editing.js';
import { confirmDlg } from '../ui/confirm.js';
import { plainBox } from '../features/rich-text.js';
import { EXTRA_SECTIONS } from '../features/sprint-doc.js';
import { productsOf } from '../features/report-model.js';
import { adhocStats, clampPct, mergeRoad, monthId, monthLabel, monthProgress, monthRange, monthText, newLine, nextMonth, pctBand } from '../features/month-model.js';
import { setupBanner } from './reports.js';

const ui = { q: '', pr: 'all', past: false, prod: '' };
const cfg = () => S.ideas.reportcfg || {};
const canBuild = () => !isViewer() && canWrite();
const curMonth = () => todayIso().slice(0, 7);
const colOf = p => { const l = LANES.concat(EXTRA_SECTIONS).find(x => (p.squads || []).includes(x.k)); return l ? l.c : '#55608a'; };
const docs = () => Object.keys(S.reports).filter(id => S.reports[id] && S.reports[id].mo).map(id => Object.assign({ id: id }, S.reports[id], { lines: S.reports[id].lines || [] }));
const docOf = m => docs().find(d => d.mo === m) || { id: monthId(m), mo: m, lines: [] };
/** Every product a card can belong to: the report products, the extra sections, and any product an existing card still uses. */
function boardProducts() {
  const pl = productsOf(cfg()).slice();
  EXTRA_SECTIONS.forEach(x => { if (!pl.some(q => q.k === x.k)) pl.push({ k: x.k, n: x.n, squads: [x.k] }); });
  docs().forEach(d => d.lines.forEach(l => { if (l.k && !pl.some(q => q.k === l.k)) pl.push({ k: l.k, n: l.k, squads: [] }); }));
  return pl;
}
/** The months on the board: from this month to the last month that has a card or a column (never fewer than this month and the next). */
function visibleMonths() {
  const all = docs().map(d => d.mo), c = curMonth(); let last = nextMonth(c);
  all.forEach(m => { if (m > last) last = m; });
  const first = ui.past ? all.concat([c]).sort()[0] : c, out = [];
  for (let m = first; m <= last; m = nextMonth(m)) out.push(m);
  return out;
}
const pastCount = () => docs().filter(d => d.mo < curMonth() && d.lines.some(l => String(l.t || '').trim())).length;

/** Changes a month through `mutate(doc)` and saves it (creating the doc the first time). */
function saveMonth(m, mutate, log) {
  const id = monthId(m), old = S.reports[id], d = old ? JSON.parse(JSON.stringify(old)) : { mo: m, lines: [] };
  d.lines = d.lines || []; d.pl = (d.pl && d.pl.length) ? d.pl : productsOf(cfg()); mutate(d);
  d.status = 'submitted'; d.subAt = d.subAt || new Date().toISOString(); d.subBy = d.subBy || (S.me && (S.me.name || S.me.email)) || '';
  d.by = (S.me && (S.me.name || S.me.email)) || ''; d.ts = Date.now(); S.reports[id] = d; write('reports/' + id, d);
  if (log) logAct('report', log);
}
/** Features of every roadmap that touches the month, as ISO dates (ids are prefixed with the roadmap so two roadmaps never clash). */
function roadFeatures(m) {
  const r = monthRange(m), out = [];
  allRoadmaps().filter(x => x.a <= r.b && x.b >= r.a).forEach(rm => withRm(rm.id, () => items().forEach(i => { if (i.d0 === undefined) return; out.push({ id: rm.id + ':' + i.id, t: i.t, sq: i.sq, a: iso(i.d0), b: iso(i.d1), st: i.st, ms: !!i.ms }); })));
  return out;
}
function syncMonth(m) {
  const others = []; docs().forEach(d => { if (d.mo !== m) d.lines.forEach(l => others.push(l)); });
  let res = null;
  saveMonth(m, d => { res = mergeRoad(d.lines, roadFeatures(m), boardProducts(), m, todayIso(), others); d.lines = res.lines; d.syncAt = new Date().toISOString(); }, 'synced the monthly deliverables for ' + monthLabel(m) + ' from the roadmap');
  const parts = [res.added + ' added', res.updated + ' estimates refreshed']; if (res.dup) parts.push(res.dup + ' already on the board'); if (res.skipped) parts.push(res.skipped + ' not in any product');
  notify(res.added || res.updated ? 'Roadmap sync for ' + monthLabel(m) + ': ' + parts.join(', ') : res.dup || res.skipped ? 'Nothing new for ' + monthLabel(m) + ': ' + parts.slice(2).join(', ') : 'No roadmap feature ends in ' + monthLabel(m), res.added || res.updated ? 'ok' : 'info');
  renderMonthly();
}
function deleteMonth(m) {
  confirmDlg('Delete ' + monthLabel(m) + '?', 'Every card of ' + monthLabel(m) + ' is deleted for everyone, including the executives who can see them.', 'Delete month', () => {
    delete S.reports[monthId(m)]; write('reports/' + monthId(m), null); logAct('report', 'deleted the monthly deliverables for ' + monthLabel(m)); notify('Month deleted'); renderMonthly();
  });
}
const copyMonth = m => { const txt = monthText(docOf(m), boardProducts(), fmtIso).join('\n') || monthLabel(m) + '\nNo deliverables yet.'; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => notify('Month text copied to the clipboard'), () => notify('Could not copy. Select the text and copy it manually.', 'err')); };
const moveCard = (from, id, to) => {
  if (from === to) return; let line = null;
  saveMonth(from, d => { line = d.lines.find(l => l.id === id); d.lines = d.lines.filter(l => l.id !== id); }, null);
  if (!line) return; saveMonth(to, d => { d.lines.push(line); }, 'moved "' + line.t + '" to the ' + monthLabel(to) + ' deliverables'); renderMonthly();
};

const pctSelect = (v, label, onChange) => {
  const st = el('select', 'spsel mpct pc-' + pctBand(v)); st.setAttribute('aria-label', label);
  const steps = []; for (let x = 0; x <= 100; x += 10) steps.push(x); if (!steps.includes(v)) { steps.push(v); steps.sort((a, b) => a - b); }
  steps.forEach(x => { const o = el('option', '', x + '%'); o.value = String(x); o.selected = x === v; st.append(o); });
  st.addEventListener('change', () => onChange(Number(st.value))); return st;
};
function card(m, l, prods, ed) {
  const p = prods.find(x => x.k === l.k) || { k: l.k, n: l.k, squads: [] }, c = colOf(p), pct = clampPct(l.pct);
  const r = el('div', 'icard mdcard' + (l.adhoc ? ' adhoc' : '') + (pct >= 100 ? ' fin' : '')); r.style.setProperty('--c', c); r.dataset.id = l.id;
  const put = (patch, label) => { saveMonth(m, d => { const x = d.lines.find(z => z.id === l.id); if (x) Object.assign(x, patch); }, label); renderMonthly(); };
  const head = el('div', 'mdhead');
  if (ed) {
    const ps = el('select', 'mdprod'); ps.setAttribute('aria-label', 'Product'); prods.forEach(q => { const o = el('option', '', q.n); o.value = q.k; o.selected = q.k === l.k; ps.append(o); });
    ps.addEventListener('change', () => put({ k: ps.value }, 'moved "' + l.t + '" to ' + (prods.find(q => q.k === ps.value) || {}).n)); head.append(ps);
  } else head.append(el('span', 'mdprod ro', p.n));
  const t = ed ? plainBox('mdtext', l.t, 'Deliverable', v => { if (!v) { t.textContent = l.t; return; } put({ t: v.slice(0, 300) }); }) : el('div', 'mdtext', l.t);
  const foot = el('div', 'mdfoot');
  if (ed) {
    const more = el('button', 'kebab', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'More actions for ' + l.t); more.setAttribute('aria-haspopup', 'menu'); head.append(more);
    more.addEventListener('click', e => {
      e.stopPropagation(); const b = more.getBoundingClientRect();
      openCtx(b.right - 200, b.bottom + 4, mm => {
        mi(mm, l.adhoc ? 'Mark as planned' : 'Mark as ad hoc request', () => put({ adhoc: !l.adhoc }, l.adhoc ? 'marked as planned' : 'marked as an ad hoc request'));
        const others = visibleMonths().filter(x => x !== m); if (others.length) mm.append(el('div', 'mlab', 'Move to month'));
        others.forEach(x => mi(mm, monthLabel(x), () => moveCard(m, l.id, x)));
        mm.append(el('div', 'msep'));
        mi(mm, 'Delete card', () => confirmDlg('Delete this card?', '"' + l.t + '" is deleted from ' + monthLabel(m) + '.', 'Delete card', () => { saveMonth(m, d => { d.lines = d.lines.filter(z => z.id !== l.id); }, 'removed "' + l.t + '" from the ' + monthLabel(m) + ' deliverables'); renderMonthly(); }), 'danger');
      });
    });
    foot.append(pctSelect(pct, 'Percent complete', v => put({ pct: v, pe: true }, 'changed "' + l.t + '" to ' + v + '%')));
  } else foot.append(el('span', 'rvp pc-' + pctBand(pct), pct + '%'));
  if (l.adhoc) foot.append(el('span', 'chip mdadhoc', 'Ad hoc'));
  if (l.src) { const b = el('span', 'chip mdroad', l.pe ? 'Roadmap' : 'Roadmap · estimated'); b.title = l.pe ? 'Came from the roadmap; the percentage was set by a person.' : 'Came from the roadmap; the percentage is estimated from its dates. Change it to set your own.'; foot.append(b); }
  r.append(head, t, foot);
  if (ed) { // drag the card to another month
    const g = el('div', 'grip', '⋮⋮'); g.title = 'Drag to another month'; g.setAttribute('aria-hidden', 'true'); r.prepend(g);
    const on = () => { r.draggable = true; }, off = () => { r.draggable = false; };
    g.addEventListener('pointerdown', on); document.addEventListener('pointerup', off, true);
    r.addEventListener('dragstart', e => { if (!r.draggable) return; e.dataTransfer.setData('text/mdcard', m + '|' + l.id); e.dataTransfer.effectAllowed = 'move'; r.classList.add('dragging'); });
    r.addEventListener('dragend', () => { off(); r.classList.remove('dragging'); document.querySelectorAll('.dropcol').forEach(x => x.classList.remove('dropcol')); });
  }
  return r;
}
function column(m, prods, ed) {
  const d = docOf(m), now = m === curMonth(), col = el('div', 'col mdcol' + (now ? ' now' : '')); col.dataset.mo = m; col.style.setProperty('--c', now ? 'var(--brand)' : '#55608a');
  const fq = ui.q.trim().toLowerCase();
  const lines = d.lines.filter(l => String(l.t || '').trim()), shown = lines.filter(l => (ui.pr === 'all' || l.k === ui.pr) && (!fq || String(l.t).toLowerCase().includes(fq)));
  const h = el('h2'); h.append(document.createTextNode(monthLabel(m)), el('span', 'badge', String(lines.length)));
  if (now) h.append(el('span', 'chip mdnow', 'This month'));
  if (ed) {
    const more = el('button', 'btn sm colmore', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'Month options for ' + monthLabel(m)); more.title = 'Month options';
    more.addEventListener('click', e => { e.stopPropagation(); const b = more.getBoundingClientRect(); openCtx(b.right - 190, b.bottom + 4, mm => { mi(mm, 'Sync from Roadmap', () => syncMonth(m)); mi(mm, 'Copy text', () => copyMonth(m)); if (S.reports[monthId(m)]) { mm.append(el('div', 'msep')); mi(mm, 'Delete month', () => deleteMonth(m), 'danger'); } }); });
    h.append(more); h.style.cssText = 'display:flex;align-items:center;gap:8px'; more.style.marginInlineStart = 'auto';
  }
  col.append(h);
  const prog = monthProgress(lines), ad = adhocStats(lines), pv = prog.pct === null ? 0 : prog.pct, pr = el('div', 'mdprog pc-' + pctBand(pv));
  const b0 = el('div', 'mbar pc-' + pctBand(pv)), i0 = el('i'); i0.style.width = pv + '%'; b0.append(i0); b0.setAttribute('aria-label', 'Progress of ' + monthLabel(m));
  pr.append(b0, el('b', 'mdpct', pv + '%'), el('small', '', prog.pct === null ? 'No planned deliverables yet' : prog.done + ' of ' + prog.n + ' done' + (ad.n ? ' · ' + ad.n + ' ad hoc' : ''))); col.append(pr);
  if (ed) {
    const sy = el('button', 'btn sm mdsync', '↻ Sync from Roadmap'); sy.type = 'button'; sy.title = 'Brings in the roadmap features that end in ' + monthLabel(m) + ', each once. Percentages you set are never overwritten.'; sy.addEventListener('click', () => syncMonth(m)); col.append(sy);
    const f = el('form', 'mdadd'), ps = el('select', 'mdpsel'), ti = el('input'); ps.setAttribute('aria-label', 'Product for the new card');
    prods.forEach(q => { const o = el('option', '', q.n); o.value = q.k; o.selected = q.k === (ui.prod || prods[0].k); ps.append(o); });
    ps.addEventListener('change', () => { ui.prod = ps.value; ps.style.setProperty('--c', colOf(prods.find(q => q.k === ps.value))); }); ps.style.setProperty('--c', colOf(prods.find(q => q.k === (ui.prod || prods[0].k)) || prods[0]));
    ti.type = 'text'; ti.maxLength = 300; ti.placeholder = 'Add a deliverable and press Enter'; ti.setAttribute('aria-label', 'New deliverable for ' + monthLabel(m));
    f.append(ps, ti);
    f.addEventListener('submit', e => { e.preventDefault(); const v = ti.value.trim(); if (!v) { ti.focus(); return; } ui.prod = ps.value; saveMonth(m, dd => { dd.lines.push(newLine(ps.value, v, {})); }, 'added a deliverable to ' + monthLabel(m)); renderMonthly(); const n = $('pg-monthly').querySelector('.mdcol[data-mo="' + m + '"] .mdadd input'); if (n) n.focus(); });
    col.append(f);
  }
  shown.forEach(l => col.append(card(m, l, prods, ed)));
  if (!shown.length) col.append(el('div', 'hint', lines.length ? 'Nothing matches the filter.' : 'Nothing here yet.'));
  if (ed) {
    const ok = e => [...(e.dataTransfer ? e.dataTransfer.types : [])].includes('text/mdcard');
    col.addEventListener('dragover', e => { if (!ok(e)) return; e.preventDefault(); col.classList.add('dropcol'); });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('dropcol'); });
    col.addEventListener('drop', e => { col.classList.remove('dropcol'); const v = e.dataTransfer.getData('text/mdcard'); if (!v) return; e.preventDefault(); const i = v.indexOf('|'); moveCard(v.slice(0, i), v.slice(i + 1), m); });
  }
  return col;
}
const migrated = new Set();
export function renderMonthly() {
  const pg = $('pg-monthly'); if (!pg) return;
  const prevBoard = pg.querySelector('.mdboard'), sx = prevBoard ? prevBoard.scrollLeft : 0, sy = window.scrollY;
  pg.textContent = '';
  const viewer = isViewer(), ed = !viewer && canBuild();
  if (ed) docs().forEach(d => { if (d.status !== 'submitted' && !migrated.has(d.id)) { migrated.add(d.id); S.reports[d.id] = Object.assign({}, S.reports[d.id], { status: 'submitted', subAt: d.subAt || new Date().toISOString() }); write('reports/' + d.id, S.reports[d.id]); } });
  const prods = boardProducts(), tools = el('div', 'formrow');
  const q = el('input'); q.type = 'search'; q.placeholder = 'Search deliverables'; q.value = ui.q; q.setAttribute('aria-label', 'Search deliverables');
  q.addEventListener('input', () => { ui.q = q.value; renderMonthly(); const s = pg.querySelector('input[type=search]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } });
  const fp = el('select'); fp.setAttribute('aria-label', 'Filter by product'); [['all', 'All products']].concat(prods.map(p => [p.k, p.n])).forEach(x => { const o = el('option', '', x[1]); o.value = x[0]; o.selected = x[0] === ui.pr; fp.append(o); });
  fp.addEventListener('change', () => { ui.pr = fp.value; renderMonthly(); });
  tools.append(q, fp);
  const pc = pastCount(); if (pc || ui.past) { const pb = el('button', 'btn sm', ui.past ? 'Hide past months' : 'Show past months (' + pc + ')'); pb.type = 'button'; pb.addEventListener('click', () => { ui.past = !ui.past; renderMonthly(); }); tools.append(pb); }
  pg.append(pageHead('Monthly deliverables', viewer ? 'What each product committed to deliver every month, coloured by product, and how far each deliverable is.' : 'What the business expects each month. Add a card for a product, or press Sync from Roadmap in a month to bring the features that end in it. Drag a card to move it to another month.', tools));
  const sb0 = viewer ? null : setupBanner(); if (sb0) pg.append(sb0);
  const board = el('div', 'mdboard'); visibleMonths().forEach(m => board.append(column(m, prods, ed)));
  if (ed) { const ms = visibleMonths(), nm = nextMonth(ms[ms.length - 1]); const ac = el('button', 'addcol mdaddmonth', '+ Add month (' + monthLabel(nm) + ')'); ac.type = 'button'; ac.id = 'addmonth'; ac.addEventListener('click', () => { saveMonth(nm, () => {}, 'added the ' + monthLabel(nm) + ' column to the monthly deliverables'); renderMonthly(); }); board.append(ac); }
  pg.append(board);
  if (sx) { const nb = pg.querySelector('.mdboard'); if (nb) nb.scrollLeft = sx; } if (sy && Math.abs(window.scrollY - sy) > 1) window.scrollTo(0, sy);
}
