/**
 * @module features/sprint-review
 * Dialogs that connect sprint items to Monthly cards: (1) link a sprint item to a card by its id (DC#12), (2) "Review sprint updates":
 * the percent each card would get from its sprint items, applied one by one or all ticked at once (nothing changes until Apply).
 */
import { el } from '../core/model.js';
import { S } from '../core/state.js';
import { openDlg, closeDlg } from './safety.js';
import { allCards, fidFromText, fidLabel } from './feature-sync.js';
import { cardId } from './month-model.js';

/** Link (or unlink) one sprint item to a Monthly card. `o` = { b, saveItem, redraw, notify } */
export function openCardLink(o) {
  openDlg('Link to a Monthly card', box => {
    box.append(el('p', 'sub', 'Type the id of the card (for example DC#12). The completion percentage of this item then counts towards that card in "Review sprint updates" on Monthly.'));
    const dl = el('datalist'); dl.id = 'sprintcardlist'; allCards().map(x => cardId(x.l)).filter(Boolean).sort().forEach(v => { const op = el('option'); op.value = v; dl.append(op); });
    const inp = el('input'); inp.type = 'text'; inp.maxLength = 12; inp.placeholder = 'Card id'; inp.setAttribute('aria-label', 'Monthly card id'); inp.setAttribute('list', 'sprintcardlist'); inp.value = o.b.fid ? fidLabel(o.b.fid) : '';
    const err = el('p', 'sub bad'); err.setAttribute('role', 'alert');
    const ok = el('button', 'btn primary', 'Link'), un = el('button', 'btn', 'Remove link'), no = el('button', 'btn', 'Cancel'); ok.type = un.type = no.type = 'button'; un.hidden = !o.b.fid; no.addEventListener('click', closeDlg);
    const go = () => { const id = fidFromText(inp.value); if (!id) { err.textContent = 'No Monthly card has the id ' + (inp.value.trim() || '(empty)') + '.'; return; } o.saveItem(o.b.id, { fid: id }); closeDlg(); o.redraw(o.b.id); o.notify('Linked to ' + fidLabel(id)); };
    ok.addEventListener('click', go); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    un.addEventListener('click', () => { const p = Object.assign({}, S.sitems[o.b.id] || {}); delete p.fid; o.saveItem(o.b.id, { fid: '' }); closeDlg(); o.redraw(o.b.id); o.notify('Link removed'); });
    const row = el('div', 'row'); row.append(ok, un, no); box.append(dl, inp, err, row); setTimeout(() => inp.focus(), 0);
  });
}

/** Months' cards for `proposals`: [{did, mo, l}] */
export const monthCards = () => { const out = []; Object.keys(S.reports || {}).filter(id => /^mo\d{6}$/.test(id)).forEach(did => { const d = S.reports[did]; if (d && d.mo) (d.lines || []).forEach(l => { if (l && String(l.t || '').trim()) out.push({ did: did, mo: d.mo, l: l }); }); }); return out; };

/** The review dialog. `o` = { list: proposals, apply(did, id, pct), done() } */
export function openReview(o) {
  openDlg('Review sprint updates', box => {
    if (!o.list.length) { box.append(el('p', 'sub', 'Every card already has the percentage its sprint items give.')); const c = el('button', 'btn', 'Close'); c.type = 'button'; c.addEventListener('click', closeDlg); box.append(c); return; }
    box.append(el('p', 'sub', 'The completion of the sprint items gives these new percentages. Tick the cards to update and press Apply. Items matched only by words are not ticked: check them first.'));
    const wrap = el('div', 'srlist'), picks = [];
    o.list.forEach(p => {
      const row = el('label', 'srrow'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !p.auto; cb.setAttribute('aria-label', 'Update ' + p.id); picks.push({ cb: cb, p: p });
      const head = el('div', 'srhead'); head.append(el('b', '', p.id + ' ' + p.card.t), el('span', 'srpct' + (p.down ? ' down' : ''), p.from + '% → ' + p.to + '%'));
      const items = el('ul', 'srit'); p.items.forEach(x => items.append(el('li', '', x.t + ' · ' + x.pc + '% · Sprint ' + x.n + (x.auto ? ' · matched by words' : ''))));
      const body = el('div', 'srbody'); body.append(head, items); row.append(cb, body); wrap.append(row);
    });
    const ok = el('button', 'btn primary', 'Apply'), no = el('button', 'btn', 'Close'); ok.type = no.type = 'button'; no.addEventListener('click', closeDlg);
    const upd = () => { const n = picks.filter(x => x.cb.checked).length; ok.disabled = !n; ok.textContent = n ? 'Apply (' + n + ')' : 'Apply'; }; picks.forEach(x => x.cb.addEventListener('change', upd)); upd();
    ok.addEventListener('click', () => { const sel = picks.filter(x => x.cb.checked); o.apply(sel.map(x => x.p)); closeDlg(); o.done(sel.length); });
    const row = el('div', 'row'); row.append(ok, no); box.append(wrap, row);
  });
}
