/**
 * @module pages/capacity
 * The Dashboard (route `capacity`): can the team deliver what each month promises? For the business, in plain words:
 * the months at a glance, what to fix (with a suggested move), the room left per track, and the team with leave and departures.
 * Reads the monthly boards (S.reports), the leave calendar (S.vacs) and the capacity settings (S.ideas.capacity). Changes nothing by itself.
 */
import { S } from '../core/state.js';
import { $, el, canEdit } from '../core/model.js';
import { fmtIso, pageHead, todayIso } from '../core/shared.js';
import { monthLabel, monthRange, nextMonth, isMonth, cardId } from '../features/month-model.js';
import { personCap, personLoads, personState, review, settings, suggestMoves } from '../features/capacity.js';
import { checkPlan, depProblemsFor, openCapSettings } from '../features/capacity-view.js';
import { showPage } from '../app/shell.js';

const cfg = () => (S.ideas && S.ideas.capacity) || {};
const fmt = n => String(Math.round(n * 10) / 10);
const ui = { m: '' }; /* month shown in the team section */
const WORD = { ok: 'Fits', warn: 'Tight', over: 'Over' };
const short = iso => fmtIso(iso).replace(/ \d{4}$/, '');

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
    const t = el('div', 'cptile cp-' + r.st); t.dataset.mo = r.m;
    const top = el('div', 'cptop'); top.append(el('strong', '', monthLabel(r.m)), el('span', 'cppill', WORD[r.st])); t.append(top);
    t.append(el('div', 'cpline', bad.length ? bad.map(x => x.n).join(', ') + (bad.length > 1 ? ' are over' : ' is over') : tight.length ? tight.map(x => x.n).join(', ') + (tight.length > 1 ? ' are almost full' : ' is almost full') : r.pts ? 'Everything fits' : 'Nothing planned yet'));
    t.append(el('div', 'cpsub', r.pts + ' points planned · ' + r.lines.length + ' card' + (r.lines.length === 1 ? '' : 's')));
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
  rev.forEach(r => { const ld = personLoads(r.lines); Object.keys(ld).forEach(n => { const cp = personCap(n, monthRange(r.m), vac, cfg()); if (ld[n] > cp + 1e-9) items.push({ sev: 'warn', m: r.m, head: monthLabel(r.m) + ' · ' + n + ' has too many points', body: n + ' has ' + fmt(ld[n]) + ' points planned and can take ' + fmt(cp) + ' (after leave, reserve and buffer).', tips: [] }); }); });
  checkPlan(months).filter(c => c.t !== 'cap').forEach(c => items.push({ sev: 'warn', m: c.m, head: monthLabel(c.m) + ' · ' + (c.t === 'dep' ? 'Card order' : 'Roadmap date'), body: c.s, tips: [] }));
  if (!items.length) { const ok = el('div', 'cpok', 'Nothing to fix. Every track fits in every month, cards are in a workable order and roadmap bars match their months.'); ok.id = 'cpnone'; box.append(ok); return box; }
  items.forEach(it => {
    const row = el('div', 'cpitem cp-' + it.sev); row.append(el('strong', '', it.head), el('div', '', it.body)); it.tips.forEach(t => row.append(el('div', 'cptip', t)));
    const go = el('button', 'btn sm', 'Open ' + monthLabel(it.m) + ' in Monthly'); go.type = 'button'; go.addEventListener('click', () => showPage('monthly')); row.append(go); box.append(row);
  });
  return box;
}

function room(rev) {
  const wrap = el('div', 'cproomwrap'), t = el('table', 'cproom'); t.id = 'cproom';
  const h = el('tr'); h.append(el('th', '', 'Track')); rev.forEach(r => h.append(el('th', '', monthLabel(r.m)))); t.append(el('thead')); t.firstChild.append(h);
  const b = el('tbody'); rev[0].lanes.forEach((l, i) => {
    const tr = el('tr'); tr.dataset.lane = l.k; tr.append(el('th', '', l.n));
    rev.forEach(r => { const x = r.lanes[i], td = el('td', 'cp-' + x.st); td.append(el('b', '', fmt(x.used) + ' / ' + fmt(x.cap)), el('span', '', x.st === 'over' ? fmt(x.over) + ' over' : fmt(x.free) + ' free')); td.title = x.n + ', ' + monthLabel(r.m) + ': ' + x.people + ' people, ' + fmt(x.used) + ' points planned of ' + fmt(x.cap) + '.'; tr.append(td); });
    b.append(tr);
  });
  t.append(b); wrap.append(t); return wrap;
}

