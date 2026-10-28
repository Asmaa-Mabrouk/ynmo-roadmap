/**
 * @module features/capacity-view
 * Screens of the Monthly capacity: the meters under a month heading, the points dialog of a card, the warning before a move,
 * the "Check plan" list and the capacity settings. All rules live in capacity.js (pure); this file only draws and asks.
 */
import { S } from '../core/state.js';
import { el, canEdit, directory } from '../core/model.js';
import { fld, kOfIso } from '../core/shared.js';
import { openDlg, closeDlg } from './safety.js';
import { saveIdea } from '../pages/ideas.js';
import { cardId, monthLabel, monthRange } from './month-model.js';
import { allCards, cardByFid, fidFromText, fidLabel } from './feature-sync.js';
import { HOURS_PER_POINT, SCALE, resolveDefaults, unmatched, whoOf, dependencyProblems, laneCapacity, loads, overAfter, ptsOf, settings, statusOf, totalPts } from './capacity.js';

/** The saved settings, with the default people spelled as Resources spells them. */
export const resources = () => [...directory().values()].map(p => ({ name: p.name, domain: p.domain }));
const cfg = () => resolveDefaults((S.ideas && S.ideas.capacity) || {}, resources());
const vacList = () => Object.keys(S.vacs || {}).map(id => S.vacs[id]).filter(v => v && v.a0);
const fmt = n => String(Math.round(n * 10) / 10);
const monthOfId = id => { const x = allCards().find(c => c.l.id === id); const d = x && S.reports[x.did]; return d && d.mo && d.mo !== 'backlog' ? d.mo : ''; };
const labelOf = id => fidLabel(id) || 'another card';
/** Order problems of putting a card in month `to` (plain sentences). */
export const depProblemsFor = (line, to) => dependencyProblems(line, to, monthOfId, labelOf, dependants(line.id));
const dependants = id => allCards().filter(c => c.l.needs === id).map(c => c.l);

/** Short chips for a card: its points and what it needs. */
export function ptsChips(l) {
  const out = [], t = totalPts(l);
  if (t) { const s = el('span', 'chip mdpts', t + ' pts'); s.title = settings(cfg()).lanes.filter(x => ptsOf(l, x.k)).map(x => { const w = whoOf(l, x.k), ns = Object.keys(w).map(n => n + ' ' + w[n]).join(', '); return x.n + ' ' + ptsOf(l, x.k) + (ns ? ' (' + ns + ')' : ''); }).join(' · '); out.push(s); }
  if (l.needs) { const n = fidLabel(l.needs); if (n) { const s = el('span', 'chip mdneeds', 'Needs ' + n); s.title = 'This card needs ' + n + ' planned in the same month or earlier.'; out.push(s); } }
  return out;
}

/** Points of one card in three steps: which tracks work on it, who in each track, and points for each person.
 *  Saves who = {track: {name: points}} and pts = the total per track (what the capacity meters use), plus `needs`. put(patch, log) saves it. */
