/**
 * @module core/permissions
 * Per-module permissions. A person has a level for each module: 0 none, 1 view, 2 edit (add and change), 3 delete (also removes things).
 * Stored in `profiles.perms` = { roadmap: 3, monthly: 2, ... }. Without `perms` the older `access` field decides: editor = everything,
 * viewer = view the Roadmap, Reports, Monthly and Log. An admin always has everything, plus Approvals and Permissions.
 * Pure functions (no DOM) so they can be tested with plain Node.
 */
export const MODULES = [
  { k: 'roadmap', n: 'Roadmap', d: 'Features and bars on the timeline, days off, timeline notes', max: 3 },
  { k: 'roadmaps', n: 'Roadmaps', d: 'Create and change roadmaps (quarters, half years)', max: 3 },
  { k: 'sprints', n: 'Sprints', d: 'Sprint planning and the sprint page', max: 3 },
  { k: 'reports', n: 'Reports', d: 'Weekly executive reports', max: 3 },
  { k: 'monthly', n: 'Monthly deliverables', d: 'The monthly board and the backlog', max: 3 },
  { k: 'resources', n: 'Resources', d: 'Team members and products', max: 3 },
  { k: 'vacations', n: 'Vacations', d: 'Leave of the team', max: 3 },
  { k: 'log', n: 'Log', d: 'The activity log', max: 1 }
];
export const LEVELS = ['No access', 'View', 'Edit', 'Delete'];
const VIEW_ONLY = ['roadmap', 'log', 'reports', 'monthly'];
const clampLv = (v, max) => Math.max(0, Math.min(max, v | 0));
/** What the older Editor / Viewer choice means, module by module. */
export function presetPerms(access) {
  const o = {}; MODULES.forEach(m => { o[m.k] = access === 'viewer' ? (VIEW_ONLY.includes(m.k) ? 1 : 0) : m.max; }); return o;
}
/** The levels of a profile (admins: everything; `perms` first, then the Editor / Viewer choice). */
export function permsOf(me) {
  const base = presetPerms(me && me.access === 'viewer' ? 'viewer' : 'editor'), out = {};
  MODULES.forEach(m => {
    if (me && me.is_admin) { out[m.k] = m.max; return; }
    const v = me && me.perms && typeof me.perms === 'object' ? me.perms[m.k] : undefined;
    out[m.k] = Number.isInteger(v) ? clampLv(v, m.max) : base[m.k];
  });
  return out;
}
export const levelOf = (me, mod) => (me ? (permsOf(me)[mod] || 0) : 0);
/** Switches are nested: Delete needs Edit needs View. Sets one switch and fixes the others. */
export function setSwitch(level, which, on, max) {
  const need = { view: 1, edit: 2, del: 3 }[which];
  let v = level; if (on) v = Math.max(level, need); else v = Math.min(level, need - 1);
  return clampLv(v, max);
}
/** Is this the same as the Editor / Viewer preset? Then 'editor' / 'viewer', else 'custom'. */
export function presetName(perms) {
  const same = p => MODULES.every(m => (perms[m.k] | 0) === p[m.k]);
  return same(presetPerms('editor')) ? 'editor' : same(presetPerms('viewer')) ? 'viewer' : 'custom';
}
/** The legacy `access` value that goes with a set of levels (the database still uses it): anything editable = editor. */
export const accessFor = perms => (MODULES.some(m => (perms[m.k] | 0) >= 2) ? 'editor' : 'viewer');
/** The page names and the module each belongs to (admin is not a module). */
export const pageModule = p => (p === 'capacity' ? 'monthly' : MODULES.some(m => m.k === p) ? p : null);
