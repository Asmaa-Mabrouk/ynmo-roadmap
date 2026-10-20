/**
 * @module pages/reports
 * Weekly executive report. Editors build a draft per sprint (rules from the sprint plan + roadmap, optional Gemini wording via the
 * `weekly-draft` Edge Function), edit it, and an ADMIN submits it. Viewers (executives) see submitted reports only (also enforced by RLS).
 * One report per WEEK (sprints last two weeks). Doc `reports/rp<yyyymmdd of week start>`: {sp,n,w(1|2),a,b,status:'draft'|'submitted',pl:[{k,n,squads}],prods:{[k]:{sum,sumEdited,items:[...]}},by,ts,subAt,subBy,ai}.
 */
import { S } from '../core/state.js';
import { $, LANES, el } from '../core/model.js';
import { fld, fmtIso, kOfIso, logAct, pageHead, toast, todayIso } from '../core/shared.js';
import { write } from '../core/saving.js';
import { sb } from '../core/supabase.js';
import { canWrite, isViewer, openDlg, closeDlg } from '../features/safety.js';
import { allRoadmaps, withRm } from './roadmaps.js';
import { items, state } from '../core/model.js';
import { saveIdea } from './ideas.js';
import { itemsOf, parsePaste, sprintList } from './sprints.js';
import { notify } from '../ui/notify.js';
import { openMenu, closeMenu } from '../ui/menu.js';
import { crumbs } from '../ui/crumbs.js';
import { createUndo } from '../features/undo-stack.js';
import { registerUndo } from '../features/undo-router.js';
import { autoGrow, richBar, richBox, showRich, submitOnCtrlEnter } from '../features/rich-text.js';
import { GROUPS, RSTATUS, linePct, aiPayload, applyAi, buildProds, jiraUrl, newManualLine, overall, productsOf, reportToText, ruleSummary } from '../features/report-model.js';
import { monthOf, pctBand } from '../features/month-model.js';
import { monthSummary } from '../features/month-view.js';
import { confirmDlg } from '../ui/confirm.js';
import { isAdmin } from '../features/google-drive.js';
import { EXTRA_SECTIONS } from '../features/sprint-doc.js';

