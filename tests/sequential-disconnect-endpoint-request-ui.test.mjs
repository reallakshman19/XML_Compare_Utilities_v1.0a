import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../tabs/sequential-sketcher/scoped-edit/', import.meta.url);
const panel = await readFile(new URL('sequential-disconnect-endpoint-request-panel.js', root), 'utf8');
const feature = await readFile(new URL('sequential-disconnect-endpoint-request-feature.js', root), 'utf8');
const impact = await readFile(new URL('sequential-disconnect-endpoint-impact-preview.js', root), 'utf8');
const owner = await readFile(new URL('sequential-component-edit-operations.js', root), 'utf8');
const index = await readFile(new URL('sequential-scoped-edit-index.js', root), 'utf8');

for (const token of [
  'Disconnect request preview',
  'data-ssk-disconnect-request-file',
  'data-ssk-disconnect-request-kind',
  'data-ssk-disconnect-request-relationship',
  'data-ssk-disconnect-request-node',
  'data-ssk-disconnect-request-port',
  'Create impact preview',
  'Nothing was published',
]) assert.ok(panel.includes(token), `panel missing ${token}`);
assert.ok(panel.includes("'left:12px', 'top:72px'"));
assert.ok(feature.includes('createSequentialEditableTopologySnapshot(state.readModel())'));
assert.ok(feature.includes("invalidate: (reason) => clear(state, reason || 'owner-authority-change')"));
assert.ok(owner.includes("import { createSequentialDisconnectEndpointRequestFeature }"));
assert.ok(owner.includes('state.disconnectPreview.setActive(state.active)'));
assert.ok(owner.includes('state.disconnectPreview.clear(reason)'));
assert.ok(owner.includes('state.disconnectPreview.destroy()'));
assert.ok(owner.includes('getDisconnectPreview: state.disconnectPreview.getPreview'));
assert.ok(index.includes("export * from './sequential-disconnect-endpoint-impact-preview.js';"));
assert.ok(index.includes("export * from './sequential-disconnect-endpoint-request-panel.js';"));
assert.ok(index.includes("export * from './sequential-disconnect-endpoint-request-feature.js';"));
for (const source of [impact, panel, feature]) {
  assert.doesNotMatch(source, /appendTopology|appendSequential|applySequential|geometryEditBoundary|commandService|journal\.append|execute\s*\(/);
}
assert.ok(impact.includes("currentNativeDisconnectAuthority: 'UNAVAILABLE'"));
assert.ok(impact.includes("publicationState: 'NOT_PUBLISHED'"));
assert.ok(impact.includes("candidateNativeOperation: null"));
console.log('[PASS] visible disconnect preview, authority invalidation and no publication path');
