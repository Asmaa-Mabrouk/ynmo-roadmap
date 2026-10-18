/**
 * @module features/google-drive
 * Connect Google Drive and export a sprint plan as a real Google Doc.
 * Sign-in uses Google Identity Services (a popup the first time; the token lives only in memory, for about an hour).
 * Scope `drive.file` only: the tool can see and edit just the documents it created, never the rest of the Drive.
 * The OAuth *Client ID* (public, not a secret) is saved by an admin in the meta doc `ideas/googlecfg` = {cfg:true, cid}.
 */
import { S } from '../core/state.js';
import { el } from '../core/model.js';
import { write } from '../core/saving.js';
import { logAct } from '../core/shared.js';
import { openDlg, closeDlg } from './safety.js';
import { notify } from '../ui/notify.js';

export const SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const CID_RE = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i;
export const clientId = () => { const c = ((S.ideas || {}).googlecfg || {}).cid; return CID_RE.test(c || '') ? c : ''; };
export const isAdmin = () => !!(S.me && S.me.is_admin);
/** Google Doc id from a Docs address, or ''. */
export const docId = u => { const m = /\/document\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{15,})/.exec(String(u || '')); return m ? m[1] : ''; };

let gis = null, tok = null;   // tok = {t, exp}
function loadGis() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  if (gis) return gis;
  gis = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(); s.onerror = () => { gis = null; rej(new Error('Could not load Google sign-in. Check your connection or an ad blocker.')); };
    document.head.append(s);
  });
  return gis;
}
/** An access token for Drive (asks Google in a popup when there is none yet). Must be called from a click. */
export async function getToken() {
  if (tok && tok.exp > Date.now() + 60000) return tok.t;
  const cid = clientId(); if (!cid) throw new Error('Google Drive is not set up yet.');
  await loadGis();
  return new Promise((res, rej) => {
    const c = window.google.accounts.oauth2.initTokenClient({
      client_id: cid, scope: SCOPE, include_granted_scopes: true,
      callback: r => { if (r && r.access_token) { tok = { t: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3000) * 1000 }; res(tok.t); } else rej(new Error((r && (r.error_description || r.error)) || 'Google did not sign you in.')); },
      error_callback: e => rej(new Error(e && e.type === 'popup_closed' ? 'The Google window was closed before you finished.' : e && e.type === 'popup_failed_to_open' ? 'Your browser blocked the Google window. Allow pop-ups for this site and try again.' : 'Google sign-in failed.')),
    });
    c.requestAccessToken({ prompt: tok ? '' : undefined });
  });
}
export const disconnect = () => { const t = tok && tok.t; tok = null; try { if (t && window.google) window.google.accounts.oauth2.revoke(t, () => {}); } catch (e) { /* ignore */ } };

const API = 'https://www.googleapis.com';
async function fail(r, what) {
  let m = ''; try { const j = await r.json(); m = (j.error && (j.error.message || j.error)) || ''; } catch (e) { /* not JSON */ }
  const err = new Error(r.status === 401 ? 'Google sign-in expired. Click again to reconnect.' : r.status === 403 && /accessNotConfigured|has not been used|disabled/i.test(m) ? 'The Google Drive API is not enabled in your Google Cloud project (APIs & Services > Library > Google Drive API > Enable).' : what + ' failed (' + r.status + ')' + (m ? ': ' + String(m).slice(0, 140) : ''));
  err.status = r.status; if (r.status === 401) tok = null; throw err;
}
/**
 * Create a Google Doc from HTML, or replace the content of one this tool created.
 * @returns {Promise<{id:string, url:string, created:boolean}>}
 */
export async function exportDoc(o) {
  const t = await getToken(), auth = { Authorization: 'Bearer ' + t };
  if (o.fileId) {
    const r = await fetch(API + '/upload/drive/v3/files/' + encodeURIComponent(o.fileId) + '?uploadType=media&fields=id', { method: 'PATCH', headers: Object.assign({ 'Content-Type': 'text/html; charset=UTF-8' }, auth), body: o.html });
    if (r.ok) return { id: o.fileId, url: 'https://docs.google.com/document/d/' + o.fileId + '/edit', created: false };
    if (r.status !== 404 && r.status !== 403) await fail(r, 'Updating the Google Doc');   // 404/403: not a doc this tool made -> create a new one below
  }
  const b = 'ynmo' + Math.random().toString(36).slice(2), meta = JSON.stringify({ name: o.name, mimeType: 'application/vnd.google-apps.document' });
  const body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + b + '\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n' + o.html + '\r\n--' + b + '--';
  const r = await fetch(API + '/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: Object.assign({ 'Content-Type': 'multipart/related; boundary=' + b }, auth), body: body });
  if (!r.ok) await fail(r, 'Creating the Google Doc');
  const j = await r.json(); if (!j.id) throw new Error('Google did not return the new document.');
  return { id: j.id, url: 'https://docs.google.com/document/d/' + j.id + '/edit', created: true };
}

/** One-time setup dialog (admins): paste the OAuth Client ID. `then` runs after it was saved. */
export function openDriveSetup(then) {
  openDlg('Connect Google Drive (one-time setup)', box => {
    box.append(el('p', 'sub', 'An admin does this once. Everyone on the team can then export with one click.'));
    const ol = el('ol', 'gsteps');
    ['Open console.cloud.google.com and create a project (any name, for example "Ynmo Roadmaps").',
      'APIs & Services > Library: search "Google Drive API" and click Enable.',
      'APIs & Services > OAuth consent screen: choose Internal if your company uses Google Workspace, otherwise External. Fill the app name and your email. Add the scope .../auth/drive.file. For External, click "Publish app" so teammates are not limited to test users (this scope needs no Google review).',
      'APIs & Services > Credentials > Create credentials > OAuth client ID > Web application. Under Authorized JavaScript origins add ' + location.origin + ' and create it.',
      'Copy the Client ID (it ends with .apps.googleusercontent.com) and paste it below. It is not a secret.'
    ].forEach(t => ol.append(el('li', '', t)));
    const ci = el('input'); ci.type = 'text'; ci.value = clientId(); ci.placeholder = '1234567890-abc123.apps.googleusercontent.com'; ci.setAttribute('aria-label', 'Google OAuth Client ID'); ci.autocomplete = 'off';
    const msg = el('p', 'sub'); msg.setAttribute('aria-live', 'polite');
    const ok = el('button', 'btn primary', 'Save'), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button'; no.addEventListener('click', closeDlg);
    ok.addEventListener('click', () => {
      const v = ci.value.trim(); if (!CID_RE.test(v)) { msg.textContent = 'That does not look like a Client ID. It ends with .apps.googleusercontent.com.'; return; }
      S.ideas.googlecfg = Object.assign({}, S.ideas.googlecfg || {}, { cfg: true, cid: v }); write('ideas/googlecfg', S.ideas.googlecfg); logAct('sprint', 'set up Google Drive export'); notify('Google Drive is set up'); closeDlg(); if (then) then();
    });
    const lab = el('label'); lab.append(el('span', '', 'Client ID'), ci); const row = el('div', 'row'); row.append(ok, no);
    box.append(ol, lab, msg, row); setTimeout(() => ci.focus(), 0);
  });
}
