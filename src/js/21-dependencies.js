/**
 * @module dependencies
 * Milestones, dependencies and overlay.
 * Finish-to-start dependencies between bars with conflict detection (depIssues), milestone toggle, and the SVG overlay that draws arrows and ghost baseline bars.
 * NOTE: all src/js files share one global scope (concatenated by build.mjs).
 */
/* ---------- 3. milestones and dependencies ---------- */
function depsOf(it) { return Array.isArray(it.dep) ? it.dep : []; }
function dependents(id, all) { const out = new Set(), walk = x => all.forEach(i => { if (depsOf(i).includes(x) && !out.has(i.id)) { out.add(i.id); walk(i.id); } }); walk(id); return out; }
function depIssues(all) {
  const byId = new Map(all.map(i => [i.id, i])), out = [];
  all.forEach(s => depsOf(s).forEach(pid => {
    const p = byId.get(pid); if (!p) return;
    const gap = s.d0 - p.d1 - 1;
    out.push({ from: p, to: s, gap: gap, bad: s.d0 <= p.d1 });
  }));
  return out;
}
function openDeps(it) {
  const all = items(), block = dependents(it.id, all), cur = new Set(depsOf(it));
  const cands = all.filter(i => i.id !== it.id && !block.has(i.id)).sort((a, b) => a.d0 - b.d0 || a.t.localeCompare(b.t));
  openDlg('Depends on… ' + it.t, box => {
    box.append(el('p', 'hint', 'This bar should start after the ones you tick have finished. An arrow is drawn, and it turns red if the dates clash.'));
    const q = el('input'); q.type = 'search'; q.placeholder = 'Search features'; q.setAttribute('aria-label', 'Search features'); q.style.width = '100%'; box.append(q);
    const list = el('div', 'deplist'); box.append(list);
    const draw = () => {
      list.textContent = ''; const t = q.value.trim().toLowerCase();
      cands.filter(i => !t || i.t.toLowerCase().includes(t) || i.res.join(' ').toLowerCase().includes(t) || cur.has(i.id)).forEach(i => {
        const l = el('label', 'deprow'), c = el('input'); c.type = 'checkbox'; c.checked = cur.has(i.id);
        c.addEventListener('change', () => { if (c.checked) cur.add(i.id); else cur.delete(i.id); });
        l.append(c, el('span', '', (i.ms ? '◆ ' : '') + i.t), el('small', '', dlabel(i.d0) + (i.ms ? '' : ' to ' + dlabel(i.d1)) + (i.res.length ? ' · ' + i.res.join(', ') : '')));
        list.append(l);
      });
      if (!list.children.length) list.append(el('div', 'hint', 'Nothing matches.'));
    };
    q.addEventListener('input', draw); draw();
    const save = el('button', 'btn primary', 'Save'); save.type = 'button';
    const cancel = el('button', 'btn', 'Cancel'); cancel.type = 'button'; cancel.addEventListener('click', closeDlg);
    save.addEventListener('click', () => { closeDlg(); const next = [...cur]; if (JSON.stringify(next.sort()) !== JSON.stringify(depsOf(it).slice().sort())) commit(it.id, { dep: next }); });
    const row = el('div', 'formrow'); row.append(save, cancel); box.append(row);
  });
}
function toggleMilestone(it) { if (it.ms) commit(it.id, { ms: false }); else commit(it.id, { ms: true, d1: it.d0 }); }

let ghostOn = false;
try { ghostOn = localStorage.getItem('ynmo-ghost') === '1'; } catch (e) { /* storage unavailable */ }
function activeBaseline() {
  const l = Object.keys(baselines).map(id => Object.assign({ id: id }, baselines[id])).filter(b => b.rm === state.rm);
  return l.find(b => b.active) || null;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs) { const n = document.createElementNS(SVGNS, tag); Object.keys(attrs || {}).forEach(k => n.setAttribute(k, attrs[k])); return n; }
