/**
 * @module pages/flow
 * Ynmo Flow, phase 1 (tickets): list with filters, My work, create, and the ticket window (edit, sub-tickets, history).
 * Data: `flow_issues/<id>` documents in the same generic tables as the rest of the app (S.fissues). Rules live in features/flow-model.js.
 * The workflow designer, backlog and sprints, comments, notifications and the AI assistant come in later phases (docs/FLOW_PLAN.md).
 */
import { $, canDelete, canEdit, directory, el } from '../core/model.js';
import { fld, pageHead, selOf, ago } from '../core/shared.js';
import { S } from '../core/state.js';
import { write } from '../core/saving.js';
import { openDlg, closeDlg } from '../features/safety.js';
import { confirmDlg } from '../ui/confirm.js';
import { PRIORITIES, STATUSES, TYPES, applyChange, childrenOf, countByStatus, filterIssues, list, makeIssue, myWork, newId, statusOf, typeOf } from '../features/flow-model.js';

export const FLOW_NAME = 'Ynmo Flow';
const ui = { tab: 'issues', f: { q: '', st: '', type: '', as: '', ep: '', open: true } };
const who = () => (S.me && (S.me.name || S.me.email)) || '';
const rows = () => list(S.fissues);
const names = () => [...new Set([...directory().keys(), who()].filter(Boolean))].sort((a, b) => a.localeCompare(b));
const dot = (c, t) => { const s = el('span', 'ftype', t); s.style.setProperty('--c', c); return s; };
const typeTag = id => dot(typeOf(id).c, typeOf(id).n);
const stTag = id => dot(statusOf(id).c, statusOf(id).n);

/** Save a ticket (whole document). */
function put(i) { const d = Object.assign({}, i); delete d.id; S.fissues[i.id] = d; write('flow_issues/' + i.id, d); }
function drop(id) { delete S.fissues[id]; write('flow_issues/' + id, null); }
const redraw = () => { if ($('pg-flow') && !$('pg-flow').hidden) renderFlow({ keep: true }); };

function setupBanner() {
  if (!S.setup.flow_issues) return null;
  const b = el('div', 'rerr'); b.setAttribute('role', 'alert');
  b.append(el('b', '', 'Database setup needed. '), document.createTextNode('Run supabase/sql/09-flow.sql in the Supabase SQL Editor. Until then tickets are NOT saved and nobody else can see them.'));
  return b;
}

/** Table of tickets; click a row to open it. */
function table(rs, empty) {
  if (!rs.length) return el('p', 'sub flowempty', empty);
  const t = el('table', 'tbl flowtbl'), h = el('tr');
  ['Key', 'Type', 'Title', 'Status', 'Assignee', 'Priority'].forEach(x => h.append(el('th', '', x))); t.append(el('thead')); t.firstChild.append(h);
  const tb = el('tbody');
  rs.forEach(i => {
    const tr = el('tr', 'flowrow'); tr.dataset.id = i.id; tr.tabIndex = 0;
    const k = el('td', 'fkey', i.key), ty = el('td'); ty.append(typeTag(i.type));
    const ti = el('td', 'ftitle', i.t), st = el('td'); st.append(stTag(i.st));
    tr.append(k, ty, ti, st, el('td', '', i.as || 'Unassigned'), el('td', '', (PRIORITIES.find(p => p.id === i.pr) || { n: '' }).n));
    const open = () => openIssue(i.id); tr.addEventListener('click', open); tr.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    tb.append(tr);
  });
  t.append(tb); return t;
}

