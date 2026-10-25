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
import { openDlg, closeDlg } from '../features/safety.js';
import { EXTRA_SECTIONS } from '../features/sprint-doc.js';
import { productsOf } from '../features/report-model.js';
import { adhocStats, clampPct, mergeRoad, monthId, monthLabel, monthProgress, monthRange, monthText, newLine, nextMonth, pctBand, SIZES } from '../features/month-model.js';
import { NOTE_ICON, setupBanner } from './reports.js';

const ui = { q: '', pr: 'all', fl: 'all', past: false, prod: '', open: '' };
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
/** Moves a card to month `to`, before the card `before` (or to the end). Within one month this re-orders. */
const moveCard = (from, id, to, before) => {
  if (from === to && before === id) return; let line = null;
  saveMonth(from, d => { line = d.lines.find(l => l.id === id); d.lines = d.lines.filter(l => l.id !== id); }, null);
  if (!line) return;
  saveMonth(to, d => { const i = before ? d.lines.findIndex(l => l.id === before) : -1; if (i >= 0) d.lines.splice(i, 0, line); else d.lines.push(line); }, from === to ? null : 'moved "' + line.t + '" to the ' + monthLabel(to) + ' deliverables'); renderMonthly();
};

const pctSelect = (v, label, onChange) => {
  const st = el('select', 'spsel mpct pc-' + pctBand(v)); st.setAttribute('aria-label', label);
  const steps = []; for (let x = 0; x <= 100; x += 10) steps.push(x); if (!steps.includes(v)) { steps.push(v); steps.sort((a, b) => a - b); }
  steps.forEach(x => { const o = el('option', '', x + '%'); o.value = String(x); o.selected = x === v; st.append(o); });
  st.addEventListener('change', () => onChange(Number(st.value))); return st;
};
/** Note icon of a card: green when it has a note; hover (or focus) shows the note as a tooltip; editors click it to write or change the note. */
function noteBtn(m, l, ed) {
  const b = el('button', 'nbtn mdnote' + (l.note ? ' has' : '') + (ed ? '' : ' ro')); b.type = 'button'; b.innerHTML = NOTE_ICON;
  if (l.note) b.dataset.tip = l.note;
  if (!ed) { b.tabIndex = l.note ? 0 : -1; b.hidden = !l.note; b.setAttribute('aria-label', 'Note: ' + (l.note || '')); return b; }
  b.setAttribute('aria-label', l.note ? 'Edit note: ' + l.note : 'Add a note'); if (!l.note) b.title = 'Add a note';
  b.addEventListener('click', () => openDlg('Note for this card', box => {
    const ta = el('textarea'); ta.rows = 4; ta.maxLength = 1000; ta.value = l.note || ''; ta.setAttribute('aria-label', 'Note'); ta.placeholder = 'A short note. It appears when someone hovers the note icon.';
    const ok = el('button', 'btn primary', 'Save'), no = el('button', 'btn', 'Cancel'), rm = el('button', 'btn', 'Remove note'); ok.type = no.type = rm.type = 'button'; rm.hidden = !l.note;
    const put = v => { saveMonth(m, d => { const x = d.lines.find(z => z.id === l.id); if (x) x.note = v; }, v ? 'edited the note of "' + l.t + '"' : 'removed the note of "' + l.t + '"'); closeDlg(); renderMonthly(); };
    ok.addEventListener('click', () => put(ta.value.trim())); rm.addEventListener('click', () => put('')); no.addEventListener('click', closeDlg);
    const row = el('div', 'row'); row.append(ok, rm, no); box.append(ta, row);
  }));
  return b;
}
function card(m, l, prods, ed) {
  const p = prods.find(x => x.k === l.k) || { k: l.k, n: l.k, squads: [] }, c = colOf(p), pct = clampPct(l.pct);
  const r = el('div', 'icard mdcard' + (l.adhoc ? ' adhoc' : '') + (pct >= 100 ? ' fin' : '') + (l.hp ? ' hp' : '')); r.style.setProperty('--c', c); r.dataset.id = l.id;
  const put = (patch, label) => { saveMonth(m, d => { const x = d.lines.find(z => z.id === l.id); if (x) Object.assign(x, patch); }, label); renderMonthly(); };
  const head = el('div', 'mdhead');
  if (ed) {
    const ps = el('button', 'mdprod'); ps.type = 'button'; ps.textContent = p.n; ps.title = 'Change the product (and so the colour) of this card'; ps.setAttribute('aria-haspopup', 'menu'); ps.setAttribute('aria-label', 'Product: ' + p.n + '. Change');
    ps.addEventListener('click', e => {
      e.stopPropagation(); const b = ps.getBoundingClientRect();
      openCtx(b.left, b.bottom + 4, mm => { mm.append(el('div', 'mlab', 'Product colour')); prods.forEach(q => { const x = mi(mm, (q.k === l.k ? '✓ ' : '') + q.n, () => { if (q.k !== l.k) put({ k: q.k }, 'moved "' + l.t + '" to ' + q.n); }); x.classList.add('mdpick'); x.style.setProperty('--c', colOf(q)); }); });
    });
    head.append(ps);
  } else head.append(el('span', 'mdprod ro', p.n));
  const t = ed ? plainBox('mdtext', l.t, 'Deliverable', v => { if (!v) { t.textContent = l.t; return; } put({ t: v.slice(0, 300) }); }) : el('div', 'mdtext', l.t);
  const foot = el('div', 'mdfoot');
  if (ed) {
    const hp = el('button', 'mdhp' + (l.hp ? ' on' : ''), l.hp ? '⚑' : '⚐'); hp.type = 'button'; hp.setAttribute('aria-pressed', String(!!l.hp)); hp.setAttribute('aria-label', 'High priority'); hp.title = l.hp ? 'High priority. Click again to remove the gold flag.' : 'Click to flag as high priority (gold flag)';
    hp.addEventListener('click', () => put({ hp: !l.hp }, l.hp ? 'removed the high priority flag' : 'flagged "' + l.t + '" as high priority')); head.append(hp);
    const more = el('button', 'kebab', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'More actions for ' + l.t); more.setAttribute('aria-haspopup', 'menu'); head.append(more);
    more.addEventListener('click', e => {
      e.stopPropagation(); const b = more.getBoundingClientRect();
      openCtx(b.right - 200, b.bottom + 4, mm => {
        Object.keys(SIZES).forEach(k => mi(mm, (l.sz === k ? '✓ ' : '') + SIZES[k], () => put({ sz: l.sz === k ? '' : k }, l.sz === k ? 'removed the ' + SIZES[k] + ' flag' : 'flagged "' + l.t + '" as ' + SIZES[k])));
        mm.append(el('div', 'msep'));
        mi(mm, l.adhoc ? 'Mark as planned' : 'Mark as ad hoc request', () => put({ adhoc: !l.adhoc }, l.adhoc ? 'marked as planned' : 'marked as an ad hoc request'));
        const others = visibleMonths().filter(x => x !== m); if (others.length) mm.append(el('div', 'mlab', 'Move to month'));
        others.forEach(x => mi(mm, monthLabel(x), () => moveCard(m, l.id, x)));
        mm.append(el('div', 'msep'));
        mi(mm, 'Delete card', () => confirmDlg('Delete this card?', '"' + l.t + '" is deleted from ' + monthLabel(m) + '.', 'Delete card', () => { saveMonth(m, d => { d.lines = d.lines.filter(z => z.id !== l.id); }, 'removed "' + l.t + '" from the ' + monthLabel(m) + ' deliverables'); renderMonthly(); }), 'danger');
      });
    });
    foot.append(pctSelect(pct, 'Percent complete', v => put({ pct: v, pe: true }, 'changed "' + l.t + '" to ' + v + '%')));
  } else foot.append(el('span', 'rvp pc-' + pctBand(pct), pct + '%'));
  if (l.hp && !ed) foot.append(el('span', 'chip mdhpchip', '⚑ High priority'));
  if (SIZES[l.sz]) foot.append(el('span', 'chip mdsz mdsz-' + l.sz, SIZES[l.sz]));
  if (l.adhoc) foot.append(el('span', 'chip mdadhoc', 'Ad hoc'));
  if (l.src) { const b = el('span', 'chip mdroad', l.pe ? 'Roadmap' : 'Roadmap · estimated'); b.title = l.pe ? 'Came from the roadmap; the percentage was set by a person.' : 'Came from the roadmap; the percentage is estimated from its dates. Change it to set your own.'; foot.append(b); }
  foot.append(noteBtn(m, l, ed));
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
/** Trello-style composer at the bottom of a column: "+ Add a card" opens a box with the product colours; Enter adds and keeps the box open for the next card. */
function composer(m, prods) {
  const wrap = el('div', 'mdcomp');
  if (ui.open !== m) {
    const b = el('button', 'mdopen', '+ Add a card'); b.type = 'button'; b.addEventListener('click', () => { ui.open = m; ui.focusComp = true; renderMonthly(); }); wrap.append(b); return wrap;
  }
  const f = el('form', 'mdadd'), ta = el('textarea'), chips = el('div', 'mdchips'), byK = k => prods.find(q => q.k === k) || prods[0];
  ui.prod = byK(ui.prod).k; f.style.setProperty('--c', colOf(byK(ui.prod)));
  ta.rows = 2; ta.maxLength = 1200; ta.placeholder = 'Enter a title for this card. One card per line if you paste a list.'; ta.setAttribute('aria-label', 'New card for ' + monthLabel(m));
  prods.forEach(q => {
    const c = el('button', 'mdchip' + (q.k === ui.prod ? ' on' : ''), q.n); c.type = 'button'; c.style.setProperty('--c', colOf(q)); c.dataset.k = q.k; c.setAttribute('aria-pressed', String(q.k === ui.prod));
    c.addEventListener('click', () => { ui.prod = q.k; f.style.setProperty('--c', colOf(q)); chips.querySelectorAll('.mdchip').forEach(x => { const on = x.dataset.k === q.k; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); ta.focus(); }); chips.append(c);
  });
  const go = el('button', 'btn primary sm', 'Add card'), no = el('button', 'btn sm', '✕'); go.type = 'submit'; no.type = 'button'; no.setAttribute('aria-label', 'Close'); no.title = 'Close (Esc)';
  const close = () => { ui.open = ''; renderMonthly(); };
  no.addEventListener('click', close);
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } else if (e.key === 'Escape') { e.preventDefault(); close(); } });
  f.addEventListener('submit', e => {
    e.preventDefault(); const ts = ta.value.split('\n').map(x => x.replace(/^\s*[-*•\d.)]+\s+/, '').trim()).filter(Boolean); if (!ts.length) { ta.focus(); return; }
    ta.value = ''; saveMonth(m, d => { ts.forEach(t => d.lines.push(newLine(ui.prod, t, {}))); }, 'added ' + (ts.length === 1 ? 'a deliverable' : ts.length + ' deliverables') + ' to ' + monthLabel(m)); ui.focusComp = true; renderMonthly();
  });
  const row = el('div', 'mdcrow'); row.append(go, no); f.append(ta, chips, row); wrap.append(f); return wrap;
}
function column(m, prods, ed) {
  const d = docOf(m), now = m === curMonth(), col = el('div', 'col mdcol' + (now ? ' now' : '')); col.dataset.mo = m; col.style.setProperty('--c', now ? 'var(--brand)' : '#55608a');
  const fq = ui.q.trim().toLowerCase();
  const lines = d.lines.filter(l => String(l.t || '').trim()), shown = lines.filter(l => (ui.pr === 'all' || l.k === ui.pr) && (ui.fl === 'all' || (ui.fl === 'hp' ? l.hp : l.sz === ui.fl)) && (!fq || String(l.t).toLowerCase().includes(fq)));
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
  }
  shown.forEach(l => col.append(card(m, l, prods, ed)));
  if (!shown.length && !(ed && ui.open === m)) col.append(el('div', 'hint', lines.length ? 'Nothing matches the filter.' : 'Nothing here yet.'));
  if (ed) col.append(composer(m, prods));
  if (ed) {
    const ok = e => [...(e.dataTransfer ? e.dataTransfer.types : [])].includes('text/mdcard');
    const line = el('div', 'mddrop'), beforeOf = e => { const cs = [...col.querySelectorAll('.mdcard:not(.dragging)')]; return cs.find(c => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; }) || null; };
    col.addEventListener('dragover', e => { if (!ok(e)) return; e.preventDefault(); col.classList.add('dropcol'); const c = beforeOf(e); if (c) c.before(line); else col.append(line); });
    col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) { col.classList.remove('dropcol'); line.remove(); } });
    col.addEventListener('drop', e => { const c = beforeOf(e); line.remove(); col.classList.remove('dropcol'); const v = e.dataTransfer.getData('text/mdcard'); if (!v) return; e.preventDefault(); const i = v.indexOf('|'); moveCard(v.slice(0, i), v.slice(i + 1), m, c ? c.dataset.id : ''); });
  }
  return col;
}
const migrated = new Set();
export function renderMonthly() {
  const pg = $('pg-monthly'); if (!pg) return;
  const act = document.activeElement, ta0 = act && act.matches && act.matches('.mdcomp textarea') ? act : null, draft = ta0 ? { v: ta0.value, s: ta0.selectionStart, m: ta0.closest('.mdcol').dataset.mo } : null;
  const prevBoard = pg.querySelector('.mdboard'), sx = prevBoard ? prevBoard.scrollLeft : 0, sy = window.scrollY;
  pg.textContent = '';
  const viewer = isViewer(), ed = !viewer && canBuild();
  if (ed) docs().forEach(d => { if (d.status !== 'submitted' && !migrated.has(d.id)) { migrated.add(d.id); S.reports[d.id] = Object.assign({}, S.reports[d.id], { status: 'submitted', subAt: d.subAt || new Date().toISOString() }); write('reports/' + d.id, S.reports[d.id]); } });
  const prods = boardProducts(), tools = el('div', 'formrow');
  const q = el('input'); q.type = 'search'; q.placeholder = 'Search deliverables'; q.value = ui.q; q.setAttribute('aria-label', 'Search deliverables');
  q.addEventListener('input', () => { ui.q = q.value; renderMonthly(); const s = pg.querySelector('input[type=search]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } });
  const fp = el('select'); fp.setAttribute('aria-label', 'Filter by product'); [['all', 'All products']].concat(prods.map(p => [p.k, p.n])).forEach(x => { const o = el('option', '', x[1]); o.value = x[0]; o.selected = x[0] === ui.pr; fp.append(o); });
  fp.addEventListener('change', () => { ui.pr = fp.value; renderMonthly(); });
  const ff = el('select'); ff.setAttribute('aria-label', 'Filter by flag'); [['all', 'All cards'], ['hp', 'High priority'], ['quick', 'Quick wins'], ['enh', 'Enhancements']].forEach(x => { const o = el('option', '', x[1]); o.value = x[0]; o.selected = x[0] === ui.fl; ff.append(o); });
  ff.addEventListener('change', () => { ui.fl = ff.value; renderMonthly(); });
  tools.append(q, fp, ff);
  const pc = pastCount(); if (pc || ui.past) { const pb = el('button', 'btn sm', ui.past ? 'Hide past months' : 'Show past months (' + pc + ')'); pb.type = 'button'; pb.addEventListener('click', () => { ui.past = !ui.past; renderMonthly(); }); tools.append(pb); }
  pg.append(pageHead('Monthly deliverables', viewer ? 'What each product committed to deliver every month, coloured by product, and how far each deliverable is.' : 'What the business expects each month. Add a card for a product, or press Sync from Roadmap in a month to bring the features that end in it. Drag a card to move it to another month.', tools));
  const sb0 = viewer ? null : setupBanner(); if (sb0) pg.append(sb0);
  const board = el('div', 'mdboard'); visibleMonths().forEach(m => board.append(column(m, prods, ed)));
  if (ed) { const ms = visibleMonths(), nm = nextMonth(ms[ms.length - 1]); const ac = el('button', 'addcol mdaddmonth', '+ Add month (' + monthLabel(nm) + ')'); ac.type = 'button'; ac.id = 'addmonth'; ac.addEventListener('click', () => { saveMonth(nm, () => {}, 'added the ' + monthLabel(nm) + ' column to the monthly deliverables'); renderMonthly(); }); board.append(ac); }
  pg.append(board);
  const cta = pg.querySelector('.mdcomp textarea');
  if (cta && draft && draft.v && ui.open === draft.m) { cta.value = draft.v; cta.setSelectionRange(draft.s, draft.s); cta.focus({ preventScroll: true }); }
  else if (cta && ui.focusComp) { ui.focusComp = false; cta.focus({ preventScroll: true }); cta.scrollIntoView({ block: 'nearest' }); }
  if (sx) { const nb = pg.querySelector('.mdboard'); if (nb) nb.scrollLeft = sx; } if (sy && Math.abs(window.scrollY - sy) > 1) window.scrollTo(0, sy);
}