const SPARK = '<svg class="spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9zM5 15l.7 1.8 1.8.7-1.8.7L5 20l-.7-1.8L2.5 17.5l1.8-.7z"/></svg>';
const rUI = { busy: false, note: '', noteFor: '', err: false, wait: false, last: '' };
const routeId = () => { const m = /^#\/reports\/(\w+)/.exec(location.hash); return m ? m[1] : null; };
/** The product's colour on the Roadmap and Sprints pages (its first squad), so the report looks like them. */
const colOf = p => { const l = LANES.concat(EXTRA_SECTIONS).find(x => (p.squads || []).includes(x.k)); return l ? l.c : 'var(--brand)'; };
const cfg = () => S.ideas.reportcfg || {};
const uidr = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const canBuild = () => !isViewer() && canWrite();
export const reportList = () => Object.keys(S.reports).map(id => Object.assign({ id: id }, S.reports[id])).filter(r => r.a && (!isViewer() || r.status === 'submitted')).sort((x, y) => (x.a < y.a ? 1 : -1));
/** The report named in the address (#/reports/<id>), or null on the list. Viewers can only open submitted ones. */
const cur = () => { const id = routeId(); return id ? reportList().find(r => r.id === id) || null : null; };

/* ---- undo: one history per user and report; every save is a step, restoring the whole report (never over someone else's newer change) ---- */
const undoers = {}, baseline = {};
const undoR = id => { const k = ((S.me && S.me.id) || 'me') + ':' + id; return undoers[k] || (undoers[k] = createUndo(60)); };
const noStamp = d => { const c = JSON.parse(JSON.stringify(d)); delete c.by; delete c.ts; return JSON.stringify(c); };
function save(rep, log, label) {
  const id = rep.id, d = Object.assign({}, rep); delete d.id; d.by = (S.me && (S.me.name || S.me.email)) || ''; d.ts = Date.now(); S.reports[id] = d; write('reports/' + id, d);
  const before = baseline[id] ? JSON.parse(baseline[id]) : null, after = JSON.parse(JSON.stringify(d));
  if (before && before.status !== after.status) undoR(id).clear();   /* submit / reopen is never undone silently */
  else if (before && noStamp(before) !== noStamp(after)) { const U = undoR(id); U.mark(label || 'Edit'); U.rec(id, before, after); }
  baseline[id] = JSON.stringify(after);
  if (log) logAct('report', log);
}
let unsubR = null;
function reportUndo(dir) {
  const rep = cur(); if (!rep || rep.status === 'submitted' || isViewer() || !canBuild()) return;
  const r = undoR(rep.id).step(dir, id => S.reports[id], (id, doc) => { if (!doc) return; S.reports[id] = doc; write('reports/' + id, doc); baseline[id] = JSON.stringify(doc); }), word = dir === 'undo' ? 'Undo' : 'Redo';
  if (!r) { notify('Nothing to ' + word.toLowerCase(), 'info'); return; }
  notify(r.done ? word + ': ' + r.label : 'Someone else changed this report after you, so nothing was ' + (dir === 'undo' ? 'undone' : 'redone'), r.done ? 'ok' : 'info'); renderReports();
}
registerUndo('reports', { ready: () => { const r = cur(); return !!r && r.status !== 'submitted' && !isViewer() && canBuild(); }, undo: () => reportUndo('undo'), redo: () => reportUndo('redo') });
/** Roadmap bars for the roadmap that covers the sprint week, as day indexes of that roadmap. */
function roadFor(a, b) {
  const rm = allRoadmaps().find(r => r.a <= a && r.b >= a); if (!rm) return { road: [], ka: NaN, kb: NaN };
  return withRm(rm.id, () => ({ road: items().map(i => ({ id: i.id, t: i.t, sq: i.sq, d0: i.d0, d1: i.d1, st: i.st, ms: !!i.ms })), ka: kOfIso(a), kb: kOfIso(b) }));
}
const addDays = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
/** Weeks (2 per sprint) that have no report yet, newest first. */
export function missingWeeks() {
  const out = [];
  sprintList().forEach(sp => [1, 2].forEach(w => { const a = addDays(sp.a, (w - 1) * 7), id = 'rp' + a.replace(/-/g, ''); if (!S.reports[id]) out.push({ id: id, sp: sp.id, n: sp.n, w: w, a: a, b: addDays(a, 6) }); }));
  return out.sort((x, y) => (x.a < y.a ? 1 : -1));
}
function newReport(wk) {
  const id = wk.id; if (S.reports[id]) { location.hash = '#/reports/' + id; return; }
  const rep = { id: id, sp: wk.sp, n: wk.n, w: wk.w, a: wk.a, b: wk.b, status: 'draft', pl: productsOf(cfg()), prods: {} };
  location.hash = '#/reports/' + id;
  sync(rep, false, true);   /* a new report starts with empty product sections: the PM adds the items */
}
/** Human explanation of a failed call to the AI function (not deployed, key missing, not allowed, unreachable). */
async function aiWhy(e) {
  const c = e && e.context, st = c && c.status; let msg = '';
  try { if (c && c.json) { const j = await c.json(); msg = (j && (j.error || j.message)) || ''; } } catch (x) { /* body not JSON */ }
  if (!st && e && (e.name === 'FunctionsFetchError' || /Failed to send a request/i.test(e.message || ''))) return 'Could not reach the AI function. Most likely `weekly-draft` is not deployed on Supabase yet (or is named differently). Deploy it, then try again.';
  if (/HTTP (429|5\d\d)/.test(msg)) return 'Gemini is busy or overloaded right now (' + (msg.match(/HTTP \d+/) || [''])[0] + '). Nothing is wrong with your setup, wait a minute and try again.';
  if (/HTTP (401|403)/.test(msg)) return 'Gemini rejected the API key (' + (msg.match(/HTTP \d+/) || [''])[0] + '). Check GEMINI_API_KEY and that billing/quota is enabled.';
  if (st === 404) return 'The AI function is not deployed yet (weekly-draft). Deploy it in Supabase, then try again.';
  if (st === 401 || st === 403) return 'Not allowed: only signed-in editors and admins can use AI.';
  if (/GEMINI_API_KEY/i.test(msg)) return 'GEMINI_API_KEY is missing in Supabase Secrets.';
  if (st) return 'AI error (' + st + ')' + (msg ? ': ' + String(msg).slice(0, 140) : '') + '.';
  return 'Could not reach the AI function (' + String((e && e.message) || e || 'no answer').slice(0, 100) + ').';
}
const countLines = prods => Object.keys(prods).reduce((n, k) => n + prods[k].items.filter(l => !l.hide).length, 0);
const say = (rep, txt, bad) => { rUI.note = txt; rUI.noteFor = rep.id; rUI.err = !!bad; toast(txt); notify(txt, bad ? 'err' : 'ok'); };
/** Rules-only re-sync (never overwrites edited lines/summaries), then optionally the AI wording. Empty data is reported as an error, never sent to the AI. */
async function sync(rep, ai, isNew) {
  if (rUI.busy) return; rUI.busy = true; rUI.note = ''; rUI.err = false;
  /* Only the "Sync from Sprint & Roadmap" button pulls items in; a new report and the AI button never do. */
  const fill = !isNew && !ai, pl = productsOf(cfg()), { road, ka, kb } = fill ? roadFor(rep.a, rep.b) : { road: [], ka: NaN, kb: NaN }, sitems = fill ? itemsOf(rep.sp) : [];
  // Deployments / Quality scope sections get their own report section when no product already covers them.
  EXTRA_SECTIONS.forEach(x => { if (sitems.some(i => i.squad === x.k) && !pl.some(q => q.squads.includes(x.k))) pl.push({ k: x.k, n: x.n, squads: [x.k] }); });
  rep.pl = pl;
  if (fill) rep.prods = buildProds(pl, rep.prods, sitems, road, ka, kb, rep.a, rep.b);
  else { const keep = rep.prods || {}; rep.prods = {}; pl.forEach(p => { rep.prods[p.k] = keep[p.k] || { items: [], sum: '', sumH: '', sumEdited: false }; }); }   /* keep every line as it is; only make sure each product has a section */
  if (fill) rep.srcN = { si: sitems.length, rf: road.filter(r => Number.isFinite(ka) && r.d0 <= kb && r.d1 >= ka).length };
  const lines = countLines(rep.prods);
  save(rep, isNew ? 'created the weekly report for ' + fmtIso(rep.a) : 'synced the weekly report for ' + fmtIso(rep.a), 'Sync from sprint and roadmap');
  if (isNew) { say(rep, 'Report created. Add your items under each product.', false); rUI.busy = false; renderReports(); return; }
  if (!lines && !fill) { say(rep, 'There are no items to rewrite yet. Add items under a product first.', true); rUI.busy = false; renderReports(); return; }
  if (!lines) {
    say(rep, 'No data found for this week: Sprint ' + rep.n + ' has no items for these products and no roadmap bar overlaps ' + fmtIso(rep.a) + '. Add items on the Sprints page (or check Report settings), then sync again.', true);
    rUI.busy = false; renderReports(); return;
  }
  say(rep, fill ? 'Synced from Sprint and Roadmap' : 'Report updated', false); renderReports();
  if (ai) {
    rUI.note = 'Writing with Gemini…'; rUI.noteFor = rep.id; rUI.wait = true; renderReports();
    try {
      const r = await sb.functions.invoke('weekly-draft', { body: aiPayload(rep.a, pl, rep.prods) });
      if (r.error || !r.data || !r.data.products) throw r.error || new Error('no answer');
      const n = applyAi(rep.prods, r.data); rep.ai = { model: r.data.model || '', at: new Date().toISOString() };
      save(rep, '', 'AI wording'); say(rep, n ? 'AI wording applied (' + n + ' changes). Your own edits were kept.' : 'AI returned nothing new; the draft is unchanged.', false);
    } catch (e) { say(rep, (await aiWhy(e)) + ' The rule-based draft was kept.', true); }
    rUI.wait = false;
  }
  rUI.busy = false; renderReports();
}
/** Red banner shown when the SQL for sprints/reports has not been run on Supabase. */
export function setupBanner() {
  if (!(S.setup.reports || S.setup.sprints || S.setup.sprint_items)) return null;
  const b = el('div', 'rerr'); b.setAttribute('role', 'alert');
  b.append(el('b', '', 'Database setup needed. '), document.createTextNode('Run supabase/sql/06-sprints-weekly-reports.sql in the Supabase SQL Editor. Until then sprints and reports are NOT saved and nobody else can see them.'));
  return b;
}
function settingsDlg() {
  const cur0 = productsOf(cfg()).map(p => Object.assign({}, p, { squads: p.squads.slice() }));
  openDlg('Report settings', box => {
    const list = el('div', 'rsets');
    const draw = () => {
      list.textContent = '';
      cur0.forEach((p, i) => {
        const r = el('div', 'rsrow'), n = el('input'); n.value = p.n; n.setAttribute('aria-label', 'Product name'); n.addEventListener('input', () => { p.n = n.value; });
        r.append(n); LANES.concat(EXTRA_SECTIONS).forEach(l => { const c = el('input'); c.type = 'checkbox'; c.checked = p.squads.includes(l.k); c.addEventListener('change', () => { p.squads = p.squads.filter(x => x !== l.k); if (c.checked) p.squads.push(l.k); }); const lb = el('label', 'chk'); lb.append(c, document.createTextNode(' ' + l.n)); r.append(lb); });
        const x = el('button', 'btn sm danger', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Remove product'); x.addEventListener('click', () => { cur0.splice(i, 1); draw(); }); r.append(x); list.append(r);
      });
    };
    draw();
    const add = el('button', 'btn sm', '+ Product'); add.type = 'button'; add.addEventListener('click', () => { cur0.push({ k: 'p' + Date.now().toString(36), n: 'New product', squads: [] }); draw(); });
    const ok = el('button', 'btn primary', 'Save'), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button';
    ok.addEventListener('click', () => {
      const ps = cur0.filter(p => p.n.trim()).map(p => ({ k: p.k, n: p.n.trim(), squads: p.squads })); if (!ps.length) { notify('Keep at least one product', 'err'); return; }
      saveIdea('reportcfg', { cfg: true, products: ps }, 'report', 'updated the report settings'); notify('Report settings saved'); closeDlg(); renderReports();
    });
    no.addEventListener('click', closeDlg);
    const row = el('div', 'row'); row.append(ok, no);
    box.append(el('p', 'sub', 'One section per product. Tick the squads that belong to it.'), list, add, row);
  });
}

function viewLine(l) {
  const r = el('div', 'rv ln-' + l.st), t = el('span', 'rvt'); showRich(t, l.h, l.t); r.append(el('span', 'rvp pc-' + pctBand(linePct(l)), linePct(l) + '%'), t);
  const u = jiraUrl(cfg().jira, l.jira); if (l.jira) { const a = el(u ? 'a' : 'span', 'jira', l.jira); if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; } r.append(a); }
  (l.tg || []).forEach(x => r.append(el('span', 'tgchip tg-' + x.c, '#' + x.n)));
  if (l.st === 'risk' || l.st === 'late') r.append(el('span', 'chip rs-' + l.st, RSTATUS[l.st]));
  return r;
}
function lineRow(rep, d, l, ro) {
  if (ro) return viewLine(l);
  const r = el('div', 'rline ln-' + l.st + (l.hide ? ' hid' : '')); r.dataset.id = l.id;
  const touch = patch => { Object.assign(l, patch, { edited: true }); save(rep, '', patch.hide !== undefined ? (patch.hide ? 'Hide line' : 'Show line') : patch.pct !== undefined ? 'Change percentage' : patch.st ? 'Change status' : patch.g ? 'Move to another group' : 'Edit line'); };
  const pc = linePct(l), st = el('select', 'spsel mpct pc-' + pctBand(pc)); st.setAttribute('aria-label', 'Percent complete');
  const steps = []; for (let v = 0; v <= 100; v += 10) steps.push(v); if (!steps.includes(pc)) { steps.push(pc); steps.sort((a, b) => a - b); }
  steps.forEach(v => { const o = el('option', '', v + '%'); o.value = String(v); o.selected = v === pc; st.append(o); });
  st.addEventListener('change', () => { const v = Number(st.value); touch({ pct: v, st: v >= 100 ? 'done' : l.st === 'done' ? 'on' : l.st }); renderReports(); });
  const t = richBox('sptext', l.h, l.t, 'Line text', (h, pl) => { if (!pl) { showRich(t, l.h, l.t); return; } touch({ t: pl.slice(0, 1200), h: h.slice(0, 4000) }); });
  r.append(st, t);
  const u = jiraUrl(cfg().jira, l.jira);
  if (l.jira) { const a = el(u ? 'a' : 'span', 'jira', l.jira); if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; } r.append(a); }
  const g = el('select', 'spsel'); g.setAttribute('aria-label', 'Group'); GROUPS.forEach(x => { const o = el('option', '', x[1]); o.value = x[0]; o.selected = x[0] === l.g; g.append(o); });
  g.addEventListener('change', () => { touch({ g: g.value }); renderReports(); });
  const h = el('button', 'btn sm', l.hide ? 'Show' : 'Hide'); h.type = 'button'; h.addEventListener('click', () => { touch({ hide: !l.hide }); renderReports(); });
  const x = el('button', 'btn sm danger', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Delete line'); x.addEventListener('click', () => { if (l.src === 'man') d.items = d.items.filter(z => z.id !== l.id); else touch({ hide: true }); save(rep); renderReports(); });
  (l.tg || []).forEach(z => r.append(el('span', 'tgchip tg-' + z.c, '#' + z.n)));
  r.append(g, h, x);
  return r;
}
function prodBlock(rep, p, ro) {
  const d = rep.prods[p.k]; if (!d) return el('div');
  const sec = el('section', 'rprod'); sec.dataset.k = p.k; sec.style.setProperty('--c', colOf(p));
  const hd = el('div', 'rphead'), s = overall(d.items); hd.append(el('h2', '', p.n), el('span', 'chip rs-' + s, RSTATUS[s])); sec.append(hd);
  if (ro) { sec.classList.add('rview'); if (d.sum) { const sv = el('div', 'rsumv'); showRich(sv, d.sumH, d.sum); sec.append(sv); } }
  else sec.append(richBox('rsum', d.sumH, d.sum, 'Summary for ' + p.n, (h, pl) => { d.sum = pl || ruleSummary(p.n, d.items); d.sumH = pl ? h : ''; d.sumEdited = !!pl; save(rep); }));
  GROUPS.forEach(g => {
    const ls = d.items.filter(l => l.g === g[0] && (!ro || !l.hide));
    if (!ls.length && ro) return;
    const gh = el('div', 'rgrp'); gh.append(el('h3', '', g[1])); ls.forEach(l => gh.append(lineRow(rep, d, l, ro)));
    if (!ro) {
      const f = el('form', 'spadd'), ta = el('textarea'), go = el('button', 'btn sm', 'Add items'); go.type = 'submit';
      ta.rows = 2; autoGrow(ta); submitOnCtrlEnter(ta, f); ta.placeholder = 'Add to "' + g[1] + '": type or paste one or many items, one per line (bullets are removed). Ctrl+Enter adds.'; ta.setAttribute('aria-label', 'Add items to ' + g[1]);
      f.append(ta, go);
      f.addEventListener('submit', e => { e.preventDefault(); const rows = parsePaste(ta.value); if (!rows.length) { notify('Type at least one line first', 'err'); return; } rows.forEach(r => { const n = newManualLine(g[0], r.t); n.jira = r.jira; d.items.push(n); }); save(rep, 'added ' + rows.length + ' line' + (rows.length === 1 ? '' : 's') + ' to the weekly report', 'Add ' + rows.length + ' line' + (rows.length === 1 ? '' : 's')); notify(rows.length + ' line' + (rows.length === 1 ? '' : 's') + ' added to "' + g[1] + '"'); renderReports(); });
      gh.append(f);
    }
    sec.append(gh);
  });
  return sec;
}
const monthDocFor = rep => { const d = S.reports['mo' + monthOf(rep.a).replace('-', '')]; return d && (!isViewer() || d.status === 'submitted') ? d : null; };
const statsOf = r => { let all = 0, done = 0, prog = 0, risk = 0; Object.keys(r.prods || {}).forEach(k => ((r.prods[k] || {}).items || []).filter(l => !l.hide).forEach(l => { all++; if (l.g === 'done') done++; else if (l.g === 'prog') prog++; if (l.st === 'risk' || l.st === 'late') risk++; })); return { all: all, done: done, prog: prog, risk: risk }; };
const copyReport = rep => { const txt = reportToText(rep, rep.pl || productsOf(cfg()), fmtIso, monthDocFor(rep)); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => notify('Report text copied to the clipboard'), () => notify('Could not copy. Select the text and copy it manually.', 'err')); };
const settingsBtn = () => { const b = el('button', 'btn', 'Report settings'); b.type = 'button'; b.disabled = !canBuild(); b.addEventListener('click', settingsDlg); return b; };

