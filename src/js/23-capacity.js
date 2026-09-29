/**
 * @module capacity
 * Capacity page.
 * Per-person weekly load heat-map computed from assignments minus leave days.
 * NOTE: all src/js files share one global scope (concatenated by build.mjs).
 */
/* ---------- 4. capacity ---------- */
function weekCols() {
  const cols = [];
  for (let k = 0; k < NDAYS; k++) { const w = Math.floor((k + STARTDOW) / 7); if (!cols[w]) cols[w] = { ks: [] }; cols[w].ks.push(k); }
  return cols.filter(Boolean);
}
function leaveDays(name) {
  const s = new Set(); vacsOf(name).forEach(v => { const a = kOfIso(v.a0), b = kOfIso(v.a1 || v.a0); for (let k = Math.max(0, a); k <= Math.min(NDAYS - 1, b); k++) s.add(k); }); return s;
}
function capacityData() {
  const all = items().filter(i => !i.ms), cols = weekCols(), dir = directory(), rows = [];
  const names = new Set(dir.keys()); all.forEach(i => i.res.forEach(n => names.add(n)));
  [...names].forEach(name => {
    const mine = all.filter(i => i.res.includes(name)); if (!mine.length && !vacsOf(name).length) return;
    const lv = leaveDays(name);
    const cells = cols.map(c => {
      let avail = 0, sched = 0, leave = 0; const its = new Set();
      c.ks.forEach(k => {
        if (DAYS[k].we || offAt(k)) return;
        const bars = mine.filter(i => k >= i.d0 && k <= i.d1);
        sched += bars.length; bars.forEach(b => its.add(b.t));
        if (lv.has(k)) leave++; else avail++;
      });
      const pct = avail > 0 ? Math.round(sched / avail * 100) : (sched > 0 ? Infinity : null);
      return { pct: pct, avail: avail, sched: sched, leave: leave, its: [...its] };
    });
    const peak = Math.max.apply(null, cells.map(c => c.pct === Infinity ? 999 : (c.pct || 0)));
    rows.push({ name: name, cells: cells, peak: peak, over: cells.filter(c => c.pct === Infinity || (c.pct || 0) > 100).length });
  });
  rows.sort((a, b) => b.over - a.over || b.peak - a.peak || a.name.localeCompare(b.name));
  return { cols: cols, rows: rows };
}
function renderCapacity() {
  const root = $('pg-capacity'); root.textContent = '';
  const d = capacityData();
  root.append(pageHead('Capacity', 'Load per person per week. Each bar counts as one full working day for every day it runs, so two bars at once is 200%. Leave and company days off are taken out of the week. Working days are Sunday to Thursday.', rmPicker(renderCapacity)));
  const overP = d.rows.filter(r => r.over).length;
  const sm = el('div', 'summary'); const mk = (n, t) => { const w = el('div'); w.append(el('b', '', String(n)), document.createTextNode(' '), el('span', '', t)); sm.append(w); };
  mk(d.rows.length, 'people with work or leave'); mk(overP, 'over 100% in at least one week'); mk(d.rows.filter(r => r.cells.some(c => c.pct === Infinity)).length, 'with work while on leave'); root.append(sm);
  const card = el('div', 'card capcard');
  if (!d.rows.length) { card.append(el('div', 'hint', 'Nobody has work in this roadmap yet.')); root.append(card); return; }
  const wrap = el('div', 'capwrap'); const t = el('table', 'captable'); t.setAttribute('aria-label', 'Weekly load per person');
  const th = el('thead'), hr = el('tr'); hr.append(el('th', '', 'Person'));
  d.cols.forEach(c => { const h = el('th', '', DAYS[c.ks[0]].d.getUTCDate() + ' ' + MN[DAYS[c.ks[0]].d.getUTCMonth()]); h.title = 'Week of ' + dlabel(c.ks[0]); h.scope = 'col'; hr.append(h); });
  th.append(hr); t.append(th);
  const tb = el('tbody');
  d.rows.forEach(r => {
    const tr = el('tr'), n = el('th', 'capname', r.name); n.scope = 'row'; if (r.over) n.append(el('small', 'warnx', ' ⚠ ' + r.over + (r.over === 1 ? ' week' : ' weeks'))); tr.append(n);
    r.cells.forEach(c => {
      const td = el('td', 'capcell'); let lab, cls;
      if (c.pct === null) { lab = c.leave ? 'Leave' : '–'; cls = c.leave ? 'lv' : 'none'; }
      else if (c.pct === Infinity) { lab = 'Leave!'; cls = 'x3'; }
      else { lab = c.pct + '%'; cls = c.pct === 0 ? 'none' : c.pct <= 70 ? 'lo' : c.pct <= 100 ? 'ok' : c.pct <= 150 ? 'x2' : 'x3'; }
      td.classList.add(cls); td.textContent = lab;
      td.title = r.name + ': ' + c.sched + ' bar-days on ' + c.avail + ' available day(s)' + (c.leave ? ', ' + c.leave + ' on leave' : '') + (c.its.length ? '\n' + c.its.join('\n') : '');
      td.setAttribute('aria-label', r.name + ' ' + lab + (c.its.length ? ', ' + c.its.join(', ') : '')); tr.append(td);
    });
    tb.append(tr);
  });
  t.append(tb); wrap.append(t); card.append(wrap);
  const lg = el('div', 'caplegend'); [['lo', 'up to 70%'], ['ok', '71–100%'], ['x2', '101–150%'], ['x3', 'over 150%'], ['lv', 'on leave']].forEach(x => { const s = el('span'); s.append(el('i', 'capcell ' + x[0]), document.createTextNode(x[1])); lg.append(s); });
  card.append(lg); root.append(card);
}

