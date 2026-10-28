/**
 * @module features/tracks
 * Which Dashboard tracks (AI, Frontend, Mobile, Backend, Design, Quality) a person is planned in, so that a new resource shows up in Monthly's
 * "Points and people" and in the Dashboard. Stored in the Dashboard settings (`ideas/capacity` > `lanes`). A person whose Resources domain is a
 * track's domain is offered that track when added (Resources > Add member), and any person's tracks can be changed in Resources > Manage.
 */
import { S } from '../core/state.js';
import { resolveDefaults, settings } from './capacity.js';
import { saveIdea } from '../pages/ideas.js';

const fold = s => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
/** The tracks `name` is in now: ['be', ...] */
export function tracksOf(name, resources) {
  const st = settings(resolveDefaults((S.ideas && S.ideas.capacity) || {}, resources));
  return st.lanes.filter(l => l.people.some(n => fold(n) === fold(name))).map(l => l.k);
}
/** Puts `name` in exactly the tracks `ks` and saves it. */
export function setTracks(name, ks, resources, act, sum) {
  const cur = (S.ideas && S.ideas.capacity) || {}, st = settings(resolveDefaults(cur, resources));
  const lanes = st.lanes.map(l => ({ k: l.k, people: l.people.filter(n => fold(n) !== fold(name)).concat(ks.includes(l.k) ? [name] : []) }));
  saveIdea('capacity', { cfg: true, lanes: lanes }, act || 'resource', sum || ('set the Dashboard tracks of ' + name));
}
