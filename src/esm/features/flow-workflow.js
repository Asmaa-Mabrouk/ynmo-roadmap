/**
 * @module features/flow-workflow
 * Ynmo Flow: the workflow designer (Settings > Workflow). Statuses (name, colour, category, order), which moves are allowed, and which statuses ask for a reason.
 * Only people with the Delete level on the Ynmo Flow module can change it; everyone else sees it read-only. Saved as `flow_cfg/main`.
 * `c` = {rows, canEdit, save(cfg), toast(text)}.
 */
import { el } from '../core/model.js';
import { selOf } from '../core/shared.js';
import { CATS, STATUSES, canMove, workflowProblem } from './flow-model.js';

/** Current effective setting as a plain object to edit. */
export function currentWorkflow() {
  const sts = STATUSES.map(s => Object.assign({}, s)); const tr = {};
  sts.forEach(a => { const any = sts.every(b => canMove(a.id, b.id)); tr[a.id] = any ? sts.map(b => b.id) : sts.filter(b => canMove(a.id, b.id)).map(b => b.id); });
  return { sts: sts, tr: tr, reason: [] };
}

export function workflowView(host, c, needsReasonNow) {
  const wf = currentWorkflow(); wf.reason = STATUSES.filter(s => needsReasonNow(s.id)).map(s => s.id);
  let anyMove = sts0AllowAll(wf);
  const used = id => c.rows.filter(i => i.st === id).length, ro = !c.canEdit;
  const box = el('div', 'fwf'); host.append(box);
  const msg = el('p', 'rerr'); msg.id = 'wf-err'; msg.hidden = true; msg.setAttribute('role', 'alert');
  function draw() {
    box.textContent = '';
    box.append(el('p', 'sub', ro ? 'Only people with the Delete level on Ynmo Flow can change the workflow. You can read it here.' : 'Rename, recolour and reorder the statuses, choose which moves are allowed, and which statuses ask for a reason. Press Save to apply.'));
    const t = el('table', 'tbl fwft'), th = el('thead'), hr = el('tr'); ['', 'Status', 'Category', 'Ask for a reason', 'Tickets', ''].forEach(x => hr.append(el('th', '', x))); th.append(hr); t.append(th);
    const tb = el('tbody');
    wf.sts.forEach((s, n) => {
      const r = el('tr'); r.dataset.id = s.id;
      const col = el('input'); col.type = 'color'; col.value = /^#[0-9a-f]{6}$/i.test(s.c) ? s.c : '#8b93a7'; col.disabled = ro; col.setAttribute('aria-label', 'Colour of ' + s.n); col.addEventListener('input', () => { s.c = col.value; });
      const nm = el('input'); nm.type = 'text'; nm.value = s.n; nm.disabled = ro; nm.className = 'wf-name'; nm.setAttribute('aria-label', 'Status name'); nm.addEventListener('input', () => { s.n = nm.value; });
      const cat = selOf(CATS.map(x => [x.id, x.n]), s.cat); cat.disabled = ro; cat.setAttribute('aria-label', 'Category of ' + s.n); cat.addEventListener('change', () => { s.cat = cat.value; });
      const rs = el('input'); rs.type = 'checkbox'; rs.checked = wf.reason.includes(s.id); rs.disabled = ro; rs.setAttribute('aria-label', 'Ask for a reason on ' + s.n); rs.addEventListener('change', () => { wf.reason = rs.checked ? [...wf.reason, s.id] : wf.reason.filter(x => x !== s.id); });
      const mv = el('td', 'wf-mv'); [['↑', -1, 'Move up'], ['↓', 1, 'Move down']].forEach(([g, d, lab]) => { const b = el('button', 'iconbtn', g); b.type = 'button'; b.title = lab; b.setAttribute('aria-label', lab + ' ' + s.n); b.disabled = ro || n + d < 0 || n + d >= wf.sts.length; b.addEventListener('click', () => { [wf.sts[n], wf.sts[n + d]] = [wf.sts[n + d], wf.sts[n]]; draw(); }); mv.append(b); });
      const del = el('button', 'btn', 'Remove'); del.type = 'button'; del.disabled = ro || used(s.id) > 0 || wf.sts.length < 2; del.title = used(s.id) ? 'Move its tickets to another status first' : ''; del.addEventListener('click', () => { wf.sts.splice(n, 1); delete wf.tr[s.id]; Object.keys(wf.tr).forEach(k => { wf.tr[k] = wf.tr[k].filter(x => x !== s.id); }); wf.reason = wf.reason.filter(x => x !== s.id); draw(); });
      const c1 = el('td'), c2 = el('td'), c3 = el('td'), c4 = el('td', '', String(used(s.id))), c5 = el('td'), c6 = el('td', 'wf-rs');
      c1.append(col); c2.append(nm); c3.append(cat); c6.append(rs); c5.append(del);
      r.append(c1, c2, c3, c6, c4, mv, c5); tb.append(r);
    });
    t.append(tb); box.append(t);
    if (!ro) { const add = el('button', 'btn', 'Add a status'); add.type = 'button'; add.id = 'wf-add'; add.addEventListener('click', () => { let id = 's-' + (wf.sts.length + 1), k = 2; while (wf.sts.some(x => x.id === id)) id = 's-' + (wf.sts.length + k++); wf.sts.push({ id: id, n: 'New status', c: '#3b6fd4', cat: 'progress' }); wf.sts.forEach(a => { if (anyMove) wf.tr[a.id] = wf.sts.map(b => b.id); else if (!wf.tr[a.id]) wf.tr[a.id] = []; }); wf.tr[id] = wf.sts.map(b => b.id); draw(); box.querySelector('tr[data-id="' + id + '"] .wf-name').select(); }); box.append(add); }
    // moves
    const h = el('h3', '', 'Allowed moves'); h.style.margin = '18px 0 6px'; box.append(h);
    const any = el('label', 'wf-any'), ac = el('input'); ac.type = 'checkbox'; ac.id = 'wf-any'; ac.checked = anyMove; ac.disabled = ro; any.append(ac, document.createTextNode(' Any status can move to any status (no rules)'));
    ac.addEventListener('change', () => { anyMove = ac.checked; if (anyMove) wf.sts.forEach(a => { wf.tr[a.id] = wf.sts.map(b => b.id); }); draw(); });
    box.append(any);
    if (!anyMove) {
      const m = el('table', 'tbl fwfm'), mh = el('thead'), mr = el('tr'); mr.append(el('th', '', 'From \\ To')); wf.sts.forEach(s => mr.append(el('th', '', s.n))); mh.append(mr); m.append(mh);
      const mb = el('tbody');
      wf.sts.forEach(a => { const r = el('tr'); r.append(el('th', '', a.n)); wf.sts.forEach(b => { const td = el('td'); if (a.id === b.id) td.append(el('span', 'sub', '·')); else { const k = el('input'); k.type = 'checkbox'; k.checked = (wf.tr[a.id] || []).includes(b.id); k.disabled = ro; k.dataset.from = a.id; k.dataset.to = b.id; k.setAttribute('aria-label', a.n + ' to ' + b.n); k.addEventListener('change', () => { wf.tr[a.id] = k.checked ? [...(wf.tr[a.id] || []), b.id] : (wf.tr[a.id] || []).filter(x => x !== b.id); }); td.append(k); } r.append(td); }); mb.append(r); });
      m.append(mb); const w = el('div', 'ftblwrap'); w.append(m); box.append(w);
    }
    if (!ro) {
      const row = el('div', 'row fbtns'); const sv = el('button', 'btn primary', 'Save workflow'); sv.type = 'button'; sv.id = 'wf-save'; const rs = el('button', 'btn', 'Back to the default'); rs.type = 'button'; rs.id = 'wf-reset';
      sv.addEventListener('click', () => {
        const cfg = { sts: wf.sts.map(s => ({ id: s.id, n: s.n.trim(), c: s.c, cat: s.cat })), tr: anyMove ? null : Object.fromEntries(Object.keys(wf.tr).map(k => [k, wf.tr[k].filter(x => x !== k)])), reason: wf.reason };
        const p = workflowProblem(cfg); if (p) { msg.textContent = p; msg.hidden = false; return; }
        c.save(cfg);
      });
      rs.addEventListener('click', () => { c.save(null); });
      row.append(rs, sv); box.append(msg, row);
    }
  }
  draw();
}
const sts0AllowAll = wf => wf.sts.every(a => wf.sts.every(b => (wf.tr[a.id] || []).includes(b.id)));
