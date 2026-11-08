// Mirror supabase/sql/NN-name.sql into supabase/migrations/2026010100NN00_name.sql (the format `supabase db push` and
// `supabase db reset` read), so the database can be rebuilt from the repo alone.
//   node scripts/sync-migrations.mjs          write the mirror
//   node scripts/sync-migrations.mjs --check  fail if the mirror is missing or different (used by tests/run_all.sh)
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), src = join(root, 'supabase/sql'), dst = join(root, 'supabase/migrations');
const check = process.argv.includes('--check');
const files = readdirSync(src).filter(f => /^\d\d-.+\.sql$/.test(f)).sort();
if (!check) mkdirSync(dst, { recursive: true });
let bad = 0;
for (const f of files) {
  const [, nn, name] = /^(\d\d)-(.+)\.sql$/.exec(f), out = join(dst, '2026010100' + nn + '00_' + name.replace(/-/g, '_') + '.sql'), body = readFileSync(join(src, f), 'utf8');
  if (check) { if (!existsSync(out) || readFileSync(out, 'utf8') !== body) { console.log('FAIL migration out of date: ' + f); bad++; } }
  else writeFileSync(out, body);
}
if (check) { console.log(bad ? 'FAILED ' + bad : 'ALL OK ' + files.length + ' migrations in sync'); process.exit(bad ? 1 : 0); }
console.log('wrote ' + files.length + ' migrations to supabase/migrations');
