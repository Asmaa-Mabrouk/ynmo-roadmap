/**
 * @module pages/sprints
 * Sprint planning (editors/admins only).
 *  - `#/sprints`        the list of sprints (each card is one link: Ctrl/Cmd-click or middle-click opens a new tab; a "⋯" menu has the rest).
 *  - `#/sprints/<id>`   one sprint as a document: an outline of blocks typed like in Word.
 *      `/` menu (product section, person, scope, sub-section, note) · `@` person · `#` coloured tag · Tab / Shift+Tab indent
 *      Enter splits a line · Alt+↑/↓ moves a line · paste a list to create many lines.
 * Data: `sprints` docs {n,a,b,note,tags:{name:colour}}; `sprint_items` docs {sp,k,sq,t,st,dn,tags[],ord} (k = h|p|s|u|n, see features/sprint-doc.js).
 * Items saved by the first version ({squad,person,par}) are converted once, when the sprint is opened.
 * The weekly report reads `itemsOf(sprint)`, which flattens the outline (see pages/reports.js).
 */
import { S } from '../core/state.js';
import { DAY, LANES, canEdit, directory, el, parseIso, $ } from '../core/model.js';
import { fld, fmtIso, logAct, pageHead, todayIso } from '../core/shared.js';
import { write } from '../core/saving.js';
import { openDlg, closeDlg, canWrite } from '../features/safety.js';
import { SSTATUS, scopeStatus } from '../features/report-model.js';
import { RANK, KIND_NAME, TAG_COLORS, derive, deeper, shallower, nextKind, tagKey, migrate, ordBetween, parseOutline } from '../features/sprint-doc.js';
import { setupBanner } from './reports.js';
import { notify } from '../ui/notify.js';
import { openMenu, closeMenu } from '../ui/menu.js';
import { crumbs } from '../ui/crumbs.js';
import { state } from '../core/model.js';

const iso = t => new Date(t).toISOString().slice(0, 10);
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const routeId = () => { const m = /^#\/sprints\/(\w+)/.exec(location.hash); return m ? m[1] : null; };
const lane = k => LANES.find(l => l.k === k) || { k: k, n: k, c: 'var(--brand)' };
const base = sp => { const d = Object.assign({}, S.sprints[sp.id] || sp); delete d.id; return d; };
const DEFAULT_TAGS = { fix: 'red', support: 'blue' };

export const sprintList = () => Object.keys(S.sprints).map(id => Object.assign({ id: id }, S.sprints[id])).filter(s => s.a && s.b).sort((x, y) => y.n - x.n);
const rows = sp => Object.keys(S.sitems).map(id => Object.assign({ id: id }, S.sitems[id])).filter(i => i.sp === sp).sort((a, b) => (a.ord || 0) - (b.ord || 0) || (a.id < b.id ? -1 : 1));
const blocksOf = sp => rows(sp).filter(i => i.k);
const tagMap = sp => Object.assign({}, DEFAULT_TAGS, (S.sprints[sp] || {}).tags || {});
/** Flat items of a sprint for the report and the list (scopes with `par` = '' and their sub-sections). */
export function itemsOf(sp) {
  const all = rows(sp), legacy = all.filter(i => !i.k);
  if (legacy.length) return legacy.map(i => Object.assign({ tg: [] }, i));
  return derive(all, tagMap(sp));
}
/** Scopes (top level) and their sub-sections of one sprint. */
export function tree(spId) {
  const all = itemsOf(spId), ids = new Set(all.map(i => i.id)), kids = {}, tops = [];
  all.forEach(i => { if (i.par && ids.has(i.par)) (kids[i.par] = kids[i.par] || []).push(i); else tops.push(i); });
  return { all, tops, kids };
}
/** Parse pasted text: one item per line; bullets/numbering are stripped. */
export function parsePaste(txt) {
  const out = [];
  String(txt || '').split(/\r?\n/).forEach(raw => { const s = raw.replace(/^\s*(?:[-*•▪◦·]|\d+[.)])\s*/, '').trim(); if (s) out.push({ t: s.slice(0, 300), jira: '' }); });
  return out;
}

