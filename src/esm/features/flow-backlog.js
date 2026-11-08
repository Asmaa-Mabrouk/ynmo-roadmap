/**
 * @module features/flow-backlog
 * Ynmo Flow phase 3 screens: Backlog (ordered list per sprint, drag to rank or to another sprint) and Sprints (create, start, complete, burndown, report).
 * Context c = {rows, sprints, today, canEdit, open(id), assignSprint(ids, spId), rank(id, beforeId, spId), saveSprints(list, msg), go(view)}.
 */
import { el } from '../core/model.js';
import { fld, selOf } from '../core/shared.js';
import { openDlg, closeDlg } from './safety.js';
import { confirmDlg } from '../ui/confirm.js';
import { typeOf, statusOf, isClosed } from './flow-model.js';
import { STATES, activeSprint, burndown, completeSprint, makeSprint, sprintById, sprintProblem, sprintStats, startProblem, suggestSprint, ticketsIn, velocity } from './flow-sprints.js';
import { closedAt } from './flow-perf.js';
import { avatar, tag } from './flow-views.js';

const SC = { planned: '#8b93a7', active: '#2a9d6f', done: '#3b6fd4' };
const unitTxt = st => (st.unit === 'points' ? st.points + ' pts' : st.count + ' tickets');
const range = s => s.start + ' → ' + s.end;
const ordered = list => list.slice().sort((a, b) => ({ active: 0, planned: 1, done: 2 }[a.state] - { active: 0, planned: 1, done: 2 }[b.state]) || a.start.localeCompare(b.start));

