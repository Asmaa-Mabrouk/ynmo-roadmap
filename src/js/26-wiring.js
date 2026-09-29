/**
 * @module wiring
 * Extras wiring.
 * initExtras() (one-time listeners) and startExtras() (after login) hook the extras into the core.
 * NOTE: all src/js files share one global scope (concatenated by build.mjs).
 */
/* ---------- wiring ---------- */
function initExtras() {
  // toolbar buttons
  const today = $('today');
  if (today && !$('sharebtn')) {
    const gb = el('button', 'btn', 'Plan vs now'); gb.type = 'button'; gb.id = 'ghostbtn'; gb.hidden = true; gb.setAttribute('aria-pressed', String(ghostOn));
    gb.title = 'Show where the saved baseline had each bar as a thin amber line';
    gb.addEventListener('click', () => { ghostOn = !ghostOn; try { localStorage.setItem('ynmo-ghost', ghostOn ? '1' : '0'); } catch (e) { /* storage unavailable */ } render(); });
    const sh = el('button', 'btn', 'Share'); sh.type = 'button'; sh.id = 'sharebtn'; sh.addEventListener('click', openShare);
    today.after(gb, sh);
  }
  netBar(); netShow();
}
function startExtras() {
  $('shell').classList.toggle('viewer', isViewer());
  if (isViewer()) readonly = true;
  db.collection('baselines').onSnapshot(s => { const n = {}; s.docs.forEach(d => { n[d.id] = d.data(); }); if (same(n, baselines)) return; baselines = n; if (state.page === 'baselines') renderBaselines(); softRender(); }, () => {});
  db.collection('share_links').onSnapshot(s => { const n = {}; s.docs.forEach(d => { n[d.id] = d.data(); }); shares = n; }, () => {});
  startPresence(); startIdle();
}

