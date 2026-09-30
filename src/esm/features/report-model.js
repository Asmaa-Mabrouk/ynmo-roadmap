/**
 * @module features/report-model
 * Pure logic of the weekly executive report (no DOM, no network): products, statuses, building the rule-based draft from the
 * sprint plan + the roadmap, merging a re-sync without losing manual edits, applying the AI wording, and the plain-text export.
 * Rule: a line or summary a person has edited ALWAYS wins over a re-sync or the AI.
 */

/** Report sections (one per product). `squads` are the roadmap/sprint squad keys that belong to the product. Editable in Settings. */
export const DEFAULT_PRODUCTS = [
  { k: 'plan_daycare', n: 'Plan / Daycare', squads: ['plan', 'daycare'] },
  { k: 'tifli', n: 'Tifli', squads: ['tifli'] },
  { k: 'ai', n: 'AI (Sara)', squads: ['ai'] }
];
export const RSTATUS = { on: 'On Track', risk: 'At Risk', late: 'Delayed', done: 'Done' };
export const GROUPS = [['done', 'Delivered this week'], ['prog', 'In progress'], ['next', 'Next'], ['risk', 'Risks & decisions'], ['road', 'Roadmap milestones']];
export const SKIND = { feature: 'Feature', fix: 'Fix', support: 'Support' };
export const SSTATUS = { planned: 'Planned', progress: 'In progress', done: 'Done', blocked: 'Blocked' };