function team(months) {
  if (!months.includes(ui.m)) ui.m = months[0];
  const s = settings(cfg()), today = todayIso(), vac = vacList(), grid = el('div', 'cpteam'), rg = monthRange(ui.m), ld = personLoads(linesOf(ui.m));
  const where = {}; s.lanes.forEach(l => l.people.forEach(p => { (where[p] = where[p] || []).push(l.n); }));
  s.lanes.forEach(l => {
    const c = el('div', 'cpcard'); c.dataset.lane = l.k;
    const away = l.people.filter(p => { const st = personState(p, today, vac, s.leaving); return st.onLeave || (st.leaving && st.leaving.state === 'left'); }).length;
    c.append(el('h3', '', l.n), el('div', 'cpsub', l.people.length + ' people' + (away ? ' · ' + away + ' not available now' : '')));
    l.people.forEach(p => {
      const st = personState(p, today, vac, s.leaving), row = el('div', 'cpperson'); row.dataset.name = p; row.append(el('span', 'cpname', p));
      const tags = el('span', 'cptags');
      if (st.leaving) tags.append(el('span', 'cptag ' + (st.leaving.state === 'later' ? 'info' : 'bad'), st.leaving.state === 'left' ? 'Left on ' + short(st.leaving.date) : 'Leaving ' + short(st.leaving.date) + (st.leaving.state === 'soon' ? ' (soon)' : '')));
      if (st.onLeave) tags.append(el('span', 'cptag warn', 'On leave until ' + short(st.leave.a1)));
      else if (st.leave) tags.append(el('span', 'cptag info', 'Leave ' + short(st.leave.a0) + (st.leave.a1 > st.leave.a0 ? ' to ' + short(st.leave.a1) : '')));
      const cp = personCap(p, rg, vac, cfg()), pl = ld[p] || 0;
      if (cp > 0 || pl > 0) tags.append(el('span', 'cptag ' + (pl > cp + 1e-9 ? 'bad' : pl >= cp * 0.9 && pl > 0 ? 'warn' : 'info') + ' cpload', fmt(pl) + ' / ' + fmt(cp) + ' pts'));
      if (where[p].length > 1) tags.append(el('span', 'cptag', 'Also in ' + where[p].filter(n => n !== l.n).join(', ')));
      row.append(tags); c.append(row);
    });
    grid.append(c);
  });
  return grid;
}

export function renderCapacity() {
  const root = $('pg-capacity'); root.textContent = '';
  const months = capMonths(), rev = review(months, { linesOf: linesOf, rangeOf: monthRange, vacs: vacList(), cfg: cfg() });
  const tools = el('div', 'row');
  const mo = el('button', 'btn sm', 'Open Monthly'); mo.type = 'button'; mo.addEventListener('click', () => showPage('monthly')); tools.append(mo);
  if (canEdit()) { const cs = el('button', 'btn sm', 'Dashboard settings'); cs.type = 'button'; cs.id = 'cpsettings'; cs.addEventListener('click', () => openCapSettings(renderCapacity)); tools.append(cs); }
  root.append(pageHead('Dashboard', 'Can the team deliver what each month promises? Points planned in Monthly are compared with what each track can take, after leave, a reserve for bugs and support, and a buffer.', tools));
  const sec = (id, t, sub) => { const c = el('section', 'cpsec'); c.id = id; c.append(el('h2', '', t)); if (sub) c.append(el('p', 'sub', sub)); root.append(c); return c; };
  sec('cp-glance', 'The months at a glance').append(tiles(rev));
  sec('cp-fix', 'What needs fixing', 'If something is over, change the points or move a card in Monthly, then come back here.').append(fixes(rev, months));
  sec('cp-room', 'Room left in each track', 'Used / can take, in points. "Free" is what a track can still add; this is what can be moved in.').append(room(rev));
  const ts = sec('cp-team', 'The team', 'Who is in each track, what each person has planned in the month you pick (points planned / points they can take), who is on leave, and who has left or is about to leave (set in Dashboard settings).');
  const mp = el('select'); mp.id = 'cpmonth'; mp.setAttribute('aria-label', 'Month'); months.forEach(m => { const o = el('option', '', monthLabel(m)); o.value = m; o.selected = m === ui.m; mp.append(o); }); mp.addEventListener('change', () => { ui.m = mp.value; renderCapacity(); });
  ts.append(mp, team(months));
}
