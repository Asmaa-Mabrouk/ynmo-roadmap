/**
 * @module features/rich-text
 * Minimal, safe rich text for the weekly report (bold, italic, underline, bullet/numbered lists, https links).
 * Stored HTML is never trusted: `cleanFragment` rebuilds it node by node from a whitelist, so nothing else (scripts, handlers, styles,
 * javascript: links) can ever reach the page, whether it came from a paste, the database or a tampered row.
 */
const KEEP = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', UL: 'ul', OL: 'ol', LI: 'li', BR: 'br', P: 'p', DIV: 'p' };
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'MATH']);

function walk(src, out) {
  src.childNodes.forEach(n => {
    if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue)); return; }
    if (n.nodeType !== 1 || DROP.has(n.tagName)) return;
    const tag = KEEP[n.tagName];
    if (n.tagName === 'A') {
      const href = n.getAttribute('href') || '';
      if (/^https:\/\//i.test(href) || /^mailto:/i.test(href)) { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; walk(n, a); out.appendChild(a); } else walk(n, out);
    } else if (tag === 'br') out.appendChild(document.createElement('br'));
    else if (tag) { const e = document.createElement(tag); walk(n, e); out.appendChild(e); }
    else walk(n, out);
  });
}
/** Sanitised DOM fragment for any HTML string. */
export function cleanFragment(html) {
  const doc = new DOMParser().parseFromString('<body>' + String(html || '') + '</body>', 'text/html'), frag = document.createDocumentFragment();
  walk(doc.body, frag); return frag;
}
/** Sanitised HTML string (what gets stored). Empty string when the content is plain text without any formatting. */
export function cleanHtml(html) {
  const box = document.createElement('div'); box.appendChild(cleanFragment(html)); return box.innerHTML;
}
/** Plain text of some HTML: list items become "- " lines, blocks become lines. */
export function toPlain(html) {
  const out = [];
  const go = (n, pre) => n.childNodes.forEach(c => {
    if (c.nodeType === 3) out.push(c.nodeValue);
    else if (c.tagName === 'BR') out.push('\n');
    else if (c.tagName === 'LI') { out.push('\n- '); go(c, pre); }
    else if (c.tagName === 'P') { out.push('\n'); go(c, pre); out.push('\n'); }
    else go(c, pre);
  });
  const box = document.createElement('div'); box.appendChild(cleanFragment(html)); go(box, '');
  return out.join('').replace(/\n{3,}/g, '\n\n').trim();
}
/** True when the cleaned HTML has real formatting (tags), i.e. is worth storing next to the plain text. */
export const hasFormat = html => /<(b|i|u|ul|ol|li|a|p|br)[\s>]/i.test(cleanHtml(html));
/** Show stored content (rich if present) inside `target`. */
export function showRich(target, html, plain) {
  target.textContent = '';
  if (html) target.appendChild(cleanFragment(html)); else target.textContent = plain || '';
}

/** Make a textarea grow with its content while typing (no inner scrollbar). */
export function autoGrow(ta) {
  const fit = () => { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; };
  ta.addEventListener('input', fit); ta._fit = fit; requestAnimationFrame(fit); return ta;
}
/** Submit a form with Ctrl/Cmd+Enter from a textarea (plain Enter adds a new line). */
export function submitOnCtrlEnter(ta, form) {
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });
}
/** Toolbar shared by every rich field of a page; it acts on the `.rt` box that has focus. */
export function richBar() {
  const bar = document.createElement('div'); bar.className = 'rbar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Text formatting');
  const b = (label, title, fn) => {
    const x = document.createElement('button'); x.className = 'btn sm'; x.textContent = label; x.type = 'button'; x.title = title; x.setAttribute('aria-label', title);
    x.addEventListener('mousedown', e => e.preventDefault());
    x.addEventListener('click', () => { if (document.activeElement && document.activeElement.classList.contains('rt')) fn(); else { const s = document.getElementById('save'); if (s) s.textContent = 'Click inside a text box first'; } });
    bar.append(x); return x;
  };
  b('B', 'Bold', () => document.execCommand('bold')).style.fontWeight = '800';
  b('I', 'Italic', () => document.execCommand('italic')).style.fontStyle = 'italic';
  b('U', 'Underline', () => document.execCommand('underline')).style.textDecoration = 'underline';
  b('• List', 'Bulleted list', () => document.execCommand('insertUnorderedList'));
  b('1. List', 'Numbered list', () => document.execCommand('insertOrderedList'));
  b('Link', 'Add link (https)', () => { const u = window.prompt('Link address (https://…)', 'https://'); if (u && /^https:\/\//i.test(u.trim())) document.execCommand('createLink', false, u.trim()); });
  b('Clear', 'Remove formatting', () => document.execCommand('removeFormat'));
  return bar;
}
/** A rich, editable box (grows with its content). `onSave(html, plain)` runs when the user leaves it and the content changed. */
export function richBox(cls, html, plain, label, onSave) {
  const d = document.createElement('div'); d.className = 'rt ' + cls; d.contentEditable = 'true'; d.setAttribute('role', 'textbox'); d.setAttribute('aria-multiline', 'true'); d.setAttribute('aria-label', label); d.spellcheck = true;
  showRich(d, html, plain); d.dataset.init = d.innerHTML;
  d.addEventListener('paste', e => { const cd = e.clipboardData; if (!cd) return; e.preventDefault(); const h = cd.getData('text/html'); if (h) document.execCommand('insertHTML', false, cleanHtml(h)); else document.execCommand('insertText', false, cd.getData('text/plain')); });
  d.addEventListener('blur', () => { const h = cleanHtml(d.innerHTML), pl = toPlain(h); if (d.dataset.init === h) return; d.dataset.init = h; onSave(hasFormat(h) ? h : '', pl); });
  return d;
}
