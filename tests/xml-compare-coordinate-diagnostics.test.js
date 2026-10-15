import assert from 'node:assert/strict';

import {
  groupConflictsByNode,
  groupUnresolvedElementsByLine,
  normalizeCoordinateDiagnostic,
  summarizeCoordinateDiagnostics,
} from '../xml-compare/XmlCompareCoordinateDiagnostics.js';

const diagnostics = [
  { code: 'coordinate_conflict', message: 'Conflict', details: { node: '10', distance: 4 } },
  { code: 'coordinate_multiple_origins', message: 'Multiple origins', details: { node: '1' } },
  { code: 'coordinate_disconnected_graph', message: 'Disconnected', details: { node: '99' } },
];

assert.equal(normalizeCoordinateDiagnostic(diagnostics[0]).severity, 'ERROR');
assert.equal(groupConflictsByNode(diagnostics)[0].node, '10');

const unresolved = groupUnresolvedElementsByLine([
  { lineNo: 'L2', fromNode: '3', toNode: '4', status: 'UNRESOLVED' },
  { lineNo: 'L1', fromNode: '1', toNode: '2', status: 'UNRESOLVED' },
], diagnostics);
assert.deepEqual(unresolved.map((row) => row.lineNo), ['L1', 'L2']);

const summary = summarizeCoordinateDiagnostics(diagnostics, {
  originCount: 2,
  solvedNodeCount: 3,
  solvedElementCount: 1,
  unresolvedElementCount: 1,
  toleranceMm: 1,
});
assert.equal(summary.conflictCount, 1);
assert.equal(summary.disconnectedGraphCount, 1);
assert.equal(summary.multipleOriginCount, 1);
assert.equal(summary.maxConflictDistance, 4);
assert.equal(summary.toleranceMm, 1);

console.log('XML Compare coordinate diagnostics tests passed');
