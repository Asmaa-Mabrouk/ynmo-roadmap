/**
 * @module features/jira-link
 * Link a sprint task to one or more Jira issues: paste links or keys (several at once), or type a few letters and pick from a live list.
 * Read-only: asks the `jira-search` Edge Function (editors only). The first ticket is the main one (`jk`: the task status follows it); the others are `jx`.
 */
import { el } from '../core/model.js';
import { fld } from '../core/shared.js';
import { S } from '../core/state.js';
import { sb } from '../core/supabase.js';
import { openDlg, closeDlg } from './safety.js';
import { statusOf } from './jira-merge.js';
import { jiraUrl } from './report-model.js';
import { parseJiraAll, keysOf, keyPatch } from './sprint-cover.js';

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
 * @param {{b:{id:string,t?:string,jk?:string,jx?:string[]}, saveItem:Function, redraw:Function, notify:Function}} o
 */
export function openJiraLink(o) {
  openDlg('Jira tickets', box => {
    let keys = keysOf(o.b); const titles = {};
    const linked = el('div', 'jklinked'); linked.setAttribute('aria-label', 'Linked tickets');
    const save = (extra, note) => { o.saveItem(o.b.id, Object.assign(keyPatch(keys), extra || {})); o.b = Object.assign({}, o.b, keyPatch(keys)); o.redraw(o.b.id); drawLinked(); if (note) o.notify(note); };
    function drawLinked() {
      linked.textContent = '';
      if (!keys.length) { linked.append(el('p', 'sub', 'No ticket linked yet.')); return; }
      keys.forEach((k, n) => {
        const u = issueUrl(k), c = el('span', 'jkl' + (n === 0 ? ' main' : '')), a = el(u ? 'a' : 'span', 'jklk', k); if (u) { a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        c.append(a); if (titles[k]) c.append(el('span', 'jklt', titles[k])); if (n === 0 && keys.length > 1) c.append(el('span', 'jklm', 'main'));
        if (n > 0) { const mk = el('button', 'jklb', 'Make main'); mk.type = 'button'; mk.title = 'The task status follows the main ticket'; mk.addEventListener('click', () => { keys = [k].concat(keys.filter(x => x !== k)); save({}, k + ' is now the main ticket'); }); c.append(mk); }
        const x = el('button', 'jklx', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove ' + k); x.title = 'Remove ' + k; x.addEventListener('click', () => { keys = keys.filter(v => v !== k); save({}, 'Removed ' + k); }); c.append(x);
        linked.append(c);
      });
    }
    const add = (list, t) => {
      const fresh = list.filter(k => !keys.includes(k)); if (!fresh.length) return 0;
      const wasEmpty = !keys.length; keys = keys.concat(fresh);
      save(wasEmpty && t ? { st: statusOf(t), dn: statusOf(t) === 'done' ? new Date().toISOString().slice(0, 10) : '' } : {}, 'Linked ' + fresh.join(', '));
      return fresh.length;
    };
    box.append(el('p', 'sub', 'Link one or many Jira tickets to this line. The first is the main one: the status of the line follows it. Nothing is changed in Jira.'), linked);
    drawLinked();
    const pa = el('input'); pa.type = 'text'; pa.id = 'jkpaste'; pa.placeholder = 'Paste links or keys: ABC-123, https://…/browse/ABC-124'; pa.setAttribute('aria-label', 'Jira links or keys'); pa.autocomplete = 'off';
    const pm = el('p', 'sub'); pm.setAttribute('aria-live', 'polite');
    const pb = el('button', 'btn primary', 'Add'); pb.type = 'button'; pb.id = 'jkpastego';
    const useIt = () => { const r = parseJiraAll(pa.value); if (!r.length) { pm.textContent = 'No Jira key found. A key looks like ABC-123.'; return; } if (r[0].base) rememberBase(r[0].base); const n = add(r.map(x => x.key)); pm.textContent = n ? '' : 'Already linked.'; pa.value = ''; pa.focus(); };
    pb.addEventListener('click', useIt); pa.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); useIt(); } });
    const pr0 = el('div', 'row'); pr0.append(pa, pb);
    const q = el('input'); q.type = 'text'; q.value = (o.b.t || '').replace(/\s*\([A-Z][A-Z0-9_]+-\d+\)\s*$/, '').replace(/\s*\([A-Za-z]{1,4}#\d+\)\s*$/, '').slice(0, 60); q.setAttribute('aria-label', 'Search Jira'); q.autocomplete = 'off';
    const pr = el('input'); pr.type = 'text'; pr.value = get(PRJ); pr.placeholder = 'All projects, or keys like DYC, FAS'; pr.setAttribute('aria-label', 'Limit to Jira projects');
    const list = el('div', 'jklist'); list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Jira tickets');
    const msg = el('p', 'sub'); msg.setAttribute('aria-live', 'polite');
    let seq = 0, timer = 0;
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
        msg.textContent = iss.length ? 'Click a ticket to add it. You can add several.' : 'No ticket found. Try other words or the key.';
        iss.forEach(t => {
          const b = el('button', 'jkopt' + (keys.includes(t.key) ? ' on' : '')); b.type = 'button'; b.setAttribute('role', 'option'); b.dataset.key = t.key;
          b.append(el('b', '', t.key), el('span', 'jkt', t.t), el('span', 'jks', keys.includes(t.key) ? 'Linked' : [t.statusName, t.assignee].filter(Boolean).join(' · ')));
          b.addEventListener('click', () => { titles[t.key] = t.t; if (add([t.key], t)) { b.classList.add('on'); b.lastChild.textContent = 'Linked'; } });
          list.append(b);
        });
      } catch (e) { if (mine === seq) msg.textContent = await why(e); }
    };
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 350); });
    pr.addEventListener('change', run);
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); run(); } });
    const row = el('div', 'row'), done = el('button', 'btn primary', 'Done'); done.type = 'button'; done.addEventListener('click', closeDlg); row.append(done);
    box.append(fld('Paste ticket links or keys', pr0), pm, el('p', 'sub', 'Or search Jira by words:'), fld('Search', q), fld('Limit to projects (optional)', pr), msg, list, row);
    setTimeout(() => { pa.focus(); if (q.value.trim().length >= 2) run(); }, 0);
  });
}