const ST_OF = { done: ['done', 'done'], progress: ['prog', 'on'], planned: ['next', 'on'], blocked: ['risk', 'risk'] };
/** Status of a scope from its sub-sections (all done > done; any blocked > blocked; any started > in progress; else its own). */
export function scopeStatus(kids, own) {
  if (!kids.length) return own || 'planned';
  if (kids.every(k => k.st === 'done')) return 'done';
  if (kids.some(k => k.st === 'blocked')) return 'blocked';
  if (kids.some(k => k.st === 'progress' || k.st === 'done')) return 'progress';
  return 'planned';
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Products from the saved config (meta doc `reportcfg`) or the defaults. */
export function productsOf(cfg) {
  const p = cfg && Array.isArray(cfg.products) && cfg.products.length ? cfg.products : DEFAULT_PRODUCTS;
  return p.map(x => ({ k: String(x.k), n: String(x.n || x.k), squads: (x.squads || []).map(String) }));
}
/** Only http(s) Jira links are ever rendered. */
export function jiraUrl(base, key) {
  if (!key || !/^https:\/\//i.test(base || '')) return '';
  return base.replace(/\/+$/, '') + '/browse/' + encodeURIComponent(key);
}

/**
 * Source lines for one product: sprint items of its squads + roadmap bars of its squads that overlap the sprint week.
 * @param {string} a week start (ISO) @param {string} b week end (ISO)
 * @param {Array} sitems sprint items ({id,squad,t,jira,kind,st})
 * @param {Array} road roadmap items ({id,t,sq,d0,d1,st}) plus `ka`,`kb` = week as day indexes
 */
export function sourceLines(prod, sitems, road, ka, kb, a, b) {
  const out = [];
  const mine = sitems.filter(s => prod.squads.includes(s.squad)), ids = new Set(mine.map(s => s.id)), kids = {}, tops = [];
  mine.forEach(s => { if (s.par && ids.has(s.par)) (kids[s.par] = kids[s.par] || []).push(s); else tops.push(s); });
  tops.forEach(s => {
    const sub = kids[s.id] || [], stt = scopeStatus(sub, s.st), dns = (sub.length ? sub : [s]).map(x => x.dn || '').sort(), dn = dns[dns.length - 1];
    let m = ST_OF[stt] || ST_OF.planned;
    if (stt === 'done' && dn && a && b) { if (dn < a) return; if (dn > b) m = ST_OF.progress; }   /* sprints last 2 weeks, reports are weekly: done in an earlier week is not news, done later is still in progress */
    const t = sub.length ? s.t + ': ' + sub.map(x => x.t).join('; ') : s.t;
    const h = sub.length ? '<b>' + esc(s.t) + '</b><ul>' + sub.map(x => '<li>' + esc(x.t) + '</li>').join('') + '</ul>' : (s.h || '');
    out.push({ src: 'si:' + s.id, g: m[0], st: m[1], t: t, h: h, jira: s.jira || '', kind: s.kind || 'feature', tg: s.tg || [], ord: s.ord || 0 });
  });
  if (Number.isFinite(ka) && Number.isFinite(kb)) {
    road.filter(r => prod.squads.includes(r.sq) && r.d0 <= kb && r.d1 >= ka).forEach(r => {
      out.push({ src: 'rf:' + r.id, g: 'road', st: r.st === 'done' ? 'done' : (r.st === 'decide' || r.st === 'contract') ? 'risk' : 'on', t: r.t, jira: '', kind: r.ms ? 'milestone' : 'roadmap', ord: 1e6 + r.d0 });
    });
  }
  return out;
}

/**
 * Re-sync: fresh source lines merged into the previous lines of a product.
 * Edited or manual lines are kept untouched; unedited lines follow the source; unedited lines whose source vanished are dropped.
 */
export function mergeLines(prev, fresh) {
  const by = new Map((prev || []).map(p => [p.src, p])), seen = new Set(), out = [];
  fresh.forEach(f => {
    seen.add(f.src); const p = by.get(f.src);
    if (!p) out.push({ id: uid(), src: f.src, g: f.g, st: f.st, t: f.t, h: f.h || '', t0: f.t, jira: f.jira, kind: f.kind, tg: f.tg || [], hide: false, edited: false });
    else if (p.edited) out.push(p);
    else out.push(Object.assign({}, p, { g: f.g, st: f.st, t: f.t, t0: f.t, jira: f.jira, kind: f.kind, tg: f.tg || [], h: f.h || '' }));
  });
  (prev || []).forEach(p => { if (!seen.has(p.src) && (p.src === 'man' || p.edited)) out.push(p); });
  return out;
}
export function newManualLine(g, t) { return { id: uid(), src: 'man', g: g, st: 'on', t: t, t0: t, jira: '', kind: 'manual', hide: false, edited: true }; }

const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
/** Plain summary used when the AI is unavailable (or before it runs). */
export function ruleSummary(name, lines) {
  const v = lines.filter(l => !l.hide), c = g => v.filter(l => l.g === g).length;
  const parts = [];
  if (c('done')) parts.push(plural(c('done'), 'item') + ' delivered');
  if (c('prog')) parts.push(plural(c('prog'), 'item') + ' in progress');
  if (c('next')) parts.push(plural(c('next'), 'item') + ' planned next');
  const bits = parts.length ? parts.join(', ') : 'no sprint activity recorded';
  const risks = v.filter(l => l.st === 'risk' || l.st === 'late').length;
  return name + ': ' + bits + (risks ? '. ' + plural(risks, 'item') + ' at risk or waiting on a decision.' : '.');
}
/** Overall status of a product = the worst status among its visible lines. */
export function overall(lines) {
  const v = lines.filter(l => !l.hide);
  if (v.some(l => l.st === 'late')) return 'late';
  if (v.some(l => l.st === 'risk')) return 'risk';
  return v.length && v.every(l => l.st === 'done') ? 'done' : 'on';
}

/** Rule-based draft for every product, merged into an existing report's `prods` (or {}). Keeps edited summaries. */
export function buildProds(products, prevProds, sitems, road, ka, kb, a, b) {
  const out = {};
  products.forEach(p => {
    const old = (prevProds && prevProds[p.k]) || {}, lines = mergeLines(old.items, sourceLines(p, sitems, road, ka, kb, a, b));
    lines.sort((a, b) => GROUPS.findIndex(g => g[0] === a.g) - GROUPS.findIndex(g => g[0] === b.g));
    out[p.k] = { items: lines, sum: old.sumEdited ? old.sum : ruleSummary(p.n, lines), sumH: old.sumEdited ? (old.sumH || '') : '', sumEdited: !!old.sumEdited };
  });
  return out;
}

/** Payload for the AI function: titles and keys only, never people's names or notes. */
export function aiPayload(week, products, prods) {
  return { week: week, products: products.map(p => ({ key: p.k, name: p.n, items: ((prods[p.k] || {}).items || []).filter(l => !l.hide).map(l => ({ id: l.id, t: l.t, jira: l.jira || '', kind: l.kind || '', st: l.st, tags: [], group: l.g })) })) };
}
/** Apply the AI wording: only to lines and summaries nobody edited. Returns how many lines/summaries changed. */
export function applyAi(prods, ai) {
  let n = 0;
  Object.keys((ai && ai.products) || {}).forEach(k => {
    const p = prods[k], r = ai.products[k]; if (!p || !r) return;
    if (r.summary && !p.sumEdited && r.summary !== p.sum) { p.sum = String(r.summary); p.sumH = ''; n++; }
    const by = new Map((r.items || []).map(i => [i.id, i.text]));
    p.items.forEach(l => { const t = by.get(l.id); if (t && !l.edited && t !== l.t) { l.t = String(t); l.h = ''; n++; } });
  });
  return n;
}

/** Copy-paste text of a report. */
export function reportToText(rep, products, fmt) {
  const out = ['Weekly update - ' + (fmt ? fmt(rep.a) : rep.a) + (rep.b ? ' to ' + (fmt ? fmt(rep.b) : rep.b) : '') + (rep.n ? ' (Sprint ' + rep.n + ')' : ''), ''];
  products.forEach(p => {
    const d = (rep.prods || {})[p.k]; if (!d) return;
    out.push(p.n.toUpperCase() + ' - ' + RSTATUS[overall(d.items)], d.sum || '');
    GROUPS.forEach(g => {
      const ls = d.items.filter(l => !l.hide && l.g === g[0]); if (!ls.length) return;
      out.push('', g[1] + ':'); ls.forEach(l => out.push('- ' + l.t + (l.jira ? ' [' + l.jira + ']' : '') + (l.st === 'risk' || l.st === 'late' ? ' (' + RSTATUS[l.st] + ')' : '')));
    });
    out.push('');
  });
  return out.join('\n').trim() + '\n';
}
