/**
 * @module pages/monthly
 * Monthly deliverables: one Notion-style page per month (list of cards, then a white sheet), like Sprints. Editors list what the business expects per product,
 * bring the month's features from the Roadmap with an estimated percentage, edit every percentage, add ad hoc requests, then submit it.
 * Executives (viewers) see submitted months only (RLS on the `reports` table). Doc `reports/mo<yyyymm>`: see features/month-model.js.
 */
import { S } from '../core/state.js';
import { $, LANES, el, iso, items, state } from '../core/model.js';
import { fmtIso, logAct, pageHead, todayIso } from '../core/shared.js';
import { write } from '../core/saving.js';
import { canWrite, isViewer } from '../features/safety.js';
import { isAdmin } from '../features/google-drive.js';
import { allRoadmaps, withRm } from './roadmaps.js';
import { notify } from '../ui/notify.js';
import { openMenu, closeMenu } from '../ui/menu.js';
import { crumbs } from '../ui/crumbs.js';
import { confirmDlg } from '../ui/confirm.js';
import { createUndo } from '../features/undo-stack.js';
import { registerUndo } from '../features/undo-router.js';
import { EXTRA_SECTIONS } from '../features/sprint-doc.js';
import { productsOf } from '../features/report-model.js';
import { carryFromLastMonth, mergeRoad, monthId, monthLabel, monthOf, monthProgress, monthRange, monthText, newLine, nextMonth } from '../features/month-model.js';
import { monthSheet } from '../features/month-view.js';
import { setupBanner } from './reports.js';

