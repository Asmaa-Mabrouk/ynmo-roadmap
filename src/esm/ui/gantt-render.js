/**
 * @module ui/gantt-render
 * Main roadmap rendering.
 * Summary strip, filters, zoom, bar construction (buildBar), row packing so bars do not overlap (pack) and the by-person view.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, DAYS, H2_ID, LANES, LOWPRI, MGROUPS, NDAYS, STARTDOW, STATUS, canEdit, directory, dlabel, barColorCss, onColor, eff, rangePatch, el, state, todayK, visible } from '../core/model.js';
import { finishEdit, openAddPerson, startEdit } from './editing.js';
import { startDrag } from './drag.js';
import { commit } from '../core/saving.js';
import { curRm } from '../pages/roadmaps.js';
import { offAt, offRange } from './people-picker.js';
import { afterRender } from '../features/dependencies.js';
import { vacsOf } from '../pages/vacations.js';
import { fmtIso, kOfIso } from '../core/shared.js';
import { comparePeople, decoratePersonRow, hiddenHere, openHiddenDialog, primaryLane } from '../features/people-rows.js';

/* ---------- render ---------- */
function renderSummary(list) {
  const s = $('summary'); s.textContent = '';
  const cnt = k => list.filter(i => i.st === k).length;
  [[list.length, 'features shown'], [cnt('planned'), 'planned'], [cnt('decide'), 'need a decision'], [cnt('contract'), 'wait on contract'], [cnt('done'), 'done']].forEach(function (p) {
    const w = el('div'); w.append(el('b', '', String(p[0])), document.createTextNode(' '), el('span', '', p[1])); s.append(w);
  });
}
function field(label, ctl, wide) { const w = el('label', wide ? 'wide' : ''); w.append(el('span', '', label), ctl); return w; }
function select(id, opts, val, on) {
  const s = el('select'); s.id = id; s.disabled = !canEdit();
  opts.forEach(o => { const op = el('option', '', o[1]); op.value = o[0]; if (String(o[0]) === String(val)) op.selected = true; s.append(op); });
  s.addEventListener('change', () => on(s.value)); return s;
}
function fit(t) { t.style.height = 'auto'; t.style.height = Math.max(34, t.scrollHeight + 2) + 'px'; }
function filtersActive() { return state.sq.size < LANES.length || state.status !== 'all' || state.q.trim() !== ''; }
export function laneOf(k) { return LANES.find(l => l.k === k) || LANES[0]; }
let tipEl = null, tipTimer = 0;
export function hideBarTip() { clearTimeout(tipTimer); if (tipEl) { tipEl.remove(); tipEl = null; } }
/** Hover card with the full text of a bar (the bar itself shows at most two lines). */
function showBarTip(bar) {
  hideBarTip(); if (S.dragging || !bar.dataset.tip) return;
  tipTimer = setTimeout(() => {
    if (!bar.isConnected || S.dragging || bar.classList.contains('editing')) return;
    const t = el('div', 'bartip'); t.setAttribute('role', 'tooltip'); t.append(el('b', '', bar.dataset.tip), el('small', '', bar.dataset.tipSub || '')); document.body.append(t); tipEl = t;
    const r = bar.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight;
    const top = r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8;
    t.style.top = top + 'px'; t.style.left = Math.max(8, Math.min(Math.max(r.left, 8), window.innerWidth - w - 8)) + 'px';
  }, 120);
}
window.addEventListener('scroll', hideBarTip, true);
function buildBar(it, owner) {
  const l = laneOf(it.sq), col = barColorCss(it.c) || l.c;
  const bar = el('div', 'bar st-' + it.st + (canEdit() ? '' : ' ro') + (it.ms ? ' ms' : ''));
  bar.style.setProperty('--c', col); if (onColor(it.c)) bar.style.setProperty('--on-bar', onColor(it.c)); bar.dataset.person = owner || ''; bar.dataset.id = it.id;
  bar.tabIndex = 0; bar.setAttribute('role', 'button'); 
  bar.setAttribute('aria-label', it.t + ', ' + dlabel(it.d0) + ' to ' + dlabel(it.d1) + ', ' + STATUS[it.st]);
  bar.dataset.tip = it.t; bar.dataset.tipSub = l.n + ' · ' + dlabel(it.d0) + ' to ' + dlabel(it.d1) + ' · ' + STATUS[it.st];
  const editing = state.edit === it.id + '|' + (owner || '');
  if (editing) {
    bar.classList.add('editing');
    const inp = el('input', 'bi'); inp.type = 'text'; inp.value = it.t; inp.maxLength = 140; inp.setAttribute('aria-label', 'Feature name');
    let done = false;
    const fin = ok => { if (done) return; done = true; finishEdit(it, inp.value, ok); };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); fin(true); } else if (e.key === 'Escape') { e.preventDefault(); fin(false); } });
    inp.addEventListener('blur', () => fin(true));
    inp.addEventListener('pointerdown', e => e.stopPropagation());
    inp.addEventListener('dblclick', e => e.stopPropagation());
    bar.append(inp);
  } else bar.append(el('span', 'nm2', (it.st === 'done' ? '✓ ' : '') + it.t));
  if (it.tag) bar.append(el('span', 'tg', it.tag === 'High priority' ? 'High' : it.tag === 'Low priority' ? 'Low' : it.tag));
  const hl = el('span', 'hd l'), hr = el('span', 'hd r'); bar.append(hl, hr);
  bar.addEventListener('pointerdown', e => { if (e.target.tagName === 'INPUT') return; const mode = e.target === hl ? 'l' : e.target === hr ? 'r' : 'move'; if (canEdit()) startDrag(e, it, bar, mode); });
  bar.addEventListener('pointerenter', () => { if (S.dragging) return; const g = $('grid'); g.classList.add('hov'); g.querySelectorAll('.bar').forEach(b => b.classList.toggle('same', b.dataset.id === it.id)); });
  bar.addEventListener('pointerleave', () => { $('grid').classList.remove('hov'); });
  bar.addEventListener('pointerenter', () => showBarTip(bar)); bar.addEventListener('pointerleave', hideBarTip); bar.addEventListener('pointerdown', hideBarTip); bar.addEventListener('focus', () => showBarTip(bar)); bar.addEventListener('blur', hideBarTip);
  bar.addEventListener('keydown', e => {
    if (e.target !== bar) return;
    if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); startEdit(it, owner); return; }
    if (!canEdit() || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const d = e.key === 'ArrowRight' ? 1 : -1;
    if (e.shiftKey) commit(it.id, rangePatch(it, owner, it.d0, Math.max(it.d0, Math.min(NDAYS - 1, it.d1 + d))));
    else { const len = it.d1 - it.d0, a = Math.max(0, Math.min(NDAYS - 1 - len, it.d0 + d)); commit(it.id, rangePatch(it, owner, a, a + len)); }
    state.refocusBar = it.id;
  });
  return bar;
}
export const ZOOM = { day: 26, week: 12, month: 4 };
export function render() {
  hideBarTip();
  const list = visible();
  renderSummary(list);
  $('undo').disabled = !S.undoStack.length || !canEdit();
  $('add').disabled = !canEdit();
  const dw = ZOOM[state.zoom] || 26;
  document.documentElement.style.setProperty('--dw', dw + 'px');
  const g = $('grid'); g.textContent = ''; g.classList.remove('hov');
  g.style.gridTemplateColumns = 'var(--c1) repeat(' + NDAYS + ', var(--dw))';
  g.style.setProperty('--sh', 'calc(-' + STARTDOW + ' * var(--dw))');
  const put = (n, row, col) => { n.style.gridRow = row; if (col) n.style.gridColumn = col; g.append(n); return n; };
  put(el('div', 'hc r1 first', curRm().n), 1, 1);
  MGROUPS.forEach((m, i) => {
    const c = el('div', 'mh'); c.append(el('span', '', m.n));
    if (LOWPRI[i] && state.rm === H2_ID) { const s = el('small', '', 'low priority'); s.title = 'Marked LOW PRIORITY in the September checkpoint'; c.querySelector('span').append(document.createTextNode(' '), s); }
    put(c, 1, (m.from + 2) + ' / ' + (m.to + 3));
  });
  put(el('div', 'hc r2 first', 'Team member'), 2, 1);
  DAYS.forEach(x => {
    const off = offAt(x.k), full = dw >= 20, lab = dw >= 10 && dw < 20 && x.dow === 0;
    const c = el('div', 'wk' + (x.we ? ' we' : '') + (x.k === todayK ? ' today' : '') + (off ? ' offd' : '') + (full ? '' : ' sparse') + (lab ? ' lab' : ''), full || lab ? String(x.d.getUTCDate()) : '');
    c.title = dlabel(x.k) + (x.k === todayK ? ' (today)' : '') + (off ? ' · ' + off.n : ''); put(c, 2, (x.k + 2) + '');
  });
  const end = renderPeople(g, put, list);
  Object.keys(S.daysoff).forEach(id => {
    const x = S.daysoff[id], r = offRange(x); if (!r || r[1] < 0 || r[0] > NDAYS - 1) return;
    const a = Math.max(0, r[0]), b = Math.min(NDAYS - 1, r[1]);
    const o = el('div', 'off'); o.title = x.n || 'Day off'; put(o, '3 / ' + end, (a + 2) + ' / ' + (b + 3));
  });
  if (todayK >= 0) { const t = el('div', 'todayline'); t.title = 'Today'; put(t, '3 / ' + end, (todayK + 2) + ''); }
  const ei = g.querySelector('input.bi');
  if (ei && state.needFocus) { state.needFocus = false; ei.focus(); ei.select(); }
  else if (state.refocusBar) { const b = [...g.querySelectorAll('.bar')].find(x => x.dataset.id === state.refocusBar); state.refocusBar = null; if (b) b.focus(); }
  else if (state.refocus) { const f = $(state.refocus); if (f) f.focus(); }
  state.refocus = null;
  afterRender();
}
/** Stack bars that overlap in time into lanes. Bars keep their creation order, so a newly added bar goes UNDER the existing ones (the row grows) instead of pushing them down. */
function pack(its) {
  const lanes = [], out = [];
  its.slice().sort((a, b) => a.ord - b.ord || a.d0 - b.d0 || (a.id < b.id ? -1 : 1)).forEach(it => {
    const end = it.ms ? it.d1 + 5 : it.d1;
    let i = lanes.findIndex(l => l.every(o => o.end < it.d0 || o.d0 > end));
    if (i < 0) { i = lanes.length; lanes.push([]); }
    lanes[i].push({ d0: it.d0, end: end }); out.push({ it: it, lane: i });
  });
  return { out: out, n: Math.max(1, lanes.length) };
}
function renderPeople(g, put, list) {
  const dir = directory(), map = new Map(), H = 34;
  const ensure = n => { if (!map.has(n)) map.set(n, { name: n, its: [] }); return map.get(n); };
  dir.forEach((p, n) => ensure(n));
  list.forEach(it => { if (!it.res.length) ensure('__none').its.push(it); else it.res.forEach(n => ensure(n).its.push(eff(it, n))); });
  let people = [...map.values()].filter(p => p.name !== '__none');
  if (state.person !== 'all') people = people.filter(p => p.name === state.person);
  else if (filtersActive()) people = people.filter(p => p.its.length);
  const hid = hiddenHere();   // rows hidden on this roadmap (only ever empty rows; a new feature brings the person back)
  if (state.person === 'all' && hid.length) people = people.filter(p => p.its.length || !hid.includes(p.name));
  people.sort(comparePeople);   // custom drag order, then squad, then A-Z
  let r = 3;
  const block = (p, title, sub, color) => {
    const pk = pack(p.its), n = pk.n, minH = (8 + n * H) + 'px';
    const counts = new Array(NDAYS).fill(0);
    p.its.forEach(it => { for (let k = it.d0; k <= it.d1; k++) counts[k]++; });
    const over = counts.filter(c => c > 1).length;
    const c1 = el('div', 'c1 pn'); c1.dataset.person = p.name; c1.style.minHeight = minH; c1.style.setProperty('--c', color);
    const nm = el('span'); nm.append(el('i'), document.createTextNode(title)); c1.append(nm);
    if (sub) c1.append(el('small', '', sub));
    if (over) { const w = el('small', 'warnx', '⚠ ' + over + (over === 1 ? ' day' : ' days') + ' overlap'); w.title = 'Days where this person has more than one feature at the same time'; c1.append(w); }
    const pv = vacsOf(p.name); let vdays = 0;
    pv.forEach(v => { const ra = kOfIso(v.a0), rb = kOfIso(v.a1 || v.a0); if (rb >= 0 && ra <= NDAYS - 1) vdays += Math.min(NDAYS - 1, rb) - Math.max(0, ra) + 1; });
    if (vdays) { const vs = el('small', '', '⚑ ' + vdays + (vdays === 1 ? ' leave day' : ' leave days')); vs.style.color = 'var(--brand-2)'; c1.append(vs); }
    if (title === p.name) decoratePersonRow(c1, p.name);   // grip + ⋯ menu on real people (not on the Unassigned row)
    put(c1, r, 1);
    const bg = el('div', 'rowbg'); bg.dataset.person = p.name; bg.style.minHeight = minH; put(bg, r, null);
    let k = 0;
    while (k < NDAYS) {
      if (counts[k] > 1) { let e = k; while (e + 1 < NDAYS && counts[e + 1] > 1) e++; const o = el('div', 'ov'); o.dataset.person = p.name; put(o, r, (k + 2) + ' / ' + (e + 3)); k = e + 1; } else k++;
    }
    pv.forEach(v => {
      const ra = kOfIso(v.a0), rb = kOfIso(v.a1 || v.a0); if (rb < 0 || ra > NDAYS - 1) return;
      const a = Math.max(0, ra), b2 = Math.min(NDAYS - 1, rb), tip = p.name + ': ' + v.t + ', ' + fmtIso(v.a0) + (v.a1 > v.a0 ? ' to ' + fmtIso(v.a1) : '') + (v.n ? ' (' + v.n + ')' : '');
      const o = el('div', 'vac'); o.title = tip; put(o, r, (a + 2) + ' / ' + (b2 + 3));
      const fl = el('div', 'vflag', '⚑'); fl.title = tip; put(fl, r, (a + 2) + ' / ' + (a + 3));
    });
    pk.out.forEach(x => {
      const b = buildBar(x.it, p.name); b.classList.add('pb'); b.style.marginTop = (4 + x.lane * H) + 'px';
      const hit = pv.filter(v => x.it.d1 >= kOfIso(v.a0) && x.it.d0 <= kOfIso(v.a1 || v.a0));
      if (hit.length) { b.classList.add('vconf'); b.append(el('span', 'vbadge', '⚑ leave')); b.dataset.tipSub += ' · overlaps leave: ' + hit.map(v => fmtIso(v.a0)).join(', '); }
      put(b, r, (x.it.d0 + 2) + ' / ' + (x.it.d1 + 3));
    });
    r++;
  };
  people.forEach(p => {
    const d = dir.get(p.name);
    const sub = d ? d.domain + ' · ' + [...d.sqs].map(k => laneOf(k).n).join(', ') : '';
    block(p, p.name, sub, LANES[primaryLane(p.name)].c);
  });
  const none = map.get('__none');
  if (none && none.its.length && state.person === 'all') block(none, 'Unassigned', 'Features nobody owns yet', 'var(--muted)');
  if (r === 3) { const e = el('div', 'empty', 'No one matches these filters.'); e.style.gridRow = '3'; g.append(e); r = 4; }
  if (canEdit()) {
    const ab = el('button', 'addp', '+ Add person'); ab.type = 'button'; ab.id = 'addp';
    const c = el('div', 'c1 addrow'); c.append(ab); put(c, r, 1);
    const nh = hid.filter(n => dir.has(n) && !(map.get(n) && map.get(n).its.length)).length;
    if (nh) { const sh = el('button', 'addp', 'Show hidden (' + nh + ')'); sh.type = 'button'; sh.id = 'showhidden'; sh.addEventListener('click', openHiddenDialog); c.append(sh); }
    ab.addEventListener('click', () => openAddPerson(ab));
    put(el('div', 'rowbg'), r, null).style.minHeight = '44px';
  }
  return r;
}


