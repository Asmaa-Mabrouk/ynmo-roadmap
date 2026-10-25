/**
 * @module pages/monthly
 * Monthly deliverables: a board like Ideas, one column per month (this month first, then the next ones; "+ Add month" adds one more).
 * Each card is a deliverable with a tag (Daycare, Tifli, Plan, AI, Finance, New initiative) that colours it, a tracking id like DC#12, flags, a note and its own
 * percentage. A card can be put on the roadmap ("Add to roadmap…": start, end, assignee), which creates a bar linked to the card.
 * A month is the doc `reports/mo<yyyymm>` (see features/month-model.js). The board always saves a month as `submitted`, so executives (viewers) see it all.
 */
import { S } from '../core/state.js';
import { $, LANES, NDAYS, canEdit, directory, el, items, state } from '../core/model.js';
import { fld, fmtIso, kOfIso, logAct, pageHead, selOf, toast, todayIso } from '../core/shared.js';
import { persist, pushHistory, write } from '../core/saving.js';
import { canWrite, isViewer } from '../features/safety.js';
import { allRoadmaps, curRm, useRoadmap, withRm } from './roadmaps.js';
import { render } from '../ui/gantt-render.js';
import { showPage } from '../app/shell.js';
import { notify } from '../ui/notify.js';
import { openCtx, mi, primarySq } from '../ui/editing.js';
import { confirmDlg } from '../ui/confirm.js';
import { plainBox } from '../features/rich-text.js';
import { openDlg, closeDlg } from '../features/safety.js';
import { adhocStats, cardId, clampPct, monthId, monthLabel, monthProgress, monthRange, monthText, newLine, nextMonth, pctBand, SIZES, TAGS, legacyTag } from '../features/month-model.js';
import { NOTE_ICON, setupBanner } from './reports.js';

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8-4.3-4.1 5.9-.8z"/></svg>';
const ui = { q: '', pr: 'all', fl: 'all', past: false, prod: '', open: '' };
const canBuild = () => !isViewer() && canWrite();
const curMonth = () => todayIso().slice(0, 7);
const colOf = p => (p && p.c) || '#7b8099';
const docs = () => Object.keys(S.reports).filter(id => S.reports[id] && S.reports[id].mo).map(id => Object.assign({ id: id }, S.reports[id], { lines: S.reports[id].lines || [] }));
const docOf = m => docs().find(d => d.mo === m) || { id: monthId(m), mo: m, lines: [] };
/** The tags a card can have (Daycare, Tifli, Plan, AI, Finance, New initiative), plus any older tag a card still carries until it is converted. */
function boardProducts() {
  const pl = TAGS.map(t => Object.assign({}, t));
  docs().forEach(d => d.lines.forEach(l => { if (l.k && !pl.some(q => q.k === l.k)) pl.push({ k: l.k, n: l.k, squads: [], c: '#7b8099' }); }));
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
/** Undo for the board: before every save the month's previous doc is remembered (one entry per action, so moving a card to another month is one step). */
const undoStack = []; let grp = null, replaying = false;
const remember = (id, old) => { if (replaying) return; const snap = { id, doc: old ? JSON.parse(JSON.stringify(old)) : null }; if (grp) { if (!grp.some(x => x.id === id)) grp.push(snap); } else { undoStack.push([snap]); if (undoStack.length > 50) undoStack.shift(); } };
const grouped = fn => { grp = []; try { fn(); } finally { if (grp.length) { undoStack.push(grp); if (undoStack.length > 50) undoStack.shift(); } grp = null; } };
export function undoMonthly() {
  const a = undoStack.pop(); if (!a) { notify('Nothing to undo'); return; }
  replaying = true; try { a.slice().reverse().forEach(x => { if (x.doc) { x.doc.ts = Date.now(); S.reports[x.id] = x.doc; write('reports/' + x.id, x.doc); } else { delete S.reports[x.id]; write('reports/' + x.id, null); } }); } finally { replaying = false; }
  logAct('report', 'undid the last change on the Monthly board'); renderMonthly(); notify('Undone');
}
function saveMonth(m, mutate, log, quiet) {
  const id = monthId(m), old = S.reports[id]; if (!quiet) remember(id, old);
  const d = old ? JSON.parse(JSON.stringify(old)) : { mo: m, lines: [] };
  d.lines = d.lines || []; d.pl = TAGS.map(t => ({ k: t.k, n: t.n, squads: t.squads })); mutate(d);
  d.status = 'submitted'; d.subAt = d.subAt || new Date().toISOString(); d.subBy = d.subBy || (S.me && (S.me.name || S.me.email)) || '';
  d.by = (S.me && (S.me.name || S.me.email)) || ''; d.ts = Date.now(); S.reports[id] = d; write('reports/' + id, d);
  if (log) logAct('report', log);
}
const maxNo = () => docs().reduce((a, d) => d.lines.reduce((b, l) => Math.max(b, +l.no || 0), a), 0);
/** Is the roadmap bar made from this card still there? */
const onRoadmap = l => !!(l.rid && S.over[l.rid] && !S.over[l.rid].x);
/** "Add to roadmap": the card becomes a bar on the roadmap that is open, with a start, an end and an assignee, and stays linked to the card. */
function addToRoadmap(m, l, tag) {
  if (!canEdit()) return; const r = curRm(), mr = monthRange(m);
  openDlg('Add to ' + r.n, box => {
    box.append(el('div', 'sub2', cardId(l) + ' · ' + l.t));
    const a0 = mr.a < r.a ? r.a : mr.a, b0 = mr.b > r.b ? r.b : mr.b, d0 = el('input'), d1 = el('input'); d0.type = d1.type = 'date'; d0.min = d1.min = r.a; d0.max = d1.max = r.b;
    d0.value = a0 <= r.b ? a0 : r.a; d1.value = b0 >= d0.value ? b0 : d0.value; d0.setAttribute('aria-label', 'Start date'); d1.setAttribute('aria-label', 'End date');
    const names = [...directory().keys()].sort((x, y) => x.localeCompare(y)), who = selOf([['__none', 'Unassigned']].concat(names.map(n => [n, n])), '__none'); who.setAttribute('aria-label', 'Assignee');
    const fromTag = (tag.squads || []).find(k => LANES.some(x => x.k === k)), sq = selOf(LANES.map(x => [x.k, x.n]), fromTag || LANES[0].k); sq.setAttribute('aria-label', 'Squad');
    if (!fromTag) who.addEventListener('change', () => { if (who.value !== '__none') sq.value = primarySq(who.value); });
    d0.addEventListener('change', () => { if (d1.value < d0.value) d1.value = d0.value; });
    const err = el('div', 'gerr'); err.setAttribute('aria-live', 'polite');
    const grid = el('div', 'padd'); grid.style.gridTemplateColumns = '1fr'; grid.append(fld('Assignee', who), fld('Squad', sq), fld('Start', d0), fld('End', d1));
    const ok = el('button', 'btn primary', 'Add to roadmap'), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button'; no.addEventListener('click', closeDlg);
    ok.addEventListener('click', () => {
      const k0 = kOfIso(d0.value), k1 = kOfIso(d1.value);
      if (isNaN(k0) || isNaN(k1)) { err.textContent = 'Choose a start and an end date inside ' + r.n + '.'; return; }
      if (k1 < k0) { err.textContent = 'The end must be on or after the start.'; return; }
      pushHistory();
      const nid = 'c' + Date.now().toString(36), none = who.value === '__none', all = items().filter(x => x.sq === sq.value);
      S.over[nid] = { custom: true, rm: state.rm, t: l.t, n: l.note || '', sq: sq.value, pr: sq.value === 'ai' ? ['tifli'] : [sq.value], d0: Math.max(0, k0), d1: Math.min(NDAYS - 1, k1), st: 'planned', res: none ? [] : [who.value], ord: all.length ? Math.max.apply(null, all.map(x => x.ord)) + 1 : 0, card: l.id };
      persist(nid);
      saveMonth(m, d => { const x = d.lines.find(z => z.id === l.id); if (x) { x.rid = nid; x.rm = state.rm; } }, null, true);
      logAct('roadmap', 'added "' + l.t + '" (' + cardId(l) + ') to ' + r.n + ' from ' + d0.value + ' to ' + d1.value + (none ? '' : ' for ' + who.value));
      closeDlg(); render(); renderMonthly(); toast('Added "' + l.t + '" to ' + r.n + '.');
    });
    const row = el('div', 'row'); row.append(ok, no); box.append(grid, err, row);
  });
}
function deleteMonth(m) {
  confirmDlg('Delete ' + monthLabel(m) + '?', 'Every card of ' + monthLabel(m) + ' is deleted for everyone, including the executives who can see them.', 'Delete month', () => {
    delete S.reports[monthId(m)]; write('reports/' + monthId(m), null); logAct('report', 'deleted the monthly deliverables for ' + monthLabel(m)); notify('Month deleted'); renderMonthly();
  });
}
const copyMonth = m => { const txt = monthText(docOf(m), boardProducts(), fmtIso).join('\n') || monthLabel(m) + '\nNo deliverables yet.'; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => notify('Month text copied to the clipboard'), () => notify('Could not copy. Select the text and copy it manually.', 'err')); };
/** Moves a card to month `to`, before the card `before` (or to the end). Within one month this re-orders. */
const moveCard = (from, id, to, before) => {
  if (from === to && before === id) return;
  const src = docOf(from), line = src && src.lines.find(l => l.id === id); if (!line) return; const copy = JSON.parse(JSON.stringify(line));
  const put = (d) => { const i = before ? d.lines.findIndex(l => l.id === before) : -1; if (i >= 0) d.lines.splice(i, 0, copy); else d.lines.push(copy); };
  grouped(() => {
    if (from === to) saveMonth(from, d => { d.lines = d.lines.filter(l => l.id !== id); put(d); }, null);
    else { saveMonth(to, d => { d.lines = d.lines.filter(l => l.id !== id); put(d); }, 'moved "' + line.t + '" to the ' + monthLabel(to) + ' deliverables'); saveMonth(from, d => { d.lines = d.lines.filter(l => l.id !== id); }, null); }
  }); renderMonthly();
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
  const r = el('div', 'icard mdcard' + (l.adhoc ? ' adhoc' : '') + (pct >= 100 ? ' fin' : '') + (l.hp ? ' hp' : ''));
  if (l.hp) r.append(el('div', 'mdribbon', '⚑ Business priority')); r.style.setProperty('--c', c); r.dataset.id = l.id;
  const put = (patch, label) => { saveMonth(m, d => { const x = d.lines.find(z => z.id === l.id); if (x) Object.assign(x, patch); }, label); renderMonthly(); };
  const head = el('div', 'mdhead');
  if (ed) {
    const ps = el('button', 'mdprod'); ps.type = 'button'; ps.append(p.n + ' ', Object.assign(el('span', 'mdcaret', '▾'), { ariaHidden: 'true' })); ps.title = 'Choose the tag (and so the colour) of this card'; ps.setAttribute('aria-haspopup', 'menu'); ps.setAttribute('aria-label', 'Tag: ' + p.n + '. Change');
    ps.addEventListener('click', e => {
      e.stopPropagation(); const b = ps.getBoundingClientRect();
      openCtx(b.left, b.bottom + 4, mm => { mm.append(el('div', 'mlab', 'Tag')); prods.forEach(q => { const x = mi(mm, (q.k === l.k ? '✓ ' : '') + q.n, () => { if (q.k !== l.k) put({ k: q.k }, 'moved "' + l.t + '" to ' + q.n); }); x.classList.add('mdpick'); x.style.setProperty('--c', colOf(q)); }); });
    });
    head.append(ps);
  } else head.append(el('span', 'mdprod ro', p.n));
  if (cardId(l)) { const idb = el(ed ? 'button' : 'span', 'mdid', cardId(l)); if (ed) { idb.type = 'button'; idb.title = 'Click to copy ' + cardId(l); idb.setAttribute('aria-label', 'Card id ' + cardId(l) + ', click to copy'); idb.addEventListener('click', () => { (navigator.clipboard ? navigator.clipboard.writeText(cardId(l)) : Promise.reject()).then(() => notify(cardId(l) + ' copied'), () => notify('Could not copy', 'err')); }); } head.append(idb); }
  const t = ed ? plainBox('mdtext', l.t, 'Deliverable', v => { if (!v) { t.textContent = l.t; return; } put({ t: v.slice(0, 300) }); }) : el('div', 'mdtext', l.t);
  const foot = el('div', 'mdfoot');
  if (ed) {
    const st = el('button', 'mdstar' + (l.sz === 'enh' ? ' on' : '')); st.type = 'button'; st.innerHTML = STAR; st.setAttribute('aria-pressed', String(l.sz === 'enh')); st.setAttribute('aria-label', 'Small enhancement'); st.title = l.sz === 'enh' ? 'Small enhancement. Click again to remove the star.' : 'Click to mark as a small enhancement (a small feature, not a big one)';
    st.addEventListener('click', () => put({ sz: l.sz === 'enh' ? '' : 'enh' }, l.sz === 'enh' ? 'removed the Small enhancement flag' : 'flagged "' + l.t + '" as Small enhancement')); head.append(st);
    const hp = el('button', 'mdhp' + (l.hp ? ' on' : ''), l.hp ? '⚑' : '⚐'); hp.type = 'button'; hp.setAttribute('aria-pressed', String(!!l.hp)); hp.setAttribute('aria-label', 'Business priority'); hp.title = l.hp ? 'Business priority. Click again to remove the gold flag.' : 'Click to flag as business priority (gold flag)';
    hp.addEventListener('click', () => put({ hp: !l.hp }, l.hp ? 'removed the business priority flag' : 'flagged "' + l.t + '" as business priority')); head.append(hp);
    const more = el('button', 'kebab', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'More actions for ' + l.t); more.setAttribute('aria-haspopup', 'menu'); head.append(more);
    more.addEventListener('click', e => {
      e.stopPropagation(); const b = more.getBoundingClientRect();
      openCtx(b.right - 200, b.bottom + 4, mm => {
        Object.keys(SIZES).forEach(k => mi(mm, (l.sz === k ? '✓ ' : '') + SIZES[k], () => put({ sz: l.sz === k ? '' : k }, l.sz === k ? 'removed the ' + SIZES[k] + ' flag' : 'flagged "' + l.t + '" as ' + SIZES[k])));
        if (onRoadmap(l)) mi(mm, 'Show on roadmap', () => { if (l.rm) useRoadmap(l.rm); showPage('roadmap'); }); else mi(mm, 'Add to roadmap…', () => addToRoadmap(m, l, p));
        mm.append(el('div', 'msep'));
        if (l.adhoc) mi(mm, 'Mark as planned (not ad hoc)', () => put({ adhoc: false }, 'marked as planned'));
        const others = visibleMonths().filter(x => x !== m); if (others.length) mm.append(el('div', 'mlab', 'Move to month'));
        others.forEach(x => mi(mm, monthLabel(x), () => moveCard(m, l.id, x)));
        mm.append(el('div', 'msep'));
        mi(mm, 'Delete card', () => confirmDlg('Delete this card?', '"' + l.t + '" is deleted from ' + monthLabel(m) + '.', 'Delete card', () => { saveMonth(m, d => { d.lines = d.lines.filter(z => z.id !== l.id); }, 'removed "' + l.t + '" from the ' + monthLabel(m) + ' deliverables'); renderMonthly(); }), 'danger');
      });
    });
    foot.append(pctSelect(pct, 'Percent complete', v => put({ pct: v, pe: true }, 'changed "' + l.t + '" to ' + v + '%')));
  } else foot.append(el('span', 'rvp pc-' + pctBand(pct), pct + '%'));
  if (SIZES[l.sz]) { const z = el('span', 'chip mdsz mdsz-' + l.sz); z.innerHTML = (l.sz === 'enh' ? STAR + ' ' : '') + SIZES[l.sz]; foot.append(z); }
  if (l.adhoc) foot.append(el('span', 'chip mdadhoc', 'Ad hoc'));
  if (onRoadmap(l)) { const b = el('span', 'chip mdroad', 'On roadmap'); b.title = 'This card is a bar on the roadmap'; foot.append(b); } else if (l.src) { const b = el('span', 'chip mdroad', 'From roadmap'); b.title = 'Brought in from the roadmap'; foot.append(b); }
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
    ta.value = ''; saveMonth(m, d => { let n = Math.max(maxNo(), ...d.lines.map(x => +x.no || 0)); ts.forEach(t => { const x = newLine(ui.prod, t, {}); x.no = ++n; d.lines.push(x); }); }, 'added ' + (ts.length === 1 ? 'a deliverable' : ts.length + ' deliverables') + ' to ' + monthLabel(m)); ui.focusComp = true; renderMonthly();
  });
  const row = el('div', 'mdcrow'); row.append(go, no); f.append(ta, chips, row); wrap.append(f); return wrap;
}
function column(m, prods, ed) {
  const d = docOf(m), now = m === curMonth(), col = el('div', 'col mdcol' + (now ? ' now' : '')); col.dataset.mo = m; col.style.setProperty('--c', now ? 'var(--brand)' : '#55608a');
  const fq = ui.q.trim().toLowerCase();
  const lines = d.lines.filter(l => String(l.t || '').trim()), shown = lines.filter(l => (ui.pr === 'all' || l.k === ui.pr) && (ui.fl === 'all' || (ui.fl === 'hp' ? l.hp : l.sz === ui.fl)) && (!fq || (String(l.t) + ' ' + cardId(l)).toLowerCase().includes(fq)));
  const h = el('h2'); h.append(document.createTextNode(monthLabel(m)), el('span', 'badge', String(lines.length)));
  if (now) h.append(el('span', 'chip mdnow', 'This month'));
  if (ed) {
    const more = el('button', 'btn sm colmore', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'Month options for ' + monthLabel(m)); more.title = 'Month options';
    more.addEventListener('click', e => { e.stopPropagation(); const b = more.getBoundingClientRect(); openCtx(b.right - 190, b.bottom + 4, mm => { mi(mm, 'Copy text', () => copyMonth(m)); if (S.reports[monthId(m)]) { mm.append(el('div', 'msep')); mi(mm, 'Delete month', () => deleteMonth(m), 'danger'); } }); });
    h.append(more); h.style.cssText = 'display:flex;align-items:center;gap:8px'; more.style.marginInlineStart = 'auto';
  }
  col.append(h);
  const prog = monthProgress(lines), ad = adhocStats(lines), pv = prog.pct === null ? 0 : prog.pct, pr = el('div', 'mdprog pc-' + pctBand(pv));
  const b0 = el('div', 'mbar pc-' + pctBand(pv)), i0 = el('i'); i0.style.width = pv + '%'; b0.append(i0); b0.setAttribute('aria-label', 'Progress of ' + monthLabel(m));
  pr.append(b0, el('b', 'mdpct', pv + '%'), el('small', '', prog.pct === null ? 'No planned deliverables yet' : prog.done + ' of ' + prog.n + ' done' + (ad.n ? ' · ' + ad.n + ' ad hoc' : ''))); col.append(pr);
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
/** One-time clean-up when an editor opens the board: cards made before the tags were split get their new tag (the old combined Plan / Daycare card follows the squad of its roadmap bar, else becomes Plan), and cards without a number get one. */
function fixCards() {
  const bad = d => d.lines.some(l => (l.k && !TAGS.some(t => t.k === l.k)) || (String(l.t || '').trim() && !l.no)); const old = docs().filter(bad); if (!old.length) return;
  const sq = new Map(); allRoadmaps().forEach(rm => withRm(rm.id, () => items().forEach(i => sq.set(rm.id + ':' + i.id, i.sq))));
  let n = maxNo();
  old.sort((x, y) => (x.mo < y.mo ? -1 : 1)).forEach(d => saveMonth(d.mo, dd => { dd.lines.forEach(l => { if (l.k && !TAGS.some(t => t.k === l.k)) l.k = legacyTag(l.k, sq.get(l.src)); if (String(l.t || '').trim() && !l.no) l.no = ++n; }); }, null, true));
}
export function renderMonthly() {
  const pg = $('pg-monthly'); if (!pg) return;
  const act = document.activeElement, ta0 = act && act.matches && act.matches('.mdcomp textarea') ? act : null, draft = ta0 ? { v: ta0.value, s: ta0.selectionStart, m: ta0.closest('.mdcol').dataset.mo } : null;
  const prevBoard = pg.querySelector('.mdboard'), sx = prevBoard ? prevBoard.scrollLeft : 0, sy = window.scrollY;
  pg.textContent = '';
  const viewer = isViewer(), ed = !viewer && canBuild();
  if (ed) fixCards();
  if (ed) docs().forEach(d => { if (d.status !== 'submitted' && !migrated.has(d.id)) { migrated.add(d.id); S.reports[d.id] = Object.assign({}, S.reports[d.id], { status: 'submitted', subAt: d.subAt || new Date().toISOString() }); write('reports/' + d.id, S.reports[d.id]); } });
  const prods = boardProducts(), tools = el('div', 'formrow');
  const q = el('input'); q.type = 'search'; q.placeholder = 'Search deliverables'; q.value = ui.q; q.setAttribute('aria-label', 'Search deliverables');
  q.addEventListener('input', () => { ui.q = q.value; renderMonthly(); const s = pg.querySelector('input[type=search]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } });
  const fp = el('select'); fp.setAttribute('aria-label', 'Filter by tag'); [['all', 'All tags']].concat(prods.map(p => [p.k, p.n])).forEach(x => { const o = el('option', '', x[1]); o.value = x[0]; o.selected = x[0] === ui.pr; fp.append(o); });
  fp.addEventListener('change', () => { ui.pr = fp.value; renderMonthly(); });
  const ff = el('select'); ff.setAttribute('aria-label', 'Filter by flag'); [['all', 'All cards'], ['hp', 'Business priority'], ['quick', 'Quick wins'], ['enh', 'Small enhancements']].forEach(x => { const o = el('option', '', x[1]); o.value = x[0]; o.selected = x[0] === ui.fl; ff.append(o); });
  ff.addEventListener('change', () => { ui.fl = ff.value; renderMonthly(); });
  tools.append(q, fp, ff);
  if (ed) { const ub = el('button', 'btn sm mdundo', '↶ Undo'); ub.type = 'button'; ub.id = 'mdundo'; ub.disabled = !undoStack.length; ub.title = 'Undo the last change on this board (Ctrl+Z)'; ub.addEventListener('click', undoMonthly); tools.append(ub); }
  const pc = pastCount(); if (pc || ui.past) { const pb = el('button', 'btn sm', ui.past ? 'Hide past months' : 'Show past months (' + pc + ')'); pb.type = 'button'; pb.addEventListener('click', () => { ui.past = !ui.past; renderMonthly(); }); tools.append(pb); }
  pg.append(pageHead('Monthly deliverables', viewer ? 'What the business expects every month, tagged and coloured by Daycare, Tifli, Plan, AI, Finance or New initiative, and how far each deliverable is.' : 'What the business expects each month. Add a card with a tag. Use the ⋯ menu of a card to put it on the roadmap with a start, an end and an assignee. Drag a card to move it to another month.', tools));
  const sb0 = viewer ? null : setupBanner(); if (sb0) pg.append(sb0);
  const board = el('div', 'mdboard'); visibleMonths().forEach(m => board.append(column(m, prods, ed)));
  if (ed) { const ms = visibleMonths(), nm = nextMonth(ms[ms.length - 1]); const ac = el('button', 'addcol mdaddmonth', '+ Add month (' + monthLabel(nm) + ')'); ac.type = 'button'; ac.id = 'addmonth'; ac.addEventListener('click', () => { saveMonth(nm, () => {}, 'added the ' + monthLabel(nm) + ' column to the monthly deliverables'); renderMonthly(); }); board.append(ac); }
  pg.append(board);
  const cta = pg.querySelector('.mdcomp textarea');
  if (cta && draft && draft.v && ui.open === draft.m) { cta.value = draft.v; cta.setSelectionRange(draft.s, draft.s); cta.focus({ preventScroll: true }); }
  else if (cta && ui.focusComp) { ui.focusComp = false; cta.focus({ preventScroll: true }); cta.scrollIntoView({ block: 'nearest' }); }
  if (sx) { const nb = pg.querySelector('.mdboard'); if (nb) nb.scrollLeft = sx; } if (sy && Math.abs(window.scrollY - sy) > 1) window.scrollTo(0, sy);
}

document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || (e.key || '').toLowerCase() !== 'z') return;
  const pg = $('pg-monthly'); if (!pg || !pg.offsetParent) return; const t = e.target; if (t && t.matches && t.matches('input, textarea, select, [contenteditable]')) return;
  if (isViewer() || !canBuild()) return; e.preventDefault(); undoMonthly();
});
