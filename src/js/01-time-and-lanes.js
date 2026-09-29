/**
 * @module time-and-lanes
 * Time axis, static reference data and the data model.
 * Day-based timeline (setRange), squads/lanes, seed feature list (ITEMS), the `over` overlay of user edits on top of the seed, and the selectors items()/visible()/team()/directory() every view reads from.
 * NOTE: all src/js files share one global scope (concatenated by build.mjs).
 */
/* ---------- time axis: one column per day, rebuilt for each roadmap (Fri and Sat are the weekend) ---------- */
const DAY = 864e5, H2_ID = 'h2-2026', H2_START = Date.UTC(2026, 9, 1);
let START = H2_START, NDAYS = 123, STARTDOW = 4, todayK = -1;
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS = [], MGROUPS = [], MSTART = [], MEND = [];
function parseIso(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; }
function setRange(a, b) {
  START = parseIso(a); NDAYS = Math.max(1, Math.round((parseIso(b) - START) / DAY) + 1);
  DAYS.length = 0; MGROUPS.length = 0; MSTART.length = 0; MEND.length = 0;
  for (let k = 0; k < NDAYS; k++) {
    const d = new Date(START + k * DAY);
    DAYS.push({ k: k, d: d, dow: d.getUTCDay(), we: d.getUTCDay() === 5 || d.getUTCDay() === 6, mo: d.getUTCFullYear() * 12 + d.getUTCMonth() });
  }
  DAYS.forEach(x => {
    const last = MGROUPS[MGROUPS.length - 1];
    if (last && last.mo === x.mo) last.to = x.k;
    else MGROUPS.push({ mo: x.mo, from: x.k, to: x.k, n: MN[x.mo % 12] + ' ' + Math.floor(x.mo / 12) });
  });
  MGROUPS.forEach(m => { MSTART.push(m.from); MEND.push(m.to); });
  STARTDOW = new Date(START).getUTCDay();
  const nw = new Date(), k = Math.round((Date.UTC(nw.getFullYear(), nw.getMonth(), nw.getDate()) - START) / DAY); todayK = k >= 0 && k < NDAYS ? k : -1;
}
setRange('2026-10-01', '2027-01-31');
const LOWPRI = { 1: true, 2: true };   // Nov and Dec are marked LOW PRIORITY in the checkpoint (H2 2026 only)
const dlabel = k => DN[DAYS[k].dow] + ' ' + DAYS[k].d.getUTCDate() + ' ' + MN[DAYS[k].d.getUTCMonth()];
const iso = k => DAYS[k].d.toISOString().slice(0, 10);
function dayFromIso(s) { const t = parseIso(s); if (t === null) return null; const k = Math.round((t - START) / DAY); return k >= 0 && k < NDAYS ? k : null; }

const LANES = [
  { k: 'tifli', n: 'Tifli', c: 'var(--tifli)' },
  { k: 'ai', n: 'AI', c: 'var(--ai)' },
  { k: 'plan', n: 'Plan · Warif · Sharjah', c: 'var(--plan)' },
  { k: 'daycare', n: 'Daycare', c: 'var(--daycare)' }
];
const STATUS = { planned: 'Planned', decide: 'Needs decision', contract: 'Waiting on contract', done: 'Done' };
const PRODUCTS = [
  { v: 'tifli', n: 'Tifli', pr: ['tifli'] },
  { v: 'plan', n: 'Plan', pr: ['plan'] },
  { v: 'daycare', n: 'Daycare', pr: ['daycare'] },
  { v: 'dp', n: 'Daycare and Plan', pr: ['daycare', 'plan'] }
];
const ROLES = { pm: 'PM', dev: 'Engineer', qa: 'Quality', ux: 'UX' };
const COLORS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

