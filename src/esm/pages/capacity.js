/**
 * @module pages/capacity
 * The Dashboard (route `capacity`): can the team deliver what each month promises? For the business, in plain words:
 * the months at a glance, what to fix (with a suggested move), the room left per track, and the team with leave and departures.
 * Reads the monthly boards (S.reports), the leave calendar (S.vacs) and the capacity settings (S.ideas.capacity). Changes nothing by itself.
 */
import { S } from '../core/state.js';
import { $, el, canEdit } from '../core/model.js';
import { pageHead, todayIso } from '../core/shared.js';
import { monthLabel, monthRange, nextMonth, isMonth, cardId } from '../features/month-model.js';
import { DOMAIN_OF, personCap, personCards, personLoads, personState, resolveDefaults, review, settings, suggestMoves } from '../features/capacity.js';
import { checkPlan, depProblemsFor, missingInResources, openCapSettings, resources } from '../features/capacity-view.js';
import { write } from '../core/saving.js';
import { logAct } from '../core/shared.js';
import { fillPersons } from '../ui/people-picker.js';
import { showPage } from '../app/shell.js';
import { barsTracks, columnsTrend, heatPeople, heatTracks, icon, legend, tipHost, withTable } from './capacity-charts.js';

const cfg = () => resolveDefaults((S.ideas && S.ideas.capacity) || {}, resources());
const fmt = n => String(Math.round(n * 10) / 10);
const ui = { m: '' }; /* month shown in the team section */
const WORD = { ok: 'Fits', warn: 'Tight', over: 'Over' };

/** From this month to the last month that has a board (never fewer than four months). */
export function capMonths() {
  const cur = todayIso().slice(0, 7); let last = cur;
  for (let i = 0; i < 3; i++) last = nextMonth(last);
  Object.keys(S.reports || {}).forEach(id => { const d = S.reports[id]; if (d && isMonth(d.mo) && d.mo > last) last = d.mo; });
  const out = []; for (let m = cur; m <= last; m = nextMonth(m)) out.push(m);
  return out;
}
const linesOf = m => { const d = S.reports['mo' + m.replace('-', '')]; return ((d && d.lines) || []).filter(l => String(l.t || '').trim()); };
const vacList = () => Object.keys(S.vacs || {}).map(id => S.vacs[id]).filter(v => v && v.a0);

function tiles(rev) {
  const g = el('div', 'cpgrid');
  rev.forEach(r => {
    const bad = r.lanes.filter(x => x.st === 'over'), tight = r.lanes.filter(x => x.st === 'warn');
    const t = el('button', 'cptile cp-' + r.st + (r.m === ui.m ? ' sel' : '')); t.type = 'button'; t.dataset.mo = r.m; t.setAttribute('aria-pressed', String(r.m === ui.m)); t.title = 'Show ' + monthLabel(r.m) + ' in the bars below'; t.addEventListener('click', () => { ui.m = r.m; renderCapacity(); });
    const top = el('div', 'cptop'), ic = el('span', 'cpicob'); ic.append(icon(r.st)); top.append(ic, el('span', 'cppill', WORD[r.st])); t.append(top);
    t.append(el('div', 'cpbig', String(r.pts)), el('div', 'cpsub', 'points planned · ' + r.lines.length + ' card' + (r.lines.length === 1 ? '' : 's')), el('strong', 'cpmonth', monthLabel(r.m)));
    t.append(el('div', 'cpline', bad.length ? bad.map(x => x.n).join(', ') + (bad.length > 1 ? ' are over' : ' is over') : tight.length ? tight.map(x => x.n).join(', ') + (tight.length > 1 ? ' are almost full' : ' is almost full') : r.pts ? 'Everything fits' : 'Nothing planned yet'));
    g.append(t);
  });
  return g;
}