export function openPoints(m, l, put) {
  openDlg('Points · ' + cardId(l), box => {
    box.classList.add('ptsdlg'); box.append(el('div', 'sub2', l.t));
    const st = settings(cfg()), tracks = {}, pills = el('div', 'ptpills');
    box.append(el('p', 'sub', 'Estimated by the team that does the work. First choose the tracks, then who works on it, then the points of each person.'), el('h3', '', '1. Which tracks work on this card?'), pills);
    st.lanes.forEach(x => {
      const cur = whoOf(l, x.k), legacy = !Object.keys(cur).length && ptsOf(l, x.k) > 0, on = Object.keys(cur).length > 0 || legacy;
      const t = { k: x.k, n: x.n, on: on, rows: {} }; tracks[x.k] = t;
      const pb = el('button', 'pill ptrack', x.n); pb.type = 'button'; pb.dataset.k = x.k; pb.setAttribute('aria-pressed', String(on)); pills.append(pb);
      const sec = el('div', 'ptsec'); sec.dataset.k = x.k; sec.hidden = !on; t.sec = sec;
      sec.append(el('h3', '', '2. ' + x.n + ': who works on it, and how many points each?'));
      if (legacy) sec.append(el('p', 'sub', 'This track had ' + ptsOf(l, x.k) + ' points in total before. Choose the people and give each their points.'));
      const names = x.people.slice(); Object.keys(cur).forEach(n => { if (!names.includes(n)) names.push(n); });
      names.forEach(n => {
        const row = el('div', 'pperson'); row.dataset.track = x.k; row.dataset.name = n;
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = n in cur; cb.setAttribute('aria-label', n + ' works on this card');
        const lab = el('label', 'ppname'); lab.append(cb, el('span', '', n));
        const sel = el('select'); SCALE.forEach(v => { const o = el('option', '', v ? v + ' · ' + v * HOURS_PER_POINT + ' h' : 'points'); o.value = String(v); sel.append(o); }); sel.value = String(+cur[n] || 0); sel.disabled = !cb.checked; sel.setAttribute('aria-label', n + ' points');
        cb.addEventListener('change', () => { sel.disabled = !cb.checked; if (!cb.checked) sel.value = '0'; sum(); }); sel.addEventListener('change', sum);
        row.append(lab, sel); sec.append(row); t.rows[n] = { cb: cb, sel: sel };
      });
      t.tot = el('div', 'pptot'); sec.append(t.tot); box.append(sec);
      pb.addEventListener('click', () => { t.on = !t.on; pb.setAttribute('aria-pressed', String(t.on)); sec.hidden = !t.on; sum(); });
    });
    function sum() { Object.keys(tracks).forEach(k => { const t = tracks[k]; t.tot.textContent = t.n + ' total: ' + Object.keys(t.rows).reduce((a, n) => a + (t.rows[n].cb.checked ? +t.rows[n].sel.value || 0 : 0), 0) + ' points'; }); }
    sum();
    const nd = el('input'); nd.type = 'text'; nd.placeholder = 'Card id, for example DC#12'; nd.value = l.needs ? fidLabel(l.needs) : ''; nd.setAttribute('aria-label', 'Needs card');
    const nw = el('div', 'padd'); nw.append(fld('Needs (a card that must be planned in the same month or earlier)', nd)); box.append(nw);
    const msg = el('p', 'sub'); msg.setAttribute('aria-live', 'polite');
    const ok = el('button', 'btn primary', 'Save'), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button'; no.addEventListener('click', closeDlg);
    ok.addEventListener('click', () => {
      const who = {}, pts = {};
      for (const k of Object.keys(tracks)) {
        const t = tracks[k]; if (!t.on) continue; const w = {};
        for (const n of Object.keys(t.rows)) { const r = t.rows[n]; if (!r.cb.checked) continue; const v = +r.sel.value; if (!v) { msg.textContent = 'Give ' + n + ' some points, or untick the name.'; return; } w[n] = v; }
        if (!Object.keys(w).length) { msg.textContent = 'Pick at least one person for ' + t.n + ', or switch the track off.'; return; }
        who[k] = w; pts[k] = Object.keys(w).reduce((a, n) => a + w[n], 0);
      }
      let needs = ''; if (nd.value.trim()) { needs = fidFromText(nd.value); if (!needs) { msg.textContent = 'No card with that id.'; return; } if (needs === l.id) { msg.textContent = 'A card cannot need itself.'; return; } }
      closeDlg(); put({ pts: Object.keys(pts).length ? pts : null, who: Object.keys(who).length ? who : null, needs: needs || '' }, 'set the points of "' + l.t + '"');
    });
    const row = el('div', 'row ptsfoot'); row.append(ok, no);
    box.append(msg, row);
  });
}

/** Before a card goes into month `to`: say what would break. go() does the move. */
export function guardMove(line, to, go) {
  if (!to || to === 'backlog' || !(totalPts(line) || line.needs || dependants(line.id).length)) { go(); return; }
  const rg = monthRange(to), dest = (S.reports['mo' + to.replace('-', '')] || { lines: [] }).lines || [];
  const probs = overAfter(line, dest, rg, vacList(), cfg()).map(o => o.n + ' would be ' + fmt(o.used) + ' of ' + fmt(o.cap) + ' points in ' + monthLabel(to) + '.')
    .concat(dependencyProblems(line, to, monthOfId, labelOf, dependants(line.id)));
  if (!probs.length) { go(); return; }
  openDlg('This move needs a look', box => {
    const ul = el('ul'); probs.forEach(p => ul.append(el('li', '', p)));
    const ok = el('button', 'btn danger', 'Move anyway'), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button'; no.addEventListener('click', closeDlg); ok.addEventListener('click', () => { closeDlg(); go(); });
    const row = el('div', 'row'); row.append(ok, no); box.append(el('p', '', '"' + line.t + '"'), ul, row);
  });
}

