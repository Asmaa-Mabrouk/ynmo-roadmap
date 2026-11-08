/**
 * @module features/flow-views
 * Ynmo Flow, the Jira-style views other than the issue list: Summary, Board, Epics, the "coming soon" pages and the Settings pages.
 * Each view fills `host` using a context `c` = {rows, open(id), who, move(id, status), go(view), canEdit}.
 */
import { el } from '../core/model.js';
import { ago } from '../core/shared.js';
import { TAGS } from './month-model.js';
import { PRIORITIES, STATUSES, TYPES, epicProgress, filterIssues, initials, statusOf, summaryStats, typeOf } from './flow-model.js';

const bar = (pct, c) => { const b = el('div', 'fbar'); const i = el('i'); i.style.width = pct + '%'; if (c) i.style.background = c; b.append(i); return b; };
export const avatar = n => { const a = el('span', 'favatar', initials(n)); a.title = n || 'Unassigned'; return a; };
export const tag = (c, t) => { const s = el('span', 'ftype', t); s.style.setProperty('--c', c); return s; };
const card = (title, ...kids) => { const d = el('section', 'fpanel card'); d.append(el('h3', '', title), ...kids); return d; };

export function summaryView(host, c) {
  const s = summaryStats(c.rows, c.prods, c.today), top = el('div', 'fstats');
  [['Total tickets', s.total], ['Open', s.open], ['In progress', s.progress], ['Blocked', s.blocked], ['Deployed or done', s.closed]].forEach(([n, v]) => { const t = el('div', 'fstat card'); t.dataset.stat = n; t.append(el('b', '', String(v)), el('span', '', n)); top.append(t); });
  host.append(top);
  const g = el('div', 'fgrid');
  const st = el('div', 'fbars'); const mx = Math.max(1, ...s.status.map(x => x.count));
  s.status.forEach(x => { const r = el('div', 'fbrow'); r.append(el('span', '', x.n), bar(x.count * 100 / mx, statusOf(x.id).c), el('b', '', String(x.count))); st.append(r); });
  const ty = el('div', 'fbars'); const mt = Math.max(1, ...s.types.map(x => x.count));
  s.types.forEach(x => { const r = el('div', 'fbrow'); r.append(el('span', '', x.n), bar(x.count * 100 / mt, x.c), el('b', '', String(x.count))); ty.append(r); });
  const pe = el('div', 'fbars'); const mp = Math.max(1, ...s.people.map(x => x.count));
  s.people.forEach(x => { const r = el('div', 'fbrow'); r.append(el('span', '', x.n), bar(x.count * 100 / mp), el('b', '', String(x.count))); pe.append(r); });
  const pdv = el('div', 'fbars'); const mpd = Math.max(1, ...s.products.map(x => x.count));
  s.products.forEach(x => { const r = el('div', 'fbrow'); r.append(el('span', '', x.n), bar(x.count * 100 / mpd, x.c), el('b', '', String(x.count))); pdv.append(r); });
  const od = el('div', 'frecent'); s.overdue.slice(0, 8).forEach(i => { const p = el('p', 'sub'); const b = el('button', 'flink', i.key); b.type = 'button'; b.addEventListener('click', () => c.open(i.id)); p.append(b, document.createTextNode(' ' + i.t.slice(0, 50) + ' · due ' + i.due + (i.as ? ' · ' + i.as : ''))); od.append(p); });
  const rc = el('div', 'frecent');
  s.recent.forEach(h => { const p = el('p', 'sub'); const b = el('button', 'flink', h.key); b.type = 'button'; b.addEventListener('click', () => c.open(h.id)); p.append(document.createTextNode((h.by || 'Someone') + ' ' + (h.f === 'created' ? 'created ' : 'changed ' + h.f + ' on ')), b, document.createTextNode(' · ' + ago(h.at))); rc.append(p); });
  g.append(card('Status overview', s.total ? st : el('p', 'sub', 'No tickets yet.')), card('Types', s.types.length ? ty : el('p', 'sub', 'No tickets yet.')), card('Open work per person', s.people.length ? pe : el('p', 'sub', 'Nothing open.')), card('Open work per product', s.products.length ? pdv : el('p', 'sub', 'Nothing open.')), card('Overdue (' + s.overdue.length + ')', s.overdue.length ? od : el('p', 'sub', 'Nothing is past its due date.')), card('Recent activity', s.recent.length ? rc : el('p', 'sub', 'Nothing yet.')));
  host.append(g);
}

