/**
 * @module pages/permissions
 * Users and permissions (admins only, on the Approvals page): a list of people on the side and, for the selected person, a card per module with
 * View / Edit / Delete switches, an Editor / Viewer preset and the Admin switch (an admin approves new people and manages permissions).
 * The levels live in `profiles.perms` (see core/permissions.js); `profiles.access` is kept in step because the database still reads it.
 */
import { S } from '../core/state.js';
import { el } from '../core/model.js';
import { fld, logAct, selOf, toast } from '../core/shared.js';
import { sb } from '../core/supabase.js';
import { avatarEl } from '../ui/avatars.js';
import { confirmDlg } from '../ui/confirm.js';
import { LEVELS, MODULES, accessFor, permsOf, presetName, presetPerms, setSwitch } from '../core/permissions.js';

const ui = { sel: '', draft: null };
const nameOf = m => m.name || m.email || 'this person';
const summary = p => MODULES.filter(m => p[m.k] > 0).map(m => m.n + ' ' + LEVELS[p[m.k]]).join(', ') || 'no access';
const sameP = (a, b) => MODULES.every(m => (a[m.k] | 0) === (b[m.k] | 0));

async function patchProfile(m, patch, okMsg, log, reload) {
  const r = await sb.from('profiles').update(patch).eq('id', m.id);
  if (r.error) { toast('Could not save: ' + r.error.message + (/perms/.test(r.error.message || '') ? ' (run supabase/sql/08-permissions.sql first)' : '')); return false; }
  Object.assign(m, patch); logAct('access', log); toast(okMsg); await reload(); return true;
}

function sw(label, on, disabled, onChange) {
  const b = el('button', 'permsw' + (on ? ' on' : '')); b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(on)); b.setAttribute('aria-label', label); b.disabled = disabled;
  b.append(el('span', 'permknob'), el('span', 'permlab', label.split(' ')[0])); b.addEventListener('click', () => onChange(!on)); return b;
}

