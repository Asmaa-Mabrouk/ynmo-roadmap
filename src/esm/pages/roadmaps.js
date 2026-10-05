/**
 * @module pages/roadmaps
 * Roadmaps page.
 * Create/rename/delete roadmaps (each with its own date range) and switch the current roadmap.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { openShare } from '../features/sharing.js';
import { canWrite } from '../features/safety.js';
import { S } from '../core/state.js';
import { H2, fld, fmtIso, logAct, pageHead, selOf } from '../core/shared.js';
import { $, DAY, H2_ID, base, canEdit, el, items, parseIso, setRange, state } from '../core/model.js';
import { render } from '../ui/gantt-render.js';
import { persist, write } from '../core/saving.js';
import { saveIdea } from './ideas.js';
import { showPage } from '../app/shell.js';

/* ---------- roadmaps ---------- */
export function allRoadmaps() {
  return [H2].concat(Object.keys(S.roadmaps).map(id => Object.assign({ id: id }, S.roadmaps[id])).filter(r => r.a && r.b).sort((x, y) => x.a < y.a ? -1 : 1));
}
export function curRm() { return allRoadmaps().find(r => r.id === state.rm) || H2; }
export function withRm(id, fn) {
  const keep = state.rm, r = allRoadmaps().find(x => x.id === id) || H2;
  state.rm = r.id; setRange(r.a, r.b);
  try { return fn(); } finally { const k = allRoadmaps().find(x => x.id === keep) || H2; state.rm = k.id; setRange(k.a, k.b); }
}
export function useRoadmap(id) {
  const r = allRoadmaps().find(x => x.id === id) || H2;
  state.rm = r.id; setRange(r.a, r.b); state.open = null;
  try { localStorage.setItem('ynmo-rm', r.id); } catch (e) { /* storage unavailable */ }
  fillRm(); render();
}
export function fillRm() {
  const s = $('rmsel'); s.textContent = '';
  allRoadmaps().forEach(r => { const o = el('option', '', r.n); o.value = r.id; if (r.id === state.rm) o.selected = true; s.append(o); });
  $('rmtitle').textContent = curRm().n + ' roadmap';
  const rs = $('reset'); if (rs) rs.textContent = state.rm === H2_ID ? 'Restore roadmap' : 'Clear roadmap';
}
function rangeFor(kind, year) {
  const m = { Q1: [0, 2], Q2: [3, 5], Q3: [6, 8], Q4: [9, 11], H1: [0, 5], H2: [6, 11], Year: [0, 11] }[kind] || [0, 11], y = +year;
  return [new Date(Date.UTC(y, m[0], 1)).toISOString().slice(0, 10), new Date(Date.UTC(y, m[1] + 1, 0)).toISOString().slice(0, 10)];
}
const KIND_LABEL = { Q1: 'Q1', Q2: 'Q2', Q3: 'Q3', Q4: 'Q4', H1: 'H1', H2: 'H2', Year: 'Full year', Custom: 'Custom' };
function createRoadmap(name, kind, a, b, copyFrom) {
  const id = 'r' + Date.now().toString(36);
  let copies = [];
  if (copyFrom) copies = withRm(copyFrom, () => items());
  S.roadmaps[id] = { n: name, kind: kind, a: a, b: b, by: S.me ? S.me.name : '' };
  write('roadmaps/' + id, S.roadmaps[id]);
  const nd = Math.round((parseIso(b) - parseIso(a)) / DAY) + 1;
  copies.forEach((it, n) => {
    if (it.d0 >= nd) return;
    const nid = 'c' + Date.now().toString(36) + n;
    S.over[nid] = { custom: true, rm: id, t: it.t, n: it.n || '', sq: it.sq, pr: it.pr.slice(), d0: it.d0, d1: Math.min(it.d1, nd - 1), st: it.st === 'done' ? 'planned' : it.st, res: it.res.slice(), c: it.c || null, ord: it.ord };
    persist(nid);
  });
  logAct('roadmap', 'created roadmap "' + name + '" (' + fmtIso(a) + ' to ' + fmtIso(b) + ')' + (copies.length ? ' with ' + copies.length + ' features copied' : ''));
  return id;
}
function deleteRoadmap(id) {
  const r = S.roadmaps[id]; if (!r) return;
  Object.keys(S.over).forEach(k => { if (!base.has(k) && S.over[k].rm === id) { delete S.over[k]; persist(k); } });
  Object.keys(S.ideas).forEach(iid => { const i = S.ideas[iid]; if (i && !i.col && !i.cfg && i.rm === id && i.st === 'scheduled') saveIdea(iid, { st: 'idea', rm: null, itemId: null }, null); });   // ideas scheduled here go back to the backlog
  Object.keys(S.ideas).forEach(iid => { const i = S.ideas[iid]; if (i && i.tn && i.rm === id) { delete S.ideas[iid]; write('ideas/' + iid, null); } });   // timeline notes of this roadmap
  delete S.roadmaps[id]; write('roadmaps/' + id, null);
  logAct('roadmap', 'deleted roadmap "' + r.n + '"');
  if (state.rm === id) useRoadmap(H2_ID);
}
export function renderRoadmaps() {
  const root = $('pg-roadmaps'); root.textContent = '';
  root.append(pageHead('Roadmaps', 'Create a roadmap for a quarter, half year or the whole year (choose Scope > Custom for your own dates). Each roadmap has its own timeline; people, ideas and leave are shared.'));
  const f = el('form', 'card'); f.append(el('h2', '', 'New roadmap'));
  const yr = selOf([2026, 2027, 2028, 2029], 2027), kd = selOf(Object.keys(KIND_LABEL).map(k => [k, KIND_LABEL[k]]), 'Q1');
  const nm = el('input'); nm.type = 'text'; nm.maxLength = 60; nm.required = true;
  const da = el('input'); da.type = 'date'; const db2 = el('input'); db2.type = 'date';
  const cp = selOf([['', 'Start empty']].concat(allRoadmaps().map(r => [r.id, 'Copy features from ' + r.n])), '');
  const auto = () => { if (nm.dataset.touched) return; nm.value = kd.value === 'Custom' ? '' : (kd.value === 'Year' ? 'Full year ' + yr.value : kd.value + ' ' + yr.value); };
  const sync = () => { const cu = kd.value === 'Custom'; da.parentElement.hidden = db2.parentElement.hidden = !cu; if (!cu) { const r = rangeFor(kd.value, yr.value); da.value = r[0]; db2.value = r[1]; } auto(); };
  nm.addEventListener('input', () => { nm.dataset.touched = '1'; });
  yr.addEventListener('change', sync); kd.addEventListener('change', sync);
  const row = el('div', 'formrow'); row.append(fld('Name', nm), fld('Year', yr), fld('Scope', kd), fld('From', da), fld('To', db2), fld('Features', cp));
  const go = el('button', 'btn primary', 'Create roadmap'); go.type = 'submit'; go.disabled = !canEdit();
  const msg = el('div', 'gerr'); f.append(row, msg, go);
  sync();
  f.addEventListener('submit', e => {
    e.preventDefault();
    const a = da.value, b = db2.value;
    if (parseIso(a) === null || parseIso(b) === null || parseIso(b) < parseIso(a)) { msg.textContent = 'Pick a valid date range.'; return; }
    if ((parseIso(b) - parseIso(a)) / DAY > 730) { msg.textContent = 'Keep a roadmap within two years.'; return; }
    const nmv = nm.value.trim(); if (!nmv) { msg.textContent = 'Give the roadmap a name.'; return; }
    if (allRoadmaps().some(r => r.n.trim().toLowerCase() === nmv.toLowerCase())) { msg.textContent = 'A roadmap called "' + nmv + '" already exists. Choose another name.'; return; }
    const id = createRoadmap(nmv, kd.value, a, b, cp.value);
    useRoadmap(id); showPage('roadmap');
  });
  root.append(f);
  const g = el('div', 'rmgrid');
  allRoadmaps().forEach(r => {
    const c = el('div', 'card rmcard' + (r.id === state.rm ? ' on' : ''));
    const n = withRm(r.id, () => items().length);
    const linked = Object.values(S.ideas).filter(i => i.rm === r.id && i.st === 'scheduled').length;
    c.append(el('h3', '', r.n), el('div', 'meta', fmtIso(r.a) + ' to ' + fmtIso(r.b)), el('div', 'meta', n + ' features · ' + linked + ' from ideas'));
    const act = el('div', 'actions');
    const open = el('button', 'btn primary sm', r.id === state.rm ? 'Open (current)' : 'Open'); open.type = 'button'; open.addEventListener('click', () => { useRoadmap(r.id); showPage('roadmap'); });
    act.append(open);
    if (canWrite()) { const sh = el('button', 'btn sm', 'Share'); sh.type = 'button'; sh.id = 'sharebtn-' + r.id; sh.title = 'Read-only link for people without an account'; sh.addEventListener('click', () => openShare(r.id)); act.append(sh); }
    if (!r.builtin && canEdit()) {
      let armed = false; const del = el('button', 'btn danger sm', 'Delete'); del.type = 'button';
      del.addEventListener('click', () => { if (armed) { deleteRoadmap(r.id); renderRoadmaps(); return; } armed = true; del.textContent = 'Click again to delete'; setTimeout(() => { armed = false; del.textContent = 'Delete'; }, 3500); });
      act.append(del);
    }
    c.append(act); g.append(c);
  });
  root.append(g);
}

