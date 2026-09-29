#!/usr/bin/env node
/**
 * Build script: assembles the deployable single-file `index.html`.
 *
 *   node build.mjs          -> writes ./index.html
 *   node build.mjs --check  -> exits 1 if ./index.html is out of date
 *
 * The app ships as ONE html file on purpose (esbuild is a build-time tool only; no runtime deps beyond
 * the vendored supabase-js). Sources live in `src/`:
 *   src/index.template.html  page shell with {{STYLES}} and {{SCRIPTS}} slots
 *   src/css/*.css            concatenated in filename order (base -> brand -> skin -> features)
 *   src/esm/main.js          ES-module entry; esbuild bundles it (imports are explicit, see docs/ARCHITECTURE.md)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const CSS_ORDER = ['base', 'brand', 'skin', 'features'];

/** Read every file of `dir` matching `ext` and return the concatenated text. */
const concat = (dir, files) => files.map(f => readFileSync(join(root, dir, f), 'utf8')).join('');

const css = concat('src/css', CSS_ORDER.map(n => `${n}.css`));
// ES modules -> one classic IIFE (works from file://, no module CORS, keeps the single-file deploy).
const js = buildSync({
  entryPoints: [join(root, 'src/esm/main.js')], bundle: true, write: false, format: 'iife',
  target: 'es2020', charset: 'utf8', legalComments: 'none', logLevel: 'warning',
}).outputFiles[0].text;
const html = readFileSync(join(root, 'src/index.template.html'), 'utf8')
  .replace('{{STYLES}}', () => css)
  .replace('{{SCRIPTS}}', () => js);

const out = join(root, 'index.html');
if (process.argv.includes('--check')) {
  const same = readFileSync(out, 'utf8') === html;
  console.log(same ? 'index.html is up to date' : 'index.html is STALE - run: node build.mjs');
  process.exit(same ? 0 : 1);
}
writeFileSync(out, html);
console.log(`index.html written (${html.length} bytes, ${js.split('\n').length} JS lines)`);