const TEAMS = {
  tifli:   { pm: ['Emad'], dev: ['Aya Fathy', 'Hamid Shahin', 'Mario'], qa: ['Mona'], ux: ['Mostafa'] },
  plan:    { pm: ['Asmaa', 'Engy'], dev: ['Soliman', 'Amal', 'Waradny'], qa: ['Sherif', 'Zahran', 'Mwrohan'], ux: ['Saad', 'Khalid'] },
  daycare: { pm: ['Engy'], dev: ['Wardany', 'Sayeh', 'Abdelhamid'], qa: ['Dina Mousa', 'Merihan'], ux: ['Saad', 'Khalid'] },
  ai:      { pm: ['Asmaa'], dev: ['Tramsi', 'Aliaa', 'Sahdy'] }
};

const CP = 'September checkpoint', UR = 'Updated Roadmap (Shadow Teacher)';
const WARIF = 'Coordinate under the Support contract. The checkpoint notes column also says "Stop".';

const ITEMS = [
  // Tifli
  { id: 'hs1', t: 'Home Sessions: project setup', sq: 'tifli', pr: ['tifli'], s: 0, e: 0, st: 'planned', src: [UR], n: 'Prerequisite for Phase 1.' },
  { id: 'hs2', t: 'Home Sessions: analysis and requirements', sq: 'tifli', pr: ['tifli'], s: 0, e: 0, st: 'planned', src: [UR], n: 'Business meetings to define all requirements clearly.' },
  { id: 'hs3', t: 'Home Sessions: design finalization', sq: 'tifli', pr: ['tifli'], s: 0, e: 0, st: 'planned', src: [UR], n: 'Prerequisite for Phase 1.' },
  { id: 'hs4', t: 'Home Sessions / shadow teacher, Phase 1', sq: 'tifli', pr: ['tifli'], s: 1, e: 3, st: 'planned', src: [UR, CP],
    n: 'Staffing ask in the roadmap: 1 Mobile, 2 BE, 2 FE. Includes the checkpoint line "Home based/shadow teaching service automation".',
    ws: [
      'Practitioner supply layer: coverage areas, availability slots by location, search API, practitioner coverage and availability management, supervisor roles and permissions, shared table and filter components, API client and state for the new modules.',
      'Request management and status (portal): assignment, unified request details page, paid tab that requires supervisor assignment, separate tab for search-for-specialist requests, no-coverage path with a 3-working-day reply, remove Assign Practitioner and add Assign Supervisor.',
      'Mobile flow: four-stage request status after payment, practitioner profile (qualification, experience, nearest slot), draft auto-save and resume, child need and notes field, optional file upload with privacy controls, notifications to complete the request, new service-flow navigation, AR/EN RTL checks on new screens.',
      '12h / 24h packages, then payment.'
    ] },
  { id: 't5', t: 'Chain of Recommendations', sq: 'tifli', pr: ['tifli'], s: 0, e: 0, st: 'planned', tag: 'High priority', hi: true, src: [CP, UR],
    n: 'Lets the center specialist add a recommendation after the program ends, based on the child\'s latest report. Today recommendations exist only in the first consultation session.' },
  { id: 't6', t: 'Paid assessment report and GCC expansion', sq: 'tifli', pr: ['tifli'], s: 0, e: 0, st: 'planned', src: [CP, UR] },
  { id: 't7', t: 'Consultation and programs dashboard', sq: 'tifli', pr: ['tifli'], s: 0, e: 0, st: 'planned', src: [CP], n: 'Adds median time from assessment to consultation and from consultation to program.' },
  { id: 't8', t: 'Separate availability: individual, group, programs', sq: 'tifli', pr: ['tifli'], s: 1, e: 1, st: 'planned', src: [CP], n: 'Availability improvements.' },
  { id: 't9', t: 'Availability control for a specific day', sq: 'tifli', pr: ['tifli'], s: 1, e: 1, st: 'planned', src: [CP], n: 'For example every Wednesday. Availability improvements.' },
  { id: 't10', t: 'Standalone assessment: website per assessment', sq: 'tifli', pr: ['tifli'], s: 1, e: 1, st: 'planned', src: [UR] },
  { id: 't11', t: 'Standalone assessment marketplace: external users', sq: 'tifli', pr: ['tifli'], s: 2, e: 2, st: 'planned', src: [UR] },
  { id: 't12', t: 'Standalone assessment: MVP release', sq: 'tifli', pr: ['tifli'], s: 2, e: 2, st: 'planned', src: [CP], n: 'Also affects the SCHS report sync in the Plan squad.' },
  { id: 't13', t: 'Standalone assessment marketplace: portal users', sq: 'tifli', pr: ['tifli'], s: 3, e: 3, st: 'planned', src: [UR] },
  { id: 't14', t: 'Blue zone and new norms (filter)', sq: 'tifli', pr: ['tifli'], s: 2, e: 2, st: 'planned', src: [CP], n: 'The checkpoint links this to "Roadmap enhancements: Dynamic Roadmap".' },
  { id: 't15', t: 'Child journey: add diagnosis, in-center therapy, hearing screening', sq: 'tifli', pr: ['tifli'], s: 2, e: 2, st: 'decide', src: [CP], n: 'Under study.' },

  // AI
  { id: 'a1', t: 'AI lesson creation (Daycare)', sq: 'ai', pr: ['daycare'], s: 0, e: 0, st: 'planned', src: [UR, CP], n: 'Suggests learning or entertainment activities.',
    cf: 'The Updated Roadmap puts this in October. The checkpoint says "move to Jan". Shown in October.' },
  { id: 'a2', t: 'AI support agent (Daycare and Plan)', sq: 'ai', pr: ['daycare', 'plan'], s: 0, e: 0, st: 'planned', src: [UR] },
  { id: 'a3', t: 'Tifli voice calling: batch calls', sq: 'ai', pr: ['tifli'], s: 0, e: 0, st: 'planned', src: [UR, CP] },
  { id: 'a4', t: 'AI session notes (Daycare and Plan)', sq: 'ai', pr: ['daycare', 'plan'], s: 0, e: 0, st: 'decide', src: [CP], n: 'Built from submission data plus keywords the therapist enters. Ask the Operation team. The checkpoint says it is already covered by the AI message module.' },
  { id: 'a5', t: 'Tifli voice calling: supported programs booking, Phase 1', sq: 'ai', pr: ['tifli'], s: 1, e: 1, st: 'planned', src: [UR, CP], n: 'Listed in the checkpoint as "AI agent for supported programs (50 SR), Phase 1".' },
  { id: 'a6', t: 'AI sales agent on the landing page', sq: 'ai', pr: ['daycare', 'plan'], s: 1, e: 1, st: 'planned', src: [UR, CP], n: 'Low-touch design: the agent guides users to subscribe to Plan and Daycare. Moved from October to November.' },
  { id: 'a7', t: 'AI dashboard (Tifli)', sq: 'ai', pr: ['tifli'], s: 0, e: 2, st: 'planned', src: [CP, UR],
    cf: 'The checkpoint lists it in October and in November. The Updated Roadmap puts it in December. The bar covers October to December.' },
  { id: 'a8', t: 'AI dashboard (Daycare)', sq: 'ai', pr: ['daycare'], s: 2, e: 2, st: 'planned', src: [CP] },
  { id: 'a9', t: 'Simpler, clearer AI reports (Plan)', sq: 'ai', pr: ['plan'], s: 1, e: 1, st: 'planned', src: [CP], n: 'Report information needs to be simpler and clearer.' },
  { id: 'a10', t: 'AI notifications for repeated absences (Daycare)', sq: 'ai', pr: ['daycare'], s: 1, e: 1, st: 'planned', tag: 'Low priority', src: [CP], n: 'Notifies parents to check on the child after repeated absences.' },
  { id: 'a11', t: 'AI agent contacts family on absence (Daycare)', sq: 'ai', pr: ['daycare'], s: 2, e: 2, st: 'decide', src: [CP], n: 'Confirm with operations whether a WhatsApp message is enough.' },
  { id: 'a12', t: 'AI agent contacts family on absence (Plan)', sq: 'ai', pr: ['plan'], s: 2, e: 2, st: 'decide', src: [CP], n: 'Confirm with operations whether email could work.' },

  // Plan, Warif, Sharjah
  { id: 'p1', t: 'Reception feature and unified file', sq: 'plan', pr: ['plan'], s: 0, e: 0, st: 'decide', src: [CP], n: 'Related to Elite Phase II. Priority not defined. It may be covered by the admission list, where a child is added to the child list once the center accepts. Confirm with Abdelrahman.' },
  { id: 'p2', t: 'Attendance and absence counts with percentage in the schedule', sq: 'plan', pr: ['plan'], s: 0, e: 0, st: 'planned', src: [CP] },
  { id: 'p3', t: 'Assessment templates: psychological assessments', sq: 'plan', pr: ['plan'], s: 1, e: 1, st: 'decide', src: [CP], n: 'Needs clarification. Get the assessment from the Plan team.' },
  { id: 'p4', t: 'Search filter for family messages and phased plans', sq: 'plan', pr: ['plan'], s: 1, e: 1, st: 'planned', src: [CP], n: 'Filter by member name or a specific period.' },
  { id: 'p5', t: 'Select all and multi-select in lists', sq: 'plan', pr: ['plan'], s: 1, e: 1, st: 'decide', src: [CP], n: 'Phased plans, beneficiaries, reports, messages. Confirm the priority with Abdelrahman.' },
  { id: 'p6', t: 'Nudging system with CleverTap (Plan)', sq: 'plan', pr: ['plan'], s: 1, e: 1, st: 'planned', src: [CP, UR], n: 'CleverTap integration.' },
  { id: 'p7', t: 'SCHS to YNMO report sync', sq: 'plan', pr: ['plan'], s: 2, e: 2, st: 'decide', src: [CP], n: 'YNMO receives the new SCHS reports. Affected by the standalone assessment scope.' },
  { id: 'w1', t: 'Warif: Absent Justified and Absent Excused', sq: 'plan', pr: ['plan'], s: 0, e: 0, st: 'contract', tag: 'Warif', src: [CP], n: WARIF },
  { id: 'w2', t: 'Warif: attendance reports in days, not only percentages', sq: 'plan', pr: ['plan'], s: 0, e: 0, st: 'contract', tag: 'Warif', src: [CP], n: WARIF },
  { id: 'w3', t: 'Warif: header change on the health and educational plan', sq: 'plan', pr: ['plan'], s: 0, e: 0, st: 'done', tag: 'Warif', src: [CP], n: 'Replaces the question-and-answer rows with student information.' },
  { id: 'w4', t: 'Warif: replace "beneficiary" with "student"', sq: 'plan', pr: ['plan'], s: 0, e: 0, st: 'contract', tag: 'Warif', src: [CP], n: WARIF + ' Applies to all sections, titles and tabs.' },
  { id: 'w5', t: 'Warif: remove diagnosis from the IEP report intro', sq: 'plan', pr: ['plan'], s: 0, e: 0, st: 'contract', tag: 'Warif', src: [CP], n: WARIF },
  { id: 'w6', t: 'Warif: notifications with several links, image plus link, PDF', sq: 'plan', pr: ['plan'], s: 0, e: 0, st: 'contract', tag: 'Warif', src: [CP], n: WARIF },

  // Daycare
  { id: 'd1', t: 'Payment link from the portal for child subscription', sq: 'daycare', pr: ['daycare'], s: 0, e: 0, st: 'planned', tag: 'New', src: [CP] },
  { id: 'd2', t: 'Quood integration for nurseries', sq: 'daycare', pr: ['daycare'], s: 1, e: 1, st: 'planned', tag: 'New', src: [CP], n: 'Listed in October. The checkpoint says move to November.' },
  { id: 'd3', t: 'Drop the required attendance and departure times', sq: 'daycare', pr: ['daycare'], s: 1, e: 1, st: 'planned', src: [CP] },
  { id: 'd4', t: 'Permissions inside the messaging feature', sq: 'daycare', pr: ['daycare'], s: 1, e: 1, st: 'decide', src: [CP], n: 'Not defined yet. Follow up with Doaa.' },
  { id: 'd5', t: 'Nudging system with CleverTap (Daycare)', sq: 'daycare', pr: ['daycare'], s: 1, e: 1, st: 'planned', src: [CP, UR], n: 'CleverTap integration.' },
  { id: 'd6', t: 'Analyze parent engagement', sq: 'daycare', pr: ['daycare'], s: 2, e: 2, st: 'planned', src: [CP], n: 'Based on families\' interactions in the new activities module. With Doaa.' },
  { id: 'd7', t: 'Staff self check-in in the Mahd app', sq: 'daycare', pr: ['daycare'], s: 2, e: 2, st: 'planned', src: [CP] },
  { id: 'd8', t: 'Export data and reports across all features', sq: 'daycare', pr: ['daycare'], s: 2, e: 2, st: 'decide', src: [CP], n: 'Define the reports with Doaa.' }
];