function clearItems(rep) {
  confirmDlg('Remove all items from this report?', 'Every item under every product is removed so you can add your own. The product sections stay. You can undo this.', 'Remove all items', () => {
    Object.keys(rep.prods || {}).forEach(k => { rep.prods[k].items = []; rep.prods[k].sum = ''; rep.prods[k].sumH = ''; rep.prods[k].sumEdited = false; });
    save(rep, 'removed all items from the weekly report for ' + fmtIso(rep.a), 'Remove all items'); notify('All items removed. Add your own under each product.'); renderReports();
  });
}
/** Editors delete drafts; only an admin deletes a submitted report (the database enforces the same). */
const canDelete = r => canBuild() && (r.status !== 'submitted' || isAdmin());
function deleteReport(rep) {
  confirmDlg('Delete this weekly report?', 'The report for the week of ' + fmtIso(rep.a) + ' is deleted for everyone' + (rep.status === 'submitted' ? ', including the executives who can see it' : '') + '. The sprint and the roadmap are not touched.', 'Delete report', () => {
    delete S.reports[rep.id]; delete baseline[rep.id]; undoR(rep.id).clear(); write('reports/' + rep.id, null);
    logAct('report', 'deleted the weekly report for ' + fmtIso(rep.a)); notify('Report deleted'); location.hash = '#/reports'; renderReports();
  });
}

