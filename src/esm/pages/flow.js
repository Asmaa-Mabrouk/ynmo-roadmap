/**
 * @module pages/flow
 * Ynmo Flow (tickets): the Jira-style shell (sidebar, routes #/flow/<view>), issue list with filters, saved filters, sorting and bulk edit, My work,
 * the create and ticket windows (fields, sub-tickets, history, link, delete), keyboard shortcuts, key-clash repair and the workflow rules.
 * Data: `flow_issues/<id>` and `flow_cfg/<id>` documents in the same generic tables as the rest of the app (S.fissues, S.fcfg). Rules live in features/flow-model.js.
 * Backlog and sprints, comments, notifications and the AI assistant come in later phases (docs/FLOW_PLAN.md).
 */
import { $, canDelete, canEdit, directory, el } from '../core/model.js';
import { fld, pageHead, selOf, ago } from '../core/shared.js';
import { notify } from '../ui/notify.js';
import { S } from '../core/state.js';
import { write } from '../core/saving.js';
import { openDlg, closeDlg } from '../features/safety.js';
import { confirmDlg } from '../ui/confirm.js';
import { boardView, epicsView, settingsView, soonView, summaryView, SOON } from '../features/flow-views.js';
import { perfView } from '../features/flow-perf-view.js';
import { inboxView, inboxCount } from '../features/flow-inbox-view.js';
import { sb } from '../core/supabase.js';
import { backlogView, sprintsView } from '../features/flow-backlog.js';
import { rankPatch, sprintList, activeSprint, sprintById, ticketsIn } from '../features/flow-sprints.js';
import { workflowView } from '../features/flow-workflow.js';
import { monthCards } from '../features/sprint-review.js';
import { TAGS, cardId } from '../features/month-model.js';
import {
  ENVS, PRIORITIES, isClosed as isClosedT, SEVERITIES, STATUSES, TYPES, applyChange, canMove, childrenOf, countByStatus, deletePlan, filterIssues, fixDuplicateKeys, isOverdue, isReport, list, makeIssue, myWork, needsReason,
  newId, parseLabels, setSprintNamer, setWorkflow, sortIssues, startStatus, statusOf, targets, today, typeOf
} from '../features/flow-model.js';

export const FLOW_NAME = 'Ynmo Flow';
const ui = { view: 'summary', f: { q: '', st: '', type: '', as: '', ep: '', prod: '', rp: '', sp: '', od: false, open: true }, sort: { k: 'key', dir: -1 }, sel: new Set(), opened: '' };
const toast = (m, kind) => notify(m, kind || 'info');
const who = () => (S.me && (S.me.name || S.me.email)) || '';
const rows = () => list(S.fissues);
const names = () => [...new Set([...directory().keys(), who()].filter(Boolean))].sort((a, b) => a.localeCompare(b));
const dot = (c, t) => { const s = el('span', 'ftype', t); s.style.setProperty('--c', c); return s; };
const typeTag = id => dot(typeOf(id).c, typeOf(id).n);
const stTag = id => dot(statusOf(id).c, statusOf(id).n);
const prodOf = k => TAGS.find(t => t.k === k);
const prodTag = k => { const p = prodOf(k); return p ? dot(p.c, p.n) : null; };
const PRODS = () => [['', 'No product'], ...TAGS.map(t => [t.k, t.n])];
const cardOpts = () => [['', 'No card'], ...monthCards().filter(x => cardId(x.l)).map(x => [cardId(x.l), cardId(x.l) + ' ' + String(x.l.t).slice(0, 70)])];
const cardTag = code => { const x = monthCards().find(m => cardId(m.l) === code); return x ? x.l : null; };

/** Save a ticket (whole document). */
function put(i) { const d = Object.assign({}, i); delete d.id; S.fissues[i.id] = d; write('flow_issues/' + i.id, d); }
function drop(id) { delete S.fissues[id]; write('flow_issues/' + id, null); }
function putCfg(id, data) { if (data) { S.fcfg[id] = data; write('flow_cfg/' + id, data); } else { delete S.fcfg[id]; write('flow_cfg/' + id, null); } }
const redraw = () => { if ($('pg-flow') && !$('pg-flow').hidden) renderFlow({ keep: true }); };
/** Load the saved workflow (also when a snapshot brings a new one). */
export function syncFlowCfg() { setWorkflow(S.fcfg && S.fcfg.main); setSprintNamer(id => { const x = sprintById(sprints(), id); return x ? x.n : id; }); }
/** Ask the Edge Function flow-ai (reply drafts, digest). The key lives only in Supabase secrets. */
async function askFlowAi(body) {
  const r = await sb.functions.invoke('flow-ai', { body: body });
  if (r.error || !r.data) throw r.error || new Error('no answer');
  if (r.data.error) throw new Error(r.data.error);
  return r.data;
}
/** A plain sentence for why the assistant did not answer. */
function aiWhy(e) {
  const st = e && e.context && e.context.status;
  if (st === 404 || (e && (e.name === 'FunctionsFetchError' || /Failed to send a request/i.test(e.message || '')))) return 'The assistant is not deployed yet. Deploy the Supabase function flow-ai (see docs/DEPLOYMENT.md), then try again.';
  if (st === 401 || st === 403) return 'Not allowed: only signed-in editors and admins can use the assistant.';
  if (st === 500 || /GEMINI_API_KEY/i.test((e && e.message) || '')) return 'The assistant is not set up: add GEMINI_API_KEY in Supabase secrets.';
  return 'The assistant could not answer (' + ((e && e.message) || 'unknown error') + '). Try again in a minute.';
}
const sprints = () => sprintList(S.fcfg && S.fcfg.sprints);
/** Save the sprint list (one document). */
function saveSprints(l, msg) { putCfg('sprints', { sp: l }); toast(msg || 'Saved'); redraw(); }
/** Put tickets in a sprint ('' = backlog); each move is written to the ticket history. */
function assignSprint(ids, spId, quiet) {
  let n = 0; ids.forEach(id => { const cur = S.fissues[id]; if (!cur) return; const nx = applyChange(Object.assign({ id: id }, cur), { sp: spId || '' }, who()); if (nx !== cur && (nx.sp || '') !== (cur.sp || '')) { put(Object.assign({ id: id }, nx)); n++; } });
  if (!quiet) { toast(n ? n + ' ticket' + (n === 1 ? '' : 's') + ' moved to ' + (spId ? (sprintById(sprints(), spId) || {}).n : 'the backlog') : 'Nothing to move'); redraw(); }
}
/** Drop a ticket into a sprint list before `beforeId` ('' = at the end): changes sprint if needed, then its rank. */
function rankTicket(id, beforeId, spId) {
  const cur = S.fissues[id]; if (!cur) return;
  if ((cur.sp || '') !== (spId || '')) assignSprint([id], spId, true);
  const order = ticketsIn(rows(), spId || '').filter(i => i.id !== id).concat([Object.assign({ id: id }, S.fissues[id])]);
  rankPatch(order, id, beforeId).forEach(x => { const t = S.fissues[x.id]; if (t) put(Object.assign({ id: x.id }, t, { rk: x.rk })); });
  redraw();
}

