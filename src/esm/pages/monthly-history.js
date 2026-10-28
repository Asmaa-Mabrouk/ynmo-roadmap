/**
 * @module pages/monthly-history
 * "Version history" of a month (editors): the saved versions, what differs from now, Restore this version, Bring back only the missing cards,
 * and "Save a version" (a named version that is never deleted automatically). The data rules are in features/month-history.js.
 */
import { S } from '../core/state.js';
import { el } from '../core/model.js';
import { write } from '../core/saving.js';
import { notify } from '../ui/notify.js';
import { confirmDlg } from '../ui/confirm.js';
import { openDlg, closeDlg } from '../features/safety.js';
import { bringBack, cardCount, compare, autoSlot, makeVersion, restoreOf, stampOf, versionsOf } from '../features/month-history.js';

/** Keeps a version of `doc` (what is stored for month `m`) and (an automatic version reuses the slot of the oldest one when all 15 are used; nothing is deleted). */
export function keepVersion(m, doc, named, name, who) {
  S.hist = S.hist || {}; const vs = versionsOf(S.hist, m), at = +doc.ts || 0;
  if (!named && at && vs.some(v => !v.named && v.at === at)) return '';   // this state is already kept
  const mk = makeVersion(m, doc, named, name, who, Date.now(), named ? 0 : autoSlot(vs)); mk.v._p = Date.now();
  if (S.hist[mk.id] && S.hist[mk.id].at === mk.v.at) return mk.id;
  S.hist[mk.id] = mk.v; const w = Object.assign({}, mk.v); delete w._p; write('reports/' + mk.id, w);
  return mk.id;
}
const who = () => (S.me && (S.me.name || S.me.email)) || '';
/** cb: { docOf(m), save(m, mutate, log, quiet, force), render(), label(m) } */
export function openHistory(m, cb) {
  let sel = '';
  openDlg('Version history · ' + cb.label(m), box => {
    box.classList.add('vhdlg');
    const top = el('div', 'vhtop'), inp = el('input'); inp.id = 'vhname'; inp.type = 'text'; inp.maxLength = 60; inp.placeholder = 'Name this version, for example Before the exec review'; inp.setAttribute('aria-label', 'Name of the version');
    const sv = el('button', 'btn pri sm', 'Save a version'); sv.type = 'button'; sv.id = 'vhsave';
    sv.addEventListener('click', () => { const cur = cb.docOf(m); keepVersion(m, cur, true, inp.value.trim() || 'Saved version', who()); inp.value = ''; notify('Version saved. It is kept until you remove it.'); draw(); });
    top.append(inp, sv);
    const body = el('div', 'vhbody'), list = el('div', 'vhlist'), det = el('div', 'vhdetail'); list.id = 'vhlist'; det.id = 'vhdetail';
    list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'Versions');
    body.append(list, det); box.append(el('p', 'hint', 'Every change to a month is kept as a version. The board always shows the latest one. Pick a version to see what is different from now.'), top, body);
    function draw() {
      const cur = cb.docOf(m), vs = versionsOf(S.hist, m); list.textContent = ''; det.textContent = '';
      const cb0 = el('button', 'vhitem' + (sel ? '' : ' on'), ''); cb0.type = 'button'; cb0.dataset.id = ''; cb0.append(el('strong', '', 'Now (latest)'), el('span', '', cardCount(cur) + ' cards')); cb0.addEventListener('click', () => { sel = ''; draw(); }); list.append(cb0);
      if (!vs.length) list.append(el('p', 'hint vhnone', 'No earlier versions yet. One is kept automatically when the month changes.'));
      vs.forEach(v => {
        const b = el('button', 'vhitem' + (sel === v.id ? ' on' : '') + (v.named ? ' named' : ''), ''); b.type = 'button'; b.dataset.id = v.id; b.setAttribute('role', 'option'); b.setAttribute('aria-selected', sel === v.id ? 'true' : 'false');
        b.append(el('strong', '', v.named ? '★ ' + (v.name || 'Saved version') : stampOf(v.at)), el('span', '', (v.named ? stampOf(v.at) + ' · ' : '') + (v.by || 'someone') + ' · ' + v.n + ' cards'));
        b.addEventListener('click', () => { sel = v.id; draw(); }); list.append(b);
      });
      const v = vs.find(x => x.id === sel);
      if (!v) { det.append(el('p', 'hint', 'This is the version you see on the board.')); return; }
      const d = compare(v, cur), sec = (title, arr, cls) => { if (!arr.length) return; const s = el('div', 'vhsec ' + cls); s.append(el('strong', '', title + ' (' + arr.length + ')')); const ul = el('ul'); arr.slice(0, 40).forEach(c => ul.append(el('li', '', c.t))); if (arr.length > 40) ul.append(el('li', '', '… and ' + (arr.length - 40) + ' more')); s.append(ul); det.append(s); };
      det.append(el('p', 'vhsum', (v.named ? '★ ' + v.name + ' · ' : '') + stampOf(v.at) + ' · ' + (v.by || 'someone') + ' · ' + v.n + ' cards. Compared with now:'));
      sec('Missing now (in this version, not on the board)', d.missing, 'miss'); sec('Added since', d.newer, 'add'); sec('Changed since', d.changed, 'mod');
      if (!d.missing.length && !d.newer.length && !d.changed.length) det.append(el('p', 'hint', 'Same as now.'));
      const bar = el('div', 'vhbtns'), rb = el('button', 'btn sm', 'Restore this version'), bb = el('button', 'btn pri sm', 'Bring back only the missing cards' + (d.missing.length ? ' (' + d.missing.length + ')' : ''));
      rb.type = 'button'; rb.id = 'vhrestore'; bb.type = 'button'; bb.id = 'vhbring'; bb.disabled = !d.missing.length; if (!d.missing.length) bb.title = 'Nothing is missing';
      bb.addEventListener('click', () => { keepVersion(m, cb.docOf(m), true, 'Before bringing cards back', who()); const add = bringBack(cb.docOf(m), v); cb.save(m, dd => { dd.lines = add.lines; }, 'brought back ' + d.missing.length + ' card' + (d.missing.length === 1 ? '' : 's') + ' to ' + cb.label(m) + ' from the version of ' + stampOf(v.at), false, true); notify(d.missing.length + ' card' + (d.missing.length === 1 ? '' : 's') + ' brought back. Nothing else changed.'); cb.render(); sel = ''; draw(); });
      rb.addEventListener('click', () => confirmDlg('Restore this version?', cb.label(m) + ' goes back to the version of ' + stampOf(v.at) + ' (' + v.n + ' cards). Cards added since are removed from the board. The board as it is now is kept as a version first, so you can come back.', 'Restore', () => {
        keepVersion(m, cb.docOf(m), true, 'Before restoring ' + stampOf(v.at), who()); const r = restoreOf(cb.docOf(m), v);
        cb.save(m, dd => { Object.keys(dd).forEach(k => { if (!(k in r) && !['by', 'ts', 'subAt', 'subBy', 'status', 'pl', 'mo', 'lines'].includes(k)) delete dd[k]; }); Object.keys(r).forEach(k => { if (!['by', 'ts', 'subAt', 'subBy', 'status', 'pl', 'mo'].includes(k)) dd[k] = r[k]; }); }, 'restored ' + cb.label(m) + ' to the version of ' + stampOf(v.at), false, true);
        notify('Restored.'); cb.render(); sel = ''; closeDlg(); }));
      bar.append(rb, bb); det.append(bar);
    }
    draw();
  });
}
