/**
 * @module pages/sprints
 * Sprint planning (editors/admins only).
 *  - `#/sprints`        the list of sprints (open, open in a new browser tab, delete).
 *  - `#/sprints/<id>`   one sprint: dates (from/to), product sections > resources (people) > scopes > sub-sections.
 * Data: `sprints` docs {n,a,b,note,secs:{[squad]:{people:[name]}}}; `sprint_items` docs {sp,squad,person,par,t,h,kind,st,dn,ord}
 * where `par` is the id of the parent scope (empty for a scope). The weekly report is built from this (see pages/reports.js).
 */
import { S } from '../core/state.js';
import { DAY, LANES, canEdit, directory, el, parseIso, $ } from '../core/model.js';
import { fld, fmtIso, logAct, pageHead, selOf, todayIso } from '../core/shared.js';
import { write } from '../core/saving.js';
import { openDlg, closeDlg, canWrite } from '../features/safety.js';
import { SKIND, SSTATUS, scopeStatus } from '../features/report-model.js';
import { setupBanner } from './reports.js';
import { autoGrow, richBar, richBox, submitOnCtrlEnter } from '../features/rich-text.js';
import { notify } from '../ui/notify.js';
import { state } from '../core/model.js';

const iso = t => new Date(t).toISOString().slice(0, 10);
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const routeId = () => { const m = /^#\/sprints\/(\w+)/.exec(location.hash); return m ? m[1] : null; };
export const sprintList = () => Object.keys(S.sprints).map(id => Object.assign({ id: id }, S.sprints[id])).filter(s => s.a && s.b).sort((x, y) => y.n - x.n);
export const itemsOf = sp => Object.keys(S.sitems).map(id => Object.assign({ id: id }, S.sitems[id])).filter(i => i.sp === sp).sort((a, b) => (a.ord || 0) - (b.ord || 0) || (a.id < b.id ? -1 : 1));
const lane = k => LANES.find(l => l.k === k) || { k: k, n: k, c: 'var(--brand)' };
const base = sp => { const d = Object.assign({}, S.sprints[sp.id] || sp); delete d.id; return d; };

function saveSprint(id, d) { S.sprints[id] = d; write('sprints/' + id, d); }
function saveItem(id, patch) { const d = Object.assign({}, S.sitems[id] || {}, patch); S.sitems[id] = d; write('sprint_items/' + id, d); }
function delItem(id) { delete S.sitems[id]; write('sprint_items/' + id, null); }
/** Scopes (top level) and their sub-sections of one sprint. */
export function tree(spId) {
  const all = itemsOf(spId), ids = new Set(all.map(i => i.id)), kids = {}, tops = [];
  all.forEach(i => { if (i.par && ids.has(i.par)) (kids[i.par] = kids[i.par] || []).push(i); else tops.push(i); });
  return { all, tops, kids };
}
const plainSlice = t => String(t || '').replace(/\s+/g, ' ').slice(0, 40);

/** Parse pasted text: one item per line; bullets/numbering are stripped. */
export function parsePaste(txt) {
  const out = [];
  String(txt || '').split(/\r?\n/).forEach(raw => { const s = raw.replace(/^\s*(?:[-*•▪◦·]|\d+[.)])\s*/, '').trim(); if (s) out.push({ t: s.slice(0, 300), jira: '' }); });
  return out;
}
function confirmDlg(title, msg, yes, onYes) {
  openDlg(title, box => {
    const ok = el('button', 'btn danger', yes), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button';
    ok.addEventListener('click', () => { closeDlg(); onYes(); }); no.addEventListener('click', closeDlg);
    const row = el('div', 'row'); row.append(ok, no); box.append(el('p', '', msg), row);
  });
}

