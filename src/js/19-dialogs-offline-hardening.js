/**
 * @module dialogs-offline-hardening
 * Cross-cutting safety UI.
 * Accessible modal dialogs (openDlg), offline banner, password-strength meter, idle auto-logout (30 min, warning at 60 s) and sign-out-everywhere. Also the `canWrite()`/`isViewer()` permission helpers used before every mutation.
 * NOTE: all src/js files share one global scope (concatenated by build.mjs).
 */
/* ================= v4 extras: network banner, session safety, presence, dependencies, capacity, baselines, sharing ================= */
let SHARE = false, presCh = null, pres = {}, shares = {}, baselines = {}, logsOld = [], logsMore = false, logsBusy = false;
const ACTIVE_LOG_PAGE = 300;
const canWrite = () => !readonly && !SHARE;
const isViewer = () => !!(me && me.access === 'viewer' && !me.is_admin);

/* ---------- generic dialog ---------- */
let dlgPrev = null;
function closeDlg() { const d = $('xdlg'); if (d) { if (d._esc) document.removeEventListener('keydown', d._esc, true); d.remove(); } if (dlgPrev && dlgPrev.focus) { try { dlgPrev.focus(); } catch (e) { /* gone */ } } dlgPrev = null; }
function openDlg(title, build, opts) {
  closeDlg(); dlgPrev = document.activeElement;
  const ov = el('div', 'xdlg'); ov.id = 'xdlg';
  const box = el('div', 'xbox card'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
  const h = el('h2', '', title); box.append(h); build(box);
  ov.append(box); document.body.append(ov);
  ov.addEventListener('pointerdown', e => { if (e.target === ov && !(opts && opts.sticky)) closeDlg(); });
  ov._esc = e => { if (e.key === 'Escape' && !(opts && opts.sticky) && $('xdlg') === ov) { e.stopPropagation(); closeDlg(); } };
  document.addEventListener('keydown', ov._esc, true);
  ov.addEventListener('keydown', e => {
    if (e.key === 'Tab') { const f = [...box.querySelectorAll('button:not([disabled]),input,select,textarea,a[href]')].filter(x => !x.hidden); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  });
  const f = box.querySelector('input,select,textarea,button:not(.link)'); if (f) f.focus();
  return box;
}

/* ---------- 8. offline banner ---------- */
let netBad = false, netTimer = 0;
function netBar() {
  let b = $('offbar');
  if (!b) {
    b = el('div', 'offbar'); b.id = 'offbar'; b.setAttribute('role', 'status'); b.hidden = true;
    const sh = $('shell'); sh.insertBefore(b, sh.firstChild);
  }
  return b;
}
function netShow() {
  const bad = netBad || (typeof navigator !== 'undefined' && navigator.onLine === false), b = netBar();
  b.hidden = !bad; document.body.classList.toggle('offline', bad);
  if (bad) b.textContent = 'You are offline. Changes stay on this device and save by themselves when the connection is back. Others will not see them until then.';
  clearTimeout(netTimer);
  if (bad) netTimer = setTimeout(netProbe, 6000);
}
function netMark(ok) { const was = netBad; netBad = !ok; if (was !== netBad) netShow(); }
async function netProbe() {
  if (!sb || SHARE) return;
  try { const r = await sb.from('profiles').select('id').limit(1); if (r && r.error && !r.data) throw new Error('x'); netBad = false; } catch (e) { netBad = true; }
  netShow();
}
window.addEventListener('offline', () => netShow());
window.addEventListener('online', () => { netBad = false; netShow(); netProbe(); });

/* ---------- 7. sign-in hardening ---------- */
function pwScore(v) {
  let s = 0; const tips = [];
  if (v.length >= 8) s++; else tips.push('use 8 or more characters');
  if (v.length >= 12) s++; else if (v.length >= 8) tips.push('12+ characters is stronger');
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++; else tips.push('mix upper and lower case');
  if (/\d/.test(v)) s++; else tips.push('add a number');
  if (/[^A-Za-z0-9]/.test(v)) s++; else tips.push('add a symbol');
  if (/^(password|12345678|qwerty|11111111|abc12345)/i.test(v)) { s = Math.min(s, 1); tips.unshift('avoid common passwords'); }
  return { s: Math.min(4, Math.max(0, s - (v.length < 8 ? 1 : 0))), tips: tips };
}
function pwMeter(input, host) {
  const w = el('div', 'pwmeter'); w.setAttribute('aria-live', 'polite');
  const bar = el('div', 'pwbar'); for (let i = 0; i < 4; i++) bar.append(el('i'));
  const txt = el('span', 'pwtxt'); w.append(bar, txt); host.append(w);
  const upd = () => {
    const v = input.value; if (!v) { w.dataset.s = ''; txt.textContent = ''; bar.querySelectorAll('i').forEach(i => i.className = ''); return; }
    const r = pwScore(v), lab = ['Weak', 'Weak', 'Okay', 'Good', 'Strong'][r.s];
    w.dataset.s = String(r.s); bar.querySelectorAll('i').forEach((i, n) => { i.className = n < Math.max(1, r.s) ? 'on' : ''; });
    txt.textContent = lab + (r.tips.length && r.s < 4 ? ' · ' + r.tips[0] : '');
  };
  input.addEventListener('input', upd); return upd;
}
const IDLE_MS = () => window.__idleMs || 30 * 60 * 1000, IDLE_WARN = () => window.__idleWarn || 60 * 1000;
let lastAct = Date.now(), idleT = 0, idleShown = false, idleTick = 0;
function bumpAct() {
  const n = Date.now(); if (n - lastAct < 1500) return; lastAct = n;
  try { localStorage.setItem('ynmo-act', String(n)); } catch (e) { /* storage unavailable */ }
}
function startIdle() {
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { if (!idleShown) bumpAct(); }, { passive: true, capture: true }));
  window.addEventListener('storage', e => { if (e.key === 'ynmo-act' && !idleShown) lastAct = Math.max(lastAct, +e.newValue || 0); });
  clearInterval(idleT);
  idleT = setInterval(() => {
    let la = lastAct; try { la = Math.max(la, +localStorage.getItem('ynmo-act') || 0); } catch (e) { /* storage unavailable */ }
    const idle = Date.now() - la;
    if (idle >= IDLE_MS()) { clearInterval(idleT); doLogout(); return; }
    if (idle >= IDLE_MS() - IDLE_WARN() && !idleShown) idleWarn(la);
  }, window.__idleMs ? 300 : 5000);
}
function idleWarn(la) {
  idleShown = true;
  const box = openDlg('Still there?', b => {
    const p = el('p', 'hint'); p.id = 'idlemsg'; b.append(p);
    const ok = el('button', 'btn primary', 'Stay signed in'); ok.type = 'button';
    const out = el('button', 'btn', 'Sign out now'); out.type = 'button';
    ok.addEventListener('click', () => { idleShown = false; lastAct = Date.now(); try { localStorage.setItem('ynmo-act', String(lastAct)); } catch (e) { /* storage unavailable */ } closeDlg(); clearInterval(idleTick); });
    out.addEventListener('click', doLogout);
    const row = el('div', 'formrow'); row.append(ok, out); b.append(row);
  }, { sticky: true });
  const end = la + IDLE_MS();
  clearInterval(idleTick);
  idleTick = setInterval(() => { const s = Math.max(0, Math.ceil((end - Date.now()) / 1000)); const m = $('idlemsg'); if (m) m.textContent = 'You will be signed out in ' + s + ' seconds because there was no activity. Your saved work is safe.'; }, 250);
}
async function signOutEverywhere() {
  try { await sb.auth.signOut({ scope: 'global' }); } catch (e) { /* offline: local sign-out still happens */ try { await sb.auth.signOut(); } catch (x) { /* ignore */ } }
  location.reload();
}

