/**
 * @module features/undo-router
 * One Ctrl+Z / Cmd+Z (redo: Shift+Z or Y) handler for the whole app. Each page registers its own undo, and only the page you are on reacts,
 * so an undo on Reports can never touch the roadmap. Inputs, text areas and selects keep the browser's own undo.
 */
import { state, $ } from '../core/model.js';

const handlers = {};
/** @param {string} page page key @param {{undo:Function, redo?:Function, ready?:()=>boolean, inEditable?:boolean}} h `inEditable`: also run while a contenteditable line has focus. */
export function registerUndo(page, h) { handlers[page] = h; }

document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.defaultPrevented) return;
  const k = e.key.toLowerCase(); if (k !== 'z' && k !== 'y') return;
  const h = handlers[state.page]; if (!h || $('xdlg')) return;
  const t = e.target; if (t && t.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  if (t && t.isContentEditable && !h.inEditable) return;
  const redo = k === 'y' || e.shiftKey; if (redo && !h.redo) return;
  if (h.ready && !h.ready()) return;
  e.preventDefault(); if (redo) h.redo(); else h.undo();
}, true);