function setupBanner() {
  if (!S.setup.flow_issues) return null;
  const b = el('div', 'rerr'); b.setAttribute('role', 'alert');
  b.append(el('b', '', 'Database setup needed. '), document.createTextNode('Run supabase/sql/09-flow.sql in the Supabase SQL Editor. Until then tickets are NOT saved and nobody else can see them.'));
  return b;
}

/** Reason dialog for a move into a status that asks for one; then `done(reason)`. */
function askReason(i, to, done) {
  openDlg('Why ' + statusOf(to).n + '?', box => {
    box.append(el('p', 'sub', i.key + ' ' + i.t));
    const ta = el('textarea'); ta.id = 'why-text'; ta.rows = 3; ta.placeholder = 'For example: waiting for the payment API'; const err = el('p', 'rerr'); err.hidden = true;
    const ok = el('button', 'btn primary', 'Move to ' + statusOf(to).n), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button'; ok.id = 'why-ok'; no.addEventListener('click', closeDlg);
    ok.addEventListener('click', () => { const w = ta.value.trim(); if (!w) { err.textContent = 'Write a short reason.'; err.hidden = false; ta.focus(); return; } closeDlg(); done(w); });
    const row = el('div', 'row fbtns'); row.append(no, ok); box.append(ta, err, row); setTimeout(() => ta.focus(), 0);
  });
}
/** Move one ticket to a status, honouring the workflow (allowed move, reason). `after` runs when the move happened. */
function moveTo(id, st, after) {
  const cur = S.fissues[id]; if (!cur || cur.st === st) return;
  if (!canMove(cur.st, st)) { toast('Not allowed: ' + statusOf(cur.st).n + ' to ' + statusOf(st).n + ' (see Settings > Workflow)', 'err'); redraw(); return; }
  const go = why => { const n = applyChange(Object.assign({ id: id }, cur), { st: st }, who(), null, why); if (n.up !== cur.up) put(n); if (after) after(); redraw(); };
  if (needsReason(st)) askReason(Object.assign({ id: id }, cur), st, go); else go();
}

