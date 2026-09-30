/**
 * @module pages/sprints
 * Sprint planning (editors/admins only). Weekly sprints; work items grouped squad > person, typed in the tool or bulk-pasted.
 * The weekly report is generated from this data plus the roadmap (see pages/reports.js).
 * Data: `sprints` docs {n,a,b,note}; `sprint_items` docs {sp,squad,person,t,jira,kind,st,ord}.
 */
import { S } from '../core/state.js';
import { DAY, LANES, canEdit, directory, el, parseIso, $ } from '../core/model.js';
import { fld, fmtIso, logAct, pageHead, selOf, todayIso } from '../core/shared.js';
import { write } from '../core/saving.js';
import { openDlg, closeDlg, canWrite } from '../features/safety.js';
import { SKIND, SSTATUS } from '../features/report-model.js';
import { setupBanner } from './reports.js';

export const spUI = { id: null };
const iso = t => new Date(t).toISOString().slice(0, 10);
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const sprintList = () => Object.keys(S.sprints).map(id => Object.assign({ id: id }, S.sprints[id])).filter(s => s.a && s.b).sort((x, y) => y.n - x.n);
export const itemsOf = sp => Object.keys(S.sitems).map(id => Object.assign({ id: id }, S.sitems[id])).filter(i => i.sp === sp).sort((a, b) => (a.ord || 0) - (b.ord || 0) || (a.id < b.id ? -1 : 1));
const curSprint = () => { const l = sprintList(); return l.find(s => s.id === spUI.id) || l[0] || null; };

function saveSprint(id, d) { S.sprints[id] = d; write('sprints/' + id, d); }
function saveItem(id, patch) { const d = Object.assign({}, S.sitems[id] || {}, patch); S.sitems[id] = d; write('sprint_items/' + id, d); }
function delItem(id) { delete S.sitems[id]; write('sprint_items/' + id, null); }

/** Parse pasted text: one item per line; strips bullets; picks up a Jira key (ABC-123) and optional [tags]. */
export function parsePaste(txt) {
  const out = [];
  String(txt || '').split(/\r?\n/).forEach(raw => {
    let s = raw.replace(/^\s*(?:[-*•▪◦·]|\d+[.)])\s*/, '').trim(); if (!s) return;
    const m = /\b([A-Z][A-Z0-9]+-\d+)\b/.exec(s), jira = m ? m[1] : '';
    if (m) s = s.replace(m[0], '').replace(/\s*[-–:|]\s*$/, '').replace(/^\s*[-–:|]\s*/, '').replace(/\s{2,}/g, ' ').trim();
    s = s.replace(/\[[^\]]*\]/g, '').trim();
    if (s) out.push({ t: s.slice(0, 300), jira: jira });
  });
  return out;
}

