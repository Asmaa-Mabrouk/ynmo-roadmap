// Export the important tables to JSON files, as a stop-gap until Supabase backups are on (Pro plan).
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/export-backup.mjs [--out backups] [--tables a,b]
// The key is read from the environment only: never put it in a file, the repo or a chat. Run it on your own computer or any private machine.
// Output: <out>/<UTC date-time>/<table>.json (rows exactly as stored: [{id, data}] or the table's own columns) + manifest.json (row counts).
// The backups/ folder is git-ignored; keep the files somewhere private (they contain your team's data).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const TABLES = ['items', 'people', 'roadmaps', 'ideas', 'vacations', 'daysoff', 'activity', 'baselines', 'share_links', 'sprints', 'sprint_items', 'reports',
  'flow_issues', 'flow_cfg', 'flow_comments', 'flow_logs', 'flow_files', 'profiles', 'permissions'];
const PAGE = 1000;

/** Read every row of one table (pages of 1000). Returns {rows} or {missing:true} when the table does not exist, {error} otherwise. */
export async function readTable(base, key, table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const r = await fetch(base.replace(/\/+$/, '') + '/rest/v1/' + encodeURIComponent(table) + '?select=*', { headers: { apikey: key, Authorization: 'Bearer ' + key, Range: from + '-' + (from + PAGE - 1), 'Range-Unit': 'items' } });
    if (r.status === 404 || r.status === 400) { const t = await r.text(); if (/PGRST205|does not exist|schema cache/.test(t)) return { missing: true }; return { error: 'HTTP ' + r.status }; }
    if (!r.ok && r.status !== 206) return { error: 'HTTP ' + r.status };
    const part = await r.json(); rows.push(...part); if (part.length < PAGE) break;
  }
  return { rows };
}
export async function run(env, argv, log) {
  const base = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) { log('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (not in a file).'); return 2; }
  const arg = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : ''; };
  const tables = arg('--tables') ? arg('--tables').split(',').map(x => x.trim()).filter(Boolean) : TABLES;
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19), dir = join(arg('--out') || 'backups', stamp);
  mkdirSync(dir, { recursive: true });
  const manifest = { at: new Date().toISOString(), project: base.replace(/^https?:\/\//, '').split('.')[0], tables: {} };
  let failed = 0;
  for (const t of tables) {
    const r = await readTable(base, key, t);
    if (r.missing) { manifest.tables[t] = { missing: true }; log(t + ': not in the database (skipped)'); continue; }
    if (r.error) { manifest.tables[t] = { error: r.error }; failed++; log(t + ': FAILED ' + r.error); continue; }
    writeFileSync(join(dir, t + '.json'), JSON.stringify(r.rows)); manifest.tables[t] = { rows: r.rows.length }; log(t + ': ' + r.rows.length + ' rows');
  }
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  log((failed ? 'Finished with ' + failed + ' failed table(s). ' : 'Done. ') + 'Files are in ' + dir);
  return failed ? 1 : 0;
}
if (process.argv[1] && process.argv[1].endsWith('export-backup.mjs')) process.exit(await run(process.env, process.argv.slice(2), m => console.log(m)));
