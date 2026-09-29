/**
 * @module app/shell
 * App shell: navigation and startup.
 * Page registry rendering, role-aware navigation (viewers only see read-only pages), start() which subscribes to realtime data, and boot() which decides between auth gate, shared read-only link, or the app.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, H2_ID, el, state } from '../core/model.js';
import { render } from '../ui/gantt-render.js';
import { renderDrawer, renderIdeas } from '../pages/ideas.js';
import { allRoadmaps, fillRm, renderRoadmaps, useRoadmap } from '../pages/roadmaps.js';
import { loadMembers, renderAdmin, renderResources } from '../pages/resources.js';
import { renderVacations } from '../pages/vacations.js';
import { renderLog } from '../pages/log.js';
import { renderCapacity } from '../features/capacity.js';
import { renderBaselines } from '../features/baselines.js';
import { PAGES } from '../core/shared.js';
import { ACTIVE_LOG_PAGE, isViewer } from '../features/safety.js';
import { closeCtx } from '../ui/editing.js';
import { buildOff, buildPicker, closePicker, fillPersons } from '../ui/people-picker.js';
import { hideLoading, showLoading } from '../ui/loading.js';
import { makeDb, sb } from '../core/supabase.js';
import { afterAuth, drawAvatar } from '../auth/profile.js';
import { onSnap, setSave } from '../core/saving.js';
import { startExtras } from './extras-wiring.js';
import { LANDING, showLogin, showSetPw } from '../auth/gate.js';
import { bootShared } from '../features/sharing.js';

/* ---------- shell: navigation and start ---------- */
export function refreshPage() { renderPage(state.page); }
function renderPage(p) { ({ roadmap: render, ideas: () => renderIdeas(true), roadmaps: renderRoadmaps, resources: renderResources, admin: () => { loadMembers(); renderAdmin(); }, vacations: () => renderVacations(true), log: renderLog, capacity: renderCapacity, baselines: renderBaselines })[p](); }
const VIEWER_PAGES = ['roadmap', 'capacity', 'baselines', 'log'];
export function showPage(p) {
  if (!PAGES.some(x => x[0] === p) || (p === 'admin' && !(S.me && S.me.is_admin)) || (isViewer() && !VIEWER_PAGES.includes(p))) p = 'roadmap';
  state.page = p; closeCtx(); closePicker();
  PAGES.forEach(x => { $('pg-' + x[0]).hidden = x[0] !== p; });
  document.querySelectorAll('#nav button').forEach(b => { if (b.dataset.p === p) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const pt = $('ptitle'); if (pt) pt.textContent = (PAGES.find(x => x[0] === p) || [0, ''])[1];
  if (location.hash !== '#/' + p) window.history.replaceState(null, '', '#/' + p);
  renderPage(p);
}
const NAV_ICONS = {
  roadmap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h9M4 12h14M4 18h7" /><path d="M16 6h4M20 18h-6" /></svg>',
  ideas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2v.1h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" /></svg>',
  roadmaps: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17.5 12 22l9-4.5" /></svg>',
  resources: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.3c1.8.8 3 2.6 3 4.7" /></svg>',
  vacations: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4" /></svg>',
  admin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.4 2.9 8.3 7 10 4.1-1.7 7-5.6 7-10V6l-7-3z" /><path d="m9 12 2 2 4-4" /></svg>',
  capacity: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>',
  baselines: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M5 6h11l-2 3.5L16 13H5" /></svg>',
  log: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>'
};
function buildNav() {
  const n = $('nav'); n.textContent = '';
  PAGES.filter(x => (x[0] !== 'admin' || (S.me && S.me.is_admin)) && (!isViewer() || VIEWER_PAGES.includes(x[0]))).forEach(x => { const b = el('button', ''); b.type = 'button'; b.dataset.p = x[0]; b.title = x[1]; b.setAttribute('aria-label', x[1]); b.insertAdjacentHTML('beforeend', NAV_ICONS[x[0]] || ''); b.append(el('span', 'lbl', x[1])); if (x[0] === 'admin') { const d = el('span', 'dot', '0'); d.hidden = true; b.append(d); } b.addEventListener('click', () => showPage(x[0])); n.append(b); });
}
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function softRender() { if (state.edit || S.dragging) { S.needRender = true; return; } render(); }
export let started = false;
export function start() {
  if (started) return; started = true;
  showLoading('Loading your roadmap…'); setTimeout(hideLoading, 10000);
  $('gate').hidden = true; $('shell').classList.remove('app-hidden');
  S.db = makeDb(); drawAvatar(); buildNav();
  try { S.wantRm = localStorage.getItem('ynmo-rm'); } catch (e) { S.wantRm = null; }
  S.db.collection('items').onSnapshot(s => { hideLoading(); onSnap(s); }, () => { hideLoading(); setSave('error'); });
  S.db.collection('daysoff').onSnapshot(s => { const n = {}; s.docs.forEach(d => { n[d.id] = d.data(); }); if (same(n, S.daysoff)) return; S.daysoff = n; softRender(); if (S.offOpen && !state.edit) buildOff(); }, () => {});
  S.db.collection('people').onSnapshot(s => { const n = {}; s.docs.forEach(d => { n[d.id] = d.data(); }); if (same(n, S.extras)) return; S.extras = n; fillPersons(); if (S.picker && S.picker.id) buildPicker(); softRender(); if (state.page === 'resources') renderResources(); if (state.page === 'vacations') renderVacations(); }, () => {});
  S.db.collection('roadmaps').onSnapshot(s => {
    const n = {}; s.docs.forEach(d => { n[d.id] = d.data(); }); if (same(n, S.roadmaps)) return; S.roadmaps = n;
    if (S.wantRm && allRoadmaps().some(r => r.id === S.wantRm)) { const w = S.wantRm; S.wantRm = null; useRoadmap(w); }
    else if (!allRoadmaps().some(r => r.id === state.rm)) useRoadmap(H2_ID); else fillRm();
    if (state.page === 'roadmaps') renderRoadmaps();
  }, () => {});
  S.db.collection('ideas').onSnapshot(s => { const n = {}; s.docs.forEach(d => { n[d.id] = d.data(); }); if (same(n, S.ideas)) return; S.ideas = n; renderDrawer(); if (state.page === 'ideas') renderIdeas(); if (state.page === 'roadmaps') renderRoadmaps(); }, () => {});
  S.db.collection('vacations').onSnapshot(s => { const n = {}; s.docs.forEach(d => { n[d.id] = d.data(); }); if (same(n, S.vacs)) return; S.vacs = n; softRender(); if (state.page === 'vacations') renderVacations(); }, () => {});
  S.db.collection('activity').onSnapshot(s => { S.logs = s.docs.map(d => ({ id: d.id, data: d.data() })).sort((a, b) => a.data.at < b.data.at ? 1 : -1); if (!S.logsOld.length) S.logsMore = s.docs.length >= ACTIVE_LOG_PAGE; if (state.page === 'log') renderLog(); }, () => {});
  setSave('ready'); fillRm(); startExtras();
  loadMembers(); setInterval(loadMembers, 20000);
  { const h = (location.hash.match(/^#\/(\w+)/) || [])[1], ok = x => PAGES.some(y => y[0] === x); showPage(ok(h) ? h : ok(LANDING) ? LANDING : 'roadmap'); }
}
export async function boot() { showLoading(); try { await bootInner(); } finally { if (!started) hideLoading(); } }
async function bootInner() {
  const shm = /^#\/share\/([A-Za-z0-9]{16,})/.exec(location.hash);
  if (shm) { await bootShared(shm[1]); return; }
  const invited = /type=(invite|recovery)/.test(location.hash), confirmed = /type=signup/.test(location.hash);
  let sess = null;
  try { sess = (await sb.auth.getSession()).data.session; } catch (e) { /* offline */ }
  sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY' && !started) showSetPw(); });
  if (confirmed) { try { window.history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ } }
  if (sess && invited) showSetPw(); else if (sess) { await afterAuth(sess); if (confirmed && !started) { const n = document.querySelector('#gate .meta'); if (n) n.textContent = 'Email confirmed. ' + n.textContent; } } else showLogin();
}

