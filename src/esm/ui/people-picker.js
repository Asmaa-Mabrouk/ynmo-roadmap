/**
 * @module ui/people-picker
 * People picker and time-off popovers.
 * Popover used to assign team members to a feature and to record a person's time off on the timeline.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, DAY, H2_START, LANES, ROLES, START, canEdit, directory, el, items, parseIso, state } from '../core/model.js';
import { fmtIso, kOfIso, logAct } from '../core/shared.js';
import { commit, write } from '../core/saving.js';
import { render } from './gantt-render.js';

/* ---------- people ---------- */
export function fillPersons() {
  const ps = $('person'), keep = state.person;
  ps.textContent = '';
  const a = el('option', '', 'Everyone'); a.value = 'all'; ps.append(a);
  [...directory().keys()].sort((x, y) => x.localeCompare(y)).forEach(p => { const o = el('option', '', p); o.value = p; ps.append(o); });
  ps.value = [...ps.options].some(o => o.value === keep) ? keep : 'all'; state.person = ps.value;
}
export function offRange(x) {
  if (!x) return null;
  if (x.a0) return [kOfIso(x.a0), kOfIso(x.a1 || x.a0)];
  if (typeof x.d0 === 'number') { const s = Math.round((H2_START - START) / DAY); return [x.d0 + s, x.d1 + s]; }
  return null;
}
export function offAt(k) { const ids = Object.keys(S.daysoff); for (let i = 0; i < ids.length; i++) { const x = S.daysoff[ids[i]], r = offRange(x); if (r && k >= r[0] && k <= r[1]) return x; } return null; }
function offLabel(x) { const r = offRange(x); if (!r) return ''; const a = iso2(r[0]), b = iso2(r[1]); return fmtIso(a) + (b > a ? ' to ' + fmtIso(b) : ''); }
function iso2(k) { return new Date(START + k * DAY).toISOString().slice(0, 10); }
export function closePicker() { S.picker = null; S.offOpen = false; const p = $('pop'); p.hidden = true; p.textContent = ''; }
export function placePop(anchor) {
  const p = $('pop'), r = anchor.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 16);
  p.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
  p.style.top = Math.max(8, Math.min(r.bottom + 4, window.innerHeight - Math.min(p.offsetHeight, 440) - 8)) + 'px';
}
export function openOff(anchor) {
  if (!canEdit()) return;
  S.picker = null; S.offOpen = true; $('pop').hidden = false; buildOff(); placePop(anchor);
  const f = $('of-n'); if (f) f.focus();
}
export function buildOff() {
  const p = $('pop'); p.textContent = '';
  p.append(el('h3', '', 'Days off'), el('div', 'sub2', 'Shade holidays or team leave across every row. Company-wide closures. For individual leave use the Vacations page.'));
  const ids = Object.keys(S.daysoff);
  const list = el('div', 'plist');
  if (!ids.length) list.append(el('div', 'sub2', 'No days off yet.'));
  ids.sort((a, b) => ((offRange(S.daysoff[a]) || [0])[0]) - ((offRange(S.daysoff[b]) || [0])[0])).forEach(id => {
    const x = S.daysoff[id], row = el('div', 'prow'), t = el('span'); t.append(document.createTextNode(x.n || 'Day off'), el('small', '', offLabel(x)));
    const rm = el('button', 'btn', 'Remove'); rm.type = 'button'; rm.style.marginInlineStart = 'auto';
    rm.addEventListener('click', () => { delete S.daysoff[id]; write('daysoff/' + id, null); render(); buildOff(); });
    row.append(t, rm); list.append(row);
  });
  const add = el('div', 'padd');
  const nn = el('input'); nn.type = 'text'; nn.id = 'of-n'; nn.placeholder = 'Label, for example Team offsite'; nn.maxLength = 60;
  const d0 = el('input'); d0.type = 'date'; d0.id = 'of-a';
  const d1 = el('input'); d1.type = 'date'; d1.id = 'of-b';
  const msg = el('div', 'sub2', '');
  const ab = el('button', 'btn', 'Add'); ab.type = 'button';
  ab.addEventListener('click', () => {
    const a = d0.value, b = d1.value || d0.value;
    if (parseIso(a) === null || parseIso(b) === null || parseIso(b) < parseIso(a)) { msg.textContent = 'Pick a valid date range.'; return; }
    const id = 'o' + Date.now().toString(36), data = { n: nn.value.trim() || 'Day off', a0: a, a1: b };
    logAct('vacation', 'company day off "' + data.n + '" ' + fmtIso(a) + (b > a ? ' to ' + fmtIso(b) : ''));
    S.daysoff[id] = data; write('daysoff/' + id, data); render(); buildOff();
  });
  add.append(el('span', 'lab', 'Add days off'), nn, d0, d1, ab, msg);
  const done = el('button', 'btn primary', 'Done'); done.type = 'button'; done.addEventListener('click', closePicker);
  p.append(list, add, done);
}
export function openPicker(id, anchor) {
  if (!canEdit()) return;
  S.offOpen = false; S.picker = { id: id };
  $('pop').hidden = false;
  buildPicker(); placePop(anchor);
  const s = $('pk-q'); if (s) s.focus();
}
function pickerItem() { return S.picker && items().find(i => i.id === S.picker.id); }
export function buildPicker() {
  const it = pickerItem(), p = $('pop');
  if (!it) { closePicker(); return; }
  p.textContent = '';
  p.append(el('h3', '', 'Assign team members'), el('div', 'sub2', it.t));
  const q = el('input'); q.type = 'search'; q.id = 'pk-q'; q.placeholder = 'Search people';
  const list = el('div', 'plist');
  const draw = () => {
    const cur = pickerItem(); if (!cur) return;
    list.textContent = '';
    const f = q.value.trim().toLowerCase();
    const dir = [...directory().values()].filter(x => !f || x.name.toLowerCase().includes(f));
    dir.sort((a, b) => (b.sqs.has(cur.sq) - a.sqs.has(cur.sq)) || a.name.localeCompare(b.name));
    if (!dir.length) list.append(el('div', 'sub2', 'No one matches. Add them below.'));
    dir.forEach(x => {
      const row = el('label', 'prow'), cb = el('input'); cb.type = 'checkbox'; cb.checked = cur.res.includes(x.name);
      cb.addEventListener('change', () => {
        const now = pickerItem(); if (!now) return;
        const nr = cb.checked ? now.res.concat([x.name]) : now.res.filter(n => n !== x.name);
        commit(now.id, { res: [...new Set(nr)] });
      });
      const t = el('span'); t.append(document.createTextNode(x.name));
      const sq = [...x.sqs].map(k => (LANES.find(l => l.k === k) || { n: k }).n).join(', ');
      t.append(el('small', '', [...x.roles].map(r => ROLES[r]).join(', ') + ' · ' + sq));
      row.append(cb, t); list.append(row);
    });
  };
  q.addEventListener('input', draw);
  const add = el('div', 'padd');
  const nn = el('input'); nn.type = 'text'; nn.id = 'pk-new'; nn.placeholder = 'Add someone new'; nn.maxLength = 60;
  const ab = el('button', 'btn', 'Add'); ab.type = 'button';
  const rs = el('select'); rs.id = 'pk-role';
  Object.keys(ROLES).forEach(k => { const o = el('option', '', ROLES[k]); o.value = k; if (k === 'dev') o.selected = true; rs.append(o); });
  const doAdd = () => {
    const name = nn.value.trim(); if (!name) { nn.focus(); return; }
    const cur = pickerItem(); if (!cur) return;
    if (!directory().has(name)) {
      const pid = 'p' + Date.now().toString(36);
      S.extras[pid] = { n: name, role: rs.value, sq: cur.sq };
      write('people/' + pid, S.extras[pid]);
      fillPersons();
    }
    commit(cur.id, { res: [...new Set(cur.res.concat([name]))] });
    nn.value = ''; draw();
  };
  ab.addEventListener('click', doAdd);
  nn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
  add.append(el('span', 'lab', 'New team member (also added to the people list)'), nn, ab, rs);
  const done = el('button', 'btn primary', 'Done'); done.type = 'button'; done.addEventListener('click', closePicker);
  p.append(q, list, add, done); draw();
}
document.addEventListener('pointerdown', e => {
  if (!S.picker && !S.offOpen) return;
  const p = $('pop');
  if (!p.contains(e.target) && !(e.target.closest && (e.target.closest('.res') || e.target.closest('#ed-res') || e.target.closest('#daysoff')))) closePicker();
});