/** Everything that does not fit: capacity per role per month, card order, and roadmap dates outside the planned month. */
/** Everything that does not fit (also used by the Capacity page). */
export function checkPlan(months) {
  const out = [], vac = vacList();
  months.forEach(m => {
    const d = S.reports['mo' + m.replace('-', '')], lines = ((d && d.lines) || []).filter(l => String(l.t || '').trim()), rg = monthRange(m), ld = loads(lines);
    settings(cfg()).lanes.forEach(l => { const c = laneCapacity(l, rg, vac, cfg()); if (statusOf(ld[l.k], c.cap) === 'over') out.push({ m: m, t: 'cap', s: l.n + ': ' + fmt(ld[l.k]) + ' points planned, ' + fmt(c.cap) + ' can be planned.' }); });
    lines.forEach(l => {
      dependencyProblems(l, m, monthOfId, labelOf, []).forEach(p => out.push({ m: m, t: 'dep', s: cardId(l) + ' · ' + l.t + ': ' + p }));
      const bar = l.rid && S.over[l.rid]; if (bar && !bar.x && Number.isFinite(bar.d0) && Number.isFinite(bar.d1)) { const a = kOfIso(rg.a), b = kOfIso(rg.b); if (bar.d1 < a || bar.d0 > b) out.push({ m: m, t: 'gantt', s: cardId(l) + ' · ' + l.t + ': its roadmap bar is outside ' + monthLabel(m) + '.' }); }
    });
  });
  return out;
}
/** Points per person, reserve and buffer, who is in each track (picked from Resources) and who is leaving (editors). */
export function openCapSettings(done) {
  if (!canEdit()) return; const st = settings(cfg()), known = resources().map(r => r.name).sort((a, b) => a.localeCompare(b));
  const lanes = {}; st.lanes.forEach(l => { lanes[l.k] = l.people.slice(); }); const leaving = Object.assign({}, st.leaving);
  openDlg('Dashboard settings', box => {
    box.classList.add('ptsdlg');
    box.append(el('p', 'sub', 'People come from Resources. Capacity of a track in a month = its people x points per person, less their leave (Vacations), less the reserve and buffer.'));
    const mk = (v, step) => { const i = el('input'); i.type = 'number'; i.step = step; i.value = v; return i; };
    const ppp = mk(st.ppp, '0.5'), rs = mk(Math.round(st.reserve * 100), '5'), bf = mk(Math.round(st.buffer * 100), '5');
    const nums = el('div', 'padd'); nums.append(fld('Points per person per month (1 point = ' + HOURS_PER_POINT + ' hours; 40 = 20 days)', ppp), fld('Reserve for bugs and support (%)', rs), fld('Buffer (%)', bf)); box.append(nums);
    const body = el('div'); box.append(body);
    const draw = () => {
      body.textContent = '';
      st.lanes.forEach(l => {
        const sec = el('div', 'ptsec'); sec.dataset.k = l.k; sec.append(el('h3', '', l.n));
        const chips = el('div', 'ptpills'); lanes[l.k].forEach(n => { const c = el('button', 'pill', n + '  ×'); c.type = 'button'; c.dataset.name = n; c.title = known.includes(n) ? 'Remove ' + n : n + ' is not in Resources. Click to remove.'; if (!known.includes(n)) c.classList.add('nores'); c.addEventListener('click', () => { lanes[l.k] = lanes[l.k].filter(x => x !== n); draw(); }); chips.append(c); }); sec.append(chips);
        const add = el('select'); add.setAttribute('aria-label', 'Add a person to ' + l.n); const o0 = el('option', '', 'Add a person…'); o0.value = ''; add.append(o0);
        known.filter(n => !lanes[l.k].includes(n)).forEach(n => { const o = el('option', '', n); o.value = n; add.append(o); }); add.addEventListener('change', () => { if (add.value) { lanes[l.k].push(add.value); draw(); } });
        sec.append(add); body.append(sec);
      });
      const lv = el('div', 'ptsec'); lv.id = 'leavesec'; lv.append(el('h3', '', 'Leaving or left'), el('p', 'sub', 'The last working day. After it the person no longer counts.'));
      Object.keys(leaving).forEach(n => { const r = el('div', 'pperson'); r.dataset.name = n; const x = el('button', 'pill', n + ' · ' + leaving[n] + '  ×'); x.type = 'button'; x.addEventListener('click', () => { delete leaving[n]; draw(); }); r.append(x); lv.append(r); });
      const all = [...new Set([].concat(...Object.keys(lanes).map(k => lanes[k])))].sort((a, b) => a.localeCompare(b));
      const who = el('select'); who.setAttribute('aria-label', 'Person leaving'); all.forEach(n => { const o = el('option', '', n); o.value = n; who.append(o); });
      const dt = el('input'); dt.type = 'date'; dt.setAttribute('aria-label', 'Last working day');
      const ad = el('button', 'btn sm', 'Add'); ad.type = 'button'; ad.id = 'leaveadd'; ad.addEventListener('click', () => { if (who.value && /^\d{4}-\d{2}-\d{2}$/.test(dt.value)) { leaving[who.value] = dt.value; draw(); } });
      const row = el('div', 'padd'); row.append(fld('Person', who), fld('Last working day', dt)); lv.append(row, ad); body.append(lv);
    };
    draw();
    const ok = el('button', 'btn primary', 'Save'), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button'; no.addEventListener('click', closeDlg);
    ok.addEventListener('click', () => {
      saveIdea('capacity', { cfg: true, leaving: leaving, ppp: +ppp.value, reserve: (+rs.value) / 100, buffer: (+bf.value) / 100, lanes: st.lanes.map(l => ({ k: l.k, people: lanes[l.k] })) }, 'report', 'updated the dashboard settings'); closeDlg(); if (done) done();
    });
    const row = el('div', 'row ptsfoot'); row.append(ok, no); box.append(row);
  });
}
/** Names in the tracks that Resources does not list. */
export const missingInResources = () => unmatched(cfg(), resources());
