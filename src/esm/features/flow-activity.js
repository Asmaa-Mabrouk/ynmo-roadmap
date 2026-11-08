/**
 * @module features/flow-activity
 * Ynmo Flow phase 4: comments (with @mentions), work logs, time summary and attachment rules. Pure functions, no screen code.
 * Documents: flow_comments {iss, by, at, t, men[], ed}, flow_logs {iss, by, at, day, min, t}, flow_files {iss, by, at, name, size, type, path}.
 */
import { parseDuration, fmtDuration } from './flow-time.js';

export const MAX_COMMENT = 4000;
export const MAX_FILE = 10 * 1024 * 1024;
export const MAX_FILES_PER_TICKET = 20;
const BLOCKED_EXT = ['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'sh', 'js', 'mjs', 'vbs', 'ps1', 'jar', 'apk', 'dll', 'app', 'dmg', 'html', 'htm', 'svg'];

const rowsOf = (map, iss) => Object.keys(map || {}).filter(k => map[k] && map[k].iss === iss).map(k => Object.assign({ id: k }, map[k]));
/** Comments of a ticket, oldest first. */
export const commentsOf = (map, iss) => rowsOf(map, iss).sort((a, b) => String(a.at).localeCompare(String(b.at)));
export const logsOf = (map, iss) => rowsOf(map, iss).sort((a, b) => String(b.day).localeCompare(String(a.day)) || String(b.at).localeCompare(String(a.at)));
export const filesOf = (map, iss) => rowsOf(map, iss).sort((a, b) => String(a.at).localeCompare(String(b.at)));

/** Names mentioned with @ in a text: "@Mona Ali" matches the longest known name first, case does not matter. */
export function mentionsIn(text, names) {
  const t = String(text || ''), out = [];
  [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length).forEach(n => {
    const re = new RegExp('(^|[^\\w])@' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w])', 'i');
    if (re.test(t) && !out.some(o => o.toLowerCase().includes(n.toLowerCase()))) out.push(n);
  });
  return out;
}
/** A new comment document (throws a short message when it is empty or too long). `names` = people who can be mentioned. */
export function makeComment(o, names, now) {
  const t = String(o.t || '').trim(); if (!t) throw new Error('Write something first.'); if (t.length > MAX_COMMENT) throw new Error('A comment can have at most ' + MAX_COMMENT + ' characters.');
  return { iss: o.iss, by: o.by || '', at: now || new Date().toISOString(), t: t, men: mentionsIn(t, names || []) };
}
/** Edit a comment: new text, mentions recomputed, `ed` set. */
export function editComment(c, text, names, now) {
  const n = makeComment({ iss: c.iss, by: c.by, t: text }, names, c.at); return Object.assign({}, c, { t: n.t, men: n.men, ed: now || new Date().toISOString() });
}
/** Can this person edit or delete the comment? Their own; level 3 (delete right) may delete anyone's. */
export const canChangeComment = (c, me, canDeleteAll, forDelete) => !!c && ((!!me && c.by === me) || (!!forDelete && !!canDeleteAll));

/** A new work log (text like "2h 30m"). */
export function makeLog(o, now) {
  const min = parseDuration(o.time); if (!min) throw new Error('Write the time like 2h 30m, 90m or 1d.'); if (min > 24 * 60 * 5) throw new Error('That is more than a work week. Check the time.');
  const day = String(o.day || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Choose the day.');
  return { iss: o.iss, by: o.by || '', at: now || new Date().toISOString(), day: day, min: min, t: String(o.t || '').trim().slice(0, 300) };
}
export const loggedMin = logs => logs.reduce((s, l) => s + (Number(l.min) || 0), 0);
/** {oe, logged, remaining, over, pct} for a ticket (oe = original estimate in minutes or null). */
export function timeSummary(oe, logs) {
  const lg = loggedMin(logs), e = oe > 0 ? oe : 0;
  return { oe: e || null, logged: lg, remaining: e ? Math.max(0, e - lg) : null, over: !!e && lg > e, pct: e ? Math.min(100, Math.round(lg * 100 / e)) : null };
}
/** Total minutes per person for logs of a period ('' from = no limit). */
export function loggedByPerson(logs, from, to) {
  const out = {}; logs.forEach(l => { if ((!from || l.day >= from) && (!to || l.day <= to)) out[l.by] = (out[l.by] || 0) + (Number(l.min) || 0); }); return out;
}

/** Text of the problem with a file ('' when it can be attached). */
export function fileProblem(f, countNow) {
  const ext = String((/\.([^.]+)$/.exec(f.name || '') || [])[1] || '').toLowerCase();
  if (!f.name) return 'The file has no name.';
  if (f.size > MAX_FILE) return f.name + ' is bigger than 10 MB.';
  if (!f.size) return f.name + ' is empty.';
  if (BLOCKED_EXT.includes(ext)) return '.' + ext + ' files are not allowed (they can run code).';
  if ((countNow || 0) >= MAX_FILES_PER_TICKET) return 'A ticket can have at most ' + MAX_FILES_PER_TICKET + ' files.';
  return '';
}
/** A file name safe for a storage path. */
export const safeName = n => String(n || 'file').normalize('NFKD').replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').replace(/^\.+/, '_').slice(-80) || 'file';
export const fmtSize = b => (b >= 1048576 ? (Math.round(b / 104857.6) / 10) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B');
export const isImage = t => /^image\/(png|jpe?g|gif|webp)$/i.test(t || '');
