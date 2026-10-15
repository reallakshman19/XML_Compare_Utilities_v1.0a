import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const name = 'tabs/sequential-sketcher/sequential-engineering-svg-shadow-workspace.js';
const source = readFileSync(join(root, name), 'utf8');
const lines = source.split(/\r?\n/).length;
const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);

assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
assert.deepEqual(imports.sort(), [
  '../../core/engineering-svg/engineering-svg-adapter-bridge.js',
  '../../core/engineering-svg/shell-runtime.js',
  './sequential-engineering-svg-adapter.js',
  './sequential-engineering-svg-parity-validation.js',
].sort());
assert.doesNotMatch(source, /sequential-(construction-engine|construction-runtime|supervised-decision|connection-resolver|tolerance-policy)/);
assert.doesNotMatch(source, /sequential-(construction-svg|sketcher-projection|sketcher-workspace|sketcher-tab)/);
assert.doesNotMatch(source, /\b(document|window|globalThis|localStorage|sessionStorage)\b/);
assert.doesNotMatch(source, /\b(THREE|WebGL|React|commandGateway|draftStore|snapProvider|editRuntime)\b/);
assert.doesNotMatch(source, /Math\.(round|floor|ceil|trunc)|toFixed|Date\.now|Math\.random/);
assert.match(source, /createSequentialEngineeringSvgAdapter/);
assert.match(source, /createEngineeringSvgAdapterBridge/);
assert.match(source, /createEngineeringSvgWorkspaceShellFromAdapterBridge/);
assert.match(source, /validateSequentialEngineeringSvgShadowParity/);
assert.match(source, /if \(destroyed\) return false/);

function javascriptFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? javascriptFiles(path) : (path.endsWith('.js') ? [path] : []);
  });
}

for (const file of javascriptFiles(join(root, 'core'))) {
  const value = readFileSync(file, 'utf8');
  assert.doesNotMatch(
    value,
    /sequential-engineering-svg-shadow-workspace/,
    `Shared core imports Sequential shadow module: ${relative(root, file)}`,
  );
}

for (const file of [
  'tabs/sequential-sketcher/canvas/sequential-construction-svg.js',
  'tabs/sequential-sketcher/sequential-sketcher-projection.js',
]) {
  const value = readFileSync(join(root, file), 'utf8');
  assert.doesNotMatch(value, /sequential-engineering-svg-shadow-workspace/);
}

console.log('Sequential engineering SVG shadow dependency guards: ok');
