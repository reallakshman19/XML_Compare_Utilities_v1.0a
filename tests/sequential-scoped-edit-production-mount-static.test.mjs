import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL(
  '../tabs/sequential-sketcher/sequential-sketcher-tab.js',
  import.meta.url,
)), 'utf8');

assert.match(source, /createSequentialScopedEditProductionShadow/);
assert.match(source, /snapshotProvider: active\.getEngineeringSvgOwnerSnapshot/);
assert.match(source, /subscribe: active\.subscribeEngineeringSvgOwnerState/);
assert.match(source, /onSequentialScopedEditShadowDiagnostic/);
assert.match(source, /onSequentialScopedEditShadowFailure/);
assert.match(source, /scopedEditShadow\?\.destroy\(\);/);
assert.doesNotMatch(source, /beginDrag|commitDrag|publishCandidate|COMMAND_ONLY/);
assert(source.indexOf('scopedEditShadow?.destroy();') < source.indexOf('active?.destroy();'));

console.log('Sequential SSK-TS-1B production mount containment: ok');
