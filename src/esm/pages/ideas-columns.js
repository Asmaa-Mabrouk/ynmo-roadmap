/**
 * @module pages/ideas-columns
 * Editable Ideas columns and app entry point.
 * Custom/built-in column CRUD, colour, drag-reorder and moving cards between products (meta docs `col…`, `cfg_…`, `colorder` are hidden from cards by isMeta()). This is the LAST file: it ends with init(), which starts the app.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, LANES, canEdit, el, items, state, todayK } from '../core/model.js';
import { logAct, toast } from '../core/shared.js';
import { ZOOM, laneOf, render } from '../ui/gantt-render.js';
import { closeDlg, openDlg } from '../features/safety.js';
import { renderDrawer, renderIdeas, saveIdea, scheduleIdea } from './ideas.js';
import { addItem, restoreAll, undo, write } from '../core/saving.js';
import { addAt, barMenu, closeCtx, dayAt, mi, openCtx, rowMenu, startEdit } from '../ui/editing.js';
import { closePicker, fillPersons, openOff } from '../ui/people-picker.js';
import { exportPdf } from '../ui/export-pdf.js';
import { initExtras } from '../app/extras-wiring.js';
import { LOGO } from '../core/supabase.js';
import { useRoadmap } from './roadmaps.js';
import { boot } from '../app/shell.js';
import { registerUndo } from '../features/undo-router.js';
import { onLanesChanged } from '../features/squad-names.js';

/* ---------- ideas: editable, colourable, re-orderable product columns (like Trello) ---------- */
const COL_COLORS = ['#0d8560', '#6d48a8', '#c04a17', '#5a6db5', '#b8860b', '#c2185b', '#00838f', '#55608a'];
export const isMeta = i => !!(i && (i.col || i.cfg));
export function ideaCols(withHidden) {
  const built = LANES.map(l => { const o = S.ideas['cfg_' + l.k] || {}; return { k: l.k, n: o.n || l.n, c: /^#[0-9a-f]{6}$/i.test(o.c || '') ? o.c : l.c, hidden: !!o.hidden, builtin: true }; });
  const custom = Object.keys(S.ideas).filter(id => S.ideas[id] && S.ideas[id].col).sort((a, b) => (S.ideas[a].ts || 0) - (S.ideas[b].ts || 0)).map(id => ({ k: id, n: S.ideas[id].n || 'Untitled', c: /^#[0-9a-f]{6}$/i.test(S.ideas[id].c || '') ? S.ideas[id].c : '#55608a', custom: true }));
  const ord = (S.ideas.colorder && S.ideas.colorder.ord) || [], all = built.concat(custom);
  all.forEach((c, n) => { const p = ord.indexOf(c.k); c.o = p >= 0 ? p : 1000 + n; });
  all.sort((a, b) => a.o - b.o);
  return withHidden ? all : all.filter(c => !c.hidden);
}
export function ideaColName(k) { const c = ideaCols(true).find(x => x.k === k); return c ? c.n : laneOf(k).n; }
function colCount(k) { return Object.keys(S.ideas).filter(id => !isMeta(S.ideas[id]) && S.ideas[id].pr === k).length; }
function colDialog(col) {
  openDlg(col ? 'Edit column' : 'Add a product column', box => {
    const nm = el('input'); nm.type = 'text'; nm.maxLength = 40; nm.placeholder = 'Product name'; nm.setAttribute('aria-label', 'Product name'); nm.style.width = '100%'; nm.value = col ? col.n : '';
    const sel = { v: col ? col.c : COL_COLORS[ideaCols(true).length % COL_COLORS.length] };
    const hex = v => /^#[0-9a-f]{6}$/i.test(v) ? v : '#55608a';
    const sw = el('div', 'mrow'); sw.setAttribute('role', 'radiogroup'); sw.setAttribute('aria-label', 'Color');
    const paint = () => sw.querySelectorAll('.swatch').forEach(x => { const on = x.dataset.c === sel.v; x.setAttribute('aria-pressed', String(on)); x.setAttribute('aria-checked', String(on)); });
    COL_COLORS.forEach(c => { const b = el('button', 'swatch'); b.type = 'button'; b.dataset.c = c; b.style.setProperty('--c', c); b.setAttribute('role', 'radio'); b.setAttribute('aria-label', 'Color ' + c); b.addEventListener('click', () => { sel.v = c; cp.value = c; paint(); }); sw.append(b); });
    const cp = el('input'); cp.type = 'color'; cp.value = hex(sel.v); cp.setAttribute('aria-label', 'Custom color'); cp.style.cssText = 'width:34px;height:34px;padding:0;border:0;background:none;cursor:pointer'; cp.addEventListener('input', () => { sel.v = cp.value; paint(); }); sw.append(cp); paint();
    const msg = el('div', 'gerr'); msg.setAttribute('aria-live', 'polite');
    const go = el('button', 'btn primary', col ? 'Save' : 'Add column'); go.type = 'button';
    const no = el('button', 'btn', 'Cancel'); no.type = 'button'; no.addEventListener('click', closeDlg);
    const submit = () => {
      const n = nm.value.trim(); if (!n) { msg.textContent = 'Type a name.'; return; }
      if (ideaCols(true).some(c => c.n.toLowerCase() === n.toLowerCase() && (!col || c.k !== col.k))) { msg.textContent = 'A column with this name already exists.'; return; }
      if (col && col.custom) saveIdea(col.k, { n: n, c: sel.v }, 'idea', 'edited product column "' + col.n + '"' + (n !== col.n ? ' (now "' + n + '")' : ''));
      else if (col) saveIdea('cfg_' + col.k, { cfg: true, k: col.k, n: n, c: sel.v, hidden: false }, 'idea', 'edited product column "' + col.n + '"' + (n !== col.n ? ' (now "' + n + '")' : ''));
      else { const id = 'col' + Date.now().toString(36); saveIdea(id, { col: true, n: n, c: sel.v, ts: Date.now() }, 'idea', 'added product column "' + n + '"'); }
      closeDlg(); renderIdeas(true); renderDrawer();
    };
    nm.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    go.addEventListener('click', submit);
    const row = el('div', 'formrow'); row.append(go, no);
    box.append(nm, el('span', 'lab', 'Color'), sw, msg, row);
  });
}
function removeCol(c) {
  const n = colCount(c.k);
  if (n) { toast('"' + c.n + '" still has ' + n + ' idea' + (n === 1 ? '' : 's') + '. Move or delete them first.'); return; }
  if (c.builtin) { saveIdea('cfg_' + c.k, { cfg: true, k: c.k, n: c.n, c: c.c, hidden: true }, 'idea', 'hid product column "' + c.n + '"'); }
  else { logAct('idea', 'removed product column "' + c.n + '"'); delete S.ideas[c.k]; write('ideas/' + c.k, null); toast('Removed column "' + c.n + '".'); }
  renderIdeas(true); renderDrawer();
}
function saveOrder(keys) { saveIdea('colorder', { cfg: true, ord: keys }, null); }
function moveCol(k, to) {
  const keys = ideaCols(true).map(c => c.k), from = keys.indexOf(k); if (from < 0) return;
  keys.splice(from, 1); keys.splice(Math.max(0, Math.min(keys.length, to)), 0, k); saveOrder(keys); renderIdeas(true); renderDrawer();
}
export function decorateCol(col, h, l) {
  if (!canEdit()) { col.append(h); return; }
  const more = el('button', 'btn sm colmore', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'Column options for ' + l.n); more.title = 'Column options';
  more.addEventListener('click', e => {
    e.stopPropagation(); const r = more.getBoundingClientRect(), vis = ideaCols(true), pos = vis.findIndex(x => x.k === l.k);
    openCtx(r.right - 190, r.bottom + 4, m => {
      mi(m, 'Rename and color…', () => colDialog(l));
      if (pos > 0) mi(m, 'Move left', () => moveCol(l.k, pos - 1));
      if (pos < vis.length - 1) mi(m, 'Move right', () => moveCol(l.k, pos + 1));
      m.append(el('div', 'msep'));
      mi(m, l.builtin ? 'Hide column' : 'Remove column', () => removeCol(l), 'danger');
    });
  });
  h.append(more); h.style.cssText = 'display:flex;align-items:center;gap:8px'; more.style.marginInlineStart = 'auto';
  h.draggable = true; h.style.cursor = 'grab'; h.title = 'Drag to reorder columns';
  h.addEventListener('dragstart', e => { e.dataTransfer.setData('text/col', l.k); e.dataTransfer.effectAllowed = 'move'; col.classList.add('dragcol'); });
  h.addEventListener('dragend', () => { document.querySelectorAll('.dragcol,.dropcol').forEach(x => x.classList.remove('dragcol', 'dropcol')); });
  col.append(h);
}
export function wireCol(col, l) {
  if (!canEdit()) return;
  const ok = e => { const t = [...(e.dataTransfer ? e.dataTransfer.types : [])]; return t.includes('text/ideacard') || t.includes('text/col'); };
  col.addEventListener('dragover', e => { if (!ok(e)) return; e.preventDefault(); col.classList.add('dropcol'); });
  col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('dropcol'); });
  col.addEventListener('drop', e => {
    col.classList.remove('dropcol');
    const card = e.dataTransfer.getData('text/ideacard'), ck = e.dataTransfer.getData('text/col');
    if (card && S.ideas[card] && S.ideas[card].pr !== l.k) { e.preventDefault(); const t = S.ideas[card].t; saveIdea(card, { pr: l.k }, 'idea', 'moved idea "' + t + '" to ' + l.n); renderIdeas(true); }
    else if (ck && ck !== l.k) { e.preventDefault(); const keys = ideaCols(true).map(c => c.k); moveCol(ck, keys.indexOf(l.k)); }
  });
}
export function dragCard(id, c) {
  if (!canEdit()) return c;
  const g = el('div', 'grip', '⋮⋮'); g.title = 'Drag to another product'; g.setAttribute('aria-hidden', 'true'); c.prepend(g);
  const on = () => { c.draggable = true; }, off = () => { c.draggable = false; };
  g.addEventListener('pointerdown', on); document.addEventListener('pointerup', off, true);
  c.addEventListener('dragstart', e => { if (!c.draggable) return; e.dataTransfer.setData('text/ideacard', id); e.dataTransfer.effectAllowed = 'move'; c.classList.add('dragging'); });
  c.addEventListener('dragend', () => { off(); c.classList.remove('dragging'); document.querySelectorAll('.dropcol').forEach(x => x.classList.remove('dropcol')); });
  return c;
}
export function boardExtras(board) {
  if (!canEdit()) return;
  const ac = el('button', 'addcol', '+ Add product'); ac.type = 'button'; ac.id = 'addcol'; ac.addEventListener('click', () => colDialog(null)); board.append(ac);
  const hid = ideaCols(true).filter(c => c.hidden);
  if (hid.length) {
    const b = el('button', 'btn sm', 'Show hidden columns (' + hid.length + ')'); b.type = 'button'; b.id = 'showhid'; b.style.alignSelf = 'start';
    b.addEventListener('click', () => { hid.forEach(c => saveIdea('cfg_' + c.k, { cfg: true, k: c.k, n: c.n, c: c.c, hidden: false }, null)); logAct('idea', 'showed hidden product columns'); renderIdeas(true); renderDrawer(); });
    board.append(b);
  }
}
export function moveMenu(m, id, i) {
  if (!canEdit()) return;
  m.append(el('div', 'mlab', 'Move to product'));
  ideaCols().forEach(c => { if (c.k === i.pr) return; mi(m, c.n, () => { saveIdea(id, { pr: c.k }, 'idea', 'moved idea "' + i.t + '" to ' + c.n); renderIdeas(true); }); });
}

/** (Re)draw the squad filter chips under the roadmap header; called again when products are renamed, recoloured or added. */
export function drawChips() {
  const chips = $('chips'); if (!chips) return; chips.textContent = '';
  LANES.forEach(l => {
    const b = el('button', 'chip'); b.type = 'button'; b.style.setProperty('--c', l.c);
    b.append(el('i'), document.createTextNode(l.n)); b.setAttribute('aria-pressed', String(state.sq.has(l.k)));
    b.addEventListener('click', () => {
      state.sq.has(l.k) ? state.sq.delete(l.k) : state.sq.add(l.k);
      b.setAttribute('aria-pressed', String(state.sq.has(l.k))); render();
    });
    chips.append(b);
  });
}
onLanesChanged(drawChips);
export function init() {
  const chips = $('chips');
  drawChips();
  fillPersons();
  $('person').addEventListener('change', e => { state.person = e.target.value; render(); });
  $('status').addEventListener('change', e => { state.status = e.target.value; render(); });
  $('q').addEventListener('input', e => { state.q = e.target.value; render(); });
  $('clear').addEventListener('click', () => {
    state.sq = new Set(LANES.map(l => l.k)); state.status = 'all'; state.person = 'all'; state.q = '';
    $('status').value = 'all'; $('person').value = 'all'; $('q').value = '';
    chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', 'true')); render();
  });
  const gr = $('grid');
  gr.addEventListener('contextmenu', e => {
    if (!canEdit()) return;
    const bar = e.target.closest('.bar');
    if (bar) {
      const it = items().find(i => i.id === bar.dataset.id);
      if (it) { e.preventDefault(); barMenu(it, bar.dataset.person, e.clientX, e.clientY); }
      return;
    }
    const row = e.target.closest('.rowbg[data-person], .c1.pn');
    if (row) { e.preventDefault(); rowMenu(row.dataset.person, e.clientX, e.clientY, row.classList.contains('rowbg') ? dayAt(e.clientX) : (todayK >= 0 ? todayK : 0)); }
  });
  gr.addEventListener('dblclick', e => {
    if (!canEdit() || e.target.tagName === 'INPUT') return;
    const bar = e.target.closest('.bar');
    if (bar) { const it = items().find(i => i.id === bar.dataset.id); if (it) startEdit(it, bar.dataset.person); return; }
    const row = e.target.closest('.rowbg[data-person]');
    if (row) addAt(row.dataset.person, dayAt(e.clientX));
  });
  $('wrap').addEventListener('scroll', closeCtx);
  window.addEventListener('resize', closeCtx);
  document.addEventListener('pointerdown', e => { const c = $('ctx'); if (!c.hidden && !c.contains(e.target)) closeCtx(); }, true);
  $('add').addEventListener('click', () => { if (canEdit()) addItem(); });
  $('undo').addEventListener('click', undo);
  registerUndo('roadmap', { ready: () => canEdit(), undo: () => undo() });
  $('daysoff').addEventListener('click', e => openOff(e.currentTarget));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeCtx(); if (S.picker || S.offOpen) closePicker(); }
  });
  let armed = false, t2 = 0; const rb = $('reset') || document.createElement('button');
  rb.addEventListener('click', () => {
    if (!canEdit()) return;
    if (armed) { armed = false; rb.textContent = 'Restore roadmap'; restoreAll(); return; }
    armed = true; rb.textContent = 'Click again to restore'; clearTimeout(t2); t2 = setTimeout(() => { armed = false; rb.textContent = 'Restore roadmap'; }, 3500);
  });
  render();
  $('exportpdf').addEventListener('click', exportPdf);
  initExtras();
  $('toplogo').src = LOGO;
  const av = $('avbtn'), um = $('umenu');
  av.addEventListener('click', e => { e.stopPropagation(); um.hidden = !um.hidden; av.setAttribute('aria-expanded', String(!um.hidden)); });
  document.addEventListener('pointerdown', e => { if (!um.hidden && !um.contains(e.target) && !av.contains(e.target)) { um.hidden = true; av.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !um.hidden) { um.hidden = true; av.setAttribute('aria-expanded', 'false'); av.focus(); } });
  $('rmsel').addEventListener('change', e => useRoadmap(e.target.value));
  try { const z = localStorage.getItem('ynmo-zoom'); if (ZOOM[z]) { state.zoom = z; $('zoom').value = z; } } catch (e) { /* storage unavailable */ }
  $('zoom').addEventListener('change', e => { state.zoom = e.target.value; try { localStorage.setItem('ynmo-zoom', state.zoom); } catch (x) { /* storage unavailable */ } render(); });
  $('ideasbtn').addEventListener('click', () => { S.drawerOpen = !S.drawerOpen; renderDrawer(); });
  const rowAt = e => document.elementsFromPoint(e.clientX, e.clientY).find(x => x.matches && x.matches('.rowbg[data-person]')) || null;
  const clearDrop = () => gr.querySelectorAll('.drop').forEach(x => x.classList.remove('drop'));
  gr.addEventListener('dragover', e => { if (!e.dataTransfer || ![...e.dataTransfer.types].includes('text/idea')) return; clearDrop(); const r = rowAt(e); if (r) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; r.classList.add('drop'); } });
  gr.addEventListener('dragleave', e => { if (!gr.contains(e.relatedTarget)) clearDrop(); });
  gr.addEventListener('drop', e => { const id = e.dataTransfer && e.dataTransfer.getData('text/idea'); const r = rowAt(e); clearDrop(); if (!id || !r) return; e.preventDefault(); scheduleIdea(id, r.dataset.person, dayAt(e.clientX), 14); });
  boot();
}
