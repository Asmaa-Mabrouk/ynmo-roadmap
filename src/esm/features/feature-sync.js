/**
 * @module features/feature-sync
 * The link between roadmap bars, Monthly cards and weekly-report items (see feature-link.js for the rules): finds what changed,
 * lets a person check roadmap updates one by one, and lets an admin approve or reject changes that would alter the roadmap.
 */
import { S } from '../core/state.js';
import { el, canEdit } from '../core/model.js';
import { write, persist, pushHistory } from '../core/saving.js';
import { toast, logAct } from '../core/shared.js';
import { openDlg, closeDlg } from './safety.js';
import { render } from '../ui/gantt-render.js';
import { cardId, clampPct } from './month-model.js';
import { compare, roadVals, fieldName, showVal } from './feature-link.js';

const isMonthDoc = id => /^mo\d{6}$/.test(id), isReportDoc = id => /^rp\d{8}/.test(id);
const barOf = rid => { const o = rid && S.over[rid]; return o && !o.x ? o : null; };
const linePctOf = l => (Number.isFinite(l.pct) ? l.pct : l.st === 'done' ? 100 : 0);
/** Every Monthly card, with the month doc it lives in. */
export function allCards() {
  const out = [];
  Object.keys(S.reports || {}).filter(isMonthDoc).forEach(did => ((S.reports[did] || {}).lines || []).forEach(l => out.push({ did, l })));
  return out;
}
export const cardByFid = fid => { const x = allCards().find(c => c.l.id === fid); return x ? x.l : null; };
/** The feature id shown to people (DC#12) for a card's internal id. */
export const fidLabel = fid => { const c = cardByFid(fid); return c ? cardId(c) : ''; };
/** Resolve what a person typed (DC#12, dc#12) to the card's internal id, or ''. */
export function fidFromText(txt) { const t = String(txt || '').trim().toUpperCase().replace(/\s+/g, ''); if (!t) return ''; const c = allCards().find(x => cardId(x.l).toUpperCase() === t); return c ? c.l.id : ''; }
export const cardIdsList = () => allCards().filter(x => x.l.rid).map(x => cardId(x.l)).filter(Boolean).sort();

/** Linked rows. kind 'card' (Monthly) or 'line' (weekly report items). Each: {kind, did, l, id, label, bar, rid, cur, base, cmp}. */
export function scan() {
  const rows = [];
  const cards = allCards();
  cards.forEach(({ did, l }) => {
    const bar = barOf(l.rid); if (!bar) return;
    const cur = { t: l.t, pct: clampPct(l.pct) }, base = l.lk || null;
    rows.push({ kind: 'card', did, l, id: cardId(l), label: l.t, bar, rid: l.rid, cur, base, cmp: compare(cur, base, roadVals(bar)) });
  });
  Object.keys(S.reports || {}).filter(isReportDoc).forEach(did => {
    const d = S.reports[did] || {};
    Object.keys(d.prods || {}).forEach(k => ((d.prods[k] || {}).items || []).forEach(l => {
      if (!l.fid) return; const c = cards.find(x => x.l.id === l.fid), bar = c && barOf(c.l.rid); if (!bar) return;
      const cur = { t: l.t, pct: linePctOf(l) }, base = l.lk || null;
      rows.push({ kind: 'line', did, pk: k, l, id: cardId(c.l), label: l.t, bar, rid: c.l.rid, cur, base, cmp: compare(cur, base, roadVals(bar)), week: d.a });
    }));
  });
  return rows;
}
export const incoming = kind => scan().filter(r => r.kind === kind && r.cmp.incoming.length);
export const outgoing = () => scan().filter(r => r.cmp.outgoing.length);
export const pendingCount = () => outgoing().reduce((n, r) => n + r.cmp.outgoing.length, 0);