function saveSprint(id, d) { S.sprints[id] = d; write('sprints/' + id, d); }
function saveItem(id, patch) { const d = Object.assign({}, S.sitems[id] || {}, patch); S.sitems[id] = d; write('sprint_items/' + id, d); }
function delItem(id) { delete S.sitems[id]; write('sprint_items/' + id, null); }
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
  saveSprint(id, { n: n, a: a, b: iso(parseIso(a) + 13 * DAY), note: '', tags: {} });
  logAct('sprint', 'created Sprint ' + n + ' (' + fmtIso(a) + ')'); notify('Sprint ' + n + ' created. Choose the dates, then press / to add a product section.'); location.hash = '#/sprints/' + id;
}
function deleteSprint(sp) {
  confirmDlg('Delete Sprint ' + sp.n + '?', 'This deletes the sprint and everything written in it. Weekly reports already created from it are kept.', 'Delete sprint', () => {
    rows(sp.id).forEach(i => delItem(i.id)); delete S.sprints[sp.id]; write('sprints/' + sp.id, null);
    logAct('sprint', 'deleted Sprint ' + sp.n); notify('Sprint ' + sp.n + ' deleted'); location.hash = '#/sprints'; renderSprints();
  });
}
function listView(pg, ro) {
  const nb = el('button', 'btn primary', '+ New sprint'); nb.type = 'button'; nb.disabled = ro; nb.addEventListener('click', newSprint);
  pg.append(pageHead('Sprints', 'All two-week sprints. Open one to write its plan. The weekly executive report is built from them and from the roadmap.', nb));
  const sbn = setupBanner(); if (sbn) pg.append(sbn);
  const l = sprintList(); if (!l.length) { pg.append(el('p', 'empty', 'No sprint yet. Click "+ New sprint" to create the first one.')); return; }
  const wrap = el('div', 'splist');
  l.forEach(sp => {
    const t = tree(sp.id), leaf = t.all.filter(i => !t.kids[i.id]), done = leaf.filter(i => i.st === 'done').length, pct = leaf.length ? Math.round(100 * done / leaf.length) : 0;
    const secs = Object.keys(sp.secs || {}).concat(rows(sp.id).filter(i => i.k === 'h').map(i => i.sq), t.tops.map(i => i.squad)).filter((k, i, a) => k && a.indexOf(k) === i);
    const card = el('div', 'card spcard'), info = el('div');
    const a = el('a', 'splink'); a.href = '#/sprints/' + sp.id; a.append(el('h2', '', 'Sprint ' + sp.n));
    info.append(a, el('div', 'meta', fmtIso(sp.a) + ' to ' + fmtIso(sp.b) + ' · ' + (Math.round((parseIso(sp.b) - parseIso(sp.a)) / DAY) + 1) + ' days'));
    const pr = el('div', 'prods'); secs.forEach(k => { const c = el('span', 'pchip', lane(k).n); c.style.setProperty('--c', lane(k).c); pr.append(c); }); if (!secs.length) pr.append(el('span', 'meta', 'No product sections yet')); info.append(pr);
    const prog = el('div', 'prog'); prog.append(el('div', 'meta', done + ' of ' + leaf.length + ' done')); const b0 = el('div', 'bar0'), i0 = el('i'); i0.style.width = pct + '%'; b0.append(i0); prog.append(b0);
    const more = el('button', 'btn sm spmore', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'More actions for Sprint ' + sp.n); more.setAttribute('aria-haspopup', 'menu');
    more.addEventListener('click', () => openMenu(more, [{ label: 'Open in new tab', value: 'tab' }, { label: 'Delete sprint', value: 'del', disabled: ro }], {
      search: false, label: 'Sprint actions', onPick: it => { if (it.value === 'tab') window.open(location.pathname + location.search + '#/sprints/' + sp.id, '_blank', 'noopener'); else deleteSprint(sp); }, onClose: () => more.focus()
    }));
    card.append(info, prog, more); wrap.append(card);
  });
  pg.append(wrap);
}

