import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'core/engineering-svg/engineering-svg-property-inspector-view.js',
  'core/engineering-svg/engineering-svg-workspace-shell.js',
  'core/engineering-svg/shell-runtime.js',
  'core/engineering-svg/engineering-svg-renderer.js',
  'core/engineering-svg/engineering-svg-workspace.js',
];

for (const name of files) {
  const source = readFileSync(join(root, name), 'utf8');
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
  assert.doesNotMatch(source, /from\s+['"][^'"]*tabs\//, `${name} imports from tabs/`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /\b(Pipeline|Topology|Sequential|Categorizer|XML Builder|station|marker|support-restraint|support-carrier)\b/i, `${name} leaks adopter semantics`);
  assert.doesNotMatch(source, /\b(Canvas|WebGL|ReactDOM|React|THREE|localStorage|sessionStorage)\b/, `${name} leaks a forbidden runtime or storage owner`);
  assert.doesNotMatch(source, /innerHTML/, `${name} uses innerHTML for live shell rendering`);
  assert.doesNotMatch(source, /document\.addEventListener|document\.body|window\.addEventListener/, `${name} owns global DOM listeners`);
  assert.doesNotMatch(source, /submitPropertyEdit|saveConfigValues|new\s+CommandHistory/, `${name} introduces a second mutation or history path`);
}

const shellSource = readFileSync(join(root, 'core/engineering-svg/engineering-svg-workspace-shell.js'), 'utf8');
assert.doesNotMatch(shellSource, /commandGateway\.execute\s*\(/, 'shell must commit only through the edit coordinator');
assert.match(shellSource, /type:\s*'SET_PROPERTIES'/, 'shell must use the unified property intent type');

console.log('engineering SVG shell dependency guards: ok');
