/**
 * @module app/extras-wiring
 * Extras wiring.
 * initExtras() (one-time listeners) and startExtras() (after login) hook the extras into the core.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, el, state } from '../core/model.js';
import { render } from '../ui/gantt-render.js';
import { isViewer, netBar, netShow, startIdle } from '../features/safety.js';
import { same, softRender } from './shell.js';
import { renderBaselines } from '../features/baselines.js';
import { startPresence } from '../features/presence.js';

/* ---------- wiring ---------- */
export function initExtras() {
  // toolbar buttons
  const anchor = $('exportpdf');
  if (anchor && !$('ghostbtn')) {
    const gb = el('button', 'btn', 'Plan vs now'); gb.type = 'button'; gb.id = 'ghostbtn'; gb.hidden = true; gb.setAttribute('aria-pressed', String(S.ghostOn));
    gb.title = 'Show where the saved baseline had each bar as a thin amber line';
    gb.addEventListener('click', () => { S.ghostOn = !S.ghostOn; try { localStorage.setItem('ynmo-ghost', S.ghostOn ? '1' : '0'); } catch (e) { /* storage unavailable */ } render(); });
    anchor.before(gb);
  }
  netBar(); netShow();
}
export function startExtras() {
  $('shell').classList.toggle('viewer', isViewer());
  if (isViewer()) S.readonly = true;
  S.db.collection('baselines').onSnapshot(s => { const n = {}; s.docs.forEach(d => { n[d.id] = d.data(); }); if (same(n, S.baselines)) return; S.baselines = n; if (state.page === 'baselines') renderBaselines(); softRender(); }, () => {});
  S.db.collection('share_links').onSnapshot(s => { const n = {}; s.docs.forEach(d => { n[d.id] = d.data(); }); S.shares = n; }, () => {});
  startPresence(); startIdle();
}

