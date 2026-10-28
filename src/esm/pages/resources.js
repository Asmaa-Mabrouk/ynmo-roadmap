/**
 * @module pages/resources
 * Resources (team) and Approvals pages.
 * Team members directory CRUD and the admin Approvals screen (approve as Editor/Viewer, revoke).
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, LANES, TEAMS, canDelete, canEdit, directory, el, items, state } from '../core/model.js';
import { DOMAINS, fld, logAct, pageHead, selOf, slug, toast } from '../core/shared.js';
import { persist, write } from '../core/saving.js';
import { saveIdea } from './ideas.js';
import { allRoadmaps, useRoadmap, withRm } from './roadmaps.js';
import { closeDlg, openDlg } from '../features/safety.js';
import { applySquadNames, defaultSquadColor, defaultSquadName, extraSquads, isBaseSquad, squadColors, squadNames } from '../features/squad-names.js';
import { fillPersons } from '../ui/people-picker.js';
import { laneOf, render } from '../ui/gantt-render.js';
import { sb } from '../core/supabase.js';
import { avatarEl } from '../ui/avatars.js';
import { renderPermissions } from './permissions.js';
import { notify } from '../ui/notify.js';
import { requestsCard, pendingCount } from '../features/feature-sync.js';
import { applyAccessChange } from '../app/shell.js';
import { leaverWork, leavingMap, partMap, renameInDashboard, setLeaving, setPart } from '../features/leavers.js';
import { confirmDlg } from '../ui/confirm.js';
import { fmtIso, todayIso } from '../core/shared.js';
import { setTracks, tracksOf } from '../features/tracks.js';
import { LANES as TRACKS, trackOfDomain } from '../features/capacity.js';
const resList = () => [...directory().values()].map(p => ({ name: p.name, domain: p.domain }));
/** Pills for the Dashboard tracks; `set` is a Set of track keys, `onChange(set)` is called after each click. */
function trackPills(set, onChange) {
  const row = el('div', 'formrow trackrow');
  TRACKS.forEach(t => { const b = el('button', 'pill', t.n); b.type = 'button'; b.dataset.track = t.k; b.setAttribute('aria-pressed', String(set.has(t.k))); b.addEventListener('click', () => { set.has(t.k) ? set.delete(t.k) : set.add(t.k); b.setAttribute('aria-pressed', String(set.has(t.k))); onChange(set); }); row.append(b); });
  return row;
}

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
function renamePerson(old, nw, merge) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  nw = String(nw || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!nw || nw === old) return false;
  const exists = [...directory().keys()].some(n => n !== old && n.toLowerCase() === nw.toLowerCase());
  if (merge) { if (!directory().has(nw) || nw === old) return false; } else if (exists) { notify(nw + ' is already in the team', 'err'); return false; }
  const d = directory().get(old) || { sqs: new Set(['tifli']), domain: 'Other' }, id = personDocId(old);
  const base0 = Object.keys(TEAMS).some(sq => ['pm', 'dev', 'qa', 'ux'].some(r => (TEAMS[sq][r] || []).includes(old)));
  if (merge) { const hid = id || ('ov-' + slug(old)); S.extras[hid] = { n: old, hidden: true }; write('people/' + hid, S.extras[hid]); }   // merged: the old row is hidden (an editor may change but not delete)
  else if (id && !base0) { S.extras[id] = Object.assign({}, S.extras[id], { n: nw }); write('people/' + id, S.extras[id]); }
  else {
    let nid = 'ov-' + slug(nw); const hid = id || ('ov-' + slug(old)); if (nid === hid || S.extras[nid]) nid += '-' + Date.now().toString(36);
    S.extras[nid] = { n: nw, over: true, domain: d.domain || 'Other', sqs: [...d.sqs] }; write('people/' + nid, S.extras[nid]);
    S.extras[hid] = { n: old, hidden: true }; write('people/' + hid, S.extras[hid]);
  }
  let feats = 0;
  allRoadmaps().forEach(rm => withRm(rm.id, () => items().forEach(it => { if (it.res.includes(old)) { const patch = { res: [...new Set(it.res.map(x => (x === old ? nw : x)))] }; if (it.pd && it.pd[old]) { patch.pd = Object.assign({}, it.pd); if (!patch.pd[nw]) patch.pd[nw] = patch.pd[old]; delete patch.pd[old]; } S.over[it.id] = Object.assign({}, S.over[it.id] || {}, patch); persist(it.id); feats++; } })));
  Object.keys(S.vacs).forEach(v => { if (S.vacs[v] && S.vacs[v].p === old) { S.vacs[v] = Object.assign({}, S.vacs[v], { p: nw }); write('vacations/' + v, S.vacs[v]); } });
  Object.keys(S.sitems).forEach(i => { const x = S.sitems[i]; if (x && x.k === 'p' && x.t === old) { S.sitems[i] = Object.assign({}, x, { t: nw }); write('sprint_items/' + i, S.sitems[i]); } else if (x && !x.k && x.person === old) { S.sitems[i] = Object.assign({}, x, { person: nw }); write('sprint_items/' + i, S.sitems[i]); } });
  Object.keys(S.ideas).forEach(iid => { const x = S.ideas[iid]; if (x && x.tn && x.p === old) saveIdea(iid, { p: nw }); });   // timeline notes about this person
  const po = S.ideas.peopleorder; if (po && (po.ord || []).includes(old)) saveIdea('peopleorder', { cfg: true, ord: [...new Set(po.ord.map(x => (x === old ? nw : x)))] });
  const ph = S.ideas.peoplehide; if (ph && ph.byRm && Object.keys(ph.byRm).some(k => ph.byRm[k].includes(old))) { const by = {}; Object.keys(ph.byRm).forEach(k => { by[k] = [...new Set(ph.byRm[k].map(x => (x === old ? nw : x)))]; }); saveIdea('peoplehide', { cfg: true, byRm: by }); }
  const dash = renameInDashboard(old, nw);
  logAct('resource', (merge ? 'merged ' : 'renamed ') + old + (merge ? ' into ' : ' to ') + nw + (feats ? ' (' + feats + ' feature' + (feats === 1 ? '' : 's') + ' updated)' : ''));
  fillPersons(); render(); renderResources(); notify(old + ' is now ' + nw + (feats ? '. ' + feats + ' feature' + (feats === 1 ? '' : 's') + ' updated.' : '.'));
  return true;
}
/** Save the products meta doc (names, colours, extra products) and redraw everything that shows them. */
function saveLanes(patch, sum, msg) {
  const cur = { names: Object.assign({}, squadNames()), colors: Object.assign({}, squadColors()), extra: extraSquads().slice() };
  saveIdea('squadnames', Object.assign({ cfg: true }, cur, patch), 'resource', sum);
  applySquadNames(); fillPersons(); render(); renderResources(); if (msg) notify(msg);
}
function renameSquad(k, v) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); /* a focused input would stop the page from re-drawing */
  v = String(v || '').trim().replace(/\s+/g, ' ').slice(0, 40); const name = LANES.find(l => l.k === k).n;
  if (!v) { notify('A product needs a name', 'err'); renderResources(); return; }
  if (v === name) return;
  if (LANES.some(l => l.k !== k && l.n.toLowerCase() === v.toLowerCase())) { notify('Another product is already called ' + v, 'err'); renderResources(); return; }
  const names = Object.assign({}, squadNames()), ex = extraSquads().map(e => (e.k === k ? Object.assign({}, e, { n: v }) : e));
  if (isBaseSquad(k) && v === defaultSquadName(k)) delete names[k]; else if (isBaseSquad(k)) names[k] = v; else delete names[k];
  saveLanes({ names: names, extra: ex }, 'renamed the product ' + name + ' to ' + v, 'Renamed to ' + v);
}
function recolorSquad(k, c) {
  const l = LANES.find(x => x.k === k); if (!l || !/^#[0-9a-f]{6}$/i.test(c)) return; c = c.toLowerCase();
  const colors = Object.assign({}, squadColors()), ex = extraSquads().map(e => (e.k === k ? Object.assign({}, e, { c: c }) : e));
  if (isBaseSquad(k) && c === String(defaultSquadColor(k)).toLowerCase()) delete colors[k]; else if (isBaseSquad(k)) colors[k] = c; else delete colors[k];
  saveLanes({ colors: colors, extra: ex }, 'changed the colour of ' + l.n + ' to ' + c, l.n + ' colour changed');
}
function resetSquad(k) {
  const names = Object.assign({}, squadNames()), colors = Object.assign({}, squadColors()); delete names[k]; delete colors[k];
  saveLanes({ names: names, colors: colors }, 'reset the product ' + k, 'Back to the default');
}
function addProduct(name, c) {
  name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!name) return 'Give the product a name.';
  if (LANES.some(l => l.n.toLowerCase() === name.toLowerCase())) return 'A product called ' + name + ' already exists.';
  if (LANES.some(l => String(l.c).toLowerCase() === c.toLowerCase())) { /* same colour is allowed but warned about in the UI */ }
  const k = 'x' + Date.now().toString(36);
  saveLanes({ extra: extraSquads().concat([{ k: k, n: name, c: c }]) }, 'added the product ' + name + ' (' + c + ')', name + ' added. Add members to it and it appears on the roadmap.');
  return '';
}
function removeProduct(k) {
  const l = LANES.find(x => x.k === k); if (!l || isBaseSquad(k)) return;
  let used = 0; allRoadmaps().forEach(rm => withRm(rm.id, () => { used += items().filter(i => i.sq === k).length; }));
  if (used) { notify(l.n + ' still has ' + used + (used === 1 ? ' feature' : ' features') + ' on the roadmap. Move or delete them first.', 'err'); return; }
  const ex = extraSquads().filter(e => e.k !== k), names = Object.assign({}, squadNames()), colors = Object.assign({}, squadColors()); delete names[k]; delete colors[k];
  saveLanes({ extra: ex, names: names, colors: colors }, 'removed the product ' + l.n, l.n + ' removed');
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
/** One person: name, same person as another row (merge), and left the company (last working day), with the features that then need a new owner. */
function openPerson(name) {
  openDlg(name, box => {
    box.classList.add('pmdlg');
    const draw = () => {
      box.querySelectorAll('.pmbody').forEach(x => x.remove());
      const body = el('div', 'pmbody');
      const nm = el('input'); nm.type = 'text'; nm.maxLength = 60; nm.value = name; nm.id = 'pmname'; nm.setAttribute('aria-label', 'Name');
      const sv = el('button', 'btn sm primary', 'Save name'); sv.type = 'button'; sv.id = 'pmsave'; sv.addEventListener('click', () => { if (renamePerson(name, nm.value)) closeDlg(); });
      const r1 = el('div', 'formrow'); r1.append(nm, sv); body.append(el('h3', '', '1. Name'), el('p', 'hint', 'The name changes everywhere: roadmaps, vacations, sprints, the Dashboard and the people on cards.'), r1);
      const sel = el('select'); sel.id = 'pmmerge'; sel.setAttribute('aria-label', 'Same person as'); const o0 = el('option', '', 'Choose the name to keep…'); o0.value = ''; sel.append(o0);
      [...directory().keys()].filter(n => n !== name).sort((a, b) => a.localeCompare(b)).forEach(n => { const o = el('option', '', n); o.value = n; sel.append(o); });
      const mg = el('button', 'btn sm', 'Merge'); mg.type = 'button'; mg.id = 'pmdo';
      mg.addEventListener('click', () => { const to = sel.value; if (!to) return; confirmDlg('Merge ' + name + ' into ' + to + '?', name + ' disappears from the team list. Everything of ' + name + ' (features, vacations, sprint rows, Dashboard points) moves to ' + to + '. This does not delete any data.', 'Merge', () => { renamePerson(name, to, true); }); });
      const r2 = el('div', 'formrow'); r2.append(sel, mg); body.append(el('h3', '', '2. Same person as another row?'), el('p', 'hint', 'Use it for a spelling that was added twice (for example Tramsi and Altramsi).'), r2);
      const tk = new Set(tracksOf(name, resList()));
      body.append(el('h3', '', 'Points tracks'), el('p', 'hint', 'The Dashboard tracks this person is planned in. They appear in Monthly under "Points and people" for these tracks, and in the Dashboard team.'), trackPills(tk, set => { setTracks(name, [...set], resList(), 'resource', 'set the Dashboard tracks of ' + name); }));
      const sh = el('select'); sh.id = 'pmpart'; sh.setAttribute('aria-label', 'Time on the team'); const cs = partMap()[name] || 1;
      [[1, 'Full time (100%)'], [0.8, '80%'], [0.75, '75%'], [0.6, '60%'], [0.5, 'Half time (50%)'], [0.4, '40%'], [0.25, '25%']].concat(cs !== 1 && ![0.8, 0.75, 0.6, 0.5, 0.4, 0.25].includes(cs) ? [[cs, Math.round(cs * 100) + '%']] : []).forEach(([v, t]) => { const o = el('option', '', t); o.value = String(v); sh.append(o); });
      sh.value = String(cs); sh.disabled = !canEdit(); sh.addEventListener('change', () => { setPart(name, +sh.value, 'resource', name + ' works ' + Math.round(+sh.value * 100) + '% of the time'); notify(name + ': ' + Math.round(+sh.value * 100) + '% of the time. The Dashboard capacity follows.'); renderResources(); });
      body.append(el('h3', '', 'Time on the team'), el('p', 'hint', 'Part time? A half-time person can take half the points of a month (14 instead of 28), and a day of leave still costs 2 points (one 8-hour day, the same for everybody). The Dashboard shows it on their row.'), sh);
      const cur = leavingMap()[name] || '', dt = el('input'); dt.type = 'date'; dt.value = cur; dt.id = 'pmleft'; dt.setAttribute('aria-label', 'Last working day');
      const lv = el('button', 'btn sm primary', cur ? 'Change the day' : 'Mark as left'); lv.type = 'button'; lv.id = 'pmleave';
      lv.addEventListener('click', () => { if (!/^\d{4}-\d{2}-\d{2}$/.test(dt.value)) { notify('Pick the last working day first', 'err'); return; } setLeaving(name, dt.value, 'resource', 'marked ' + name + ' as ' + (dt.value < todayIso() ? 'left on ' : 'leaving on ') + dt.value); notify(name + ': last working day ' + fmtIso(dt.value)); draw(); renderResources(); });
      const r3 = el('div', 'formrow'); r3.append(dt, lv);
      if (cur) { const un = el('button', 'btn sm', 'Back in the team'); un.type = 'button'; un.id = 'pmclear'; un.addEventListener('click', () => { setLeaving(name, '', 'resource', name + ' is not leaving any more'); draw(); renderResources(); }); r3.append(un); }
      body.append(el('h3', '', '3. Left the company, or leaving?'), el('p', 'hint', 'From the last working day the Dashboard stops counting this person, and the features they still own after it are flagged on the roadmap and on the Dashboard until you give them a new owner.'), r3);
      const w = cur ? leaverWork(name, allRoadmaps, withRm) : [];
      if (cur) {
        const bx = el('div', 'pmwork'); bx.id = 'pmwork';
        if (!w.length) bx.append(el('p', '', 'No feature of ' + name + ' runs after ' + fmtIso(cur) + '.'));
        else {
          bx.append(el('strong', '', w.length + (w.length === 1 ? ' feature needs' : ' features need') + ' a new owner (they run after ' + fmtIso(cur) + '):'));
          const ul = el('ul'); w.slice(0, 8).forEach(x => ul.append(el('li', '', x.t + ' · ' + x.rmName))); if (w.length > 8) ul.append(el('li', '', '… and ' + (w.length - 8) + ' more')); bx.append(ul);
          const go = el('button', 'btn sm primary', 'Plan them on the roadmap'); go.type = 'button'; go.id = 'pmplan'; go.addEventListener('click', () => { closeDlg(); planLeaver(name, w[0].rm); }); bx.append(go);
        }
        body.append(bx);
      }
      box.append(body);
    };
    draw();
    const ok = el('button', 'btn', 'Close'); ok.type = 'button'; ok.addEventListener('click', closeDlg); box.append(ok);
  });
}
/** Opens the roadmap on the row of this person, to give their features a new owner. */
function planLeaver(name, rmId) { useRoadmap(rmId); state.person = name; fillPersons(); render(); const nb = document.querySelector('#nav button[data-p="roadmap"]'); if (nb) nb.click(); }
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
function addMember(name, domain, sqs, picked, tracks) {
  const dup = [...directory().keys()].find(k => k.trim().toLowerCase() === name.trim().toLowerCase());
  if (dup) {   // already added (for example from the roadmap's "+ Add person"): do not duplicate, just show the row where it was asked for
    const shown = setRoadmapRows(dup, picked, false); logAct('resource', 'showed ' + dup + ' on ' + [...picked].map(id => (allRoadmaps().find(r => r.id === id) || {}).n).filter(Boolean).join(' + '));
    render(); renderResources(); notify(dup + ' is already on the team, so no duplicate was added. Shown on: ' + (shown.join(', ') || 'no roadmap') + '.'); return '';
  }
  const id = 'p' + Date.now().toString(36);
  S.extras[id] = { n: name, domain: domain, sqs: sqs }; write('people/' + id, S.extras[id]);
  const shown = setRoadmapRows(name, picked, true);
  if (tracks && tracks.length) setTracks(name, tracks, resList(), 'resource', 'put ' + name + ' in the Dashboard tracks');
  logAct('resource', 'added ' + name + ' (' + domain + ', ' + sqs.map(k => laneOf(k).n).join(' + ') + ')' + (shown.length ? ' on ' + shown.join(' + ') : ' (no roadmap row yet)'));
  fillPersons(); render(); renderResources(); return '';
}
export async function loadMembers() {
  if (!S.me) return;
  const r = await sb.from('profiles').select('*').order('created_at', { ascending: true });
  if (!r.error && r.data) S.members = r.data;
  const mine = S.members.find(m => m.id === S.me.id);
  if (S.denied) S.denied = null; /* a save refused earlier must not keep blocking edits once an admin has changed access; a new refusal sets it again */
  if (mine && (mine.access !== S.me.access || !!mine.is_admin !== !!S.me.is_admin || JSON.stringify(mine.perms || null) !== JSON.stringify(S.me.perms || null))) { Object.assign(S.me, { access: mine.access, is_admin: mine.is_admin, perms: mine.perms }); applyAccessChange(); }
  const pend = S.members.filter(m => !m.approved).length;
  const reqs = S.me.is_admin ? pendingCount() : 0, b = document.querySelector('#nav [data-p="admin"] .dot'); if (b) { b.hidden = !(S.me.is_admin && (pend + reqs)); b.textContent = pend + reqs; }
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
  const tkSet = new Set(), tkRow0 = el('div'); let tkTouched = false;
  const drawTk = () => { tkRow0.textContent = ''; tkRow0.append(trackPills(tkSet, () => { tkTouched = true; })); };
  dm.addEventListener('change', () => { if (tkTouched) return; tkSet.clear(); const k = trackOfDomain(dm.value); if (k) tkSet.add(k); drawTk(); }); drawTk();
  const sq = el('div', 'formrow'); const picked = new Set(['tifli']);
  LANES.forEach(l => { const b = el('button', 'pill', l.n); b.type = 'button'; b.style.setProperty('--c', l.c); b.setAttribute('aria-pressed', String(picked.has(l.k))); b.prepend(el('i')); b.addEventListener('click', () => { picked.has(l.k) ? picked.delete(l.k) : picked.add(l.k); b.setAttribute('aria-pressed', String(picked.has(l.k))); }); sq.append(b); });
  const rmRow = el('div', 'formrow'), rmPick = new Set(allRoadmaps().map(r => r.id));
  allRoadmaps().forEach(r => { const b = el('button', 'pill', r.n); b.type = 'button'; b.setAttribute('aria-pressed', 'true'); b.prepend(el('i')); b.addEventListener('click', () => { rmPick.has(r.id) ? rmPick.delete(r.id) : rmPick.add(r.id); b.setAttribute('aria-pressed', String(rmPick.has(r.id))); }); rmRow.append(b); });
  const msg = el('div', 'gerr'); const go = el('button', 'btn primary', 'Add member'); go.type = 'submit'; go.disabled = !canEdit();
  const r1 = el('div', 'formrow'); r1.append(fld('Name', nm), fld('Domain', dm));
  f.append(r1, fld('Squads', sq), fld('Planned with points in these Dashboard tracks (Monthly "Points and people" and the Dashboard list them). Leave empty for a PM or someone who is not planned with points.', tkRow0), fld('Show a row on these roadmaps (also fixes a person already added from the roadmap, no duplicate)', rmRow), msg, go);
  f.addEventListener('submit', e => { e.preventDefault(); const v = nm.value.trim(); if (!v) return; if (!picked.size) { msg.textContent = 'Pick at least one squad.'; return; } const m = addMember(v, dm.value, [...picked], rmPick, [...tkSet]); if (m) msg.textContent = m; });
  root.append(f);
  const dir = directory(), prim = d => Math.min.apply(null, [...d.sqs].map(k => LANES.findIndex(l => l.k === k)).filter(i => i >= 0).concat([9]));
  const people = [...dir.values()].sort((a, b) => prim(a) - prim(b) || a.name.localeCompare(b.name));
  const sqCard = el('div', 'card'); sqCard.append(el('h2', '', 'Products'), el('p', 'sub', 'Each product has its own colour, so its bars are easy to recognise. Click a colour to change it, edit a name and press Enter. New products can be added below.'));
  const picker = (l, onPick) => { const lab = el('label', 'colbtn'); lab.style.background = l.c; lab.title = 'Change colour'; const ci = el('input'); ci.type = 'color'; ci.value = /^#[0-9a-f]{6}$/i.test(l.c) ? l.c : '#6b7280'; ci.disabled = !canEdit(); ci.setAttribute('aria-label', 'Colour of ' + l.n); ci.addEventListener('change', () => onPick(ci.value)); lab.append(ci); return lab; };
  LANES.forEach(l => {
    const row = el('div', 'formrow sqrow'); const inp = el('input'); inp.value = l.n; inp.disabled = !canEdit(); inp.maxLength = 40; inp.setAttribute('aria-label', 'Name of the ' + l.n + ' product');
    let done = false; const go = () => { if (done) return; done = true; renameSquad(l.k, inp.value); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } else if (e.key === 'Escape') { inp.value = l.n; inp.blur(); } }); inp.addEventListener('blur', go); inp.addEventListener('focus', () => { done = false; });
    row.append(picker(l, c => recolorSquad(l.k, c)), inp);
    if (canEdit()) {
      if (isBaseSquad(l.k)) { if (l.n !== defaultSquadName(l.k) || String(l.c).toLowerCase() !== String(defaultSquadColor(l.k)).toLowerCase()) { const rs = el('button', 'btn sm', 'Reset'); rs.type = 'button'; rs.title = 'Back to ' + defaultSquadName(l.k) + ' and its default colour'; rs.addEventListener('mousedown', e => e.preventDefault()); rs.addEventListener('click', () => resetSquad(l.k)); row.append(rs); } }
      else if (canDelete()) { const rm = el('button', 'btn danger sm', 'Remove'); rm.type = 'button'; rm.addEventListener('mousedown', e => e.preventDefault()); rm.addEventListener('click', () => removeProduct(l.k)); row.append(rm); }
    }
    sqCard.append(row);
  });
  if (canEdit()) {
    const nf = el('div', 'formrow sqrow sqnew'), nn = el('input'); nn.type = 'text'; nn.maxLength = 40; nn.placeholder = 'New product name'; nn.setAttribute('aria-label', 'New product name');
    const free = ['#0891b2', '#c2257f', '#ca8a04', '#16a34a', '#dc2626', '#7c3aed', '#ea580c', '#0f766e'].find(c => !LANES.some(l => String(l.c).toLowerCase() === c)) || '#0891b2', nc = { c: free };
    const pk = picker({ c: free, n: 'new product' }, v => { nc.c = v; pk.style.background = v; }); pk.querySelector('input').disabled = false;
    const add = el('button', 'btn primary sm', 'Add product'); add.type = 'button'; const em = el('span', 'gerr');
    const submit = () => { const m = addProduct(nn.value, nc.c); if (m) em.textContent = m; };
    add.addEventListener('click', submit); nn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    nf.append(pk, nn, add, em); sqCard.append(nf);
  }
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
      const mgb = el('button', 'btn sm iconbtn', '⋯'); mgb.type = 'button'; mgb.title = 'Name, merge, left the company: ' + p.name; mgb.setAttribute('aria-label', 'Manage ' + p.name); mgb.dataset.manage = p.name; mgb.addEventListener('click', () => openPerson(p.name)); w.append(mgb);
    }
    { const lvd = leavingMap()[p.name]; if (lvd) { const n = leaverWork(p.name, allRoadmaps, withRm).length, t = el('span', 'pmtag ' + (lvd < todayIso() ? 'left' : 'soon'), (lvd < todayIso() ? 'Left ' : 'Leaving ') + fmtIso(lvd) + (n ? ' · ' + n + ' to plan' : '')); t.dataset.left = p.name; t.title = n ? n + ' feature' + (n === 1 ? '' : 's') + ' of ' + p.name + ' run after the last working day and need a new owner' : 'No feature runs after the last working day'; w.append(t); } }
    c1.append(w);
    const c2 = el('td'), ds = selOf(DOMAINS, p.domain); ds.disabled = !canEdit(); ds.setAttribute('aria-label', 'Domain of ' + p.name);
    ds.addEventListener('change', () => savePerson(p.name, { domain: ds.value }, 'changed domain of ' + p.name + ' to ' + ds.value)); c2.append(ds);
    const c3 = el('td'), sw = el('div', 'formrow');
    LANES.forEach(l => { const b = el('button', 'pill', (p.sqs.has(l.k) ? '✓ ' : '') + l.n); b.type = 'button'; b.title = (p.sqs.has(l.k) ? 'Remove ' : 'Add ') + p.name + (p.sqs.has(l.k) ? ' from ' : ' to ') + l.n; b.prepend(el('i')); b.style.setProperty('--c', l.c); b.setAttribute('aria-pressed', String(p.sqs.has(l.k))); b.disabled = !canEdit();
      b.addEventListener('click', () => { const s = new Set(p.sqs); s.has(l.k) ? s.delete(l.k) : s.add(l.k); if (!s.size) { notify(p.name + ' must stay in at least one squad', 'err'); return; } notify(p.name + (s.has(l.k) ? ' added to ' : ' removed from ') + l.n); savePerson(p.name, { sqs: [...s], over: true }, 'changed squads of ' + p.name + ': ' + [...s].map(k => laneOf(k).n).join(' + ')); }); sw.append(b); });
    c3.append(sw);
    const c4 = el('td'); if (canDelete()) { const rm = el('button', 'btn danger sm', 'Remove'); rm.type = 'button'; rm.addEventListener('click', () => askRemove(p.name)); c4.append(rm); }
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
  root.append(pageHead('Approvals & permissions', 'People who registered wait here until you approve them. Below, choose what each person can do in every module and who else is an admin.'));
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
  root.append(requestsCard(renderAdmin));
  renderPermissions(root, again => { if (again === true) renderAdmin(); else return loadMembers(); });
}