/* ---------- sprint list ---------- */
function newSprint() {
  const l = sprintList(), last = l[0];
  const n = last ? last.n + 1 : 1, a = last ? iso(parseIso(last.b) + DAY) : iso(Date.now());
  const id = 'sp' + n;
  if (S.sprints[id]) { location.hash = '#/sprints/' + id; return; }
  saveSprint(id, { n: n, a: a, b: iso(parseIso(a) + 13 * DAY), note: '', secs: {} });
  logAct('sprint', 'created Sprint ' + n + ' (' + fmtIso(a) + ')'); notify('Sprint ' + n + ' created. Choose the dates and add a product section.'); location.hash = '#/sprints/' + id;
}
function deleteSprint(sp) {
  confirmDlg('Delete Sprint ' + sp.n + '?', 'This deletes the sprint and all its scopes and sub-sections. Weekly reports already created from it are kept.', 'Delete sprint', () => {
    itemsOf(sp.id).forEach(i => delItem(i.id)); delete S.sprints[sp.id]; write('sprints/' + sp.id, null);
    logAct('sprint', 'deleted Sprint ' + sp.n); notify('Sprint ' + sp.n + ' deleted'); location.hash = '#/sprints'; renderSprints();
  });
}
function listView(pg, ro) {
  const nb = el('button', 'btn primary', '+ New sprint'); nb.type = 'button'; nb.disabled = ro; nb.addEventListener('click', newSprint);
  pg.append(pageHead('Sprints', 'All two-week sprints. Open one to plan its product sections, resources and scope. The weekly executive report is built from them and from the roadmap.', nb));
  const sbn = setupBanner(); if (sbn) pg.append(sbn);
  const l = sprintList(); if (!l.length) { pg.append(el('p', 'empty', 'No sprint yet. Click "+ New sprint" to create the first one.')); return; }
  const wrap = el('div', 'splist');
  l.forEach(sp => {
    const t = tree(sp.id), leaf = t.all.filter(i => !t.kids[i.id]), done = leaf.filter(i => i.st === 'done').length, pct = leaf.length ? Math.round(100 * done / leaf.length) : 0;
    const secs = Object.keys(sp.secs || {}).concat(t.tops.map(i => i.squad)).filter((k, i, a) => a.indexOf(k) === i);
    const card = el('div', 'card spcard'), info = el('div');
    const a = el('a', 'splink'); a.href = '#/sprints/' + sp.id; a.append(el('h2', '', 'Sprint ' + sp.n));
    info.append(a, el('div', 'meta', fmtIso(sp.a) + ' to ' + fmtIso(sp.b) + ' · ' + (Math.round((parseIso(sp.b) - parseIso(sp.a)) / DAY) + 1) + ' days'));
    const pr = el('div', 'prods'); secs.forEach(k => { const c = el('span', 'pchip', lane(k).n); c.style.setProperty('--c', lane(k).c); pr.append(c); }); if (!secs.length) pr.append(el('span', 'meta', 'No product sections yet')); info.append(pr);
    const prog = el('div', 'prog'); prog.append(el('div', 'meta', done + ' of ' + leaf.length + ' done')); const b0 = el('div', 'bar0'), i0 = el('i'); i0.style.width = pct + '%'; b0.append(i0); prog.append(b0);
    const acts = el('div', 'row'), open = el('a', 'btn sm', 'Open'), tab = el('a', 'btn sm spnew', 'Open in new tab ↗'), del = el('button', 'btn sm danger', 'Delete'); open.href = '#/sprints/' + sp.id; tab.href = location.pathname + location.search + '#/sprints/' + sp.id; tab.target = '_blank'; tab.rel = 'noopener'; del.type = 'button'; del.disabled = ro; del.addEventListener('click', () => deleteSprint(sp));
    acts.append(open, tab, del); card.append(info, prog, acts); wrap.append(card);
  });
  pg.append(wrap);
}

