import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../tabs/sequential-sketcher/scoped-edit/', import.meta.url);
const impact = await readFile(new URL('sequential-add-straight-impact-preview.js', root), 'utf8');
const panel = await readFile(new URL('sequential-add-straight-request-panel.js', root), 'utf8');
const feature = await readFile(new URL('sequential-add-straight-request-feature.js', root), 'utf8');
const operations = await readFile(new URL('sequential-component-edit-operations.js', root), 'utf8');
const index = await readFile(new URL('sequential-scoped-edit-index.js', root), 'utf8');

assert.match(panel, /Add straight request preview/);
assert.match(panel, /Sequential start node ID/);
assert.match(panel, /Sequential start port ID/);
assert.match(panel, /New component canonical type/);
assert.match(panel, /Target branch ID/);
assert.match(panel, /Create impact preview/);
assert.match(panel, /top:72px/);
assert.match(feature, /createSequentialEditableTopologySnapshot/);
assert.match(feature, /createSequentialAddStraightImpact/);
assert.match(feature, /invalidate:/);
assert.match(operations, /createSequentialAddStraightRequestFeature/);
assert.match(operations, /addStraightPreview\.setActive\(state\.active\)/);
assert.match(operations, /addStraightPreview\.clear\(reason\)/);
assert.match(operations, /getAddStraightPreview/);
assert.match(index, /sequential-add-straight-impact-preview\.js/);
assert.match(index, /sequential-add-straight-request-panel\.js/);
assert.match(index, /sequential-add-straight-request-feature\.js/);

for (const source of [impact, panel, feature]) {
  assert.doesNotMatch(source, /sequential-construction-engine|commitPlacedComponent|publishCandidate/);
  assert.doesNotMatch(source, /\.accept\(|append.*Journal|apply.*Journal|create.*Command/);
  assert.doesNotMatch(source, /export\s+default/);
}
for (const source of [impact, panel, feature, operations]) assert.ok(source.split('\n').length < 300);

console.log('[PASS] visible add-straight impact panel, invalidation and no construction publication path');
