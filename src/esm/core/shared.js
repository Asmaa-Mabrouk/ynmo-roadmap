/**
 * @module core/shared
 * Shared state, small utilities and the activity log.
 * `me` (current user), page registry, date helpers, toast, the form-field helpers, logAct() (append-only audit trail with optional undo payload) and describe() (human sentence for a log entry).
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { S } from './state.js';
import { $, DAY, DN, H2_ID, MN, START, STATUS, dlabel, el, parseIso, state } from './model.js';
import { curRm } from '../pages/roadmaps.js';
import { renderLog } from '../pages/log.js';
import { sb } from './supabase.js';
import { laneOf } from '../ui/gantt-render.js';

/* ---------- shared state for pages ---------- */
export let ideaUI = { st: 'open', q: '' };
export const H2 = { id: H2_ID, n: 'H2 2026', a: '2026-10-01', b: '2027-01-31', kind: 'H2', builtin: true };
export const PAGES = [['roadmap', 'Roadmap'], ['ideas', 'Ideas'], ['roadmaps', 'Roadmaps'], ['sprints', 'Sprints'], ['reports', 'Reports'], ['resources', 'Resources'], ['vacations', 'Vacations'], ['capacity', 'Capacity'], ['baselines', 'Baselines'], ['log', 'Log'], ['admin', 'Approvals']];
export const DOMAINS = ['PM', 'Mobile', 'Backend', 'Frontend', 'Full-stack', 'Engineering', 'QA', 'UX / Design', 'AI / ML', 'Other'];
export const VTYPES = ['Annual leave', 'Training', 'Public holiday', 'Other'];
export const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
export const fmtIso = s => { const t = parseIso(s); if (t === null) return s || ''; const d = new Date(t); return DN[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MN[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
export function todayIso() { const n = new Date(), z = v => (v < 10 ? '0' : '') + v; return n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate()); }
export function wdays(a, b) { let n = 0; for (let t = parseIso(a); t !== null && t <= parseIso(b); t += DAY) { const w = new Date(t).getUTCDay(); if (w !== 5 && w !== 6) n++; } return n; }
export function kOfIso(s) { const t = parseIso(s); return t === null ? NaN : Math.round((t - START) / DAY); }
export function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return Math.floor(s / 86400) + ' d ago';
}
export function clock(iso) { try { return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } }
export function fld(label, ctl) { const l = el('label'); l.append(el('span', '', label), ctl); return l; }
export function selOf(opts, val, cls) { const s = el('select', cls || ''); opts.forEach(o => { const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; const x = el('option', '', t); x.value = v; if (String(v) === String(val)) x.selected = true; s.append(x); }); return s; }
export function pageHead(t, sub, extra) { const h = el('div', 'pghead'); const d = el('div'); d.append(el('h1', '', t)); if (sub) d.append(el('p', 'sub', sub)); h.append(d); if (extra) h.append(extra); return h; }
export function toast(t) { $('save').textContent = t; }

/* ---------- activity log ---------- */
export function logAct(act, sum, undo) {
  if (!S.me || !sum) return;
  const id = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const data = { at: new Date().toISOString(), uid: S.me.id, name: S.me.name || S.me.email, av: S.me.avatar || '', act: act, sum: sum, rm: curRm().n };
  if (undo) data.u = undo;
  S.logs.unshift({ id: id, data: data }); if (state.page === 'log') renderLog();
  sb.from('activity').insert({ id: id, data: data }).then(() => {}, () => {});
}
export function describe(prev, f) {
  if (!prev) return '';
  const parts = [];
  if (f.t !== undefined && f.t !== prev.t) parts.push('renamed to "' + f.t + '"');
  if (f.st !== undefined && f.st !== prev.st) parts.push('status: ' + STATUS[f.st]);
  if ((f.d0 !== undefined && f.d0 !== prev.d0) || (f.d1 !== undefined && f.d1 !== prev.d1)) parts.push('dates ' + dlabel(f.d0 !== undefined ? f.d0 : prev.d0) + ' to ' + dlabel(f.d1 !== undefined ? f.d1 : prev.d1));
  if (f.res) { const a = f.res.filter(n => !prev.res.includes(n)), r = prev.res.filter(n => !f.res.includes(n)); if (a.length) parts.push('added ' + a.join(', ')); if (r.length) parts.push('removed ' + r.join(', ')); }
  if (f.c !== undefined && f.c !== (prev.c || null)) parts.push('color changed');
  if (f.n !== undefined && f.n !== (prev.n || '')) parts.push('notes edited');
  if (f.sq && f.sq !== prev.sq) parts.push('product: ' + laneOf(f.sq).n);
  if (f.dep) parts.push('depends on ' + (f.dep.length ? f.dep.length + ' bar' + (f.dep.length === 1 ? '' : 's') : 'nothing'));
  if (f.ms !== undefined && !!f.ms !== !!prev.ms) parts.push(f.ms ? 'made a milestone' : 'made a regular bar');
  return parts.join('; ');
}

