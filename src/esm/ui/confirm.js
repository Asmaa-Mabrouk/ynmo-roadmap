/** @module ui/confirm  A small confirm dialog (title, message, red confirm button). */
import { el } from '../core/model.js';
import { openDlg, closeDlg } from '../features/safety.js';
export function confirmDlg(title, msg, yes, onYes) {
  openDlg(title, box => {
    const ok = el('button', 'btn danger', yes), no = el('button', 'btn', 'Cancel'); ok.type = no.type = 'button';
    ok.addEventListener('click', () => { closeDlg(); onYes(); }); no.addEventListener('click', closeDlg);
    const row = el('div', 'row'); row.append(ok, no); box.append(el('p', '', msg), row);
  });
}
