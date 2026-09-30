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
import { items } from '../core/model.js';
import { saveIdea } from './ideas.js';
import { itemsOf, sprintList } from './sprints.js';
import { GROUPS, RSTATUS, aiPayload, applyAi, buildProds, jiraUrl, newManualLine, overall, productsOf, reportToText, ruleSummary } from '../features/report-model.js';

const rUI = { id: null, busy: false, note: '' };
const cfg = () => S.ideas.reportcfg || {};
const uidr = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const canBuild = () => !isViewer() && canWrite();
export const reportList = () => Object.keys(S.reports).map(id => Object.assign({ id: id }, S.reports[id])).filter(r => r.a && (!isViewer() || r.status === 'submitted')).sort((x, y) => (x.a < y.a ? 1 : -1));
const cur = () => { const l = reportList(); return l.find(r => r.id === rUI.id) || l[0] || null; };

function save(rep, log) { const id = rep.id, d = Object.assign({}, rep); delete d.id; d.by = (S.me && (S.me.name || S.me.email)) || ''; d.ts = Date.now(); S.reports[id] = d; write('reports/' + id, d); if (log) logAct('report', log); }
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
  const id = wk.id; if (S.reports[id]) { rUI.id = id; renderReports(); return; }
  const rep = { id: id, sp: wk.sp, n: wk.n, w: wk.w, a: wk.a, b: wk.b, status: 'draft', pl: productsOf(cfg()), prods: {} };
  sync(rep, false, true);
}
/** Rules-only re-sync (never overwrites edited lines/summaries), then optionally the AI wording. */
async function sync(rep, ai, isNew) {
  if (rUI.busy) return; rUI.busy = true; rUI.note = '';
  const pl = productsOf(cfg()), { road, ka, kb } = roadFor(rep.a, rep.b);
  rep.pl = pl; rep.prods = buildProds(pl, rep.prods, itemsOf(rep.sp), road, ka, kb, rep.a, rep.b);
  let note = isNew ? 'Draft created' : 'Synced from Sprint and Roadmap';
  rUI.id = rep.id; save(rep, isNew ? 'created the weekly report for ' + fmtIso(rep.a) : 'synced the weekly report for ' + fmtIso(rep.a)); renderReports();
  if (ai) {
    toast('Writing with Gemini…');
    try {
      const r = await sb.functions.invoke('weekly-draft', { body: aiPayload(rep.a, pl, rep.prods) });
      if (r.error || !r.data || !r.data.products) throw new Error((r.error && r.error.message) || 'no answer');
      const n = applyAi(rep.prods, r.data); rep.ai = { model: r.data.model || '', at: new Date().toISOString() };
      save(rep); note = n ? 'AI wording applied (' + n + ' changes)' : 'AI had nothing to change';
    } catch (e) { note = 'AI unavailable, kept the rule-based draft'; }
  }
  rUI.busy = false; rUI.note = note; toast(note); renderReports();
}
function settingsDlg() {
  const cur0 = productsOf(cfg()).map(p => Object.assign({}, p, { squads: p.squads.slice() }));
  openDlg('Report settings', box => {
    const list = el('div', 'rsets');
    const draw = () => {
      list.textContent = '';
      cur0.forEach((p, i) => {
        const r = el('div', 'rsrow'), n = el('input'); n.value = p.n; n.setAttribute('aria-label', 'Product name'); n.addEventListener('input', () => { p.n = n.value; });
        r.append(n); LANES.forEach(l => { const c = el('input'); c.type = 'checkbox'; c.checked = p.squads.includes(l.k); c.addEventListener('change', () => { p.squads = p.squads.filter(x => x !== l.k); if (c.checked) p.squads.push(l.k); }); const lb = el('label', 'chk'); lb.append(c, document.createTextNode(' ' + l.n)); r.append(lb); });
        const x = el('button', 'btn sm danger', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Remove product'); x.addEventListener('click', () => { cur0.splice(i, 1); draw(); }); r.append(x); list.append(r);
      });
    };
    draw();
    const add = el('button', 'btn sm', '+ Product'); add.type = 'button'; add.addEventListener('click', () => { cur0.push({ k: 'p' + Date.now().toString(36), n: 'New product', squads: [] }); draw(); });
    const jb = el('input'); jb.value = cfg().jira || ''; jb.placeholder = 'https://your-company.atlassian.net'; jb.setAttribute('aria-label', 'Jira base URL');
    const ok = el('button', 'btn primary', 'Save'), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button';
    ok.addEventListener('click', () => {
      const ps = cur0.filter(p => p.n.trim()).map(p => ({ k: p.k, n: p.n.trim(), squads: p.squads })); if (!ps.length) return;
      const j = jb.value.trim(); saveIdea('reportcfg', { cfg: true, products: ps, jira: /^https:\/\//i.test(j) ? j : '' }, 'report', 'updated the report settings'); closeDlg(); renderReports();
    });
    no.addEventListener('click', closeDlg);
    const row = el('div', 'row'); row.append(ok, no);
    box.append(el('p', 'sub', 'One section per product. Tick the squads that belong to it.'), list, add, fld('Jira base URL (optional, https only)', jb), row);
  });
}

function viewLine(l) {
  const r = el('div', 'rv st-' + l.st); r.append(el('span', 'dot rs-' + l.st), el('span', 'rvt', l.t));
  const u = jiraUrl(cfg().jira, l.jira); if (l.jira) { const a = el(u ? 'a' : 'span', 'jira', l.jira); if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; } r.append(a); }
  if (l.st === 'risk' || l.st === 'late') r.append(el('span', 'chip rs-' + l.st, RSTATUS[l.st]));
  return r;
}
function lineRow(rep, d, l, ro) {
  if (ro) return viewLine(l);
  const r = el('div', 'rline st-' + l.st + (l.hide ? ' hid' : '')); r.dataset.id = l.id;
  const touch = patch => { Object.assign(l, patch, { edited: true }); save(rep); };
  const st = el('select', 'spsel rst-' + l.st); st.disabled = ro; st.setAttribute('aria-label', 'Status'); Object.keys(RSTATUS).forEach(k => { const o = el('option', '', RSTATUS[k]); o.value = k; o.selected = k === l.st; st.append(o); });
  st.addEventListener('change', () => { touch({ st: st.value }); renderReports(); });
  const t = el('input', 'sptext'); t.value = l.t; t.disabled = ro; t.setAttribute('aria-label', 'Line text'); t.addEventListener('change', () => { const v = t.value.trim(); if (!v) { t.value = l.t; return; } touch({ t: v.slice(0, 400) }); });
  r.append(st, t);
  const u = jiraUrl(cfg().jira, l.jira);
  if (l.jira) { const a = el(u ? 'a' : 'span', 'jira', l.jira); if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; } r.append(a); }
  if (!ro) {
    const g = el('select', 'spsel'); g.setAttribute('aria-label', 'Group'); GROUPS.forEach(x => { const o = el('option', '', x[1]); o.value = x[0]; o.selected = x[0] === l.g; g.append(o); });
    g.addEventListener('change', () => { touch({ g: g.value }); renderReports(); });
    const h = el('button', 'btn sm', l.hide ? 'Show' : 'Hide'); h.type = 'button'; h.addEventListener('click', () => { touch({ hide: !l.hide }); renderReports(); });
    const x = el('button', 'btn sm danger', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Delete line'); x.addEventListener('click', () => { if (l.src === 'man') d.items = d.items.filter(z => z.id !== l.id); else touch({ hide: true }); save(rep); renderReports(); });
    r.append(g, h, x);
  }
  return r;
}
function prodBlock(rep, p, ro) {
  const d = rep.prods[p.k]; if (!d) return el('div');
  const sec = el('section', 'card rprod'); sec.dataset.k = p.k;
  const hd = el('div', 'rphead'), s = overall(d.items); hd.append(el('h2', '', p.n), el('span', 'chip rs-' + s, RSTATUS[s])); sec.append(hd);
  if (ro) { sec.classList.add('rview'); sec.style.setProperty('--rc', 'var(--rc-' + s + ')'); if (d.sum) sec.append(el('p', 'rsumv', d.sum)); }
  const sm = el('textarea', 'rsum'); sm.value = d.sum || ''; sm.rows = 3; sm.disabled = ro; sm.setAttribute('aria-label', 'Summary for ' + p.n);
  sm.addEventListener('change', () => { d.sum = sm.value.trim() || ruleSummary(p.n, d.items); d.sumEdited = !!sm.value.trim(); save(rep); });
  if (!ro) sec.append(sm);
  GROUPS.forEach(g => {
    const ls = d.items.filter(l => l.g === g[0] && (!ro || !l.hide));
    if (!ls.length && ro) return;
    const gh = el('div', 'rgrp'); gh.append(el('h3', '', g[1])); ls.forEach(l => gh.append(lineRow(rep, d, l, ro)));
    if (!ro) { const f = el('form', 'spadd'), i = el('input'); i.placeholder = 'Add a line to "' + g[1] + '"'; i.setAttribute('aria-label', 'Add line to ' + g[1]); f.append(i); f.addEventListener('submit', e => { e.preventDefault(); const v = i.value.trim(); if (!v) return; d.items.push(newManualLine(g[0], v.slice(0, 400))); save(rep); renderReports(); }); gh.append(f); }
    sec.append(gh);
  });
  return sec;
}
export function renderReports() {
  const pg = $('pg-reports'); if (!pg) return; pg.textContent = '';
  const viewer = isViewer(), l = reportList(), rep = cur();
  pg.append(pageHead('Weekly report', viewer ? 'Submitted weekly updates per product.' : 'Built from the sprint plan and the roadmap. Edit anything, then submit it to the executives.'));
  const bar = el('div', 'row spbar');
  if (l.length) { const sel = el('select'); sel.setAttribute('aria-label', 'Report'); l.forEach(r => { const o = el('option', '', 'Week of ' + fmtIso(r.a) + ' · Sprint ' + r.n + (viewer ? '' : r.status === 'submitted' ? ' · submitted' : ' · draft')); o.value = r.id; o.selected = rep && r.id === rep.id; sel.append(o); }); sel.addEventListener('change', () => { rUI.id = sel.value; rUI.note = ''; renderReports(); }); bar.append(sel); }
  if (!viewer) {
    const free = missingWeeks(), t = todayIso(), pick = free.find(w => w.a <= t) || free[free.length - 1];
    if (pick) { const nb = el('button', 'btn primary', 'New report for week of ' + fmtIso(pick.a)); nb.type = 'button'; nb.disabled = !canBuild(); nb.addEventListener('click', () => newReport(pick)); bar.append(nb); }
    const sb2 = el('button', 'btn', 'Report settings'); sb2.type = 'button'; sb2.disabled = !canBuild(); sb2.addEventListener('click', settingsDlg); bar.append(sb2);
  }
  pg.append(bar);
  if (!rep) { pg.append(el('p', 'empty', viewer ? 'No report has been submitted yet.' : sprintList().length ? 'No report yet. Create one for the latest sprint.' : 'Create a sprint first (Sprints page), then build the report.')); return; }
  const sub = rep.status === 'submitted', ro = viewer || sub || !canBuild();
  const meta = el('p', 'sub rmeta', sub ? 'Submitted' + (rep.subBy ? ' by ' + rep.subBy : '') + (rep.subAt ? ' on ' + fmtIso(rep.subAt.slice(0, 10)) : '') : 'Draft' + (rep.ai ? ' · wording by ' + (rep.ai.model || 'AI') : '') + ' · last edit ' + (rep.by || ''));
  const tools = el('div', 'row rtools');
  const btn = (t, cls, fn, dis) => { const b = el('button', 'btn ' + (cls || ''), t); b.type = 'button'; b.disabled = !!dis; b.addEventListener('click', fn); tools.append(b); return b; };
  if (!viewer && !sub) { btn('Sync from Sprint & Roadmap', '', () => sync(rep, false), !canBuild() || rUI.busy); btn('Draft with AI', '', () => sync(rep, true), !canBuild() || rUI.busy); }
  btn('Copy text', '', () => { const txt = reportToText(rep, rep.pl || productsOf(cfg()), fmtIso); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Copied'), () => toast('Copy failed')); });
  btn('Print / PDF', '', () => { document.body.classList.add('print-report'); const off = () => { document.body.classList.remove('print-report'); window.removeEventListener('afterprint', off); }; window.addEventListener('afterprint', off); window.print(); });
  if (!viewer && !sub) btn('Submit to executives', 'primary', () => { rep.status = 'submitted'; rep.subAt = new Date().toISOString(); rep.subBy = S.me.name || S.me.email; save(rep, 'submitted the weekly report for ' + fmtIso(rep.a)); renderReports(); }, !canBuild());
  if (!viewer && sub) btn('Reopen as draft', '', () => { rep.status = 'draft'; delete rep.subAt; delete rep.subBy; save(rep, 'reopened the weekly report for ' + fmtIso(rep.a)); renderReports(); }, !canBuild());
  const body = el('div', 'rbody'), pls = rep.pl || productsOf(cfg());
  const hero = el('div', 'rhero'); hero.append(el('small', '', 'Ynmo · Weekly product update'), el('h2', 'rtitle', fmtIso(rep.a) + ' – ' + fmtIso(rep.b)), el('span', 'rsp', 'Sprint ' + rep.n + ' · week ' + (rep.w || 1) + ' of 2')); body.append(hero);
  const glance = el('div', 'rglance');
  pls.forEach(p => { const d = rep.prods[p.k]; if (!d) return; const v = d.items.filter(l => !l.hide), s = overall(d.items), t = el('div', 'rtile rs-' + s); t.append(el('b', '', p.n), el('span', 'chip rs-' + s, RSTATUS[s]), el('small', '', v.filter(l => l.g === 'done').length + ' delivered · ' + v.filter(l => l.g === 'prog').length + ' in progress · ' + v.filter(l => l.st === 'risk' || l.st === 'late').length + ' at risk')); glance.append(t); });
  body.append(glance);
  pls.forEach(p => body.append(prodBlock(rep, p, ro)));
  pg.append(meta, tools); if (rUI.note && !viewer && !sub) { const nt = el('p', 'rnote', rUI.note); nt.setAttribute('role', 'status'); pg.append(nt); } pg.append(body);
}
