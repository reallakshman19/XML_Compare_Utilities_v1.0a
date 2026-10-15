import assert from 'node:assert/strict';
import {
  createEngineeringCommandResult,
  createEngineeringEditIntent,
  createEngineeringRevisionToken,
} from '../core/engineering-scene/index.js';
import {
  createEngineeringSvgCommandGateway,
  engineeringRevisionTokensEqual,
} from '../core/engineering-svg/edit-runtime.js';

const revisionA = createEngineeringRevisionToken({ geometry: 1, properties: 2 });
const equivalentA = createEngineeringRevisionToken({ properties: 2, geometry: 1 });
const revisionB = createEngineeringRevisionToken({ geometry: 2, properties: 3 });
assert.equal(engineeringRevisionTokensEqual(revisionA, equivalentA), true);
assert.equal(engineeringRevisionTokensEqual(revisionA, revisionB), false);

function intent(operationId, changes, baseRevision = revisionA) {
  return createEngineeringEditIntent({
    operationId,
    baseRevision,
    entityIds: ['entity-1'],
    changes,
    source: { interaction: 'typed', surfaceId: 'synthetic' },
  });
}

let currentRevision = revisionA;
let domainCalls = 0;
const gateway = createEngineeringSvgCommandGateway({
  getCurrentRevision: () => currentRevision,
  execute: async (value) => {
    domainCalls += 1;
    return createEngineeringCommandResult({
      operationId: value.operationId,
      status: 'committed',
      resultingRevision: revisionB,
      commandReason: 'synthetic-edit',
    });
  },
});

const geometryResult = await gateway.execute(intent('geometry-1', {
  geometry: { requested: { x: 1, y: 2, z: 3 } },
}));
const propertyResult = await gateway.execute(intent('property-1', {
  properties: { designPressure: 12.5 },
}));
const combinedResult = await gateway.execute(intent('combined-1', {
  geometry: { requested: { x: 2, y: 3, z: 4 } },
  properties: { designPressure: 13 },
}));
assert.equal(geometryResult.status, 'committed');
assert.equal(propertyResult.status, 'committed');
assert.equal(combinedResult.status, 'committed');
assert.equal(domainCalls, 3, 'one gateway must execute all edit categories');

currentRevision = revisionB;
const stale = await gateway.execute(intent('stale-1', { properties: { designPressure: 14 } }, revisionA));
assert.equal(stale.status, 'rejected');
assert.equal(stale.code, 'STALE_BASE_REVISION');
assert.equal(domainCalls, 3, 'stale edits must not reach the domain');

let release;
const deferred = new Promise((resolve) => { release = resolve; });
const duplicateGateway = createEngineeringSvgCommandGateway({
  getCurrentRevision: () => revisionA,
  execute: async (value) => {
    await deferred;
    return createEngineeringCommandResult({
      operationId: value.operationId,
      status: 'committed',
      resultingRevision: revisionB,
    });
  },
});
const duplicateIntent = intent('duplicate-1', { geometry: { requested: { x: 5 } } });
const firstExecution = duplicateGateway.execute(duplicateIntent);
await Promise.resolve();
const duplicate = await duplicateGateway.execute(duplicateIntent);
assert.equal(duplicate.code, 'DUPLICATE_OPERATION_ID');
release();
assert.equal((await firstExecution).status, 'committed');
assert.equal(duplicateGateway.inFlightCount(), 0);

const badGateway = createEngineeringSvgCommandGateway({
  getCurrentRevision: () => revisionA,
  execute: async () => createEngineeringCommandResult({
    operationId: 'wrong-operation',
    status: 'committed',
    resultingRevision: revisionB,
  }),
});
await assert.rejects(() => badGateway.execute(intent('expected-operation', { geometry: { requested: { x: 1 } } })), /does not match/);

console.log('engineering SVG edit command gateway: ok');
