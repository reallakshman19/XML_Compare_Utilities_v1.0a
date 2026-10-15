import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, 'tabs/sequential-sketcher/scoped-edit', name), 'utf8');
const panel = read('sequential-split-pipe-request-panel.js');
const feature = read('sequential-split-pipe-request-feature.js');
const impact = read('sequential-split-pipe-impact-preview.js');
const operations = read('sequential-component-edit-operations.js');
const index = read('sequential-scoped-edit-index.js');

for (const text of ['Split request preview', 'Structural impact only',
  'data-ssk-split-pipe-request-component', 'data-ssk-split-pipe-request-part',
  'data-ssk-split-pipe-request-edge', 'data-ssk-split-pipe-request-branch',
  'Create impact preview', 'Nothing was published']) assert.ok(panel.includes(text), text);
assert.ok(feature.includes('createSequentialEditableTopologySnapshot(state.readModel())'));
assert.ok(feature.includes('createSequentialSplitPipeImpact(topology, input)'));
assert.ok(feature.includes("invalidate: (reason) => clear(state, reason || 'owner-authority-change')"));
assert.ok(impact.includes("candidateNativeOperation: 'SPLIT_PIPE'"));
assert.ok(impact.includes("currentNativeSplitAuthority: 'BOUNDED_ADAPTER_UNQUALIFIED'"));
assert.ok(impact.includes("publicationState: 'NOT_PUBLISHED'"));
assert.ok(operations.includes('createSequentialSplitPipeRequestFeature'));
assert.ok(operations.includes('state.splitPreview.setActive(state.active)'));
assert.ok(operations.includes('state.splitPreview.clear(reason)'));
assert.ok(operations.includes('state.splitPreview.destroy()'));
assert.ok(operations.includes('getSplitPreview: state.splitPreview.getPreview'));
assert.ok(index.includes("export * from './sequential-split-pipe-impact-preview.js';"));
assert.ok(index.includes("export * from './sequential-split-pipe-request-panel.js';"));
assert.ok(index.includes("export * from './sequential-split-pipe-request-feature.js';"));
for (const forbidden of ['appendStructural', 'publishSplit', 'applySplitPipe',
  'structural-topology-journal', 'geometry-edit-journal']) {
  assert.equal([panel, feature, impact].some((text) => text.includes(forbidden)), false, forbidden);
}
console.log('sequential SPLIT_PIPE request UI tests: PASS');
