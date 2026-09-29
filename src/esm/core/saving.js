/**
 * @module core/saving
 * Persistence and undo.
 * Per-document serial write queue to Supabase with exponential-backoff retry (persist/write), the save-status pill, and in-session undo history capped at 60 steps (commit/undo). Every user edit goes through commit().
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from './state.js';
import { $, H2_ID, base, canEdit, clone, items, state, todayK } from './model.js';
import { netMark } from '../features/safety.js';
import { progress } from '../ui/loading.js';
import { render } from '../ui/gantt-render.js';
import { describe, logAct } from './shared.js';
import { closePicker } from '../ui/people-picker.js';
import { curRm } from '../pages/roadmaps.js';
import { addAt, closeCtx } from '../ui/editing.js';

/* ---------- saving ---------- */
const SAVE_TEXT = {
  ready: 'Edits save automatically and show for everyone with access.',
  saving: 'Saving…', saved: 'Saved.',
  local: 'Edits are not saved in this view and last until you reload.',
  readonly: 'View only. Ask the owner for edit access to change the plan.',
  error: 'No connection. Your change is kept here and will be saved automatically when you are back online.'
};
export function setSave(k) { $('save').textContent = SAVE_TEXT[k] || ''; if (k === 'error') netMark(false); else if (k === 'saved') netMark(true); progress(k === 'saving'); }
const queue = {};
/** path -> number of writes not yet acknowledged; lets snapshot handlers keep local edits that are still in flight. */
const pendingPaths = new Map();
/**
 * Build a {id: data} map from a realtime snapshot but keep the local copy of every document that has an unsaved write,
 * so a refresh triggered by an earlier write can never revert a newer edit (e.g. column order, renames).
 * @param {string} table collection name
 * @param {{docs: Array}} snap snapshot from the db adapter
 * @param {object} local current local map for that collection
 */
export function snapDocs(table, snap, local) {
  const n = {}; snap.docs.forEach(d => { n[d.id] = d.data(); });
  pendingPaths.forEach((_, path) => {
    if (!path.startsWith(table + '/')) return;
    const id = path.slice(table.length + 1);
    if (local[id] === undefined) delete n[id]; else n[id] = local[id];
  });
  return n;
}
/**
 * Queue a write for one document. Writes to the same path run in order; network errors retry up to 6 times
 * (1.5 s doubling, max 15 s). A permission error (RLS) flips the app to read-only.
 * @param {string} path  'table/id'
 * @param {?object} data full document, or null to delete
 * @param {?object} fields changed fields only (enables server-side merge)
 */
export function write(path, data, fields) {
  if (!S.db) { setSave('local'); return; }
  const ref = S.db.doc(path), copy = data ? clone(data) : null, part = fields ? clone(fields) : null;
  S.inflight++; pendingPaths.set(path, (pendingPaths.get(path) || 0) + 1); setSave('saving');
  queue[path] = (queue[path] || Promise.resolve()).then(async () => {
    for (let tryN = 0; tryN < 6; tryN++) {
      try {
        if (copy && part && ref.merge) await ref.merge(part, copy); else if (copy) await ref.set(copy); else await ref.delete();
        setSave('saved'); break;
      } catch (e) {
        if (e && e.code === 'invalid_argument') { S.readonly = true; setSave('readonly'); render(); break; }
        setSave('error'); if (tryN === 5) break;
        await new Promise(r => setTimeout(r, Math.min(15000, 1500 * Math.pow(2, tryN))));
      }
    }
    S.inflight--; const left = (pendingPaths.get(path) || 1) - 1; if (left) pendingPaths.set(path, left); else pendingPaths.delete(path);
  });
}
export function persist(id, fields) { if (curEntry) curEntry.ids.add(id); write('items/' + id, S.over[id] || null, fields && S.over[id] ? fields : null); }
let curEntry = null;
export function pushHistory() { curEntry = { snap: JSON.stringify(S.over), ids: new Set() }; S.undoStack.push(curEntry); if (S.undoStack.length > 60) S.undoStack.shift(); }
export function commit(id, fields) {
  const prev = items().find(i => i.id === id);
  pushHistory();
  const d = describe(prev, fields);
  const raw0 = S.over[id] || {}, uset = {}, unset = [];
  Object.keys(fields).forEach(k => { if (raw0[k] === undefined) unset.push(k); else uset[k] = clone(raw0[k]); });
  S.over[id] = Object.assign({}, S.over[id] || {}, fields);
  if (d) logAct('edit', '"' + (prev ? prev.t : id) + '": ' + d, { id: id, set: uset, unset: unset, after: clone(fields) });
  state.refocus = document.activeElement && document.activeElement.id;
  render(); persist(id, fields);
}
export function undo() {
  if (!S.undoStack.length || !canEdit()) return;
  let e = S.undoStack.pop(); while (e && !e.ids.size && S.undoStack.length) e = S.undoStack.pop();
  if (!e || !e.ids.size) { render(); return; }
  curEntry = null; const snap = JSON.parse(e.snap);
  closePicker();
  e.ids.forEach(id => { if (id in snap) S.over[id] = snap[id]; else delete S.over[id]; });
  render();
  e.ids.forEach(id => persist(id));
}
export function removeItem(id) {
  const it0 = items().find(i => i.id === id);
  pushHistory();
  if (it0) logAct('edit', 'removed "' + it0.t + '" from ' + curRm().n, { id: id, whole: S.over[id] ? clone(S.over[id]) : null });
  if (base.has(id)) S.over[id] = Object.assign({}, S.over[id] || {}, { x: true }); else delete S.over[id];
  render(); persist(id);
}
export function addItem() { addAt('__none', todayK >= 0 ? todayK : 0); }
export async function restoreAll() {
  const mine = id => base.has(id) ? state.rm === H2_ID : (S.over[id] && (S.over[id].rm || H2_ID) === state.rm);
  const ids = Object.keys(S.over).filter(mine);
  ids.forEach(id => { delete S.over[id]; });
  S.undoStack = []; closePicker(); closeCtx(); render();
  logAct('roadmap', (state.rm === H2_ID ? 'restored ' : 'cleared ') + curRm().n);
  if (!S.db) { setSave('local'); return; }
  try {
    S.inflight++; setSave('saving');
    await Promise.all(ids.map(id => S.db.doc('items/' + id).delete()));
    setSave('saved');
  } catch (e) { setSave(e && e.code === 'invalid_argument' ? 'readonly' : 'error'); } finally { S.inflight--; }
}
let pendingSnap = null;
setInterval(() => { if (pendingSnap && !S.dragging && !S.inflight && !state.edit) { const s = pendingSnap; pendingSnap = null; onSnap(s); } if (S.needRender && !S.dragging && !state.edit) { S.needRender = false; render(); } }, 700);
export function onSnap(snap) {
  if (S.dragging || S.inflight > 0 || state.edit) { pendingSnap = snap; return; }
  pendingSnap = null;
  const next = {};
  snap.docs.forEach(d => { next[d.id] = d.data(); });
  if (JSON.stringify(next) === JSON.stringify(S.over)) return;
  S.over = clone(next); render();
}
export function squadPatch(it, sq) {
  let pr = it.pr;
  if (sq === 'ai') pr = it.sq === 'ai' ? it.pr : [it.sq]; else pr = [sq];
  return { sq: sq, pr: pr };
}

