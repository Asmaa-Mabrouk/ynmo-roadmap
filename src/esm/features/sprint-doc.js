/**
 * @module features/sprint-doc
 * Pure logic of the sprint document (no DOM, no network).
 * A sprint is an outline of blocks. The kind of a block is its level:
 *   h = product section (rank 0), p = person / resource (1), s = scope (2), u = sub-section (3), n = free note (never in the report).
 * `derive` turns the outline into the flat items the weekly report is built from ({squad, person, par, t, st, kind, tg}).
 */

export const RANK = { h: 0, p: 1, s: 2, u: 3, n: 4 };
export const KIND_NAME = { h: 'Product section', p: 'Person', s: 'Scope', u: 'Sub-section', n: 'Note' };
/** Colours of the tags (CSS classes `tg-<key>`). */
export const TAG_COLORS = ['blue', 'green', 'amber', 'red', 'purple', 'teal', 'gray'];
export const tagKey = n => String(n || '').trim().replace(/^#+/, '').toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '').slice(0, 24);
/** `fix` and `support` tags decide the type of a scope in the report. */
export const kindFromTags = tags => { const t = (tags || []).map(x => String(x).toLowerCase()); return t.includes('fix') ? 'fix' : t.includes('support') ? 'support' : 'feature'; };
/** Next kind when pressing Tab (deeper) or Shift+Tab (shallower). Notes never move. */
export const deeper = k => ({ h: 'p', p: 's', s: 'u' }[k] || k);
export const shallower = k => ({ u: 's', s: 'p', p: 'h' }[k] || k);
/** The kind a new line takes after `k` when Enter is pressed. */
export const nextKind = k => ({ h: 'p', p: 's', s: 's', u: 'u', n: 'n' }[k] || 's');

/** Flat items for the report and the sprint list, from the ordered blocks. `tagColors` = {name: colourKey}. */
export function derive(blocks, tagColors) {
  const out = []; let squad = '', person = '', scope = null;
  (blocks || []).forEach(b => {
    const t = String(b.t || '').trim();
    if (b.k === 'h') { squad = b.sq || ''; person = ''; scope = null; return; }
    if (b.k === 'p') { person = t; scope = null; return; }
    if (b.k !== 's' && b.k !== 'u') return;
    if (!t) return;
    const tg = (b.tags || []).map(n => ({ n: n, c: (tagColors || {})[n] || 'gray' }));
    const base = { id: b.id, sp: b.sp, squad: squad, person: person, t: t, h: '', kind: kindFromTags(b.tags), st: b.st || 'planned', dn: b.dn || '', ord: b.ord || 0, tg: tg };
    if (b.k === 's' || !scope) { scope = b; out.push(Object.assign(base, { par: '' })); } else out.push(Object.assign(base, { par: scope.id, kind: kindFromTags(scope.tags) }));
  });
  return out;
}

const BULLET = /^(?:[-*•▪◦·]|\d+[.)])\s*/;
/** `#tag` words at the end of a line become tags. */
export function splitTags(text) {
  let t = String(text || '').trim(); const tags = [];
  for (;;) { const m = /(?:^|\s)#([\p{L}\p{N}_-]{1,24})\s*$/u.exec(t); if (!m) break; tags.unshift(tagKey(m[1])); t = t.slice(0, m.index).trim(); }
  return { t: t, tags: tags.filter((x, i, a) => x && a.indexOf(x) === i) };
}
/**
 * Pasted text -> blocks. A product name starts a section when `# ` marks it or a `@person` line follows, `@Name` is a person,
 * other lines are scopes; a line indented deeper than the previous scope is a sub-section.
 * @param {Array<{k:string,n:string}>} lanes product sections that can be recognised
 */
export function parseOutline(text, lanes) {
  const out = [], lines = String(text || '').split(/\r?\n/).filter(l => l.trim()); let scopeIndent = -1;
  const clean = l => l.trim().replace(BULLET, '').trim();
  lines.forEach((raw, i) => {
    const indent = (/^[ \t]*/.exec(raw)[0].replace(/\t/g, '  ')).length;
    let s = clean(raw); if (!s) return;
    const marked = /^#{1,3}\s+\S/.test(s); if (marked) s = s.replace(/^#{1,3}\s+/, '');
    const nextIsPerson = lines[i + 1] !== undefined && clean(lines[i + 1])[0] === '@';
    const x0 = s.replace(/[:：]\s*$/, '').toLowerCase();
    const lane = (marked || nextIsPerson) && (lanes || []).find(l => x0 === String(l.n).toLowerCase() || x0 === String(l.k).toLowerCase());
    if (lane) { out.push({ k: 'h', sq: lane.k, t: lane.n, tags: [] }); scopeIndent = -1; return; }
    if (s[0] === '@') { const name = s.slice(1).trim().slice(0, 60); if (name) { out.push({ k: 'p', t: name, tags: [] }); scopeIndent = -1; } return; }
    const x = splitTags(s); if (!x.t) return;
    const isSub = scopeIndent >= 0 && indent > scopeIndent;
    if (!isSub) scopeIndent = indent;
    out.push({ k: isSub ? 'u' : 's', t: x.t.slice(0, 300), tags: x.tags });
  });
  return out;
}

/**
 * One-time conversion of the first version's items ({squad, person, par}) into blocks, in a sensible order.
 * @returns {Array<{id:string|null, doc:object}>} `id` = reuse the existing row, null = a new row
 */
export function migrate(sp, legacy, laneName) {
  const ids = new Set(legacy.map(i => i.id)), kids = {}, tops = [];
  legacy.forEach(i => { if (i.par && ids.has(i.par)) (kids[i.par] = kids[i.par] || []).push(i); else tops.push(i); });
  const squads = Object.keys(sp.secs || {}).concat(tops.map(i => i.squad)).filter((k, i, a) => k && a.indexOf(k) === i), out = [];
  const tagsOf = i => (i.kind === 'fix' ? ['fix'] : i.kind === 'support' ? ['support'] : []);
  const mk = (i, k) => ({ id: i.id, doc: { sp: sp.id || i.sp, k: k, t: i.t, st: i.st || 'planned', dn: i.dn || '', tags: tagsOf(i) } });
  squads.forEach(sq => {
    out.push({ id: null, doc: { sp: sp.id, k: 'h', sq: sq, t: laneName(sq), tags: [] } });
    const mine = tops.filter(i => i.squad === sq), reg = (((sp.secs || {})[sq]) || {}).people || [];
    const people = reg.concat(mine.map(i => i.person || '').filter(p => p && !reg.includes(p))).filter((p, i, a) => a.indexOf(p) === i);
    const emit = list => list.forEach(sc => { out.push(mk(sc, 's')); (kids[sc.id] || []).forEach(c => out.push(mk(c, 'u'))); });
    emit(mine.filter(i => !i.person));
    people.forEach(n => { out.push({ id: null, doc: { sp: sp.id, k: 'p', t: n, tags: [] } }); emit(mine.filter(i => (i.person || '') === n)); });
  });
  out.forEach((o, i) => { o.doc.ord = (i + 1) * 1024; });
  return out;
}

/** Order values for `n` new blocks placed between `a` and `b` (either may be undefined = the ends). */
export function ordBetween(a, b, n) {
  const lo = Number.isFinite(a) ? a : (Number.isFinite(b) ? b - 1024 * (n + 1) : 0), hi = Number.isFinite(b) ? b : lo + 1024 * (n + 1);
  return Array.from({ length: n }, (_, i) => lo + (hi - lo) * (i + 1) / (n + 1));
}
