/**
 * @module features/sprint-cover
 * Is a sprint scope line (written under a person) covered by the plan?
 *  - `ok`         a roadmap feature or a Monthly card matches it and that person is assigned there
 *  - `unassigned` a feature or card matches, but the person is not assigned to it
 *  - `missing`    nothing on any roadmap or in any month matches it
 * A match is the Jira key in the title, or the same words (see `sameWords`). Pure functions: the data is passed in.
 */
import { sameName } from './capacity.js';

const KEY = /\b([A-Z][A-Z0-9_]+-\d+)\b/;
/** The Jira key and site of a pasted address ("https://x.atlassian.net/browse/ABC-12") or a bare key ("abc-12"). */
export function parseJira(text) {
  const t = String(text || '').trim(), m = KEY.exec(t.toUpperCase().replace(/[^A-Z0-9_\-\/:.?=&%]/g, ' ')); if (!m) return null;
  const u = /^(https:\/\/[^\s/]+)\/(?:browse|jira\/software\/[^\s]*?\/issues)\b/i.exec(t) || /^(https:\/\/[^\s/]+\.atlassian\.net)\b/i.exec(t);
  return { key: m[1], base: u ? u[1] : '' };
}
export const norm = s => String(s || '').toLowerCase().replace(/\(?\b[a-z][a-z0-9_]+-\d+\b\)?/g, ' ').replace(/#\S+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const toks = s => norm(s).split(' ').filter(w => w.length >= 3);
/** Same words: equal, one contains the other (at least 6 letters), or most of the shorter title's words are in the other. */
export function sameWords(a, b) {
  const x = norm(a), y = norm(b); if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x))) return true;
  const A = toks(a), B = toks(b); if (A.length < 2 || B.length < 2) return false;
  const [s, l] = A.length <= B.length ? [A, B] : [B, A], hit = s.filter(w => l.includes(w)).length;
  return hit / s.length >= 0.75;
}
const hasKey = (title, key) => !!key && String(title || '').toUpperCase().includes(String(key).toUpperCase());
/**
 * @param {{t:string, jk?:string}} scope  the sprint line
 * @param {string} person                 the person it sits under
 * @param {Array<{kind:string,t:string,where:string,names:string[],jk?:string}>} pool  roadmap features and Monthly cards (names = people assigned)
 * @returns {{state:'ok'|'unassigned'|'missing', hits:Array, mine:Array}}
 */
export function cover(scope, person, pool) {
  const key = scope.jk || (KEY.exec(String(scope.t || '').toUpperCase()) || [])[1] || '';
  const hits = (pool || []).filter(p => (key && (hasKey(p.t, key) || (p.jk && p.jk.toUpperCase() === key.toUpperCase()))) || sameWords(scope.t, p.t));
  const mine = hits.filter(p => (p.names || []).some(n => sameName(n, person) || sameName(person, n)));
  return { state: mine.length ? 'ok' : hits.length ? 'unassigned' : 'missing', hits: hits, mine: mine };
}