/** Board: one column per status, drag a card to move it. */
export function boardView(host, c, ui) {
  if (c.sp) host.append(el('p', 'sub fboardnote', c.sp === '@none' ? 'No sprint is running. Start one from the Sprints page.' : 'Tickets of the active sprint only. New tickets made here join the sprint.'));
  const bar2 = el('div', 'flowbar fboardbar'); if (c.prod) { const pt = TAGS.find(x => x.k === c.prod); if (pt) host.append(el('p', 'sub fboardnote', 'Tickets of ' + pt.n + ' only. New tickets made here are ' + pt.n + ' tickets.')); }
  const q = el('input'); q.type = 'search'; q.id = 'boardq'; q.placeholder = 'Search the board'; q.value = ui.bq || ''; q.setAttribute('aria-label', 'Search the board');
  const mine = el('button', 'chip', 'Only my tickets'); mine.type = 'button'; mine.id = 'boardmine'; mine.style.setProperty('--c', '#3b6fd4'); mine.setAttribute('aria-pressed', ui.bmine ? 'true' : 'false');
  bar2.append(q, mine); host.append(bar2);
  const cols = el('div', 'fboard'); host.append(cols);
  function paint() {
    cols.textContent = '';
    let rs = filterIssues(c.rows.filter(i => i.type !== 'epic' && (!c.prod || i.prod === c.prod) && (!c.sp || i.sp === c.sp)), { q: ui.bq || '' }); if (ui.bmine) rs = rs.filter(i => i.as === c.who);
    STATUSES.forEach(s => {
      const col = el('div', 'fcol'); col.dataset.st = s.id;
      const items = rs.filter(i => i.st === s.id).sort((a, b) => b.n - a.n);
      const h = el('div', 'fcolhd'); h.append(tag(s.c, s.n.toUpperCase()), el('span', 'fcount', String(items.length))); col.append(h);
      const body = el('div', 'fcolbody'); col.append(body);
      items.forEach(i => {
        const k = el('div', 'fcard'); k.dataset.id = i.id; k.draggable = c.canEdit; k.tabIndex = 0;
        const t = el('div', 'fcardt', i.t), m = el('div', 'fcardm');
        m.append(tag(typeOf(i.type).c, i.key), ...(!c.prod && i.prod && TAGS.find(x => x.k === i.prod) ? [tag(TAGS.find(x => x.k === i.prod).c, TAGS.find(x => x.k === i.prod).n)] : []), (() => { const p = el('span', 'fpr', (PRIORITIES.find(x => x.id === i.pr) || { n: '' }).n); return p; })(), avatar(i.as));
        k.append(t, m);
        k.addEventListener('click', () => c.open(i.id)); k.addEventListener('keydown', e => { if (e.key === 'Enter') c.open(i.id); });
        k.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', i.id); e.dataTransfer.effectAllowed = 'move'; k.classList.add('drag'); });
        k.addEventListener('dragend', () => k.classList.remove('drag'));
        body.append(k);
      });
      if (c.canEdit) {
        const qb = el('button', 'fquick', '+ Create'); qb.type = 'button'; qb.dataset.st = s.id;
        qb.addEventListener('click', () => {
          const f = el('div', 'fquickf'), inp = el('input'), er = el('p', 'rerr'); inp.type = 'text'; inp.placeholder = 'What needs doing? Enter to create'; inp.setAttribute('aria-label', 'New ticket in ' + s.n); er.hidden = true;
          inp.addEventListener('keydown', e => { if (e.key === 'Escape') { f.replaceWith(qb); } if (e.key === 'Enter') { const m = inp.value.trim() ? c.quick(inp.value, s.id, c.prod, c.sp) : ''; if (m) { er.textContent = m; er.hidden = false; } } });
          f.append(inp, er); qb.replaceWith(f); inp.focus();
        });
        col.append(qb);
        col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
        col.addEventListener('dragleave', () => col.classList.remove('over'));
        col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); if (id) c.move(id, s.id); });
      }
      cols.append(col);
    });
  }
  q.addEventListener('input', () => { ui.bq = q.value; paint(); });
  mine.addEventListener('click', () => { ui.bmine = !ui.bmine; mine.setAttribute('aria-pressed', ui.bmine ? 'true' : 'false'); paint(); });
  paint();
}

export function epicsView(host, c) {
  const eps = c.rows.filter(i => i.type === 'epic');
  if (!eps.length) { host.append(el('p', 'sub flowempty', 'No epics yet. Create a ticket of type Epic, then choose it in the Epic field of other tickets.')); return; }
  eps.forEach(e => {
    const p = epicProgress(c.rows, e.id), d = el('div', 'fepic card'); d.dataset.id = e.id; d.tabIndex = 0;
    const h = el('div', 'fepichd'); h.append(tag(typeOf('epic').c, e.key), el('b', '', e.t), stTag(e.st)); d.append(h, bar(p.pct, '#2a9d6f'), el('p', 'sub', p.done + ' of ' + p.total + ' tickets closed · ' + p.pct + '%'));
    d.addEventListener('click', () => c.open(e.id)); d.addEventListener('keydown', ev => { if (ev.key === 'Enter') c.open(e.id); });
    host.append(d);
  });
}
const stTag = id => tag(statusOf(id).c, statusOf(id).n);

/** Pages for what comes in a later phase: say what it will do and when. */
export const SOON = {};
export function soonView(host, id) {
  const s = SOON[id], d = el('div', 'fsoon card'); d.append(tag('#8b93a7', 'Coming in phase ' + s.ph), el('h2', '', s.t), el('p', '', s.d), el('p', 'sub', 'The board and the issue list already work. See docs/FLOW_PLAN.md for the order of the phases.')); host.append(d);
}

export function settingsView(host, id) {
  if (id === 'set-types') {
    const t = el('table', 'tbl'), h = el('tr'); ['Type', 'Needs a parent', 'Can sit under'].forEach(x => h.append(el('th', '', x))); const th = el('thead'); th.append(h); t.append(th);
    const tb = el('tbody'); TYPES.forEach(x => { const r = el('tr'); const a = el('td'); a.append(tag(x.c, x.n)); r.append(a, el('td', '', x.sub ? 'Yes' : 'No'), el('td', '', x.sub ? x.parents.map(p => typeOf(p).n).join(', ') : x.id === 'epic' ? 'Nothing (epics hold other tickets)' : 'An epic (optional)')); tb.append(r); }); t.append(tb);
    host.append(card('Issue types', t, el('p', 'sub', 'These eight types and their parent rules are fixed for now. Adding your own types comes with the workflow designer (phase 2).')));
  } else {
    const d = el('dl', 'fdl'); [['Name', 'Ynmo Flow'], ['Key', 'YNMO (tickets are numbered YNMO-1, YNMO-2, ...)'], ['Type', 'Team project'], ['Who can use it', 'Set per person on the Permissions page (Ynmo Flow: View, Edit, Delete)']].forEach(([a, b]) => d.append(el('dt', '', a), el('dd', '', b)));
    host.append(card('Project details', d));
  }
}
