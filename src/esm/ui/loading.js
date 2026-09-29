/**
 * @module ui/loading
 * Loading indicators.
 * Full-screen loader with progress so the UI never looks frozen during boot.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { $, el } from '../core/model.js';
import { LOGO } from '../core/supabase.js';
import { started } from '../app/shell.js';
import { showForgot, showLogin, showSignup } from '../auth/gate.js';

/* ---------- loading states ---------- */
let ldgN = 0;
export function showLoading(msg) {
  let l = $('ldg');
  if (!l) {
    l = el('div', 'ldg'); l.id = 'ldg'; l.setAttribute('role', 'status'); l.setAttribute('aria-live', 'polite');
    const w = el('div', 'ldgbox'); const ring = el('div', 'ldgring'); const im = document.createElement('img'); im.src = LOGO; im.alt = ''; ring.append(im);
    w.append(ring, el('div', 'ldgtxt')); l.append(w); document.body.append(l);
  }
  l.querySelector('.ldgtxt').textContent = msg || 'Loading…'; l.hidden = false;
}
export function hideLoading() { const l = $('ldg'); if (l) l.hidden = true; }
export function progress(on) {
  let b = $('prog'); if (!b) { b = el('div', 'prog'); b.id = 'prog'; b.hidden = true; document.body.append(b); }
  b.hidden = !on;
}

/* typing #/login, #/signup or #/forgot while signed out opens that screen */
window.addEventListener('hashchange', () => {
  if (started || S.SHARE) return;
  const h = (location.hash.match(/^#\/(\w+)/) || [])[1];
  if (h === 'signup') showSignup(); else if (h === 'forgot') showForgot(); else if (h === 'login') showLogin();
});