/* ---------- one sprint: dates ---------- */
function setDates(sp, a, b, fromEl, toEl) {
  if (!parseIso(a) || !parseIso(b)) { notify('Choose both dates', 'err'); return; }
  if (b < a) { notify('The end date is before the start date', 'err'); fromEl.value = sp.a; toEl.value = sp.b; return; }
  if (a === sp.a && b === sp.b) return;
  saveSprint(sp.id, Object.assign(base(sp), { a: a, b: b })); logAct('sprint', 'set Sprint ' + sp.n + ' dates to ' + fmtIso(a) + ' – ' + fmtIso(b)); notify('Dates updated: ' + fmtIso(a) + ' to ' + fmtIso(b)); renderSprints();
}

/* ---------- one sprint: the document ---------- */
/** Convert the first version's items once (and the empty sections it registered). */
function ensureMigrated(sp) {
  const all = rows(sp.id), legacy = all.filter(i => !i.k);
  if (!legacy.length && !(Object.keys(sp.secs || {}).length && !all.length)) return;
  const plan = migrate(sp, legacy, k => lane(k).n);
  plan.forEach(p => { const id = p.id || uid('si'); S.sitems[id] = p.doc; write('sprint_items/' + id, p.doc); });
  const d = base(sp); d.secs = {}; d.tags = Object.assign({}, DEFAULT_TAGS, d.tags || {}); saveSprint(sp.id, d);
}
function ensureTag(spId, name, color) {
  const cur = tagMap(spId);
  if (cur[name] && !color) return cur[name];
  const c = color || TAG_COLORS[Object.keys(cur).length % TAG_COLORS.length], d = base({ id: spId }); d.tags = Object.assign({}, d.tags || {}, { [name]: c }); saveSprint(spId, d); return c;
}
/** A block plus the blocks that belong to it (deeper ones that follow). */
function groupOf(blocks, i) {
  const r = RANK[blocks[i].k]; let j = i + 1;
  if (blocks[i].k === 'n' || blocks[i].k === 'u') return [blocks[i]];
  while (j < blocks.length && RANK[blocks[j].k] > r) j++;
  return blocks.slice(i, j);
}
function caretOf(bt) {
  const s = window.getSelection(); if (!s.rangeCount || !bt.contains(s.anchorNode)) return 0;
  const r = s.getRangeAt(0).cloneRange(); r.selectNodeContents(bt); r.setEnd(s.anchorNode, s.anchorOffset); return r.toString().length;
}
function setCaret(bt, pos) {
  bt.focus(); const n = bt.firstChild, r = document.createRange();
  if (!n) r.setStart(bt, 0); else { const len = n.textContent.length; r.setStart(n, Math.min(pos === 'end' ? len : pos === 'start' ? 0 : pos, len)); }
  r.collapse(true); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
}
const saveTimers = {};

