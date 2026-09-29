/**
 * @module saving
 * Persistence and undo.
 * Per-document serial write queue to Supabase with exponential-backoff retry (persist/write), the save-status pill, and in-session undo history capped at 60 steps (commit/undo). Every user edit goes through commit().
 * NOTE: all src/js files share one global scope (concatenated by build.mjs).
 */
/* ---------- saving ---------- */
const SAVE_TEXT = {
  ready: 'Edits save automatically and show for everyone with access.',
  saving: 'Saving…', saved: 'Saved.',
  local: 'Edits are not saved in this view and last until you reload.',
  readonly: 'View only. Ask the owner for edit access to change the plan.',
  error: 'No connection. Your change is kept here and will be saved automatically when you are back online.'
};
function setSave(k) { $('save').textContent = SAVE_TEXT[k] || ''; if (k === 'error') netMark(false); else if (k === 'saved') netMark(true); progress(k === 'saving'); }
const queue = {};
/**
 * Queue a write for one document. Writes to the same path run in order; network errors retry up to 6 times
 * (1.5 s doubling, max 15 s). A permission error (RLS) flips the app to read-only.
 * @param {string} path  'table/id'
 * @param {?object} data full document, or null to delete
 * @param {?object} fields changed fields only (enables server-side merge)
 */
function write(path, data, fields) {
  if (!db) { setSave('local'); return; }
  const ref = db.doc(path), copy = data ? clone(data) : null, part = fields ? clone(fields) : null;
  inflight++; setSave('saving');
  queue[path] = (queue[path] || Promise.resolve()).then(async () => {
    for (let tryN = 0; tryN < 6; tryN++) {
      try {
        if (copy && part && ref.merge) await ref.merge(part, copy); else if (copy) await ref.set(copy); else await ref.delete();
        setSave('saved'); break;
      } catch (e) {
        if (e && e.code === 'invalid_argument') { readonly = true; setSave('readonly'); render(); break; }
        setSave('error'); if (tryN === 5) break;
        await new Promise(r => setTimeout(r, Math.min(15000, 1500 * Math.pow(2, tryN))));
      }
    }
    inflight--;
  });
}
function persist(id, fields) { if (curEntry) curEntry.ids.add(id); write('items/' + id, over[id] || null, fields && over[id] ? fields : null); }
let curEntry = null;
function pushHistory() { curEntry = { snap: JSON.stringify(over), ids: new Set() }; history.push(curEntry); if (history.length > 60) history.shift(); }
function commit(id, fields) {
  const prev = items().find(i => i.id === id);
  pushHistory();
  const d = describe(prev, fields);
  const raw0 = over[id] || {}, uset = {}, unset = [];
  Object.keys(fields).forEach(k => { if (raw0[k] === undefined) unset.push(k); else uset[k] = clone(raw0[k]); });
  over[id] = Object.assign({}, over[id] || {}, fields);
  if (d) logAct('edit', '"' + (prev ? prev.t : id) + '": ' + d, { id: id, set: uset, unset: unset, after: clone(fields) });
  state.refocus = document.activeElement && document.activeElement.id;
  render(); persist(id, fields);
}
function undo() {
  if (!history.length || !canEdit()) return;
  let e = history.pop(); while (e && !e.ids.size && history.length) e = history.pop();
  if (!e || !e.ids.size) { render(); return; }
  curEntry = null; const snap = JSON.parse(e.snap);
  closePicker();
  e.ids.forEach(id => { if (id in snap) over[id] = snap[id]; else delete over[id]; });
  render();
  e.ids.forEach(id => persist(id));
}
function removeItem(id) {
  const it0 = items().find(i => i.id === id);
  pushHistory();
  if (it0) logAct('edit', 'removed "' + it0.t + '" from ' + curRm().n, { id: id, whole: over[id] ? clone(over[id]) : null });
  if (base.has(id)) over[id] = Object.assign({}, over[id] || {}, { x: true }); else delete over[id];
  render(); persist(id);
}
function addItem() { addAt('__none', todayK >= 0 ? todayK : 0); }
async function restoreAll() {
  const mine = id => base.has(id) ? state.rm === H2_ID : (over[id] && (over[id].rm || H2_ID) === state.rm);
  const ids = Object.keys(over).filter(mine);
  ids.forEach(id => { delete over[id]; });
  history = []; closePicker(); closeCtx(); render();
  logAct('roadmap', (state.rm === H2_ID ? 'restored ' : 'cleared ') + curRm().n);
  if (!db) { setSave('local'); return; }
  try {
    inflight++; setSave('saving');
    await Promise.all(ids.map(id => db.doc('items/' + id).delete()));
    setSave('saved');
  } catch (e) { setSave(e && e.code === 'invalid_argument' ? 'readonly' : 'error'); } finally { inflight--; }
}
let pendingSnap = null;
setInterval(() => { if (pendingSnap && !dragging && !inflight && !state.edit) { const s = pendingSnap; pendingSnap = null; onSnap(s); } if (needRender && !dragging && !state.edit) { needRender = false; render(); } }, 700);
function onSnap(snap) {
  if (dragging || inflight > 0 || state.edit) { pendingSnap = snap; return; }
  pendingSnap = null;
  const next = {};
  snap.docs.forEach(d => { next[d.id] = d.data(); });
  if (JSON.stringify(next) === JSON.stringify(over)) return;
  over = clone(next); render();
}
function squadPatch(it, sq) {
  let pr = it.pr;
  if (sq === 'ai') pr = it.sq === 'ai' ? it.pr : [it.sq]; else pr = [sq];
  return { sq: sq, pr: pr };
}