function issuesTab(host) {
  const all = rows(), f = ui.f, epics = all.filter(i => i.type === 'epic');
  const bar = el('div', 'flowbar');
  const q = el('input'); q.type = 'search'; q.id = 'flowq'; q.placeholder = 'Search key, title, description'; q.value = f.q; q.setAttribute('aria-label', 'Search tickets');
  q.addEventListener('input', () => { f.q = q.value; paint(); });
  const sel = (id, label, opts, key) => { const s = selOf(opts, f[key]); s.id = id; s.setAttribute('aria-label', label); s.addEventListener('change', () => { f[key] = s.value; paint(); }); return s; };
  const ck = el('label', 'flowopen'); const cb = el('input'); cb.type = 'checkbox'; cb.id = 'flowopen'; cb.checked = f.open; cb.addEventListener('change', () => { f.open = cb.checked; paint(); }); ck.append(cb, document.createTextNode(' Hide Deployed and Done'));
  bar.append(q,
    sel('flowst', 'Status', [['', 'All statuses'], ...STATUSES.map(s => [s.id, s.n])], 'st'),
    sel('flowtype', 'Type', [['', 'All types'], ...TYPES.map(t => [t.id, t.n])], 'type'),
    sel('flowas', 'Assignee', [['', 'Everyone'], ['@none', 'Unassigned'], ...names()], 'as'),
    sel('flowep', 'Epic', [['', 'Any epic'], ...epics.map(e => [e.id, e.key + ' ' + e.t])], 'ep'), ck);
  const chips = el('div', 'flowchips'), res = el('div', 'flowres');
  host.append(bar, chips, res);
  function paint() {
    const rs = filterIssues(all, f); chips.textContent = ''; res.textContent = '';
    countByStatus(filterIssues(all, Object.assign({}, f, { st: '' }))).forEach(c => { const b = el('button', 'chip', c.n + ' ' + c.count); b.type = 'button'; b.dataset.st = c.id; b.style.setProperty('--c', statusOf(c.id).c); b.setAttribute('aria-pressed', f.st === c.id ? 'true' : 'false'); b.addEventListener('click', () => { f.st = f.st === c.id ? '' : c.id; renderFlow({ keep: true }); }); chips.append(b); });
    res.append(table(rs, all.length ? 'No ticket matches these filters.' : 'No tickets yet. Create the first one.'));
  }
  paint();
}

function mineTab(host) {
  const w = myWork(rows(), who(), ui.all), sec = (title, rs, id) => { const s = el('section', 'flowsec'); s.id = id; s.append(el('h3', '', title + ' (' + rs.length + ')'), table(rs, 'Nothing here.')); host.append(s); };
  const lab = el('label', 'flowopen'); const cb = el('input'); cb.type = 'checkbox'; cb.id = 'flowall'; cb.checked = !!ui.all; cb.addEventListener('change', () => { ui.all = cb.checked; renderFlow({ keep: true }); }); lab.append(cb, document.createTextNode(' Include Deployed and Done'));
  host.append(lab);
  sec('Assigned to me', w.tickets, 'mine-tickets'); sec('My sub-tasks and sub-bugs', w.subtasks, 'mine-subs'); sec('Bugs assigned to me', w.bugs, 'mine-bugs');
  if (w.epics.length) sec('My epics', w.epics, 'mine-epics');
  sec('Reported by me, assigned to someone else', w.reported, 'mine-reported');
}

export function renderFlow(o) {
  const pg = $('pg-flow'); const sc = pg.scrollTop; pg.textContent = '';
  const mk = el('button', 'btn primary', 'Create'); mk.type = 'button'; mk.id = 'flowcreate'; mk.disabled = !canEdit(); mk.addEventListener('click', () => openCreate());
  pg.append(pageHead(FLOW_NAME, 'Tickets for the team: stories, tasks, bugs, sub-tasks, epics and report requests.', mk));
  const b = setupBanner(); if (b) pg.append(b);
  const seg = el('div', 'seg flowtabs');
  [['issues', 'Issues'], ['mine', 'My work']].forEach(([id, n]) => { const x = el('button', '', n); x.type = 'button'; x.dataset.tab = id; x.setAttribute('aria-pressed', ui.tab === id ? 'true' : 'false'); x.addEventListener('click', () => { ui.tab = id; renderFlow(); }); seg.append(x); });
  const host = el('div', 'flowbody'); host.id = 'flowbody'; pg.append(seg, host);
  (ui.tab === 'mine' ? mineTab : issuesTab)(host);
  if (o && o.keep) pg.scrollTop = sc;
}

