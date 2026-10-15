import assert from 'node:assert/strict';
import {
  PIPELINE_CAD_SNAP_ACQUISITION_SCHEMA,
  PIPELINE_CAD_SNAP_CANDIDATE_SCHEMA,
  createPipelineCadSnapAcquisition,
  createPipelineCadSnapCandidate,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-object-snap-contracts.js';

const candidate = createPipelineCadSnapCandidate({
  graph: 'table2x', mode: 'endpoint', id: 'endpoint:a', sourceIds: ['a'],
  worldPoint: { x: 1, y: 2 }, screenPoint: { x: 10, y: 20 }, screenDistance: 3,
  lockedAxes: { x: true, y: true }, label: 'Endpoint',
});
assert.equal(candidate.schema, PIPELINE_CAD_SNAP_CANDIDATE_SCHEMA);
assert.ok(Object.isFrozen(candidate));
assert.ok(Object.isFrozen(candidate.worldPoint));
assert.ok(Object.isFrozen(candidate.sourceIds));
assert.throws(() => { candidate.worldPoint.x = 9; }, TypeError);

const acquisition = createPipelineCadSnapAcquisition({
  rawScreenPoint: { x: 13, y: 20 }, rawWorldPoint: { x: 1.3, y: 2 }, aperture: 12,
  candidate, acquiredWorldPoint: candidate.worldPoint, lockedAxes: candidate.lockedAxes,
  evidence: { considered: 2, inAperture: 1, winnerId: candidate.id, order: [candidate.id] },
});
assert.equal(acquisition.schema, PIPELINE_CAD_SNAP_ACQUISITION_SCHEMA);
assert.ok(Object.isFrozen(acquisition));
assert.ok(Object.isFrozen(acquisition.evidence.order));
assert.throws(() => createPipelineCadSnapCandidate({ graph: 'bad' }), TypeError);
assert.throws(() => createPipelineCadSnapAcquisition({ rawScreenPoint: {}, rawWorldPoint: {}, aperture: 0 }), TypeError);
console.log('Pipeline CAD Object Snap contract tests passed');
