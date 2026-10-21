/**
 * @module features/report-print
 * The printed / PDF version of a weekly report: a clean, read-only document built from the report data (not from the editing screen), so it
 * always looks the same: header, overall progress, a card per product, then every product's items with a progress bar, an out-of-scope tag and the note.
 * Shown only while printing (CSS `body.print-pro`).
 */
import { el } from '../core/model.js';
import { avgPct, linePct } from './report-model.js';
import { pctBand } from './month-model.js';

const bar = pct => { const b = el('span', 'pr-bar pc-' + pctBand(pct)), f = el('i'); f.style.width = pct + '%'; b.append(f); return b; };
export function buildPrint(rep, pls, o) {
  const root = el('div', 'rprint'), range = o.fmt(rep.a) + ' – ' + o.fmt(rep.b);
  const items = p => ((rep.prods || {})[p.k] || { items: [] }).items.filter(l => !l.hide && String(l.t || '').trim());
  const all = pls.reduce((a, p) => a.concat(items(p)), []), ov = avgPct(all) || 0, done = all.filter(l => linePct(l) >= 100).length, scope = all.filter(l => l.fl).length;
  const head = el('header', 'pr-head'), left = el('div'), right = el('div', 'pr-meta');
  left.append(el('div', 'pr-brand', 'YNMO'), el('div', 'pr-kind', 'Weekly product update'), el('h1', '', range), el('div', 'pr-label', rep.label !== undefined ? rep.label : 'Sprint ' + rep.n + ' · week ' + (rep.w || 1) + ' of 2'));
  right.append(el('div', '', 'Prepared by ' + (rep.by || '—')), el('div', '', 'Printed ' + o.today));
  head.append(left, right); root.append(head);
  const sum = el('section', 'pr-sum'), big = el('div', 'pr-big pc-' + pctBand(ov));
  big.append(el('b', '', ov + '%'), el('span', '', 'overall progress'), bar(ov), el('small', '', done + ' of ' + all.length + ' item' + (all.length === 1 ? '' : 's') + ' complete' + (scope ? ' · ' + scope + ' out of scope' : '')));
  const cards = el('div', 'pr-cards');
  pls.forEach(p => { const its = items(p), ap = avgPct(its) || 0, c = el('div', 'pr-card pc-' + pctBand(ap)); c.style.setProperty('--c', o.colOf(p)); c.append(el('b', '', p.n), el('span', 'pr-pct', ap + '%'), bar(ap), el('small', '', its.length + ' item' + (its.length === 1 ? '' : 's'))); cards.append(c); });
  sum.append(big, cards); root.append(sum);
  pls.forEach(p => {
    const its = items(p); if (!its.length) return;
    const sec = el('section', 'pr-prod'), ap = avgPct(its) || 0, h = el('div', 'pr-ph'); sec.style.setProperty('--c', o.colOf(p));
    h.append(el('h2', '', p.n), el('span', 'pr-chip pc-' + pctBand(ap), ap + '%')); sec.append(h);
    its.forEach(l => {
      const v = linePct(l), r = el('div', 'pr-item'), body = el('div', 'pr-body'), t = el('div', 'pr-text', l.t);
      if (l.fl) t.append(el('span', 'pr-flag', 'Out of scope'));
      if (l.jira) t.append(el('span', 'pr-jira', l.jira));
      body.append(t); if (l.note) body.append(el('div', 'pr-note', l.note));
      const pc = el('div', 'pr-prog pc-' + pctBand(v)); pc.append(bar(v), el('b', '', v + '%'));
      r.append(body, pc); sec.append(r);
    });
    root.append(sec);
  });
  if (!all.length) root.append(el('p', 'pr-empty', 'No items in this report yet.'));
  return root;
}
