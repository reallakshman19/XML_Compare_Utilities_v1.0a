import assert from 'node:assert/strict';
import {
  createEngineeringSnapAcquisition,
  createEngineeringSnapCandidate,
  createEngineeringSnapEvidence,
} from '../core/engineering-scene/index.js';

const candidate = createEngineeringSnapCandidate({
  id: 'provider:endpoint:a',
  providerId: 'synthetic-provider',
  mode: 'endpoint',
  sourceEntityIds: ['a'],
  worldPoint: { x: 1, y: 2, z: 3 },
  screenPoint: { x: 10, y: 20 },
  screenDistance: 4,
  priority: 0,
  lockedAxes: { x: true, y: false, z: true },
  label: 'Endpoint',
});
assert.deepEqual(JSON.parse(JSON.stringify(candidate)), candidate);
assert.equal(candidate.lockedAxes.x, true);
assert.equal(candidate.lockedAxes.y, false);

const domainCandidate = createEngineeringSnapCandidate({
  id: 'provider:station:1',
  providerId: 'domain-provider',
  mode: 'pipeline:station',
  sourceEntityIds: ['route-1'],
  worldPoint: { x: 5, y: 0, z: 0 },
  screenPoint: { x: 5, y: 0 },
  screenDistance: 1,
  priority: 20,
  lockedAxes: { x: true, y: true, z: true },
  compatibleConstraintKinds: ['path'],
  compatibleReferenceIds: ['route-1'],
});
assert.equal(domainCandidate.mode, 'pipeline:station');

const evidence = createEngineeringSnapEvidence({
  considered: 2,
  compatible: 1,
  inAperture: 1,
  deduplicated: 0,
  winnerId: candidate.id,
  orderedIds: [candidate.id],
  providerCounts: { 'synthetic-provider': 1, 'domain-provider': 1 },
  providerErrors: [],
});
const acquisition = createEngineeringSnapAcquisition({
  rawScreenPoint: { x: 9, y: 20 },
  rawWorldPoint: { x: 0, y: 0, z: 0 },
  aperture: 12,
  candidate,
  evidence,
});
assert.deepEqual(acquisition.acquiredWorldPoint, candidate.worldPoint);
assert.deepEqual(acquisition.lockedAxes, candidate.lockedAxes);
assert.deepEqual(JSON.parse(JSON.stringify(acquisition)), acquisition);

assert.throws(() => createEngineeringSnapCandidate({
  id: 'bad', providerId: 'p', mode: 'station',
  worldPoint: { x: 0, y: 0, z: 0 }, screenPoint: { x: 0, y: 0 },
  screenDistance: 1, priority: 0, lockedAxes: { x: true },
}), /generic or namespaced/);
assert.throws(() => createEngineeringSnapCandidate({
  id: 'bad', providerId: 'p', mode: 'endpoint',
  worldPoint: { x: NaN, y: 0, z: 0 }, screenPoint: { x: 0, y: 0 },
  screenDistance: 1, priority: 0, lockedAxes: { x: true },
}), /finite/);
assert.throws(() => createEngineeringSnapCandidate({
  id: 'bad', providerId: 'p', mode: 'endpoint',
  worldPoint: { x: 0, y: 0, z: 0 }, screenPoint: { x: 0, y: 0 },
  screenDistance: -1, priority: 0, lockedAxes: { x: true },
}), /non-negative/);
assert.throws(() => createEngineeringSnapCandidate({
  id: 'bad', providerId: 'p', mode: 'endpoint',
  worldPoint: { x: 0, y: 0, z: 0 }, screenPoint: { x: 0, y: 0 },
  screenDistance: 1, priority: 0,
}), /lock at least one world axis/);
assert.throws(() => createEngineeringSnapCandidate({
  id: 'bad', providerId: 'p', mode: 'endpoint', sourceEntityIds: ['a', 'a'],
  worldPoint: { x: 0, y: 0, z: 0 }, screenPoint: { x: 0, y: 0 },
  screenDistance: 1, priority: 0, lockedAxes: { x: true },
}), /unique values/);
assert.throws(() => createEngineeringSnapAcquisition({
  rawScreenPoint: { x: 0, y: 0 }, rawWorldPoint: { x: 0, y: 0, z: 0 }, aperture: 0,
}), /positive/);
assert.throws(() => createEngineeringSnapEvidence({ considered: -1 }), /non-negative integer/);
assert.throws(() => createEngineeringSnapEvidence({ considered: 1, compatible: 2 }), /inconsistent/);

console.log('engineering SVG snap contracts: ok');
