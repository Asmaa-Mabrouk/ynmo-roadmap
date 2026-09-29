/**
 * @module pages/ideas
 * Ideas page and drawer.
 * Trello-style board of ideas per product with scoring (impact/effort), scheduling an idea onto the roadmap, and the backlog drawer. Column management is in ideas-columns.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { fld, ideaUI, kOfIso, logAct, pageHead, selOf, todayIso } from '../core/shared.js';
import { persist, pushHistory, write } from '../core/saving.js';
import { boardExtras, decorateCol, dragCard, ideaColName, ideaCols, isMeta, moveMenu, wireCol } from './ideas-columns.js';
import { $, LANES, NDAYS, canEdit, directory, el, items, state } from '../core/model.js';
import { mi, openCtx, primarySq } from '../ui/editing.js';
import { allRoadmaps, curRm, useRoadmap } from './roadmaps.js';
import { render } from '../ui/gantt-render.js';
import { closePicker, placePop } from '../ui/people-picker.js';
import { showPage } from '../app/shell.js';

/* ---------- ideas ---------- */
const LMH = [[1, 'Low'], [2, 'Medium'], [3, 'High']];
const ISTAT = [['idea', 'Idea'], ['shortlisted', 'Shortlisted'], ['scheduled', 'On a roadmap'], ['dropped', 'Dropped']];
const ideaScore = i => Math.round(((i.im || 2) / (i.ef || 2)) * 10) / 10;
export function saveIdea(id, patch, act, sum) {
  S.ideas[id] = Object.assign({}, S.ideas[id] || {}, patch); write('ideas/' + id, S.ideas[id]);
  if (act) logAct(act, sum); renderDrawer();
}
function addIdea(pr, title) {
  const id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
  saveIdea(id, { t: title, n: '', pr: pr, im: 2, ef: 2, st: 'idea', by: S.me ? S.me.name : '', ts: Date.now() }, 'idea', 'added idea "' + title + '" to ' + ideaColName(pr));
}
export function scheduleIdea(id, person, k, days) {
  const i = S.ideas[id]; if (!i || !canEdit()) return;
  pushHistory();
  const nid = 'c' + Date.now().toString(36), sq = LANES.some(l => l.k === i.pr) ? i.pr : (person && person !== '__none' ? primarySq(person) : 'tifli'), none = !person || person === '__none';
  k = Math.max(0, Math.min(NDAYS - 1, k));
  const all = items().filter(x => x.sq === sq);
  S.over[nid] = { custom: true, rm: state.rm, t: i.t, n: i.n || '', sq: sq, pr: sq === 'ai' ? ['tifli'] : [sq], d0: k, d1: Math.min(NDAYS - 1, k + Math.max(1, days) - 1), st: 'planned', res: none ? [] : [person], ord: all.length ? Math.max.apply(null, all.map(x => x.ord)) + 1 : 0, idea: id };
  persist(nid);
  saveIdea(id, { st: 'scheduled', rm: state.rm, itemId: nid }, 'roadmap', 'scheduled idea "' + i.t + '" on ' + curRm().n + (none ? '' : ' for ' + person));
  render(); if (state.page === 'ideas') renderIdeas(true);
}
function openSchedule(id, anchor) {
  const i = S.ideas[id]; if (!i || !canEdit()) return;
  S.offOpen = false; S.picker = { add: true };
  const p = $('pop'); p.hidden = false; p.textContent = '';
  const r = curRm();
  p.append(el('h3', '', 'Add to ' + r.n), el('div', 'sub2', i.t));
  const names = [...directory().keys()].sort((x, y) => x.localeCompare(y));
  const who = selOf([['__none', 'Unassigned']].concat(names.map(n => [n, n])), '__none');
  const d = el('input'); d.type = 'date'; d.min = r.a; d.max = r.b;
  const td = todayIso(); d.value = td >= r.a && td <= r.b ? td : r.a;
  const n = el('input'); n.type = 'number'; n.min = 1; n.max = 365; n.value = 14;
  const box = el('div', 'padd'); box.style.gridTemplateColumns = '1fr';
  box.append(fld('Person', who), fld('Starts', d), fld('Duration in days', n));
  const ok = el('button', 'btn primary', 'Add to roadmap'); ok.type = 'button';
  ok.addEventListener('click', () => { const k = kOfIso(d.value); if (isNaN(k)) return; closePicker(); scheduleIdea(id, who.value, k, +n.value || 14); });
  const cx = el('button', 'btn', 'Cancel'); cx.type = 'button'; cx.addEventListener('click', closePicker);
  box.append(ok, cx); p.append(box); placePop(anchor);
}
function ideaCard(id, i) {
  const c = el('div', 'icard' + (i.st === 'dropped' || i.st === 'scheduled' ? ' done' : ''));
  const ed = canEdit();
  const d = { t: i.t, n: i.n || '', im: i.im || 2, ef: i.ef || 2 };
  const head = el('div', 'ihead');
  const t = el('input', 'ititle'); t.value = d.t; t.maxLength = 140; t.disabled = !ed; t.setAttribute('aria-label', 'Idea title');
  const more = el('button', 'kebab', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'More actions for ' + i.t); more.setAttribute('aria-haspopup', 'menu'); more.disabled = !ed;
  head.append(t, more);
  const n = el('textarea'); n.value = d.n; n.placeholder = 'Notes: why it matters, who asked, links'; n.disabled = !ed;
  const im = selOf(LMH, d.im), ef = selOf(LMH, d.ef);
  im.disabled = ef.disabled = !ed; im.setAttribute('aria-label', 'Impact'); ef.setAttribute('aria-label', 'Effort');
  const lab = (x, sel) => { const w = el('label', 'hint'); w.append(document.createTextNode(x + ' '), sel); return w; };
  const r1 = el('div', 'row2'); r1.append(lab('Impact', im), lab('Effort', ef));
  const score = el('span', 'score', 'Score ' + ideaScore(i));
  const stat = el('span', 'badge' + (i.st === 'scheduled' ? ' ok' : ''), (ISTAT.find(x => x[0] === (i.st || 'idea')) || ISTAT[0])[1]);
  const save = el('button', 'btn primary sm', 'Save'); save.type = 'button'; save.hidden = true;
  const saved = el('span', 'hint', ''); 
  const r2 = el('div', 'row2'); r2.append(stat, score);
  const r3 = el('div', 'row2');
  if (i.st === 'scheduled') { const rr = allRoadmaps().find(x => x.id === i.rm); r3.append(el('span', 'badge ok', 'On ' + (rr ? rr.n : 'a roadmap'))); }
  r3.append(save, saved);
  const dirty = () => t.value.trim() !== i.t || n.value !== (i.n || '') || +im.value !== (i.im || 2) || +ef.value !== (i.ef || 2);
  const mark = () => { const dv = dirty(); save.hidden = !dv; saved.textContent = ''; score.textContent = 'Score ' + ideaScore({ im: +im.value, ef: +ef.value }); };
  [t, n].forEach(x => x.addEventListener('input', mark)); [im, ef].forEach(x => x.addEventListener('change', mark));
  const doSave = () => {
    const v = t.value.trim(); if (!v) { t.focus(); return false; }
    if (!dirty()) return true;
    saveIdea(id, { t: v, n: n.value, im: +im.value, ef: +ef.value }, 'idea', 'saved idea "' + v + '"' + (v !== i.t ? ' (was "' + i.t + '")' : ''));
    return true;
  };
  save.addEventListener('click', () => { if (doSave()) renderIdeas(true); });
  c.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !save.hidden) { e.preventDefault(); save.click(); } });
  more.addEventListener('click', e => {
    e.stopPropagation(); const r = more.getBoundingClientRect();
    openCtx(r.right - 190, r.bottom + 4, m => {
      if (i.st !== 'scheduled') mi(m, 'Add to roadmap…', b => { if (!doSave()) return; openSchedule(id, more); });
      else mi(m, 'Show on roadmap', () => { if (i.rm) useRoadmap(i.rm); showPage('roadmap'); });
      if (i.st !== 'scheduled') {
        mi(m, (i.st === 'shortlisted' ? '✓ ' : '') + 'Shortlist', () => { saveIdea(id, { st: i.st === 'shortlisted' ? 'idea' : 'shortlisted' }, 'idea', (i.st === 'shortlisted' ? 'unshortlisted "' : 'shortlisted "') + i.t + '"'); renderIdeas(true); });
        mi(m, i.st === 'dropped' ? 'Reopen idea' : 'Drop idea', () => { saveIdea(id, { st: i.st === 'dropped' ? 'idea' : 'dropped' }, 'idea', (i.st === 'dropped' ? 'reopened "' : 'dropped "') + i.t + '"'); renderIdeas(true); });
      }
      moveMenu(m, id, i);
      m.append(el('div', 'msep'));
      mi(m, 'Delete idea', () => { if (!window.confirm('Delete "' + i.t + '"?')) return; logAct('idea', 'deleted idea "' + i.t + '"'); delete S.ideas[id]; write('ideas/' + id, null); renderIdeas(true); renderDrawer(); }, 'danger');
    });
  });
  c.append(head, n, r1, r2, r3); return c;
}
export function renderIdeas(force) {
  const root = $('pg-ideas'), ae = document.activeElement;
  if (!force && ae && root.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
  root.textContent = '';
  const tools = el('div', 'formrow');
  const q = el('input'); q.type = 'search'; q.placeholder = 'Search ideas'; q.value = ideaUI.q; q.addEventListener('input', () => { ideaUI.q = q.value; renderIdeas(true); const s = root.querySelector('input[type=search]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } });
  const fs = selOf([['open', 'Open ideas'], ['scheduled', 'On a roadmap'], ['dropped', 'Dropped'], ['all', 'All']], ideaUI.st); fs.setAttribute('aria-label', 'Show ideas by status'); fs.addEventListener('change', () => { ideaUI.st = fs.value; renderIdeas(true); });
  tools.append(q, fs);
  root.append(pageHead('Ideas', 'Capture thoughts per product first. When one is ready, press Add to roadmap here, or drag it from the Ideas drawer onto a person on the roadmap.', tools));
  const board = el('div', 'board');
  ideaCols().forEach(l => {
    const col = el('div', 'col'); col.style.setProperty('--c', l.c);
    const all = Object.keys(S.ideas).filter(id => S.ideas[id].pr === l.k);
    const fq = ideaUI.q.trim().toLowerCase();
    const list = all.filter(id => {
      const i = S.ideas[id], s = i.st || 'idea';
      const okS = ideaUI.st === 'all' || (ideaUI.st === 'open' ? (s === 'idea' || s === 'shortlisted') : s === ideaUI.st);
      return okS && (!fq || (i.t + ' ' + (i.n || '')).toLowerCase().includes(fq));
    }).sort((a, b) => ideaScore(S.ideas[b]) - ideaScore(S.ideas[a]) || (S.ideas[b].ts || 0) - (S.ideas[a].ts || 0));
    const h = el('h2'); h.append(document.createTextNode(l.n), el('span', 'badge', String(list.length)));
    decorateCol(col, h, l); wireCol(col, l);
    if (canEdit()) {
      const inp = el('input'); inp.type = 'text'; inp.placeholder = 'Add an idea and press Enter'; inp.maxLength = 140; inp.setAttribute('aria-label', 'New idea for ' + l.n);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const v = inp.value.trim(); if (v) { addIdea(l.k, v); renderIdeas(true); const n = root.querySelectorAll('.col input[type=text]')[ideaCols().findIndex(x => x.k === l.k)]; if (n) n.focus(); } } });
      col.append(inp);
    }
    list.forEach(id => col.append(dragCard(id, ideaCard(id, S.ideas[id]))));
    if (!list.length) col.append(el('div', 'hint', 'Nothing here yet.'));
    board.append(col);
  });
  boardExtras(board);
  root.append(board);
}
export function renderDrawer() {
  const d = $('drawer'); d.hidden = !S.drawerOpen; if (!S.drawerOpen) return;
  d.textContent = '';
  const h = el('div', 'formrow'); h.append(el('h3', '', 'Ideas backlog'));
  const x = el('button', 'btn sm', 'Close'); x.type = 'button'; x.style.marginInlineStart = 'auto'; x.addEventListener('click', () => { S.drawerOpen = false; renderDrawer(); });
  h.append(x);
  d.append(h, el('div', 'hint', 'Drag an idea onto a person and a day. It becomes a bar and stays linked.'));
  const list = el('div', 'dl');
  const open = Object.keys(S.ideas).filter(id => !isMeta(S.ideas[id]) && (S.ideas[id].st || 'idea') === 'idea' || S.ideas[id].st === 'shortlisted');
  ideaCols().forEach(l => {
    const mine = open.filter(id => S.ideas[id].pr === l.k).sort((a, b) => ideaScore(S.ideas[b]) - ideaScore(S.ideas[a]));
    if (!mine.length) return;
    list.append(el('div', 'lab', l.n));
    mine.forEach(id => {
      const i = S.ideas[id], c = el('div', 'dcard'); c.draggable = canEdit(); c.style.setProperty('--c', l.c);
      c.append(el('b', '', i.t), el('small', '', 'Score ' + ideaScore(i) + (i.st === 'shortlisted' ? ' · Shortlisted' : '')));
      c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/idea', id); e.dataTransfer.effectAllowed = 'copy'; });
      list.append(c);
    });
  });
  if (!open.length) list.append(el('div', 'hint', 'No open ideas. Add some on the Ideas page.'));
  d.append(list);
}

