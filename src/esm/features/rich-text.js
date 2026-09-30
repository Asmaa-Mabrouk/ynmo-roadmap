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