function docEditor(sp, ro) {
  const host = el('div', 'sdoc'); host.setAttribute('role', 'group'); host.setAttribute('aria-label', 'Sprint plan');
  const spId = sp.id;
  const list = () => blocksOf(spId);
  const focusLater = (id, pos) => { const bt = host.querySelector('.blk[data-id="' + id + '"] .bt'); if (bt) setCaret(bt, pos === undefined ? 'end' : pos); };
  const redraw = (focusId, pos) => { draw(); if (focusId) focusLater(focusId, pos); };
  const flush = id => { if (saveTimers[id]) { clearTimeout(saveTimers[id]); delete saveTimers[id]; if (S.sitems[id]) { S.sitems[id] = Object.assign({}, S.sitems[id], { t: String(S.sitems[id].t || '').trim() }); write('sprint_items/' + id, S.sitems[id]); } } };
  /** Create blocks with the given specs right after block `afterId` (or at the end). Returns their ids. */
  const insert = (afterId, specs) => {
    const all = list(), i = afterId ? all.findIndex(b => b.id === afterId) : all.length - 1, a = i >= 0 ? all[i].ord : undefined, b = i >= 0 && all[i + 1] ? all[i + 1].ord : undefined;
    const ords = ordBetween(a, b, specs.length), ids = [];
    specs.forEach((s, n) => { const id = uid('si'); ids.push(id); const d = { sp: spId, k: s.k, t: s.t || '', st: 'planned', dn: '', tags: (s.tags || []).slice(), ord: ords[n] }; if (s.sq) d.sq = s.sq; S.sitems[id] = d; write('sprint_items/' + id, d); s.tags && s.tags.forEach(t => ensureTag(spId, t)); });
    return ids;
  };
  const removeGroup = (b) => {
    const all = list(), i = all.findIndex(x => x.id === b.id), g = groupOf(all, i), go = () => { g.forEach(x => delItem(x.id)); notify(g.length > 1 ? g.length + ' lines deleted' : 'Line deleted'); redraw(); };
    if (g.length > 1) confirmDlg('Delete ' + (KIND_NAME[b.k] || 'line') + '?', 'This also deletes the ' + (g.length - 1) + ' line' + (g.length === 2 ? '' : 's') + ' inside it.', 'Delete', go); else go();
  };
  const move = (b, d) => {
    const all = list(), i = all.findIndex(x => x.id === b.id), g = groupOf(all, i), gi = new Set(g.map(x => x.id)), rest = all.filter(x => !gi.has(x.id)), r = RANK[b.k], note = b.k === 'n';
    let at; // index in `rest` before which the group is placed
    if (d < 0) {
      let j = i - 1; if (j < 0) return;
      if (!note) { while (j >= 0 && RANK[rest[j].k] > r) j--; if (j < 0 || RANK[rest[j].k] < r) return; }
      at = j;
    } else {
      const t = rest[i]; if (!t) return; if (!note && RANK[t.k] !== r) return;
      let k = i + 1; if (!note) while (k < rest.length && RANK[rest[k].k] > RANK[t.k]) k++;
      at = k;
    }
    const ords = ordBetween(rest[at - 1] ? rest[at - 1].ord : undefined, rest[at] ? rest[at].ord : undefined, g.length); g.forEach((x, n) => saveItem(x.id, { ord: ords[n] }));
    redraw(b.id);
  };
  const freeLanes = () => { const used = new Set(list().filter(b => b.k === 'h').map(b => b.sq)); return LANES.filter(l => !used.has(l.k)); };
  const peopleItems = squad => [...directory().values()].sort((a, b) => (b.sqs.has(squad) - a.sqs.has(squad)) || a.name.localeCompare(b.name)).map(p => ({ label: p.name, sub: p.domain, value: p.name }));
  const squadAt = b => { let sq = ''; for (const x of list()) { if (x.k === 'h') sq = x.sq; if (x.id === b.id) break; } return sq; };

  /* menus (they set the block they were opened from) */
  const pickPerson = (b, at, after) => openMenu(at, peopleItems(squadAt(b)), {
    label: 'Choose a person', placeholder: 'Search the team or type a name', create: q => ({ label: 'Add “' + q.slice(0, 60) + '”', value: q.slice(0, 60) }),
    onPick: it => { saveItem(b.id, { k: 'p', t: it.value, tags: [] }); const ids = after === false ? [] : insert(b.id, [{ k: 's' }]); notify(it.value + ' added'); redraw(ids[0] || b.id); }, onClose: p => { if (!p) focusLater(b.id); }
  });
  const pickLane = (b, at) => {
    const fl = freeLanes(); if (!fl.length) { notify('Every product section is already in this sprint', 'info'); focusLater(b.id); return; }
    openMenu(at, fl.map(l => ({ label: l.n, dot: l.c, value: l.k })), {
      label: 'Choose a product section', onPick: it => { saveItem(b.id, { k: 'h', sq: it.value, t: lane(it.value).n, tags: [] }); const ids = insert(b.id, [{ k: 'p' }]); notify(lane(it.value).n + ' section added'); redraw(ids[0]); }, onClose: p => { if (!p) focusLater(b.id); }
    });
  };
  const kindMenu = (b, at) => openMenu(at, [
    { label: 'Product section', sub: 'A product of the report', value: 'h' }, { label: 'Person', sub: 'Who works on it (@)', value: 'p' },
    { label: 'Scope', sub: 'A piece of work', value: 's' }, { label: 'Sub-section', sub: 'A step inside a scope', value: 'u' }, { label: 'Note', sub: 'Not in the report', value: 'n' }
  ], {
    label: 'Insert', placeholder: 'Type to filter…', onClose: p => { if (!p) focusLater(b.id); },
    onPick: it => { if (it.value === 'h') pickLane(b, at); else if (it.value === 'p') pickPerson(b, at); else { saveItem(b.id, { k: it.value, tags: [] }); redraw(b.id); } }
  });
  const tagMenu = (b, at) => {
    const cur = tagMap(spId), have = new Set(b.tags || []), used = new Set(list().flatMap(x => x.tags || []));
    const items = Object.keys(cur).concat([...used].filter(n => !cur[n])).filter((n, i, a) => a.indexOf(n) === i && !have.has(n)).map(n => ({ label: '#' + n, dot: 'var(--tg-' + (cur[n] || 'gray') + ')', value: n }));
    openMenu(at, items, {
      label: 'Add a tag', placeholder: 'Find or create a tag', create: q => { const k = tagKey(q); return k ? { label: 'Create #' + k, dot: 'var(--tg-gray)', value: k } : null; },
      onPick: it => { ensureTag(spId, it.value); saveItem(b.id, { tags: (S.sitems[b.id].tags || []).concat(it.value) }); redraw(b.id); }, onClose: p => { if (!p) focusLater(b.id); }
    });
  };
  const chipMenu = (b, name, at) => {
    openMenu(at, TAG_COLORS.map(c => ({ label: c[0].toUpperCase() + c.slice(1), dot: 'var(--tg-' + c + ')', value: 'c:' + c })).concat([{ label: 'Remove tag from this line', value: 'rm' }]), {
      label: '#' + name + ' options', search: true, onPick: it => { if (it.value === 'rm') saveItem(b.id, { tags: (S.sitems[b.id].tags || []).filter(x => x !== name) }); else ensureTag(spId, name, it.value.slice(2)); redraw(); }, onClose: () => { const s = host.querySelector('.blk[data-id="' + b.id + '"] .bt'); if (s) s.focus(); }
    });
  };
  const statusMenu = (b, at) => openMenu(at, Object.keys(SSTATUS).map(k => ({ label: SSTATUS[k], value: k })), {
    label: 'Status', onPick: it => { saveItem(b.id, { st: it.value, dn: it.value === 'done' ? todayIso() : '' }); redraw(); }, onClose: () => { const s = host.querySelector('.blk[data-id="' + b.id + '"] .bt'); if (s) s.focus(); }
  });

  /* keys inside a line */
  const onKey = (e, b, bt) => {
    if (e.isComposing) return;
    const txt = bt.textContent, pos = caretOf(bt), empty = !txt.trim(), all = list(), i = all.findIndex(x => x.id === b.id);
    const nb = d => { const bts = [...host.querySelectorAll('.bt[contenteditable]')], j = bts.indexOf(bt) + d; return bts[j]; };
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); move(b, e.key === 'ArrowUp' ? -1 : 1); return; }
    if (e.key === 'Enter') {
      e.preventDefault(); if (e.ctrlKey || e.metaKey) return;
      if (empty && b.k !== 'n') { const k = shallower(b.k); if (k !== b.k) { saveItem(b.id, { k: k }); redraw(b.id); } return; }
      const atEnd = pos >= txt.length, g = groupOf(all, i), after = atEnd && b.k === 's' ? g[g.length - 1].id : b.id;
      const head = txt.slice(0, pos), tail = txt.slice(pos);
      if (!atEnd) { saveItem(b.id, { t: head.trim() }); }
      const ids = insert(after, [{ k: nextKind(b.k), t: atEnd ? '' : tail.trim() }]); redraw(ids[0], 'start'); return;
    }
    if (e.key === 'Tab') { e.preventDefault(); const k = e.shiftKey ? shallower(b.k) : deeper(b.k); if (k !== b.k) { saveItem(b.id, { k: k }); redraw(b.id, pos); } return; }
    if (e.key === 'Backspace' && empty) { e.preventDefault(); const prev = nb(-1), pid = prev && prev.closest('.blk').dataset.id; delItem(b.id); redraw(pid, 'end'); return; }
    if (e.key === 'ArrowUp' && pos === 0) { const p = nb(-1); if (p) { e.preventDefault(); setCaret(p, 'end'); } return; }
    if (e.key === 'ArrowDown' && pos >= txt.length) { const n = nb(1); if (n) { e.preventDefault(); setCaret(n, 'start'); } return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/' && empty) { e.preventDefault(); kindMenu(b, bt); return; }
    if (e.key === '@' && empty) { e.preventDefault(); pickPerson(b, bt); return; }
    if (e.key === '#' && b.k !== 'p' && (pos === 0 || pos >= txt.length || /\s/.test(txt[pos - 1]))) { e.preventDefault(); tagMenu(b, bt); }
  };
  const onPaste = (e, b, bt) => {
    const text = (e.clipboardData || window.clipboardData).getData('text/plain'); e.preventDefault();
    if (!/\r?\n/.test(text.trim())) { document.execCommand('insertText', false, text.replace(/\s+/g, ' ').trim()); return; }
    const parsed = parseOutline(text, LANES); if (!parsed.length) return;
    const all = list(), i = b ? all.findIndex(x => x.id === b.id) : -1, empty = b && !bt.textContent.trim();
    const ids = insert(b ? b.id : '', parsed); void i;
    if (empty) delItem(b.id);
    const scopes = parsed.filter(x => x.k === 's').length;
    notify(parsed.length + ' line' + (parsed.length === 1 ? '' : 's') + ' added' + (scopes ? ' (' + scopes + ' scope' + (scopes === 1 ? '' : 's') + ')' : '')); redraw(ids[ids.length - 1]);
  };

  function blockRow(b, c, info) {
    const r = el('div', 'blk k-' + b.k); r.dataset.id = b.id; r.style.setProperty('--c', c);
    if (b.k === 'h') {
      const t = el('h2', 'bh', lane(b.sq).n); r.append(t, el('span', 'meta', info.count));
    } else {
      if (b.k === 's' || b.k === 'u') {
        if (info.derived) r.append(el('span', 'stp derived sst-' + info.derived, SSTATUS[info.derived]));
        else { const s = el('button', 'stp sst-' + (b.st || 'planned'), SSTATUS[b.st || 'planned']); s.type = 'button'; s.disabled = ro; s.setAttribute('aria-label', 'Status'); s.setAttribute('aria-haspopup', 'listbox'); s.addEventListener('click', () => statusMenu(b, s)); r.append(s); }
      }
      const bt = el('div', 'bt', b.t || ''); bt.dataset.ph = { p: 'Person name (or press @)', s: 'Scope', u: 'Sub-section', n: 'Note' }[b.k]; bt.setAttribute('role', 'textbox'); bt.setAttribute('aria-label', KIND_NAME[b.k]);
      if (!ro) {
        bt.contentEditable = 'plaintext-only'; if (bt.contentEditable !== 'plaintext-only') bt.contentEditable = 'true'; bt.spellcheck = true;
        bt.addEventListener('input', () => { const t = bt.textContent; S.sitems[b.id] = Object.assign({}, S.sitems[b.id], { t: t.slice(0, 300) }); clearTimeout(saveTimers[b.id]); saveTimers[b.id] = setTimeout(() => flush(b.id), 500); });
        bt.addEventListener('blur', () => flush(b.id));
        bt.addEventListener('keydown', e => onKey(e, S.sitems[b.id] ? Object.assign({ id: b.id }, S.sitems[b.id]) : b, bt));
        bt.addEventListener('paste', e => onPaste(e, Object.assign({ id: b.id }, S.sitems[b.id] || b), bt));
      }
      r.append(bt);
      if (b.k === 'p') { const inf = directory().get(b.t); if (inf) r.append(el('span', 'role', inf.domain)); }
      const tags = el('span', 'btags'); (b.tags || []).forEach(n => { const ch = el('button', 'tgchip tg-' + (tagMap(spId)[n] || 'gray'), '#' + n); ch.type = 'button'; ch.disabled = ro; ch.setAttribute('aria-label', 'Tag ' + n + ': change colour or remove'); ch.addEventListener('click', () => chipMenu(b, n, ch)); tags.append(ch); }); r.append(tags);
    }
    if (!ro) { const x = el('button', 'blkx', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Delete ' + KIND_NAME[b.k].toLowerCase()); x.addEventListener('click', () => removeGroup(b)); r.append(x); }
    return r;
  }
  function ghostRow(all) {
    const r = el('div', 'blk ghost'), bt = el('div', 'bt'); bt.dataset.ph = all.some(b => b.k === 'h') ? 'Type here, or press / for the menu' : 'Press / and choose Product section to start. You can also paste a list.'; bt.setAttribute('role', 'textbox'); bt.setAttribute('aria-label', 'New line');
    bt.contentEditable = ro ? 'false' : 'plaintext-only'; if (!ro && bt.contentEditable !== 'plaintext-only') bt.contentEditable = 'true';
    const last = all[all.length - 1], kind = !last ? 'n' : nextKind(last.k === 'u' ? 's' : last.k);
    const make = (k, t) => insert('', [{ k: k, t: t || '' }])[0];
    bt.addEventListener('keydown', e => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); const id = make('n'); redraw(id); const b = Object.assign({ id: id }, S.sitems[id]); kindMenu(b, host.querySelector('.blk[data-id="' + id + '"] .bt')); }
      else if (e.key === '@') { e.preventDefault(); const id = make('p'); redraw(id); pickPerson(Object.assign({ id: id }, S.sitems[id]), host.querySelector('.blk[data-id="' + id + '"] .bt')); }
      else if (e.key.length === 1) { e.preventDefault(); const id = make(kind, e.key); redraw(id); }
    });
    bt.addEventListener('paste', e => onPaste(e, null, bt));
    r.append(bt); return r;
  }
  function draw() {
    host.textContent = ''; const all = list(); let c = 'var(--brand)';
    all.forEach((b, i) => {
      if (b.k === 'h') c = lane(b.sq).c;
      const info = {};
      if (b.k === 'h') { const g = groupOf(all, i), ns = g.filter(x => x.k === 's').length, leaf = g.filter((x, n) => x.k === 'u' || (x.k === 's' && !(g[n + 1] && g[n + 1].k === 'u'))); info.count = ns + ' scope' + (ns === 1 ? '' : 's') + ' · ' + leaf.filter(x => x.st === 'done').length + '/' + leaf.length + ' done'; }
      if (b.k === 's') { const kids = []; for (let j = i + 1; j < all.length && all[j].k === 'u'; j++) kids.push(all[j]); if (kids.length) info.derived = scopeStatus(kids, b.st); }
      host.append(blockRow(b, c, info));
    });
    if (!ro) host.append(ghostRow(all));
    if (!all.length && ro) host.append(el('p', 'empty', 'Nothing written in this sprint yet.'));
  }
  host.addEventListener('click', e => { if (!ro && e.target === host) { const g = host.querySelector('.ghost .bt'); if (g) g.focus(); } });
  const addSec = () => { if (!canWrite()) return; if (!freeLanes().length) { notify('Every product section is already in this sprint', 'info'); return; } const ids = insert('', [{ k: 'n' }]); redraw(ids[0]); const bt = host.querySelector('.blk[data-id="' + ids[0] + '"] .bt'); pickLane(Object.assign({ id: ids[0] }, S.sitems[ids[0]]), bt); };
  draw(); host.addSection = addSec; host.redraw = redraw; host.insert = insert;
  return host;
}