function fixes(rev, months) {
  const box = el('div', 'cpfix'), items = [];
  const sug = suggestMoves(rev, { rangeOf: monthRange, vacs: vacList(), cfg: cfg(), probsOf: depProblemsFor });
  rev.forEach(r => r.lanes.filter(x => x.st === 'over').forEach(x => {
    const mv = sug.filter(s => s.m === r.m && s.k === x.k && !s.none), none = sug.some(s => s.m === r.m && s.k === x.k && s.none);
    const it = { sev: 'over', m: r.m, head: monthLabel(r.m) + ' · ' + x.n + ' is over by ' + fmt(x.over) + ' points', body: x.n + ' has ' + fmt(x.used) + ' points planned and can take ' + fmt(x.cap) + '.', tips: [] };
    mv.forEach(s => it.tips.push('You could move "' + s.line.t + '" (' + cardId(s.line) + ', ' + s.pts + ' ' + x.n + ' points) to ' + monthLabel(s.to) + '. It fits there.'));
    if (none) it.tips.push('No later month has room for a card of this track. Cut some scope or add people.');
    items.push(it);
  }));
  const vac = vacList(), seen = {};
  rev.forEach(r => {
    const ld = personLoads(r.lines), over = Object.keys(ld).map(n => ({ n: n, pl: ld[n], cp: personCap(n, monthRange(r.m), vac, cfg()) })).filter(x => x.pl > x.cp + 1e-9);
    if (over.length) items.push({ sev: 'warn', m: r.m, head: monthLabel(r.m) + ' · ' + over.length + (over.length === 1 ? ' person has' : ' people have') + ' more points than they can take', body: over.map(x => x.n + ' ' + fmt(x.pl) + ' / ' + fmt(x.cp) + ' (' + personCards(r.lines, x.n).slice(0, 6).map(c => '"' + c.t + '" ' + fmt(c.pts)).join(', ') + ')').join('; ') + '. Planned / can take, after leave, support and buffer.', tips: [] });
  });
  checkPlan(months).filter(c => c.t !== 'cap').forEach(c => items.push({ sev: 'warn', m: c.m, head: monthLabel(c.m) + ' · ' + (c.t === 'dep' ? 'Card order' : 'Roadmap date'), body: c.s, tips: [] }));
  if (!items.length) { const ok = el('div', 'cpok'); ok.append(icon('ok'), el('span', '', 'Nothing to fix. Every track fits in every month, cards are in a workable order and roadmap bars match their months.')); ok.id = 'cpnone'; box.append(ok); return box; }
  items.forEach(it => {
    const row = el('div', 'cpitem cp-' + it.sev), ib = el('span', 'cpicob'); ib.append(icon(it.sev === 'over' ? 'over' : 'warn')); const tx = el('div', 'cpitx'); tx.append(el('strong', '', it.head), el('div', '', it.body)); row.append(ib, tx); it.tips.forEach(t => tx.append(el('div', 'cptip', t)));
    const go = el('button', 'btn sm', 'Open ' + monthLabel(it.m) + ' in Monthly'); go.type = 'button'; go.addEventListener('click', () => showPage('monthly')); tx.append(go); box.append(row);
  });
  return box;
}

/** Four numbers for the chosen month, as icon tiles. */
function kpis(rev) {
  const r = rev.find(x => x.m === ui.m) || rev[0], g = el('div', 'cpkpis'); g.id = 'cpkpi';
  const st = settings(cfg()), today = todayIso(), vac = vacList(), seen = {}; let away = 0;
  st.lanes.forEach(l => l.people.forEach(n => { if (seen[n]) return; seen[n] = 1; const p = personState(n, today, vac, st.leaving); if (p.onLeave || (p.leaving && p.leaving.state !== 'later')) away++; }));
  const cap = r.lanes.reduce((a, x) => a + x.cap, 0), over = r.lanes.filter(x => x.st === 'over').length;
  [['points', fmt(r.pts), 'Points planned'], ['cap', fmt(cap), 'All tracks can take'], [over ? 'over' : 'ok', String(over), over === 1 ? 'Track over the limit' : 'Tracks over the limit'], ['away', String(away), 'People on leave, leaving or left']].forEach(x => {
    const t = el('div', 'cpkpi' + (x[0] === 'over' ? ' bad' : '')); t.dataset.k = x[0]; const ic = el('span', 'cpicob'); ic.append(icon(x[0])); t.append(ic, el('b', '', x[1]), el('span', '', x[2])); g.append(t);
  });
  return g;
}
/** Names in the tracks that Resources does not list yet: say so, and (editors) add them. */
function missingNote() {
  const miss = missingInResources(); if (!miss.length) return null;
  const box = el('div', 'cpitem cp-warn'); box.id = 'cpmissing';
  const ib = el('span', 'cpicob'); ib.append(icon('warn')); const tx = el('div', 'cpitx'); box.append(ib, tx);
  tx.append(el('strong', '', miss.length + (miss.length === 1 ? ' name is' : ' names are') + ' not in Resources yet'), el('div', '', miss.map(x => x.name + ' (' + x.track + ')').join(', ') + '. Leave from Vacations and the roadmap can only follow people who are listed in Resources.'));
  if (canEdit()) {
    const b = el('button', 'btn sm primary', 'Add them to Resources'); b.type = 'button'; b.id = 'cpaddres';
    b.addEventListener('click', () => { miss.forEach(x => { const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); S.extras[id] = { n: x.name, domain: DOMAIN_OF[x.k], sqs: ['tifli'] }; write('people/' + id, S.extras[id]); logAct('resource', 'added ' + x.name + ' (' + DOMAIN_OF[x.k] + ') from the Dashboard'); }); fillPersons(); renderCapacity(); });
    tx.append(b);
  }
  return box;
}