/* ---------- the list: one card per week, like the Sprints list ---------- */
function listView(pg, viewer, l) {
  const acts = el('div', 'acts');
  if (!viewer) {
    const free = missingWeeks(), t = todayIso(), pick = free.find(w => w.a <= t) || free[free.length - 1];
    if (pick) { const nb = el('button', 'btn primary', '+ New report for week of ' + fmtIso(pick.a)); nb.type = 'button'; nb.disabled = !canBuild(); nb.addEventListener('click', () => newReport(pick)); acts.append(nb); }
    acts.append(settingsBtn());
  }
  pg.append(pageHead('Weekly report', viewer ? 'Submitted weekly updates per product. Open one to read it.' : 'One report per week, built from the sprint plan and the roadmap. Open one to edit it, then submit it to the executives.', acts.children.length ? acts : null));
  const sb0 = viewer ? null : setupBanner(); if (sb0) pg.append(sb0);
  if (!l.length) { pg.append(el('p', 'empty', viewer ? 'No report has been submitted yet.' : sprintList().length ? 'No report yet. Click "+ New report" to create one for the latest sprint.' : 'Create a sprint first (Sprints page), then build the report.')); return; }
  const wrap = el('div', 'splist');
  l.forEach(r => {
    const st = statsOf(r), sub = r.status === 'submitted', pct = st.all ? Math.round(100 * st.done / st.all) : 0;
    const card = el('div', 'card spcard rpcard'), info = el('div');
    const a = el('a', 'splink'); a.href = '#/reports/' + r.id; a.append(el('h2', '', 'Week of ' + fmtIso(r.a) + ' – ' + fmtIso(r.b)));
    info.append(a, el('div', 'meta', 'Sprint ' + r.n + ' · week ' + (r.w || 1) + ' of 2 · ' + (sub ? 'submitted' + (r.subBy ? ' by ' + r.subBy : '') + (r.subAt ? ' on ' + fmtIso(r.subAt.slice(0, 10)) : '') : 'last edit ' + (r.by || 'unknown'))));
    const pr = el('div', 'prods'); (r.pl || []).filter(p => r.prods && r.prods[p.k]).forEach(p => { const c = el('span', 'pchip', p.n); c.style.setProperty('--c', colOf(p)); pr.append(c); }); info.append(pr);
    const prog = el('div', 'spprog'), top = el('div', 'rpstat'); top.append(el('span', 'chip rpst ' + (sub ? 'sub' : 'draft'), sub ? 'Submitted' : 'Draft'));
    prog.append(top, el('div', 'meta', st.done + ' delivered · ' + st.prog + ' in progress' + (st.risk ? ' · ' + st.risk + ' at risk' : '')));
    const b0 = el('div', 'bar0'), i0 = el('i'); i0.style.width = pct + '%'; b0.append(i0); prog.append(b0);
    const more = el('button', 'btn sm spmore', '⋯'); more.type = 'button'; more.setAttribute('aria-label', 'More actions for the week of ' + fmtIso(r.a)); more.setAttribute('aria-haspopup', 'menu');
    more.addEventListener('click', () => openMenu(more, [{ label: 'Open in new tab', value: 'tab' }, { label: 'Copy text', value: 'copy' }].concat(canDelete(r) ? [{ label: 'Delete report', value: 'del', danger: true }] : []), {
      search: false, label: 'Report actions', onPick: it => { if (it.value === 'tab') window.open(location.pathname + location.search + '#/reports/' + r.id, '_blank', 'noopener'); else if (it.value === 'del') deleteReport(r); else copyReport(r); }, onClose: () => more.focus()
    }));
    card.append(info, prog, more); wrap.append(card);
  });
  pg.append(wrap);
}

