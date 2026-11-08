/**
 * @module features/flow-thread
 * Ynmo Flow ticket window, activity part: Attachments, then tabs Comments (with @mention) and Work log. Screen code only; the rules are in flow-activity.js.
 * ctx = {edit, me, names, canDeleteAny, today, comments(), logs(), files(), oe(),
 *        addComment(text), saveComment(id, text), delComment(id), addLog({time, day, t}), delLog(id), addFiles(FileList) -> Promise<string>, delFile(id), openFile(f) -> Promise<string>}
 * Every action that can fail throws an Error whose message is shown to the person.
 */
import { el } from '../core/model.js';
import { ago } from '../core/shared.js';
import { notify } from '../ui/notify.js';
import { canChangeComment, fmtSize, timeSummary } from './flow-activity.js';
import { fmtDuration } from './flow-time.js';

const say = (m, k) => notify(m, k || 'info');
const btn = (txt, cls, fn, attrs) => { const b = el('button', cls || 'btn', txt); b.type = 'button'; Object.assign(b.dataset, attrs || {}); b.addEventListener('click', fn); return b; };

/** Attachments: list, add (button or drop), open, remove. */
export function filesPanel(ctx) {
  const box = el('section', 'fattach'); box.id = 'fi-files';
  const paint = () => {
    box.textContent = ''; const files = ctx.files();
    const hd = el('div', 'fathd'); hd.append(el('h3', '', 'Attachments (' + files.length + ')'));
    if (ctx.edit) {
      const inp = el('input'); inp.type = 'file'; inp.multiple = true; inp.id = 'fi-file'; inp.hidden = true;
      inp.addEventListener('change', async () => { const fl = [...inp.files]; inp.value = ''; if (!fl.length) return; try { const m = await ctx.addFiles(fl); if (m) say(m); } catch (e) { say(e.message, 'err'); } });
      hd.append(inp, btn('Add files', 'btn', () => inp.click(), { act: 'attach' }));
    }
    box.append(hd);
    if (!files.length) box.append(el('p', 'sub', ctx.edit ? 'Drop files here or press Add files. Up to 10 MB each.' : 'No files.'));
    const ul = el('div', 'fatlist');
    files.forEach(f => {
      const r = el('div', 'fatrow'); r.dataset.id = f.id;
      const a = btn(f.name, 'flink', async () => { try { const u = await ctx.openFile(f); window.open(u, '_blank', 'noopener'); } catch (e) { say(e.message, 'err'); } }); a.title = 'Open';
      r.append(a, el('span', 'sub', fmtSize(f.size) + ' · ' + (f.by || '') + ' · ' + ago(f.at)));
      if (ctx.edit && (f.by === ctx.me || ctx.canDeleteAny)) r.append(btn('Remove', 'btn', () => { ctx.delFile(f.id); }, { act: 'rmfile' }));
      ul.append(r);
    });
    box.append(ul);
  };
  if (ctx.edit) { box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('over'); }); box.addEventListener('dragleave', () => box.classList.remove('over')); box.addEventListener('drop', async e => { e.preventDefault(); box.classList.remove('over'); const fl = [...(e.dataTransfer.files || [])]; if (!fl.length) return; try { const m = await ctx.addFiles(fl); if (m) say(m); } catch (x) { say(x.message, 'err'); } }); }
  box.repaint = paint; paint(); return box;
}