/* ---------- one sprint ---------- */
function setDates(sp, a, b, fromEl, toEl) {
  if (!parseIso(a) || !parseIso(b)) { notify('Choose both dates', 'err'); return; }
  if (b < a) { notify('The end date is before the start date', 'err'); fromEl.value = sp.a; toEl.value = sp.b; return; }
  if (a === sp.a && b === sp.b) return;
  saveSprint(sp.id, Object.assign(base(sp), { a: a, b: b })); logAct('sprint', 'set Sprint ' + sp.n + ' dates to ' + fmtIso(a) + ' – ' + fmtIso(b)); notify('Dates updated: ' + fmtIso(a) + ' to ' + fmtIso(b)); renderSprints();
}
function ensureSec(sp, squad, person) {
  const d = base(sp); d.secs = Object.assign({}, d.secs || {}); const s = d.secs[squad] = Object.assign({ people: [] }, d.secs[squad] || {}); s.people = (s.people || []).slice();
  if (person && !s.people.includes(person)) s.people.push(person); saveSprint(sp.id, d);
}
function addSection(sp, squad) { ensureSec(sp, squad, ''); logAct('sprint', 'added the ' + lane(squad).n + ' section to Sprint ' + sp.n); notify(lane(squad).n + ' section added. Now add a resource.'); renderSprints(); }
function removeSection(sp, squad) {
  const go = () => { itemsOf(sp.id).filter(i => i.squad === squad).forEach(i => delItem(i.id)); const d = base(sp); d.secs = Object.assign({}, d.secs || {}); delete d.secs[squad]; saveSprint(sp.id, d); logAct('sprint', 'removed the ' + lane(squad).n + ' section from Sprint ' + sp.n); notify(lane(squad).n + ' section removed'); renderSprints(); };
  if (itemsOf(sp.id).some(i => i.squad === squad)) confirmDlg('Remove ' + lane(squad).n + '?', 'Its resources, scopes and sub-sections in this sprint will be deleted.', 'Remove section', go); else go();
}
function addResource(sp, squad, name) {
  name = name.trim().slice(0, 60); if (!name) { notify('Type or pick a name first', 'err'); return; }
  const cur = ((S.sprints[sp.id].secs || {})[squad] || {}).people || [];
  if (cur.some(p => p.toLowerCase() === name.toLowerCase())) { notify(name + ' is already in this section', 'err'); return; }
  ensureSec(sp, squad, name); logAct('sprint', 'added ' + name + ' to ' + lane(squad).n + ' in Sprint ' + sp.n); notify(name + ' added. Add their scope.'); renderSprints();
}
function removeResource(sp, squad, name) {
  const mine = itemsOf(sp.id).filter(i => i.squad === squad && (i.person || '') === name);
  const go = () => { mine.forEach(i => delItem(i.id)); const d = base(sp); d.secs = Object.assign({}, d.secs || {}); if (d.secs[squad]) d.secs[squad] = Object.assign({}, d.secs[squad], { people: (d.secs[squad].people || []).filter(p => p !== name) }); saveSprint(sp.id, d); notify(name + ' removed'); renderSprints(); };
  if (mine.length) confirmDlg('Remove ' + name + '?', 'Their scopes and sub-sections in this sprint will be deleted.', 'Remove resource', go); else go();
}
/** Multi-line add box (one per line, grows while typing, Ctrl+Enter adds). */
function addBox(label, placeholder, btnText, onAdd, ro) {
  const f = el('form', 'spadd'), ta = el('textarea'), go = el('button', 'btn sm', btnText); go.type = 'submit'; ta.disabled = go.disabled = ro;
  ta.rows = 2; ta.placeholder = placeholder; ta.setAttribute('aria-label', label); autoGrow(ta); submitOnCtrlEnter(ta, f); f.append(ta, go);
  f.addEventListener('submit', e => { e.preventDefault(); if (!canWrite()) { notify('You have view-only access', 'err'); return; } const rows = parsePaste(ta.value); if (!rows.length) { notify('Type at least one line first', 'err'); return; } onAdd(rows); });
  return f;
}
const stSel = (val, ro, cb) => { const s = selOf(Object.keys(SSTATUS).map(x => [x, SSTATUS[x]]), val || 'planned', 'spsel sst-' + (val || 'planned')); s.disabled = ro; s.setAttribute('aria-label', 'Status'); s.addEventListener('change', () => { cb(s.value); s.className = 'spsel sst-' + s.value; }); return s; };
const delBtn = (label, fn, ro) => { const x = el('button', 'btn sm danger', '✕'); x.type = 'button'; x.title = label; x.setAttribute('aria-label', label); x.disabled = ro; x.addEventListener('click', fn); return x; };
const titleBox = (it, label, ro) => { const t = richBox('sptext', it.h, it.t, label, (h, pl) => { if (!pl) { t.textContent = it.t; return; } saveItem(it.id, { t: pl.slice(0, 1200), h: h.slice(0, 4000) }); }); if (ro) t.contentEditable = 'false'; return t; };

