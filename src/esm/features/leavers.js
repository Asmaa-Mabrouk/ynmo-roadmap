/**
 * @module features/leavers
 * People who left or are leaving the company. The last working day lives in the Dashboard settings (`ideas/capacity` > `leaving`: {name: 'YYYY-MM-DD'}),
 * the same place the Dashboard already uses to stop counting their capacity. Here: which roadmap features of theirs run after that day
 * (they need a new owner), and renaming or merging a person inside the Dashboard data (settings and the people on the cards).
 */
import { S } from '../core/state.js';
import { items, rangeOf } from '../core/model.js';
import { kOfIso } from '../core/shared.js';
import { write } from '../core/saving.js';
import { saveIdea } from '../pages/ideas.js';
import { keepVersion } from '../pages/monthly-history.js';

export const leavingMap = () => (S.ideas.capacity && S.ideas.capacity.leaving) || {};
/** Does this feature, for this owner, run after the owner's last working day? */
export function afterLast(it, name) {
  const last = leavingMap()[name]; if (!last || !it || !(it.res || []).includes(name)) return false;
  const k = kOfIso(last); return !isNaN(k) && rangeOf(it, name)[1] > k;
}
/** Features of `name` on every roadmap that end after the last working day: [{rm, rmName, id, t}]. eachRm = allRoadmaps, withRm (passed in to avoid an import cycle). */
export function leaverWork(name, allRoadmaps, withRm) {
  const out = []; if (!leavingMap()[name]) return out;
  allRoadmaps().forEach(rm => withRm(rm.id, () => items().forEach(it => { if (afterLast(it, name)) out.push({ rm: rm.id, rmName: rm.n, id: it.id, t: it.t }); })));
  return out;
}
/** Sets or clears (date '') the last working day of a person. */
export function setLeaving(name, date, act, sum) {
  const lv = Object.assign({}, leavingMap()); if (date) lv[name] = date; else delete lv[name];
  saveIdea('capacity', { cfg: true, leaving: lv }, act, sum);
}
/** A person is renamed (or merged into `nw`): the Dashboard settings and the people on the cards follow. Returns how many documents changed. */
export function renameInDashboard(old, nw) {
  let n = 0; const c = S.ideas.capacity;
  if (c) {
    const patch = {};
    if (Array.isArray(c.lanes)) { const ls = c.lanes.map(l => Object.assign({}, l, { people: [...new Set((l.people || []).map(x => (x === old ? nw : x)))] })); if (JSON.stringify(ls) !== JSON.stringify(c.lanes)) patch.lanes = ls; }
    if (c.leaving && c.leaving[old]) { const lv = Object.assign({}, c.leaving); if (!lv[nw]) lv[nw] = lv[old]; delete lv[old]; patch.leaving = lv; }
    if (Object.keys(patch).length) { saveIdea('capacity', patch); n++; }
  }
  Object.keys(S.reports || {}).filter(k => /^mo\d{6}$/.test(k)).forEach(k => {
    const d = S.reports[k]; if (!d || !Array.isArray(d.lines)) return; let changed = false;
    const lines = d.lines.map(l => {
      if (!l || !l.who) return l; let w = null;
      Object.keys(l.who).forEach(t => { const m = l.who[t]; if (m && typeof m === 'object' && old in m) { w = w || JSON.parse(JSON.stringify(l.who)); w[t][nw] = (w[t][nw] || 0) + (+w[t][old] || 0); delete w[t][old]; } });
      if (!w) return l; changed = true; return Object.assign({}, l, { who: w });
    });
    if (changed) { try { keepVersion(d.mo, d, true, 'Before renaming ' + old, ''); } catch (e) { /* history is best effort */ } S.reports[k] = Object.assign({}, d, { lines: lines, ts: Date.now() }); write('reports/' + k, S.reports[k]); n++; }
  });
  return n;
}
