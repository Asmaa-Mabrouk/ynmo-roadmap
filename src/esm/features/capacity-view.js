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
import { SCALE, dependencyProblems, laneCapacity, loads, overAfter, ptsOf, settings, statusOf, totalPts } from './capacity.js';

const cfg = () => (S.ideas && S.ideas.capacity) || {};
const vacList = () => Object.keys(S.vacs || {}).map(id => S.vacs[id]).filter(v => v && v.a0);
const fmt = n => String(Math.round(n * 10) / 10);
const monthOfId = id => { const x = allCards().find(c => c.l.id === id); const d = x && S.reports[x.did]; return d && d.mo && d.mo !== 'backlog' ? d.mo : ''; };
const labelOf = id => fidLabel(id) || 'another card';
const dependants = id => allCards().filter(c => c.l.needs === id).map(c => c.l);

/** Short chips for a card: its points and what it needs. */
export function ptsChips(l) {
  const out = [], t = totalPts(l);
  if (t) { const s = el('span', 'chip mdpts', t + ' pts'); s.title = settings(cfg()).lanes.filter(x => ptsOf(l, x.k)).map(x => x.n + ' ' + ptsOf(l, x.k)).join(' · '); out.push(s); }
  if (l.needs) { const n = fidLabel(l.needs); if (n) { const s = el('span', 'chip mdneeds', 'Needs ' + n); s.title = 'This card needs ' + n + ' planned in the same month or earlier.'; out.push(s); } }
  return out;
}

/** Meters of one month: points used / plannable points for each role. */
export function capBlock(m, lines) {
  const rg = monthRange(m), s = settings(cfg()), vac = vacList(), ld = loads(lines);
  const rows = s.lanes.map(l => { const c = laneCapacity(l, rg, vac, cfg()); return { l: l, used: ld[l.k], cap: c.cap, st: statusOf(ld[l.k], c.cap), people: c.people }; });
  const over = rows.filter(r => r.st === 'over').length, tot = rows.reduce((a, r) => a + r.used, 0);
  const det = el('details', 'mdcap'); det.open = true;
  const sum = el('summary', '', 'Capacity · ' + (over ? over + ' over' : 'within limits') + (tot ? ' · ' + tot + ' pts planned' : ''));
  if (over) sum.classList.add('bad'); det.append(sum);
  rows.forEach(r => {
    const row = el('div', 'caprow cap-' + r.st); row.dataset.lane = r.l.k;
    const bar = el('span', 'capbar'), fill = el('i'); fill.style.width = Math.min(100, r.cap > 0 ? r.used / r.cap * 100 : (r.used ? 100 : 0)) + '%'; bar.append(fill);
    row.append(el('span', 'capn', r.l.n), bar, el('span', 'capv', fmt(r.used) + ' / ' + fmt(r.cap)));
    row.title = r.l.n + ': ' + fmt(r.used) + ' points planned, ' + fmt(r.cap) + ' can be planned (' + r.people + ' people, after leave, reserve and buffer).'; det.append(row);
  });
  return det;
}

/** Points by role and the "needs" link of one card. put(patch, log) saves it. */
export function openPoints(m, l, put) {
  openDlg('Points by role · ' + cardId(l), box => {
    box.append(el('div', 'sub2', l.t));
    const sels = {}, grid = el('div', 'padd'); grid.style.gridTemplateColumns = '1fr';
    settings(cfg()).lanes.forEach(x => { const s = el('select'); SCALE.forEach(v => { const o = el('option', '', v ? String(v) : '–'); o.value = String(v); s.append(o); }); s.value = String(ptsOf(l, x.k)); s.setAttribute('aria-label', x.n + ' points'); sels[x.k] = s; grid.append(fld(x.n, s)); });
    const nd = el('input'); nd.type = 'text'; nd.placeholder = 'Card id, for example BE card DC#12'; nd.value = l.needs ? fidLabel(l.needs) : ''; nd.setAttribute('aria-label', 'Needs card');
    const msg = el('p', 'sub'); msg.setAttribute('aria-live', 'polite');
    const ok = el('button', 'btn primary', 'Save'), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button'; no.addEventListener('click', closeDlg);
    ok.addEventListener('click', () => {
      const pts = {}; Object.keys(sels).forEach(k => { const v = +sels[k].value; if (v) pts[k] = v; });
      let needs = ''; if (nd.value.trim()) { needs = fidFromText(nd.value); if (!needs) { msg.textContent = 'No card with that id.'; return; } if (needs === l.id) { msg.textContent = 'A card cannot need itself.'; return; } }
      closeDlg(); put({ pts: Object.keys(pts).length ? pts : null, needs: needs || '' }, 'set the points of "' + l.t + '"');
    });
    const row = el('div', 'row'); row.append(ok, no);
    box.append(el('p', 'sub', 'Estimated by the team that does the work. Points are per role; a card needs points in each role it uses.'), grid, fld('Needs (planned in the same month or earlier)', nd), msg, row);
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
export function openCheckPlan(months) {
  const res = checkPlan(months);
  openDlg('Check plan', box => {
    if (!res.length) box.append(el('p', '', 'Everything fits: no role is over capacity, cards are in a workable order, and roadmap bars match their months.'));
    else { const names = { cap: 'Capacity', dep: 'Order', gantt: 'Roadmap dates' }; ['cap', 'dep', 'gantt'].forEach(t => { const r = res.filter(x => x.t === t); if (!r.length) return; box.append(el('h3', '', names[t] + ' (' + r.length + ')')); const ul = el('ul'); r.forEach(x => ul.append(el('li', '', monthLabel(x.m) + ' · ' + x.s))); box.append(ul); }); }
    const c = el('button', 'btn', 'Close'); c.type = 'button'; c.addEventListener('click', closeDlg); const row = el('div', 'row'); row.append(c); box.append(row);
  });
}

/** Points per person, reserve, buffer and who is in each role (editors). */
export function openCapSettings(done) {
  if (!canEdit()) return; const s = settings(cfg());
  openDlg('Capacity settings', box => {
    box.append(el('p', 'sub', 'Capacity of a role in a month = people x points per person, less their leave (from Vacations), less the reserve and buffer. Update the people each month.'));
    const mk = (v, step) => { const i = el('input'); i.type = 'number'; i.step = step; i.value = v; return i; };
    const ppp = mk(s.ppp, '0.5'), rs = mk(Math.round(s.reserve * 100), '5'), bf = mk(Math.round(s.buffer * 100), '5');
    box.append(fld('Points per person per month', ppp), fld('Reserve for bugs and support (%)', rs), fld('Buffer (%)', bf));
    const ta = {}; s.lanes.forEach(l => { const t = el('input'); t.type = 'text'; t.value = l.people.join(', '); t.setAttribute('aria-label', l.n + ' people'); ta[l.k] = t; box.append(fld(l.n + ' (names, comma separated)', t)); });
    const ok = el('button', 'btn primary', 'Save'), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button'; no.addEventListener('click', closeDlg);
    ok.addEventListener('click', () => { saveIdea('capacity', { cfg: true, ppp: +ppp.value, reserve: (+rs.value) / 100, buffer: (+bf.value) / 100, lanes: s.lanes.map(l => ({ k: l.k, people: ta[l.k].value.split(',').map(x => x.trim()).filter(Boolean) })) }, 'report', 'updated the capacity settings'); closeDlg(); if (done) done(); });
    const row = el('div', 'row'); row.append(ok, no); box.append(row);
  });
}