/* ---------- list ---------- */
const COLS = [['key', 'Key', 'k-key'], ['type', 'Type', 'k-type'], ['t', 'Title', 'k-title'], ['st', 'Status', 'k-st'], ['as', 'Assignee', 'k-as'], ['pr', 'Priority', 'k-pr']];
/** Table of tickets; click a row to open it; click a heading to sort; `o.select` adds a checkbox column for bulk edit. */
function table(rs, empty, o) {
  o = o || {};
  if (!rs.length) return el('p', 'sub flowempty', empty);
  rs = sortIssues(rs, ui.sort.k, ui.sort.dir);
  const wrap = el('div', 'ftblwrap'), t = el('table', 'tbl flowtbl'), h = el('tr');
  t.insertAdjacentHTML('afterbegin', '<colgroup>' + (o.select ? '<col class="c-sel">' : '') + '<col class="c-key"><col class="c-type"><col><col class="c-st"><col class="c-as"><col class="c-pr"></colgroup>');
  if (o.select) { const th = el('th', 'k-sel'), cb = el('input'); cb.type = 'checkbox'; cb.id = 'flowselall'; cb.setAttribute('aria-label', 'Select all shown'); cb.checked = rs.every(i => ui.sel.has(i.id)); cb.addEventListener('change', () => { rs.forEach(i => (cb.checked ? ui.sel.add(i.id) : ui.sel.delete(i.id))); renderFlow({ keep: true }); }); th.append(cb); h.append(th); }
  COLS.forEach(([k, n, cl]) => {
    const th = el('th', cl + ' fsort'), on = ui.sort.k === k; th.dataset.sort = k; th.tabIndex = 0; th.setAttribute('aria-sort', on ? (ui.sort.dir === 1 ? 'ascending' : 'descending') : 'none');
    th.append(document.createTextNode(n), el('span', 'fsortg', on ? (ui.sort.dir === 1 ? ' ▲' : ' ▼') : ''));
    const go = () => { ui.sort = { k: k, dir: on ? -ui.sort.dir : (k === 'key' || k === 'up' ? -1 : 1) }; renderFlow({ keep: true }); };
    th.addEventListener('click', go); th.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); h.append(th);
  });
  { const th = el('thead'); th.append(h); t.append(th); }
  const tb = el('tbody');
  rs.forEach(i => {
    const tr = el('tr', 'flowrow'); tr.dataset.id = i.id; tr.tabIndex = 0;
    if (o.select) { const td = el('td', 'k-sel'), cb = el('input'); cb.type = 'checkbox'; cb.className = 'flowsel'; cb.checked = ui.sel.has(i.id); cb.setAttribute('aria-label', 'Select ' + i.key); cb.addEventListener('click', e => e.stopPropagation()); cb.addEventListener('change', () => { if (cb.checked) ui.sel.add(i.id); else ui.sel.delete(i.id); renderFlow({ keep: true }); }); td.append(cb); tr.append(td); }
    const ty = el('td', 'k-type'), ti = el('td', 'ftitle k-title'), st = el('td', 'k-st');
    ty.append(typeTag(i.type)); st.append(stTag(i.st));
    ti.append(document.createTextNode(i.t));
    const meta = el('span', 'fchips'); const pt = prodTag(i.prod); if (pt) meta.append(pt);
    (i.lb || []).forEach(l => meta.append(el('span', 'flabel', l)));
    if (i.due) meta.append(el('span', 'fdue' + (isOverdue(i) ? ' late' : ''), 'Due ' + i.due));
    if (meta.childNodes.length) ti.append(meta);
    tr.append(el('td', 'fkey k-key', i.key), ty, ti, st, el('td', 'k-as', i.as || 'Unassigned'), el('td', 'k-pr', (PRIORITIES.find(p => p.id === i.pr) || { n: '' }).n));
    const open = () => openIssue(i.id); tr.addEventListener('click', open); tr.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === tr) open(); });
    tb.append(tr);
  });
  t.append(tb); wrap.append(t); return wrap;
}

const myFilters = () => { const d = S.fcfg && S.me && S.fcfg['f_' + S.me.id]; return (d && d.fl) || []; };
function saveFilter() {
  openDlg('Save this filter', box => {
    const nm = el('input'); nm.type = 'text'; nm.id = 'sf-name'; nm.placeholder = 'For example: Tifli bugs this week';
    const ok = el('button', 'btn primary', 'Save'), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button'; ok.id = 'sf-ok'; no.addEventListener('click', closeDlg);
    ok.addEventListener('click', () => { const n = nm.value.trim(); if (!n) { nm.focus(); return; } const f = Object.assign({}, ui.f); const fl = myFilters().filter(x => x.n !== n).concat([{ id: 'f' + Date.now().toString(36), n: n, f: f }]); putCfg('f_' + S.me.id, { fl: fl }); closeDlg(); redraw(); });
    const row = el('div', 'row fbtns'); row.append(no, ok); box.append(fld('Name', nm), row); setTimeout(() => nm.focus(), 0);
  });
}

function bulkBar(host, all) {
  const ids = [...ui.sel].filter(id => S.fissues[id]); if (!ids.length) return;
  const b = el('div', 'fbulk card'); b.id = 'flowbulk';
  b.append(el('b', '', ids.length + ' selected'));
  const st = selOf([['', 'Change status...'], ...STATUSES.map(s => [s.id, s.n])], ''); st.id = 'bulk-st'; st.setAttribute('aria-label', 'Change status of selected');
  const as = selOf([['', 'Change assignee...'], ['@none', 'Unassigned'], ...names()], ''); as.id = 'bulk-as'; as.setAttribute('aria-label', 'Change assignee of selected');
  const pr = selOf([['', 'Change priority...'], ...PRIORITIES.map(p => [p.id, p.n])], ''); pr.id = 'bulk-pr'; pr.setAttribute('aria-label', 'Change priority of selected');
  const ok = el('button', 'btn primary', 'Apply'), cl = el('button', 'btn', 'Clear'); ok.type = cl.type = 'button'; ok.id = 'bulk-ok'; cl.id = 'bulk-clear';
  cl.addEventListener('click', () => { ui.sel.clear(); renderFlow({ keep: true }); });
  ok.addEventListener('click', () => {
    if (!st.value && !as.value && !pr.value) { toast('Choose what to change first'); return; }
    const apply = why => {
      let skipped = 0, n = 0;
      ids.forEach(id => {
        const cur = S.fissues[id], ch = {}; if (!cur) return;
        if (st.value && st.value !== cur.st) { if (canMove(cur.st, st.value)) ch.st = st.value; else skipped++; }
        if (as.value) ch.as = as.value === '@none' ? '' : as.value; if (pr.value) ch.pr = pr.value;
        const nw = applyChange(Object.assign({ id: id }, cur), ch, who(), null, why); if (nw !== cur && nw.up !== cur.up) { put(nw); n++; }
      });
      toast(n + ' updated' + (skipped ? ', ' + skipped + ' not allowed by the workflow' : '')); ui.sel.clear(); redraw();
    };
    if (st.value && needsReason(st.value)) askReason({ key: ids.length + ' tickets', t: '' }, st.value, apply); else apply();
  });
  b.append(st, as, pr, ok, cl); host.append(b);
}

