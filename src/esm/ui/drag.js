/**
 * @module ui/drag
 * Drag & drop on the Gantt.
 * Moving/resizing bars in time and moving rows between squads or people (startDrag). Handles drop-target highlighting and ordering (`ord`).
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, LANES, NDAYS, byOrd, canEdit, dlabel, items, state } from '../core/model.js';
import { commit, squadPatch } from '../core/saving.js';
import { render } from './gantt-render.js';

/* ---------- drag ---------- */
function laneBoxes(g) {
  const o = {};
  LANES.forEach(l => {
    const els = g.querySelectorAll('[data-lane="' + l.k + '"]');
    if (!els.length) return;
    let t = 1e9, b = -1e9;
    els.forEach(x => { const r = x.getBoundingClientRect(); t = Math.min(t, r.top); b = Math.max(b, r.bottom); });
    o[l.k] = { t: t, b: b };
  });
  return o;
}
function setDrop(g, key) {
  g.querySelectorAll('.drop').forEach(x => x.classList.remove('drop'));
  if (key) g.querySelectorAll('.rowbg[data-lane="' + key + '"], .gbg[data-lane="' + key + '"], .grp[data-lane="' + key + '"]').forEach(x => x.classList.add('drop'));
}
function personBoxes(g) {
  const o = {};
  g.querySelectorAll('[data-person]').forEach(x => {
    const k = x.dataset.person, r = x.getBoundingClientRect();
    if (!o[k]) o[k] = { t: 1e9, b: -1e9 };
    o[k].t = Math.min(o[k].t, r.top); o[k].b = Math.max(o[k].b, r.bottom);
  });
  return o;
}
function setDropP(g, key) {
  g.querySelectorAll('.drop').forEach(x => x.classList.remove('drop'));
  if (key) g.querySelectorAll('.rowbg[data-person]').forEach(x => { if (x.dataset.person === key) x.classList.add('drop'); });
}
function newOrd(id, lane, y) {
  const g = $('grid'), all = items().filter(i => i.sq === lane && i.id !== id).sort(byOrd);
  const rows = [...g.querySelectorAll('.rowbg[data-lane="' + lane + '"]')].filter(x => x.dataset.id !== id);
  if (!rows.length) return all.length ? all[all.length - 1].ord + 1 : 0;
  let idx = rows.length;
  for (let i = 0; i < rows.length; i++) { const r = rows[i].getBoundingClientRect(); if (y < r.top + r.height / 2) { idx = i; break; } }
  const at = i => all.find(a => a.id === rows[i].dataset.id);
  const before = idx < rows.length ? at(idx) : null, after = idx > 0 ? at(idx - 1) : null;
  if (before && after) return (before.ord + after.ord) / 2;
  if (before) return before.ord - 1;
  return after.ord + 1;
}
export function startDrag(ev, it, bar, mode) {
  if (!canEdit() || (ev.button != null && ev.button !== 0)) return;
  const g = $('grid'), wk = g.querySelector('.wk');
  const mw = wk ? wk.getBoundingClientRect().width : 26;
  const owner = bar.dataset.person || '';
  const st = { x: ev.clientX, y: ev.clientY, lastY: ev.clientY, mode: mode, d0: it.d0, d1: it.d1, sq: it.sq, person: owner, moved: false, cur: { d0: it.d0, d1: it.d1, sq: it.sq, person: owner } };
  bar.setPointerCapture(ev.pointerId);
  const move = e => {
    const dx = e.clientX - st.x, dy = e.clientY - st.y; st.lastY = e.clientY;
    if (!st.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    if (!st.moved) { st.moved = true; S.dragging = true; bar.classList.add('dragging'); }
    const dm = Math.round(dx / mw);
    let a = st.d0, b = st.d1;
    if (mode === 'move') { const len = b - a; a = Math.max(0, Math.min(NDAYS - 1 - len, st.d0 + dm)); b = a + len; }
    else if (mode === 'l') { a = Math.max(0, Math.min(st.d1, st.d0 + dm)); }
    else { b = Math.min(NDAYS - 1, Math.max(st.d0, st.d1 + dm)); }
    st.cur.d0 = a; st.cur.d1 = b;
    { const tip = $('dtip') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'dtip', className: 'dtip' })); tip.textContent = dlabel(a) + ' → ' + dlabel(b) + ' · ' + (b - a + 1) + ' d'; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 16) + 'px'; }
    bar.style.gridColumn = (a + 2) + ' / ' + (b + 3);
    if (mode === 'move') {
      bar.style.transform = 'translate(' + (dx - (a - st.d0) * mw) + 'px,' + dy + 'px)';
      if (state.view === 'person') {
        const boxes = personBoxes(g); let hit = st.cur.person;
        Object.keys(boxes).forEach(k => { if (e.clientY >= boxes[k].t && e.clientY <= boxes[k].b) hit = k; });
        st.cur.person = hit; setDropP(g, hit);
      } else {
        const boxes = laneBoxes(g); let hit = st.cur.sq;
        Object.keys(boxes).forEach(k => { if (e.clientY >= boxes[k].t && e.clientY <= boxes[k].b) hit = k; });
        st.cur.sq = hit; setDrop(g, hit);
      }
    } else bar.style.transform = '';
  };
  const up = () => {
    const dt = $('dtip'); if (dt) dt.remove();
    bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
    setDrop(g, null); setDropP(g, null); S.dragging = false;
    if (!st.moved) return;
    const patch = {};
    if (st.cur.d0 !== st.d0) patch.d0 = st.cur.d0;
    if (st.cur.d1 !== st.d1) patch.d1 = st.cur.d1;
    if (state.view === 'person') {
      if (st.cur.person !== st.person && st.cur.person !== '') {
        let nr = it.res.filter(n => n !== st.person);
        if (st.cur.person !== '__none') nr = [...new Set(nr.concat([st.cur.person]))];
        patch.res = nr;
      }
    } else if (st.cur.sq !== st.sq) Object.assign(patch, squadPatch(it, st.cur.sq));
    if (state.view !== 'person' && mode === 'move' && (st.cur.sq !== st.sq || Math.abs(st.lastY - st.y) > 20)) {
      const o = newOrd(it.id, st.cur.sq, st.lastY);
      if (o !== it.ord) patch.ord = o;
    }
    if (Object.keys(patch).length) commit(it.id, patch); else render();
  };
  bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
}

