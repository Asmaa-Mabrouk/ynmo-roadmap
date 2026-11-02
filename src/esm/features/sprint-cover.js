/**
 * @module features/sprint-cover
 * Is a sprint scope line (written under a person) covered by the plan?
 *  - `ok`         a roadmap feature or a Monthly card matches it and that person is assigned there
 *  - `unassigned` a feature or card matches, but the person is not assigned to it
 *  - `missing`    nothing on any roadmap or in any month matches it
 * A match is the Monthly card the line is linked to (`fid`; then only that card counts), the Jira key in the title, or the same words (see `sameWords`, typing slips forgiven). Pure functions: the data is passed in.
 */
import { sameName } from './capacity.js';

const KEY = /\b([A-Z][A-Z0-9_]+-\d+)\b/;
/** The Jira key and site of a pasted address ("https://x.atlassian.net/browse/ABC-12") or a bare key ("abc-12"). */
export function parseJira(text) {
  const t = String(text || '').trim(), m = KEY.exec(t.toUpperCase().replace(/[^A-Z0-9_\-\/:.?=&%]/g, ' ')); if (!m) return null;
  const u = /^(https:\/\/[^\s/]+)\/(?:browse|jira\/software\/[^\s]*?\/issues)\b/i.exec(t) || /^(https:\/\/[^\s/]+\.atlassian\.net)\b/i.exec(t);
  return { key: m[1], base: u ? u[1] : '' };
}
/** Every Jira key in a pasted text (addresses, bare keys, several at once separated by spaces, commas or lines), without repeats; `base` = the site of the first address. */
export function parseJiraAll(text) {
  const t = String(text || ''), out = [], seen = new Set(), base = (/(https:\/\/[^\s/]+\.atlassian\.net)\b/i.exec(t) || [])[1] || '';
  const re = /\b([A-Za-z][A-Za-z0-9_]+-\d+)\b/g; let m;
  while ((m = re.exec(t))) { const k = m[1].toUpperCase(); if (!seen.has(k)) { seen.add(k); out.push({ key: k, base: base }); } }
  return out;
}
/** All Jira keys of a sprint line: the main one (`jk`, the status follows it) then the others (`jx`). */
export const keysOf = b => { const out = []; [b && b.jk].concat((b && b.jx) || []).forEach(k => { k = String(k || '').toUpperCase(); if (k && !out.includes(k)) out.push(k); }); return out; };
/** The fields to save for a list of keys. */
export const keyPatch = keys => ({ jk: keys[0] || '', jx: keys.slice(1) });
export const norm = s => String(s || '').toLowerCase().replace(/\(?\b[a-z][a-z0-9_]+-\d+\b\)?/g, ' ').replace(/#\S+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
export const toks = s => norm(s).split(' ').filter(w => w.length >= 3);
/** Edit distance, stops early when it is above `max` (returns max + 1). */
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { const cur = [i]; let low = i; for (let j = 1; j <= b.length; j++) { const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); cur.push(v); if (v < low) low = v; } if (low > max) return max + 1; prev = cur; }
  return prev[b.length];
}
/** Two words are the same when equal, or (a typing slip) one letter apart from 5 letters, two apart from 9 letters. */
export const fuzzyWord = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && lev(a, b, Math.min(a.length, b.length) >= 9 ? 2 : 1) <= (Math.min(a.length, b.length) >= 9 ? 2 : 1));
/** Same words: equal, one contains the other (at least 6 letters), or most of the shorter title's words are in the other (a typing slip in a word is forgiven). */
export function sameWords(a, b) {
  const x = norm(a), y = norm(b); if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x))) return true;
  const A = toks(a), B = toks(b); if (A.length < 2 || B.length < 2) return false;
  const [s, l] = A.length <= B.length ? [A, B] : [B, A], hit = s.filter(w => l.some(v => fuzzyWord(w, v))).length;
  return hit / s.length >= 0.75;
}
/** How close a pool entry is to what was typed (0 to 1): the share of typed words found in it (slips forgiven), or 0.9 when one text holds the other. */
export function closeness(query, title) {
  const x = norm(query), y = norm(title); if (!x || !y) return 0; if (x === y) return 1;
  if (Math.min(x.length, y.length) >= 3 && (x.includes(y) || y.includes(x))) return 0.9;
  const A = toks(query), B = toks(title); if (!A.length || !B.length) return 0;
  return A.filter(w => B.some(v => fuzzyWord(w, v) || (Math.min(w.length, v.length) >= 4 && (v.startsWith(w) || w.startsWith(v))))).length / A.length * 0.85;
}
/**
 * Best matches on the plan for a typed text, for the "Pick from the plan" dialog. Entries of the person come first at the same closeness.
 * @returns {Array} pool entries with `score` and `mine`; with an empty query every entry of the person (then the rest), newest cards first as given.
 */
export function suggest(query, person, pool, limit) {
  const seen = new Set(), out = [];
  (pool || []).forEach(p => {
    const k = (p.cid || '') + '|' + p.kind + '|' + String(p.t || '').toLowerCase() + '|' + p.where; if (seen.has(k)) return; seen.add(k);
    const mine = (p.names || []).some(n => sameName(n, person) || sameName(person, n)), c = String(query || '').trim() ? closeness(query, p.t) : 0;
    if (String(query || '').trim() && c < 0.3) return;
    out.push(Object.assign({}, p, { score: c, mine: mine }));
  });
  out.sort((a, b) => (Math.round(b.score * 10) - Math.round(a.score * 10)) || (Number(b.mine) - Number(a.mine)) || (b.score - a.score) || String(a.t).localeCompare(String(b.t)));
  return limit ? out.slice(0, limit) : out;
}
/** The text of a line with the card code at its end: "Sanar Integration (TF#35)". A code already at the end is replaced; no code removes it. */
export const withCode = (text, code) => { const base = String(text || '').replace(/\s*\(\s*[A-Za-z]{1,4}#\d+\s*\)\s*$/, '').trim(); return code ? (base ? base + ' (' + code + ')' : '(' + code + ')') : base; };
const hasKey = (title, key) => !!key && String(title || '').toUpperCase().includes(String(key).toUpperCase());
/**
 * @param {{t:string, jk?:string}} scope  the sprint line
 * @param {string} person                 the person it sits under
 * @param {Array<{kind:string,t:string,where:string,names:string[],jk?:string}>} pool  roadmap features and Monthly cards (names = people assigned)
 * @returns {{state:'ok'|'unassigned'|'missing', hits:Array, mine:Array}}
 */
export function cover(scope, person, pool) {
  const keys = keysOf(scope), inTitle = (KEY.exec(String(scope.t || '').toUpperCase()) || [])[1]; if (inTitle && !keys.includes(inTitle)) keys.push(inTitle);
  const hits = (pool || []).filter(p => (scope.fid && p.cid === scope.fid) || keys.some(key => hasKey(p.t, key) || (p.jk && p.jk.toUpperCase() === key.toUpperCase())) || (!scope.fid && sameWords(scope.t, p.t)));
  const mine = hits.filter(p => (p.names || []).some(n => sameName(n, person) || sameName(person, n)));
  return { state: mine.length ? 'ok' : hits.length ? 'unassigned' : 'missing', hits: hits, mine: mine };
}