const NOTES = [
  'The two roadmap files only give months. Each feature starts as a bar covering its whole month (or months), so set the real dates here.',
  'No Saudi public holidays fall between 1 Oct 2026 and 31 Jan 2027 (National Day was 23 Sep, Founding Day is 22 Feb 2027). Use Days off to shade team leave or company closures.',
  'Each feature keeps one set of dates. When one person has two features at the same time they sit one above the other inside their row and those days are shaded and counted as overlap. Hover a bar to highlight the same feature on the other rows.',
  'Resources start as the squad PM. Assign engineers, quality and UX per feature from the Resources column.',
  'Home Sessions Phase 1 needs 1 Mobile, 2 BE and 2 FE engineers. The Tifli squad lists 3 engineers (Aya Fathy, Hamid Shahin, Mario), and Standalone Assessment runs in the same months.',
  'The six Warif items have "To be coordinated according to the Support contract" as status and "Stop" as the note. They are shown as waiting on contract.',
  '"Waradny" (Plan squad) and "Wardany" (Daycare squad) are spelled two ways in the team list and are shown as written.',
  'Warif and Sharjah use the Plan UX pair (Saad and Khalid). Confirm if a different designer covers them.',
  'Items under "Later 2027" in the checkpoint are not on this chart.',
  'Edits are shared: anyone with edit access sees your changes.'
];

