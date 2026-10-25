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
import { startPresence } from '../features/presence.js';

/* ---------- wiring ---------- */
export function initExtras() {
  netBar(); netShow();
}
export function startExtras() {
  $('shell').classList.toggle('viewer', isViewer());
  if (isViewer()) S.readonly = true;
  S.db.collection('share_links').onSnapshot(s => { const n = {}; s.docs.forEach(d => { n[d.id] = d.data(); }); S.shares = n; }, () => {});
  startPresence(); startIdle();
}

