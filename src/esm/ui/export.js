/**
 * @module ui/export
 * CSV export of the current roadmap.
 * Escapes cells safely (csvCell) and downloads the file.
 * Dependencies are explicit ES imports; shared mutable state lives in `S` (core/state.js).
 */
import { LANES, STATUS, byOrd, dl, iso, items } from '../core/model.js';
import { slug } from '../core/shared.js';
import { curRm } from '../pages/roadmaps.js';

/* ---------- export ---------- */
export function csvCell(v) { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
export async function exportCsv() {
  if (!dl) return;
  const head = ['Squad', 'Feature', 'Resources', 'Status', 'Start', 'End', 'Notes'];
  const lines = [head.map(csvCell).join(',')];
  LANES.forEach(l => items().filter(i => i.sq === l.k).sort(byOrd).forEach(it => {
    lines.push([l.n, it.t, it.res.join('; '), STATUS[it.st], iso(it.d0), iso(it.d1), it.n || ''].map(csvCell).join(','));
  }));
  try { await dl.save({ filename: 'ynmo-' + slug(curRm().n) + '-roadmap.csv', data: '﻿' + lines.join('\n') }); } catch (e) { /* declined or unavailable: nothing to do */ }
}

/* ---------- setup ---------- */

