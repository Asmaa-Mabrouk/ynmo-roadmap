/**
 * @module auth/gate
 * Authentication screens.
 * Login, sign-up, forgot/set password, pending-approval and check-email screens; hash routes (#/login, #/signup, ...); logout. Password strength meter comes from the extras module.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { $, el } from '../core/model.js';
import { logoEl, sb } from '../core/supabase.js';
import { AVATARS, avatarEl } from '../ui/avatars.js';
import { afterAuth, loadProfile } from './profile.js';
import { pwMeter } from '../features/safety.js';
import { start } from '../app/shell.js';

/* ---------- gate screens ---------- */
export const JOBS = ['Product Manager', 'Engineer', 'QA', 'UX / Design', 'CEO', 'CTO', 'Executive', 'Other'];
export function gateCard(title, sub) {
  const g = $('gate'); g.hidden = false; g.textContent = ''; g.setAttribute('role', 'main');
  const c = el('form', 'gcard card'); c.noValidate = false;
  const h = el('div', 'ghead'); h.append(logoEl(), el('h1', '', title)); c.append(h);
  if (sub) c.append(el('div', 'meta', sub));
  g.append(c); return c;
}
export function gField(id, label, type, ac, opts) {
  const l = el('label'); l.append(el('span', '', label));
  let i;
  if (type === 'select') { i = el('select'); (opts || []).forEach(o => { const x = el('option', '', o); x.value = o; i.append(x); }); l.append(i); }
  else if (type === 'password') {
    i = el('input'); i.type = 'password';
    const w = el('div', 'pwwrap'), t = el('button', 'pweye', 'Show'); t.type = 'button'; t.setAttribute('aria-label', 'Show password'); t.setAttribute('aria-pressed', 'false');
    t.addEventListener('click', () => { const show = i.type === 'password'; i.type = show ? 'text' : 'password'; t.textContent = show ? 'Hide' : 'Show'; t.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); t.setAttribute('aria-pressed', String(show)); i.focus(); });
    w.append(i, t); l.append(w);
  } else { i = el('input'); i.type = type; l.append(i); }
  i.id = id; i.autocomplete = ac || 'off'; i.required = true; if (type !== 'select') i.style.width = '100%'; else i.style.width = '100%';
  return { label: l, input: i };
}
export function avPicker(sel) {
  const wrap = el('div'); wrap.append(el('span', 'lab', 'Choose your avatar'));
  const g = el('div', 'avpick'); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', 'Avatar');
  const btns = [];
  AVATARS.forEach((a, i) => {
    const b = el('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', 'Avatar ' + (i + 1)); b.append(avatarEl('a' + i, 44));
    b.addEventListener('click', () => { sel.v = 'a' + i; btns.forEach((x, j) => x.setAttribute('aria-checked', String(j === i))); });
    b.setAttribute('aria-checked', String(sel.v === 'a' + i)); btns.push(b); g.append(b);
  });
  wrap.append(g); return wrap;
}
export function bindSubmit(c, fn) {
  const msg = c.querySelector('.gerr'), go = c.querySelector('button[type=submit]');
  c.addEventListener('submit', async e => { e.preventDefault(); go.disabled = true; go.classList.add('busy'); msg.textContent = ''; msg.className = 'gerr'; try { await fn(msg); } catch (x) { msg.textContent = x.message || 'Something went wrong. Try again.'; } go.disabled = false; go.classList.remove('busy'); });
}
function linkBtn(t, fn) { const b = el('button', 'link', t); b.type = 'button'; b.addEventListener('click', fn); return b; }
export const LANDING = (location.hash.match(/^#\/(\w+)/) || [])[1];
function gHash(n) { try { window.history.replaceState(null, '', '#/' + n); } catch (e) { /* ignore */ } }
export function showForgot(prefill) {
  gHash('forgot');
  const c = gateCard('Reset your password', 'Type your email and we will send you a link to choose a new password.');
  const em = gField('fe', 'Email', 'email', 'username'); em.input.value = prefill || '';
  const msg = el('div', 'gerr'); msg.setAttribute('aria-live', 'polite');
  const go = el('button', 'btn primary', 'Send reset link'); go.type = 'submit';
  c.append(em.label, msg, go, linkBtn('Back to sign in', showLogin));
  bindSubmit(c, async m => {
    const e = em.input.value.trim(); if (!e) throw new Error('Type your email first.');
    const r = await sb.auth.resetPasswordForEmail(e, { redirectTo: location.origin + location.pathname });
    if (r.error) throw new Error(/rate|limit|429/i.test((r.error.message || '') + (r.error.status || '')) ? 'Too many emails were sent recently, so the limit was reached. Wait about an hour and try again, or ask the admin to turn on custom email sending.' : 'Could not send the link (' + (r.error.message || 'unknown error') + '). Try again in a minute.');
    m.className = 'gerr ok'; m.textContent = 'If this email has an account, a link is on its way. Check spam too.';
  });
  em.input.focus();
}
export function showLogin() {
  gHash('login');
  const c = gateCard('Sign in to Ynmo Roadmaps', 'Use the email you signed up with.');
  const em = gField('em', 'Email', 'email', 'username'), pw = gField('pw', 'Password', 'password', 'current-password');
  const msg = el('div', 'gerr'); msg.setAttribute('aria-live', 'polite');
  const go = el('button', 'btn primary', 'Sign in'); go.type = 'submit';
  const row = el('div', 'formrow');
  row.append(linkBtn('Create an account', showSignup), linkBtn('Forgot password?', () => showForgot(em.input.value.trim())));
  c.append(em.label, pw.label, msg, go, row);
  bindSubmit(c, async () => {
    const r = await sb.auth.signInWithPassword({ email: em.input.value.trim(), password: pw.input.value });
    if (r.error) throw new Error('Email or password is not right.');
    await afterAuth(r.data.session);
  });
  em.input.focus();
}
export function showSignup() {
  gHash('signup');
  const c = gateCard('Create your account', 'An admin approves new accounts before they can see the roadmap.');
  const nm = gField('sn', 'Full name', 'text', 'name'), jb = gField('sj', 'Your role', 'select', 'off', JOBS);
  const em = gField('se', 'Work email', 'email', 'username'), pw = gField('sp', 'Password (8 characters or more)', 'password', 'new-password');
  const sel = { v: 'a0' }, pick = avPicker(sel);
  const two = el('div', 'two'); two.append(nm.label, jb.label);
  const msg = el('div', 'gerr'); msg.setAttribute('aria-live', 'polite');
  const go = el('button', 'btn primary', 'Create account'); go.type = 'submit';
  pwMeter(pw.input, pw.label);
  c.append(two, em.label, pw.label, pick, msg, go, linkBtn('I already have an account', showLogin));
  bindSubmit(c, async m => {
    if (pw.input.value.length < 8) throw new Error('Use at least 8 characters.');
    const r = await sb.auth.signUp({ email: em.input.value.trim(), password: pw.input.value, options: { data: { name: nm.input.value.trim(), role: jb.input.value, avatar: sel.v }, emailRedirectTo: location.origin + location.pathname } });
    if (r.error) throw new Error(/rate|limit|429/i.test(r.error.message || '') ? 'Too many sign-up emails were sent in the last hour, so Supabase paused new sign-ups. Nothing is wrong with your details. Please try again in about an hour, or ask the admin to add you directly.' : r.error.message);
    if (r.data && r.data.session) { await afterAuth(r.data.session); return; }
    showCheckEmail(em.input.value.trim());
  });
  nm.input.focus();
}
function showCheckEmail(email) {
  const c = gateCard('Check your email', 'We sent a confirmation link to ' + email + '. Open it, then come back here and sign in. If it is not in your inbox, check spam.');
  const msg = el('div', 'gerr'); msg.setAttribute('aria-live', 'polite');
  const again = el('button', 'btn', 'Send the link again'); again.type = 'button';
  again.addEventListener('click', async () => { again.disabled = true; try { const r = await sb.auth.resend({ type: 'signup', email: email, options: { emailRedirectTo: location.origin + location.pathname } }); msg.className = r.error ? 'gerr' : 'gerr ok'; msg.textContent = r.error ? 'Could not resend yet. Wait a minute and try again.' : 'Sent again. Check your inbox.'; } catch (e) { msg.textContent = 'Could not resend yet.'; } setTimeout(() => { again.disabled = false; }, 30000); });
  const back = el('button', 'btn primary', 'Go to sign in'); back.type = 'button'; back.addEventListener('click', showLogin);
  c.append(msg, back, again);
}
let pendTimer = 0;
export function showPending(profile) {
  gHash('pending');
  const c = gateCard('Waiting for admin approval', 'Thanks for registering with ' + (profile.email || 'your email') + '. An admin needs to approve your account before you can open the roadmap. You will get an email as soon as it is approved, and this page opens the tool automatically.');
  const b1 = el('button', 'btn primary', 'Check again'); b1.type = 'button';
  const check = async () => { const p = await loadProfile(); if (p && p.approved) { clearInterval(pendTimer); start(); return true; } return false; };
  b1.addEventListener('click', async () => { b1.disabled = true; const ok = await check(); b1.disabled = false; if (!ok) b1.textContent = 'Not approved yet. Check again'; });
  const b2 = el('button', 'btn', 'Log out'); b2.type = 'button'; b2.addEventListener('click', doLogout);
  c.append(b1, b2);
  clearInterval(pendTimer); pendTimer = setInterval(check, 15000);
}
export function showSetPw() {
  const c = gateCard('Set your password');
  const p1 = gField('p1', 'New password (8 characters or more)', 'password', 'new-password'), p2 = gField('p2', 'Repeat password', 'password', 'new-password');
  const msg = el('div', 'gerr'); const go = el('button', 'btn primary', 'Save and continue'); go.type = 'submit';
  pwMeter(p1.input, p1.label);
  c.append(p1.label, p2.label, msg, go);
  bindSubmit(c, async () => {
    if (p1.input.value.length < 8) throw new Error('Use at least 8 characters.');
    if (p1.input.value !== p2.input.value) throw new Error('The two passwords do not match.');
    const r = await sb.auth.updateUser({ password: p1.input.value }); if (r.error) throw new Error(r.error.message);
    window.history.replaceState(null, '', location.pathname);
    const s2 = await sb.auth.getSession(); await afterAuth(s2.data.session);
  });
  p1.input.focus();
}
export async function doLogout() { try { await sb.auth.signOut(); } catch (e) { /* ignore */ } location.reload(); }