export function renderCapacity() {
  const root = $('pg-capacity'); root.textContent = '';
  const months = capMonths(), rev = review(months, { linesOf: linesOf, rangeOf: monthRange, vacs: vacList(), cfg: cfg() });
  const tools = el('div', 'row');
  const mo = el('button', 'btn sm', 'Open Monthly'); mo.type = 'button'; mo.addEventListener('click', () => showPage('monthly')); tools.append(mo);
  if (canEdit()) { const cs = el('button', 'btn sm', 'Dashboard settings'); cs.type = 'button'; cs.id = 'cpsettings'; cs.addEventListener('click', () => openCapSettings(renderCapacity)); tools.append(cs); }
  root.append(pageHead('Dashboard', 'Can the team deliver what each month promises? Green fits, red is over.', tools));
  tipHost(root);
  if (!months.includes(ui.m)) ui.m = (rev.find(r => r.pts > 0) || rev[0]).m;
  const sec = (id, t, sub) => { const c = el('section', 'cpsec'); c.id = id; c.append(el('h2', '', t)); if (sub) c.append(el('p', 'sub', sub)); root.append(c); return c; };
  const chartSec = (id, t, sub, ch, tbl, extra) => { const s2 = sec(id, t, sub); if (extra) s2.append(extra); s2.append(withTable(id + '-c', '', '', ch, tbl)); return s2; };
  sec('cp-glance', 'The months at a glance', 'Click a month to see it track by track below.').append(tiles(rev));
  sec('cp-kpi', monthLabel(ui.m) + ' in numbers').append(kpis(rev));
  const fx = sec('cp-fix', 'What needs fixing', 'If something is over, change the points or move a card in Monthly, then come back here.'); const mn = missingNote(); if (mn) fx.append(mn); fx.append(fixes(rev, months));
  const h1 = heatTracks(rev); chartSec('cp-heat', 'How full is each track', 'Darker = fuller. Red with a triangle = over. Each box: share, then planned / can take (points).', h1.node, h1.table, legend());
  const duo = el('div', 'cpduo'); root.append(duo);
  const barSec = el('section', 'cpsec'); barSec.id = 'cp-bars'; barSec.append(el('h2', '', monthLabel(ui.m) + ', track by track'), el('p', 'sub', 'Pale = what the track can take. Green = planned. Red = past the limit.')); const h3 = barsTracks(rev[months.indexOf(ui.m)]); barSec.append(withTable('cp-bars-c', '', '', h3.node, h3.table));
  const colsSec = el('section', 'cpsec'); colsSec.id = 'cp-cols'; colsSec.append(el('h2', '', 'Month by month'), el('p', 'sub', 'Columns = points planned. Dark tick = what all tracks can take.')); const h2 = columnsTrend(rev); colsSec.append(withTable('cp-cols-c', '', '', h2.node, h2.table));
  duo.append(barSec, colsSec);
  const h4 = heatPeople(rev, cfg(), vacList(), todayIso()); chartSec('cp-heatp', 'The team', 'Each person: points planned / what they can take, with leave and who has left or is leaving.', h4.node, h4.table, legend());
}
