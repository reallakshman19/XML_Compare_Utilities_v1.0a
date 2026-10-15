import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../tabs/sequential-sketcher/scoped-edit/', import.meta.url);
const impact = await readFile(new URL('sequential-bridge-gap-impact-preview.js', root), 'utf8');
const panel = await readFile(new URL('sequential-bridge-gap-request-panel.js', root), 'utf8');
const feature = await readFile(new URL('sequential-bridge-gap-request-feature.js', root), 'utf8');
const operations = await readFile(new URL('sequential-component-edit-operations.js', root), 'utf8');
const index = await readFile(new URL('sequential-scoped-edit-index.js', root), 'utf8');

assert.match(panel, /Bridge request preview/);
assert.match(panel, /Sequential from node ID/);
assert.match(panel, /Sequential from port ID/);
assert.match(panel, /Sequential to node ID/);
assert.match(panel, /Sequential to port ID/);
assert.match(panel, /Create impact preview/);
assert.match(panel, /'right:12px'/);
assert.match(feature, /createSequentialEditableTopologySnapshot/);
assert.match(feature, /createSequentialBridgeGapImpact/);
assert.match(feature, /invalidate:/);
assert.match(operations, /createSequentialBridgeGapRequestFeature/);
assert.match(operations, /bridgePreview\.setActive\(state\.active\)/);
assert.match(operations, /bridgePreview\.clear\(reason\)/);
assert.match(operations, /getBridgePreview/);
assert.match(index, /sequential-bridge-gap-impact-preview\.js/);
assert.match(index, /sequential-bridge-gap-request-panel\.js/);
assert.match(index, /sequential-bridge-gap-request-feature\.js/);

for (const source of [impact, panel, feature]) {
  assert.doesNotMatch(source, /publishCandidate|\.accept\(|append.*Journal|apply.*Journal/);
  assert.doesNotMatch(source, /createSequentialNativeCommand|MANUAL_CONNECT.*commandType/);
  assert.doesNotMatch(source, /export\s+default/);
}
assert.ok(impact.split('\n').length < 300);
assert.ok(panel.split('\n').length < 300);
assert.ok(feature.split('\n').length < 300);
assert.ok(operations.split('\n').length < 300);

console.log('[PASS] visible bridge impact panel, authority invalidation and no publication path');
