/**
 * @module features/sprint-export
 * Export of a sprint plan to Google Docs and the link to a Google Doc.
 * No Google sign-in is needed: the plan is copied as formatted text (headings, lists, links) and the doc is opened, so one paste
 * (Ctrl/Cmd+V) puts it into the doc with its formatting.
 */
import { SSTATUS } from './report-model.js';
import { RANK } from './sprint-doc.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** Normalise a pasted Google Docs address to `https://docs.google.com/document/d/<id>/edit`, or '' when it is not a Google Doc. */
export function docUrl(v) {
  const m = /^https:\/\/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{15,})/.exec(String(v || '').trim());
  return m ? 'https://docs.google.com/document/d/' + m[1] + '/edit' : '';
}
const ST = k => SSTATUS[k] || SSTATUS.planned;
/**
 * @param {{n:number,a:string,b:string}} sp @param {Array} blocks the sprint's blocks in order
 * @param {{laneName:(k:string)=>string, jiraUrl:(key:string)=>string, fmt:(iso:string)=>string, tagName?:(t:string)=>string}} o
 * @returns {{html:string, text:string}} `html` pastes into Google Docs with headings and lists; `text` is the plain fallback
 */
export function sprintDoc(sp, blocks, o) {
  const h = [], t = [];
  h.push('<h1>Sprint ' + esc(sp.n) + '</h1>', '<p>' + esc(o.fmt(sp.a) + ' to ' + o.fmt(sp.b)) + '</p>'); t.push('Sprint ' + sp.n, o.fmt(sp.a) + ' to ' + o.fmt(sp.b), '');
  const list = blocks.filter(b => b.k && b.k !== 'n'); let open = 0;   // notes are never exported
  const closeLists = to => { while (open > to) { h.push('</ul>'); open--; } };
  list.forEach((b, i) => {
    const txt = String(b.t || '').trim();
    if (b.k === 'h') { closeLists(0); const nm = o.laneName(b.sq) || txt; h.push('<h2>' + esc(nm) + '</h2>'); t.push('', nm.toUpperCase()); return; }
    if (b.k === 'p') { closeLists(0); if (txt) { h.push('<h3>' + esc(txt) + '</h3>'); t.push('', txt); } return; }
    if (!txt) return;
    const lvl = b.k === 'u' ? 2 : 1; if (open < lvl) { while (open < lvl) { h.push('<ul>'); open++; } } else closeLists(lvl);
    const jk = b.jk ? o.jiraUrl(b.jk) : '', tags = (b.tags || []).map(x => '#' + x).join(' ');
    const status = ' <b>[' + esc(ST(b.st)) + ']</b>', link = jk ? ' <a href="' + esc(jk) + '">' + esc(b.jk) + '</a>' : '';
    // the ticket key is already part of the text when it was pulled from Jira: show it once, as a link
    const shown = b.jk ? txt.replace(new RegExp('\\s*\\(' + b.jk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\)\\s*$'), '') : txt;
    h.push('<li>' + esc(shown) + status + (b.jk ? (jk ? link : ' ' + esc(b.jk)) : '') + (tags ? ' <i>' + esc(tags) + '</i>' : '') + '</li>');
    t.push((lvl === 2 ? '    - ' : '  - ') + shown + ' [' + ST(b.st) + ']' + (b.jk ? ' ' + b.jk : '') + (tags ? ' ' + tags : ''));
  });
  closeLists(0);
  return { html: '<meta charset="utf-8">' + h.join(''), text: t.join('\n') };
}
/** Copy `html` (with a plain-text twin) to the clipboard. Resolves true on success. */
export async function copyRich(html, text) {
  try {
    if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new window.ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]); return true; }
  } catch (e) { /* fall through to the older way */ }
  try {
    const box = document.createElement('div'); box.contentEditable = 'true'; box.style.cssText = 'position:fixed;left:-9999px;top:0;white-space:pre-wrap'; box.innerHTML = html.replace(/^<meta[^>]*>/, '');
    document.body.append(box); const r = document.createRange(); r.selectNodeContents(box); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    const ok = document.execCommand('copy'); s.removeAllRanges(); box.remove(); return !!ok;
  } catch (e) { return false; }
}
