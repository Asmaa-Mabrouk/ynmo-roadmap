/**
 * @module pages/resources
 * Resources (team) and Approvals pages.
 * Team members directory CRUD and the admin Approvals screen (approve as Editor/Viewer, revoke).
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, LANES, TEAMS, canEdit, directory, el, state } from '../core/model.js';
import { DOMAINS, fld, logAct, pageHead, selOf, slug, toast } from '../core/shared.js';
import { write } from '../core/saving.js';
import { fillPersons } from '../ui/people-picker.js';
import { laneOf, render } from '../ui/gantt-render.js';
import { sb } from '../core/supabase.js';
import { avatarEl } from '../ui/avatars.js';
import { renderAccess } from '../features/sharing.js';
import { notify } from '../ui/notify.js';

/* ---------- resources ---------- */
function personDocId(name) { return Object.keys(S.extras).find(i => S.extras[i] && S.extras[i].n === name && !S.extras[i].hidden); }
function savePerson(name, patch, sum) {
  const d = directory().get(name);
  let id = personDocId(name);
  if (!id) { id = 'ov-' + slug(name); S.extras[id] = { n: name, over: true, domain: d ? d.domain : 'Other', sqs: d ? [...d.sqs] : ['tifli'] }; }
  S.extras[id] = Object.assign({}, S.extras[id], patch); write('people/' + id, S.extras[id]);
  if (sum) logAct('resource', sum);
  fillPersons(); render(); renderResources();
}
export function removePerson2(name) {
  const id = personDocId(name), base0 = Object.keys(TEAMS).some(sq => ['pm', 'dev', 'qa', 'ux'].some(r => (TEAMS[sq][r] || []).includes(name)));
  if (id && !base0) { delete S.extras[id]; write('people/' + id, null); }
  else { const hid = id || ('ov-' + slug(name)); S.extras[hid] = { n: name, hidden: true }; write('people/' + hid, S.extras[hid]); }
  logAct('resource', 'removed ' + name + ' from the chart');
  fillPersons(); render(); renderResources();
}
function addMember(name, domain, sqs) {
  if ([...directory().keys()].some(k => k.trim().toLowerCase() === name.trim().toLowerCase())) return 'Already on the chart.';
  const id = 'p' + Date.now().toString(36);
  S.extras[id] = { n: name, domain: domain, sqs: sqs }; write('people/' + id, S.extras[id]);
  logAct('resource', 'added ' + name + ' (' + domain + ', ' + sqs.map(k => laneOf(k).n).join(' + ') + ')');
  fillPersons(); render(); renderResources(); return '';
}
export async function loadMembers() {
  if (!S.me) return;
  const r = await sb.from('profiles').select('*').order('created_at', { ascending: true });
  if (!r.error && r.data) S.members = r.data;
  const pend = S.members.filter(m => !m.approved).length;
  const b = document.querySelector('#nav [data-p="admin"] .dot'); if (b) { b.hidden = !(S.me.is_admin && pend); b.textContent = pend; }
  if (state.page === 'admin') renderAdmin();
}
export function renderResources() {
  const root = $('pg-resources'), ae = document.activeElement;
  if (ae && root.contains(ae) && ae.tagName === 'INPUT') return;
  root.textContent = '';
  root.append(pageHead('Resources', 'Add team members by name and domain. Changes appear in the roadmap rows, the assign menus and the vacations list.'));
  const f = el('form', 'card'); f.append(el('h2', '', 'Add team member'));
  const nm = el('input'); nm.type = 'text'; nm.required = true; nm.maxLength = 60; nm.placeholder = 'Full name';
  const dm = selOf(DOMAINS, 'Engineering');
  const sq = el('div', 'formrow'); const picked = new Set(['tifli']);
  LANES.forEach(l => { const b = el('button', 'pill', l.n); b.type = 'button'; b.style.setProperty('--c', l.c); b.setAttribute('aria-pressed', String(picked.has(l.k))); b.prepend(el('i')); b.addEventListener('click', () => { picked.has(l.k) ? picked.delete(l.k) : picked.add(l.k); b.setAttribute('aria-pressed', String(picked.has(l.k))); }); sq.append(b); });
  const msg = el('div', 'gerr'); const go = el('button', 'btn primary', 'Add member'); go.type = 'submit'; go.disabled = !canEdit();
  const r1 = el('div', 'formrow'); r1.append(fld('Name', nm), fld('Domain', dm));
  f.append(r1, fld('Squads', sq), msg, go);
  f.addEventListener('submit', e => { e.preventDefault(); const v = nm.value.trim(); if (!v) return; if (!picked.size) { msg.textContent = 'Pick at least one squad.'; return; } const m = addMember(v, dm.value, [...picked]); if (m) msg.textContent = m; });
  root.append(f);
  const dir = directory(), prim = d => Math.min.apply(null, [...d.sqs].map(k => LANES.findIndex(l => l.k === k)).filter(i => i >= 0).concat([9]));
  const people = [...dir.values()].sort((a, b) => prim(a) - prim(b) || a.name.localeCompare(b.name));
  const card = el('div', 'card'); card.append(el('h2', '', 'Team (' + people.length + ')'), el('p', 'sub', 'Squads: a coloured chip with a ✓ means the person works in that squad. Click a chip to add or remove the squad (saved automatically). They decide whose rows show on each squad\'s roadmap and who is suggested first on the sprint page.'));
  const t = el('table', 'tbl'), th = el('thead'), hr = el('tr'); ['Name', 'Domain', 'Squads', ''].forEach(x => { const c = el('th', '', x); if (!x) c.append(el('span', 'sr', 'Actions')); hr.append(c); }); th.append(hr); t.append(th);
  const tb = el('tbody');
  people.forEach(p => {
    const tr = el('tr'), c1 = el('td'); const w = el('div', 'formrow'); w.style.alignItems = 'center'; w.append(avatarEl('', 30, p.name), el('b', '', p.name)); c1.append(w);
    const c2 = el('td'), ds = selOf(DOMAINS, p.domain); ds.disabled = !canEdit(); ds.setAttribute('aria-label', 'Domain of ' + p.name);
    ds.addEventListener('change', () => savePerson(p.name, { domain: ds.value }, 'changed domain of ' + p.name + ' to ' + ds.value)); c2.append(ds);
    const c3 = el('td'), sw = el('div', 'formrow');
    LANES.forEach(l => { const b = el('button', 'pill', (p.sqs.has(l.k) ? '✓ ' : '') + l.n); b.type = 'button'; b.title = (p.sqs.has(l.k) ? 'Remove ' : 'Add ') + p.name + (p.sqs.has(l.k) ? ' from ' : ' to ') + l.n; b.prepend(el('i')); b.style.setProperty('--c', l.c); b.setAttribute('aria-pressed', String(p.sqs.has(l.k))); b.disabled = !canEdit();
      b.addEventListener('click', () => { const s = new Set(p.sqs); s.has(l.k) ? s.delete(l.k) : s.add(l.k); if (!s.size) { notify(p.name + ' must stay in at least one squad', 'err'); return; } notify(p.name + (s.has(l.k) ? ' added to ' : ' removed from ') + l.n); savePerson(p.name, { sqs: [...s], over: true }, 'changed squads of ' + p.name + ': ' + [...s].map(k => laneOf(k).n).join(' + ')); }); sw.append(b); });
    c3.append(sw);
    const c4 = el('td'); if (canEdit()) { let armed = false; const rm = el('button', 'btn danger sm', 'Remove'); rm.type = 'button'; rm.addEventListener('click', () => { if (armed) { removePerson2(p.name); return; } armed = true; rm.textContent = 'Click again'; setTimeout(() => { armed = false; rm.textContent = 'Remove'; }, 3000); }); c4.append(rm); }
    tr.append(c1, c2, c3, c4); tb.append(tr);
  });
  t.append(tb); const sc = el('div', 'tscroll'); sc.append(t); card.append(sc); root.append(card);
  const hidden = Object.keys(S.extras).filter(i => S.extras[i] && S.extras[i].hidden);
  if (hidden.length) {
    const hc = el('div', 'card'); hc.append(el('h2', '', 'Removed from the chart'));
    hidden.forEach(i => { const r = el('div', 'formrow'); r.append(el('span', '', S.extras[i].n)); const b = el('button', 'btn sm', 'Restore'); b.type = 'button'; b.addEventListener('click', () => { const nmn = S.extras[i].n; delete S.extras[i]; write('people/' + i, null); logAct('resource', 'restored ' + nmn + ' to the chart'); fillPersons(); render(); renderResources(); }); r.append(b); hc.append(r); });
    root.append(hc);
  }
}