const rUI = { last: '' };
const routeMo = () => { const m = /^#\/monthly\/(\d{4}-\d{2})/.exec(location.hash); return m ? m[1] : null; };
const cfg = () => S.ideas.reportcfg || {};
const colOf = p => { const l = LANES.concat(EXTRA_SECTIONS).find(x => (p.squads || []).includes(x.k)); return l ? l.c : 'var(--brand)'; };
const canBuild = () => !isViewer() && canWrite();
export const monthList = () => Object.keys(S.reports).filter(id => S.reports[id] && S.reports[id].mo).map(id => Object.assign({ id: id, lines: [] }, S.reports[id])).filter(d => !isViewer() || d.status === 'submitted').sort((x, y) => (x.mo < y.mo ? 1 : -1));
const cur = () => { const m = routeMo(); return m ? monthList().find(d => d.mo === m) || null : null; };

/* ---- undo: whole-document steps, one history per user and month ---- */
const undoers = {}, baseline = {};
const undoM = id => { const k = ((S.me && S.me.id) || 'me') + ':' + id; return undoers[k] || (undoers[k] = createUndo(60)); };
const noStamp = d => { const c = JSON.parse(JSON.stringify(d)); delete c.by; delete c.ts; return JSON.stringify(c); };
function save(doc, log, label) {
  const id = doc.id, d = Object.assign({}, doc); delete d.id; d.by = (S.me && (S.me.name || S.me.email)) || ''; d.ts = Date.now(); S.reports[id] = d; write('reports/' + id, d);
  const before = baseline[id] ? JSON.parse(baseline[id]) : null, after = JSON.parse(JSON.stringify(d));
  if (before && before.status !== after.status) undoM(id).clear();
  else if (before && noStamp(before) !== noStamp(after)) { const U = undoM(id); U.mark(label || 'Edit'); U.rec(id, before, after); }
  baseline[id] = JSON.stringify(after);
  if (log) logAct('report', log);
}
let unsubM = null;
function monthUndo(dir) {
  const doc = cur(); if (!doc || doc.status === 'submitted' || !canBuild()) return;
  const r = undoM(doc.id).step(dir, id => S.reports[id], (id, d) => { if (!d) return; S.reports[id] = d; write('reports/' + id, d); baseline[id] = JSON.stringify(d); }), word = dir === 'undo' ? 'Undo' : 'Redo';
  if (!r) { notify('Nothing to ' + word.toLowerCase(), 'info'); return; }
  notify(r.done ? word + ': ' + r.label : 'Someone else changed this month after you, so nothing was ' + (dir === 'undo' ? 'undone' : 'redone'), r.done ? 'ok' : 'info'); renderMonthly();
}
registerUndo('monthly', { ready: () => { const d = cur(); return !!d && d.status !== 'submitted' && canBuild(); }, undo: () => monthUndo('undo'), redo: () => monthUndo('redo') });

const productsFor = doc => { const pl = (doc.pl && doc.pl.length) ? doc.pl.slice() : productsOf(cfg()); EXTRA_SECTIONS.forEach(x => { if (doc.lines.some(l => l.k === x.k) && !pl.some(q => q.k === x.k)) pl.push({ k: x.k, n: x.n, squads: [x.k] }); }); return pl; };
const allMonthDocs = () => Object.keys(S.reports).filter(id => S.reports[id] && S.reports[id].mo).map(id => Object.assign({ id: id }, S.reports[id]));
/** Features of the roadmaps that overlap the month, as ISO dates (ids are prefixed with the roadmap so two roadmaps never clash). */
function roadFeatures(m) {
  const r = monthRange(m), out = [];
  allRoadmaps().filter(x => x.a <= r.b && x.b >= r.a).forEach(rm => withRm(rm.id, () => items().forEach(i => { if (i.d0 === undefined) return; out.push({ id: rm.id + ':' + i.id, t: i.t, sq: i.sq, a: iso(i.d0), b: iso(i.d1), st: i.st, ms: !!i.ms }); })));
  return out;
}
function newMonth(m) {
  const id = monthId(m); if (S.reports[id]) { location.hash = '#/monthly/' + m; return; }
  const doc = { id: id, mo: m, status: 'draft', pl: productsOf(cfg()), lines: [] };
  location.hash = '#/monthly/' + m; save(doc, 'created the monthly deliverables for ' + monthLabel(m)); notify(monthLabel(m) + ' created. Use "Sync from Roadmap" to bring this month\'s features.'); renderMonthly();
}
function syncRoad(doc) {
  doc.pl = productsFor(doc); const r = mergeRoad(doc.lines, roadFeatures(doc.mo), doc.pl, doc.mo, todayIso());
  doc.lines = r.lines; doc.syncAt = new Date().toISOString();
  save(doc, 'synced the monthly deliverables for ' + monthLabel(doc.mo) + ' from the roadmap', 'Sync from Roadmap');
  notify(r.added || r.updated ? 'Roadmap sync: ' + r.added + ' added, ' + r.updated + ' estimates refreshed' + (r.skipped ? ', ' + r.skipped + ' not in any product' : '') : r.skipped ? r.skipped + ' roadmap feature' + (r.skipped === 1 ? '' : 's') + ' not in any product (see Report settings)' : 'No roadmap feature falls in ' + monthLabel(doc.mo), r.added || r.updated ? 'ok' : 'info'); renderMonthly();
}
const canDelete = d => canBuild() && (d.status !== 'submitted' || isAdmin());
function deleteMonth(doc) {
  confirmDlg('Delete ' + monthLabel(doc.mo) + '?', 'The monthly deliverables of ' + monthLabel(doc.mo) + ' are deleted for everyone' + (doc.status === 'submitted' ? ', including the executives who can see them' : '') + '.', 'Delete month', () => {
    delete S.reports[doc.id]; delete baseline[doc.id]; undoM(doc.id).clear(); write('reports/' + doc.id, null);
    logAct('report', 'deleted the monthly deliverables for ' + monthLabel(doc.mo)); notify('Month deleted'); location.hash = '#/monthly'; renderMonthly();
  });
}
const copyMonth = doc => { const txt = monthText(doc, productsFor(doc), fmtIso).join('\n'); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => notify('Month text copied to the clipboard'), () => notify('Could not copy. Select the text and copy it manually.', 'err')); };