export function renderPermissions(root, reload) {
  if (!(S.me && S.me.is_admin)) return;
  const people = S.members.slice().sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1) || nameOf(a).localeCompare(nameOf(b)));
  if (!people.length) return;
  let cur = people.find(p => p.id === ui.sel); if (!cur) { cur = people.find(p => p.approved && p.id !== S.me.id) || people[0]; ui.sel = cur.id; ui.draft = null; }
  const stored = cur.approved || cur.perms ? permsOf(cur) : presetPerms('viewer'); /* someone waiting starts as a Viewer: the safe choice */ if (!ui.draft || ui.draftFor !== cur.id) { ui.draft = Object.assign({}, stored); ui.draftFor = cur.id; }
  const card = el('div', 'card permpage'); card.id = 'permissions';
  card.append(el('h2', '', 'Users & permissions'), el('p', 'sub', 'Pick a person, then choose what they can do in each module. Delete includes Edit, and Edit includes View. Admins can approve new people and manage everyone\'s permissions.'));
  const lay = el('div', 'permlay'), list = el('div', 'permusers'); list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'People');
  people.forEach(p => {
    const b = el('button', 'permuser' + (p.id === cur.id ? ' on' : '')); b.type = 'button'; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(p.id === cur.id));
    const t = el('span', 'permwho'); t.append(el('b', '', nameOf(p)), el('small', '', (p.role ? p.role + ' · ' : '') + (p.email || '')));
    b.append(avatarEl(p.avatar, 32, p.name), t);
    if (!p.approved) b.append(el('span', 'badge warn', 'Waiting')); else if (p.is_admin) b.append(el('span', 'badge', 'Admin')); if (p.id === S.me.id) b.append(el('span', 'hint', 'You'));
    b.addEventListener('click', () => { if (p.id === cur.id) return; ui.sel = p.id; ui.draft = null; reload(true); });
    list.append(b);
  });
  const det = el('div', 'permdetail'); det.setAttribute('aria-live', 'polite');
  const head = el('div', 'permhead'), who = el('div'); who.append(el('h3', '', nameOf(cur)), el('div', 'hint', (cur.role ? cur.role + ' · ' : '') + (cur.email || '')));
  head.append(avatarEl(cur.avatar, 48, cur.name), who); det.append(head);
  const self = cur.id === S.me.id, admins = S.members.filter(x => x.approved && x.is_admin);
  // admin switch
  const ar = el('div', 'permadmin'), at = el('div'); at.append(el('b', '', 'Admin'), el('div', 'hint', 'Approves new people, manages permissions and has full access to every module.'));
  const asw = sw('Admin', !!cur.is_admin, self || !cur.approved, on => {
    if (!on && admins.length <= 1) { toast('There must be at least one admin.'); return; }
    confirmDlg(on ? 'Make ' + nameOf(cur) + ' an admin?' : 'Remove admin from ' + nameOf(cur) + '?', on ? nameOf(cur) + ' will be able to approve new people, change anyone\'s permissions and make other admins.' : nameOf(cur) + ' keeps their account but loses these powers. Their module permissions below apply again.', on ? 'Make admin' : 'Remove admin', () => {
      patchProfile(cur, { is_admin: on }, nameOf(cur) + (on ? ' is now an admin.' : ' is no longer an admin.'), (on ? 'made ' : 'removed admin from ') + nameOf(cur) + (on ? ' an admin' : ''), reload);
    });
  });
  ar.append(at, asw); det.append(ar);
  if (self) det.append(el('p', 'hint', 'This is you. You cannot change your own admin switch or permissions.'));
  if (!cur.approved) det.append(el('p', 'hint permwait', nameOf(cur) + ' is waiting for approval. Choose what they can do, then approve.'));
  // preset
  const full = !!cur.is_admin, dis = self || full;
  const pn = presetName(ui.draft), pre = selOf([['editor', 'Editor (everything)'], ['viewer', 'Viewer (look only)'], ['custom', 'Custom']], pn); pre.setAttribute('aria-label', 'Access for ' + nameOf(cur)); pre.disabled = dis;
  pre.addEventListener('change', async () => {
    if (pre.value === 'custom') { return; }
    const p = presetPerms(pre.value);
    if (!cur.approved) { ui.draft = p; reload(true); return; }
    ui.draft = null; await patchProfile(cur, { access: pre.value, perms: p }, nameOf(cur) + ' is now a ' + pre.value + '.', 'set ' + nameOf(cur) + ' as ' + pre.value, reload);
  });
  const pr = el('div', 'permpre'); pr.append(fld('Preset (saves right away)', pre)); det.append(pr);
  // module cards
  const grid = el('div', 'permgrid');
  MODULES.forEach(m => {
    const lv = full ? m.max : ui.draft[m.k] | 0, c = el('div', 'permmod' + (lv ? '' : ' off')), top = el('div', 'permtop');
    top.append(el('b', '', m.n), el('span', 'permbadge lv' + lv, full ? 'Full' : LEVELS[lv])); c.append(top, el('div', 'hint', m.d));
    const row = el('div', 'permsws');
    [['view', 'View'], ['edit', 'Edit'], ['del', 'Delete']].forEach(([w, lab], i) => {
      if (m.max < i + 1) return;
      const on = lv >= i + 1; row.append(sw(lab + ' ' + m.n, on, dis, v => { ui.draft[m.k] = setSwitch(ui.draft[m.k] | 0, w, v, m.max); reload(true); }));
    });
    c.append(row); grid.append(c);
  });
  det.append(grid);
  const dirty = !dis && !sameP(ui.draft, stored), foot = el('div', 'permfoot');
  const save = el('button', 'btn primary', cur.approved ? 'Save permissions' : 'Approve with these permissions'); save.type = 'button'; save.disabled = dis || (cur.approved && !dirty);
  const undo = el('button', 'btn', 'Discard changes'); undo.type = 'button'; undo.hidden = !dirty; undo.addEventListener('click', () => { ui.draft = null; reload(true); });
  save.addEventListener('click', async () => {
    save.disabled = true; const d = Object.assign({}, ui.draft); ui.draft = null; const patch = { perms: d, access: accessFor(d) }; if (!cur.approved) patch.approved = true;
    const ok = await patchProfile(cur, patch, cur.approved ? 'Permissions saved for ' + nameOf(cur) + '.' : nameOf(cur) + ' is approved.', (cur.approved ? 'changed permissions of ' : 'approved ') + nameOf(cur) + ': ' + summary(d), reload);
    if (!ok) { ui.draft = d; save.disabled = false; }
  });
  foot.append(save, undo, el('span', 'hint', dirty ? 'Unsaved changes' : '')); det.append(foot);
  lay.append(list, det); card.append(lay); root.append(card);
}