function carryOver(sp, ed) {
  const prev = sprintList().find(s => s.n === sp.n - 1); if (!prev) { notify('There is no previous sprint to carry over from', 'err'); return; }
  ensureMigrated(prev);
  const pb = blocksOf(prev.id), have = new Set(blocksOf(sp.id).filter(b => b.k === 's').map(b => b.t.toLowerCase())), specs = []; let h = null, p = null, hEmit = false, pEmit = false, c = 0;
  pb.forEach((b, i) => {
    if (b.k === 'h') { h = b; p = null; hEmit = pEmit = false; return; } if (b.k === 'p') { p = b; pEmit = false; return; } if (b.k !== 's') return;
    const kids = []; for (let j = i + 1; j < pb.length && pb[j].k === 'u'; j++) kids.push(pb[j]);
    const open = kids.length ? kids.filter(k => k.st !== 'done') : (b.st === 'done' ? [] : [b]); if (!open.length || have.has(b.t.toLowerCase())) return;
    if (h && !hEmit) { specs.push({ k: 'h', sq: h.sq, t: h.t }); hEmit = true; } if (p && !pEmit) { specs.push({ k: 'p', t: p.t }); pEmit = true; }
    specs.push({ k: 's', t: b.t, tags: b.tags }); if (kids.length) open.forEach(k => specs.push({ k: 'u', t: k.t, tags: k.tags, st: k.st === 'blocked' ? 'blocked' : 'planned' })); c++;
  });
  if (!c) { notify('Nothing unfinished to carry over', 'info'); return; }
  const ids = ed.insert('', specs); specs.forEach((s, n) => { if (s.st) saveItem(ids[n], { st: s.st }); });
  logAct('sprint', 'carried ' + c + ' unfinished scope' + (c === 1 ? '' : 's') + ' into Sprint ' + sp.n); notify(c + ' unfinished scope' + (c === 1 ? '' : 's') + ' carried over from Sprint ' + prev.n); ed.redraw();
}
function detailView(pg, sp, ro) {
  ensureMigrated(sp); sp = Object.assign({ id: sp.id }, S.sprints[sp.id]);
  pg.append(crumbs([{ label: 'Sprints', href: '#/sprints' }, { label: 'Sprint ' + sp.n }]));
  pg.append(pageHead('Sprint ' + sp.n, 'Write the plan like a document. Type / for the menu, @ for a person, # for a tag, Tab to indent. Paste a list to add many lines.'));
  const sbn = setupBanner(); if (sbn) pg.append(sbn);
  const dr = el('div', 'spdates'), fa = el('input'), fb = el('input'); fa.type = fb.type = 'date'; fa.value = sp.a; fb.value = sp.b; fa.disabled = fb.disabled = ro; fa.setAttribute('aria-label', 'Sprint start date'); fb.setAttribute('aria-label', 'Sprint end date');
  const chg = () => setDates(sp, fa.value, fb.value, fa, fb); fa.addEventListener('change', chg); fb.addEventListener('change', chg);
  dr.append(fld('From', fa), fld('To', fb), el('span', 'sub', (parseIso(sp.b) >= parseIso(sp.a) ? Math.round((parseIso(sp.b) - parseIso(sp.a)) / DAY) + 1 : 0) + ' days'));
  const ed = docEditor(sp, ro);
  const ab = el('button', 'btn primary', '+ Product section'), cb = el('button', 'btn', 'Carry over unfinished'); ab.type = cb.type = 'button'; ab.disabled = cb.disabled = ro;
  ab.addEventListener('click', () => ed.addSection()); cb.addEventListener('click', () => carryOver(sp, ed));
  const bar = el('div', 'row spbar'); bar.append(ab, cb); pg.append(dr, bar, ed);
}

export function renderSprints() {
  const pg = $('pg-sprints'); if (!pg) return; closeMenu(); pg.textContent = '';
  const ro = !canEdit() || !canWrite(), id = routeId(), sp = id ? sprintList().find(s => s.id === id) : null;
  if (id && !sp) { pg.append(crumbs([{ label: 'Sprints', href: '#/sprints' }, { label: 'Not found' }]), pageHead('Sprint not found', 'It may have been deleted, or it is still loading.')); return; }
  if (sp) detailView(pg, sp, ro); else listView(pg, ro);
}
window.addEventListener('hashchange', () => { if (state.page === 'sprints') renderSprints(); });
