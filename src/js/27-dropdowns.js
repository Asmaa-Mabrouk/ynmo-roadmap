/**
 * @module dropdowns
 * Custom dropdown popup.
 * Replaces the OS list of any native <select> with a styled popup while keeping the native element as source of truth (value, change events, forms, tests).
 * NOTE: all src/js files share one global scope (concatenated by build.mjs).
 */
/* ---------- elegant dropdowns: the native select stays (value, change, forms), its list is replaced ---------- */
let cpop = null, cpopSel = null, cpopIdx = -1;
function cpopClose(refocus) {
  if (!cpop) return; const s = cpopSel; cpop.remove(); cpop = null; cpopSel = null;
  if (s) { s.setAttribute('aria-expanded', 'false'); if (refocus) s.focus(); }
}
function cpopMove(d) {
  const rows = [...cpop.querySelectorAll('.copt:not(.dis)')]; if (!rows.length) return;
  let i = rows.findIndex(r => r.classList.contains('act')); i = Math.max(0, Math.min(rows.length - 1, i + d));
  rows.forEach(r => r.classList.remove('act')); rows[i].classList.add('act'); rows[i].scrollIntoView({ block: 'nearest' });
}
function cpopPick(opt) {
  const s = cpopSel; if (!s || opt.disabled) return; const changed = s.value !== opt.value; s.value = opt.value; cpopClose(true);
  if (changed) { s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }
}
function cpopOpen(s) {
  if (cpop && cpopSel === s) { cpopClose(true); return; }
  cpopClose(); cpopSel = s; s.setAttribute('aria-haspopup', 'listbox'); s.setAttribute('aria-expanded', 'true');
  const box = el('div', 'cpop'); box.setAttribute('role', 'listbox'); box.tabIndex = -1;
  [...s.options].forEach(o => {
    const r = el('div', 'copt' + (o.selected ? ' sel act' : '') + (o.disabled ? ' dis' : '')); r.setAttribute('role', 'option'); r.setAttribute('aria-selected', String(o.selected));
    r.append(el('span', '', o.textContent)); if (o.selected) r.append(el('i', 'ck', '✓'));
    r.addEventListener('pointerdown', e => e.preventDefault());
    r.addEventListener('click', () => cpopPick(o));
    r.addEventListener('pointermove', () => { box.querySelectorAll('.act').forEach(x => x.classList.remove('act')); if (!o.disabled) r.classList.add('act'); });
    box.append(r);
  });
  document.body.append(box); cpop = box;
  const b = s.getBoundingClientRect(), h = Math.min(box.scrollHeight, 280);
  box.style.minWidth = b.width + 'px'; box.style.maxHeight = '280px';
  const below = window.innerHeight - b.bottom, top = below >= h + 12 || below >= b.top ? b.bottom + 6 : b.top - h - 6;
  box.style.top = Math.max(8, top) + 'px'; box.style.left = Math.max(8, Math.min(b.left, window.innerWidth - box.offsetWidth - 8)) + 'px';
  const cur = box.querySelector('.sel'); if (cur) cur.scrollIntoView({ block: 'nearest' });
}
document.addEventListener('mousedown', e => {
  const s = e.target.closest && e.target.closest('select'); if (s && !s.disabled && !s.multiple) { e.preventDefault(); s.focus(); cpopOpen(s); return; }
  if (cpop && !cpop.contains(e.target)) cpopClose();
}, true);
document.addEventListener('keydown', e => {
  const t = e.target;
  if (cpop) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cpopClose(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); cpopMove(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); cpopMove(-1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const a = cpop.querySelector('.act'); if (a) cpopPick(cpopSel.options[[...cpop.children].indexOf(a)]); else cpopClose(true); }
    else if (e.key === 'Tab') cpopClose();
    return;
  }
  if (t && t.tagName === 'SELECT' && !t.multiple && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); cpopOpen(t); }
}, true);
window.addEventListener('resize', () => cpopClose());
window.addEventListener('scroll', e => { if (cpop && !cpop.contains(e.target)) cpopClose(); }, true);

