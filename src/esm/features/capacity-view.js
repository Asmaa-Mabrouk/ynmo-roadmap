/**
 * @module features/capacity-view
 * Screens of the Monthly capacity: the meters under a month heading, the points dialog of a card, the warning before a move,
 * the "Check plan" list and the capacity settings. All rules live in capacity.js (pure); this file only draws and asks.
 */
import { S } from '../core/state.js';
import { el, canEdit } from '../core/model.js';
import { fld, kOfIso } from '../core/shared.js';
import { openDlg, closeDlg } from './safety.js';
import { saveIdea } from '../pages/ideas.js';
import { cardId, monthLabel, monthRange } from './month-model.js';
import { allCards, cardByFid, fidFromText, fidLabel } from './feature-sync.js';
import { SCALE, whoOf, dependencyProblems, laneCapacity, loads, overAfter, ptsOf, settings, statusOf, totalPts } from './capacity.js';

const cfg = () => (S.ideas && S.ideas.capacity) || {};
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
        const sel = el('select'); SCALE.forEach(v => { const o = el('option', '', v ? String(v) : 'points'); o.value = String(v); sel.append(o); }); sel.value = String(+cur[n] || 0); sel.disabled = !cb.checked; sel.setAttribute('aria-label', n + ' points');
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
/** Points per person, reserve, buffer and who is in each role (editors). */
export function openCapSettings(done) {
  if (!canEdit()) return; const s = settings(cfg());
  openDlg('Dashboard settings', box => {
    box.append(el('p', 'sub', 'Capacity of a role in a month = people x points per person, less their leave (from Vacations), less the reserve and buffer. Update the people each month.'));
    const mk = (v, step) => { const i = el('input'); i.type = 'number'; i.step = step; i.value = v; return i; };
    const ppp = mk(s.ppp, '0.5'), rs = mk(Math.round(s.reserve * 100), '5'), bf = mk(Math.round(s.buffer * 100), '5');
    box.append(fld('Points per person per month', ppp), fld('Reserve for bugs and support (%)', rs), fld('Buffer (%)', bf));
    const ta = {}; s.lanes.forEach(l => { const t = el('input'); t.type = 'text'; t.value = l.people.join(', '); t.setAttribute('aria-label', l.n + ' people'); ta[l.k] = t; box.append(fld(l.n + ' (names, comma separated)', t)); });
    const lv = el('input'); lv.type = 'text'; lv.placeholder = 'Adnan: 2026-12-15, Mona: 2027-01-31'; lv.value = Object.keys(s.leaving).map(n => n + ': ' + s.leaving[n]).join(', '); lv.setAttribute('aria-label', 'Leaving');
    box.append(fld('Leaving or left (name: last working day, comma separated)', lv));
    const msg = el('p', 'sub'); msg.setAttribute('aria-live', 'polite'); box.append(msg);
    const ok = el('button', 'btn primary', 'Save'), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button'; no.addEventListener('click', closeDlg);
    ok.addEventListener('click', () => {
      const leaving = {}, all = []; s.lanes.forEach(l => ta[l.k].value.split(',').forEach(x => { if (x.trim()) all.push(x.trim()); }));
      for (const part of lv.value.split(',').map(x => x.trim()).filter(Boolean)) { const i = part.lastIndexOf(':'), n = part.slice(0, i).trim(), d = part.slice(i + 1).trim(); if (i < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !all.includes(n)) { msg.textContent = '"' + part + '": write it as Name: 2026-12-15, and the name must be in a track above.'; return; } leaving[n] = d; }
      saveIdea('capacity', { cfg: true, leaving: leaving, ppp: +ppp.value, reserve: (+rs.value) / 100, buffer: (+bf.value) / 100, lanes: s.lanes.map(l => ({ k: l.k, people: ta[l.k].value.split(',').map(x => x.trim()).filter(Boolean) })) }, 'report', 'updated the capacity settings'); closeDlg(); if (done) done(); });
    const row = el('div', 'row'); row.append(ok, no); box.append(row);
  });
}
