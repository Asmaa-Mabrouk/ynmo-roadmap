/**
 * @module loading
 * Loading indicators.
 * Full-screen loader with progress so the UI never looks frozen during boot.
 * NOTE: all src/js files share one global scope (concatenated by build.mjs).
 */
/* ---------- loading states ---------- */
let ldgN = 0;
function showLoading(msg) {
  let l = $('ldg');
  if (!l) {
    l = el('div', 'ldg'); l.id = 'ldg'; l.setAttribute('role', 'status'); l.setAttribute('aria-live', 'polite');
    const w = el('div', 'ldgbox'); const ring = el('div', 'ldgring'); const im = document.createElement('img'); im.src = LOGO; im.alt = ''; ring.append(im);
    w.append(ring, el('div', 'ldgtxt')); l.append(w); document.body.append(l);
  }
  l.querySelector('.ldgtxt').textContent = msg || 'Loading…'; l.hidden = false;
}
function hideLoading() { const l = $('ldg'); if (l) l.hidden = true; }
function progress(on) {
  let b = $('prog'); if (!b) { b = el('div', 'prog'); b.id = 'prog'; b.hidden = true; document.body.append(b); }
  b.hidden = !on;
}

/* typing #/login, #/signup or #/forgot while signed out opens that screen */
window.addEventListener('hashchange', () => {
  if (started || SHARE) return;
  const h = (location.hash.match(/^#\/(\w+)/) || [])[1];
  if (h === 'signup') showSignup(); else if (h === 'forgot') showForgot(); else if (h === 'login') showLogin();
});

