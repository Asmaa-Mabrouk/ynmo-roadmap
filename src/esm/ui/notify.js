/**
 * @module ui/notify
 * Toast messages: short, dismissible notifications for the result of an action ("ok" = success, "err" = failure, "info").
 * Errors stay longer and are announced to screen readers immediately (role=alert); the rest are polite status messages.
 * Depends on nothing but the DOM.
 */
let box = null;
function host() {
  if (box && document.body.contains(box)) return box;
  box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.append(box); return box;
}
/**
 * @param {string} msg text to show
 * @param {'ok'|'err'|'info'} [kind='ok']
 * @param {number} [ms] auto-dismiss delay (default 3.5 s, 7 s for errors)
 */
export function notify(msg, kind, ms) {
  kind = kind || 'ok'; const t = document.createElement('div'); t.className = 'toast ' + kind; t.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  const ic = document.createElement('span'); ic.className = 'ti'; ic.textContent = kind === 'err' ? '!' : kind === 'ok' ? '✓' : 'i'; ic.setAttribute('aria-hidden', 'true');
  const tx = document.createElement('span'); tx.className = 'tt'; tx.textContent = msg;
  const x = document.createElement('button'); x.type = 'button'; x.className = 'tx'; x.textContent = '×'; x.setAttribute('aria-label', 'Dismiss');
  const gone = () => { t.classList.add('out'); setTimeout(() => t.remove(), 200); };
  x.addEventListener('click', gone); t.append(ic, tx, x); const h = host(); h.append(t);
  while (h.children.length > 3) h.firstChild.remove();
  setTimeout(gone, ms || (kind === 'err' ? 7000 : 3500));
}
let lastFail = 0;
/** Failure toast that fires at most once every 8 seconds (used by the save queue, which retries in bursts). */
export function notifyFailOnce(msg) { const n = Date.now(); if (n - lastFail < 8000) return; lastFail = n; notify(msg, 'err'); }