function drawOverlay() {
  const g = $('grid'); if (!g) return;
  const old = g.querySelector('svg.ovl'); if (old) old.remove();
  const all = items(), issues = depIssues(all), base = ghostOn ? activeBaseline() : null;
  const sum = $('summary'); const oldc = sum && sum.querySelector('.depchip'); if (oldc) oldc.remove();
  const bad = issues.filter(x => x.bad);
  if (sum && issues.length) {
    const c = el('button', 'depchip' + (bad.length ? ' bad' : ''), bad.length ? '⛓ ' + bad.length + (bad.length === 1 ? ' dependency clash' : ' dependency clashes') : '⛓ ' + issues.length + ' dependencies, all fine'); c.type = 'button';
    c.title = bad.length ? bad.map(x => '"' + x.to.t + '" starts before "' + x.from.t + '" ends').join('\n') : 'Every dependent bar starts after its predecessor ends';
    c.addEventListener('click', () => { const x = bad[0]; if (!x) return; const b = [...g.querySelectorAll('.bar')].find(y => y.dataset.id === x.to.id); if (b) { b.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 1600); } });
    sum.append(c);
  }
  if (!issues.length && !base) return;
  const gr = g.getBoundingClientRect(), first = new Map();
  g.querySelectorAll('.bar').forEach(b => { if (!first.has(b.dataset.id)) first.set(b.dataset.id, b); });
  const svg = sv('svg', { class: 'ovl', width: g.scrollWidth, height: g.scrollHeight, 'aria-hidden': 'true' });
  const defs = sv('defs'); ['ok', 'bad'].forEach(k => { const m = sv('marker', { id: 'ar-' + k, viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '7', markerHeight: '7', orient: 'auto' }); m.append(sv('path', { d: 'M0 0 8 4 0 8z', fill: k === 'bad' ? '#c0392b' : '#55608a' })); defs.append(m); });
  svg.append(defs);
  issues.forEach(x => {
    const a = first.get(x.from.id), b = first.get(x.to.id); if (!a || !b) return;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const x1 = ra.right - gr.left - 1, y1 = ra.top + ra.height / 2 - gr.top, x2 = rb.left - gr.left, y2 = rb.top + rb.height / 2 - gr.top;
    let d;
    if (x2 >= x1 + 14) d = 'M' + x1 + ' ' + y1 + ' H' + (x1 + 7) + ' V' + y2 + ' H' + (x2 - 1);
    else { const my = y2 > y1 ? Math.max(ra.bottom, rb.top) - gr.top + 2 : Math.min(ra.top, rb.bottom) - gr.top - 2; d = 'M' + x1 + ' ' + y1 + ' H' + (x1 + 7) + ' V' + my + ' H' + (x2 - 7) + ' V' + y2 + ' H' + (x2 - 1); }
    const tip = '"' + x.from.t + '" → "' + x.to.t + '": ' + (x.bad ? (x.gap === -1 ? 'starts the same day the first ends' : 'starts ' + (-x.gap - 1) + ' day(s) before the first ends') : (x.gap === 0 ? 'starts the next day, no buffer' : x.gap + ' day(s) of buffer'));
    const p = sv('path', { d: d, fill: 'none', stroke: x.bad ? '#c0392b' : '#55608a', 'stroke-width': x.bad ? '2' : '1.5', 'marker-end': 'url(#ar-' + (x.bad ? 'bad' : 'ok') + ')', class: 'dep' + (x.bad ? ' bad' : '') });
    const t = sv('title'); t.textContent = tip; p.append(t); svg.append(p);
  });
  if (base) {
    const w0 = g.querySelector('.wk'); if (w0) {
      const wr = w0.getBoundingClientRect(), dw = wr.width, L = wr.left - gr.left;
      const bi = new Map((base.items || []).map(i => [i.id, i]));
      first.forEach((bar, id) => {
        const o = bi.get(id), it = all.find(i => i.id === id); if (!o || !it || (o.d0 === it.d0 && o.d1 === it.d1)) return;
        const r = bar.getBoundingClientRect(), y = r.bottom - gr.top - 1;
        const g1 = sv('rect', { x: L + o.d0 * dw + 1, y: y, width: Math.max(4, (o.d1 - o.d0 + 1) * dw - 2), height: 5, rx: 2.5, fill: '#e5a513', opacity: '.9', class: 'ghost' });
        const t = sv('title'); const sl = it.d1 - o.d1;
        t.textContent = 'Plan: ' + dlabel(o.d0) + (o.d1 > o.d0 ? ' to ' + dlabel(o.d1) : '') + ' · now ' + (sl === 0 ? 'starts ' + (it.d0 - o.d0 > 0 ? 'later' : 'earlier') : sl > 0 ? 'ends ' + sl + ' day(s) later' : 'ends ' + (-sl) + ' day(s) earlier'); g1.append(t); svg.append(g1);
      });
    }
  }
  g.append(svg);
}
function afterRender() {
  try { drawOverlay(); decorateLocks(); } catch (e) { /* overlay is optional */ }
  const gb = $('ghostbtn'); if (gb) { const b = activeBaseline(); gb.hidden = !b; gb.setAttribute('aria-pressed', String(ghostOn)); }
}

