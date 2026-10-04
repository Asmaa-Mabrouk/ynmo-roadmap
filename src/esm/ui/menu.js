/**
 * @module ui/menu
 * A small searchable popup menu (used by the sprint editor for `/`, `@`, `#`, status and tag colours).
 * Reuses the dropdown look (.cpop / .copt). One menu at a time. Depends on the DOM only.
 */
import { el } from '../core/model.js';
import { fold } from './dropdowns.js';

let menu = null, done = null;
export function closeMenu() { if (!menu) return; menu.remove(); menu = null; document.removeEventListener('pointerdown', outside, true); const d = done; done = null; if (d) d(); }
function outside(e) { if (menu && !menu.contains(e.target)) closeMenu(); }

/**
 * @param {Element|DOMRect} at anchor element or rectangle to open under
 * @param {Array<{label:string, sub?:string, dot?:string, value?:any, disabled?:boolean}>} items
 * @param {{onPick:Function, onClose?:Function, search?:boolean, placeholder?:string, create?:(q:string)=>object|null, label?:string}} o
 */
export function openMenu(at, items, o) {
  closeMenu();
  const box = el('div', 'cpop cmenu'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', o.label || 'Menu');
  const q = el('input', 'csearch'); q.type = 'search'; q.placeholder = o.placeholder || 'Search…'; q.autocomplete = 'off'; q.setAttribute('aria-label', o.label || 'Search'); if (o.search === false) q.classList.add('off');
  const list = el('div', 'clist'); list.setAttribute('role', 'listbox'); box.append(q, list);
  let picked = false;
  const pick = it => { if (it.disabled) return; picked = true; const cb = o.onPick; closeMenu(); cb(it); };
  const draw = () => {
    const s = q.value.trim().toLowerCase(), ws = fold(q.value).split(/\s+/).filter(Boolean); list.textContent = '';
    const rows = items.filter(i => { const t = fold(i.label + ' ' + (i.sub || '')); return ws.every(w => t.includes(w)); });
    const c = o.create && s ? o.create(q.value.trim()) : null;
    if (c && !items.some(i => i.label.toLowerCase() === s)) rows.push(c);
    rows.forEach(it => {
      const r = el('div', 'copt' + (it.disabled ? ' dis' : '')); r.setAttribute('role', 'option'); r._it = it;
      if (it.dot) { const d = el('i', 'tdot'); d.style.background = it.dot; r.append(d); }
      r.append(el('span', '', it.label)); if (it.sub) r.append(el('span', 'csub', it.sub));
      r.addEventListener('pointerdown', e => e.preventDefault()); r.addEventListener('click', () => pick(it));
      r.addEventListener('pointermove', () => { list.querySelectorAll('.act').forEach(x => x.classList.remove('act')); if (!it.disabled) r.classList.add('act'); });
      list.append(r);
    });
    if (!rows.length) list.append(el('div', 'copt dis cnone', 'No matches'));
    const f = [...list.children].find(r => r._it && !r._it.disabled); if (f) f.classList.add('act');
  };
  const move = d => { const rows = [...list.querySelectorAll('.copt')].filter(r => r._it && !r._it.disabled); if (!rows.length) return; let i = rows.findIndex(r => r.classList.contains('act')); i = Math.max(0, Math.min(rows.length - 1, i + d)); list.querySelectorAll('.act').forEach(x => x.classList.remove('act')); rows[i].classList.add('act'); rows[i].scrollIntoView({ block: 'nearest' }); };
  q.addEventListener('input', draw);
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const a = list.querySelector('.copt.act'); if (a && a._it) pick(a._it); }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); closeMenu(); }
  });
  draw(); document.body.append(box); menu = box; done = () => { if (o.onClose) o.onClose(picked); };
  const r = at.getBoundingClientRect ? at.getBoundingClientRect() : at, h = Math.min(box.scrollHeight, 320);
  box.style.minWidth = Math.max(r.width || 0, 200) + 'px'; box.style.maxHeight = '320px';
  const below = window.innerHeight - r.bottom, top = below >= h + 12 || below >= r.top ? r.bottom + 4 : r.top - h - 4;
  box.style.top = Math.max(8, top) + 'px'; box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - box.offsetWidth - 8)) + 'px';
  document.addEventListener('pointerdown', outside, true);
  q.focus({ preventScroll: true });
}