function issuesTab(host) {
  const all = rows(), f = ui.f, epics = all.filter(i => i.type === 'epic'), edit = canEdit();
  // quick filters + saved filters
  const quick = el('div', 'flowquick'), me = who();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const base = { q: '', st: '', type: '', as: '', ep: '', prod: '', rp: '', od: false, open: true };
  [['All open', {}], ['Assigned to me', { as: me }], ['Reported by me', { rp: me }], ['Unassigned', { as: '@none' }], ['Overdue', { od: true }]].forEach(([n, p]) => {
    const b = el('button', 'chip fq', n); b.type = 'button'; b.dataset.q = n; b.style.setProperty('--c', '#3b6fd4'); const want = Object.assign({}, base, p);
    b.setAttribute('aria-pressed', same(want, f) ? 'true' : 'false'); b.addEventListener('click', () => { ui.f = Object.assign({}, want); renderFlow({ keep: true }); }); quick.append(b);
  });
  myFilters().forEach(sf => {
    const b = el('button', 'chip fq saved', sf.n); b.type = 'button'; b.dataset.saved = sf.id; b.style.setProperty('--c', '#8a5cc7'); b.setAttribute('aria-pressed', same(Object.assign({}, base, sf.f), f) ? 'true' : 'false');
    b.addEventListener('click', () => { ui.f = Object.assign({}, base, sf.f); renderFlow({ keep: true }); });
    quick.append(b);
    if (edit) { const x = el('button', 'iconbtn fqx', '×'); x.type = 'button'; x.title = 'Delete saved filter ' + sf.n; x.setAttribute('aria-label', 'Delete saved filter ' + sf.n); x.addEventListener('click', () => { putCfg('f_' + S.me.id, { fl: myFilters().filter(y => y.id !== sf.id) }); redraw(); }); quick.append(x); }
  });
  if (edit) { const sv = el('button', 'btn', 'Save filter'); sv.type = 'button'; sv.id = 'flowsavef'; sv.addEventListener('click', saveFilter); quick.append(sv); }
  host.append(quick);
  const bar = el('div', 'flowbar');
  const q = el('input'); q.type = 'search'; q.id = 'flowq'; q.placeholder = 'Search key, title, description, label'; q.value = f.q; q.setAttribute('aria-label', 'Search tickets');
  q.addEventListener('input', () => { f.q = q.value; paint(); });
  const sel = (id, label, opts, key) => { const s = selOf(opts, f[key]); s.id = id; s.setAttribute('aria-label', label); s.addEventListener('change', () => { f[key] = s.value; renderFlow({ keep: true }); }); return s; };
  const ck = el('label', 'flowopen'); const cb = el('input'); cb.type = 'checkbox'; cb.id = 'flowopen'; cb.checked = f.open; cb.addEventListener('change', () => { f.open = cb.checked; renderFlow({ keep: true }); }); ck.append(cb, document.createTextNode(' Hide finished tickets'));
  bar.append(q,
    sel('flowst', 'Status', [['', 'All statuses'], ...STATUSES.map(s => [s.id, s.n])], 'st'),
    sel('flowtype', 'Type', [['', 'All types'], ...TYPES.map(t => [t.id, t.n])], 'type'),
    sel('flowas', 'Assignee', [['', 'Everyone'], ['@none', 'Unassigned'], ...names()], 'as'),
    sel('flowprod', 'Product', [['', 'Any product'], ...TAGS.map(t => [t.k, t.n])], 'prod'),
    sel('flowsp', 'Sprint', [['', 'Any sprint'], ['@none', 'Backlog'], ...sprints().map(x => [x.id, x.n])], 'sp'),
    sel('flowep', 'Epic', [['', 'Any epic'], ...epics.map(e => [e.id, e.key + ' ' + e.t])], 'ep'), ck);
  const chips = el('div', 'flowchips'), res = el('div', 'flowres');
  host.append(bar, chips); bulkBar(host, all); host.append(res);
  function paint() {
    const rs = filterIssues(all, Object.assign({ today: today() }, f)); chips.textContent = ''; res.textContent = '';
    countByStatus(filterIssues(all, Object.assign({ today: today() }, f, { st: '' }))).forEach(c => { const b = el('button', 'chip', c.n + ' ' + c.count); b.type = 'button'; b.dataset.st = c.id; b.style.setProperty('--c', statusOf(c.id).c); b.setAttribute('aria-pressed', f.st === c.id ? 'true' : 'false'); b.addEventListener('click', () => { f.st = f.st === c.id ? '' : c.id; renderFlow({ keep: true }); }); chips.append(b); });
    res.append(table(rs, all.length ? 'No ticket matches these filters.' : 'No tickets yet. Create the first one.', { select: edit }));
  }
  paint();
}

function mineTab(host) {
  const w = myWork(rows(), who(), ui.all), sec = (title, rs, id) => { const s = el('section', 'flowsec'); s.id = id; s.append(el('h3', '', title + ' (' + rs.length + ')'), table(rs, 'Nothing here.')); host.append(s); };
  const lab = el('label', 'flowopen'); const cb = el('input'); cb.type = 'checkbox'; cb.id = 'flowall'; cb.checked = !!ui.all; cb.addEventListener('change', () => { ui.all = cb.checked; renderFlow({ keep: true }); }); lab.append(cb, document.createTextNode(' Include finished tickets'));
  host.append(lab);
  sec('Assigned to me', w.tickets, 'mine-tickets'); sec('My sub-tasks and sub-bugs', w.subtasks, 'mine-subs'); sec('Bugs assigned to me', w.bugs, 'mine-bugs');
  if (w.epics.length) sec('My epics', w.epics, 'mine-epics');
  sec('Reported by me, assigned to someone else', w.reported, 'mine-reported');
}

