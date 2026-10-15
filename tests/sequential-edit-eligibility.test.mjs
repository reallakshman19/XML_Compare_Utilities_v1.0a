import assert from 'node:assert/strict';
import {
  createSequentialEditEligibility,
  inheritSequentialEditEligibility,
  SEQUENTIAL_EDIT_CAPABILITIES,
  SEQUENTIAL_EDIT_ELIGIBILITY_SCHEMA,
  SEQUENTIAL_EDIT_LOCKS,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-edit-eligibility.js';

function eligibleInput(overrides = {}) {
  return {
    targetKind: 'COMPONENT',
    targetId: 'COMP-1',
    componentId: 'COMP-1',
    canonicalType: 'PIPE',
    sessionState: 'ROUTE_COMPLETE',
    geometryPartCount: 1,
    positionedPortCount: 2,
    unresolvedPortCount: 0,
    completeAncestry: true,
    repairConnectionIds: [],
    supportAttachmentCount: 1,
    evidence: { strokeId: 'STROKE-1' },
    ...overrides,
  };
}

const pipe = createSequentialEditEligibility(eligibleInput());
assert.equal(pipe.schema, SEQUENTIAL_EDIT_ELIGIBILITY_SCHEMA);
assert.equal(pipe.editable, true);
assert.deepEqual(pipe.capabilities, [
  'RIGID_MOVE_ELIGIBLE',
  'ROTATE_ELIGIBLE',
  'SPLIT_ELIGIBLE',
  'STRETCH_ELIGIBLE',
  'SUPPORT_REASSIGNMENT_ELIGIBLE',
]);
assert.deepEqual(pipe.locks, []);
assert(Object.isFrozen(pipe));
assert(Object.isFrozen(pipe.evidence));
assert.deepEqual(createSequentialEditEligibility(eligibleInput()), pipe,
  'identical authority evidence must produce identical eligibility');

const connectedPipe = createSequentialEditEligibility(eligibleInput({ rigidBoundaryCount: 2 }));
assert.equal(connectedPipe.editable, true);
assert.deepEqual(connectedPipe.capabilities, [
  'SPLIT_ELIGIBLE',
  'STRETCH_ELIGIBLE',
  'SUPPORT_REASSIGNMENT_ELIGIBLE',
]);
assert(!connectedPipe.capabilities.includes('RIGID_MOVE_ELIGIBLE'));
assert(!connectedPipe.capabilities.includes('ROTATE_ELIGIBLE'));

const repaired = createSequentialEditEligibility(eligibleInput({
  repairConnectionIds: ['CONNECTION-1'],
}));
assert.equal(repaired.editable, false);
assert.deepEqual(repaired.capabilities, []);
assert.deepEqual(repaired.locks, ['LOCKED_CANDIDATE_OR_REPAIR']);

const blocked = createSequentialEditEligibility(eligibleInput({
  sessionState: 'USER_DECISION_REQUIRED',
  geometryPartCount: 0,
  positionedPortCount: 0,
  unresolvedPortCount: 1,
  completeAncestry: false,
}));
assert.deepEqual(blocked.locks, [
  'LOCKED_ACTIVE_CONSTRUCTION_HEAD',
  'LOCKED_INSUFFICIENT_GEOMETRY',
  'LOCKED_UNRESOLVED_ANCESTRY',
]);

const part = inheritSequentialEditEligibility(pipe, {
  targetKind: 'GEOMETRY_PART',
  targetId: 'ssk:component:COMP-1',
  evidence: { role: 'primary' },
});
assert.deepEqual(part.capabilities, pipe.capabilities);
assert.deepEqual(part.locks, pipe.locks);
assert.equal(part.componentId, pipe.componentId);
assert.notEqual(part.eligibilityId, pipe.eligibilityId);

assert(SEQUENTIAL_EDIT_CAPABILITIES.includes('SPLIT_ELIGIBLE'));
assert(SEQUENTIAL_EDIT_LOCKS.includes('LOCKED_SOURCE_EVIDENCE'));
assert.throws(
  () => inheritSequentialEditEligibility({}, { targetKind: 'NODE', targetId: 'NODE-1' }),
  /Parent eligibility must use SequentialEditEligibility\.v1/,
);

console.log('Sequential edit eligibility: ok');
