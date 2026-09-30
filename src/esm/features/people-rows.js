/**
 * @module features/people-rows
 * Controls on each person row of the "by person" roadmap view.
 *  - a grip (⋮⋮) to reorder rows by drag & drop (order is shared with the whole team),
 *  - a ⋯ menu with Move up / Move down (keyboard and touch friendly) and "Remove from the chart".
 * The custom order is stored in the meta doc `ideas/peopleorder` ({cfg:true, ord:[names]}); people missing
 * from it fall back to squad order, then alphabetical, so new members simply appear where they always did.
 */
import { S } from '../core/state.js';
import { LANES, canEdit, directory, el, items } from '../core/model.js';
import { logAct, toast } from '../core/shared.js';
import { persist } from '../core/saving.js';
import { saveIdea } from '../pages/ideas.js';
import { allRoadmaps, withRm } from '../pages/roadmaps.js';
import { removePerson2 } from '../pages/resources.js';
import { render } from '../ui/gantt-render.js';
import { mi, openCtx } from '../ui/editing.js';
import { closeDlg, openDlg } from './safety.js';

/** Saved custom order of person names (may contain names that no longer exist). */
const savedOrder = () => (S.ideas.peopleorder && S.ideas.peopleorder.ord) || [];

/** Index of a person's first squad in the lane list (rows are grouped by squad by default). */
export function primaryLane(name) {
  const d = directory().get(name);
  const idx = d ? [...d.sqs].map(k => LANES.findIndex(l => l.k === k)).filter(i => i >= 0) : [];
  return idx.length ? Math.min.apply(null, idx) : 0;
}

/** Comparator for person objects ({name}) implementing: custom order, then squad, then alphabetical. */
export function comparePeople(a, b) {
  const ord = savedOrder(), ia = ord.indexOf(a.name), ib = ord.indexOf(b.name);
  if (ia >= 0 || ib >= 0) return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib) || a.name.localeCompare(b.name);
  return primaryLane(a.name) - primaryLane(b.name) || a.name.localeCompare(b.name);
}

/** Every person on the chart in display order (independent of the current filters). */
function allNamesInOrder() { return [...directory().keys()].map(name => ({ name })).sort(comparePeople).map(p => p.name); }

/**
 * Move `name` next to `target`.
 * @param {string} name person to move
 * @param {string} target person it is dropped on
 * @param {boolean} after place after (true) or before (false) the target
 */
export function movePerson(name, target, after) {
  if (!canEdit() || name === target) return;
  const list = allNamesInOrder().filter(n => n !== name), at = list.indexOf(target);
  if (at < 0) return;
  list.splice(at + (after ? 1 : 0), 0, name);
  saveIdea('peopleorder', { cfg: true, ord: list }, 'resource', 'reordered team rows (' + name + ')');
  render();
}

/** Move one step up (-1) or down (+1) in the full list. */
function step(name, delta) {
  const list = allNamesInOrder(), i = list.indexOf(name), t = list[i + delta];
  if (t) movePerson(name, t, delta > 0);
}

/** Ask for confirmation, unassign the person everywhere, then remove/hide them from the chart. */
function confirmRemove(name) {
  const assigned = [];
  allRoadmaps().forEach(r => withRm(r.id, () => items().forEach(it => { if (it.res.includes(name)) assigned.push({ rm: r.id, id: it.id }); })));
  openDlg('Remove ' + name + ' from the chart?', box => {
    box.append(el('p', 'sub', name + ' disappears from every roadmap. ' + (assigned.length
      ? assigned.length + ' feature' + (assigned.length === 1 ? ' is' : 's are') + ' assigned to them and will become unassigned (the features stay).'
      : 'No features are assigned to them.') + ' Their leave entries are kept.'));
    const go = el('button', 'btn danger', 'Remove ' + name); go.type = 'button';
    const no = el('button', 'btn', 'Cancel'); no.type = 'button'; no.addEventListener('click', closeDlg);
    go.addEventListener('click', () => {
      allRoadmaps().forEach(r => withRm(r.id, () => items().forEach(it => {
        if (!it.res.includes(name)) return;
        S.over[it.id] = Object.assign({}, S.over[it.id] || {}, { res: it.res.filter(n => n !== name) }); persist(it.id);
      })));
      removePerson2(name);   // hides/deletes the member, logs it and redraws
      closeDlg(); toast(name + ' removed from the chart.');
    });
    const row = el('div', 'formrow'); row.append(go, no); box.append(row);
  });
}

/**
 * Add the grip and ⋯ menu to a person's row header and make it a drop target.
 * @param {HTMLElement} c1 the row header cell (`.c1.pn`)
 * @param {string} name person name
 */
export function decoratePersonRow(c1, name) {
  if (!canEdit()) return;
  c1.classList.add('hasgrip');
  const grip = el('span', 'pgrip', '⋮⋮'); grip.draggable = true; grip.title = 'Drag to reorder'; grip.setAttribute('aria-label', 'Drag to reorder ' + name);
  grip.addEventListener('dragstart', e => { e.dataTransfer.setData('text/person', name); e.dataTransfer.effectAllowed = 'move'; c1.classList.add('dragging'); });
  grip.addEventListener('dragend', () => document.querySelectorAll('.pn.dragging,.pn.dropbefore,.pn.dropafter').forEach(x => x.classList.remove('dragging', 'dropbefore', 'dropafter')));
  const more = el('button', 'pmore', '⋯'); more.type = 'button'; more.title = 'Row options'; more.setAttribute('aria-label', 'Options for ' + name); more.setAttribute('aria-haspopup', 'menu');
  more.addEventListener('click', e => {
    e.stopPropagation(); const r = more.getBoundingClientRect(), list = allNamesInOrder(), i = list.indexOf(name);
    openCtx(r.right - 200, r.bottom + 4, m => {
      if (i > 0) mi(m, 'Move up', () => step(name, -1));
      if (i < list.length - 1) mi(m, 'Move down', () => step(name, 1));
      m.append(el('div', 'msep'));
      mi(m, 'Remove ' + name + ' from the chart…', () => confirmRemove(name), 'danger');
    });
  });
  const side = e => { const r = c1.getBoundingClientRect(); return e.clientY > r.top + r.height / 2; };
  c1.addEventListener('dragover', e => {
    if (![...e.dataTransfer.types].includes('text/person')) return;
    e.preventDefault(); const after = side(e);
    c1.classList.toggle('dropafter', after); c1.classList.toggle('dropbefore', !after);
  });
  c1.addEventListener('dragleave', e => { if (!c1.contains(e.relatedTarget)) c1.classList.remove('dropbefore', 'dropafter'); });
  c1.addEventListener('drop', e => {
    const who = e.dataTransfer.getData('text/person'); if (!who) return;
    e.preventDefault(); c1.classList.remove('dropbefore', 'dropafter'); movePerson(who, name, side(e));
  });
  c1.append(grip, more);
}
