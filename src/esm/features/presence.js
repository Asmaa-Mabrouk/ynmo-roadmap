/**
 * @module features/presence
 * Who is online and soft edit locks.
 * Supabase Realtime presence on the PRIVATE channel `ynmo-presence` (requires the realtime policies in supabase-setup-v5-security.sql). Shows avatars and warns when someone else is editing the same bar.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { toast } from '../core/shared.js';
import { $, el, state } from '../core/model.js';
import { sb } from '../core/supabase.js';
import { avatarEl } from '../ui/avatars.js';

/* ---------- 2. presence + soft lock ---------- */
let presT = 0, lockOverride = null, lockAt = 0;
function myPres() { return { uid: S.me.id, name: S.me.name || S.me.email, av: S.me.avatar || '', page: state.page, rm: state.rm, edit: state.edit ? state.edit.split('|')[0] : null }; }
export function trackPres() {
  clearTimeout(presT);
  presT = setTimeout(() => { if (S.presCh && S.me) { try { S.presCh.track(myPres()); } catch (e) { /* not connected */ } } }, 120);
}
export function startPresence() {
  if (S.presCh || !sb.channel) return;
  try {
    S.presCh = sb.channel('ynmo-presence', { config: { private: true, presence: { key: S.me.id } } });
    S.presCh.on('presence', { event: 'sync' }, () => { try { S.pres = S.presCh.presenceState() || {}; } catch (e) { S.pres = {}; } drawPresence(); decorateLocks(); });
    S.presCh.subscribe(s => { if (s === 'SUBSCRIBED') trackPres(); });
  } catch (e) { S.presCh = null; }
}
function others() { const out = []; Object.keys(S.pres).forEach(k => { if (k === (S.me && S.me.id)) return; const m = (S.pres[k] || [])[0]; if (m) out.push(m); }); return out; }
function editorOf(id) { const o = others().find(m => m.edit === id); return o || null; }
function drawPresence() {
  let box = $('presence');
  if (!box) { box = el('div', 'presence'); box.id = 'presence'; box.setAttribute('aria-label', 'People online'); const av = $('avbtn'); av.parentNode.insertBefore(box, av); }
  box.textContent = '';
  const o = others(); box.hidden = !o.length;
  o.slice(0, 4).forEach(m => { const a = avatarEl(m.av, 28, m.name); a.title = m.name + (m.edit ? ' · editing' : ' · online') + ' · ' + (m.page || ''); a.classList.add('pav'); box.append(a); });
  if (o.length > 4) box.append(el('span', 'pmore', '+' + (o.length - 4)));
  box.setAttribute('role', 'group'); box.setAttribute('aria-label', o.length + (o.length === 1 ? ' other person online: ' : ' others online: ') + o.map(m => m.name).join(', '));
}
export function decorateLocks() {
  const g = $('grid'); if (!g) return;
  g.querySelectorAll('.bar.locked').forEach(b => { b.classList.remove('locked'); const t = b.querySelector('.lockchip'); if (t) t.remove(); });
  others().forEach(m => {
    if (!m.edit) return;
    g.querySelectorAll('.bar').forEach(b => { if (b.dataset.id === m.edit && !b.classList.contains('editing')) { b.classList.add('locked'); b.append(el('span', 'lockchip', '✎ ' + String(m.name).split(' ')[0])); b.title += ' · ' + m.name + ' is editing'; } });
  });
}
export function lockCheck(it) {
  const o = editorOf(it.id); if (!o) return true;
  if (lockOverride === it.id && Date.now() - lockAt < 6000) { lockOverride = null; return true; }
  lockOverride = it.id; lockAt = Date.now();
  toast(o.name + ' is editing "' + it.t + '" right now. Try again within 6 seconds to edit anyway.');
  return false;
}

