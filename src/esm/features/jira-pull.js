/**
 * @module features/jira-pull
 * "Pull from Jira" on the sprint page: asks the `jira-sync` Edge Function (read-only) for the tickets of the chosen Jira sprints,
 * then adds them as scopes under each person and refreshes the status of tickets already in the plan (see jira-merge.js).
 */
import { el, directory } from '../core/model.js';
import { sb } from '../core/supabase.js';
import { fld, logAct } from '../core/shared.js';
import { openDlg, closeDlg } from './safety.js';
import { notify } from '../ui/notify.js';
import { primarySq } from '../ui/editing.js';
import { rememberBase } from './jira-link.js';
import { DEFAULT_PROJECTS, PROJECT_SQUAD, mergeJira } from './jira-merge.js';

const KEY = 'ynmo-jira-projects';
const saved = () => { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
const remember = v => { try { localStorage.setItem(KEY, v); } catch (e) { /* storage unavailable */ } };

/** Plain-language reason for a failed call to the Edge Function. */
async function why(e) {
  const c = e && e.context, st = c && c.status; let msg = '';
  try { if (c && c.json) { const j = await c.json(); msg = (j && (j.error || j.message)) || ''; } } catch (x) { /* body not JSON */ }
  if (!st && e && (e.name === 'FunctionsFetchError' || /Failed to send a request/i.test(e.message || ''))) return 'Could not reach the Jira function. Most likely `jira-sync` is not deployed on Supabase yet.';
  if (st === 404) return 'The Jira function is not deployed yet (jira-sync). Deploy it in Supabase, then try again.';
  if (st === 401 || st === 403) return msg && !/Editors only/.test(msg) ? msg : 'Not allowed: only signed-in editors and admins can pull from Jira.';
  return msg || ('Jira sync failed' + (e && e.message ? ': ' + String(e.message).slice(0, 120) : '') + '.');
}

/**
 * @param {{spId:string, blocks:()=>Array, ed:{insert:Function,redraw:Function}, saveItem:Function, laneName:(k:string)=>string, label:string}} o
 */
export function openJiraPull(o) {
  openDlg('Pull from Jira', box => {
    box.append(el('p', 'sub', 'Adds the tickets of each person to this sprint plan. Nothing is changed in Jira. Pulling again never duplicates a ticket: it only adds new ones and updates statuses.'));
    const pr = el('input'); pr.type = 'text'; pr.value = saved() || DEFAULT_PROJECTS.join(', '); pr.setAttribute('aria-label', 'Jira project keys');
    const mode = el('select'); mode.setAttribute('aria-label', 'Which Jira sprints');
    [['active', 'Active sprints (running now)'], ['future', 'Upcoming sprints (planned, not started)'], ['both', 'Active and upcoming'], ['name', 'A sprint by name…']].forEach(([v, t]) => { const op = el('option', '', t); op.value = v; mode.append(op); });
    const nm = el('input'); nm.type = 'text'; nm.placeholder = 'Exactly as in Jira, for example Sprint 228'; nm.setAttribute('aria-label', 'Jira sprint name'); const nmf = fld('Sprint name', nm); nmf.hidden = true;
    mode.addEventListener('change', () => { nmf.hidden = mode.value !== 'name'; });
    const go = el('button', 'btn primary', 'Pull tickets'), no = el('button', 'btn', 'Cancel'); go.type = no.type = 'button';
    const msg = el('p', 'sub'); msg.setAttribute('aria-live', 'polite');
    no.addEventListener('click', closeDlg);
    go.addEventListener('click', async () => {
      const projects = pr.value.split(/[\s,;]+/).map(x => x.toUpperCase()).filter(Boolean);
      if (!projects.length) { msg.textContent = 'Type at least one project key, like DYC.'; return; }
      if (mode.value === 'name' && !nm.value.trim()) { msg.textContent = 'Type the sprint name.'; return; }
      go.disabled = true; msg.textContent = 'Asking Jira…'; remember(projects.join(', '));
      try {
        const r = await sb.functions.invoke('jira-sync', { body: { projects: projects, sprints: mode.value, sprintName: nm.value.trim() } });
        if (r.error) throw r.error;
        const issues = (r.data && r.data.issues) || []; rememberBase(r.data && r.data.base);
        if (!issues.length) { msg.textContent = 'Jira returned no tickets for ' + projects.join(', ') + ' in those sprints.'; go.disabled = false; return; }
        const names = [...directory().keys()];
        const res = mergeJira(o.blocks(), issues, { names: names, squadOf: (p, who) => PROJECT_SQUAD[p] || primarySq(who), squadName: o.laneName });
        res.updates.forEach(u => o.saveItem(u.id, u.patch));
        const map = {};
        res.inserts.forEach((ins, i) => { const ids = o.ed.insert(map[ins.after] || ins.after, ins.specs); ids.forEach((id, n) => { map['__new' + (i + 1) + '_' + n] = id; const s = ins.specs[n]; const extra = {}; if (s.jk) extra.jk = s.jk; if (s.st && s.st !== 'planned') extra.st = s.st; if (s.dn) extra.dn = s.dn; if (Object.keys(extra).length) o.saveItem(id, extra); }); });
        closeDlg(); o.ed.redraw();
        logAct('sprint', 'pulled ' + issues.length + ' Jira ticket' + (issues.length === 1 ? '' : 's') + ' into ' + o.label + ' (' + res.added + ' new, ' + res.updated + ' updated)');
        notify('Jira: ' + res.added + ' new, ' + res.updated + ' updated' + (res.unassigned ? ' · ' + res.unassigned + ' without an assignee skipped' : '') + (res.unmatched.length ? ' · not in the team list: ' + res.unmatched.slice(0, 4).join(', ') + (res.unmatched.length > 4 ? '…' : '') : ''), 'ok');
      } catch (e) { msg.textContent = await why(e); go.disabled = false; }
    });
    const row = el('div', 'row'); row.append(go, no);
    box.append(fld('Jira projects (keys, comma separated)', pr), fld('Which sprints', mode), nmf, msg, row);
    setTimeout(() => pr.focus(), 0);
  });
}
