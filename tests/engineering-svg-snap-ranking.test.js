import assert from 'node:assert/strict';
import {
  createEngineeringGeometryConstraint,
  createEngineeringSnapCandidate,
} from '../core/engineering-scene/index.js';
import { rankEngineeringSvgSnapCandidates } from '../core/engineering-svg/snap-runtime.js';

function candidate(input = {}) {
  return createEngineeringSnapCandidate({
    id: input.id,
    providerId: input.providerId || 'provider-a',
    mode: input.mode || 'endpoint',
    sourceEntityIds: input.sourceEntityIds || [input.id],
    worldPoint: input.worldPoint || { x: 0, y: 0, z: 0 },
    screenPoint: input.screenPoint || { x: 0, y: 0 },
    screenDistance: input.screenDistance ?? 0,
    priority: input.priority ?? 0,
    lockedAxes: input.lockedAxes || { x: true },
    compatibleConstraintKinds: input.compatibleConstraintKinds || [],
    compatibleReferenceIds: input.compatibleReferenceIds || [],
  });
}

const priorityWinner = candidate({ id: 'priority', priority: 0, screenDistance: 10, screenPoint: { x: 10, y: 0 } });
const distanceLoser = candidate({ id: 'distance', priority: 1, screenDistance: 1, screenPoint: { x: 1, y: 0 } });
let ranked = rankEngineeringSvgSnapCandidates([distanceLoser, priorityWinner], {
  aperture: 12,
  constraint: createEngineeringGeometryConstraint({ kind: 'axis', axis: 'X' }),
});
assert.equal(ranked.candidate.id, 'priority', 'priority must win before screen distance');
assert.deepEqual(ranked.evidence.orderedIds, ['priority', 'distance']);

const near = candidate({ id: 'near', priority: 2, screenDistance: 2, screenPoint: { x: 2, y: 0 } });
const far = candidate({ id: 'far', priority: 2, screenDistance: 4, screenPoint: { x: 4, y: 0 } });
ranked = rankEngineeringSvgSnapCandidates([far, near], {
  aperture: 12,
  constraint: { kind: 'axis', axis: 'X' },
});
assert.equal(ranked.candidate.id, 'near');

const lexicalB = candidate({ id: 'b', providerId: 'provider-b', mode: 'midpoint', priority: 3, screenDistance: 3, screenPoint: { x: 3, y: 0 } });
const lexicalA = candidate({ id: 'a', providerId: 'provider-a', mode: 'midpoint', priority: 3, screenDistance: 3, screenPoint: { x: 3, y: 1 } });
ranked = rankEngineeringSvgSnapCandidates([lexicalB, lexicalA], {
  aperture: 12,
  constraint: { kind: 'axis', axis: 'X' },
});
assert.deepEqual(ranked.evidence.orderedIds, ['a', 'b']);

const duplicatePrimary = candidate({
  id: 'duplicate-primary', priority: 0, screenDistance: 1,
  screenPoint: { x: 10, y: 10 }, worldPoint: { x: 1, y: 2, z: 3 },
});
const duplicateNear = candidate({
  id: 'duplicate-near', providerId: 'provider-b', priority: 1, screenDistance: 1.1,
  screenPoint: { x: 10.0004, y: 9.9997 }, worldPoint: { x: 1.0003, y: 2, z: 3 },
});
const differentLocks = candidate({
  id: 'different-locks', providerId: 'provider-c', priority: 2, screenDistance: 1.2,
  screenPoint: { x: 10, y: 10 }, worldPoint: { x: 1, y: 2, z: 3 }, lockedAxes: { y: true },
});
ranked = rankEngineeringSvgSnapCandidates([differentLocks, duplicateNear, duplicatePrimary], {
  aperture: 12,
  constraint: { kind: 'plane', axes: ['X', 'Y'] },
  screenTolerance: 0.001,
  worldTolerance: 0.001,
});
assert.deepEqual(ranked.evidence.orderedIds, ['duplicate-primary', 'different-locks']);
assert.equal(ranked.evidence.deduplicated, 1);

const shuffled = rankEngineeringSvgSnapCandidates([duplicatePrimary, differentLocks, duplicateNear], {
  aperture: 12,
  constraint: { kind: 'plane', axes: ['X', 'Y'] },
  screenTolerance: 0.001,
  worldTolerance: 0.001,
});
assert.equal(JSON.stringify(shuffled), JSON.stringify(ranked), 'candidate input order must not affect ranked output');

const excluded = candidate({ id: 'excluded', sourceEntityIds: ['moving-1'], screenDistance: 0 });
const disabled = candidate({ id: 'disabled', mode: 'midpoint', screenDistance: 0 });
ranked = rankEngineeringSvgSnapCandidates([excluded, disabled], {
  aperture: 12,
  enabledModes: ['endpoint'],
  excludeSourceEntityIds: ['moving-1'],
  constraint: { kind: 'axis', axis: 'X' },
});
assert.equal(ranked.candidate, null);
assert.equal(ranked.evidence.compatible, 0);

const locksY = candidate({ id: 'locks-y', lockedAxes: { y: true } });
const locksXY = candidate({ id: 'locks-xy', lockedAxes: { x: true, y: true } });
assert.equal(rankEngineeringSvgSnapCandidates([locksY], {
  aperture: 12, constraint: { kind: 'axis', axis: 'X' },
}).candidate, null);
assert.equal(rankEngineeringSvgSnapCandidates([locksXY], {
  aperture: 12, constraint: { kind: 'plane', axes: ['X', 'Y'] },
}).candidate.id, 'locks-xy');
assert.equal(rankEngineeringSvgSnapCandidates([candidate({ id: 'locks-z', lockedAxes: { z: true } })], {
  aperture: 12, constraint: { kind: 'plane', axes: ['X', 'Y'] },
}).candidate, null);

const implicitPath = candidate({ id: 'implicit-path', mode: 'projection' });
const explicitPath = candidate({
  id: 'explicit-path', mode: 'projection',
  compatibleConstraintKinds: ['path'], compatibleReferenceIds: ['route-1'],
});
ranked = rankEngineeringSvgSnapCandidates([implicitPath, explicitPath], {
  aperture: 12,
  constraint: { kind: 'path', referenceId: 'route-1' },
});
assert.equal(ranked.candidate.id, 'explicit-path');
assert.equal(rankEngineeringSvgSnapCandidates([explicitPath], {
  aperture: 12,
  constraint: { kind: 'path', referenceId: 'route-2' },
}).candidate, null);

console.log('engineering SVG snap ranking: ok');
