import assert from 'assert';
import { ciiWriter1BOdEligibility } from '../tabs/cii-workspace/cii-workspace-writer1b-od.js';

function context(diameters, sizeTransition = new Set(diameters).size > 1) {
  return Object.freeze({ diameters: Object.freeze(diameters), sizeTransition });
}
function edge(diameter, fromDiameters, toDiameters, reducer = 0) {
  return Object.freeze({
    componentKind: 'PIPE', diameter,
    auxiliaryPointers: Object.freeze({ reducer }),
    fromContext: context(fromDiameters), toContext: context(toDiameters),
  });
}

const isolated = ciiWriter1BOdEligibility(edge(168.3, [168.3], [168.3]), edge(114.3, [114.3], [114.3]));
assert.deepStrictEqual(isolated, [], 'terminal-to-terminal plain PIPE OD change is topology closed');

const openRun = ciiWriter1BOdEligibility(
  edge(168.3, [168.3, 168.3], [168.3, 168.3]),
  edge(114.3, [114.3, 114.3], [114.3, 114.3]),
);
assert(openRun.includes('OD_TARGET_FROM_RUN_NOT_CLOSED'));
assert(openRun.includes('OD_TARGET_TO_RUN_NOT_CLOSED'));

const closesExistingMismatch = ciiWriter1BOdEligibility(
  edge(168.3, [168.3, 168.3], [168.3, 168.3]),
  edge(114.3, [114.3, 168.3], [114.3, 168.3]),
);
assert.deepStrictEqual(closesExistingMismatch, [], 'single-field OD write may remove an existing mismatch when adjacent TARGET edges already equal proposed OD');

const sourceTransition = ciiWriter1BOdEligibility(
  edge(168.3, [168.3, 114.3], [168.3], 0),
  edge(114.3, [114.3, 168.3], [114.3], 0),
);
assert(sourceTransition.includes('OD_SOURCE_SIZE_TRANSITION_NOT_SINGLE_FIELD_SAFE'));

const reducer = ciiWriter1BOdEligibility(edge(168.3, [168.3], [168.3], 0), edge(114.3, [114.3], [114.3], 4));
assert(reducer.includes('OD_TARGET_REDUCER_POINTER_PRESENT'));

console.log('CII Writer 1B topology-closed OD eligibility checks passed.');
