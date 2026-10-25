/**
 * @module features/month-view
 * The progress block shown at the top of a weekly report (overall and per product, from the items written below it).
 */
import { el } from '../core/model.js';
import { avgPct, linePct } from './report-model.js';
import { pctBand } from './month-model.js';

const bar = (pct, big, label) => { const b = el('div', 'mbar pc-' + pctBand(pct) + (big ? ' big' : '')), f = el('i'); f.style.width = pct + '%'; b.append(f); b.setAttribute('role', 'progressbar'); b.setAttribute('aria-valuemin', '0'); b.setAttribute('aria-valuemax', '100'); b.setAttribute('aria-valuenow', String(pct)); b.setAttribute('aria-label', label); return b; };
/**
 * Progress block of a weekly report, calculated from the items written below it: the overall percentage is the average of all items
 * and each product's bar is the average of its items (0% until items are added). `prods` = report.prods, `pls` = report products.
 */
export function progressBlock(title, subText, pls, prods, colOf) {
  const sec = el('section', 'rmonth rprog'), hd = el('div', 'rmhead'); hd.append(el('h2', '', title)); if (subText) hd.append(el('span', 'rmmonth', subText)); sec.append(hd);
  const itemsOf = p => ((prods[p.k] || {}).items || []).filter(l => !l.hide && String(l.t || '').trim());
  const all = pls.reduce((a, p) => a.concat(itemsOf(p)), []), ov = avgPct(all) || 0, done = all.filter(l => linePct(l) >= 100).length;
  const o = el('div', 'rmall'); o.append(bar(ov, true, 'Overall progress'), el('b', 'rmpct pc-' + pctBand(ov), ov + '%'), el('span', 'rmsub', 'complete · ' + done + ' of ' + all.length + ' item' + (all.length === 1 ? '' : 's') + ' done')); sec.append(o);
  pls.forEach(p => { const its = itemsOf(p), pp = avgPct(its) || 0, r = el('div', 'rmsum'); r.dataset.k = p.k; r.style.setProperty('--c', colOf(p)); r.append(el('b', '', p.n), bar(pp, false, p.n + ' progress'), el('span', 'rmpp pc-' + pctBand(pp), pp + '%')); sec.append(r); });
  return sec;
}