/** Tabs: Comments and Work log. */
export function activityPanel(ctx) {
  const box = el('section', 'fthread'); box.id = 'fi-thread'; const st = { tab: 'comments', draft: '', editing: '', ltime: '', lnote: '', lday: ctx.today };
  const paint = () => {
    box.textContent = ''; const cm = ctx.comments(), lg = ctx.logs();
    const tabs = el('div', 'ftabs'); tabs.setAttribute('role', 'tablist');
    [['comments', 'Comments (' + cm.length + ')'], ['log', 'Work log (' + lg.length + ')']].forEach(([id, n]) => { const t = btn(n, 'ftab', () => { st.tab = id; paint(); }, { tab: id }); t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', st.tab === id ? 'true' : 'false'); tabs.append(t); });
    box.append(tabs);
    if (st.tab === 'comments') commentsTab(); else logTab();
    function commentsTab() {
      const list = el('div', 'fcmlist');
      if (!cm.length) list.append(el('p', 'sub', 'No comments yet.'));
      cm.forEach(c => {
        const r = el('div', 'fcm'); r.dataset.id = c.id;
        const hd = el('div', 'fcmhd'); hd.append(el('b', '', c.by || 'Someone'), el('span', 'sub', ago(c.at) + (c.ed ? ' · edited' : '')));
        r.append(hd);
        if (st.editing === c.id) {
          const ta = el('textarea'); ta.rows = 3; ta.value = c.t; ta.className = 'fcmedit';
          const err = el('p', 'rerr'); err.hidden = true;
          r.append(ta, err, btn('Save', 'btn primary', () => { try { ctx.saveComment(c.id, ta.value); st.editing = ''; paint(); } catch (e) { err.textContent = e.message; err.hidden = false; } }, { act: 'savecm' }), btn('Cancel', 'btn', () => { st.editing = ''; paint(); }));
        } else {
          const p = el('p', 'fcmtext'); p.textContent = c.t; r.append(p);
          if ((c.men || []).length) r.append(el('p', 'sub', 'Mentioned: ' + c.men.join(', ')));
          if (ctx.edit) { const row = el('div', 'row');
            if (canChangeComment(c, ctx.me, ctx.canDeleteAny, false)) row.append(btn('Edit', 'btn', () => { st.editing = c.id; paint(); }, { act: 'editcm' }));
            if (canChangeComment(c, ctx.me, ctx.canDeleteAny, true)) row.append(btn('Delete', 'btn', () => ctx.delComment(c.id), { act: 'delcm' }));
            r.append(row); }
        }
        list.append(r);
      });
      box.append(list);
      if (ctx.edit) {
        const ta = el('textarea'); ta.id = 'fi-cm'; ta.rows = 3; ta.placeholder = 'Add a comment. Use @ to mention a teammate.'; ta.value = st.draft; ta.addEventListener('input', () => { st.draft = ta.value; });
        const men = el('select'); men.id = 'fi-mention'; men.setAttribute('aria-label', 'Mention someone');
        const o0 = el('option', '', '@ Mention'); o0.value = ''; men.append(o0); ctx.names.filter(n => n && n !== ctx.me).forEach(n => { const o = el('option', '', n); o.value = n; men.append(o); });
        men.addEventListener('change', () => { if (!men.value) return; const at = ta.selectionStart == null ? ta.value.length : ta.selectionStart; ta.value = ta.value.slice(0, at) + (at && !/\s$/.test(ta.value.slice(0, at)) ? ' ' : '') + '@' + men.value + ' ' + ta.value.slice(at); st.draft = ta.value; men.value = ''; ta.focus(); });
        const err = el('p', 'rerr'); err.hidden = true; err.id = 'fi-cm-err';
        const send = btn('Comment', 'btn primary', () => { try { ctx.addComment(ta.value); st.draft = ''; paint(); } catch (e) { err.textContent = e.message; err.hidden = false; } }, { act: 'addcm' }); send.id = 'fi-cm-send';
        const row = el('div', 'row'); row.append(men, send); box.append(ta, err, row);
      }
    }
    function logTab() {
      const sum = timeSummary(ctx.oe(), lg), info = el('div', 'ftime');
      info.append(el('span', '', 'Estimated ' + (sum.oe ? fmtDuration(sum.oe) : 'not set')), el('span', '', 'Logged ' + fmtDuration(sum.logged)), el('span', sum.over ? 'fover' : '', sum.remaining == null ? 'Remaining n/a' : sum.over ? 'Over by ' + fmtDuration(sum.logged - sum.oe) : 'Remaining ' + fmtDuration(sum.remaining)));
      box.append(info);
      if (sum.pct != null) { const b = el('div', 'fbar'), i = el('i'); i.style.width = sum.pct + '%'; if (sum.over) i.style.background = '#d64545'; b.append(i); box.append(b); }
      if (ctx.edit) {
        const t = el('input'); t.type = 'text'; t.id = 'fi-log-time'; t.placeholder = 'Time spent, e.g. 2h 30m'; t.setAttribute('aria-label', 'Time spent'); t.value = st.ltime; t.addEventListener('input', () => { st.ltime = t.value; });
        const d = el('input'); d.type = 'date'; d.id = 'fi-log-day'; d.value = st.lday; d.setAttribute('aria-label', 'Day'); d.addEventListener('input', () => { st.lday = d.value; });
        const n = el('input'); n.type = 'text'; n.id = 'fi-log-note'; n.placeholder = 'What did you do? (optional)'; n.value = st.lnote; n.addEventListener('input', () => { st.lnote = n.value; });
        const err = el('p', 'rerr'); err.hidden = true; err.id = 'fi-log-err';
        const add = btn('Log work', 'btn primary', () => { try { ctx.addLog({ time: t.value, day: d.value, t: n.value }); st.ltime = ''; st.lnote = ''; paint(); } catch (e) { err.textContent = e.message; err.hidden = false; } }, { act: 'addlog' }); add.id = 'fi-log-add';
        const row = el('div', 'row flogform'); row.append(t, d, n, add); box.append(row, err);
      }
      const list = el('div', 'fcmlist'); if (!lg.length) list.append(el('p', 'sub', 'No work logged yet.'));
      lg.forEach(l => { const r = el('div', 'fcm flog'); r.dataset.id = l.id; r.append(el('b', '', fmtDuration(l.min)), el('span', 'sub', ' ' + (l.by || '') + ' · ' + l.day + (l.t ? ' · ' + l.t : ''))); if (ctx.edit && (l.by === ctx.me || ctx.canDeleteAny)) r.append(btn('Delete', 'btn', () => ctx.delLog(l.id), { act: 'dellog' })); list.append(r); });
      box.append(list);
    }
  };
  box.repaint = paint; paint(); return box;
}
