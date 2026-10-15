// Static GitHub Pages smoke test: the workbench must be servable as static
// files — relative imports only, no Node/filesystem APIs, no absolute local
// paths, no DOM shims, and the app shell must actually register the tab.
import assert from 'assert';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wbRoot = path.join(root, 'workbench3d');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = walk(wbRoot);
assert.ok(files.length >= 10, `workbench modules present (found ${files.length})`);

const FORBIDDEN = [
  [/from\s+['"](fs|path|url|os|child_process|node:[^'"]*)['"]/, 'Node built-in import'],
  [/require\s*\(/, 'CommonJS require'],
  [/[A-Z]:\\|file:\/\/\//, 'absolute local path'],
  [/localStorage\s*\.\s*setItem\s*\(\s*['"]?(?!wb3d)/, 'unnamespaced localStorage write'],
  [/document\.write/, 'document.write'],
  [/globalThis\.DOMParser\s*=/, 'DOMParser shim'],
  [/new\s+DOMParser\s*\(/, 'DOMParser usage (workbench must use simple-xml)'],
  [/process\.env/, 'process.env dependency'],
];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const rel = path.relative(root, file).replace(/\\/g, '/');
  for (const [pattern, label] of FORBIDDEN) {
    assert.ok(!pattern.test(text), `${rel}: forbidden pattern — ${label}`);
  }
  // every relative import must stay relative (./ or ../) or be the allowlisted
  // three.js importmap key / CDN fallback
  const importSpecs = [...text.matchAll(/import\s*(?:[\w${}\s,*]+from\s*)?['"]([^'"]+)['"]/g)].map((m) => m[1]);
  for (const spec of importSpecs) {
    const allowed = spec.startsWith('./') || spec.startsWith('../') || spec === 'three' || spec.startsWith('https://esm.sh/three@');
    assert.ok(allowed, `${rel}: non-static import specifier "${spec}"`);
  }
}

// index.html wires the workbench stylesheet and the three importmap key.
const indexHtml = readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(indexHtml.includes('workbench3d/ui/workbench3d-tab.css'), 'index.html links workbench CSS');
assert.ok(/"three"\s*:\s*"https:\/\/esm\.sh\/three@/.test(indexHtml), 'importmap provides three');

// app runtime registers the tab with a relative dynamic import.
const runtime = readFileSync(path.join(root, 'core', 'app-standalone-runtime.js'), 'utf8');
assert.ok(/id:\s*'workbench-3d'/.test(runtime), 'workbench-3d tab registered');
assert.ok(/import\('\.\.\/workbench3d\/ui\/workbench3d-tab\.js[^']*'\)/.test(runtime), 'tab loaded via relative dynamic import');

console.log('workbench3d-static-smoke.test.js passed');
console.log(`  scanned ${files.length} module(s) for static-hosting violations`);