function scopeBlock(sp, sc, kids, ro) {
  const b = el('div', 'spscope'); b.dataset.id = sc.id; b.style.setProperty('--c', lane(sc.squad).c);
  const r = el('div', 'sprow'), sub = kids[sc.id] || [];
  r.append(titleBox(sc, 'Scope title', ro));
  const k = selOf(Object.keys(SKIND).map(x => [x, SKIND[x]]), sc.kind || 'feature', 'spsel'); k.disabled = ro; k.setAttribute('aria-label', 'Type'); k.addEventListener('change', () => saveItem(sc.id, { kind: k.value })); r.append(k);
  if (sub.length) { const d = scopeStatus(sub, sc.st); r.append(el('span', 'derived sst-' + d, SSTATUS[d])); }
  else r.append(stSel(sc.st, ro, v => saveItem(sc.id, { st: v, dn: v === 'done' ? todayIso() : '' })));
  r.append(delBtn('Delete scope', () => { const n = sub.length; sub.forEach(i => delItem(i.id)); delItem(sc.id); notify('Scope deleted' + (n ? ' with ' + n + ' sub-section' + (n === 1 ? '' : 's') : '')); renderSprints(); }, ro)); b.append(r);
  sub.forEach(c => {
    const cr = el('div', 'sprow spsub'); cr.dataset.id = c.id; cr.append(titleBox(c, 'Sub-section title', ro), stSel(c.st, ro, v => saveItem(c.id, { st: v, dn: v === 'done' ? todayIso() : '' })), delBtn('Delete sub-section', () => { delItem(c.id); notify('Sub-section deleted'); renderSprints(); }, ro)); b.append(cr);
  });
  const sf = addBox('Add sub-sections to ' + plainSlice(sc.t), 'Add sub-sections: one per line', 'Add sub-sections', rows => {
    rows.forEach((x, i) => saveItem(uid('si'), { sp: sp.id, squad: sc.squad, person: sc.person || '', par: sc.id, t: x.t, kind: sc.kind || 'feature', st: 'planned', ord: Date.now() + i }));
    logAct('sprint', 'added ' + rows.length + ' sub-section' + (rows.length === 1 ? '' : 's') + ' to "' + plainSlice(sc.t) + '"'); notify(rows.length + ' sub-section' + (rows.length === 1 ? '' : 's') + ' added'); renderSprints();
  }, ro); sf.classList.add('spsub'); b.append(sf);
  return b;
}
function resourceBlock(sp, squad, name, tops, kids, ro) {
  const blk = el('div', 'spres'); blk.dataset.person = name;
  const hd = el('div', 'reshd'), info = directory().get(name);
  hd.append(el('b', '', name || 'Unassigned'), el('span', 'role', info ? info.domain : ''), el('span', 'sp'));
  if (name) hd.append(delBtn('Remove resource', () => removeResource(sp, squad, name), ro)); blk.append(hd);
  tops.forEach(sc => blk.append(scopeBlock(sp, sc, kids, ro)));
  blk.append(addBox('Add scopes for ' + (name || 'Unassigned'), 'Add scopes: one per line (each scope can have sub-sections). Ctrl+Enter adds.', 'Add scopes', rows => {
    rows.forEach((x, i) => saveItem(uid('si'), { sp: sp.id, squad: squad, person: name, par: '', t: x.t, kind: 'feature', st: 'planned', ord: Date.now() + i }));
    ensureSec(sp, squad, name); logAct('sprint', 'added ' + rows.length + ' scope' + (rows.length === 1 ? '' : 's') + ' for ' + (name || 'Unassigned') + ' in Sprint ' + sp.n); notify(rows.length + ' scope' + (rows.length === 1 ? '' : 's') + ' added for ' + (name || 'Unassigned')); renderSprints();
  }, ro));
  return blk;
}
function sectionCard(sp, ln, t, ro) {
  const card = el('section', 'card spsec'); card.dataset.sq = ln.k; card.style.setProperty('--c', ln.c); card.style.borderTop = '4px solid ' + ln.c;
  const mine = t.tops.filter(i => i.squad === ln.k), leaf = t.all.filter(i => i.squad === ln.k && !t.kids[i.id]);
  const hd = el('div', 'sechd'); hd.append(el('h2', '', ln.n), el('span', 'meta', mine.length + ' scope' + (mine.length === 1 ? '' : 's') + ' · ' + leaf.filter(i => i.st === 'done').length + '/' + leaf.length + ' done'));
  const rm = el('button', 'btn sm danger', 'Remove section'); rm.type = 'button'; rm.disabled = ro; rm.addEventListener('click', () => removeSection(sp, ln.k)); hd.append(rm); card.append(hd);
  const reg = ((sp.secs || {})[ln.k] || {}).people || [], names = reg.concat(mine.map(i => i.person || '').filter(p => p && !reg.includes(p))).slice();
  names.forEach(n => card.append(resourceBlock(sp, ln.k, n, mine.filter(i => (i.person || '') === n), t.kids, ro)));
  if (mine.some(i => !i.person)) card.append(resourceBlock(sp, ln.k, '', mine.filter(i => !i.person), t.kids, ro));
  const f = el('form', 'spaddres'), inp = el('input'), dl = el('datalist'), go = el('button', 'btn sm', 'Add resource'); go.type = 'submit'; inp.disabled = go.disabled = ro;
  dl.id = 'dl-' + ln.k; const all = [...directory().values()].sort((a, b) => (b.sqs.has(ln.k) - a.sqs.has(ln.k)) || a.name.localeCompare(b.name)); all.forEach(p => { const o = el('option'); o.value = p.name; o.label = p.domain; dl.append(o); });
  inp.setAttribute('list', dl.id); inp.placeholder = 'Add a resource: pick from the team or type a name'; inp.setAttribute('aria-label', 'Resource name'); f.append(inp, dl, go);
  f.addEventListener('submit', e => { e.preventDefault(); if (!canWrite()) { notify('You have view-only access', 'err'); return; } addResource(sp, ln.k, inp.value); });
  card.append(f); return card;
}
function carryOver(sp) {
  const prev = sprintList().find(s => s.n === sp.n - 1); if (!prev) { notify('There is no previous sprint to carry over from', 'err'); return; }
  const tp = tree(prev.id), have = new Set(itemsOf(sp.id).map(i => i.squad + '|' + i.person + '|' + i.t.toLowerCase())); let c = 0;
  tp.tops.forEach(sc => {
    const kids = (tp.kids[sc.id] || []).filter(k => k.st !== 'done');
    if (tp.kids[sc.id] ? !kids.length : sc.st === 'done') return; if (have.has(sc.squad + '|' + sc.person + '|' + sc.t.toLowerCase())) return;
    const id = uid('si'); saveItem(id, { sp: sp.id, squad: sc.squad, person: sc.person || '', par: '', t: sc.t, h: sc.h || '', kind: sc.kind || 'feature', st: 'planned', ord: Date.now() + c }); c++;
    kids.forEach((k, j) => saveItem(uid('si'), { sp: sp.id, squad: k.squad, person: k.person || '', par: id, t: k.t, h: k.h || '', kind: k.kind || 'feature', st: k.st === 'blocked' ? 'blocked' : 'planned', ord: Date.now() + c + j + 1 }));
    ensureSec(sp, sc.squad, sc.person || '');
  });
  if (c) { logAct('sprint', 'carried ' + c + ' unfinished scope' + (c === 1 ? '' : 's') + ' into Sprint ' + sp.n); notify(c + ' unfinished scope' + (c === 1 ? '' : 's') + ' carried over from Sprint ' + prev.n); } else notify('Nothing unfinished to carry over', 'info');
  renderSprints();
}
function pasteDlg(sp) {
  openDlg('Paste scopes', box => {
    const sq = selOf(LANES.map(l => [l.k, l.n]), LANES[0].k), pe = el('input'); pe.placeholder = 'Resource name (optional)'; pe.setAttribute('aria-label', 'Resource'); pe.setAttribute('list', 'dl-' + LANES[0].k);
    const ta = el('textarea'); ta.rows = 6; ta.placeholder = 'One scope per line. Bullets and numbering are removed.'; ta.setAttribute('aria-label', 'Scopes'); autoGrow(ta);
    const info = el('p', 'sub', 'Nothing yet'); ta.addEventListener('input', () => { info.textContent = parsePaste(ta.value).length + ' scope(s) found'; });
    const ok = el('button', 'btn primary', 'Add scopes'), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button';
    ok.addEventListener('click', () => {
      const rows = parsePaste(ta.value); if (!rows.length) { notify('Paste at least one line first', 'err'); return; }
      rows.forEach((r, i) => saveItem(uid('si'), { sp: sp.id, squad: sq.value, person: pe.value.trim(), par: '', t: r.t, kind: 'feature', st: 'planned', ord: Date.now() + i }));
      ensureSec(sp, sq.value, pe.value.trim()); logAct('sprint', 'pasted ' + rows.length + ' scope' + (rows.length === 1 ? '' : 's') + ' into Sprint ' + sp.n); notify(rows.length + ' scope' + (rows.length === 1 ? '' : 's') + ' added'); closeDlg(); renderSprints();
    });
    no.addEventListener('click', closeDlg);
    const row = el('div', 'row'); row.append(ok, no);
    box.append(fld('Product section', sq), fld('Resource', pe), fld('Scopes', ta), info, row);
  });
}
function detailView(pg, sp, ro) {
  const back = el('a', 'spback', '← All sprints'); back.href = '#/sprints'; pg.append(back);
  pg.append(pageHead('Sprint ' + sp.n, 'Set the dates, add a product section, then add its resources and their scope.'));
  const sbn = setupBanner(); if (sbn) pg.append(sbn);
  const dr = el('div', 'spdates'), fa = el('input'), fb = el('input'); fa.type = fb.type = 'date'; fa.value = sp.a; fb.value = sp.b; fa.disabled = fb.disabled = ro; fa.setAttribute('aria-label', 'Sprint start date'); fb.setAttribute('aria-label', 'Sprint end date');
  const chg = () => setDates(sp, fa.value, fb.value, fa, fb); fa.addEventListener('change', chg); fb.addEventListener('change', chg);
  dr.append(fld('From', fa), fld('To', fb), el('span', 'sub', (parseIso(sp.b) >= parseIso(sp.a) ? Math.round((parseIso(sp.b) - parseIso(sp.a)) / DAY) + 1 : 0) + ' days')); pg.append(dr);
  const t = tree(sp.id), present = Object.keys(sp.secs || {}).concat(t.tops.map(i => i.squad)).filter((k, i, a) => a.indexOf(k) === i), free = LANES.filter(l => !present.includes(l.k));
  const bar = el('div', 'row spbar');
  if (free.length) { const s = selOf(free.map(l => [l.k, l.n]), free[0].k); s.setAttribute('aria-label', 'Product section'); s.disabled = ro; const ab = el('button', 'btn primary', '+ Add product section'); ab.type = 'button'; ab.disabled = ro; ab.addEventListener('click', () => addSection(sp, s.value)); bar.append(s, ab); }
  const pb = el('button', 'btn', 'Paste scopes'), cb = el('button', 'btn', 'Carry over unfinished'); pb.type = cb.type = 'button'; pb.disabled = cb.disabled = ro; pb.addEventListener('click', () => pasteDlg(sp)); cb.addEventListener('click', () => carryOver(sp)); bar.append(pb, cb); pg.append(bar);
  if (!ro) pg.append(richBar());
  if (!present.length) { pg.append(el('p', 'empty', 'No product section yet. Pick one above and click "+ Add product section".')); return; }
  LANES.filter(l => present.includes(l.k)).forEach(ln => pg.append(sectionCard(sp, ln, t, ro)));
  present.filter(k => !LANES.some(l => l.k === k)).forEach(k => pg.append(sectionCard(sp, lane(k), t, ro)));
}

export function renderSprints() {
  const pg = $('pg-sprints'); if (!pg) return; pg.textContent = '';
  const ro = !canEdit() || !canWrite(), id = routeId(), sp = id ? sprintList().find(s => s.id === id) : null;
  if (id && !sp) {
    const back = el('a', 'spback', '← All sprints'); back.href = '#/sprints'; pg.append(back, pageHead('Sprint not found', 'It may have been deleted, or it is still loading.')); return;
  }
  if (sp) detailView(pg, sp, ro); else listView(pg, ro);
}
window.addEventListener('hashchange', () => { if (state.page === 'sprints') renderSprints(); });
