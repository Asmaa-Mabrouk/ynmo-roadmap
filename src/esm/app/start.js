/**
 * @module app/start
 * The roadmap's toolbar, menus and keyboard wiring, and the app entry point. This is the LAST file imported: it ends with init(), which starts the app.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, LANES, NDAYS, canEdit, el, iso, items, state, todayK } from '../core/model.js';
import { logAct, toast } from '../core/shared.js';
import { ZOOM, laneOf, render } from '../ui/gantt-render.js';
import { addItem, restoreAll, undo, write } from '../core/saving.js';
import { addAt, barMenu, closeCtx, dayAt, mi, openCtx, rowMenu, startEdit } from '../ui/editing.js';
import { closePicker, fillPersons, openOff } from '../ui/people-picker.js';
import { exportPdf } from '../ui/export-pdf.js';
import { initExtras } from '../app/extras-wiring.js';
import { LOGO } from '../core/supabase.js';
import { useRoadmap } from '../pages/roadmaps.js';
import { boot } from '../app/shell.js';
import { registerUndo } from '../features/undo-router.js';
import { onLanesChanged } from '../features/squad-names.js';
import { periodMenu, openNoteDialog } from '../features/timeline-notes.js';

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
    if (e.target.closest('.hc, .mh, .wk, .notesrow, .tstrip') && !e.target.closest('.tnote')) { e.preventDefault(); periodMenu(e.clientX, e.clientY, Math.max(0, Math.min(NDAYS - 1, dayAt(e.clientX)))); return; }
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
  $('addnote').addEventListener('click', () => {
    const t = Math.max(0, Math.min(NDAYS - 1, todayK));
    openNoteDialog({ k: 'period', a0: iso(t), a1: iso(Math.min(NDAYS - 1, t + 6)) });
  });
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
  boot();
}
