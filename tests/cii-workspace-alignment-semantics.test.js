import assert from 'assert';
import { deriveCiiAlignmentCorrespondence } from '../tabs/cii-workspace/cii-workspace-alignment.js';

function edge(id, from, to, fromDegree = 2, toDegree = 2) {
  return {
    elementId: id,
    routeFrom: from,
    routeTo: to,
    componentKind: 'PIPE',
    lengthMm: 1000,
    diameter: 273,
    wall: 8,
    pathStationMidMm: 500,
    pathTotalLengthMm: 2000,
    fromContext: { degree: fromDegree },
    toContext: { degree: toDegree },
  };
}

const s1 = edge('S1', '100', '150', 1, 2);
const s2 = edge('S2', '150', '200', 2, 1);
const t1 = edge('T1', '5000', '5010', 1, 2);
const t2 = edge('T2', '5010', '5020', 2, 1);
const matched = deriveCiiAlignmentCorrespondence({ operations: [
  { op: 'MATCH', refEdge: s1, targetEdge: t1 },
  { op: 'MATCH', refEdge: s2, targetEdge: t2 },
] });
assert.strictEqual(matched.elementRows.length, 2);
assert(matched.elementRows.every((row) => row.status === 'HIGH'));
assert.strictEqual(matched.elementRows[0].evidence.components.length, 14);
assert.deepStrictEqual(
  { source: matched.nodeRows[0].sourceNodeId, target: matched.nodeRows[0].targetNodeId, status: matched.nodeRows[0].status },
  { source: '150', target: '5010', status: 'HIGH' },
);

const withGaps = deriveCiiAlignmentCorrespondence({ operations: [
  { op: 'DELETE_REFERENCE', refEdge: s1 },
  { op: 'INSERT_TARGET', targetEdge: t1 },
] });
assert.strictEqual(withGaps.elementRows[0].status, 'DELETED');
assert.strictEqual(withGaps.elementRows[1].status, 'INSERTED');
assert.strictEqual(withGaps.nodeRows.length, 0);

const incompatible = deriveCiiAlignmentCorrespondence({ operations: [
  { op: 'MATCH', refEdge: edge('SB', '1', '2', 2, 3), targetEdge: edge('TP', '7', '8', 2, 2) },
] });
assert.strictEqual(incompatible.elementRows[0].status, 'CONFLICT');
assert(incompatible.elementRows[0].evidence.blockers.includes('BRANCH_TOPOLOGY_INCOMPATIBLE'));

console.log('CII Workspace alignment correspondence checks passed.');
