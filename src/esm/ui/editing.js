/**
 * @module ui/editing
 * Inline editing and context menus.
 * Cell editing (startEdit/finishEdit), add/duplicate rows, right-click bar/row menus (barMenu/rowMenu) and add-person dialog.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, COLORS, PALETTE, isHex, LANES, NDAYS, ROLES, STATUS, canEdit, dayFromIso, dlabel, directory, el, iso, items, state } from '../core/model.js';
import { lockCheck, trackPres } from '../features/presence.js';
import { render } from './gantt-render.js';
import { commit, persist, pushHistory, removeItem, write } from '../core/saving.js';
import { logAct, toast } from '../core/shared.js';
import { curRm } from '../pages/roadmaps.js';
import { closePicker, fillPersons, openPicker, placePop } from './people-picker.js';
import { depsOf, openDeps, toggleMilestone } from '../features/dependencies.js';

/* ---------- inline edit, context menu, people ---------- */
export function startEdit(it, owner) { if (!canEdit() || !lockCheck(it)) return; closeCtx(); state.edit = it.id + '|' + (owner || ''); state.needFocus = true; render(); trackPres(); }
export function finishEdit(it, val, ok) {
  state.edit = null; trackPres();
  const v = (val || '').replace(/\s+/g, ' ').trim();
  if (ok && v && v !== it.t) commit(it.id, { t: v }); else render();
}
export function primarySq(name) {
  const d = directory().get(name); if (!d) return 'tifli';
  const idx = [...d.sqs].map(k => LANES.findIndex(l => l.k === k)).filter(i => i >= 0);
  return LANES[idx.length ? Math.min.apply(null, idx) : 0].k;
}
export function addAt(person, k) {
  if (!canEdit()) return;
  pushHistory();
  const id = 'c' + Date.now().toString(36), none = !person || person === '__none';
  const sq = none ? 'tifli' : primarySq(person);
  const all = items().filter(i => i.sq === sq);
  k = Math.max(0, Math.min(NDAYS - 1, k));
  S.over[id] = { custom: true, rm: state.rm, t: 'New feature', sq: sq, pr: sq === 'ai' ? ['tifli'] : [sq], d0: k, d1: Math.min(NDAYS - 1, k + 6), st: 'planned', n: '', res: none ? [] : [person], ord: all.length ? Math.max.apply(null, all.map(i => i.ord)) + 1 : 0 };
  state.edit = id + '|' + (none ? '__none' : person); state.needFocus = true;
  logAct('edit', 'added a new bar' + (none ? '' : ' for ' + person) + ' on ' + curRm().n, { id: id, whole: null }); trackPres();
  render(); persist(id);
}
function duplicate(it) {
  pushHistory();
  const id = 'c' + Date.now().toString(36);
  S.over[id] = { custom: true, rm: state.rm, t: it.t + ' (copy)', sq: it.sq, pr: it.pr.slice(), d0: it.d0, d1: it.d1, st: it.st, n: it.n || '', res: it.res.slice(), c: it.c || null, ord: it.ord + 0.5 };
  logAct('edit', 'duplicated "' + it.t + '"', { id: id, whole: null });
  render(); persist(id);
}
export function dayAt(x) { const w = $('grid').querySelector('.wk'); if (!w) return 0; const r = w.getBoundingClientRect(); return Math.floor((x - r.left) / r.width); }
export function closeCtx() { const c = $('ctx'); c.hidden = true; c.textContent = ''; }
export function openCtx(x, y, build) {
  closePicker();
  const c = $('ctx'); c.textContent = ''; build(c); c.hidden = false;
  c.style.left = Math.max(8, Math.min(x, window.innerWidth - c.offsetWidth - 8)) + 'px';
  c.style.top = Math.max(8, Math.min(y, window.innerHeight - c.offsetHeight - 8)) + 'px';
}
export function mi(c, label, fn, cls) { const b = el('button', 'mi' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.addEventListener('click', () => { fn(b); closeCtx(); }); c.append(b); return b; }
function mlab(c, t) { c.append(el('div', 'mlab', t)); }
export function barMenu(it, owner, x, y) {
  openCtx(x, y, c => {
    mi(c, 'Rename', () => startEdit(it, owner));
    mlab(c, 'Status');
    Object.keys(STATUS).forEach(k => mi(c, (it.st === k ? '✓ ' : '') + STATUS[k], () => commit(it.id, { st: k })));
    mlab(c, 'Bar color');
    const row = el('div', 'mrow');
    const def = el('button', 'swatch def'); def.type = 'button'; def.title = 'Product color'; def.setAttribute('aria-label', 'Product color'); def.setAttribute('aria-pressed', String(!it.c));
    def.addEventListener('click', () => { closeCtx(); commit(it.id, { c: null }); }); row.append(def);
    COLORS.forEach(k => { const b = el('button', 'swatch'); b.type = 'button'; b.style.setProperty('--c', 'var(--' + k + ')'); b.setAttribute('aria-label', 'Color ' + k.slice(1)); b.setAttribute('aria-pressed', String(it.c === k)); b.addEventListener('click', () => { closeCtx(); commit(it.id, { c: k }); }); row.append(b); });
    PALETTE.forEach(h => { const b = el('button', 'swatch sm'); b.type = 'button'; b.style.setProperty('--c', h); b.title = h; b.setAttribute('aria-label', 'Color ' + h); b.setAttribute('aria-pressed', String(String(it.c || '').toLowerCase() === h)); b.addEventListener('click', () => { closeCtx(); commit(it.id, { c: h }); }); row.append(b); });
    const any = el('label', 'swatch any'); any.title = 'Pick any colour'; const ci = el('input'); ci.type = 'color'; ci.value = isHex(it.c) ? it.c : '#2f6fb3'; ci.setAttribute('aria-label', 'Pick any colour');
    if (isHex(it.c) && !PALETTE.includes(String(it.c).toLowerCase())) any.classList.add('on');
    ci.addEventListener('change', () => { closeCtx(); commit(it.id, { c: ci.value.toLowerCase() }); }); any.append(ci); row.append(any);
    c.append(row);
    mlab(c, 'Dates');
    const dr = el('div', 'mrow');
    const dateIn = (val, on) => { const i = el('input'); i.type = 'date'; i.min = iso(0); i.max = iso(NDAYS - 1); i.value = iso(val); i.addEventListener('change', () => { const k = dayFromIso(i.value); if (k === null) return; closeCtx(); on(k); }); return i; };
    dr.append(
      dateIn(it.d0, k => { if (k > it.d1) toast('Start is after the end, so the end moved to ' + dlabel(k) + '.'); commit(it.id, { d0: k, d1: Math.max(k, it.d1) }); }),
      dateIn(it.d1, k => { if (k < it.d0) toast('End is before the start, so the start moved to ' + dlabel(k) + '.'); commit(it.id, { d1: k, d0: Math.min(k, it.d0) }); }));
    c.append(dr);
    c.append(el('div', 'msep'));
    mi(c, 'Assign people…' + (it.res.length ? ' (' + it.res.length + ')' : ''), b => openPicker(it.id, b));
    mi(c, it.ms ? 'Make regular bar' : 'Make milestone', () => toggleMilestone(it));
    mi(c, 'Depends on…' + (depsOf(it).length ? ' (' + depsOf(it).length + ')' : ''), () => openDeps(it));
    mi(c, 'Duplicate', () => duplicate(it));
    mi(c, 'Delete', () => removeItem(it.id), 'danger');
  });
}
export function rowMenu(person, x, y, k) {
  const none = person === '__none';
  openCtx(x, y, c => {
    mi(c, 'Insert bar here', () => addAt(person, k));
    mi(c, 'Add person…', b => openAddPerson(b));
    const id = Object.keys(S.extras).find(i => S.extras[i] && S.extras[i].n === person);
    if (!none && id) mi(c, 'Remove ' + person, () => removePerson(id, person), 'danger');
  });
}
function removePerson(id, name) {
  pushHistory();
  delete S.extras[id]; write('people/' + id, null);
  Object.keys(items().reduce((o, i) => { if (i.res.includes(name)) o[i.id] = 1; return o; }, {})).forEach(iid => {
    const it = items().find(i => i.id === iid);
    S.over[iid] = Object.assign({}, S.over[iid] || {}, { res: it.res.filter(n => n !== name) }); persist(iid);
  });
  fillPersons(); render();
}
export function openAddPerson(anchor) {
  if (!canEdit()) return;
  S.offOpen = false; S.picker = { add: true };
  const p = $('pop'); p.hidden = false; p.textContent = '';
  p.append(el('h3', '', 'Add person'), el('div', 'sub2', 'Adds a new row to the chart for everyone.'));
  const nn = el('input'); nn.type = 'text'; nn.id = 'ap-n'; nn.placeholder = 'Name'; nn.maxLength = 60;
  const rs = el('select'); rs.id = 'ap-role'; Object.keys(ROLES).forEach(k => { const o = el('option', '', ROLES[k]); o.value = k; if (k === 'dev') o.selected = true; rs.append(o); });
  const sq = el('select'); sq.id = 'ap-sq'; LANES.forEach(l => { const o = el('option', '', l.n); o.value = l.k; sq.append(o); });
  const msg = el('div', 'sub2', '');
  const go = () => {
    const name = nn.value.trim(); if (!name) { nn.focus(); return; }
    if (directory().has(name)) { msg.textContent = name + ' is already on the chart.'; return; }
    const pid = 'p' + Date.now().toString(36);
    S.extras[pid] = { n: name, role: rs.value, sq: sq.value };
    write('people/' + pid, S.extras[pid]);
    closePicker(); fillPersons(); render();
    const row = $('grid').querySelector('.c1.pn[data-person="' + name.replace(/"/g, '\\"') + '"]');
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  };
  nn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  const ab = el('button', 'btn primary', 'Add'); ab.type = 'button'; ab.addEventListener('click', go);
  const cb = el('button', 'btn', 'Cancel'); cb.type = 'button'; cb.addEventListener('click', closePicker);
  const bx = el('div', 'padd'); bx.append(nn, rs, sq, msg, ab, cb);
  bx.style.gridTemplateColumns = '1fr'; p.append(bx);
  placePop(anchor); nn.focus();
}

