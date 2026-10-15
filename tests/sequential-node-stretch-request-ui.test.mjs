import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../tabs/sequential-sketcher/scoped-edit/', import.meta.url);
const panel = await readFile(new URL('sequential-node-stretch-request-panel.js', root), 'utf8');
const feature = await readFile(new URL('sequential-node-stretch-feature.js', root), 'utf8');
const index = await readFile(new URL('sequential-scoped-edit-index.js', root), 'utf8');

assert.match(panel, /Import Validator move request/);
assert.match(panel, /data-ssk-node-stretch-request-file/);
assert.match(panel, /Use current stretch selection/);
assert.match(panel, /Create request preview/);
assert.match(feature, /createSequentialNodeStretchRequestPlan/);
assert.match(feature, /sequentialNodeStretchRequestPreviewInput/);
assert.match(feature, /selectComponent\(state, previewInput\.selectedObjectId\)/);
assert.match(feature, /selectNode\(state, previewInput\.sequentialNodeId\)/);
assert.match(feature, /stagePreview\(state, previewInput\.sequentialNodeId, previewInput\.stageInput\)/);
assert.doesNotMatch(feature, /applicationService\.accept\([^)]*request/i);
assert.doesNotMatch(feature, /publishCandidate\([^)]*request/i);
assert.match(index, /sequential-node-stretch-request-adapter\.js/);
assert.match(index, /sequential-node-stretch-request-panel\.js/);

console.log('[PASS] request import UI routes explicit identities to existing preview without publication');
