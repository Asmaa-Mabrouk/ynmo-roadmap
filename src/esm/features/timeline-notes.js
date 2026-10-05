/**
 * @module features/timeline-notes
 * Notes on the roadmap timeline that are NOT features (so they never count in the summary, overlap warnings or the weekly report):
 *   - person notes: a ribbon with arrow ends above one person's bars ("Full stack: backend + frontend")
 *   - period notes: a band over every row for some dates ("Eid: many vacations"), with a chip in the Notes row under the header
 *   - a leave strip: a heat bar in the Notes row showing how many people are on leave each day (from the Vacations page)
 * Stored one doc per note in the `ideas` collection: `ideas/tn-…` = {cfg:true, tn:true, rm, k:'person'|'period', p, a0, a1 (ISO dates), t, c (#rrggbb), by}.
 * `cfg:true` keeps them out of the ideas board. Dates are ISO so a note keeps its place if the roadmap range changes.
 */
import { S } from '../core/state.js';
import { NDAYS, canEdit, directory, el, iso, state } from '../core/model.js';
import { kOfIso, fmtIso, logAct } from '../core/shared.js';
import { write } from '../core/saving.js';
import { saveIdea } from '../pages/ideas.js';
import { openDlg, closeDlg } from './safety.js';
import { PALETTE, isHex } from '../core/model.js';
import { vacsOf } from '../pages/vacations.js';
import { notify } from '../ui/notify.js';
import { render } from '../ui/gantt-render.js';
import { closeCtx, mi, openCtx } from '../ui/editing.js';

export const NOTE_H = 20;   // px of one ribbon lane
export const QUICK = ['#0891b2', '#7c3aed', '#16a34a', '#ea580c', '#dc2626', '#ca8a04', '#374151', '#c2257f'];
export const DEFAULT_COLOR = { person: '#0891b2', period: '#ea580c' };

/** Notes of the roadmap on screen, with their day range clipped to it ({d0,d1} = null when outside). */
export function notesHere(kind) {
  return Object.keys(S.ideas).map(id => Object.assign({ id: id }, S.ideas[id])).filter(n => n.tn && n.rm === state.rm && (!kind || n.k === kind)).map(n => {
    const a = kOfIso(n.a0), b = kOfIso(n.a1 || n.a0);
    return Object.assign(n, { d0: Math.max(0, a), d1: Math.min(NDAYS - 1, b), inside: Number.isFinite(a) && Number.isFinite(b) && b >= 0 && a <= NDAYS - 1 });
  }).filter(n => n.inside).sort((x, y) => x.d0 - y.d0 || x.d1 - y.d1 || (x.id < y.id ? -1 : 1));
}
/** Lanes for notes that overlap in time (first free lane). */
export function packNotes(list) {
  const lanes = [], out = [];
  list.forEach(n => { let i = lanes.findIndex(l => l.every(o => o.d1 < n.d0 || o.d0 > n.d1)); if (i < 0) { i = lanes.length; lanes.push([]); } lanes[i].push(n); out.push({ n: n, lane: i }); });
  return { out: out, lanes: lanes.length };
}
export const personNotes = name => packNotes(notesHere('person').filter(n => n.p === name));
export const hasPersonNotes = name => notesHere('person').some(n => n.p === name);
/** People on leave per day: {counts[], who[][]}, honouring the person filter. */
export function leaveByDay() {
  const counts = new Array(NDAYS).fill(0), who = Array.from({ length: NDAYS }, () => []);
  const names = state.person === 'all' ? [...directory().keys()] : [state.person];
  names.forEach(n => vacsOf(n).forEach(v => { const a = Math.max(0, kOfIso(v.a0)), b = Math.min(NDAYS - 1, kOfIso(v.a1 || v.a0)); for (let k = a; k <= b; k++) if (!who[k].includes(n)) { who[k].push(n); counts[k]++; } }));
  return { counts: counts, who: who };
}
/** Runs of consecutive days with the same leave count: [{d0,d1,n,who}]. */
export function leaveRuns() {
  const { counts, who } = leaveByDay(), runs = []; let k = 0;
  while (k < NDAYS) { if (!counts[k]) { k++; continue; } let e = k; while (e + 1 < NDAYS && counts[e + 1] === counts[k]) e++; runs.push({ d0: k, d1: e, n: counts[k], who: who[k] }); k = e + 1; }
  return runs;
}
export const stripNeeded = () => notesHere('period').length > 0 || leaveRuns().length > 0;

/* ---------- save / delete ---------- */
export function saveNote(id, patch, sum) {
  const nid = id || 'tn-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
  saveIdea(nid, Object.assign({ cfg: true, tn: true, rm: state.rm, by: S.me ? S.me.name : '' }, patch), 'roadmap', sum);
  render(); return nid;
}
export function deleteNote(id) {
  const n = S.ideas[id]; if (!n) return;
  delete S.ideas[id]; write('ideas/' + id, null); logAct('roadmap', 'deleted the note "' + n.t + '"'); render();
}

