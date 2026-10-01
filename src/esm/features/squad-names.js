/**
 * @module features/squad-names
 * Editable products (squads): the four built-in ones keep their keys (tifli, ai, plan, daycare) but can get another name or colour,
 * and extra products can be added. Saved in the meta doc `ideas/squadnames` = {cfg:true, names:{key:name}, colors:{key:#rrggbb}, extra:[{k,n,c}]}
 * and applied to the shared `LANES` list (in place), so every page shows them.
 */
import { S } from '../core/state.js';
import { LANES, TEAMS, state } from '../core/model.js';

const original = LANES.map(l => ({ k: l.k, n: l.n, c: l.c })), BASE = original.length;
const known = new Set(LANES.map(l => l.k)), listeners = [];
export const isBaseSquad = k => original.some(o => o.k === k);
export const defaultSquadName = k => (original.find(o => o.k === k) || {}).n || k;
export const defaultSquadColor = k => (original.find(o => o.k === k) || {}).c || '';
const doc = () => S.ideas.squadnames || {};
export const squadNames = () => doc().names || {};
export const squadColors = () => doc().colors || {};
export const extraSquads = () => (Array.isArray(doc().extra) ? doc().extra : []).filter(e => e && e.k && e.n);
const hex = c => /^#[0-9a-f]{6}$/i.test(String(c || ''));
/** Called after the lane list changed (the roadmap filter chips redraw themselves here). */
export const onLanesChanged = fn => { listeners.push(fn); };
/** Copy the saved names, colours and extra products onto LANES (call after the ideas data loads or changes). */
export function applySquadNames() {
  const nm = squadNames(), co = squadColors(), ex = extraSquads();
  LANES.length = BASE;
  ex.forEach(e => { if (!LANES.some(l => l.k === e.k)) { LANES.push({ k: e.k, n: e.n, c: hex(e.c) ? e.c : '#6b7280' }); if (!TEAMS[e.k]) TEAMS[e.k] = { pm: [], dev: [], qa: [], ux: [] }; } });
  LANES.forEach(l => {
    const e = ex.find(x => x.k === l.k), v = nm[l.k] && String(nm[l.k]).trim();
    l.n = v || (e ? e.n : defaultSquadName(l.k));
    l.c = hex(co[l.k]) ? co[l.k] : (e ? (hex(e.c) ? e.c : '#6b7280') : defaultSquadColor(l.k));
  });
  LANES.forEach(l => { if (!known.has(l.k)) { known.add(l.k); state.sq.add(l.k); } });   // a new product is visible right away
  [...state.sq].forEach(k => { if (!LANES.some(l => l.k === k)) state.sq.delete(k); });
  listeners.forEach(f => f());
}
