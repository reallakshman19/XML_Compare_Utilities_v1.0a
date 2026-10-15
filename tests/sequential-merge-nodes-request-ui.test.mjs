import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../tabs/sequential-sketcher/scoped-edit/', import.meta.url);
const impact = await readFile(new URL('sequential-merge-nodes-impact-preview.js', root), 'utf8');
const panel = await readFile(new URL('sequential-merge-nodes-request-panel.js', root), 'utf8');
const feature = await readFile(new URL('sequential-merge-nodes-request-feature.js', root), 'utf8');
const operations = await readFile(new URL('sequential-component-edit-operations.js', root), 'utf8');
const index = await readFile(new URL('sequential-scoped-edit-index.js', root), 'utf8');

assert.match(panel, /Merge request preview/);
assert.match(panel, /Sequential source node ID/);
assert.match(panel, /Sequential retained target node ID/);
assert.match(panel, /Create impact preview/);
assert.match(feature, /createSequentialEditableTopologySnapshot/);
assert.match(feature, /createSequentialMergeNodesImpact/);
assert.match(feature, /invalidate:/);
assert.match(operations, /createSequentialMergeNodesRequestFeature/);
assert.match(operations, /mergePreview\.setActive\(state\.active\)/);
assert.match(operations, /mergePreview\.clear\(reason\)/);
assert.match(operations, /getMergePreview/);
assert.match(index, /sequential-merge-nodes-impact-preview\.js/);
assert.match(index, /sequential-merge-nodes-request-panel\.js/);
assert.match(index, /sequential-merge-nodes-request-feature\.js/);

for (const source of [impact, panel, feature]) {
  assert.doesNotMatch(source, /publishCandidate|\.accept\(|append.*Journal|apply.*Journal/);
  assert.doesNotMatch(source, /export\s+default/);
}
assert.ok(impact.split('\n').length < 300);
assert.ok(panel.split('\n').length < 300);
assert.ok(feature.split('\n').length < 300);
assert.ok(operations.split('\n').length < 300);

console.log('[PASS] visible merge impact panel, authority invalidation and no publication path');