/* ---------- editor ---------- */
/** @param {{id?:string,k:'person'|'period',p?:string,a0:string,a1:string,t?:string,c?:string}} note */
export function openNoteDialog(note) {
  if (!canEdit()) return;
  const k = note.k, editing = !!note.id;
  openDlg((editing ? 'Edit ' : 'Add ') + (k === 'person' ? 'note for ' + (note.p || 'a person') : 'period note'), box => {
    box.append(el('p', 'sub', k === 'person' ? 'A note on one person\'s row, for example "Full stack: backend + frontend". It is not a feature, so it is never counted.' : 'A note across every row for some dates, for example "Eid: many vacations". It is not a feature, so it is never counted.'));
    const tx = el('input'); tx.type = 'text'; tx.maxLength = 120; tx.value = note.t || ''; tx.placeholder = k === 'person' ? 'Full stack: backend + frontend' : 'Eid: many vacations'; tx.setAttribute('aria-label', 'Note text');
    const fld = (l, c) => { const w = el('label', 'fld'); w.append(el('span', '', l), c); return w; };
    box.append(fld('Text', tx));
    let who = null;
    if (k === 'person') { who = el('select'); who.setAttribute('aria-label', 'Person'); [...directory().keys()].sort((a, b) => a.localeCompare(b)).forEach(n => { const o = el('option', '', n); o.value = n; if (n === note.p) o.selected = true; who.append(o); }); box.append(fld('Person', who)); }
    const d0 = el('input'), d1 = el('input'); d0.type = d1.type = 'date'; d0.min = d1.min = iso(0); d0.max = d1.max = iso(NDAYS - 1); d0.value = note.a0; d1.value = note.a1 || note.a0; d0.setAttribute('aria-label', 'From'); d1.setAttribute('aria-label', 'To');
    const dr = el('div', 'formrow'); dr.append(fld('From', d0), fld('To', d1)); box.append(dr);
    let col = isHex(note.c) ? note.c : DEFAULT_COLOR[k];
    const sw = el('div', 'swatches'); const pick = c => { col = c; sw.querySelectorAll('.swatch').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.c === c))); any.classList.toggle('on', !QUICK.includes(c)); };
    QUICK.forEach(c => { const b = el('button', 'swatch'); b.type = 'button'; b.dataset.c = c; b.style.setProperty('--c', c); b.setAttribute('aria-label', 'Colour ' + c); b.setAttribute('aria-pressed', String(c === col)); b.addEventListener('click', () => pick(c)); sw.append(b); });
    const any = el('label', 'swatch any'); any.title = 'Pick any colour'; const ci = el('input'); ci.type = 'color'; ci.value = col; ci.setAttribute('aria-label', 'Pick any colour'); ci.addEventListener('input', () => pick(ci.value.toLowerCase())); any.append(ci); sw.append(any); pick(col);
    box.append(fld('Colour', sw));
    const msg = el('div', 'gerr'); msg.setAttribute('role', 'alert'); box.append(msg);
    const save = el('button', 'btn primary', 'Save'), cancel = el('button', 'btn', 'Cancel'); save.type = cancel.type = 'button'; cancel.addEventListener('click', closeDlg);
    const go = () => {
      const t = tx.value.trim().replace(/\s+/g, ' ');
      if (!t) { msg.textContent = 'Write the note text.'; tx.focus(); return; }
      if (!d0.value || !d1.value) { msg.textContent = 'Pick the dates.'; return; }
      if (d1.value < d0.value) { msg.textContent = 'The end date is before the start date.'; return; }
      const patch = { k: k, t: t, a0: d0.value, a1: d1.value, c: col }; if (k === 'person') patch.p = who.value;
      closeDlg(); saveNote(note.id, patch, (editing ? 'edited' : 'added') + ' the ' + (k === 'person' ? 'note for ' + patch.p : 'period note') + ' "' + t + '"'); notify('Note saved');
    };
    tx.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } }); save.addEventListener('click', go);
    const row = el('div', 'formrow'); row.append(save, cancel);
    if (editing) { const del = el('button', 'btn danger', 'Delete note'); del.type = 'button'; del.addEventListener('click', () => { closeDlg(); deleteNote(note.id); notify('Note deleted'); }); row.append(del); }
    box.append(row);
  });
}
export function noteMenu(n, x, y) {
  if (!canEdit()) return;
  openCtx(x, y, c => {
    mi(c, 'Edit note…', () => openNoteDialog(n));
    mi(c, 'Delete note', () => { deleteNote(n.id); notify('Note deleted'); }, 'danger');
  });
}
export function periodMenu(x, y, dayK) {
  if (!canEdit()) return;
  openCtx(x, y, c => { mi(c, 'Add period note…', () => openNoteDialog({ k: 'period', a0: iso(dayK), a1: iso(Math.min(NDAYS - 1, dayK + 6)) })); });
}