/* ---------- one report: a sheet like the sprint plan ---------- */
function detailView(pg, viewer, rep) {
  if (S.reports[rep.id]) baseline[rep.id] = JSON.stringify(S.reports[rep.id]);
  const sub = rep.status === 'submitted', ro = viewer || sub || !canBuild();
  pg.append(crumbs([{ label: 'Reports', href: '#/reports' }, { label: 'Week of ' + fmtIso(rep.a) }]));
  pg.append(pageHead('Weekly report', 'Sprint ' + rep.n + ' · week ' + (rep.w || 1) + ' of 2' + (viewer ? '' : ro ? '. Submitted reports are read-only.' : '. Edit anything, then submit it to the executives.')));
  const sb0 = viewer ? null : setupBanner(); if (sb0) pg.append(sb0);
  const srcTxt = rep.srcN ? ' · built from ' + rep.srcN.si + ' sprint items + ' + rep.srcN.rf + ' roadmap bars' : '';
  const meta = el('p', 'sub rmeta', sub ? 'Submitted' + (rep.subBy ? ' by ' + rep.subBy : '') + (rep.subAt ? ' on ' + fmtIso(rep.subAt.slice(0, 10)) : '') : 'Draft' + (rep.ai ? ' · wording by ' + (rep.ai.model || 'AI') : '') + ' · last edit ' + (rep.by || '') + srcTxt);
  const tools = el('div', 'row spbar rtools');
  const btn = (t, cls, fn, dis) => { const b = el('button', 'btn ' + (cls || ''), t); b.type = 'button'; b.disabled = !!dis; b.addEventListener('click', fn); tools.append(b); return b; };
  if (!viewer && !sub) { btn('Sync from Sprint & Roadmap', '', () => sync(rep, false), !canBuild() || rUI.busy); const ab = btn('', 'ai', () => sync(rep, true), !canBuild() || rUI.busy); ab.insertAdjacentHTML('afterbegin', SPARK); ab.append(document.createTextNode(rUI.wait ? 'Writing…' : 'Generate with AI')); ab.title = 'Rewrites unedited lines and summaries in executive wording. Your edits are kept.'; tools.prepend(ab); }
  if (!viewer && !sub) {
    const U = undoR(rep.id), ub = btn('↶ Undo', '', () => reportUndo('undo'), true), rb = btn('↷ Redo', '', () => reportUndo('redo'), true);
    const upd = () => { ub.disabled = !U.canUndo() || !canBuild(); rb.disabled = !U.canRedo() || !canBuild(); ub.title = ub.ariaLabel = U.canUndo() ? 'Undo: ' + U.nextUndo() + ' (Ctrl/Cmd+Z)' : 'Nothing to undo'; rb.title = rb.ariaLabel = U.canRedo() ? 'Redo: ' + U.nextRedo() + ' (Ctrl/Cmd+Shift+Z)' : 'Nothing to redo'; };
    if (unsubR) unsubR(); unsubR = U.subscribe(upd); upd();
  }
  if (!viewer && !sub) btn('Clear all items', '', () => clearItems(rep), !canBuild());
  btn('Copy text', '', () => copyReport(rep));
  btn('Print / PDF', '', () => { document.body.classList.add('print-report'); const off = () => { document.body.classList.remove('print-report'); window.removeEventListener('afterprint', off); }; window.addEventListener('afterprint', off); window.print(); });
  if (!viewer && !sub) tools.append(settingsBtn());
  if (canDelete(rep)) { const db = btn('Delete report', 'danger', () => deleteReport(rep)); db.classList.add('rdel'); }
  if (!viewer && !sub) btn('Submit to executives', 'primary', () => { rep.status = 'submitted'; rep.subAt = new Date().toISOString(); rep.subBy = S.me.name || S.me.email; save(rep, 'submitted the weekly report for ' + fmtIso(rep.a)); notify('Report submitted. Executives can now see it.'); renderReports(); }, !canBuild());
  if (!viewer && sub) btn('Reopen as draft', '', () => { rep.status = 'draft'; delete rep.subAt; delete rep.subBy; save(rep, 'reopened the weekly report for ' + fmtIso(rep.a)); notify('Report reopened as a draft. Executives no longer see it.', 'info'); renderReports(); }, !canBuild());
  const body = el('div', 'rbody sdoc'), pls = rep.pl || productsOf(cfg());
  const hero = el('div', 'rhero'); hero.append(el('small', '', 'Ynmo · Weekly product update'), el('h2', 'rtitle', fmtIso(rep.a) + ' – ' + fmtIso(rep.b)), el('span', 'rsp', 'Sprint ' + rep.n + ' · week ' + (rep.w || 1) + ' of 2')); body.append(hero);
  const glance = el('div', 'rglance');
  pls.forEach(p => { const d = rep.prods[p.k]; if (!d) return; const v = d.items.filter(l => !l.hide), s = overall(d.items), t = el('div', 'rtile rs-' + s); t.style.setProperty('--c', colOf(p)); t.append(el('b', '', p.n), el('span', 'chip rs-' + s, RSTATUS[s]), el('small', '', v.filter(l => l.g === 'done').length + ' delivered · ' + v.filter(l => l.g === 'prog').length + ' in progress · ' + v.filter(l => l.st === 'risk' || l.st === 'late').length + ' at risk')); glance.append(t); });
  body.append(glance); const mb = monthSummary(S.reports['mo' + monthOf(rep.a).replace('-', '')], pls, colOf, viewer); if (mb) body.append(mb); if (!ro) body.append(richBar());
  pls.forEach(p => body.append(prodBlock(rep, p, ro)));
  pg.append(meta, tools); if (rUI.note && rUI.noteFor === rep.id && !viewer && !sub) { const nt = el('p', 'rnote' + (rUI.err ? ' bad' : ''), rUI.note); nt.setAttribute('role', 'status'); pg.append(nt); } pg.append(body);
}

export function renderReports() {
  const pg = $('pg-reports'); if (!pg) return; closeMenu();
  const id = routeId(), keepY = id && rUI.last === id ? window.scrollY : 0; rUI.last = id || '';
  pg.textContent = '';
  const viewer = isViewer(), l = reportList(), rep = cur();
  pg.classList.toggle('sheet', !!rep);
  if (id && !rep) { pg.append(crumbs([{ label: 'Reports', href: '#/reports' }, { label: 'Not found' }]), pageHead('Report not found', viewer ? 'It may not be submitted yet, or it is still loading.' : 'It may have been removed, or it is still loading.')); return; }
  if (rep) detailView(pg, viewer, rep); else listView(pg, viewer, l);
  if (keepY && Math.abs(window.scrollY - keepY) > 1) window.scrollTo(0, keepY);
}
window.addEventListener('hashchange', () => { if (state.page === 'reports') renderReports(); });
