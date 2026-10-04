/**
 * @module ui/dropdowns
 * Custom dropdown popup.
 * Replaces the OS list of any native <select> with a styled popup while keeping the native element as source of truth (value, change events, forms, tests).
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { el } from '../core/model.js';

/* ---------- elegant dropdowns: the native select stays (value, change, forms), its list is replaced ---------- */
let cpop = null, cpopSel = null, openedAt = 0;
function cpopClose(refocus) {
  if (!cpop) return; const s = cpopSel; cpop.remove(); cpop = null; cpopSel = null;
  if (s) { s.setAttribute('aria-expanded', 'false'); if (refocus) s.focus(); }
}
const rowsOf = () => [...cpop.querySelectorAll('.copt:not(.dis):not([hidden])')];
function cpopMove(d) {
  const rows = rowsOf(); if (!rows.length) return;
  let i = rows.findIndex(r => r.classList.contains('act')); i = Math.max(0, Math.min(rows.length - 1, i + d));
  cpop.querySelectorAll('.act').forEach(r => r.classList.remove('act')); rows[i].classList.add('act'); rows[i].scrollIntoView({ block: 'nearest' });
}
function cpopPick(opt) {
  const s = cpopSel; if (!s || opt.disabled) return; const changed = s.value !== opt.value; s.value = opt.value; cpopClose(true);
  if (changed) { s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }
}
/** Filter the rows by what was typed in the search box; the first match becomes the active row. */
/** Lower-case, no accents / Arabic diacritics, Arabic letter variants folded, so 'omar' finds 'Ömar' and 'احمد' finds 'أحمد'. */
export const fold = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();
function cpopFilter(q) {
  const words = fold(q).split(/\s+/).filter(Boolean); let first = null, any = false;   // every typed word must appear
  cpop.querySelectorAll('.copt[data-opt]').forEach(r => { const txt = fold(r.textContent), hit = words.every(w => txt.includes(w)); r.hidden = !hit; r.classList.remove('act'); if (hit) { any = true; if (!first && !r.classList.contains('dis')) first = r; } });
  if (first) first.classList.add('act'); cpop.querySelector('.cnone').hidden = any;
}
function cpopOpen(s) {
  if (cpop && cpopSel === s) { cpopClose(true); return; }
  cpopClose(); cpopSel = s; s.setAttribute('aria-haspopup', 'listbox'); s.setAttribute('aria-expanded', 'true');
  const box = el('div', 'cpop'); box.tabIndex = -1;
  const q = el('input', 'csearch'); q.type = 'search'; q.placeholder = 'Search…'; q.setAttribute('aria-label', 'Search the list'); q.autocomplete = 'off'; q.setAttribute('autocapitalize', 'off'); q.setAttribute('autocorrect', 'off'); q.spellcheck = false; q.setAttribute('enterkeyhint', 'search');
  ['input', 'keyup', 'search', 'change', 'compositionend'].forEach(ev => q.addEventListener(ev, () => cpopFilter(q.value)));   // several events: some browsers and keyboards (IME, phones) do not send every one
  box.append(q);
  const list = el('div', 'clist'); list.setAttribute('role', 'listbox'); box.append(list);
  [...s.options].forEach(o => {
    const r = el('div', 'copt' + (o.selected ? ' sel act' : '') + (o.disabled ? ' dis' : '')); r.dataset.opt = '1'; r._opt = o; r.setAttribute('role', 'option'); r.setAttribute('aria-selected', String(o.selected));
    r.append(el('span', '', o.textContent)); if (o.selected) r.append(el('i', 'ck', '✓'));
    r.addEventListener('pointerdown', e => e.preventDefault());
    r.addEventListener('click', () => cpopPick(o));
    r.addEventListener('pointermove', () => { box.querySelectorAll('.act').forEach(x => x.classList.remove('act')); if (!o.disabled) r.classList.add('act'); });
    list.append(r);
  });
  const none = el('div', 'copt dis cnone', 'No matches'); none.hidden = true; list.append(none);
  document.body.append(box); cpop = box; openedAt = Date.now();
  const b = s.getBoundingClientRect(), h = Math.min(box.scrollHeight, 320);
  box.style.minWidth = Math.max(b.width, 180) + 'px'; box.style.maxHeight = '320px';
  const below = window.innerHeight - b.bottom, top = below >= h + 12 || below >= b.top ? b.bottom + 6 : b.top - h - 6;
  box.style.top = Math.max(8, top) + 'px'; box.style.left = Math.max(8, Math.min(b.left, window.innerWidth - box.offsetWidth - 8)) + 'px';
  const cur = box.querySelector('.sel'); if (cur) cur.scrollIntoView({ block: 'nearest' });
  q.focus({ preventScroll: true });
  if (document.activeElement !== q) setTimeout(() => { if (cpop === box) q.focus({ preventScroll: true }); }, 30);   // Safari / phones can refuse a focus made inside the opening event
  return q;
}
document.addEventListener('mousedown', e => {
  const s = e.target.closest && e.target.closest('select'); if (s && !s.disabled && !s.multiple) { e.preventDefault(); s.focus({ preventScroll: true }); cpopOpen(s); return; }
  if (cpop && !cpop.contains(e.target)) cpopClose();
}, true);
document.addEventListener('keydown', e => {
  const t = e.target;
  if (cpop) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cpopClose(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); cpopMove(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); cpopMove(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); const a = cpop.querySelector('.copt.act:not([hidden])'); if (a && a._opt) cpopPick(a._opt); else cpopClose(true); }
    else if (e.key === 'Tab') cpopClose();
    return;
  }
  if (t && t.tagName === 'SELECT' && !t.multiple && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); cpopOpen(t); }
  else if (t && t.tagName === 'SELECT' && !t.multiple && !t.disabled && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {   // typing on a focused dropdown searches it instead of silently changing the value
    e.preventDefault(); const q = cpopOpen(t); if (q) { q.value = e.key; cpopFilter(q.value); }
  }
}, true);
let lastW = window.innerWidth;
window.addEventListener('resize', () => { const w = window.innerWidth; if (w === lastW) return; lastW = w; cpopClose(); });   // only a width change closes it: a phone keyboard changes the height
window.addEventListener('scroll', e => { if (cpop && Date.now() - openedAt > 250 && !cpop.contains(e.target)) cpopClose(); }, true);

