/**
 * @module log-tools
 * Activity-log tooling.
 * Paged loading, CSV/JSON export and undo of logged actions via the stored undo payload; also the roadmap picker used by pages that follow the current roadmap.
 * NOTE: all src/js files share one global scope (concatenated by build.mjs).
 */
/* ---------- 6. log: export, load older, undo ---------- */
function allLogs() {
  const seen = new Set(), out = [];
  logs.concat(logsOld).forEach(l => { if (!seen.has(l.id)) { seen.add(l.id); out.push(l); } });
  return out.sort((a, b) => a.data.at < b.data.at ? 1 : -1);
}
async function loadOlderLogs() {
  if (logsBusy) return; logsBusy = true;
  try {
    const have = allLogs().length;
    const r = await sb.from('activity').select('id,data').order('updated_at', { ascending: false }).range(have, have + ACTIVE_LOG_PAGE - 1);
    if (r.error) throw new Error(r.error.message);
    const rows = (r.data || []).map(x => ({ id: x.id, data: x.data || {} }));
    logsOld = logsOld.concat(rows); logsMore = rows.length >= ACTIVE_LOG_PAGE;
  } catch (e) { toast('Could not load older entries. Try again.'); }
  logsBusy = false; if (state.page === 'log') renderLog();
}
async function exportLog(rows) {
  const lines = [['When', 'Who', 'Type', 'Change', 'Roadmap'].map(csvCell).join(',')];
  rows.forEach(d => lines.push([d.at, d.name, d.act, d.sum, d.rm || ''].map(csvCell).join(',')));
  try { await dl.save({ filename: 'ynmo-log-' + todayIso() + '.csv', data: '﻿' + lines.join('\n') }); } catch (e) { /* declined */ }
}
function undoneSet() { const s = new Set(); allLogs().forEach(l => { if (l.data.ref) s.add(l.data.ref); }); return s; }
function canUndoRow(l, done) { return canWrite() && l.data.u && !done.has(l.id); }
function undoFromLog(l) {
  const u = l.data.u; if (!u || !canWrite()) return;
  const cur = over[u.id], isSame = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
  let clash = false;
  if (u.after) Object.keys(u.after).forEach(k => { if (!isSame(cur && cur[k], u.after[k])) clash = true; });
  if (u.whole !== undefined && u.after === undefined) clash = false;
  const run = () => {
    pushHistory();
    if (u.after) {
      const o = Object.assign({}, over[u.id] || {});
      Object.keys(u.set || {}).forEach(k => { o[k] = u.set[k]; }); (u.unset || []).forEach(k => { delete o[k]; });
      over[u.id] = o; persist(u.id, (u.unset || []).length ? null : u.set);
    } else if (u.whole) { over[u.id] = u.whole; persist(u.id); } else { delete over[u.id]; persist(u.id); }
    render();
    const data = { at: new Date().toISOString(), uid: me.id, name: me.name || me.email, av: me.avatar || '', act: 'edit', sum: 'undid: ' + l.data.sum, rm: l.data.rm, ref: l.id };
    const id = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    logs.unshift({ id: id, data: data }); sb.from('activity').insert({ id: id, data: data }).then(() => {}, () => {});
    if (state.page === 'log') renderLog();
    toast('Change undone.');
  };
  if (!clash) { run(); return; }
  openDlg('Undo this change?', b => {
    b.append(el('p', 'hint', 'This bar was changed again after that entry. Undoing will put back the older values and replace what is there now.'));
    const ok = el('button', 'btn primary', 'Undo anyway'); ok.type = 'button'; const no = el('button', 'btn', 'Keep current'); no.type = 'button';
    ok.addEventListener('click', () => { closeDlg(); run(); }); no.addEventListener('click', closeDlg);
    const row = el('div', 'formrow'); row.append(ok, no); b.append(row);
  });
}

/* ---------- roadmap picker for pages that follow the current roadmap ---------- */
function rmPicker(after) {
  const s = selOf(allRoadmaps().map(r => [r.id, r.n]), state.rm); s.setAttribute('aria-label', 'Roadmap');
  s.addEventListener('change', () => { useRoadmap(s.value); after(); }); return s;
}

