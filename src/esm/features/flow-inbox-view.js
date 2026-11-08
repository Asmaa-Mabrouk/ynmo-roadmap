/**
 * @module features/flow-inbox-view
 * Ynmo Flow, "For you" inbox: what needs my answer, with AI reply drafts (Edge Function flow-ai) and a digest.
 * c = {rows, who, today, open(id), canEdit, names, ai(body) -> Promise<data>}. Dismissed items are remembered in this browser only.
 */
import { el } from '../core/model.js';
import { selOf } from '../core/shared.js';
import { notify } from '../ui/notify.js';
import { KINDS, digestItems, inboxItems, kindOf, makeMasker, replyContext } from './flow-inbox.js';
import { tag } from './flow-views.js';

const KEY = 'ynmo-flow-inbox-dismissed';
const loadDismissed = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
const saveDismissed = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* private window: dismissals last for this visit only */ } };
const mark = (it, i) => it.id + ':' + (i.up || '');

/** Number of items waiting for me (for the sidebar badge). */
export const inboxCount = (rows, me, day) => { const dm = loadDismissed(); const byId = Object.fromEntries(rows.map(r => [r.id, r])); return inboxItems(rows, me, null, day).filter(x => dm[mark(x, byId[x.id])] == null).length; };

export function inboxView(host, c, ui) {
  const byId = Object.fromEntries(c.rows.map(r => [r.id, r]));
  const all = inboxItems(c.rows, c.who, null, c.today), dm = loadDismissed();
  const items = all.filter(x => dm[mark(x, byId[x.id])] == null);
  const maskOn = () => ui.imask !== false;
  const masker = () => (maskOn() ? makeMasker([c.who].concat(c.names, c.rows.flatMap(r => [r.as, r.rp]))) : { mask: s => String(s == null ? '' : s), unmask: s => s, map: {} });
  const bar = el('div', 'flowbar finbar');
  const dg = el('button', 'btn', 'Summarize my inbox'); dg.type = 'button'; dg.id = 'in-digest'; dg.disabled = !c.canEdit || !items.length;
  const mk = el('label', 'flowopen'); const cb = el('input'); cb.type = 'checkbox'; cb.id = 'in-mask'; cb.checked = maskOn(); cb.addEventListener('change', () => { ui.imask = cb.checked; }); mk.append(cb, document.createTextNode(' Hide people’s names from the AI'));
  const em = selOf([['all', 'Everything on my tickets'], ['mine', 'Only when assigned or mentioned'], ['off', 'Never']], c.emailMode ? c.emailMode() : 'all'); em.id = 'in-email'; em.setAttribute('aria-label', 'Email me');
  em.addEventListener('change', () => { if (c.setEmailMode) { c.setEmailMode(em.value); notify('Email choice saved', 'info'); } }); em.disabled = !c.setEmailMode;
  const emw = el('label', 'flowopen'); emw.append(document.createTextNode('Email me: '), em);
  bar.append(dg, mk, emw); host.append(bar);
  const sum = el('div', 'fpanel card finsum'); sum.id = 'in-sum'; sum.hidden = true; host.append(sum);
  const list = el('div', 'finlist'); host.append(list);
  if (!items.length) { list.append(el('p', 'sub', all.length ? 'Everything here is dismissed. Reload the page after new activity to see it again.' : 'Nothing needs your answer right now.')); }
  const draw = (it, box) => {
    const i = byId[it.id], m = masker();
    box.textContent = '';
    const tone = selOf([['short', 'Short'], ['formal', 'Formal'], ['detail', 'Ask for details'], ['custom', 'My instruction']], 'short'); tone.id = 'in-tone'; tone.setAttribute('aria-label', 'Style');
    const lang = selOf([['en', 'English'], ['ar', 'Egyptian Arabic']], 'en'); lang.id = 'in-lang'; lang.setAttribute('aria-label', 'Language');
    const ex = el('input'); ex.type = 'text'; ex.id = 'in-extra'; ex.placeholder = 'Optional: what should the reply say?';
    const go = el('button', 'btn primary', 'Draft replies'); go.type = 'button'; go.id = 'in-go';
    const out = el('div', 'finout'); out.setAttribute('aria-live', 'polite');
    go.addEventListener('click', async () => {
      go.disabled = true; out.textContent = ''; out.append(el('p', 'sub', 'Writing...'));
      try {
        const data = await c.ai({ mode: 'reply', ticket: replyContext(i, it, m.mask), tone: tone.value, lang: lang.value, extra: m.mask(ex.value) });
        out.textContent = ''; const rs = (data && data.replies) || []; if (!rs.length) throw new Error('The AI returned nothing.');
        rs.forEach(r => {
          const d = el('div', 'finreply'); d.append(el('b', '', r.label || 'Reply')); const p = el('p', '', m.unmask(r.text)); p.className = 'finrtext';
          const cp = el('button', 'btn', 'Copy'); cp.type = 'button'; cp.addEventListener('click', () => { const t = p.textContent; const done = () => notify('Copied', 'info'); try { navigator.clipboard.writeText(t).then(done, done); } catch (e) { done(); } });
          d.append(p, cp); out.append(d);
        });
        out.append(el('p', 'sub', 'Drafts only: read, edit and send them yourself. Comments inside Flow come in a later phase.'));
      } catch (e) { out.textContent = ''; out.append(el('p', 'rerr', c.aiWhy ? await c.aiWhy(e) : String(e.message || e))); }
      go.disabled = false;
    });
    const r = el('div', 'row'); r.append(tone, lang, ex, go); box.append(r, out);
  };
  KINDS.forEach(k => {
    const grp = items.filter(x => x.kind === k.id); if (!grp.length) return;
    const sec = el('section', 'fpanel card finsec'); sec.dataset.kind = k.id;
    sec.append(el('h3', '', k.n + ' (' + grp.length + ')'), el('p', 'sub', k.ask));
    grp.forEach(it => {
      const i = byId[it.id], row = el('div', 'finrow'); row.dataset.id = it.id;
      const top = el('div', 'fintop'), kb = el('button', 'flink', it.key); kb.type = 'button'; kb.addEventListener('click', () => c.open(it.id));
      top.append(tag(kind(it).c, kind(it).n), kb, el('span', 'fbltitle', it.t));
      const why = el('p', 'sub', it.why), act = el('div', 'row');
      const sg = el('button', 'btn', 'Suggest reply'); sg.type = 'button'; sg.dataset.act = 'suggest'; sg.disabled = !c.canEdit;
      const ds = el('button', 'btn', 'Dismiss'); ds.type = 'button'; ds.dataset.act = 'dismiss';
      const box = el('div', 'finbox'); box.hidden = true;
      sg.addEventListener('click', () => { box.hidden = !box.hidden; if (!box.hidden) draw(it, box); });
      ds.addEventListener('click', () => { const d = loadDismissed(); d[mark(it, i)] = Date.now(); saveDismissed(d); row.remove(); const n = list.querySelectorAll('.finrow').length; if (!n) list.append(el('p', 'sub', 'Everything here is dismissed.')); notify('Dismissed. It returns if the ticket changes.', 'info'); });
      act.append(sg, ds); row.append(top, why, act, box); sec.append(row);
    });
    list.append(sec);
  });
  dg.addEventListener('click', async () => {
    const m = masker(); dg.disabled = true; sum.hidden = false; sum.textContent = ''; sum.append(el('p', 'sub', 'Reading your inbox...'));
    try {
      const data = await c.ai({ mode: 'digest', items: digestItems(items, m.mask), lang: 'en' });
      sum.textContent = ''; sum.append(el('h3', '', 'Today in short'), el('p', '', m.unmask((data && data.summary) || 'Nothing to add.')));
      const ord = ((data && data.order) || []).filter(k => items.some(x => x.key === k));
      if (ord.length) { const ol = el('ol'); ord.slice(0, 8).forEach(k => { const x = items.find(y => y.key === k), li = el('li'); const b = el('button', 'flink', k); b.type = 'button'; b.addEventListener('click', () => c.open(x.id)); li.append(b, document.createTextNode(' ' + x.t)); ol.append(li); }); sum.append(el('p', 'sub', 'Suggested order:'), ol); }
    } catch (e) { sum.textContent = ''; sum.append(el('p', 'rerr', c.aiWhy ? await c.aiWhy(e) : String(e.message || e))); }
    dg.disabled = false;
  });
  function kind(it) { return kindOf(it.kind); }
}
