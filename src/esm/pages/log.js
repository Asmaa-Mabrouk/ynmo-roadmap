/**
 * @module pages/log
 * Activity log page.
 * Filterable log view; export/undo/load-older helpers live in log-tools.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, el } from '../core/model.js';
import { allLogs, canUndoRow, exportLog, loadOlderLogs, undoFromLog, undoneSet } from '../features/log-tools.js';
import { ago, clock, pageHead, selOf } from '../core/shared.js';
import { avatarEl } from '../ui/avatars.js';
import { ACTIVE_LOG_PAGE } from '../features/safety.js';

/* ---------- log ---------- */
let logUI = { u: 'all', a: 'all' };
export function renderLog() {
  const root = $('pg-log'); root.textContent = '';
  const every = allLogs(), done = undoneSet();
  const users = [...new Set(every.map(l => l.data.name))].sort();
  const su = selOf([['all', 'Everyone']].concat(users.map(u => [u, u])), logUI.u), sa = selOf([['all', 'All changes'], ['edit', 'Edits'], ['roadmap', 'Roadmaps'], ['idea', 'Ideas'], ['resource', 'Resources'], ['vacation', 'Vacations'], ['access', 'Access']], logUI.a);
  su.setAttribute('aria-label', 'Filter by person'); sa.setAttribute('aria-label', 'Filter by type of change'); su.addEventListener('change', () => { logUI.u = su.value; renderLog(); }); sa.addEventListener('change', () => { logUI.a = sa.value; renderLog(); });
  const rows = every.filter(l => (logUI.u === 'all' || l.data.name === logUI.u) && (logUI.a === 'all' || l.data.act === logUI.a));
  const ex = el('button', 'btn', 'Export CSV'); ex.type = 'button'; ex.id = 'logexport'; ex.addEventListener('click', () => exportLog(rows.map(l => l.data)));
  const tools = el('div', 'formrow'); tools.append(su, sa, ex);
  root.append(pageHead('Log', 'Who changed what, and when. Newest first. Times show in your time zone. Undo puts an edit back the way it was.', tools));
  const card = el('div', 'card'); let day = '';
  if (!rows.length) card.append(el('div', 'hint', 'No changes recorded yet.'));
  rows.forEach(l => {
    const d = l.data;
    const dd = new Date(d.at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (dd !== day) { day = dd; card.append(el('div', 'logday', dd)); }
    const r = el('div', 'logrow'), b = el('div', 'lb');
    const nm = el('b', '', d.name); b.append(nm, document.createTextNode(' '), el('span', 'badge', d.act), document.createTextNode(' ' + d.sum));
    if (done.has(l.id)) b.append(el('span', 'badge undone', 'undone'));
    if (d.rm) b.append(el('div', 'hint', d.rm));
    const tm = el('div', 'lt', ago(d.at)); tm.title = clock(d.at);
    r.append(avatarEl(d.av, 34, d.name), b, tm);
    if (canUndoRow(l, done)) { const u = el('button', 'btn sm undo', 'Undo'); u.type = 'button'; u.setAttribute('aria-label', 'Undo: ' + d.sum); u.addEventListener('click', () => undoFromLog(l)); r.append(u); }
    card.append(r);
  });
  if (S.logsMore) { const m = el('button', 'btn', S.logsBusy ? 'Loading…' : 'Load older entries'); m.type = 'button'; m.id = 'logmore'; m.disabled = S.logsBusy; m.addEventListener('click', loadOlderLogs); card.append(m); }
  else if (every.length > ACTIVE_LOG_PAGE) card.append(el('div', 'hint', 'That is everything.'));
  root.append(card);
}

