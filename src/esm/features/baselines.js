/**
 * @module features/baselines
 * Baselines / snapshots.
 * Immutable checkpoints of a roadmap, marking one active, and the 'Plan vs now' comparison. The DB trigger guard_baseline enforces immutability server-side.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, STATUS, dlabel, el, items, state } from '../core/model.js';
import { depsOf } from './dependencies.js';
import { canWrite } from './safety.js';
import { curRm } from '../pages/roadmaps.js';
import { clock, logAct, pageHead, toast, todayIso } from '../core/shared.js';
import { rmPicker } from './log-tools.js';

/* ---------- 5. baselines ---------- */
function snapItems() { return items().map(i => ({ id: i.id, t: i.t, sq: i.sq, d0: i.d0, d1: i.d1, st: i.st, res: i.res.slice(), ms: !!i.ms, dep: depsOf(i).slice() })); }
function saveSnapshot(name, active) {
  const id = 'b' + Date.now().toString(36), rm = state.rm;
  if (active) Object.keys(S.baselines).forEach(k => { if (S.baselines[k].rm === rm && S.baselines[k].active) { const d = Object.assign({}, S.baselines[k], { active: false }); S.baselines[k] = d; S.db.doc('baselines/' + k).set(d).catch(() => {}); } });
  const data = { rm: rm, rmName: curRm().n, name: name, at: new Date().toISOString(), by: S.me.name || S.me.email, active: !!active, items: snapItems() };
  S.baselines[id] = data; return S.db.doc('baselines/' + id).set(data).then(() => { logAct('roadmap', 'saved snapshot "' + name + '" of ' + curRm().n); });
}
function setBaseline(id) {
  const rm = S.baselines[id].rm;
  Object.keys(S.baselines).forEach(k => { if (S.baselines[k].rm === rm) { const want = k === id; if (!!S.baselines[k].active !== want) { const d = Object.assign({}, S.baselines[k], { active: want }); S.baselines[k] = d; S.db.doc('baselines/' + k).set(d).catch(() => {}); } } });
  logAct('roadmap', 'set "' + S.baselines[id].name + '" as the baseline for ' + S.baselines[id].rmName);
}
function diffSnap(b) {
  const now = items(), nm = new Map(now.map(i => [i.id, i])), om = new Map((b.items || []).map(i => [i.id, i]));
  const out = { moved: [], added: [], removed: [], status: [], owners: [] };
  now.forEach(i => {
    const o = om.get(i.id); if (!o) { out.added.push(i); return; }
    if (o.d0 !== i.d0 || o.d1 !== i.d1) out.moved.push({ it: i, o: o, ds: i.d0 - o.d0, de: i.d1 - o.d1 });
    if (o.st !== i.st) out.status.push({ it: i, o: o });
    if (JSON.stringify((o.res || []).slice().sort()) !== JSON.stringify(i.res.slice().sort())) out.owners.push({ it: i, o: o });
  });
  (b.items || []).forEach(o => { if (!nm.has(o.id)) out.removed.push(o); });
  return out;
}
let cmpId = null;
export function renderBaselines() {
  const root = $('pg-baselines'); root.textContent = '';
  root.append(pageHead('Baselines', 'Save the plan at a point in time, then compare it with today. Snapshots never change after they are saved. Turn on "Plan vs now" on the roadmap to see the old dates as thin amber bars under each bar.', rmPicker(renderBaselines)));
  const mine = Object.keys(S.baselines).map(id => Object.assign({ id: id }, S.baselines[id])).filter(b => b.rm === state.rm).sort((a, b) => a.at < b.at ? 1 : -1);
  if (canWrite()) {
    const c = el('div', 'card'); c.append(el('h2', '', 'Save a snapshot of ' + curRm().n));
    const nm = el('input'); nm.type = 'text'; nm.value = curRm().n + ' · ' + todayIso(); nm.maxLength = 80; nm.setAttribute('aria-label', 'Snapshot name');
    const ck = el('input'); ck.type = 'checkbox'; ck.checked = !mine.some(b => b.active); ck.id = 'snapactive'; const cl = el('label', 'chk'); cl.htmlFor = 'snapactive'; cl.append(ck, document.createTextNode(' Use as the baseline to compare against'));
    const go = el('button', 'btn primary', 'Save snapshot'); go.type = 'button';
    const msg = el('div', 'gerr'); msg.setAttribute('aria-live', 'polite');
    go.addEventListener('click', async () => {
      const n = nm.value.trim(); if (!n) { msg.textContent = 'Give the snapshot a name.'; return; }
      go.disabled = true; try { await saveSnapshot(n, ck.checked); toast('Snapshot saved.'); } catch (e) { msg.textContent = 'Could not save. If this keeps happening, ask the admin to run setup v4.'; } go.disabled = false; renderBaselines();
    });
    const row = el('div', 'formrow'); row.style.alignItems = 'center'; row.append(nm, cl, go); nm.style.flex = '1 1 260px'; c.append(row, msg); root.append(c);
  }
  const lc = el('div', 'card'); lc.append(el('h2', '', 'Checkpoint history'));
  if (!mine.length) lc.append(el('div', 'hint', 'No snapshots for this roadmap yet.'));
  mine.forEach(b => {
    const r = el('div', 'formrow snaprow'); r.style.alignItems = 'center';
    const w = el('div'); const t = el('b', '', b.name); if (b.active) t.append(el('span', 'badge', 'baseline'));
    w.append(t, el('div', 'hint', clock(b.at) + ' · ' + b.by + ' · ' + (b.items || []).length + ' bars'));
    const cmp = el('button', 'btn sm' + (cmpId === b.id ? ' primary' : ''), cmpId === b.id ? 'Hide comparison' : 'Compare with now'); cmp.type = 'button'; cmp.style.marginInlineStart = 'auto';
    cmp.addEventListener('click', () => { cmpId = cmpId === b.id ? null : b.id; renderBaselines(); });
    r.append(w, cmp);
    if (canWrite() && !b.active) { const mk = el('button', 'btn sm', 'Make baseline'); mk.type = 'button'; mk.addEventListener('click', () => { setBaseline(b.id); renderBaselines(); }); r.append(mk); }
    if (canWrite() && S.me && S.me.is_admin) { const dl2 = el('button', 'btn sm danger', 'Delete'); dl2.type = 'button'; dl2.addEventListener('click', () => { delete S.baselines[b.id]; S.db.doc('baselines/' + b.id).delete().catch(() => {}); logAct('roadmap', 'deleted snapshot "' + b.name + '"'); renderBaselines(); }); r.append(dl2); }
    lc.append(r);
    if (cmpId === b.id) lc.append(compareView(b));
  });
  root.append(lc);
}
function compareView(b) {
  const d = diffSnap(b), w = el('div', 'cmpbox');
  const late = d.moved.filter(m => m.de > 0).length, early = d.moved.filter(m => m.de < 0).length, avg = d.moved.length ? Math.round(d.moved.reduce((s, m) => s + m.de, 0) / d.moved.length * 10) / 10 : 0;
  const sm = el('div', 'summary'); [[d.moved.length, 'moved'], [late, 'end later'], [early, 'end earlier'], [d.added.length, 'added'], [d.removed.length, 'removed'], [d.status.length, 'status changed']].forEach(p => { const x = el('div'); x.append(el('b', '', String(p[0])), document.createTextNode(' '), el('span', '', p[1])); sm.append(x); });
  w.append(sm);
  if (d.moved.length) w.append(el('div', 'hint', 'Average end-date shift: ' + (avg > 0 ? '+' : '') + avg + ' days'));
  const sec = (title, rows) => { if (!rows.length) return; const s = el('div', 'cmpsec'); s.append(el('h3', '', title + ' (' + rows.length + ')')); rows.forEach(r => s.append(el('div', 'cmprow', r))); w.append(s); };
  const sh = n => (n > 0 ? '+' : '') + n + 'd';
  sec('Moved', d.moved.sort((a, b2) => Math.abs(b2.de) - Math.abs(a.de)).map(m => m.it.t + ': was ' + dlabel(m.o.d0) + ' to ' + dlabel(m.o.d1) + ', now ' + dlabel(m.it.d0) + ' to ' + dlabel(m.it.d1) + ' (start ' + sh(m.ds) + ', end ' + sh(m.de) + ')'));
  sec('Added since', d.added.map(i => i.t + ' · ' + dlabel(i.d0) + ' to ' + dlabel(i.d1)));
  sec('Removed since', d.removed.map(i => i.t + ' · was ' + dlabel(i.d0) + ' to ' + dlabel(i.d1)));
  sec('Status changed', d.status.map(m => m.it.t + ': ' + STATUS[m.o.st] + ' → ' + STATUS[m.it.st]));
  sec('Owners changed', d.owners.map(m => m.it.t + ': ' + ((m.o.res || []).join(', ') || 'nobody') + ' → ' + (m.it.res.join(', ') || 'nobody')));
  if (!d.moved.length && !d.added.length && !d.removed.length && !d.status.length && !d.owners.length) w.append(el('div', 'hint', 'Nothing has changed since this snapshot.'));
  return w;
}

