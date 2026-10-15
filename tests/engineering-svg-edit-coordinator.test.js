import assert from 'node:assert/strict';
import {
  createEngineeringCommandResult,
  createEngineeringEditIntent,
  createEngineeringPropertySet,
  createEngineeringRevisionToken,
} from '../core/engineering-scene/index.js';
import {
  createEngineeringSvgCommandGateway,
  createEngineeringSvgDraftStore,
  createEngineeringSvgEditCoordinator,
  createEngineeringSvgPropertyProvider,
} from '../core/engineering-svg/edit-runtime.js';

const revisionA = createEngineeringRevisionToken({ geometry: 1, properties: 1 });
const revisionB = createEngineeringRevisionToken({ geometry: 2, properties: 2 });
const editableSet = createEngineeringPropertySet({
  id: 'editable-properties',
  revision: revisionA,
  ownerIds: ['entity-1'],
  fields: [{ key: 'pressure', label: 'Pressure', type: 'number', value: 10, min: 0, max: 100 }],
});
const readonlySet = createEngineeringPropertySet({
  id: 'readonly-properties',
  revision: revisionA,
  ownerIds: ['entity-1'],
  fields: [{ key: 'material', label: 'Material', type: 'text', scope: 'REFERENCE', value: 'A106' }],
});
let currentRevision = revisionA;
let domainCalls = 0;
const gateway = createEngineeringSvgCommandGateway({
  getCurrentRevision: () => currentRevision,
  execute: async (intent) => {
    domainCalls += 1;
    currentRevision = revisionB;
    return createEngineeringCommandResult({
      operationId: intent.operationId,
      status: 'committed',
      resultingRevision: revisionB,
      commandReason: 'synthetic-domain-commit',
    });
  },
});
const provider = createEngineeringSvgPropertyProvider({
  getPropertySets: async () => [editableSet, readonlySet],
});
const draftStore = createEngineeringSvgDraftStore();
const coordinator = createEngineeringSvgEditCoordinator({ commandGateway: gateway, propertyProvider: provider, draftStore });
const authoritative = Object.freeze({ geometry: Object.freeze({ x: 0, y: 0, z: 0 }), pressure: 10 });

coordinator.begin({ operationId: 'commit-1', baseRevision: revisionA });
coordinator.stageGeometry('entity-1', { original: authoritative.geometry, draft: { x: 0, y: 0, z: 25 } });
coordinator.stageProperty('entity-1', 'pressure', { original: authoritative.pressure, draft: 15 });
const activeDraft = coordinator.getDraft();
assert.equal(activeDraft.geometry['entity-1'].draft.z, 25);
assert.equal(activeDraft.properties['entity-1'].pressure.draft, 15);
assert.deepEqual(authoritative, { geometry: { x: 0, y: 0, z: 0 }, pressure: 10 });
assert.deepEqual(JSON.parse(JSON.stringify(activeDraft)), activeDraft);

const committed = await coordinator.commit(createEngineeringEditIntent({
  operationId: 'commit-1',
  baseRevision: revisionA,
  entityIds: ['entity-1'],
  changes: {
    geometry: { requested: { x: 0, y: 0, z: 25 } },
    properties: { pressure: 15 },
  },
  source: { interaction: 'typed' },
}));
assert.equal(committed.status, 'committed');
assert.equal(domainCalls, 1);
assert.equal(coordinator.getDraft().operationId, null, 'successful commit must clear draft state');

coordinator.begin({ operationId: 'stale-1', baseRevision: revisionA });
coordinator.stageProperty('entity-1', 'pressure', { original: 10, draft: 16 });
const stale = await coordinator.commit(createEngineeringEditIntent({
  operationId: 'stale-1',
  baseRevision: revisionA,
  entityIds: ['entity-1'],
  changes: { properties: { pressure: 16 } },
  source: { interaction: 'property-inspector' },
}));
assert.equal(stale.code, 'STALE_BASE_REVISION');
assert.equal(domainCalls, 1, 'stale command must not execute domain mutation');
assert.equal(coordinator.getDraft().operationId, null, 'defined rejection must clear draft state');

currentRevision = revisionA;
coordinator.begin({ operationId: 'invalid-1', baseRevision: revisionA });
coordinator.stageProperty('entity-1', 'material', { original: 'A106', draft: 'B31' });
await assert.rejects(() => coordinator.commit(createEngineeringEditIntent({
  operationId: 'invalid-1',
  baseRevision: revisionA,
  entityIds: ['entity-1'],
  changes: { properties: { material: 'B31' } },
  source: { interaction: 'property-inspector' },
})), /read-only/);
assert.equal(domainCalls, 1, 'preflight failure must not reach the domain');
assert.equal(coordinator.getDraft().operationId, 'invalid-1', 'preflight failure retains draft for correction');
coordinator.cancel('user-cancel');
assert.equal(coordinator.getDraft().operationId, null);

const isolatedA = createEngineeringSvgDraftStore();
const isolatedB = createEngineeringSvgDraftStore();
isolatedA.begin({ operationId: 'isolated', baseRevision: revisionA });
isolatedA.stageProperty('entity-1', 'pressure', { original: 10, draft: 11 });
assert.equal(isolatedB.getSnapshot().operationId, null);
assert.equal(isolatedB.getSnapshot().properties['entity-1'], undefined);

console.log('engineering SVG edit coordinator: ok');