function newSprint() {
  const l = sprintList(), last = l[0];
  const n = last ? last.n + 1 : 1, a = last ? iso(parseIso(last.b) + DAY) : iso(Date.now());
  const b = iso(parseIso(a) + 13 * DAY), id = 'sp' + n;
  if (S.sprints[id]) { spUI.id = id; renderSprints(); return; }
  saveSprint(id, { n: n, a: a, b: b, note: '' }); spUI.id = id; logAct('sprint', 'created Sprint ' + n + ' (' + fmtIso(a) + ')'); renderSprints();
}
function carryOver(sp) {
  const prev = sprintList().find(s => s.n === sp.n - 1); if (!prev) return 0;
  const have = new Set(itemsOf(sp.id).map(i => i.t.toLowerCase())); let c = 0;
  itemsOf(prev.id).filter(i => i.st !== 'done').forEach(i => {
    if (have.has(i.t.toLowerCase())) return;
    saveItem(uid('si'), { sp: sp.id, squad: i.squad, person: i.person, t: i.t, jira: i.jira, kind: i.kind, st: i.st === 'blocked' ? 'blocked' : 'planned', ord: Date.now() + c }); c++;
  });
  if (c) logAct('sprint', 'carried ' + c + ' unfinished item' + (c === 1 ? '' : 's') + ' into Sprint ' + sp.n);
  return c;
}
function pasteDlg(sp) {
  openDlg('Paste sprint items', box => {
    const sq = selOf(LANES.map(l => [l.k, l.n]), LANES[0].k), pe = el('input'); pe.placeholder = 'Person (optional)'; pe.setAttribute('list', 'sp-people');
    const kd = selOf(Object.keys(SKIND).map(k => [k, SKIND[k]]), 'feature'), ta = el('textarea'); ta.rows = 9; ta.placeholder = 'One item per line. Bullets and Jira keys (ABC-123) are recognised.'; ta.setAttribute('aria-label', 'Items');
    const info = el('p', 'sub', 'Nothing yet'); ta.addEventListener('input', () => { info.textContent = parsePaste(ta.value).length + ' item(s) found'; });
    const ok = el('button', 'btn primary', 'Add items'), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button';
    ok.addEventListener('click', () => {
      const rows = parsePaste(ta.value); if (!rows.length) return;
      rows.forEach((r, i) => saveItem(uid('si'), { sp: sp.id, squad: sq.value, person: pe.value.trim(), t: r.t, jira: r.jira, kind: kd.value, st: 'planned', ord: Date.now() + i }));
      logAct('sprint', 'pasted ' + rows.length + ' item' + (rows.length === 1 ? '' : 's') + ' into Sprint ' + sp.n); closeDlg(); renderSprints();
    });
    no.addEventListener('click', closeDlg);
    const row = el('div', 'row'); row.append(ok, no);
    box.append(fld('Squad', sq), fld('Person', pe), fld('Type', kd), fld('Items', ta), info, row);
  });
}
function itemRow(it, ro) {
  const r = el('div', 'sprow'); r.dataset.id = it.id;
  const t = el('input', 'sptext'); t.value = it.t; t.disabled = ro; t.setAttribute('aria-label', 'Item title');
  t.addEventListener('change', () => { const v = t.value.trim(); if (!v) { t.value = it.t; return; } saveItem(it.id, { t: v.slice(0, 300) }); });
  const j = el('input', 'spjira'); j.value = it.jira || ''; j.placeholder = 'Jira'; j.disabled = ro; j.setAttribute('aria-label', 'Jira key');
  j.addEventListener('change', () => saveItem(it.id, { jira: /^[A-Z][A-Z0-9]+-\d+$/.test(j.value.trim()) ? j.value.trim() : '' }));
  const k = selOf(Object.keys(SKIND).map(x => [x, SKIND[x]]), it.kind || 'feature', 'spsel'); k.disabled = ro; k.setAttribute('aria-label', 'Type'); k.addEventListener('change', () => saveItem(it.id, { kind: k.value }));
  const s = selOf(Object.keys(SSTATUS).map(x => [x, SSTATUS[x]]), it.st || 'planned', 'spsel st-' + (it.st || 'planned')); s.disabled = ro; s.setAttribute('aria-label', 'Status'); s.addEventListener('change', () => { saveItem(it.id, { st: s.value, dn: s.value === 'done' ? todayIso() : '' }); s.className = 'spsel st-' + s.value; });
  const x = el('button', 'btn sm danger', '✕'); x.type = 'button'; x.title = 'Delete item'; x.setAttribute('aria-label', 'Delete item'); x.disabled = ro;
  x.addEventListener('click', () => { delItem(it.id); renderSprints(); });
  r.append(t, j, k, s, x); return r;
}
function addLine(sp, squad, person, ro) {
  const f = el('form', 'spadd'), i = el('input'); i.placeholder = 'Add an item and press Enter'; i.disabled = ro; i.setAttribute('aria-label', 'New item'); f.append(i);
  f.addEventListener('submit', e => { e.preventDefault(); const v = i.value.trim(); if (!v || !canWrite()) return; saveItem(uid('si'), { sp: sp.id, squad: squad, person: person, t: v.slice(0, 300), jira: (/\b([A-Z][A-Z0-9]+-\d+)\b/.exec(v) || [])[1] || '', kind: 'feature', st: 'planned', ord: Date.now() }); renderSprints(); const n = document.querySelector('#pg-sprints [data-add="' + squad + '|' + person + '"] input'); if (n) n.focus(); });
  f.dataset.add = squad + '|' + person; return f;
}

