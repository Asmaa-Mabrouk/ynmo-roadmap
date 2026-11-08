/**
 * @module features/flow-time
 * Ynmo Flow: durations ("2h 30m", "1d") shared by estimates and work logs. Stored as minutes. A day is 8 hours, a week 5 days.
 */
const UNIT = { w: 2400, d: 480, h: 60, m: 1 };
/** "1d 2h 30m", "90m", "1.5h", "2" (a bare number means hours) -> minutes, or null when it cannot be read. */
export function parseDuration(text) {
  const s = String(text == null ? '' : text).trim().toLowerCase().replace(/,/g, '.'); if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60) || null;
  const re = /(\d+(?:\.\d+)?)\s*([wdhm])/g; let m, total = 0, used = 0;
  while ((m = re.exec(s))) { total += parseFloat(m[1]) * UNIT[m[2]]; used += m[0].length; }
  if (!used) return null;
  const rest = s.replace(re, '').replace(/\s+/g, ''); if (rest) return null;
  const r = Math.round(total); return r > 0 ? r : null;
}
/** Minutes -> "1d 2h 30m" (0 -> "0m"). */
export function fmtDuration(min) {
  let m = Math.max(0, Math.round(Number(min) || 0)); if (!m) return '0m';
  const out = []; [['w', 2400], ['d', 480], ['h', 60], ['m', 1]].forEach(([u, v]) => { const n = Math.floor(m / v); if (n) { out.push(n + u); m -= n * v; } });
  return out.join(' ');
}
/** Minutes -> hours with one decimal (for charts). */
export const hoursOf = min => Math.round((Number(min) || 0) / 6) / 10;