/* ---------- drawing on the chart ---------- */
/** Pointer handling of a note element: click opens the editor, dragging moves it, the end handles resize it. */
function bindDrag(node, n) {
  node.addEventListener('contextmenu', e => { if (!canEdit()) return; e.preventDefault(); e.stopPropagation(); noteMenu(n, e.clientX, e.clientY); });
  if (!canEdit()) return;
  node.addEventListener('pointerdown', e => {
    if (e.button != null && e.button !== 0) return; e.stopPropagation();
    const g = document.getElementById('grid'), wk = g.querySelector('.wk'), mw = wk ? wk.getBoundingClientRect().width : 26;
    const mode = e.target.classList.contains('hl') ? 'l' : e.target.classList.contains('hr') ? 'r' : 'move', x0 = e.clientX; let a = n.d0, b = n.d1, moved = false;
    node.setPointerCapture(e.pointerId);
    const mv = ev => {
      const dm = Math.round((ev.clientX - x0) / mw); if (!moved && Math.abs(ev.clientX - x0) < 4) return; moved = true;
      if (mode === 'move') { const len = n.d1 - n.d0; a = Math.max(0, Math.min(NDAYS - 1 - len, n.d0 + dm)); b = a + len; } else if (mode === 'l') { a = Math.max(0, Math.min(n.d1, n.d0 + dm)); b = n.d1; } else { b = Math.min(NDAYS - 1, Math.max(n.d0, n.d1 + dm)); a = n.d0; }
      node.style.gridColumn = (a + 2) + ' / ' + (b + 3);
    };
    const up = () => {
      node.removeEventListener('pointermove', mv); node.removeEventListener('pointerup', up); node.removeEventListener('pointercancel', up);
      if (!moved) { openNoteDialog(n); return; }
      if (a !== n.d0 || b !== n.d1) saveNote(n.id, { a0: iso(a), a1: iso(b) }, 'moved the note "' + n.t + '" to ' + fmtIso(iso(a)) + ' – ' + fmtIso(iso(b))); else render();
    };
    node.addEventListener('pointermove', mv); node.addEventListener('pointerup', up); node.addEventListener('pointercancel', up);
  });
}
const tip = n => n.t + ' · ' + fmtIso(n.a0) + (n.a1 && n.a1 !== n.a0 ? ' to ' + fmtIso(n.a1) : '') + (n.by ? ' · ' + n.by : '');
/** A ribbon with arrow ends (person note) or a chip (period note) as a grid item. */
export function noteNode(n, laneIdx, kind) {
  const c = isHex(n.c) ? n.c : DEFAULT_COLOR[n.k], b = el('div', kind === 'chip' ? 'tnote tchip' : 'tnote tribbon'); b.dataset.note = n.id; b.style.setProperty('--c', c);
  b.style.marginTop = (kind === 'chip' ? 4 + laneIdx * NOTE_H : 2 + laneIdx * NOTE_H) + 'px'; b.title = tip(n); b.tabIndex = 0; b.setAttribute('role', 'button'); b.setAttribute('aria-label', 'Note: ' + tip(n));
  b.append(el('span', 'nt', n.t)); if (canEdit()) b.append(el('span', 'hd l'), el('span', 'hd r'));
  b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); openNoteDialog(n); } else if (e.key === 'Delete' && canEdit()) { e.preventDefault(); deleteNote(n.id); } });
  bindDrag(b, n); return b;
}
/** The Notes row under the header: period-note chips and the leave heat strip. Returns true when something was drawn. */
export function drawNotesRow(put, row) {
  const periods = packNotes(notesHere('period')), runs = leaveRuns();
  const h = 10 + Math.max(1, periods.lanes) * NOTE_H + 12;
  const c1 = el('div', 'c1 notesrow'); c1.style.minHeight = h + 'px'; c1.append(el('span', '', 'Notes'), el('small', '', 'leave and periods')); put(c1, row, 1);
  const bg = el('div', 'rowbg tstrip'); bg.style.minHeight = h + 'px'; put(bg, row, null);
  runs.forEach(r => {
    const d = el('div', 'vheat'); d.style.setProperty('--n', String(Math.min(1, r.n / 4))); d.title = r.n + (r.n === 1 ? ' person' : ' people') + ' on leave: ' + r.who.join(', ');
    if (r.d1 - r.d0 >= 1) d.append(el('span', '', String(r.n))); put(d, row, (r.d0 + 2) + ' / ' + (r.d1 + 3));
  });
  periods.out.forEach(x => put(noteNode(x.n, x.lane, 'chip'), row, (x.n.d0 + 2) + ' / ' + (x.n.d1 + 3)));
}
/** Tinted bands over all people rows for the period notes. */
export function drawBands(put, fromRow, toRow) {
  notesHere('period').forEach(n => { const b = el('div', 'tband'); b.style.setProperty('--c', isHex(n.c) ? n.c : DEFAULT_COLOR.period); b.title = n.t; put(b, fromRow + ' / ' + toRow, (n.d0 + 2) + ' / ' + (n.d1 + 3)); });
}