export function renderSprints() {
  const pg = $('pg-sprints'); if (!pg) return; pg.textContent = '';
  const ro = !canEdit() || !canWrite(), l = sprintList(), sp = curSprint();
  const nb = el('button', 'btn primary', '+ New sprint'); nb.type = 'button'; nb.disabled = ro; nb.addEventListener('click', newSprint);
  pg.append(pageHead('Sprints', 'Plan each two-week sprint here. The weekly executive report is built from it and from the roadmap.', nb));
  const sbn = setupBanner(); if (sbn) pg.append(sbn);
  if (!sp) { pg.append(el('p', 'empty', 'No sprint yet. Create the first one.')); return; }
  const dl = el('datalist'); dl.id = 'sp-people'; [...directory().keys()].sort().forEach(n => { const o = el('option'); o.value = n; dl.append(o); }); pg.append(dl);
  const bar = el('div', 'row spbar'), sel = selOf(l.map(s => [s.id, 'Sprint ' + s.n + ' · ' + fmtIso(s.a)]), sp.id); sel.setAttribute('aria-label', 'Sprint');
  sel.addEventListener('change', () => { spUI.id = sel.value; renderSprints(); });
  const pb = el('button', 'btn', 'Paste items'), cb = el('button', 'btn', 'Carry over unfinished'); pb.type = cb.type = 'button'; pb.disabled = cb.disabled = ro;
  pb.addEventListener('click', () => pasteDlg(sp));
  cb.addEventListener('click', () => { const c = carryOver(sp); $('save').textContent = c ? c + ' item(s) carried over' : 'Nothing to carry over'; renderSprints(); });
  bar.append(sel, el('span', 'sub', fmtIso(sp.a) + ' to ' + fmtIso(sp.b)), pb, cb); pg.append(bar);
  const all = itemsOf(sp.id), sum = el('p', 'sub', all.length + ' items · ' + all.filter(i => i.st === 'done').length + ' done · ' + all.filter(i => i.st === 'blocked').length + ' blocked'); pg.append(sum);
  LANES.forEach(ln => {
    const mine = all.filter(i => i.squad === ln.k), people = [...new Set(mine.map(i => i.person || ''))].sort((a, b) => (a === '') - (b === '') || a.localeCompare(b));
    const card = el('section', 'card spsq'); card.style.setProperty('--c', ln.c); card.append(el('h2', '', ln.n));
    people.forEach(p => { const g = el('div', 'spgrp'); g.append(el('h3', '', p || 'Unassigned')); mine.filter(i => (i.person || '') === p).forEach(i => g.append(itemRow(i, ro))); g.append(addLine(sp, ln.k, p, ro)); card.append(g); });
    if (!people.length) card.append(addLine(sp, ln.k, '', ro));
    else { const pe = el('form', 'spadd'), i = el('input'); i.placeholder = 'Add for another person: Name: item'; i.disabled = ro; i.setAttribute('aria-label', 'New item for a person'); pe.append(i); pe.addEventListener('submit', e => { e.preventDefault(); const m = /^([^:]{1,60}):\s*(.+)$/.exec(i.value.trim()); if (!m || !canWrite()) return; saveItem(uid('si'), { sp: sp.id, squad: ln.k, person: m[1].trim(), t: m[2].slice(0, 300), jira: '', kind: 'feature', st: 'planned', ord: Date.now() }); renderSprints(); }); card.append(pe); }
    pg.append(card);
  });
}
