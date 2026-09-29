#!/usr/bin/env node
/**
 * Minimal architecture lint (no config, no network): fails when a module
 *  1. uses an identifier that is neither declared, imported nor a known browser global (typo / missing import), or
 *  2. imports a name the target module does not export.
 * Run: node lint.mjs   (also `npm run lint`)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';
import * as scope from 'eslint-scope';

const root = join(dirname(fileURLToPath(import.meta.url)), 'src/esm');
const GLOBALS = new Set(('window document console location localStorage sessionStorage navigator setTimeout clearTimeout setInterval ' +
  'clearInterval Date Math JSON Object Array String Number Boolean Promise Set Map Error RegExp Symbol parseInt parseFloat isNaN ' +
  'encodeURIComponent decodeURIComponent fetch URL Blob requestAnimationFrame cancelAnimationFrame alert confirm FileReader ' +
  'getComputedStyle crypto TextEncoder URLSearchParams CSS MutationObserver Intl btoa atob performance Image DOMParser ' +
  'CustomEvent Event undefined NaN Infinity matchMedia Uint8Array globalThis isFinite Reflect WeakMap WeakSet structuredClone queueMicrotask supabase').split(' '));

const walk = d => readdirSync(d).flatMap(n => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : n.endsWith('.js') ? [join(d, n)] : []);
const files = walk(root);
const parse = f => espree.parse(readFileSync(f, 'utf8'), { ecmaVersion: 2022, sourceType: 'module', range: true });
const exportsOf = new Map();
for (const f of files) {
  const names = new Set();
  for (const n of parse(f).body) if (n.type === 'ExportNamedDeclaration') {
    if (n.declaration?.id) names.add(n.declaration.id.name);
    n.declaration?.declarations?.forEach(d => names.add(d.id.name));
  }
  exportsOf.set(f, names);
}
let bad = 0;
for (const f of files) {
  const ast = parse(f);
  for (const n of ast.body) if (n.type === 'ImportDeclaration') {
    const target = resolve(dirname(f), n.source.value);
    for (const s of n.specifiers) if (s.type === 'ImportSpecifier' && !exportsOf.get(target)?.has(s.imported.name)) { console.log(`${f}: imports missing export ${s.imported.name} from ${n.source.value}`); bad++; }
  }
  for (const r of scope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' }).globalScope.through) {
    if (!GLOBALS.has(r.identifier.name)) { console.log(`${f}: undefined identifier ${r.identifier.name}`); bad++; }
  }
}
console.log(bad ? `${bad} problem(s)` : `lint ok (${files.length} modules)`);
process.exit(bad ? 1 : 0);
