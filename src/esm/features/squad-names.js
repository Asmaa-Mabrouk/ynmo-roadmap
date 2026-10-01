/**
 * @module features/squad-names
 * Editable squad names. The squads keep their keys (tifli, ai, plan, daycare) and colours; only the label can be changed.
 * Saved in the meta doc `ideas/squadnames` ({cfg:true, names:{key:name}}) and applied to the shared `LANES` list, so every page shows the new name.
 */
import { S } from '../core/state.js';
import { LANES } from '../core/model.js';

const original = LANES.map(l => [l.k, l.n]);
export const defaultSquadName = k => (original.find(o => o[0] === k) || [])[1] || k;
export const squadNames = () => (S.ideas.squadnames && S.ideas.squadnames.names) || {};
/** Copy the saved names onto LANES (call after the ideas data loads or changes). */
export function applySquadNames() {
  const m = squadNames();
  LANES.forEach(l => { const v = m[l.k] && String(m[l.k]).trim(); l.n = v || defaultSquadName(l.k); });
}
