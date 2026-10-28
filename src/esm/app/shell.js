/**
 * @module app/shell
 * App shell: navigation and startup.
 * Page registry rendering, role-aware navigation (viewers only see read-only pages), start() which subscribes to realtime data, and boot() which decides between auth gate, shared read-only link, or the app.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { isHistId, keepPendingHist } from '../features/month-history.js';
import { S } from '../core/state.js';
import { $, H2_ID, el, modLevel, state } from '../core/model.js';
import { render } from '../ui/gantt-render.js';
import { allRoadmaps, fillRm, renderRoadmaps, useRoadmap } from '../pages/roadmaps.js';
import { loadMembers, renderAdmin, renderResources } from '../pages/resources.js';
import { renderVacations } from '../pages/vacations.js';
import { renderLog } from '../pages/log.js';
import { renderSprints } from '../pages/sprints.js';
import { applySquadNames } from '../features/squad-names.js';
import { renderReports } from '../pages/reports.js';
import { renderMonthly } from '../pages/monthly.js';
import { renderCapacity } from '../pages/capacity.js';
import { PAGES } from '../core/shared.js';
import { ACTIVE_LOG_PAGE, isViewer } from '../features/safety.js';
import { toast } from '../core/shared.js';
import { closeCtx } from '../ui/editing.js';
import { buildOff, buildPicker, closePicker, fillPersons } from '../ui/people-picker.js';
import { hideLoading, showLoading } from '../ui/loading.js';
import { makeDb, sb } from '../core/supabase.js';
import { afterAuth, drawAvatar, loadProfile, within } from '../auth/profile.js';
import { onSnap, setSave, snapDocs } from '../core/saving.js';
import { startExtras } from './extras-wiring.js';
import { LANDING, doLogout, gateCard, showLogin, showSetPw } from '../auth/gate.js';
import { bootShared } from '../features/sharing.js';

/* ---------- shell: navigation and start ---------- */
export function refreshPage() { renderPage(state.page); }
function renderPage(p) { ({ roadmap: render, roadmaps: renderRoadmaps, resources: renderResources, admin: () => { loadMembers(); renderAdmin(); }, vacations: () => renderVacations(true), log: renderLog, sprints: renderSprints, reports: renderReports, monthly: renderMonthly, capacity: renderCapacity })[p](); }
/** May the person open this page? Admin page: admins only. Others: View or more for that module. */
const pageOk = p => (p === 'admin' ? !!(S.me && S.me.is_admin) : modLevel(p === 'capacity' ? 'monthly' : p) >= 1);
export function showPage(p) {
  if (!PAGES.some(x => x[0] === p) || !pageOk(p)) p = (PAGES.find(x => pageOk(x[0])) || ['roadmap'])[0];
  state.page = p; closeCtx(); closePicker();
  PAGES.forEach(x => { $('pg-' + x[0]).hidden = x[0] !== p; });
  document.querySelectorAll('#nav button').forEach(b => { if (b.dataset.p === p) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const pt = $('ptitle'); if (pt) pt.textContent = (PAGES.find(x => x[0] === p) || [0, ''])[1];
  const hp = p === 'capacity' ? 'dashboard' : p;   // the Dashboard shows as #/dashboard in the address (#/capacity still opens it)
  if (location.hash !== '#/' + hp && !((p === 'sprints' || p === 'reports') && new RegExp('^#/' + p + '/').test(location.hash))) window.history.replaceState(null, '', '#/' + hp);
  renderPage(p);
}
const NAV_LABEL = { monthly: 'Monthly', admin: 'Users' };
const NAV_ICONS = {
  roadmap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h9M4 12h14M4 18h7" /><path d="M16 6h4M20 18h-6" /></svg>',
  roadmaps: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17.5 12 22l9-4.5" /></svg>',
  resources: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.3c1.8.8 3 2.6 3 4.7" /></svg>',
  vacations: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4" /></svg>',
  admin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.4 2.9 8.3 7 10 4.1-1.7 7-5.6 7-10V6l-7-3z" /><path d="m9 12 2 2 4-4" /></svg>',
  sprints: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" /><path d="M12 8v4l2.5 2" /></svg>',
  capacity: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>',
  monthly: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17M8 15h3M8 18h6" /></svg>',
  reports: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6M9 9h2" /></svg>',
  log: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>'
};
function buildNav() {
  const n = $('nav'); n.textContent = '';
  PAGES.filter(x => pageOk(x[0])).forEach(x => { const b = el('button', ''); b.type = 'button'; b.dataset.p = x[0]; b.title = x[1]; b.setAttribute('aria-label', x[1]); b.insertAdjacentHTML('beforeend', NAV_ICONS[x[0]] || ''); b.append(el('span', 'lbl', NAV_LABEL[x[0]] || x[1])); if (x[0] === 'admin') { const d = el('span', 'dot', '0'); d.hidden = true; b.append(d); } b.addEventListener('click', () => { window.history.replaceState(null, '', '#/' + x[0]); showPage(x[0]); }); n.append(b); });
}
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function softRender() { if (state.edit || S.dragging) { S.needRender = true; return; } render(); }
export let started = false;
/** Approved, but no admin has given this person View on any module yet: say so instead of showing an empty app. */
function showNoAccess() {
  const c = gateCard('No access yet', 'Your account is approved, but an admin has not given you access to any module yet. Ask an admin to open Users & permissions and switch on what you need.');
  const b1 = el('button', 'btn primary', 'Check again'); b1.type = 'button'; b1.addEventListener('click', async () => { b1.disabled = true; await loadProfile(); b1.disabled = false; start(); });
  const b2 = el('button', 'btn', 'Log out'); b2.type = 'button'; b2.addEventListener('click', doLogout); c.append(b1, b2);
}
/** An admin changed this person's access while they are signed in: follow it (menu, read-only state, current page) without waiting for a reload. */
export function applyAccessChange() {
  if (!PAGES.some(x => pageOk(x[0]))) { location.reload(); return; }
  S.readonly = isViewer() || !!S.SHARE; S.denied = null; $('shell').classList.toggle('viewer', isViewer());
  buildNav(); showPage(state.page); toast('Your access was changed by an admin.');
}
export function start() {
  if (started) return;
  if (!PAGES.some(x => pageOk(x[0]))) { showNoAccess(); return; }
  started = true;
  showLoading('Loading your roadmap…'); setTimeout(hideLoading, 10000);
  $('gate').hidden = true; $('shell').classList.remove('app-hidden');
  S.db = makeDb(); drawAvatar(); buildNav();
  try { S.wantRm = localStorage.getItem('ynmo-rm'); } catch (e) { S.wantRm = null; }
  S.db.collection('items').onSnapshot(s => { hideLoading(); onSnap(s); }, () => { hideLoading(); setSave('error'); });
  S.db.collection('daysoff').onSnapshot(s => { const n = snapDocs('daysoff', s, S.daysoff); if (same(n, S.daysoff)) return; S.daysoff = n; softRender(); if (S.offOpen && !state.edit) buildOff(); }, () => {});
  S.db.collection('people').onSnapshot(s => { const n = snapDocs('people', s, S.extras); if (same(n, S.extras)) return; S.extras = n; fillPersons(); if (S.picker && S.picker.id) buildPicker(); softRender(); if (state.page === 'resources') renderResources(); if (state.page === 'vacations') renderVacations(); }, () => {});
  S.db.collection('roadmaps').onSnapshot(s => {
    const n = snapDocs('roadmaps', s, S.roadmaps); if (same(n, S.roadmaps)) return; S.roadmaps = n;
    if (S.wantRm && allRoadmaps().some(r => r.id === S.wantRm)) { const w = S.wantRm; S.wantRm = null; useRoadmap(w); }
    else if (!allRoadmaps().some(r => r.id === state.rm)) useRoadmap(H2_ID); else fillRm();
    if (state.page === 'roadmaps') renderRoadmaps();
  }, () => {});
  S.db.collection('ideas').onSnapshot(s => { const n = snapDocs('ideas', s, S.ideas); if (same(n, S.ideas)) return; const tn = o => Object.keys(o).filter(k => o[k] && o[k].tn).sort().map(k => o[k]), orderChanged = JSON.stringify([n.peopleorder, n.peoplehide, n.squadnames, tn(n)]) !== JSON.stringify([S.ideas.peopleorder, S.ideas.peoplehide, S.ideas.squadnames, tn(S.ideas)]); S.ideas = n; applySquadNames(); if (orderChanged) softRender(); if (state.page === 'capacity') renderCapacity(); /* shared row order of the by-person view */ if (state.page === 'roadmaps') renderRoadmaps(); }, () => {});
  S.db.collection('reports').onSnapshot(s => { const n = snapDocs('reports', s, S.reports), hn = {}; Object.keys(n).forEach(k => { if (isHistId(k)) { hn[k] = n[k]; delete n[k]; } }); S.hist = keepPendingHist(hn, S.hist); if (same(n, S.reports)) return; S.reports = n; if (state.page === 'reports' && !state.edit && !document.activeElement.closest('#pg-reports')) renderReports(); if (state.page === 'capacity') renderCapacity(); if (state.page === 'monthly' && !state.edit && !document.activeElement.closest('#pg-monthly [contenteditable], #pg-monthly select, #pg-monthly input')) renderMonthly(); }, e => { if (e && e.code === 'missing_table') { S.setup['reports'] = true; if (state.page === 'reports' || state.page === 'sprints') refreshPage(); } });
  if (modLevel('sprints') >= 1) {
    S.db.collection('sprints').onSnapshot(s => { const n = snapDocs('sprints', s, S.sprints); if (same(n, S.sprints)) return; S.sprints = n; if (state.page === 'sprints' && !document.activeElement.closest('#pg-sprints')) renderSprints({ keep: true }); if (state.page === 'reports') renderReports(); }, e => { if (e && e.code === 'missing_table') { S.setup['sprints'] = true; if (state.page === 'reports' || state.page === 'sprints') refreshPage(); } });
    S.db.collection('sprint_items').onSnapshot(s => { const n = snapDocs('sprint_items', s, S.sitems); if (same(n, S.sitems)) return; S.sitems = n; if (state.page === 'sprints' && !document.activeElement.closest('#pg-sprints')) renderSprints({ keep: true }); }, e => { if (e && e.code === 'missing_table') { S.setup['sprint_items'] = true; if (state.page === 'reports' || state.page === 'sprints') refreshPage(); } });
  }
  S.db.collection('vacations').onSnapshot(s => { const n = snapDocs('vacations', s, S.vacs); if (same(n, S.vacs)) return; S.vacs = n; softRender(); if (state.page === 'vacations') renderVacations(); if (state.page === 'capacity') renderCapacity(); }, () => {});
  S.db.collection('activity').onSnapshot(s => { S.logs = s.docs.map(d => ({ id: d.id, data: d.data() })).sort((a, b) => a.data.at < b.data.at ? 1 : -1); if (!S.logsOld.length) S.logsMore = s.docs.length >= ACTIVE_LOG_PAGE; if (state.page === 'log') renderLog(); }, () => {});
  setSave('ready'); fillRm(); startExtras();
  loadMembers(); setInterval(loadMembers, 20000);
  { const al = x => x === 'dashboard' ? 'capacity' : x, h = al((location.hash.match(/^#\/(\w+)/) || [])[1]), ok = x => PAGES.some(y => y[0] === x); showPage(ok(h) ? h : ok(al(LANDING)) ? al(LANDING) : 'roadmap'); }
}
/** The sign-in check or profile did not answer: show a way out instead of a spinner that never ends. */
function showStuck(why) {
  const c = gateCard('Taking longer than expected', why || 'We could not reach the server to check your sign-in. This is usually the network, or the data service restarting.');
  const note = el('div', 'meta', 'Trying again automatically every 15 seconds. This page opens the tool as soon as the server answers.'); note.setAttribute('aria-live', 'polite');
  const b1 = el('button', 'btn primary', 'Try again'); b1.type = 'button'; b1.addEventListener('click', () => location.reload());
  const b2 = el('button', 'btn', 'Sign out and start fresh'); b2.type = 'button';
  b2.addEventListener('click', async () => { clearInterval(tm); try { await Promise.race([sb.auth.signOut({ scope: 'local' }), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* ignore */ } try { Object.keys(localStorage).filter(k => /^sb-.*-auth-token/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) { /* ignore */ } location.reload(); });
  c.append(note, b1, b2);
  let busy = false;
  const tm = setInterval(async () => {
    if (busy || started) return; busy = true;
    try { const s = (await within(sb.auth.getSession(), 8000, 'sign-in check')).data.session; clearInterval(tm); if (!s) showLogin(); else await afterAuth(s); }
    catch (e) { busy = false; }
  }, 15000);
}
export async function boot() { showLoading(); try { await bootInner(); } finally { if (!started) hideLoading(); } }
async function bootInner() {
  const shm = /^#\/share\/([A-Za-z0-9]{16,})/.exec(location.hash);
  if (shm) { await bootShared(shm[1]); return; }
  const invited = /type=(invite|recovery)/.test(location.hash), confirmed = /type=signup/.test(location.hash);
  let sess = null;
  let slow = false;
  try { sess = (await within(sb.auth.getSession(), 10000, 'sign-in check')).data.session; } catch (e) { slow = true; /* offline or stuck */ }
  sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY' && !started) showSetPw(); });
  if (confirmed) { try { window.history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ } }
  if (slow) showStuck(); else if (sess && invited) showSetPw(); else if (sess) { try { await afterAuth(sess); } catch (e) { showStuck(e && e.message); return; } if (confirmed && !started) { const n = document.querySelector('#gate .meta'); if (n) n.textContent = 'Email confirmed. ' + n.textContent; } } else showLogin();
}

