/**
 * @module profile
 * Profile loading and editing.
 * Reads the `profiles` row after sign-in (approval, admin, access role), profile edit dialog and avatar drawing.
 * NOTE: all src/js files share one global scope (concatenated by build.mjs).
 */
/* ---------- profile ---------- */
async function loadProfile() {
  const s = (await sb.auth.getSession()).data.session; if (!s) return null;
  const u = s.user, md = u.user_metadata || {};
  let r = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
  let p = r.data;
  if (!p) {
    await sb.from('profiles').insert({ id: u.id, email: u.email, name: md.name || (u.email || '').split('@')[0], role: md.role || '', avatar: md.avatar || '' });
    r = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle(); p = r.data || { id: u.id, email: u.email, name: md.name || '', role: md.role || '', avatar: md.avatar || '', approved: false };
  }
  me = p; return p;
}
async function afterAuth(session) {
  if (!session) { showLogin(); return; }
  const p = await loadProfile();
  if (p && p.approved) start(); else showPending(p || { email: session.user.email });
}
function openProfileEdit() {
  const c = gateCard('Edit profile');
  const nm = gField('en', 'Full name', 'text', 'name'), jb = gField('ej', 'Your role', 'select', 'off', JOBS);
  nm.input.value = me.name || ''; jb.input.value = JOBS.includes(me.role) ? me.role : 'Other';
  const sel = { v: me.avatar || 'a0' }, pick = avPicker(sel);
  const two = el('div', 'two'); two.append(nm.label, jb.label);
  const msg = el('div', 'gerr'); const go = el('button', 'btn primary', 'Save'); go.type = 'submit';
  const cancel = el('button', 'btn', 'Cancel'); cancel.type = 'button'; cancel.addEventListener('click', () => { $('gate').hidden = true; });
  c.append(two, pick, msg, go, cancel);
  bindSubmit(c, async () => {
    const patch = { name: nm.input.value.trim(), role: jb.input.value, avatar: sel.v };
    const r = await sb.from('profiles').update(patch).eq('id', me.id); if (r.error) throw new Error(r.error.message);
    Object.assign(me, patch); try { await sb.auth.updateUser({ data: patch }); } catch (e) { /* metadata only */ }
    $('gate').hidden = true; drawAvatar(); refreshPage();
  });
}
function drawAvatar() {
  const b = $('avbtn'); b.textContent = ''; b.append(avatarEl(me.avatar, 38, me.name));
  const m = $('umenu'); m.textContent = '';
  const w = el('div', 'who2'); const t = el('div'); t.append(el('b', '', me.name || me.email), el('small', '', (me.role || '') + (me.is_admin ? ' · Admin' : '')), el('small', '', me.email || ''));
  w.append(avatarEl(me.avatar, 44, me.name), t); m.append(w);
  const e = el('button', 'mi', 'Edit profile'); e.type = 'button'; e.addEventListener('click', () => { m.hidden = true; b.setAttribute('aria-expanded', 'false'); openProfileEdit(); });
  const o = el('button', 'mi', 'Log out'); o.type = 'button'; o.addEventListener('click', doLogout);
  const ev = el('button', 'mi', 'Sign out on all devices'); ev.type = 'button'; ev.addEventListener('click', signOutEverywhere);
  m.append(e, o, ev);
}

