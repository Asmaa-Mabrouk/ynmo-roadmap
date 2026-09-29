/**
 * @module features/sharing
 * Read-only share links and access roles.
 * Generate/revoke public links (#/share/<token>) served through the shared_snapshot RPC, apply a shared snapshot without login, and the Editor/Viewer access UI.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from '../core/state.js';
import { canWrite, closeDlg, netBar, openDlg } from './safety.js';
import { $, el, setRange, state } from '../core/model.js';
import { allRoadmaps, curRm, fillRm } from '../pages/roadmaps.js';
import { H2, PAGES, clock, logAct, selOf, toast } from '../core/shared.js';
import { render } from '../ui/gantt-render.js';
import { LOGO, sb } from '../core/supabase.js';
import { gateCard } from '../auth/gate.js';
import { setSave } from '../core/saving.js';
import { avatarEl } from '../ui/avatars.js';

/* ---------- 1. sharing and viewer access ---------- */
function shareFor(rm) { const k = Object.keys(S.shares).find(t => S.shares[t].rm === rm); return k ? { token: k, data: S.shares[k] } : null; }
function shareUrl(t) { return location.origin + location.pathname + '#/share/' + t; }
export function openShare() {
  if (!canWrite()) return;
  const rmId = state.rm;
  openDlg('Share ' + curRm().n + ' (read only)', box => {
    box.append(el('p', 'hint', 'Anyone with the link can look at this roadmap without an account. They cannot change anything, and they do not see leave, ideas or the log. Stop sharing at any time and the link stops working.'));
    const area = el('div'); box.append(area);
    const msg = el('div', 'gerr'); msg.setAttribute('aria-live', 'polite'); box.append(msg);
    const close = el('button', 'btn', 'Close'); close.type = 'button'; close.addEventListener('click', closeDlg);
    const draw = () => {
      area.textContent = ''; const s = shareFor(rmId);
      if (!s) {
        const mk = el('button', 'btn primary', 'Create share link'); mk.type = 'button';
        mk.addEventListener('click', async () => {
          mk.disabled = true; const t = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, ''); const data = { rm: rmId, by: S.me.name || S.me.email, at: new Date().toISOString() };
          try { await S.db.doc('share_links/' + t).set(data); S.shares[t] = data; logAct('access', 'created a share link for ' + curRm().n); draw(); } catch (e) { mk.disabled = false; msg.textContent = 'Could not create the link. Ask the admin to run setup v4.'; }
        });
        area.append(mk);
      } else {
        const inp = el('input'); inp.type = 'text'; inp.readOnly = true; inp.value = shareUrl(s.token); inp.id = 'shareurl'; inp.setAttribute('aria-label', 'Share link'); inp.style.width = '100%';
        inp.addEventListener('focus', () => inp.select());
        const cp = el('button', 'btn primary', 'Copy link'); cp.type = 'button';
        cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(inp.value); cp.textContent = 'Copied'; } catch (e) { inp.select(); cp.textContent = 'Press Ctrl+C'; } });
        const stop = el('button', 'btn danger', 'Stop sharing'); stop.type = 'button';
        stop.addEventListener('click', async () => { stop.disabled = true; try { await S.db.doc('share_links/' + s.token).delete(); delete S.shares[s.token]; logAct('access', 'stopped sharing ' + curRm().n); draw(); } catch (e) { stop.disabled = false; msg.textContent = 'Could not stop sharing. Try again.'; } });
        const row = el('div', 'formrow'); row.append(cp, stop); area.append(inp, row, el('div', 'hint', 'Shared by ' + s.data.by + ' on ' + clock(s.data.at)));
      }
    };
    draw(); box.append(close);

  });
}
function applyShared(p) {
  S.over = p.items || {}; S.extras = p.people || {}; S.daysoff = p.daysoff || {};
  S.roadmaps = p.roadmap ? { [p.rm]: p.roadmap } : {};
  if (state.rm !== p.rm) { const r = allRoadmaps().find(x => x.id === p.rm) || H2; state.rm = r.id; setRange(r.a, r.b); }
  fillRm(); render();
}
export async function bootShared(token) {
  S.SHARE = true; S.readonly = true;
  const r = await sb.rpc('shared_snapshot', { t: token });
  if (r.error || !r.data) { const c = gateCard('This link is not active', 'The share link was stopped or is wrong. Ask the person who sent it for a new one.'); return; }
  $('gate').hidden = true; $('shell').classList.remove('app-hidden'); $('shell').classList.add('shared');
  document.body.classList.add('sharedview');
  const nav = $('nav'); nav.textContent = ''; $('toplogo').src = LOGO;
  PAGES.forEach(x => { const s = $('pg-' + x[0]); if (s) s.hidden = x[0] !== 'roadmap'; });
  $('ptitle').textContent = 'Shared roadmap';
  const b = netBar(); b.classList.add('sharebar'); b.hidden = false; b.textContent = 'You are looking at a read-only shared roadmap. It updates by itself every minute.';
  applyShared(r.data); setSave('readonly'); $('save').textContent = 'View only.';
  let last = JSON.stringify(r.data);
  setInterval(async () => { try { const n = await sb.rpc('shared_snapshot', { t: token }); if (n.data && JSON.stringify(n.data) !== last) { last = JSON.stringify(n.data); applyShared(n.data); } else if (!n.data && !n.error) { location.reload(); } } catch (e) { /* keep showing what we have */ } }, window.__sharePoll || 60000);
}
export function renderAccess(root) {
  if (!(S.me && S.me.is_admin)) return;
  const done = S.members.filter(m => m.approved);
  const c = el('div', 'card'); c.append(el('h2', '', 'Who can edit'));
  c.append(el('div', 'hint', 'Editors change the plan. Viewers can look at the roadmap, capacity, snapshots and log, but cannot change anything.'));
  done.forEach(m => {
    const row = el('div', 'formrow'); row.style.alignItems = 'center';
    const who = el('div'); who.append(el('b', '', m.name || m.email), el('div', 'hint', (m.role ? m.role + ' · ' : '') + (m.email || '')));
    row.append(avatarEl(m.avatar, 34, m.name), who);
    if (m.is_admin) { const a = el('span', 'badge', 'Admin'); a.style.marginInlineStart = 'auto'; row.append(a); }
    else {
      const s = selOf([['editor', 'Editor'], ['viewer', 'Viewer']], m.access === 'viewer' ? 'viewer' : 'editor'); s.style.marginInlineStart = 'auto'; s.setAttribute('aria-label', 'Access for ' + (m.name || m.email));
      s.addEventListener('change', async () => {
        const r = await sb.from('profiles').update({ access: s.value }).eq('id', m.id);
        if (r.error) { s.value = m.access === 'viewer' ? 'viewer' : 'editor'; toast('Could not change access. Ask the admin to run setup v4.'); return; }
        m.access = s.value; logAct('access', 'set ' + (m.name || m.email) + ' as ' + s.value); toast((m.name || m.email) + ' is now a ' + s.value + '.');
      });
      row.append(s);
    }
    c.append(row);
  });
  root.append(c);
}

