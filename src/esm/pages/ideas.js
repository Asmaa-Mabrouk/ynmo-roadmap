/**
 * @module pages/ideas
 * The Ideas page and drawer were removed. The `ideas` collection stays as the shared settings store: product names and colours, report settings, people order and hiding,
 * Google cfg and timeline notes are all saved here as meta docs (`cfg:true`). `saveIdea` writes one of those docs.
 */
import { S } from '../core/state.js';
import { logAct } from '../core/shared.js';
import { write } from '../core/saving.js';

export function saveIdea(id, patch, act, sum) {
  S.ideas[id] = Object.assign({}, S.ideas[id] || {}, patch); write('ideas/' + id, S.ideas[id]);
  if (act) logAct(act, sum);
}
