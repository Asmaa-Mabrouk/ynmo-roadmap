// Ops scripts: backup export (against a local fake REST server), migration mirror, function fingerprint.
import http from 'node:http';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { run } from '../scripts/export-backup.mjs';
import { fingerprint } from '../scripts/fn-fingerprint.mjs';
let bad = 0; const ok = (n, c) => { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) bad++; };
const KEY = 'secret-service-key-123', seen = [];
const srv = http.createServer((req, res) => {
  seen.push({ url: req.url, auth: req.headers.authorization, range: req.headers.range });
  const t = /\/rest\/v1\/([^?]+)/.exec(req.url)[1];
  if (req.headers.authorization !== 'Bearer ' + KEY) { res.statusCode = 401; return res.end('{}'); }
  if (t === 'items') { const m = /(\d+)-(\d+)/.exec(req.headers.range), a = +m[1], b = Math.min(+m[2], 1499); const rows = []; for (let i = a; i <= b; i++) rows.push({ id: 'i' + i, data: { n: i } }); res.statusCode = 206; return res.end(JSON.stringify(rows)); }
  if (t === 'flow_logs') { res.statusCode = 404; return res.end('{"code":"PGRST205","message":"Could not find the table in the schema cache"}'); }
  if (t === 'people') { res.statusCode = 500; return res.end('boom'); }
  res.end('[]');
});
await new Promise(r => srv.listen(0, r)); const base = 'http://127.0.0.1:' + srv.address().port;
const out = mkdtempSync(join(tmpdir(), 'bk-')), logs = [];
const code = await run({ SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: KEY }, ['--out', out, '--tables', 'items,flow_logs,people,flow_issues'], m => logs.push(m));
const dir = join(out, readdirSync(out)[0]), man = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
ok('exit code 1 because one table failed', code === 1);
ok('paged read: all 1500 rows of items, read in 2 requests', JSON.parse(readFileSync(join(dir, 'items.json'), 'utf8')).length === 1500 && seen.filter(s => s.url.includes('/items')).length === 2);
ok('a table that does not exist is skipped, not a failure', man.tables.flow_logs.missing === true && !existsSync(join(dir, 'flow_logs.json')));
ok('a failing table is reported and the others still exported', man.tables.people.error === 'HTTP 500' && man.tables.flow_issues.rows === 0 && existsSync(join(dir, 'flow_issues.json')));
ok('the key is only sent as a header and never printed', !logs.join('\n').includes(KEY) && !JSON.stringify(man).includes(KEY) && seen.every(s => !s.url.includes(KEY)));
ok('without the environment it refuses and says what to set', await run({}, [], m => logs.push(m)) === 2 && logs.some(l => /SUPABASE_SERVICE_ROLE_KEY/.test(l)));
srv.close();
const mig = spawnSync('node', ['scripts/sync-migrations.mjs', '--check'], { encoding: 'utf8' });
ok('migrations mirror is in sync with supabase/sql', mig.status === 0 && /ALL OK/.test(mig.stdout));
const f = fingerprint('flow-ai');
ok('fingerprint of flow-ai: bytes, lines, sha256', f.bytes > 5000 && f.lines > 50 && /^[0-9a-f]{64}$/.test(f.sha256));
const sql11 = readFileSync('supabase/sql/11-flow-ai-usage.sql', 'utf8'), fn = readFileSync('supabase/functions/flow-ai/index.ts', 'utf8');
ok('flow-ai writes the usage table SQL 11 creates, and answers 401/403/429/502', /flow_ai_usage/.test(sql11) && /from\("flow_ai_usage"\)/.test(fn) && ['401', '403', '429', '502'].every(c => fn.includes(', ' + c + ')')));
console.log(bad ? 'FAILED ' + bad : 'ALL OK'); process.exit(bad ? 1 : 0);
