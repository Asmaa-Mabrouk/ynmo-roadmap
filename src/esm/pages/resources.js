/**
 * @module pages/resources
 * Resources (team) and Approvals pages.
 * Team members directory CRUD and the admin Approvals screen (approve as Editor/Viewer, revoke).
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, LANES, TEAMS, canEdit, directory, el, items, state } from '../core/model.js';
import { DOMAINS, fld, logAct, pageHead, selOf, slug, toast } from '../core/shared.js';
import { persist, write } from '../core/saving.js';
import { saveIdea } from './ideas.js';
import { allRoadmaps, useRoadmap, withRm } from './roadmaps.js';
import { closeDlg, openDlg } from '../features/safety.js';
import { applySquadNames, defaultSquadName, squadNames } from '../features/squad-names.js';
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

/** Rename a team member everywhere the name is used: the person record, features on every roadmap, vacations, sprint plans and saved row order. */
function renamePerson(old, nw) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  nw = String(nw || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!nw || nw === old) return false;
  if ([...directory().keys()].some(n => n !== old && n.toLowerCase() === nw.toLowerCase())) { notify(nw + ' is already in the team', 'err'); return false; }
  const d = directory().get(old) || { sqs: new Set(['tifli']), domain: 'Other' }, id = personDocId(old);
  const base0 = Object.keys(TEAMS).some(sq => ['pm', 'dev', 'qa', 'ux'].some(r => (TEAMS[sq][r] || []).includes(old)));
  if (id && !base0) { S.extras[id] = Object.assign({}, S.extras[id], { n: nw }); write('people/' + id, S.extras[id]); }
  else {
    let nid = 'ov-' + slug(nw); const hid = id || ('ov-' + slug(old)); if (nid === hid || S.extras[nid]) nid += '-' + Date.now().toString(36);
    S.extras[nid] = { n: nw, over: true, domain: d.domain || 'Other', sqs: [...d.sqs] }; write('people/' + nid, S.extras[nid]);
    S.extras[hid] = { n: old, hidden: true }; write('people/' + hid, S.extras[hid]);
  }
  let feats = 0;
  allRoadmaps().forEach(rm => withRm(rm.id, () => items().forEach(it => { if (it.res.includes(old)) { const patch = { res: it.res.map(x => (x === old ? nw : x)) }; if (it.pd && it.pd[old]) { patch.pd = Object.assign({}, it.pd); patch.pd[nw] = patch.pd[old]; delete patch.pd[old]; } S.over[it.id] = Object.assign({}, S.over[it.id] || {}, patch); persist(it.id); feats++; } })));
  Object.keys(S.vacs).forEach(v => { if (S.vacs[v] && S.vacs[v].p === old) { S.vacs[v] = Object.assign({}, S.vacs[v], { p: nw }); write('vacations/' + v, S.vacs[v]); } });
  Object.keys(S.sitems).forEach(i => { const x = S.sitems[i]; if (x && x.k === 'p' && x.t === old) { S.sitems[i] = Object.assign({}, x, { t: nw }); write('sprint_items/' + i, S.sitems[i]); } else if (x && !x.k && x.person === old) { S.sitems[i] = Object.assign({}, x, { person: nw }); write('sprint_items/' + i, S.sitems[i]); } });
  const po = S.ideas.peopleorder; if (po && (po.ord || []).includes(old)) saveIdea('peopleorder', { cfg: true, ord: po.ord.map(x => (x === old ? nw : x)) });
  const ph = S.ideas.peoplehide; if (ph && ph.byRm && Object.keys(ph.byRm).some(k => ph.byRm[k].includes(old))) { const by = {}; Object.keys(ph.byRm).forEach(k => { by[k] = ph.byRm[k].map(x => (x === old ? nw : x)); }); saveIdea('peoplehide', { cfg: true, byRm: by }); }
  logAct('resource', 'renamed ' + old + ' to ' + nw + (feats ? ' (' + feats + ' feature' + (feats === 1 ? '' : 's') + ' updated)' : ''));
  fillPersons(); render(); renderResources(); notify(old + ' is now ' + nw + (feats ? '. ' + feats + ' feature' + (feats === 1 ? '' : 's') + ' updated.' : '.'));
  return true;
}
function renameSquad(k, v) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); /* a focused input would stop the page from re-drawing */
  v = String(v || '').trim().replace(/\s+/g, ' ').slice(0, 40); const cur = squadNames(), name = LANES.find(l => l.k === k).n;
  if (!v) { notify('A squad needs a name', 'err'); renderResources(); return; }
  if (v === name) return;
  if (LANES.some(l => l.k !== k && l.n.toLowerCase() === v.toLowerCase())) { notify('Another squad is already called ' + v, 'err'); renderResources(); return; }
  const names = Object.assign({}, cur); if (v === defaultSquadName(k)) delete names[k]; else names[k] = v;
  saveIdea('squadnames', { cfg: true, names: names }, 'resource', 'renamed the squad ' + name + ' to ' + v); applySquadNames(); fillPersons(); render(); renderResources(); notify('Squad renamed to ' + v);
}
/** Features of every roadmap that still list `name` as an owner: [{id, n, titles[]}]. */
function assignedWork(name) {
  const out = [];
  allRoadmaps().forEach(rm => withRm(rm.id, () => { const ts = items().filter(i => i.res.includes(name)).map(i => i.t); if (ts.length) out.push({ id: rm.id, n: rm.n, titles: ts }); }));
  return out;
}
/** Remove a member: confirm first; if the person still owns roadmap features, explain and ask to edit the roadmap before removing. */
function askRemove(name) {
  openDlg('Remove ' + name + '?', box => {
    box.append(el('p', 'sub', name + ' will be removed from the team list, the assign menus and the roadmap rows.'));
    const no = el('button', 'btn', 'Cancel'), yes = el('button', 'btn danger', 'Remove'); no.type = yes.type = 'button';
    no.addEventListener('click', closeDlg);
    yes.addEventListener('click', () => { const w = assignedWork(name); closeDlg(); if (w.length) warnAssigned(name, w); else removePerson2(name); });
    const row = el('div', 'formrow'); row.append(no, yes); box.append(row);
  });
}
function warnAssigned(name, work) {
  const total = work.reduce((n, w) => n + w.titles.length, 0);
  openDlg('Cannot remove ' + name + ' yet', box => {
    const wr = el('p', 'gerr', name + ' is still assigned to ' + total + (total === 1 ? ' feature' : ' features') + ' on the roadmap. Edit the roadmap first (reassign or unassign them), then remove ' + name + '.'); wr.setAttribute('role', 'alert'); box.append(wr);
    work.forEach(w => {
      const row = el('div', 'wkrow'); row.append(el('b', '', w.n + ' (' + w.titles.length + ')'));
      const ul = el('ul'); w.titles.slice(0, 6).forEach(t => ul.append(el('li', '', t))); if (w.titles.length > 6) ul.append(el('li', '', '… and ' + (w.titles.length - 6) + ' more')); row.append(ul);
      const go = el('button', 'btn sm primary', 'Open ' + w.n); go.type = 'button';
      go.addEventListener('click', () => { closeDlg(); useRoadmap(w.id); state.person = name; fillPersons(); render(); const nb = document.querySelector('#nav button[data-p="roadmap"]'); if (nb) nb.click(); });
      row.append(go); box.append(row);
    });
    const ok = el('button', 'btn', 'Close'); ok.type = 'button'; ok.addEventListener('click', closeDlg); box.append(ok);
  });
}
export function removePerson2(name) {
  const id = personDocId(name), base0 = Object.keys(TEAMS).some(sq => ['pm', 'dev', 'qa', 'ux'].some(r => (TEAMS[sq][r] || []).includes(name)));
  if (id && !base0) { delete S.extras[id]; write('people/' + id, null); }
  else { const hid = id || ('ov-' + slug(name)); S.extras[hid] = { n: name, hidden: true }; write('people/' + hid, S.extras[hid]); }
  logAct('resource', 'removed ' + name + ' from the chart');
  fillPersons(); render(); renderResources();
}
/** Show `name` on the picked roadmaps. `hideRest` also hides the row on the other roadmaps (new members only). Returns the names of the roadmaps where the row is now visible. */
function setRoadmapRows(name, picked, hideRest) {
  const ph = S.ideas.peoplehide, by = {}; Object.keys((ph && ph.byRm) || {}).forEach(k => { by[k] = ph.byRm[k].slice(); });
  allRoadmaps().forEach(rm => {
    const list = (by[rm.id] || []).filter(x => x !== name);
    if (!picked.has(rm.id) && hideRest) list.push(name);
    if (list.length || by[rm.id]) by[rm.id] = list;
  });
  saveIdea('peoplehide', { cfg: true, byRm: by });
  return allRoadmaps().filter(rm => !(by[rm.id] || []).includes(name)).map(rm => rm.n);
}
function addMember(name, domain, sqs, picked) {
  const dup = [...directory().keys()].find(k => k.trim().toLowerCase() === name.trim().toLowerCase());
  if (dup) {   // already added (for example from the roadmap's "+ Add person"): do not duplicate, just show the row where it was asked for
    const shown = setRoadmapRows(dup, picked, false); logAct('resource', 'showed ' + dup + ' on ' + [...picked].map(id => (allRoadmaps().find(r => r.id === id) || {}).n).filter(Boolean).join(' + '));
    render(); renderResources(); notify(dup + ' is already on the team, so no duplicate was added. Shown on: ' + (shown.join(', ') || 'no roadmap') + '.'); return '';
  }
  const id = 'p' + Date.now().toString(36);
  S.extras[id] = { n: name, domain: domain, sqs: sqs }; write('people/' + id, S.extras[id]);
  const shown = setRoadmapRows(name, picked, true);
  logAct('resource', 'added ' + name + ' (' + domain + ', ' + sqs.map(k => laneOf(k).n).join(' + ') + ')' + (shown.length ? ' on ' + shown.join(' + ') : ' (no roadmap row yet)'));
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
  const rmRow = el('div', 'formrow'), rmPick = new Set(allRoadmaps().map(r => r.id));
  allRoadmaps().forEach(r => { const b = el('button', 'pill', r.n); b.type = 'button'; b.setAttribute('aria-pressed', 'true'); b.prepend(el('i')); b.addEventListener('click', () => { rmPick.has(r.id) ? rmPick.delete(r.id) : rmPick.add(r.id); b.setAttribute('aria-pressed', String(rmPick.has(r.id))); }); rmRow.append(b); });
  const msg = el('div', 'gerr'); const go = el('button', 'btn primary', 'Add member'); go.type = 'submit'; go.disabled = !canEdit();
  const r1 = el('div', 'formrow'); r1.append(fld('Name', nm), fld('Domain', dm));
  f.append(r1, fld('Squads', sq), fld('Show a row on these roadmaps (also fixes a person already added from the roadmap, no duplicate)', rmRow), msg, go);
  f.addEventListener('submit', e => { e.preventDefault(); const v = nm.value.trim(); if (!v) return; if (!picked.size) { msg.textContent = 'Pick at least one squad.'; return; } const m = addMember(v, dm.value, [...picked], rmPick); if (m) msg.textContent = m; });
  root.append(f);
  const dir = directory(), prim = d => Math.min.apply(null, [...d.sqs].map(k => LANES.findIndex(l => l.k === k)).filter(i => i >= 0).concat([9]));
  const people = [...dir.values()].sort((a, b) => prim(a) - prim(b) || a.name.localeCompare(b.name));
  const sqCard = el('div', 'card'); sqCard.append(el('h2', '', 'Squads'), el('p', 'sub', 'Rename a squad (press Enter or click away to save). The new name shows everywhere: roadmap, team list, sprints. Colours stay the same.'));
  LANES.forEach(l => {
    const row = el('div', 'formrow sqrow'), dot = el('i', 'sqdot'); dot.style.background = l.c; const inp = el('input'); inp.value = l.n; inp.disabled = !canEdit(); inp.maxLength = 40; inp.setAttribute('aria-label', 'Name of the ' + defaultSquadName(l.k) + ' squad');
    let done = false; const go = () => { if (done) return; done = true; renameSquad(l.k, inp.value); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } else if (e.key === 'Escape') { inp.value = l.n; inp.blur(); } }); inp.addEventListener('blur', go); inp.addEventListener('focus', () => { done = false; });
    row.append(dot, inp); if (l.n !== defaultSquadName(l.k) && canEdit()) { const rs = el('button', 'btn sm', 'Reset to ' + defaultSquadName(l.k)); rs.type = 'button'; rs.addEventListener('mousedown', e => e.preventDefault()); rs.addEventListener('click', () => renameSquad(l.k, defaultSquadName(l.k))); row.append(rs); }
    sqCard.append(row);
  });
  root.append(sqCard);
  const card = el('div', 'card'); card.append(el('h2', '', 'Team (' + people.length + ')'), el('p', 'sub', 'Squads: a coloured chip with a ✓ means the person works in that squad. Click a chip to add or remove the squad (saved automatically). They decide whose rows show on each squad\'s roadmap and who is suggested first on the sprint page.'));
  const t = el('table', 'tbl'), th = el('thead'), hr = el('tr'); ['Name', 'Domain', 'Squads', ''].forEach(x => { const c = el('th', '', x); if (!x) c.append(el('span', 'sr', 'Actions')); hr.append(c); }); th.append(hr); t.append(th);
  const tb = el('tbody');
  people.forEach(p => {
    const tr = el('tr'), c1 = el('td'); const w = el('div', 'formrow'); w.style.alignItems = 'center'; const nameB = el('b', '', p.name); w.append(avatarEl('', 30, p.name), nameB);
    if (canEdit()) {
      const ed = el('button', 'btn sm iconbtn', '✎'); ed.type = 'button'; ed.title = 'Rename ' + p.name; ed.setAttribute('aria-label', 'Rename ' + p.name);
      ed.addEventListener('click', () => {
        const inp = el('input'); inp.value = p.name; inp.maxLength = 60; inp.setAttribute('aria-label', 'New name for ' + p.name); nameB.replaceWith(inp); ed.hidden = true; inp.focus(); inp.select(); let done = false;
        const fin = ok => { if (done) return; done = true; if (ok && renamePerson(p.name, inp.value)) return; renderResources(); };
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fin(true); } else if (e.key === 'Escape') fin(false); }); inp.addEventListener('blur', () => fin(true));
      });
      w.append(ed);
    }
    c1.append(w);
    const c2 = el('td'), ds = selOf(DOMAINS, p.domain); ds.disabled = !canEdit(); ds.setAttribute('aria-label', 'Domain of ' + p.name);
    ds.addEventListener('change', () => savePerson(p.name, { domain: ds.value }, 'changed domain of ' + p.name + ' to ' + ds.value)); c2.append(ds);
    const c3 = el('td'), sw = el('div', 'formrow');
    LANES.forEach(l => { const b = el('button', 'pill', (p.sqs.has(l.k) ? '✓ ' : '') + l.n); b.type = 'button'; b.title = (p.sqs.has(l.k) ? 'Remove ' : 'Add ') + p.name + (p.sqs.has(l.k) ? ' from ' : ' to ') + l.n; b.prepend(el('i')); b.style.setProperty('--c', l.c); b.setAttribute('aria-pressed', String(p.sqs.has(l.k))); b.disabled = !canEdit();
      b.addEventListener('click', () => { const s = new Set(p.sqs); s.has(l.k) ? s.delete(l.k) : s.add(l.k); if (!s.size) { notify(p.name + ' must stay in at least one squad', 'err'); return; } notify(p.name + (s.has(l.k) ? ' added to ' : ' removed from ') + l.n); savePerson(p.name, { sqs: [...s], over: true }, 'changed squads of ' + p.name + ': ' + [...s].map(k => laneOf(k).n).join(' + ')); }); sw.append(b); });
    c3.append(sw);
    const c4 = el('td'); if (canEdit()) { const rm = el('button', 'btn danger sm', 'Remove'); rm.type = 'button'; rm.addEventListener('click', () => askRemove(p.name)); c4.append(rm); }
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

