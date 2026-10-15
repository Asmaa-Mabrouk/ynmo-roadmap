/**
 * @module features/jira-merge
 * Pure logic of "Pull from Jira" (no DOM, no network): turns Jira tickets into changes of a sprint outline.
 * Tickets are matched by key (`jk` on a block), so pulling twice never duplicates; text you edited is kept, only the status follows Jira.
 */
import { RANK } from './sprint-doc.js';

/** Which squad (product section) a Jira project belongs to. Other projects fall back to the person's own squad. */
export const PROJECT_SQUAD = { DYC: 'daycare', FAS: 'tifli', AU: 'ai' };
/** Default projects offered in the pull dialog. */
export const DEFAULT_PROJECTS = ['DYC', 'FAS', 'AU'];

const fold = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
/** Jira status -> sprint status. The status category decides; "waiting"/"blocked" statuses are Blocked. */
export function statusOf(t) {
  if (/wait|block|hold/i.test(t.statusName || '')) return 'blocked';
  return t.cat === 'done' ? 'done' : t.cat === 'indeterminate' ? 'progress' : 'planned';
}
/** Match a Jira assignee to a team member by exact name, then by name parts (unique match only). Returns the team name or ''. */
export function matchPerson(assignee, email, names) {
  const a = fold(assignee); if (!a) return '';
  const byFold = names.map(n => ({ n: n, f: fold(n) }));
  const exact = byFold.filter(x => x.f === a); if (exact.length === 1) return exact[0].n;
  const at = a.split(' ');
  const part = byFold.filter(x => { const bt = x.f.split(' '), [s, l] = at.length <= bt.length ? [at, bt] : [bt, at]; return s.length >= 1 && s.every(w => l.includes(w)); });
  if (part.length === 1) return part[0].n;
  const local = fold(String(email || '').split('@')[0].replace(/[._-]+/g, ' ')); if (local) { const m = byFold.filter(x => x.f === local); if (m.length === 1) return m[0].n; }
  return '';
}
const groupEnd = (blocks, i) => { const r = RANK[blocks[i].k]; let j = i + 1; if (blocks[i].k === 'n' || blocks[i].k === 'u') return j; while (j < blocks.length && RANK[blocks[j].k] > r) j++; return j; };

/**
 * @param {Array} blocks the sprint's blocks in order ({id,k,t,sq?,jk?,st?})
 * @param {Array} tickets from the jira-sync function
 * @param {{names:string[], squadOf:(project:string, person:string)=>string, squadName:(sq:string)=>string}} o
 * @returns {{updates:Array<{id,patch}>, inserts:Array<{after:string, specs:Array}>, added:number, updated:number, unassigned:number, unmatched:string[]}}
 */
export function mergeJira(blocks, tickets, o) {
  const out = { updates: [], inserts: [], added: 0, updated: 0, unassigned: 0, unmatched: [] };
  const known = new Map(blocks.filter(b => b.jk).map(b => [b.jk, b]));
  const fresh = [];
  tickets.forEach(t => {
    const ex = known.get(t.key), st = statusOf(t);
    if (ex) { const patch = {}; if ((ex.st || 'planned') !== st) patch.st = st; const dn = st === 'done' ? (t.done || ex.dn || '') : ''; if ((ex.dn || '') !== dn) patch.dn = dn; if (Object.keys(patch).length) { out.updates.push({ id: ex.id, patch: patch }); out.updated++; } return; }
    if (!t.assignee) { out.unassigned++; return; }
    const person = matchPerson(t.assignee, t.email, o.names) || t.assignee;
    if (person === t.assignee && !o.names.includes(person) && !out.unmatched.includes(person)) out.unmatched.push(person);
    fresh.push({ t: t, person: person, sq: o.squadOf(t.project, person) });
  });
  // Work on a copy of the outline so later inserts see earlier ones.
  const work = blocks.map(b => Object.assign({}, b));
  const spec = (t, kind) => ({ k: kind, t: t.t + ' (' + t.key + ')', jk: t.key, st: statusOf(t), dn: statusOf(t) === 'done' ? (t.done || '') : '', tags: /bug/i.test(t.type) ? ['fix'] : [] });
  const place = (afterId, specs) => { out.inserts.push({ after: afterId, specs: specs }); const i = afterId ? work.findIndex(b => b.id === afterId) : work.length - 1; work.splice(i + 1, 0, ...specs.map((s, n) => Object.assign({ id: '__new' + out.inserts.length + '_' + n }, s))); };
  const keyOrder = []; fresh.forEach(f => { const k = f.sq + '|' + f.person; if (!keyOrder.includes(k)) keyOrder.push(k); });
  keyOrder.forEach(k => {
    const [sq, person] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)], mine = fresh.filter(f => f.sq === sq && f.person === person).map(f => f.t);
    const keys = new Set(mine.map(t => t.key));
    const parents = mine.filter(t => !(t.sub && t.parent && keys.has(t.parent)));
    const subsOf = p => mine.filter(t => t.sub && t.parent === p.key);
    const lines = []; parents.forEach(p => { lines.push(spec(p, 's')); subsOf(p).forEach(c => lines.push(spec(c, 'u'))); });
    let h = work.findIndex(b => b.k === 'h' && b.sq === sq);
    if (h < 0) { place(work.length ? work[work.length - 1].id : '', [{ k: 'h', sq: sq, t: o.squadName(sq) }, { k: 'p', t: person }].concat(lines)); return; }
    const he = groupEnd(work, h); let p = -1;
    for (let i = h + 1; i < he; i++) if (work[i].k === 'p' && fold(work[i].t) === fold(person)) { p = i; break; }
    if (p < 0) { place(work[he - 1].id, [{ k: 'p', t: person }].concat(lines)); return; }
    place(work[groupEnd(work, p) - 1].id, lines);
  });
  out.added = fresh.length;
  return out;
}