function listView(pg, viewer, l) {
  const acts = el('div', 'acts');
  if (!viewer) {
    const have = new Set(l.map(d => d.mo)); let m = monthOf(todayIso()); if (have.has(m)) m = nextMonth(m);
    const nb = el('button', 'btn primary', '+ New month (' + monthLabel(m) + ')'); nb.type = 'button'; nb.disabled = !canBuild(); nb.addEventListener('click', () => newMonth(m)); acts.append(nb);
  }
  pg.append(pageHead('Monthly deliverables', viewer ? 'What each product committed to this month and how far it is. Open one to read it.' : 'What the business expects each month, per product, with the percentage complete. Bring the features from the Roadmap, adjust the percentages, then submit it to the executives.', acts.children.length ? acts : null));
  const sb0 = viewer ? null : setupBanner(); if (sb0) pg.append(sb0);
  if (!l.length) { pg.append(el('p', 'empty', viewer ? 'No month has been submitted yet.' : 'No month yet. Click "+ New month", then "Sync from Roadmap".')); return; }
  const wrap = el('div', 'splist');
  l.forEach(d => {
    const prog = monthProgress(d.lines), sub = d.status === 'submitted', card = el('div', 'card spcard rpcard'), info = el('div');
    const a = el('a', 'splink'); a.href = '#/monthly/' + d.mo; a.append(el('h2', '', monthLabel(d.mo)));
    info.append(a, el('div', 'meta', sub ? 'submitted' + (d.subBy ? ' by ' + d.subBy : '') + (d.subAt ? ' on ' + fmtIso(d.subAt.slice(0, 10)) : '') : 'last edit ' + (d.by || 'unknown')));
    const pr = el('div', 'prods'); (d.pl || []).filter(p => d.lines.some(x => x.k === p.k)).forEach(p => { const c = el('span', 'pchip', p.n); c.style.setProperty('--c', colOf(p)); pr.append(c); }); info.append(pr);
    const pg2 = el('div', 'spprog'), top = el('div', 'rpstat'); top.append(el('span', 'chip rpst ' + (sub ? 'sub' : 'draft'), sub ? 'Submitted' : 'Draft'));
    pg2.append(top, el('div', 'meta', prog.pct === null ? 'No deliverables yet' : prog.pct + '% complete · ' + prog.done + ' of ' + prog.n + ' done'));
    const b0 = el('div', 'bar0'), i0 = el('i'); i0.style.width = (prog.pct || 0) + '%'; b0.append(i0); pg2.append(b0);
    const more = el('button', 'btn sm spmore', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'More actions for ' + monthLabel(d.mo)); more.setAttribute('aria-haspopup', 'menu');
    more.addEventListener('click', () => openMenu(more, [{ label: 'Open in new tab', value: 'tab' }, { label: 'Copy text', value: 'copy' }].concat(canDelete(d) ? [{ label: 'Delete month', value: 'del' }] : []), {
      search: false, label: 'Month actions', onPick: it => { if (it.value === 'tab') window.open(location.pathname + location.search + '#/monthly/' + d.mo, '_blank', 'noopener'); else if (it.value === 'del') deleteMonth(d); else copyMonth(d); }, onClose: () => more.focus()
    }));
    card.append(info, pg2, more); wrap.append(card);
  });
  pg.append(wrap);
}
function detailView(pg, viewer, doc) {
  if (S.reports[doc.id]) baseline[doc.id] = JSON.stringify(S.reports[doc.id]);
  const sub = doc.status === 'submitted', ro = viewer || sub || !canBuild();
  pg.append(crumbs([{ label: 'Monthly', href: '#/monthly' }, { label: monthLabel(doc.mo) }]));
  pg.append(pageHead('Monthly deliverables', monthLabel(doc.mo) + (viewer ? '' : ro ? '. Submitted months are read-only.' : '. Edit anything, then submit it to the executives.')));
  const sb0 = viewer ? null : setupBanner(); if (sb0) pg.append(sb0);
  pg.append(el('p', 'sub rmeta', sub ? 'Submitted' + (doc.subBy ? ' by ' + doc.subBy : '') + (doc.subAt ? ' on ' + fmtIso(doc.subAt.slice(0, 10)) : '') : 'Draft · last edit ' + (doc.by || '') + (doc.syncAt ? ' · roadmap synced ' + fmtIso(doc.syncAt.slice(0, 10)) : '')));
  const tools = el('div', 'row spbar rtools');
  const btn = (t, cls, fn, dis) => { const b = el('button', 'btn ' + (cls || ''), t); b.type = 'button'; b.disabled = !!dis; b.addEventListener('click', fn); tools.append(b); return b; };
  if (!ro) {
    btn('Sync from Roadmap', 'primary', () => syncRoad(doc), !canBuild()).title = 'Brings this month\'s roadmap features into their product with an estimated percentage. Percentages you set are never overwritten.';
    const U = undoM(doc.id), ub = btn('↶ Undo', '', () => monthUndo('undo'), true), rb = btn('↷ Redo', '', () => monthUndo('redo'), true);
    const upd = () => { ub.disabled = !U.canUndo(); rb.disabled = !U.canRedo(); ub.title = ub.ariaLabel = U.canUndo() ? 'Undo: ' + U.nextUndo() + ' (Ctrl/Cmd+Z)' : 'Nothing to undo'; rb.title = rb.ariaLabel = U.canRedo() ? 'Redo: ' + U.nextRedo() + ' (Ctrl/Cmd+Shift+Z)' : 'Nothing to redo'; };
    if (unsubM) unsubM(); unsubM = U.subscribe(upd); upd();
    if (!doc.lines.length) { const cf = carryFromLastMonth(doc, allMonthDocs()); if (cf) btn('Copy ' + cf.lines.length + ' unfinished from ' + monthLabel(cf.from), '', () => { doc.lines = doc.lines.concat(cf.lines); save(doc, 'copied ' + cf.lines.length + ' unfinished deliverables from ' + monthLabel(cf.from), 'Copy from last month'); renderMonthly(); }); }
  }
  btn('Copy text', '', () => copyMonth(doc));
  btn('Print / PDF', '', () => { document.body.classList.add('print-report'); const off = () => { document.body.classList.remove('print-report'); window.removeEventListener('afterprint', off); }; window.addEventListener('afterprint', off); window.print(); });
  if (!viewer && !sub) btn('Submit to executives', 'primary', () => { doc.status = 'submitted'; doc.subAt = new Date().toISOString(); doc.subBy = S.me.name || S.me.email; save(doc, 'submitted the monthly deliverables for ' + monthLabel(doc.mo)); notify('Month submitted. Executives can now see it.'); renderMonthly(); }, !canBuild());
  if (!viewer && sub) btn('Reopen as draft', '', () => { doc.status = 'draft'; delete doc.subAt; delete doc.subBy; save(doc, 'reopened the monthly deliverables for ' + monthLabel(doc.mo)); notify('Month reopened as a draft. Executives no longer see it.', 'info'); renderMonthly(); }, !canBuild());
  if (canDelete(doc)) btn('Delete month', 'danger rdel', () => deleteMonth(doc));
  const ctx = {
    ro: ro, colOf: colOf,
    put: (l, patch, label) => { Object.assign(l, patch); save(doc, '', label); renderMonthly(); },
    remove: l => { doc.lines = doc.lines.filter(z => z.id !== l.id); save(doc, 'removed "' + l.t + '" from the monthly deliverables', 'Remove deliverable'); renderMonthly(); },
    add: (k, t, o) => { doc.lines.push(newLine(k, t, o)); save(doc, 'added ' + (o.adhoc ? 'an ad hoc request' : 'a deliverable') + ' to the monthly deliverables', o.adhoc ? 'Add ad hoc request' : 'Add deliverable'); renderMonthly(); }
  };
  pg.append(tools, monthSheet(doc, productsFor(doc), ctx));
}
export function renderMonthly() {
  const pg = $('pg-monthly'); if (!pg) return; closeMenu();
  const m = routeMo(), keepY = m && rUI.last === m ? window.scrollY : 0; rUI.last = m || '';
  pg.textContent = '';
  const viewer = isViewer(), l = monthList(), doc = cur();
  pg.classList.toggle('sheet', !!doc);
  if (m && !doc) { pg.append(crumbs([{ label: 'Monthly', href: '#/monthly' }, { label: 'Not found' }]), pageHead('Month not found', viewer ? 'It may not be submitted yet, or it is still loading.' : 'It may have been removed, or it is still loading.')); return; }
  if (doc) detailView(pg, viewer, doc); else listView(pg, viewer, l);
  if (keepY && Math.abs(window.scrollY - keepY) > 1) window.scrollTo(0, keepY);
}
window.addEventListener('hashchange', () => { if (state.page === 'monthly') renderMonthly(); });
