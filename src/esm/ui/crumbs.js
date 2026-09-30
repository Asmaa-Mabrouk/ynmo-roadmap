/**
 * @module ui/crumbs
 * Breadcrumb: `Sprints › Sprint 2`. The same trail is shown whether the page was opened in this tab or a new one.
 * The last item is the current page (not a link). Depends on the DOM only.
 */
import { el } from '../core/model.js';

/** @param {Array<{label:string, href?:string}>} trail the last item is the current page */
export function crumbs(trail) {
  const nav = el('nav', 'crumbs'); nav.setAttribute('aria-label', 'Breadcrumb'); const ol = el('ol');
  trail.forEach((c, i) => {
    const li = el('li'), last = i === trail.length - 1;
    if (last || !c.href) { const s = el('span', '', c.label); if (last) s.setAttribute('aria-current', 'page'); li.append(s); }
    else { const a = el('a', '', c.label); a.href = c.href; li.append(a); }
    ol.append(li);
  });
  nav.append(ol); return nav;
}
