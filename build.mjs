#!/usr/bin/env node
/**
 * Build script: assembles the deployable single-file `index.html`.
 *
 *   node build.mjs          -> writes ./index.html
 *   node build.mjs --check  -> exits 1 if ./index.html is out of date
 *
 * The app ships as ONE html file on purpose (no bundler, no runtime deps beyond
 * the vendored supabase-js). Sources live in `src/`:
 *   src/index.template.html  page shell with {{STYLES}} and {{SCRIPTS}} slots
 *   src/css/*.css            concatenated in filename order (base -> brand -> skin -> features)
 *   src/js/NN-*.js           concatenated in numeric order; they share ONE global scope,
 *                            so order matters (see docs/ARCHITECTURE.md).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const CSS_ORDER = ['base', 'brand', 'skin', 'features'];

/** Read every file of `dir` matching `ext` and return the concatenated text. */
const concat = (dir, files) => files.map(f => readFileSync(join(root, dir, f), 'utf8')).join('');

const css = concat('src/css', CSS_ORDER.map(n => `${n}.css`));
const js = concat('src/js', readdirSync(join(root, 'src/js')).filter(f => f.endsWith('.js')).sort());
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