/** Create or edit a sprint (dialog). */
export function sprintDialog(c, sprint) {
  openDlg(sprint ? 'Edit ' + sprint.n : 'Create sprint', box => {
    const sug = sprint || suggestSprint(c.sprints, c.today);
    const n = el('input'); n.type = 'text'; n.id = 'sp-name'; n.value = sug.n;
    const g = el('textarea'); g.id = 'sp-goal'; g.rows = 2; g.value = sug.goal || '';
    const a = el('input'); a.type = 'date'; a.id = 'sp-start'; a.value = sug.start;
    const b = el('input'); b.type = 'date'; b.id = 'sp-end'; b.value = sug.end;
    const err = el('p', 'err'); err.id = 'sp-err'; err.setAttribute('role', 'alert');
    const ok = el('button', 'btn primary', sprint ? 'Save' : 'Create'); ok.type = 'button'; ok.id = 'sp-save';
    ok.addEventListener('click', () => {
      const v = { n: n.value, goal: g.value, start: a.value, end: b.value }, p = sprintProblem(c.sprints, v, sprint); if (p) { err.textContent = p; return; }
      const list = sprint ? c.sprints.map(x => (x.id === sprint.id ? Object.assign({}, x, { n: v.n.trim(), goal: v.goal.trim(), start: v.start, end: v.end }) : x)) : c.sprints.concat([makeSprint(c.sprints, v)]);
      closeDlg(); c.saveSprints(list, sprint ? 'Sprint saved' : 'Sprint created');
    });
    const cn = el('button', 'btn', 'Cancel'); cn.type = 'button'; cn.addEventListener('click', closeDlg);
    const r = el('div', 'row fbtns'); r.append(ok, cn);
    box.append(fld('Name', n), fld('Goal (optional)', g), fld('Starts', a), fld('Ends', b), err, r);
  });
}
function completeDialog(c, s) {
  const t = ticketsIn(c.rows, s.id), open = t.filter(i => !isClosed(i));
  openDlg('Complete ' + s.n, box => {
    box.append(el('p', '', t.length - open.length + ' of ' + t.length + ' tickets are finished. ' + (open.length ? open.length + ' unfinished ticket(s) will move:' : 'Nothing to move.')));
    const opts = [['', 'Back to the backlog']].concat(c.sprints.filter(x => x.state === 'planned').map(x => [x.id, 'To ' + x.n]));
    const sel = selOf(opts, ''); sel.id = 'sp-target'; if (open.length) box.append(fld('Move unfinished tickets', sel));
    const ok = el('button', 'btn primary', 'Complete sprint'); ok.type = 'button'; ok.id = 'sp-complete';
    ok.addEventListener('click', () => {
      const r = completeSprint(s, c.rows, sel.value, c.today, closedAt);
      closeDlg(); c.assignSprint(r.moves, sel.value, true); c.saveSprints(c.sprints.map(x => (x.id === s.id ? r.sprint : x)), s.n + ' completed');
    });
    const cn = el('button', 'btn', 'Cancel'); cn.type = 'button'; cn.addEventListener('click', closeDlg);
    const r = el('div', 'row fbtns'); r.append(ok, cn); box.append(r);
  });
}
const sprintActions = (c, s) => {
  const w = el('div', 'fspact'); if (!c.canEdit) return w;
  const btn = (txt, id, fn, cls) => { const b = el('button', 'btn' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; b.dataset.act = id; b.addEventListener('click', fn); w.append(b); };
  if (s.state === 'planned') btn('Start sprint', 'start', () => { const p = startProblem(c.sprints, s); if (p) { c.say(p); return; } c.saveSprints(c.sprints.map(x => (x.id === s.id ? Object.assign({}, x, { state: 'active' }) : x)), s.n + ' started'); }, 'primary');
  if (s.state === 'active') btn('Complete sprint', 'complete', () => completeDialog(c, s), 'primary');
  if (s.state !== 'done') btn('Edit', 'edit', () => sprintDialog(c, s));
  if (s.state !== 'active') btn('Delete', 'delete', () => confirmDlg('Delete ' + s.n + '?', 'Its tickets go back to the backlog. This cannot be undone.', 'Delete', () => { c.assignSprint(ticketsIn(c.rows, s.id).map(i => i.id), '', true); c.saveSprints(c.sprints.filter(x => x.id !== s.id), s.n + ' deleted'); }), 'danger');
  return w;
};

function ticketRow(c, i, spId) {
  const r = el('div', 'fblrow'); r.dataset.id = i.id; r.draggable = c.canEdit; if (isClosed(i)) r.classList.add('done');
  const k = el('button', 'flink', i.key); k.type = 'button'; k.addEventListener('click', () => c.open(i.id));
  r.append(tag(typeOf(i.type).c, typeOf(i.type).n), k, el('span', 'fbltitle', i.t), tag(statusOf(i.st).c, statusOf(i.st).n));
  if (i.pts != null) r.append(el('span', 'fpts', String(i.pts)));
  r.append(avatar(i.as));
  if (c.canEdit && spId !== undefined) {
    const sel = selOf([['', 'Backlog']].concat(c.sprints.filter(x => x.state !== 'done').map(x => [x.id, x.n])), i.sp || ''); sel.className = 'fblmove'; sel.setAttribute('aria-label', 'Sprint of ' + i.key);
    sel.addEventListener('change', () => c.assignSprint([i.id], sel.value)); r.append(sel);
  }
  r.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', i.id); e.dataTransfer.effectAllowed = 'move'; r.classList.add('drag'); });
  r.addEventListener('dragend', () => r.classList.remove('drag'));
  return r;
}
function dropZone(c, list, spId) {
  list.addEventListener('dragover', e => { if (!c.canEdit) return; e.preventDefault(); list.classList.add('over'); });
  list.addEventListener('dragleave', () => list.classList.remove('over'));
  list.addEventListener('drop', e => {
    e.preventDefault(); list.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); if (!id || !c.canEdit) return;
    const rowsEl = [...list.querySelectorAll('.fblrow')].filter(x => x.dataset.id !== id);
    const hit = rowsEl.find(x => { const b = x.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
    c.rank(id, hit ? hit.dataset.id : '', spId);
  });
}

export function backlogView(host, c, ui) {
  const bar = el('div', 'flowbar');
  const q = el('input'); q.type = 'search'; q.id = 'blq'; q.placeholder = 'Search the backlog'; q.value = ui.blq || ''; q.setAttribute('aria-label', 'Search the backlog');
  const mk = el('button', 'btn primary', 'Create sprint'); mk.type = 'button'; mk.id = 'sp-create'; mk.disabled = !c.canEdit; mk.addEventListener('click', () => sprintDialog(c));
  bar.append(q, mk); host.append(bar);
  const body = el('div', 'fbacklog'); host.append(body);
  const paint = () => {
    body.textContent = ''; const words = String(ui.blq || '').toLowerCase().split(/\s+/).filter(Boolean);
    const keep = i => !words.length || words.every(w => (i.key + ' ' + i.t + ' ' + (i.lb || []).join(' ')).toLowerCase().includes(w));
    const sec = (s) => {
      const spId = s ? s.id : '', t = ticketsIn(c.rows, spId), st = sprintStats(c.rows, spId);
      const d = el('section', 'fsprint card'); d.dataset.sp = spId;
      const h = el('div', 'fsphead'), nm = el('div', 'fspname');
      nm.append(el('b', '', s ? s.n : 'Backlog'));
      if (s) { nm.append(tag(SC[s.state], STATES[s.state]), el('span', 'sub', range(s))); if (s.goal) nm.append(el('span', 'sub', '· ' + s.goal)); }
      nm.append(el('span', 'sub fspcount', t.length + ' ticket' + (t.length === 1 ? '' : 's') + (st.points ? ' · ' + st.points + ' pts' : '')));
      h.append(nm); if (s) h.append(sprintActions(c, s)); d.append(h);
      const list = el('div', 'fbl'); list.dataset.sp = spId;
      const shown = t.filter(keep); shown.forEach(i => list.append(ticketRow(c, i, spId)));
      if (!shown.length) list.append(el('p', 'sub fblempty', s ? 'Plan a sprint by dragging tickets here from the backlog.' : 'The backlog is empty.'));
      dropZone(c, list, spId); d.append(list);
      if (c.canEdit) { const add = el('button', 'btn fblnew', '+ Create ticket'); add.type = 'button'; add.addEventListener('click', () => c.create({ sp: spId })); d.append(add); }
      return d;
    };
    ordered(c.sprints.filter(s => s.state !== 'done')).forEach(s => body.append(sec(s))); body.append(sec(null));
  };
  q.addEventListener('input', () => { ui.blq = q.value; paint(); });
  paint();
}

function chart(b, s) {
  const W = 520, H = 180, P = 28, n = b.days.length, mx = Math.max(1, b.total), X = k => P + (n > 1 ? k * (W - 2 * P) / (n - 1) : 0), Y = v => H - P - (v * (H - 2 * P) / mx);
  const pts = (key) => b.days.map((x, k) => (x[key] == null ? null : X(k) + ',' + Y(x[key]))).filter(Boolean).join(' ');
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="fburn" role="img" aria-label="Burndown of ${s.n}"><line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" stroke="currentColor" opacity=".3"/><line x1="${P}" y1="${P}" x2="${P}" y2="${H - P}" stroke="currentColor" opacity=".3"/><polyline fill="none" stroke="#8b93a7" stroke-dasharray="5 4" stroke-width="2" points="${pts('ideal')}"/><polyline fill="none" stroke="#2a9d6f" stroke-width="3" points="${pts('remaining')}"/><text x="${P}" y="${P - 8}" font-size="11" fill="currentColor">${b.total} ${b.unit} at start</text></svg>`;
  const d = el('div', 'fburnwrap'); d.insertAdjacentHTML('beforeend', svg); d.append(el('p', 'sub', 'Green = remaining ' + b.unit + ', grey dashed = ideal pace.')); return d;
}

export function sprintsView(host, c) {
  const bar = el('div', 'flowbar'); const mk = el('button', 'btn primary', 'Create sprint'); mk.type = 'button'; mk.id = 'sp-create'; mk.disabled = !c.canEdit; mk.addEventListener('click', () => sprintDialog(c)); bar.append(mk);
  const v = velocity(c.sprints, 3); if (v != null) bar.append(el('span', 'sub', 'Velocity (last 3 sprints): ' + v + ' per sprint')); host.append(bar);
  if (!c.sprints.length) { host.append(el('p', 'sub', 'No sprints yet. Create one, then plan it from the Backlog.')); return; }
  ordered(c.sprints).forEach(s => {
    const d = el('section', 'fsprint card'); d.dataset.sp = s.id;
    const h = el('div', 'fsphead'), nm = el('div', 'fspname'); nm.append(el('b', '', s.n), tag(SC[s.state], STATES[s.state]), el('span', 'sub', range(s))); if (s.goal) nm.append(el('span', 'sub', '· ' + s.goal));
    h.append(nm, sprintActions(c, s)); d.append(h);
    const t = ticketsIn(c.rows, s.id);
    if (s.state === 'done' && s.rep) {
      const r = s.rep, dl = el('dl', 'fdl'); [['Finished', r.done + ' of ' + r.total + ' tickets'], ['Points', r.pointsDone + ' of ' + r.points], ['Moved on', r.moved + (r.moved ? (r.to ? ' to ' + ((sprintById(c.sprints, r.to) || {}).n || 'another sprint') : ' to the backlog') : '')], ['Completed', s.doneAt]].forEach(([a, b]) => { dl.append(el('dt', '', a), el('dd', '', b)); });
      d.append(dl);
      const bd = { unit: r.unit, total: r.unit === 'points' ? r.points : r.total, days: (r.burn || []).map((x, k) => ({ remaining: x, ideal: Math.round((r.unit === 'points' ? r.points : r.total) * (1 - k / Math.max(1, r.burn.length - 1)) * 10) / 10 })) };
      if (bd.days.length > 1) d.append(chart(bd, s));
    } else {
      const st = sprintStats(c.rows, s.id); d.append(el('p', 'sub', st.done + ' of ' + st.count + ' tickets finished · ' + unitTxt(st)));
      if (s.state === 'active' && t.length) d.append(chart(burndown(s, t, c.today, closedAt), s));
      if (s.state === 'active') { const gb = el('button', 'btn', 'Open the sprint board'); gb.type = 'button'; gb.id = 'sp-board'; gb.addEventListener('click', () => c.go('sprintboard')); d.append(gb); }
    }
    host.append(d);
  });
}
export { activeSprint };
