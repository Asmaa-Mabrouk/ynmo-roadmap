/**
 * @module app/maintenance
 * Maintenance screen. Before the app starts it reads `maintenance.json` (next to index.html). When `"on": true` the app does NOT start:
 * no sign-in, no database connection, nothing can be read or changed, and people see a short message instead.
 * Used while the data is moved (for example to YNMO's own MySQL servers). To switch it on or off, edit maintenance.json and push: the site redeploys by itself.
 * If the file cannot be read (offline, missing) the app starts normally, so a broken file never locks the team out.
 */
const DEFAULTS = {
  title: 'Ynmo Roadmaps is under maintenance',
  message: 'We are moving our data to Ynmo’s own servers. Nothing is lost. The tool is paused so no change can be missed, and it will be back as soon as the move is checked.',
  title_ar: 'النظام تحت الصيانة',
  message_ar: 'نقوم بنقل البيانات إلى سيرفرات Ynmo. لا شيء مفقود. الأداة متوقفة مؤقتاً وستعود قريباً.',
  until: ''
};

/** The settings when maintenance is on, or null. `test` (a window hook for automated tests) replaces the file. */
export async function readMaintenance(win, fetchFn) {
  try {
    if (win.__maintenanceTest === undefined && win.location.protocol === 'file:') return null; // opened from a local file (tests, offline copy): there is no server file to read
    const t = win.__maintenanceTest;
    const j = t !== undefined ? t : await (async () => {
      const ctl = typeof win.AbortController === 'function' ? new win.AbortController() : null, timer = ctl ? setTimeout(() => ctl.abort(), 3000) : 0;
      try { const r = await fetchFn(new URL('maintenance.json', win.location.href).href + '?t=' + Date.now(), { cache: 'no-store', signal: ctl ? ctl.signal : undefined }); return r.ok ? await r.json() : null; } finally { clearTimeout(timer); }
    })();
    return j && j.on === true ? Object.assign({}, DEFAULTS, j) : null;
  } catch (e) { return null; }
}

/** Replace the whole page with the maintenance message. */
export function showMaintenance(doc, m) {
  const css = 'html,body{margin:0;height:100%;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f6fb;color:#1b1f33}@media (prefers-color-scheme:dark){html,body{background:#14161f;color:#e8eaf3}.mt-card{background:#1d2030!important;border-color:#2c3048!important}}'
    + '.mt{min-height:100%;display:grid;place-items:center;padding:24px;box-sizing:border-box}.mt-card{max-width:520px;width:100%;background:#fff;border:1px solid #e1e5ef;border-radius:16px;padding:32px 28px;text-align:center;box-sizing:border-box}'
    + '.mt-ic{font-size:44px;line-height:1}.mt h1{font-size:22px;margin:12px 0 8px}.mt p{margin:0 0 10px;line-height:1.6;color:inherit;opacity:.85}.mt-ar{direction:rtl;margin-top:18px;padding-top:16px;border-top:1px solid #e1e5ef}.mt-until{font-weight:600;opacity:1!important}'
    + '.mt button{margin-top:14px;padding:10px 20px;border-radius:999px;border:0;background:#0d8560;color:#fff;font-weight:600;font-size:15px;cursor:pointer}';
  doc.title = m.title;
  const mk = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const wrap = mk('main', 'mt'), card = mk('div', 'mt-card'), st = mk('style');
  st.textContent = css; wrap.setAttribute('role', 'status');
  card.append(mk('div', 'mt-ic', '🛠️'), mk('h1', '', m.title), mk('p', '', m.message));
  if (m.until) card.append(mk('p', 'mt-until', m.until));
  const ar = mk('div', 'mt-ar'); ar.setAttribute('lang', 'ar'); ar.append(mk('h1', '', m.title_ar), mk('p', '', m.message_ar)); card.append(ar);
  const b = mk('button', '', 'Check again'); b.type = 'button'; b.id = 'mt-retry'; b.addEventListener('click', () => doc.defaultView.location.reload()); card.append(b);
  wrap.append(card); doc.head.append(st); doc.body.textContent = ''; doc.body.append(wrap);
}