export function renderAdmin() {
  const root = $('pg-admin'); root.textContent = '';
  root.append(pageHead('Approvals', 'People who registered wait here until you approve them. They get an email when you do, and their waiting screen opens the tool by itself.'));
  const pend = S.members.filter(m => !m.approved);
  const ac = el('div', 'card'); ac.append(el('h2', '', pend.length ? 'Waiting for your approval (' + pend.length + ')' : 'Nobody is waiting'));
  if (!pend.length) ac.append(el('div', 'hint', 'New registrations show up here.'));
    pend.forEach(m => {
      const row = el('div', 'formrow'); row.style.alignItems = 'center';
      const who = el('div'); who.append(el('b', '', m.name || m.email), el('div', 'hint', (m.role ? m.role + ' · ' : '') + (m.email || '')));
      const acc = selOf([['editor', 'Editor'], ['viewer', 'Viewer']], 'editor'); acc.style.marginInlineStart = 'auto'; acc.setAttribute('aria-label', 'Access for ' + (m.name || m.email));
      const ok = el('button', 'btn primary sm', 'Approve'); ok.type = 'button';
      ok.addEventListener('click', async () => {
        ok.disabled = true; const patch = acc.value === 'viewer' ? { approved: true, access: 'viewer' } : { approved: true }; const r = await sb.from('profiles').update(patch).eq('id', m.id);
        if (r.error) { ok.disabled = false; toast('Could not approve: ' + r.error.message); return; }
        logAct('access', 'approved ' + (m.name || m.email) + (acc.value === 'viewer' ? ' as a viewer' : '')); toast('Approved. ' + (m.name || m.email) + ' can now open the tool.'); await loadMembers();
      });
      row.append(avatarEl(m.avatar, 36, m.name), who, acc, ok); ac.append(row);
    });
  root.append(ac);
  renderAccess(root);
}

