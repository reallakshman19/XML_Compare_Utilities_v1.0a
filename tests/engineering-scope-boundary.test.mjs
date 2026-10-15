import assert from 'node:assert/strict';

import { createEngineeringScope } from '../core/engineering-scope/engineering-scope-contracts.js';
import { guardScopeBoundary } from '../core/engineering-scope/engineering-scope-boundary.js';

function request(boundaryPolicy) {
  return {
    schema: 'EngineeringScopeRequest.v1', kind: 'SELECTION', boundaryPolicy, elementBudget: 10,
    selection: { entityIds: ['E-1', 'E-2', 'E-3'], closureDepth: 0 },
  };
}

function scope(boundaryPolicy) {
  return createEngineeringScope({
    schema: 'EngineeringScope.v1', request: request(boundaryPolicy), kind: 'SELECTION',
    boundaryPolicy, elementBudget: 10, entityIds: ['E-1', 'E-2', 'E-3'], boundaryIds: ['B-1', 'B-2'],
    stats: { matched: 3, boundary: 2, mounted: 5, budget: 10, consumed: 5, remaining: 5 },
  });
}

for (const policy of ['FROZEN', 'GHOSTED', 'PROPAGATE']) {
  const internal = guardScopeBoundary(scope(policy), 'MOVE', ['E-2', 'E-1']);
  assert.equal(internal.allowed, true);
  assert.deepEqual(internal.escapingIds, []);
  assert.deepEqual(internal.targetIds, ['E-1', 'E-2']);
  assert.equal(Object.isFrozen(internal), true);
}
const frozen = guardScopeBoundary(scope('FROZEN'), 'MOVE', ['E-1', 'B-1', 'OUTSIDE']);
assert.equal(frozen.allowed, false);
assert.equal(frozen.reason, 'BOUNDARY_FROZEN');
assert.deepEqual(frozen.escapingIds, ['B-1', 'OUTSIDE']);
const ghosted = guardScopeBoundary(scope('GHOSTED'), 'MOVE', ['B-2']);
assert.equal(ghosted.allowed, false);
assert.equal(ghosted.reason, 'BOUNDARY_GHOSTED');
const propagated = guardScopeBoundary(scope('PROPAGATE'), 'MOVE', ['OUTSIDE', 'E-3', 'B-1']);
assert.equal(propagated.allowed, true);
assert.equal(propagated.reason, null);
assert.deepEqual(propagated.escapingIds, ['B-1', 'OUTSIDE']);
const empty = guardScopeBoundary(scope('FROZEN'), 'NOOP', []);
assert.equal(empty.allowed, true);

const frozenScope = scope('FROZEN');
const ghostedScope = scope('GHOSTED');
const propagatedScope = scope('PROPAGATE');
let frozenEscapesAllowed = 0;
let ghostedEscapesAllowed = 0;
let propagateDelta = 0;
for (let index = 0; index < 1000; index += 1) {
  const targets = [
    `E-${(index % 3) + 1}`,
    index % 2 === 0 ? `OUT-${String(index).padStart(4, '0')}` : 'B-1',
    index % 5 === 0 ? 'E-2' : 'B-2',
  ];
  const expected = [...new Set(targets.filter((id) => !frozenScope.entityIds.includes(id)))].sort();
  const frozenResult = guardScopeBoundary(frozenScope, 'CASE', targets);
  const ghostedResult = guardScopeBoundary(ghostedScope, 'CASE', targets);
  const propagateResult = guardScopeBoundary(propagatedScope, 'CASE', targets);
  if (expected.length && frozenResult.allowed) frozenEscapesAllowed += 1;
  if (expected.length && ghostedResult.allowed) ghostedEscapesAllowed += 1;
  propagateDelta += differenceCount(expected, propagateResult.escapingIds);
}
function differenceCount(expected, actual) {
  return expected.filter((id) => !actual.includes(id)).length + actual.filter((id) => !expected.includes(id)).length;
}
assert.equal(frozenEscapesAllowed, 0);
assert.equal(ghostedEscapesAllowed, 0);
assert.equal(propagateDelta, 0);
assert.doesNotThrow(() => JSON.stringify(propagated));
console.log('[PASS] boundary guard cases=1000; FROZEN=0 escapes allowed; GHOSTED=0; PROPAGATE delta=0.');
