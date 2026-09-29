/**
 * @module avatars
 * Built-in avatar set.
 * Local SVG avatars so no external image host is needed (also keeps the CSP strict).
 * NOTE: all src/js files share one global scope (concatenated by build.mjs).
 */
/* ---------- avatars: local, professional, no external images ---------- */
const AV_BG = ['#d9f2ea', '#e6e0f7', '#dfe6f8', '#fde6da', '#fbeec9', '#e4eaf2'];
const AVATARS = [
  { bg: 0, skin: '#f1c9a5', hair: '#2b2b33', st: 'short', top: '#0d8560' },
  { bg: 1, skin: '#e0ac82', hair: '#3a2a20', st: 'long', top: '#22242f' },
  { bg: 2, skin: '#c68a5e', hair: '#1f1f27', st: 'short', top: '#5a6db5' },
  { bg: 3, skin: '#8d5a3b', hair: '#15151b', st: 'long', top: '#6d48a8' },
  { bg: 0, skin: '#f1c9a5', hair: '#0d8560', st: 'hijab', top: '#0d8560' },
  { bg: 1, skin: '#e0ac82', hair: '#6d48a8', st: 'hijab', top: '#6d48a8' },
  { bg: 4, skin: '#c68a5e', hair: '#5a6db5', st: 'hijab', top: '#5a6db5' },
  { bg: 5, skin: '#8d5a3b', hair: '#22242f', st: 'hijab', top: '#22242f' },
  { bg: 2, skin: '#f1c9a5', hair: '#7a4b2a', st: 'bun', top: '#c04a17' },
  { bg: 3, skin: '#e0ac82', hair: '#22242f', st: 'bun', top: '#0d8560' },
  { bg: 4, skin: '#c68a5e', hair: '#c9a24b', st: 'short', top: '#22242f' },
  { bg: 5, skin: '#8d5a3b', hair: '#22242f', st: 'bald', top: '#5a6db5' }
];
function avatarSvg(i) {
  const a = AVATARS[i]; if (!a) return '';
  let s = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="64" height="64" fill="' + AV_BG[a.bg] + '"/>';
  if (a.st === 'long') s += '<path d="M19 27c0-11 5-17 13-17s13 6 13 17v15c0 3-2 5-5 5H24c-3 0-5-2-5-5z" fill="' + a.hair + '"/>';
  if (a.st === 'hijab') s += '<path d="M15 30c0-12 7-20 17-20s17 8 17 20c0 8-2 14-5 22H20c-3-8-5-14-5-22z" fill="' + a.hair + '"/>';
  s += '<path d="M6 66c2-15 13-21 26-21s24 6 26 21z" fill="' + (a.st === 'hijab' ? a.hair : a.top) + '"/>';
  s += '<rect x="28" y="36" width="8" height="10" rx="3" fill="' + a.skin + '"/>';
  s += '<ellipse cx="32" cy="27" rx="' + (a.st === 'hijab' ? 8.5 : 10) + '" ry="' + (a.st === 'hijab' ? 10 : 11) + '" fill="' + a.skin + '"/>';
  if (a.st === 'short' || a.st === 'bun') s += '<path d="M21.5 26c-.5-9 4-15 10.5-15s11 6 10.5 15c-2-5-6-7-10.5-7s-8.500 2-10.500 7z" fill="' + a.hair + '"/>';
  if (a.st === 'long') s += '<path d="M21.500 25c0-8 4-13 10.500-13s10.500 5 10.500 13c-3-4-6-5.500-10.500-5.500S24.500 21 21.500 25z" fill="' + a.hair + '"/>';
  if (a.st === 'bun') s += '<circle cx="32" cy="10" r="5" fill="' + a.hair + '"/>';
  return s + '</svg>';
}
function initials(n) { const p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
function avatarEl(id, size, name) {
  const s = el('span', 'av'); s.style.width = s.style.height = size + 'px';
  const i = parseInt(String(id || '').replace(/\D/g, ''), 10);
  if (id && AVATARS[i]) s.innerHTML = avatarSvg(i);
  else { s.textContent = initials(name); s.style.fontSize = Math.round(size * .4) + 'px'; s.style.background = 'color-mix(in srgb, var(--brand) 18%, var(--surface))'; s.style.color = 'var(--brand)'; }
  return s;
}