const FIELDS = ['t', 'sq', 'pr', 'd0', 'd1', 'st', 'n', 'res', 'c', 'ord', 'dep', 'ms'];
const base = new Map();
LANES.forEach(l => {
  ITEMS.map((it, i) => ({ it: it, i: i })).filter(x => x.it.sq === l.k)
    .sort((a, b) => a.it.s - b.it.s || a.i - b.i)
    .forEach((x, r) => base.set(x.it.id, Object.assign({}, x.it, { d0: MSTART[x.it.s], d1: MEND[x.it.e], ord: r })));
});
const state = { sq: new Set(LANES.map(l => l.k)), status: 'all', person: 'all', q: '', open: null, folded: new Set(), view: 'person', rm: H2_ID, zoom: 'day', page: 'roadmap' };
let over = {}, extras = {}, daysoff = {}, history = [], offOpen = false;
let db = null, dl = { save: async o => { const a = document.createElement('a'); const u = URL.createObjectURL(new Blob([o.data], { type: 'text/csv;charset=utf-8' })); a.href = u; a.download = o.filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); } }, readonly = false, inflight = 0, dragging = false, confirmKey = null, confirmTimer = 0, picker = null;

const $ = id => document.getElementById(id);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function prodKey(pr) { const k = (pr || []).slice().sort().join(','); const p = PRODUCTS.find(x => x.pr.slice().sort().join(',') === k); return p ? p.v : 'tifli'; }
function canEdit() { return !readonly; }
const byOrd = (a, b) => a.ord - b.ord || (a.id < b.id ? -1 : 1);

