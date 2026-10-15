import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'core/engineering-svg/engineering-svg-feedback-scene.js',
  'core/engineering-svg/engineering-svg-interaction-session.js',
  'core/engineering-svg/interaction-runtime.js',
];

for (const name of files) {
  const source = readFileSync(join(repositoryRoot, name), 'utf8');
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines <= 300, `${name} exceeds 300 lines (${lines})`);
  assert.doesNotMatch(source, /from\s+['"][^'"]*tabs\//, `${name} imports from tabs/`);
  assert.doesNotMatch(source, /export\s+default\b/, `${name} uses a default export`);
  assert.doesNotMatch(source, /\b(Pipeline|Topology|Sequential|Categorizer|XML Builder|station|marker|support-restraint|support-carrier)\b/i, `${name} leaks adopter semantics`);
  assert.doesNotMatch(source, /\b(Canvas|WebGL|ReactDOM|React|THREE|localStorage|sessionStorage)\b/, `${name} leaks a forbidden runtime or storage owner`);
  assert.doesNotMatch(source, /toFixed|Math\.(round|floor|ceil|trunc)|parseInt/, `${name} rounds interaction geometry`);
  assert.doesNotMatch(source, /document\.|window\.|innerHTML|body\.addEventListener/, `${name} introduces global DOM ownership`);
  assert.doesNotMatch(source, /new\s+CommandHistory|undoStack|redoStack/, `${name} introduces a second history`);
  assert.doesNotMatch(source, /submitPropertyEdit|saveConfigValues/, `${name} introduces a second property mutation path`);
}

const sessionSource = readFileSync(join(repositoryRoot, 'core/engineering-svg/engineering-svg-interaction-session.js'), 'utf8');
const previewBody = sessionSource.slice(sessionSource.indexOf('async function preview'), sessionSource.indexOf('async function commit'));
assert.doesNotMatch(previewBody, /editCoordinator\.commit|commandGateway|\.execute\s*\(/, 'pointer preview must not execute a command');

console.log('engineering SVG interaction dependency guards: ok');
