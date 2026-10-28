/**
 * @module features/jira-link
 * Link one sprint task to a Jira issue: type a few letters (or a key like DYC-123) and pick the issue from a live list.
 * Read-only: asks the `jira-search` Edge Function (editors only); the link is stored as `jk` on the task and its status follows Jira.
 */
import { el } from '../core/model.js';
import { fld } from '../core/shared.js';
import { S } from '../core/state.js';
import { sb } from '../core/supabase.js';
import { openDlg, closeDlg } from './safety.js';
import { statusOf } from './jira-merge.js';
import { jiraUrl } from './report-model.js';
import { parseJira } from './sprint-cover.js';

const BASE = 'ynmo-jira-base', PRJ = 'ynmo-jira-projects';
const get = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } };

/** The Jira site address used for links: the report setting first, else the last one the search returned. */
export const jiraBase = () => ((S.ideas && S.ideas.reportcfg) || {}).jira || get(BASE);
/** Remember the Jira site address (returned by the Jira functions) so keys become links. */
export const rememberBase = b => { if (/^https:\/\//i.test(b || '')) put(BASE, b); };
/** Address of an issue in Jira, or '' when the site is not known yet. */
export const issueUrl = key => jiraUrl(jiraBase(), key);

async function why(e) {
  const c = e && e.context, st = c && c.status; let msg = '';
  try { if (c && c.json) { const j = await c.json(); msg = (j && (j.error || j.message)) || ''; } } catch (x) { /* not JSON */ }
  if (!st && e && (e.name === 'FunctionsFetchError' || /Failed to send a request/i.test(e.message || ''))) return 'Could not reach the Jira search. Most likely `jira-search` is not deployed on Supabase yet.';
  if (st === 404) return 'The Jira search is not deployed yet (jira-search). Deploy it in Supabase, then try again.';
  if (st === 401 || st === 403) return msg && !/Editors only/.test(msg) ? msg : 'Not allowed: only signed-in editors and admins can search Jira.';
  return msg || ('Jira search failed' + (e && e.message ? ': ' + String(e.message).slice(0, 120) : '') + '.');
}

/**
 * @param {{b:{id:string,t?:string,jk?:string}, saveItem:Function, redraw:Function, notify:Function}} o
 */
export function openJiraLink(o) {
  openDlg('Link to Jira', box => {
    box.append(el('p', 'sub', 'Type a few letters of the ticket title, or its key (for example DYC-123). Pick the ticket to link this task to it. Nothing is changed in Jira.'));
    const q = el('input'); q.type = 'text'; q.value = (o.b.t || '').replace(/\s*\([A-Z][A-Z0-9_]+-\d+\)\s*$/, '').slice(0, 60); q.setAttribute('aria-label', 'Search Jira'); q.autocomplete = 'off';
    const pr = el('input'); pr.type = 'text'; pr.value = get(PRJ); pr.placeholder = 'All projects, or keys like DYC, FAS'; pr.setAttribute('aria-label', 'Limit to Jira projects');
    const list = el('div', 'jklist'); list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Jira tickets');
    const msg = el('p', 'sub'); msg.setAttribute('aria-live', 'polite');
    let seq = 0, timer = 0;
    const pick = t => {
      o.saveItem(o.b.id, { jk: t.key, st: statusOf(t), dn: statusOf(t) === 'done' ? new Date().toISOString().slice(0, 10) : '' });
      closeDlg(); o.redraw(o.b.id); o.notify('Linked to ' + t.key);
    };
    const run = async () => {
      const text = q.value.trim(), mine = ++seq; list.textContent = '';
      if (text.length < 2) { msg.textContent = 'Type at least 2 letters.'; return; }
      msg.textContent = 'Searching Jira…';
      const projects = pr.value.split(/[\s,;]+/).map(x => x.toUpperCase()).filter(Boolean);
      try {
        const r = await sb.functions.invoke('jira-search', { body: { q: text, projects: projects } });
        if (mine !== seq) return;
        if (r.error) throw r.error;
        const d = r.data || {}; if (d.base) put(BASE, d.base); put(PRJ, projects.join(', '));
        const iss = d.issues || [];
        msg.textContent = iss.length ? '' : 'No ticket found. Try other words or the key.';
        iss.forEach(t => {
          const b = el('button', 'jkopt'); b.type = 'button'; b.setAttribute('role', 'option'); b.dataset.key = t.key;
          b.append(el('b', '', t.key), el('span', 'jkt', t.t), el('span', 'jks', [t.statusName, t.assignee].filter(Boolean).join(' · ')));
          b.addEventListener('click', () => pick(t)); list.append(b);
        });
      } catch (e) { if (mine === seq) msg.textContent = await why(e); }
    };
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 350); });
    pr.addEventListener('change', run);
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); run(); } });
    const row = el('div', 'row'), no = el('button', 'btn', 'Cancel'); no.type = 'button'; no.addEventListener('click', closeDlg);
    if (o.b.jk) { const un = el('button', 'btn', 'Unlink ' + o.b.jk); un.type = 'button'; un.addEventListener('click', () => { o.saveItem(o.b.id, { jk: '' }); closeDlg(); o.redraw(o.b.id); o.notify('Unlinked from ' + o.b.jk); }); row.append(un); }
    row.append(no);
    // Paste a Jira address or a key: needs no Jira search service.
    const pa = el('input'); pa.type = 'text'; pa.id = 'jkpaste'; pa.placeholder = 'https://your-site.atlassian.net/browse/ABC-123, or ABC-123'; pa.setAttribute('aria-label', 'Jira link or key'); pa.autocomplete = 'off';
    const pm = el('p', 'sub'); pm.setAttribute('aria-live', 'polite');
    const pb = el('button', 'btn primary', 'Link'); pb.type = 'button'; pb.id = 'jkpastego';
    const useIt = () => { const r = parseJira(pa.value); if (!r) { pm.textContent = 'No Jira key found. A key looks like ABC-123.'; return; } if (r.base) rememberBase(r.base); o.saveItem(o.b.id, { jk: r.key }); closeDlg(); o.redraw(o.b.id); o.notify('Linked to ' + r.key); };
    pb.addEventListener('click', useIt); pa.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); useIt(); } });
    const pr0 = el('div', 'row'); pr0.append(pa, pb);
    box.append(fld('Paste the ticket link or key', pr0), pm, el('p', 'sub', 'Or search Jira by words:'), fld('Search', q), fld('Limit to projects (optional)', pr), msg, list, row);
    setTimeout(() => { pa.focus(); if (q.value.trim().length >= 2) run(); }, 0);
  });
}
