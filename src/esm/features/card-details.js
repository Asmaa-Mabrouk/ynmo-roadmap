/**
 * @module features/card-details
 * Facts shown on the details card of a Monthly card (pure, no DOM): in which sprints it is planned, and the words for it.
 * A sprint item with `fid` = the card id always counts; an item with no link counts only when it is a feature of a sprint that overlaps the
 * card's month and has (nearly) the same title ("matched by words", flagged `auto`).
 */
import { sameTitle } from './sprint-percent.js';
import { monthRange } from './month-model.js';

/** @returns {Array<{id, n, a, b, auto}>} sprints of the card, oldest number first */
export function sprintsOf(card, mo, sprints, itemsOf) {
  const r = mo && mo !== 'backlog' ? monthRange(mo) : null, out = [];
  (sprints || []).forEach(sp => {
    const its = itemsOf(sp.id) || [];
    if (its.some(i => i.fid && i.fid === card.id)) { out.push({ id: sp.id, n: sp.n, a: sp.a, b: sp.b, auto: false }); return; }
    if (r && sp.a <= r.b && sp.b >= r.a && its.some(i => !i.fid && i.kind === 'feature' && sameTitle(i.t, card.t))) out.push({ id: sp.id, n: sp.n, a: sp.a, b: sp.b, auto: true });
  });
  return out.sort((x, y) => x.n - y.n);
}
/** "Planned in Sprint 229", "Planned in Sprints 229 and 230", "Planned in Sprints 229, 230 and 231", or '' when none. */
export function sprintWords(list) {
  const ns = (list || []).map(s => s.n); if (!ns.length) return '';
  if (ns.length === 1) return 'Planned in Sprint ' + ns[0];
  return 'Planned in Sprints ' + ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1];
}
