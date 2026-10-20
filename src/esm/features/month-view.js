/**
 * @module features/month-view
 * DOM for a month of deliverables: the full sheet (read-only for executives, editable for editors) and the compact read-only summary shown inside a weekly report.
 * The data rules are in month-model.js; saving and undo are done by pages/monthly.js through `ctx`.
 */
import { el } from '../core/model.js';
import { fmtIso, todayIso } from '../core/shared.js';
import { WEIGHTS, adhocStats, clampPct, monthLabel, monthProgress, pctBand } from './month-model.js';

const bar = (pct, big, label) => { const b = el('div', 'mbar pc-' + pctBand(pct) + (big ? ' big' : '')), f = el('i'); f.style.width = pct + '%'; b.append(f); b.setAttribute('role', 'progressbar'); b.setAttribute('aria-valuemin', '0'); b.setAttribute('aria-valuemax', '100'); b.setAttribute('aria-valuenow', String(pct)); b.setAttribute('aria-label', label); return b; };
const sub = (prog, ad) => 'complete · ' + prog.done + ' of ' + prog.n + ' deliverables done' + (ad.n ? ' · ' + ad.n + ' ad hoc request' + (ad.n === 1 ? '' : 's') + ' (' + ad.done + ' done)' : '');
function overallBar(doc) {
  const prog = monthProgress(doc.lines), ad = adhocStats(doc.lines); if (prog.pct === null) return null;
  const o = el('div', 'rmall'); o.append(bar(prog.pct, true, 'Month progress'), el('b', 'rmpct pc-' + pctBand(prog.pct), prog.pct + '%'), el('span', 'rmsub', sub(prog, ad))); return o;
}
function lineRow(it, ctx) {
  const r = el('div', 'mrow' + (it.adhoc ? ' adhoc' : '')); r.dataset.id = it.id; const pct = clampPct(it.pct);
  const est = it.src && !it.pe ? el('span', 'mest', 'estimated') : null; if (est) est.title = 'Estimated from the roadmap dates. Change the percentage to set your own.';
  if (ctx.ro) {
    r.append(el('span', 'mt', it.t));
    if (it.adhoc && (it.by || it.at)) r.append(el('span', 'mby', 'requested' + (it.by ? ' by ' + it.by : '') + (it.at ? ' on ' + fmtIso(it.at) : '')));
    if (it.w === 3) r.append(el('span', 'chip mcrit', 'Critical'));
    r.append(bar(pct, false, 'Completion of ' + it.t), el('b', 'mpv pc-' + pctBand(pct), pct + '%')); return r;
  }
  const t = el('input', 'mt'); t.type = 'text'; t.value = it.t; t.maxLength = 300; t.setAttribute('aria-label', it.adhoc ? 'Ad hoc request' : 'Deliverable');
  t.addEventListener('change', () => { const v = t.value.replace(/\s+/g, ' ').trim(); if (!v) { t.value = it.t; return; } if (v !== it.t) ctx.put(it, { t: v }, 'Rename deliverable'); });
  r.append(t);
  if (it.adhoc) { const by = el('input', 'mbyin'); by.type = 'text'; by.value = it.by || ''; by.maxLength = 80; by.placeholder = 'Requested by'; by.setAttribute('aria-label', 'Requested by'); by.addEventListener('change', () => ctx.put(it, { by: by.value.replace(/\s+/g, ' ').trim() }, 'Change requester', true)); r.append(by); }
  const pi = el('input', 'mpin'); pi.type = 'number'; pi.min = 0; pi.max = 100; pi.step = 5; pi.value = pct; pi.setAttribute('aria-label', 'Percent complete');
  pi.classList.add('pc-' + pctBand(pct)); pi.addEventListener('change', () => ctx.put(it, { pct: clampPct(pi.value), pe: true }, 'Change completion'));
  const full = el('button', 'btn sm', pct >= 100 ? '✓ Done' : '100%'); full.type = 'button'; full.title = 'Mark as complete'; full.disabled = pct >= 100;
  full.addEventListener('click', () => ctx.put(it, { pct: 100, pe: true }, 'Mark deliverable complete'));
  r.append(bar(pct, false, 'Completion of ' + it.t), pi, full); if (est) r.append(est);
  if (!it.adhoc) {
    const w = el('select', 'spsel'); w.setAttribute('aria-label', 'Importance'); Object.keys(WEIGHTS).forEach(k => { const o = el('option', '', WEIGHTS[k]); o.value = k; o.selected = Number(k) === (it.w || 1); w.append(o); });
    w.addEventListener('change', () => ctx.put(it, { w: Number(w.value) }, 'Change importance')); r.append(w);
  }
  const x = el('button', 'btn sm danger', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Remove'); x.addEventListener('click', () => ctx.remove(it)); r.append(x); return r;
}
function addForm(p, ctx, adhoc) {
  const f = el('form', 'spadd madd'), ti = el('input'), go = el('button', 'btn sm', adhoc ? 'Add request' : 'Add deliverable'); ti.type = 'text'; ti.maxLength = 300; go.type = 'submit'; f.append(ti);
  ti.placeholder = adhoc ? 'Add an ad hoc request for ' + p.n : 'Add a deliverable for ' + p.n; ti.setAttribute('aria-label', ti.placeholder);
  let by = null; if (adhoc) { by = el('input'); by.type = 'text'; by.maxLength = 80; by.placeholder = 'Requested by'; by.setAttribute('aria-label', 'Requested by for the new request'); f.append(by); }
  f.append(go);
  f.addEventListener('submit', e => { e.preventDefault(); const v = ti.value.trim(); if (!v) { ti.focus(); return; } ctx.add(p.k, v, adhoc ? { adhoc: true, by: by.value, at: todayIso() } : {}); });
  return f;
}
/** The whole month as a document. ctx = { ro, colOf(p), put(line, patch, label), remove(line), add(k, text, opts) }. */
export function monthSheet(doc, pls, ctx) {
  const body = el('div', 'rbody sdoc mbody'), hero = el('div', 'rhero mhero');
  hero.append(el('small', '', 'Ynmo · Monthly deliverables'), el('h2', 'rtitle', monthLabel(doc.mo))); body.append(hero);
  const ov = overallBar(doc); if (ov) body.append(ov); else if (ctx.ro) body.append(el('p', 'empty', 'No deliverables were listed for this month.'));
  pls.forEach(p => {
    const its = doc.lines.filter(i => i.k === p.k), pl = its.filter(i => !i.adhoc), adh = its.filter(i => i.adhoc);
    if (ctx.ro && !its.length) return;
    const blk = el('section', 'rmp'); blk.dataset.k = p.k; blk.style.setProperty('--c', ctx.colOf(p));
    const pp = monthProgress(pl), ph = el('div', 'rmph'); ph.append(el('h3', '', p.n)); if (pp.pct !== null) ph.append(el('span', 'rmpp pc-' + pctBand(pp.pct), pp.pct + '%')); blk.append(ph);
    if (pp.pct !== null) blk.append(bar(pp.pct, false, p.n + ' progress'));
    pl.forEach(i => blk.append(lineRow(i, ctx)));
    if (!ctx.ro) blk.append(addForm(p, ctx, false));
    if (adh.length || !ctx.ro) { blk.append(el('h4', 'rmadh', 'Ad hoc requests')); adh.forEach(i => blk.append(lineRow(i, ctx))); if (!ctx.ro) blk.append(addForm(p, ctx, true)); }
    body.append(blk);
  });
  return body;
}
/** Compact read-only month block inside a weekly report; null when there is nothing to show (no month, empty, or not yet submitted for an executive). */
export function monthSummary(doc, pls, colOf, viewer) {
  if (!doc || !(doc.lines || []).some(l => String(l.t || '').trim()) || (viewer && doc.status !== 'submitted')) return null;
  const sec = el('section', 'rmonth'), hd = el('div', 'rmhead'), a = el('a', 'rmopen', 'Open the month'); a.href = '#/monthly/' + doc.mo;
  hd.append(el('h2', '', 'Monthly deliverables'), el('span', 'rmmonth', monthLabel(doc.mo)), a); sec.append(hd);
  const ov = overallBar(doc); if (ov) sec.append(ov);
  pls.forEach(p => { const pl = doc.lines.filter(i => i.k === p.k && !i.adhoc && String(i.t || '').trim()), pp = monthProgress(pl); if (pp.pct === null) return; const r = el('div', 'rmsum'); r.style.setProperty('--c', colOf(p)); r.append(el('b', '', p.n), bar(pp.pct, false, p.n + ' progress'), el('span', 'rmpp pc-' + pctBand(pp.pct), pp.pct + '%')); sec.append(r); });
  return sec;
}
