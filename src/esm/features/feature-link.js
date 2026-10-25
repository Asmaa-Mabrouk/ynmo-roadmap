/**
 * @module features/feature-link
 * Pure logic of the link between a roadmap bar, its Monthly card and its weekly-report items ("by feature id").
 * The roadmap bar is the master for the title and the progress. Every Monthly card / report item keeps a small hidden record `lk`
 * ({t, pct}) = the values it last agreed on with the roadmap. Comparing the three values tells which way a change goes:
 *   roadmap changed, item untouched  -> "incoming": the person checks it in Monthly / the report and applies it
 *   item changed                     -> "outgoing": waits for an admin to approve before the roadmap bar changes
 */
export const LINK_FIELDS = [['t', 'Title'], ['pct', 'Progress']];
const clean = v => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v);
/** The values of a roadmap bar that are linked (progress is undefined until someone sets it on the bar). */
export const roadVals = bar => ({ t: clean(bar && bar.t), pct: bar && Number.isFinite(bar.pc) ? bar.pc : undefined });
/**
 * cur: values on the item; base: its hidden record (or null); road: values on the bar.
 * Returns { incoming:[{f,from,to}], outgoing:[{f,road,to}], rebase:{f:value} } - rebase = fields already equal, whose record is stale.
 */
export function compare(cur, base, road) {
  const incoming = [], outgoing = [], rebase = {}, b0 = base || cur;
  LINK_FIELDS.forEach(([f]) => {
    const c = clean(cur[f]), b = clean(b0[f]), r = road[f];
    if (r === undefined) { if (c !== b) outgoing.push({ f, road: undefined, to: c }); return; }
    if (c === r) { if (b !== r) rebase[f] = r; return; }
    if (c === b) incoming.push({ f, from: c, to: r }); else outgoing.push({ f, road: r, to: c });
  });
  return { incoming, outgoing, rebase };
}
export const fieldName = f => (LINK_FIELDS.find(x => x[0] === f) || [, f])[1];
export const showVal = (f, v) => (v === undefined || v === null || v === '' ? 'not set' : f === 'pct' ? v + '%' : '"' + v + '"');