/* ---------- Jira-style shell: sidebar with views, settings, and the routing #/flow/<view> ---------- */
const IC = {
  summary: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z', board: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z', backlog: 'M4 6h16M4 12h16M4 18h10', sprints: 'M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M6 21v-4h4',
  sprintboard: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z',
  inbox: 'M4 13l2-8h12l2 8v6H4zM4 13h5l1 2h4l1-2h5',
  perf: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  epics: 'M13 2 4 14h7l-1 8 9-12h-7z', issues: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2', mine: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  'set-details': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01', 'set-types': 'M4 4h8l8 8-8 8-8-8z', 'set-workflow': 'M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 7v4a4 4 0 0 0 4 4h6a4 4 0 0 1 4 4'
};
const ico = k => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${IC[k] || IC.board}"/></svg>`;
/** The sidebar: [group title, [[view id, label, soon?]]]. */
export const FLOW_MENU = [
  ['', [['inbox', 'For you'], ['mine', 'My work']]],
  ['Planning', [['summary', 'Summary'], ['perf', 'Performance'], ['epics', 'Epics'], ['backlog', 'Backlog'], ['sprints', 'Sprints']]],
  ['Boards', [['sprintboard', 'Active sprint'], ['board', 'All products'], ['board-tifli', 'Tifli'], ['board-ai', 'AI'], ['board-daycare', 'Daycare'], ['board-plan', 'Plan'], ['board-schs', 'SCHS'], ['board-warif', 'Warif']]],
  ['Work', [['issues', 'All issues']]],
  ['Project settings', [['set-details', 'Details'], ['set-types', 'Issue types'], ['set-workflow', 'Workflow']]]
];
const VIEWS = FLOW_MENU.flatMap(g => g[1].map(x => x[0]));
const issueKeyInHash = () => { const m = /^#\/flow\/issue\/([\w-]+)/.exec(location.hash); return m ? m[1] : ''; };
const viewNow = () => { const m = /^#\/flow\/([\w-]+)/.exec(location.hash); return m && VIEWS.includes(m[1]) ? m[1] : (issueKeyInHash() && ui.view) || 'summary'; };
export function goFlow(v) { window.history.pushState(null, '', '#/flow/' + v); renderFlow(); }
const flowShown = () => $('pg-flow') && !$('pg-flow').hidden;
window.addEventListener('popstate', () => { if (location.hash.startsWith('#/flow') && flowShown()) renderFlow(); });
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#/flow') && flowShown()) renderFlow(); });
/** Shortcuts: c = create, / = search (only when you are not typing and no window is open). */
document.addEventListener('keydown', e => {
  if (!flowShown() || e.ctrlKey || e.metaKey || e.altKey || $('xdlg')) return;
  const t = e.target, typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); if (typing) return;
  if (e.key === 'c' && canEdit()) { e.preventDefault(); openCreate({ prod: boardProd(ui.view) }); }
  else if (e.key === '/') { const q = $('flowq') || $('boardq'); if (q) { e.preventDefault(); q.focus(); } }
});
const TITLES = Object.fromEntries(FLOW_MENU.flatMap(g => g[1].map(x => [x[0], x[0].startsWith('board-') ? x[1] + ' board' : x[0] === 'board' ? 'Board' : x[1]])));
/** The product a board shows ('' = all products). */
const boardProd = v => (v.startsWith('board-') ? v.slice(6) : '');

/** Repair key clashes made by two people creating at the same moment: only the tickets I reported are renumbered. */
function repairKeys() {
  if (!canEdit() || !S.me) return;
  fixDuplicateKeys(rows(), who()).forEach(x => { const cur = S.fissues[x.id]; if (!cur) return; const hist = (cur.hist || []).concat([{ at: new Date().toISOString(), by: who(), f: 'key', a: cur.key, b: x.key }]); put(Object.assign({ id: x.id }, cur, { key: x.key, n: x.n, hist: hist })); });
}

export function renderFlow(o) {
  const pg = $('pg-flow'); const sc = pg.scrollTop; pg.textContent = ''; const view = viewNow(); ui.view = view;
  syncFlowCfg(); repairKeys(); const openCount = rows().filter(i => !isClosedT(i) && i.type !== 'epic');
  const app = el('div', 'flowapp'), side = el('nav', 'flowside'); side.setAttribute('aria-label', 'Ynmo Flow');
  const ph = el('div', 'flowproj'); const lg = el('span', 'flowlogo', 'YN'); const pt = el('div'); pt.append(el('b', '', FLOW_NAME), el('span', '', 'Team project · YNMO')); ph.append(lg, pt); side.append(ph);
  FLOW_MENU.forEach(([gt, items]) => {
    const g = el('div', 'flowgrp'); if (gt) g.append(el('div', 'flowgt', gt));
    items.forEach(([id, n, soon]) => { const b = el('button', 'flowitem'); b.type = 'button'; b.dataset.view = id; { const pc = prodOf(boardProd(id)); if (pc) b.style.setProperty('--ic', pc.c); } b.insertAdjacentHTML('beforeend', ico(id)); b.append(el('span', '', n)); if (soon) b.append(el('em', 'flowsoon', 'Soon')); else if (id === 'inbox') { const nn = inboxCount(rows(), who(), today()); if (nn) { const ct = el('em', 'flowcount', String(nn)); ct.title = nn + ' waiting for your answer'; b.append(ct); } } else if (id.startsWith('board')) { const k = boardProd(id), nn = openCount.filter(i => !k || i.prod === k).length; const ct = el('em', 'flowcount', String(nn)); ct.title = nn + ' open tickets'; b.append(ct); } if (id === view) b.setAttribute('aria-current', 'page'); b.addEventListener('click', () => goFlow(id)); g.append(b); });
    side.append(g);
  });
  const main = el('div', 'flowmain'), top = el('div', 'flowtop');
  const crumb = el('div', 'flowcrumb'); crumb.append(document.createTextNode('Projects / ' + FLOW_NAME + ' / '), el('b', '', TITLES[view]));
  const mk = el('button', 'btn primary', 'Create'); mk.type = 'button'; mk.id = 'flowcreate'; mk.title = 'Create a ticket (c)'; mk.disabled = !canEdit(); mk.addEventListener('click', () => openCreate({ prod: boardProd(view) }));
  top.append(crumb, mk); main.append(top, el('h1', 'flowh1', TITLES[view]));
  const b = setupBanner(); if (b) main.append(b);
  const host = el('div', 'flowbody'); host.id = 'flowbody'; main.append(host); app.append(side, main); pg.append(app);
  const c = { rows: rows(), open: openIssue, who: who(), move: moveTo, go: goFlow, canEdit: canEdit(), quick: quickCreate, prods: TAGS, today: today(), prod: boardProd(view), sprints: sprints(), sp: view === 'sprintboard' ? ((activeSprint(sprints()) || {}).id || '@none') : '', assignSprint: assignSprint, rank: rankTicket, saveSprints: saveSprints, create: openCreate, say: m => toast(m, 'err'), names: names(), ai: askFlowAi, aiWhy: aiWhy };
  if (view === 'issues') issuesTab(host); else if (view === 'mine') mineTab(host);
  else if (view === 'summary') summaryView(host, c); else if (view.startsWith('board') || view === 'sprintboard') boardView(host, c, ui); else if (view === 'inbox') inboxView(host, c, ui); else if (view === 'perf') perfView(host, c, ui); else if (view === 'backlog') backlogView(host, c, ui); else if (view === 'sprints') sprintsView(host, c); else if (view === 'epics') epicsView(host, c);
  else if (view === 'set-workflow') workflowView(host, { rows: c.rows, canEdit: canDelete('flow') && !S.readonly, save: saveWorkflow }, needsReason);
  else if (SOON[view]) soonView(host, view); else settingsView(host, view);
  if (o && o.keep) pg.scrollTop = sc;
  // a link to a ticket (#/flow/issue/YNMO-12) opens it once
  const k = issueKeyInHash();
  if (!k) ui.opened = ''; else if (ui.opened !== k) { const hit = rows().find(i => i.key.toLowerCase() === k.toLowerCase()); if (hit) { ui.opened = k; openIssue(hit.id); } else if (Object.keys(S.fissues).length) { ui.opened = k; toast('Ticket ' + k + ' not found'); } }
}

function saveWorkflow(cfg) {
  if (cfg) putCfg('main', cfg); else putCfg('main', null);
  syncFlowCfg(); toast(cfg ? 'Workflow saved' : 'Workflow set back to the default'); redraw();
}

/** Quick create from a board column: a Task with a title, starting in that column's status. */
function quickCreate(title, st, prod, sp) {
  try { const i = makeIssue({ type: 'task', t: title, st: st, prod: prod || '', sp: sp && sp !== '@none' ? sp : '' }, S.fissues, who()); put(Object.assign({ id: newId() }, i)); redraw(); return ''; } catch (e) { return e.message; }
}

/** The extra fields of a ticket by type: bug details, report details; and the shared ones (product, card, labels, due date). */
function extraFields(type, v, edit) {
  const out = { els: {}, nodes: [] };
  const add = (k, label, node) => { node.id = (edit ? 'fi-' : 'fc-') + k; out.els[k] = node; const f = fld(label, node); f.dataset.k = k; out.nodes.push(f); return f; };
  const prod = selOf(PRODS(), v.prod || ''); add('prod', 'Product', prod);
  const card = selOf(cardOpts().concat(v.card && !cardOpts().some(o => o[0] === v.card) ? [[v.card, v.card]] : []), v.card || ''); add('card', 'Monthly card', card);
  card.addEventListener('change', () => { const l = cardTag(card.value); if (l && !prod.value && prodOf(l.k)) prod.value = l.k; });
  const lb = el('input'); lb.type = 'text'; lb.placeholder = 'comma separated, for example ui, needs-review'; lb.value = (v.lb || []).join(', '); add('lb', 'Labels', lb);
  const due = el('input'); due.type = 'date'; due.value = v.due || ''; add('due', 'Due date', due);
  const sev = selOf(SEVERITIES.map(s => [s.id, s.n]), v.sev || ''); const env = selOf(ENVS.map(s => [s.id, s.n]), v.env || ''); const steps = el('textarea'); steps.rows = 3; steps.value = v.steps || '';
  const rn = el('input'); rn.type = 'text'; rn.value = v.rn || ''; rn.placeholder = 'Which report?'; const req = el('input'); req.type = 'text'; req.value = v.req || ''; req.placeholder = 'Who asked for it?';
  const fs = { sev: add('sev', 'Severity', sev), env: add('env', 'Environment', env), steps: add('steps', 'Steps to reproduce', steps), rn: add('rn', 'Report name', rn), req: add('req', 'Requested by', req) };
  fs.steps.classList.add('full');
  const sync = t => { const bug = t === 'bug' || t === 'subbug', rep = isReport(t), epic = t === 'epic'; fs.sev.hidden = fs.env.hidden = fs.steps.hidden = !bug; fs.rn.hidden = fs.req.hidden = !rep; out.els.card.closest('label').hidden = epic || typeOf(t).sub; };
  out.sync = sync; sync(type);
  out.read = () => ({ prod: prod.value, card: card.value, lb: parseLabels(lb.value), due: due.value, sev: sev.value, env: env.value, steps: steps.value, rn: rn.value.trim(), req: req.value.trim() });
  return out;
}

/** Create a ticket. `pre` can preset {type, par, ep}. */
export function openCreate(pre) {
  pre = pre || {};
  openDlg('Create ticket', box => {
    const all = rows();
    const type = selOf(TYPES.map(t => [t.id, t.n]), pre.type || 'story'); type.id = 'fc-type';
    const title = el('input'); title.type = 'text'; title.id = 'fc-title'; title.placeholder = 'What needs doing?';
    const desc = el('textarea'); desc.id = 'fc-desc'; desc.rows = 4;
    const asg = selOf([['', 'Unassigned'], ...names()], pre.as || ''); asg.id = 'fc-as';
    const pr = selOf(PRIORITIES.map(p => [p.id, p.n]), 'medium'); pr.id = 'fc-pr';
    const pts = el('input'); pts.type = 'number'; pts.min = 0; pts.step = 0.5; pts.id = 'fc-pts';
    const epic = selOf([['', 'No epic'], ...all.filter(i => i.type === 'epic').map(e => [e.id, e.key + ' ' + e.t])], pre.ep || ''); epic.id = 'fc-ep';
    const par = selOf([['', 'Choose the parent ticket'], ...all.filter(i => !typeOf(i.type).sub && i.type !== 'epic').map(p => [p.id, p.key + ' ' + p.t])], pre.par || ''); par.id = 'fc-par';
    const spSel = selOf([['', 'Backlog'], ...sprints().filter(x => x.state !== 'done').map(x => [x.id, x.n])], pre.sp || ''); spSel.id = 'fc-sp';
    const parF = fld('Parent ticket', par), epF = fld('Epic', epic), err = el('p', 'rerr'); err.id = 'fc-err'; err.hidden = true; err.setAttribute('role', 'alert');
    const ex = extraFields(pre.type || 'story', pre, false);
    const sync = () => { const s = typeOf(type.value).sub; parF.hidden = !s; epF.hidden = s || type.value === 'epic'; ex.sync(type.value); };
    type.addEventListener('change', sync); sync();
    const ok = el('button', 'btn primary', 'Create'); ok.type = 'button'; ok.id = 'fc-ok'; const no = el('button', 'btn', 'Cancel'); no.type = 'button'; no.addEventListener('click', closeDlg);
    ok.addEventListener('click', () => {
      try {
        const e = ex.read(), i = makeIssue(Object.assign({ type: type.value, t: title.value, d: desc.value, as: asg.value, pr: pr.value, pts: pts.value, sp: spSel.value, ep: epF.hidden ? '' : epic.value, par: parF.hidden ? '' : par.value }, e), S.fissues, who());
        put(Object.assign({ id: newId() }, i)); closeDlg(); redraw();
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    });
    const row = el('div', 'row'); row.append(ok, no);
    box.classList.add('flowdlg', 'flowcreate');
    const g = el('div', 'fform'); const full = x => { x.classList.add('full'); return x; };
    g.append(fld('Type', type), fld('Priority', pr), parF, full(fld('Title', title)), full(fld('Description', desc)), fld('Assignee', asg), fld('Points', pts), fld('Sprint', spSel), epF, ...ex.nodes); parF.classList.add('full'); epF.classList.add('full');
    row.classList.add('fbtns'); box.append(g, err, row);
    setTimeout(() => title.focus(), 0);
  });
}

/** The ticket window: edit the fields, move the status, add sub-tickets, read the history, copy the link, delete. */
export function openIssue(id) {
  const i = S.fissues[id] && Object.assign({ id: id }, S.fissues[id]); if (!i) return;
  const edit = canEdit(); const all = rows();
  openDlg(i.key, box => {
    box.classList.add('flowdlg');
    const head = el('div', 'flowhd'); head.append(typeTag(i.type)); if (i.par && S.fissues[i.par]) head.append(el('span', 'sub', 'in ' + S.fissues[i.par].key));
    const lk = el('button', 'btn flowlink', 'Copy link'); lk.type = 'button'; lk.id = 'fi-link';
    lk.addEventListener('click', () => { const u = location.href.split('#')[0] + '#/flow/issue/' + i.key; const ok = () => { lk.textContent = 'Link copied'; }; try { navigator.clipboard.writeText(u).then(ok, () => { window.prompt('Copy this link', u); }); } catch (e) { window.prompt('Copy this link', u); } lk.dataset.url = u; });
    head.append(lk); box.append(head);
    const layout = el('div', 'fissue'), mainc = el('div', 'fmainc'), sidec = el('aside', 'fsidec'); layout.append(mainc, sidec); box.append(layout);
    const title = el('input'); title.type = 'text'; title.id = 'fi-title'; title.value = i.t;
    const desc = el('textarea'); desc.id = 'fi-desc'; desc.rows = 5; desc.value = i.d || '';
    const st = selOf(targets(i.st).map(s => [s.id, s.n]), i.st); st.id = 'fi-st';
    const asg = selOf([['', 'Unassigned'], ...names(), ...(i.as && !names().includes(i.as) ? [i.as] : [])], i.as || ''); asg.id = 'fi-as';
    const pr = selOf(PRIORITIES.map(p => [p.id, p.n]), i.pr); pr.id = 'fi-pr';
    const spS = selOf([['', 'Backlog'], ...sprints().filter(x => x.state !== 'done' || x.id === i.sp).map(x => [x.id, x.n])], i.sp || ''); spS.id = 'fi-sp';
    const pts = el('input'); pts.type = 'number'; pts.min = 0; pts.step = 0.5; pts.id = 'fi-pts'; pts.value = i.pts == null ? '' : i.pts;
    const ex = extraFields(i.type, i, true);
    const ctl = [title, desc, st, asg, pr, pts, spS, ...Object.values(ex.els)]; ctl.forEach(c => { c.disabled = !edit; });
    mainc.append(fld('Title', title), fld('Description', desc), ...['sev', 'env', 'steps', 'rn', 'req'].map(k => ex.nodes.find(n => n.dataset.k === k)));
    sidec.append(el('h3', '', 'Details'), fld('Status', st), fld('Assignee', asg), fld('Priority', pr), fld('Points', pts), fld('Sprint', spS), ...['prod', 'card', 'lb', 'due'].map(k => ex.nodes.find(n => n.dataset.k === k)));
    if (i.bl && statusOf(i.st) && needsReason(i.st)) sidec.append(el('p', 'fblock', 'Reason: ' + i.bl));
    const meta = el('div', 'fmeta'); meta.append(el('p', '', 'Reported by ' + (i.rp || 'unknown')), el('p', '', 'Created ' + ago(i.cr)), el('p', '', 'Updated ' + ago(i.up)));
    if (i.par && S.fissues[i.par]) meta.append(el('p', '', 'Parent: ' + S.fissues[i.par].key + ' ' + S.fissues[i.par].t));
    if (i.ep && S.fissues[i.ep]) meta.append(el('p', '', 'Epic: ' + S.fissues[i.ep].key + ' ' + S.fissues[i.ep].t));
    const cl = i.card && cardTag(i.card); if (cl) meta.append(el('p', '', 'Card ' + i.card + ': ' + cl.t));
    sidec.append(meta);
    const kids = childrenOf(all, i.id);
    if (kids.length || (edit && !typeOf(i.type).sub && i.type !== 'epic')) {
      const k = el('div', 'flowkids'); k.append(el('h3', '', (i.type === 'epic' ? 'Tickets in this epic' : 'Sub-tickets') + ' (' + kids.length + ')'));
      kids.forEach(c => { const b = el('button', 'flowkid'); b.type = 'button'; b.dataset.id = c.id; b.append(typeTag(c.type), document.createTextNode(' ' + c.key + ' ' + c.t + ' · '), stTag(c.st)); b.addEventListener('click', () => openIssue(c.id)); k.append(b); });
      if (edit && i.type !== 'epic' && !typeOf(i.type).sub) {
        const r = el('div', 'row'); [['subtask', 'Add sub-task'], ...(i.type === 'story' ? [['subbug', 'Add sub-bug']] : [])].forEach(([t, n]) => { const b = el('button', 'btn', n); b.type = 'button'; b.dataset.add = t; b.addEventListener('click', () => openCreate({ type: t, par: i.id, prod: i.prod, card: i.card })); r.append(b); }); k.append(r);
      }
      mainc.append(k);
    }
    const hist = el('div', 'flowhist'); hist.append(el('h3', '', 'History'));
    (i.hist || []).slice().reverse().forEach(h => hist.append(el('p', 'sub', h.f === 'created' ? h.by + ' created ' + h.b + ' · ' + ago(h.at) : h.by + ' changed ' + h.f + (h.a || h.b ? ': ' + (h.a || 'empty') + ' → ' + (h.b || 'empty') : '') + (h.w ? ' (' + h.w + ')' : '') + ' · ' + ago(h.at))));
    mainc.append(hist);
    const row = el('div', 'row fbtns');
    if (edit) {
      const sv = el('button', 'btn primary', 'Save'); sv.type = 'button'; sv.id = 'fi-save';
      sv.addEventListener('click', () => {
        const t = title.value.trim(); if (!t) { title.focus(); return; }
        const e = ex.read(), ch = { t: t, d: desc.value, as: asg.value, pr: pr.value, pts: pts.value === '' ? null : Number(pts.value), sp: spS.value, prod: e.prod, card: e.card, lb: e.lb, due: e.due };
        if (i.type === 'bug' || i.type === 'subbug') Object.assign(ch, { sev: e.sev, env: e.env, steps: e.steps }); if (isReport(i.type)) Object.assign(ch, { rn: e.rn, req: e.req });
        const finish = why => { const n = applyChange(i, Object.assign({}, ch, st.value !== i.st ? { st: st.value } : {}), who(), null, why); if (n !== i) put(n); closeDlg(); redraw(); };
        if (st.value !== i.st && needsReason(st.value)) askReason(i, st.value, finish); else finish();
      });
      row.append(sv);
    }
    if (canDelete('flow')) {
      const del = el('button', 'btn danger', 'Delete'); del.type = 'button'; del.id = 'fi-del';
      del.addEventListener('click', () => {
        const plan = deletePlan(all, i.id), subs = plan.del.length - 1;
        const msg = (subs ? 'Its ' + subs + ' sub-ticket(s) will be deleted too. ' : '') + (plan.unlink.length ? plan.unlink.length + ' ticket(s) of this epic stay and lose the epic. ' : '') + 'This cannot be undone.';
        confirmDlg('Delete ' + i.key + (subs ? ' and ' + subs + ' sub-ticket(s)' : '') + '?', msg, 'Delete', () => {
          plan.unlink.forEach(u => { if (S.fissues[u]) put(Object.assign({ id: u }, S.fissues[u], { ep: '' })); });
          plan.del.forEach(d => drop(d)); redraw();
        });
      });
      row.append(del);
    }
    const cls = el('button', 'btn', 'Close'); cls.type = 'button'; cls.addEventListener('click', closeDlg); row.append(cls); box.append(row);
  });
}