/** Create a ticket. `pre` can preset {type, par, ep}. */
export function openCreate(pre) {
  pre = pre || {};
  openDlg('Create ticket', box => {
    const all = rows();
    const type = selOf(TYPES.map(t => [t.id, t.n]), pre.type || 'story'); type.id = 'fc-type';
    const title = el('input'); title.id = 'fc-title'; title.placeholder = 'What needs doing?';
    const desc = el('textarea'); desc.id = 'fc-desc'; desc.rows = 4;
    const asg = selOf([['', 'Unassigned'], ...names()], pre.as || ''); asg.id = 'fc-as';
    const pr = selOf(PRIORITIES.map(p => [p.id, p.n]), 'medium'); pr.id = 'fc-pr';
    const pts = el('input'); pts.type = 'number'; pts.min = 0; pts.step = 0.5; pts.id = 'fc-pts';
    const epic = selOf([['', 'No epic'], ...all.filter(i => i.type === 'epic').map(e => [e.id, e.key + ' ' + e.t])], pre.ep || ''); epic.id = 'fc-ep';
    const par = selOf([['', 'Choose the parent ticket'], ...all.filter(i => !typeOf(i.type).sub && i.type !== 'epic').map(p => [p.id, p.key + ' ' + p.t])], pre.par || ''); par.id = 'fc-par';
    const parF = fld('Parent ticket', par), epF = fld('Epic', epic), err = el('p', 'rerr'); err.id = 'fc-err'; err.hidden = true; err.setAttribute('role', 'alert');
    const sync = () => { const s = typeOf(type.value).sub; parF.hidden = !s; epF.hidden = s || type.value === 'epic'; };
    type.addEventListener('change', sync); sync();
    const ok = el('button', 'btn primary', 'Create'); ok.type = 'button'; ok.id = 'fc-ok'; const no = el('button', 'btn', 'Cancel'); no.type = 'button'; no.addEventListener('click', closeDlg);
    ok.addEventListener('click', () => {
      try {
        const i = makeIssue({ type: type.value, t: title.value, d: desc.value, as: asg.value, pr: pr.value, pts: pts.value, ep: epF.hidden ? '' : epic.value, par: parF.hidden ? '' : par.value }, S.fissues, who());
        const id = newId(); put(Object.assign({ id: id }, i)); closeDlg(); redraw();
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    });
    const row = el('div', 'row'); row.append(ok, no);
    box.append(fld('Type', type), parF, fld('Title', title), fld('Description', desc), fld('Assignee', asg), fld('Priority', pr), fld('Points', pts), epF, err, row);
    setTimeout(() => title.focus(), 0);
  });
}

/** The ticket window: edit the fields, move the status, add sub-tickets, read the history. */
export function openIssue(id) {
  const i = S.fissues[id] && Object.assign({ id: id }, S.fissues[id]); if (!i) return;
  const edit = canEdit(); const all = rows();
  openDlg(i.key, box => {
    box.classList.add('flowdlg');
    const head = el('div', 'flowhd'); head.append(typeTag(i.type), el('span', 'fkey', i.key)); box.append(head);
    const title = el('input'); title.id = 'fi-title'; title.value = i.t;
    const desc = el('textarea'); desc.id = 'fi-desc'; desc.rows = 5; desc.value = i.d || '';
    const st = selOf(STATUSES.map(s => [s.id, s.n]), i.st); st.id = 'fi-st';
    const asg = selOf([['', 'Unassigned'], ...names(), ...(i.as && !names().includes(i.as) ? [i.as] : [])], i.as || ''); asg.id = 'fi-as';
    const pr = selOf(PRIORITIES.map(p => [p.id, p.n]), i.pr); pr.id = 'fi-pr';
    const pts = el('input'); pts.type = 'number'; pts.min = 0; pts.step = 0.5; pts.id = 'fi-pts'; pts.value = i.pts == null ? '' : i.pts;
    const ctl = [title, desc, st, asg, pr, pts]; ctl.forEach(c => { c.disabled = !edit; });
    box.append(fld('Title', title), fld('Description', desc), fld('Status', st), fld('Assignee', asg), fld('Priority', pr), fld('Points', pts));
    const meta = el('p', 'sub', 'Reported by ' + (i.rp || 'unknown') + ' · created ' + ago(i.cr) + ' · updated ' + ago(i.up)); box.append(meta);
    if (i.par && S.fissues[i.par]) box.append(el('p', 'sub', 'Parent: ' + S.fissues[i.par].key + ' ' + S.fissues[i.par].t));
    if (i.ep && S.fissues[i.ep]) box.append(el('p', 'sub', 'Epic: ' + S.fissues[i.ep].key + ' ' + S.fissues[i.ep].t));
    const kids = childrenOf(all, i.id);
    if (kids.length || (edit && !typeOf(i.type).sub && i.type !== 'epic')) {
      const k = el('div', 'flowkids'); k.append(el('h3', '', (i.type === 'epic' ? 'Tickets in this epic' : 'Sub-tickets') + ' (' + kids.length + ')'));
      kids.forEach(c => { const b = el('button', 'flowkid'); b.type = 'button'; b.dataset.id = c.id; b.append(typeTag(c.type), document.createTextNode(' ' + c.key + ' ' + c.t + ' · '), stTag(c.st)); b.addEventListener('click', () => openIssue(c.id)); k.append(b); });
      if (edit && i.type !== 'epic' && !typeOf(i.type).sub) {
        const r = el('div', 'row'); [['subtask', 'Add sub-task'], ...(i.type === 'story' ? [['subbug', 'Add sub-bug']] : [])].forEach(([t, n]) => { const b = el('button', 'btn', n); b.type = 'button'; b.dataset.add = t; b.addEventListener('click', () => openCreate({ type: t, par: i.id })); r.append(b); }); k.append(r);
      }
      box.append(k);
    }
    const hist = el('div', 'flowhist'); hist.append(el('h3', '', 'History'));
    (i.hist || []).slice().reverse().forEach(h => hist.append(el('p', 'sub', h.f === 'created' ? h.by + ' created ' + h.b + ' · ' + ago(h.at) : h.by + ' changed ' + h.f + (h.a || h.b ? ': ' + (h.a || 'empty') + ' → ' + (h.b || 'empty') : '') + ' · ' + ago(h.at))));
    box.append(hist);
    const row = el('div', 'row');
    if (edit) {
      const sv = el('button', 'btn primary', 'Save'); sv.type = 'button'; sv.id = 'fi-save';
      sv.addEventListener('click', () => {
        const t = title.value.trim(); if (!t) { title.focus(); return; }
        const n = applyChange(i, { t: t, d: desc.value, st: st.value, as: asg.value, pr: pr.value, pts: pts.value === '' ? null : Number(pts.value) }, who());
        if (n !== i) put(n); closeDlg(); redraw();
      });
      row.append(sv);
    }
    if (canDelete('flow')) {
      const del = el('button', 'btn danger', 'Delete'); del.type = 'button'; del.id = 'fi-del';
      del.addEventListener('click', () => confirmDlg('Delete ' + i.key + '?', kids.length ? 'Its ' + kids.length + ' sub-ticket(s) stay but lose their parent link.' : 'This cannot be undone.', 'Delete', () => { kids.forEach(c => { if (S.fissues[c.id]) put(Object.assign({}, S.fissues[c.id], { id: c.id, par: c.par === i.id ? '' : c.par, ep: c.ep === i.id ? '' : c.ep })); }); drop(i.id); redraw(); }));
      row.append(del);
    }
    const cl = el('button', 'btn', 'Close'); cl.type = 'button'; cl.addEventListener('click', closeDlg); row.append(cl); box.append(row);
  });
}
