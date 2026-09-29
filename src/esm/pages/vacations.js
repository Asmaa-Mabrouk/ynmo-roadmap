/**
 * @module pages/vacations
 * Vacations page.
 * Leave calendar, per-person stats and the features affected by a person's time off.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { VTYPES, fld, fmtIso, kOfIso, logAct, pageHead, selOf, todayIso, wdays } from '../core/shared.js';
import { $, DAY, MN, NDAYS, canEdit, directory, el, items, parseIso } from '../core/model.js';
import { curRm } from './roadmaps.js';
import { showPage } from '../app/shell.js';
import { commit, write } from '../core/saving.js';
import { render } from '../ui/gantt-render.js';

/* ---------- vacations ---------- */
export const vacsOf = name => Object.keys(S.vacs).map(id => Object.assign({ id: id }, S.vacs[id])).filter(v => v.p === name && v.a0);
function affectedBy(v) {
  const ka = kOfIso(v.a0), kb = kOfIso(v.a1 || v.a0);
  return items().filter(it => it.res.includes(v.p) && it.d1 >= ka && it.d0 <= kb).map(it => ({ it: it, lost: Math.min(it.d1, kb) - Math.max(it.d0, ka) + 1 }));
}

const vacUI = { open: new Set() };
const VT_CLASS = t => 't' + Math.max(0, VTYPES.indexOf(t));
function personStats(name) {
  const list = vacsOf(name).sort((x, y) => x.a0 < y.a0 ? -1 : 1), td = todayIso();
  let cal = 0, work = 0, taken = 0, upcoming = null; const byType = {};
  list.forEach(v => {
    const a1 = v.a1 || v.a0, w = wdays(v.a0, a1);
    cal += Math.round((parseIso(a1) - parseIso(v.a0)) / DAY) + 1; work += w; byType[v.t] = (byType[v.t] || 0) + w;
    if (a1 < td) taken += w; else if (!upcoming) upcoming = v;
  });
  return { list: list, cal: cal, work: work, taken: taken, byType: byType, upcoming: upcoming };
}
function leaveCalendar(list) {
  const r = curRm(); let a = r.a, b = r.b;
  list.forEach(v => { if (v.a0 < a) a = v.a0; if ((v.a1 || v.a0) > b) b = v.a1 || v.a0; });
  const map = {}; list.forEach(v => { for (let t = parseIso(v.a0); t <= parseIso(v.a1 || v.a0); t += DAY) map[new Date(t).toISOString().slice(0, 10)] = v; });
  const wrap = el('div', 'mcals'), td = todayIso(), pad = n => (n < 10 ? '0' : '') + n;
  let y = +a.slice(0, 4), m = +a.slice(5, 7) - 1; const ey = +b.slice(0, 4), em = +b.slice(5, 7) - 1;
  for (let n = 0; n < 14 && y * 12 + m <= ey * 12 + em; n++) {
    const box = el('div', 'mcal'); box.append(el('h4', '', MN[m] + ' ' + y));
    const g = el('div', 'mgrid'); ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(x => g.append(el('span', 'dh', x)));
    const first = new Date(Date.UTC(y, m, 1)).getUTCDay(), dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (let i = 0; i < first; i++) g.append(el('span', 'blank'));
    for (let d = 1; d <= dim; d++) {
      const key = y + '-' + pad(m + 1) + '-' + pad(d), dow = (first + d - 1) % 7, v = map[key];
      const c = el('span', 'day' + (dow === 5 || dow === 6 ? ' we' : '') + (key < r.a || key > r.b ? ' out' : '') + (key === td ? ' today' : '') + (v ? ' lv ' + VT_CLASS(v.t) : ''), String(d));
      if (v) c.title = v.t + (v.n ? ' · ' + v.n : '') + ' · ' + fmtIso(v.a0) + (v.a1 > v.a0 ? ' to ' + fmtIso(v.a1) : '');
      g.append(c);
    }
    box.append(g); wrap.append(box);
    m++; if (m > 11) { m = 0; y++; }
  }
  return wrap;
}
function renderTeamLeave(root) {
  const names = [...new Set(Object.keys(S.vacs).map(id => S.vacs[id]).filter(v => v.a0).map(v => v.p))].sort((x, y) => x.localeCompare(y));
  if (!names.length) return;
  const card = el('div', 'card'); card.append(el('h2', '', 'Team leave'), el('div', 'hint', 'Select a person to see their leave stats and calendar.'));
  const td = todayIso();
  names.forEach(nm => {
    const st = personStats(nm), open = vacUI.open.has(nm), row = el('div', 'tlrow');
    const hb = el('button', 'tlhead'); hb.type = 'button'; hb.setAttribute('aria-expanded', String(open));
    const onLeave = st.list.some(v => v.a0 <= td && (v.a1 || v.a0) >= td);
    hb.append(el('span', 'chev', open ? '▾' : '▸'), el('strong', '', nm), el('span', 'hint', st.list.length + ' period' + (st.list.length > 1 ? 's' : '') + ' · ' + st.work + ' working days'),
      st.upcoming ? el('span', 'badge', (st.upcoming.a0 <= td ? 'Now until ' + fmtIso(st.upcoming.a1 || st.upcoming.a0) : 'Next ' + fmtIso(st.upcoming.a0))) : el('span', 'hint', 'none upcoming'));
    if (onLeave) hb.append(el('span', 'badge warn', 'On leave today'));
    hb.addEventListener('click', () => { if (vacUI.open.has(nm)) vacUI.open.delete(nm); else vacUI.open.add(nm); renderVacations(true); });
    row.append(hb);
    if (open) {
      const body = el('div', 'tlbody'), tiles = el('div', 'tltiles');
      const tile = (n, l) => { const t = el('div', 'tltile'); t.append(el('b', '', String(n)), el('span', '', l)); return t; };
      tiles.append(tile(st.work, 'working days off'), tile(st.cal, 'calendar days'), tile(st.taken, 'already taken'), tile(Math.max(0, st.work - st.taken), 'still ahead'));
      Object.keys(st.byType).forEach(k => tiles.append(tile(st.byType[k], k)));
      const aff = new Set(); st.list.forEach(v => affectedBy(v).forEach(x => aff.add(x.it.id)));
      tiles.append(tile(aff.size, 'features on ' + curRm().n + ' overlap'));
      body.append(tiles, leaveCalendar(st.list));
      const leg = el('div', 'legend2'); VTYPES.forEach(t => { const i = el('i', VT_CLASS(t)); leg.append(i, document.createTextNode(t + '  ')); }); body.append(leg);
      const ul = el('ul', 'tlist'); st.list.forEach(v => ul.append(el('li', '', fmtIso(v.a0) + (v.a1 > v.a0 ? ' to ' + fmtIso(v.a1) : '') + ' · ' + v.t + (v.n ? ' · ' + v.n : '') + ' · ' + wdays(v.a0, v.a1 || v.a0) + ' working days'))); body.append(ul);
      const go = el('button', 'btn sm', 'Show on roadmap'); go.type = 'button'; go.addEventListener('click', () => showPage('roadmap')); body.append(go);
      row.append(body);
    }
    card.append(row);
  });
  root.append(card);
}
function addVacation(p, a0, a1, type, note) {
  const id = 'v' + Date.now().toString(36);
  S.vacs[id] = { p: p, a0: a0, a1: a1, t: type, n: note, by: S.me ? S.me.name : '' };
  write('vacations/' + id, S.vacs[id]);
  logAct('vacation', p + ': ' + type + ' ' + fmtIso(a0) + (a1 > a0 ? ' to ' + fmtIso(a1) : ''));
  const aff = affectedBy(S.vacs[id]);
  S.vacNotice = { id: id, p: p, a0: a0, a1: a1, ty: type, aff: aff.map(x => ({ id: x.it.id, t: x.it.t, lost: x.lost })) };
  render(); renderVacations(true);
}
export function renderVacations(force) {
  const root = $('pg-vacations'), ae = document.activeElement;
  if (!force && ae && root.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
  root.textContent = '';
  root.append(pageHead('Vacations', 'Leave shows on the person\'s row in every roadmap with a ⚑ flag. Features that overlap the leave get a flag too, so you can move them or extend them.'));
  const f = el('form', 'card'); f.append(el('h2', '', 'Add leave'));
  const names = [...directory().keys()].sort((x, y) => x.localeCompare(y));
  const who = selOf([['', 'Choose a person…']].concat(names.map(n => [n, n])), ''), a = el('input'), b = el('input'), ty = selOf(VTYPES, 'Annual leave'), nt = el('input');
  who.required = true; who.setAttribute('aria-label', 'Person');
  a.type = b.type = 'date'; a.required = true; nt.type = 'text'; nt.maxLength = 80; nt.placeholder = 'Optional note';
  const td = todayIso(); a.value = td;
  const r1 = el('div', 'formrow'); r1.append(fld('Person', who), fld('From', a), fld('To', b), fld('Type', ty), fld('Note', nt));
  const msg = el('div', 'gerr'), go = el('button', 'btn primary', 'Add leave'); go.type = 'submit'; go.disabled = !canEdit();
  f.append(r1, msg, go);
  f.addEventListener('submit', e => { e.preventDefault(); if (!who.value) { msg.textContent = 'Choose a person first.'; who.focus(); return; } const x0 = a.value, x1 = b.value || a.value; if (parseIso(x0) === null || parseIso(x1) < parseIso(x0)) { msg.textContent = 'Pick a valid date range.'; return; } const clash = vacsOf(who.value).find(v => x0 <= (v.a1 || v.a0) && x1 >= v.a0); if (clash) { msg.textContent = who.value + ' already has leave on ' + fmtIso(clash.a0) + (clash.a1 > clash.a0 ? ' to ' + fmtIso(clash.a1) : '') + '. Remove it first or pick other dates.'; return; } addVacation(who.value, x0, x1, ty.value, nt.value.trim()); });
  root.append(f);
  if (S.vacNotice) {
    const c = el('div', 'card'); c.style.borderColor = 'var(--brand-2)';
    const hd = el('div', 'vhead'); hd.append(el('strong', '', S.vacNotice.p), el('span', '', fmtIso(S.vacNotice.a0) + (S.vacNotice.a1 > S.vacNotice.a0 ? ' to ' + fmtIso(S.vacNotice.a1) : '')), el('span', 'badge', S.vacNotice.ty || 'Leave')); c.append(hd);
    c.append(el('h3', '', S.vacNotice.aff.length ? S.vacNotice.aff.length + ' feature' + (S.vacNotice.aff.length > 1 ? 's' : '') + ' on ' + curRm().n + ' overlap this leave' : 'No features on ' + curRm().n + ' overlap this leave'));
    if (S.vacNotice.aff.length) {
      const ul = el('ul'); S.vacNotice.aff.forEach(x => ul.append(el('li', '', x.t + ' (' + x.lost + ' day' + (x.lost > 1 ? 's' : '') + ' inside the leave)'))); c.append(ul);
      const act = el('div', 'actions');
      const ext = el('button', 'btn primary sm', 'Extend each feature by its lost days'); ext.type = 'button'; ext.disabled = !canEdit();
      ext.addEventListener('click', () => { const n = S.vacNotice; S.vacNotice = null; n.aff.forEach(x => { const it = items().find(i => i.id === x.id); if (it) commit(it.id, { d1: Math.min(NDAYS - 1, it.d1 + x.lost) }); }); logAct('vacation', 'extended ' + n.aff.length + ' feature(s) for ' + n.p + '\'s leave'); renderVacations(true); });
      const keep = el('button', 'btn sm', 'Keep dates, just flag them'); keep.type = 'button'; keep.addEventListener('click', () => { S.vacNotice = null; renderVacations(true); });
      act.append(ext, keep); c.append(act);
    }
    root.append(c);
  }
  renderTeamLeave(root);
  const card = el('div', 'card'); card.append(el('h2', '', 'All leave'));
  const list = Object.keys(S.vacs).map(id => Object.assign({ id: id }, S.vacs[id])).filter(v => v.a0).sort((x, y) => x.a0 < y.a0 ? -1 : 1);
  if (!list.length) card.append(el('div', 'hint', 'No leave added yet.'));
  else {
    const t = el('table', 'tbl'), th = el('thead'), hr = el('tr'); ['Person', 'Dates', 'Type', 'Working days', 'Affects', ''].forEach(x => { const c = el('th', '', x); if (!x) c.append(el('span', 'sr', 'Actions')); hr.append(c); }); th.append(hr); t.append(th);
    const tb = el('tbody');
    list.forEach(v => {
      const aff = affectedBy(v), tr = el('tr');
      tr.append(el('td', '', v.p), el('td', '', fmtIso(v.a0) + (v.a1 > v.a0 ? ' to ' + fmtIso(v.a1) : '')), el('td', '', v.t + (v.n ? ' · ' + v.n : '')), el('td', '', String(wdays(v.a0, v.a1 || v.a0))));
      const c = el('td'); c.append(aff.length ? el('span', 'badge warn', '⚑ ' + aff.length + ' on ' + curRm().n) : el('span', 'hint', 'none'));
      const x = el('td'); if (canEdit()) { const rm = el('button', 'btn danger sm', 'Remove'); rm.type = 'button'; rm.addEventListener('click', () => { delete S.vacs[v.id]; write('vacations/' + v.id, null); logAct('vacation', 'removed leave of ' + v.p + ' (' + fmtIso(v.a0) + ')'); render(); renderVacations(true); }); x.append(rm); }
      tr.append(c, x); tb.append(tr);
    });
    t.append(tb); const sc = el('div', 'tscroll'); sc.append(t); card.append(sc);
  }
  root.append(card);
}