function saveDoc(did, mutate) {
  const old = S.reports[did]; if (!old) return;
  const d = JSON.parse(JSON.stringify(old)); mutate(d); d.by = (S.me && (S.me.name || S.me.email)) || ''; d.ts = Date.now(); S.reports[did] = d; write('reports/' + did, d);
}
const findLine = (d, row) => row.kind === 'card' ? (d.lines || []).find(z => z.id === row.l.id) : ((d.prods[row.pk] || {}).items || []).find(z => z.id === row.l.id);
const setVal = (x, f, v, kind) => {
  if (f === 't') x.t = v; else { x.pct = v; if (kind === 'card') x.pe = true; else x.st = v >= 100 ? 'done' : x.st === 'done' ? 'on' : x.st; }
  if (kind === 'line') x.edited = true;
};
/** Apply what the roadmap says to the item (a person checked it). */
export function applyIncoming(row, f, to) {
  saveDoc(row.did, d => { const x = findLine(d, row); if (!x) return; setVal(x, f, to, row.kind); x.lk = Object.assign({ t: row.cur.t, pct: row.cur.pct }, x.lk || {}); x.lk[f] = to; });
  logAct(row.kind === 'card' ? 'report' : 'report', 'applied the roadmap ' + fieldName(f).toLowerCase() + ' to ' + row.id + ' "' + row.label + '"');
}
/** Keep the item's own value: from now on it is a request for the admin to change the roadmap. */
export function keepMine(row, f, road) {
  saveDoc(row.did, d => { const x = findLine(d, row); if (!x) return; x.lk = Object.assign({ t: row.cur.t, pct: row.cur.pct }, x.lk || {}); x.lk[f] = road; });
}
/** An admin approves: the roadmap bar takes the item's value. */
export function approve(row, f, to) {
  if (!(S.me && S.me.is_admin)) return;
  pushHistory(); const patch = f === 't' ? { t: String(to).slice(0, 140) } : { pc: clampPct(to) };
  S.over[row.rid] = Object.assign({}, S.over[row.rid], patch); persist(row.rid, patch); render();
  saveDoc(row.did, d => { const x = findLine(d, row); if (!x) return; x.lk = Object.assign({ t: row.cur.t, pct: row.cur.pct }, x.lk || {}); x.lk[f] = to; });
  logAct('roadmap', 'approved ' + fieldName(f).toLowerCase() + ' of ' + row.id + ' "' + row.label + '" on the roadmap: ' + showVal(f, to));
}
/** An admin rejects: the item goes back to the roadmap value. */
export function reject(row, f, road) {
  if (!(S.me && S.me.is_admin)) return;
  saveDoc(row.did, d => { const x = findLine(d, row); if (!x) return; const to = road === undefined ? (x.lk && x.lk[f] !== undefined ? x.lk[f] : row.cur[f]) : road; setVal(x, f, to, row.kind); x.lk = Object.assign({ t: row.cur.t, pct: row.cur.pct }, x.lk || {}); x.lk[f] = to; });
  logAct('roadmap', 'rejected a ' + fieldName(f).toLowerCase() + ' change of ' + row.id + ' "' + row.label + '"');
}
/** Editors quietly keep the hidden records up to date (new links, values that already agree). */
let ensuring = false;
export function ensureRecords() {
  if (ensuring || !canEdit()) return; const rows = scan(), todo = rows.filter(r => !r.base || Object.keys(r.cmp.rebase).length); if (!todo.length) return;
  ensuring = true;
  try { todo.forEach(r => saveDoc(r.did, d => { const x = findLine(d, r); if (!x) return; x.lk = Object.assign({ t: r.cur.t, pct: r.cur.pct }, x.lk || {}, r.cmp.rebase); })); } finally { ensuring = false; }
}

function rowBlock(r, f, side, actions) {
  const b = el('div', 'fsrow'), top = el('div', 'fshead'); top.append(el('b', 'fsid', r.id), el('span', 'fsname', r.label), el('span', 'chip fsf', fieldName(f) + (r.kind === 'line' ? ' · weekly report' : '')));
  b.append(top, el('div', 'fsdiff', side)); const row = el('div', 'row'); actions.forEach(a => row.append(a)); b.append(row); return b;
}
const btn = (txt, cls, fn) => { const x = el('button', 'btn' + (cls ? ' ' + cls : ''), txt); x.type = 'button'; x.addEventListener('click', fn); return x; };
/** "Check updates": roadmap changes for Monthly cards or report items, applied one by one. */
export function openCheckUpdates(kind, after, did) {
  openDlg('Check updates from the roadmap', box => {
    const draw = () => {
      box.textContent = ''; const rows = incoming(kind).filter(r => !did || r.did === did); box.append(el('p', 'sub2', 'These features changed on the roadmap. Apply each change you agree with. "Keep mine" leaves your value and asks an admin to change the roadmap instead.'));
      if (!rows.length) { box.append(el('p', 'hint', 'Everything is up to date.')); box.append(btn('Close', '', () => { closeDlg(); if (after) after(); })); return; }
      rows.forEach(r => r.cmp.incoming.forEach(x => {
        const a = btn('Apply', 'primary', () => { applyIncoming(r, x.f, x.to); toast('Applied.'); draw(); }), k = btn('Keep mine', '', () => { keepMine(r, x.f, x.to); draw(); });
        a.setAttribute('aria-label', 'Apply ' + fieldName(x.f) + ' of ' + r.id); k.setAttribute('aria-label', 'Keep mine for ' + fieldName(x.f) + ' of ' + r.id);
        box.append(rowBlock(r, x.f, 'Roadmap: ' + showVal(x.f, x.to) + '   ·   Here: ' + showVal(x.f, x.from), [a, k]));
      }));
      box.append(btn('Close', '', () => { closeDlg(); if (after) after(); }));
    };
    draw();
  });
}
/** Admin card: changes from Monthly / the weekly report waiting to be approved for the roadmap. */
export function requestsCard(again) {
  const rows = outgoing(), c = el('div', 'card fsreq'); c.id = 'roadreq';
  c.append(el('h2', '', 'Roadmap update requests' + (rows.length ? ' (' + rows.reduce((n, r) => n + r.cmp.outgoing.length, 0) + ')' : '')), el('p', 'sub', 'Changes made in Monthly deliverables or the weekly report to a feature that is on the roadmap. Nothing changes on the roadmap until you approve it.'));
  if (!rows.length) { c.append(el('p', 'hint', 'No requests waiting.')); return c; }
  rows.forEach(r => r.cmp.outgoing.forEach(x => {
    const a = btn('Approve', 'primary', () => { approve(r, x.f, x.to); toast('Roadmap updated.'); again(); }), n = btn('Reject', '', () => { reject(r, x.f, x.road); toast('Rejected. The item went back to the roadmap value.'); again(); });
    a.setAttribute('aria-label', 'Approve ' + fieldName(x.f) + ' of ' + r.id); n.setAttribute('aria-label', 'Reject ' + fieldName(x.f) + ' of ' + r.id);
    c.append(rowBlock(r, x.f, 'Roadmap now: ' + showVal(x.f, x.road) + '   →   Requested: ' + showVal(x.f, x.to) + '   (from ' + (r.kind === 'card' ? 'Monthly deliverables' : 'the weekly report') + ')', [a, n]));
  }));
  return c;
}