function finish(it) {
  it.d0 = Math.max(0, Math.min(NDAYS - 1, Math.round(it.d0)));
  it.d1 = Math.max(it.d0, Math.min(NDAYS - 1, Math.round(it.d1)));
  if (it.ms) it.d1 = it.d0;
  if (it.res === undefined) it.res = TEAMS[it.sq].pm.slice();
  return it;
}
function items() {
  const out = [];
  base.forEach((b, id) => {
    if (state.rm !== H2_ID) return;
    const o = over[id];
    if (o && o.x) return;
    const it = Object.assign({}, b);
    if (o) {
      FIELDS.forEach(f => { if (o[f] !== undefined) it[f] = o[f]; });
      if (o.d0 === undefined) { if (typeof o.w0 === 'number') it.d0 = Math.max(0, 7 * o.w0 - 4); else if (typeof o.s === 'number') it.d0 = MSTART[o.s]; }
      if (o.d1 === undefined) { if (typeof o.w1 === 'number') it.d1 = 7 * o.w1; else if (typeof o.e === 'number') it.d1 = MEND[o.e]; }
    }
    out.push(finish(it));
  });
  Object.keys(over).forEach(id => {
    const o = over[id];
    if (base.has(id) || !o.custom || o.x || (o.rm || H2_ID) !== state.rm) return;
    const it = Object.assign({ pr: ['tifli'], n: '', st: 'planned', d0: 0, d1: 13, ord: 0 }, o, { id: id, src: ['Added on this page'] });
    if (o.d0 === undefined) { if (typeof o.w0 === 'number') it.d0 = Math.max(0, 7 * o.w0 - 4); else if (typeof o.s === 'number') it.d0 = MSTART[o.s]; }
    if (o.d1 === undefined) { if (typeof o.w1 === 'number') it.d1 = 7 * o.w1; else if (typeof o.e === 'number') it.d1 = MEND[o.e]; }
    out.push(finish(it));
  });
  return out;
}
function team(it) {
  const own = TEAMS[it.sq], uniq = a => [...new Set(a)];
  return { pm: own.pm, dev: own.dev, qa: uniq(it.pr.flatMap(p => TEAMS[p].qa)), ux: uniq(it.pr.flatMap(p => TEAMS[p].ux)) };
}
const ROLE_DOMAIN = { pm: 'PM', dev: 'Engineering', qa: 'QA', ux: 'UX / Design' };
const domRole = d => d === 'PM' ? 'pm' : d === 'QA' ? 'qa' : d === 'UX / Design' ? 'ux' : 'dev';
function directory() {
  const map = new Map(), hidden = new Set();
  Object.keys(extras).forEach(id => { const x = extras[id]; if (x && x.hidden && x.n) hidden.add(x.n); });
  const add = (name, role, sq) => {
    if (hidden.has(name)) return;
    if (!map.has(name)) map.set(name, { name: name, roles: new Set(), sqs: new Set() });
    const p = map.get(name); p.roles.add(role); p.sqs.add(sq);
  };
  Object.keys(TEAMS).forEach(sq => ['pm', 'dev', 'qa', 'ux'].forEach(r => (TEAMS[sq][r] || []).forEach(n => add(n, r, sq))));
  Object.keys(extras).forEach(id => {
    const x = extras[id]; if (!x || !x.n || x.hidden) return;
    const sqs = x.sqs && x.sqs.length ? x.sqs : [x.sq || 'tifli'];
    if (!map.has(x.n)) map.set(x.n, { name: x.n, roles: new Set(), sqs: new Set() });
    const p = map.get(x.n);
    if (x.domain) { p.domain = x.domain; p.roles = new Set([domRole(x.domain)]); } else p.roles.add(x.role || 'dev');
    if (x.over) p.sqs = new Set(sqs); else sqs.forEach(s => p.sqs.add(s));
  });
  map.forEach(p => { p.domain = p.domain || ROLE_DOMAIN[[...p.roles][0]] || 'Other'; });
  return map;
}
function visible() {
  const q = state.q.trim().toLowerCase();
  return items().filter(it =>
    state.sq.has(it.sq) &&
    (state.status === 'all' || it.st === state.status) &&
    (state.person === 'all' || it.res.includes(state.person)) &&
    (!q || (it.t + ' ' + (it.n || '') + ' ' + it.res.join(' ')).toLowerCase().includes(q)));
}

