// Print a fingerprint of each Edge Function file in the repo, so the person who deploys can check that what is live is the same text.
//   node scripts/fn-fingerprint.mjs [name ...]      (no names = all functions)
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../supabase/functions');
export function fingerprint(name) {
  const t = readFileSync(join(dir, name, 'index.ts'), 'utf8'), lines = t.split('\n');
  return { name, bytes: Buffer.byteLength(t), lines: t.endsWith('\n') ? lines.length - 1 : lines.length, sha256: createHash('sha256').update(t).digest('hex'), first: lines[0].slice(0, 90), last: (t.endsWith('\n') ? lines[lines.length - 2] : lines[lines.length - 1]).slice(0, 90) };
}
if (process.argv[1] && process.argv[1].endsWith('fn-fingerprint.mjs')) {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir);
  names.forEach(n => { const f = fingerprint(n); console.log(f.name + ': ' + f.bytes + ' bytes, ' + f.lines + ' lines, sha256 ' + f.sha256.slice(0, 16) + '...\n  first: ' + f.first + '\n  last:  ' + f.last); });
}
