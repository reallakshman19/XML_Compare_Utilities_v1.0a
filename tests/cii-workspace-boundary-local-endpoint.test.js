import assert from 'node:assert/strict';
import { deriveCiiAlignmentCorrespondence } from '../tabs/cii-workspace/cii-workspace-alignment.js';

const IDENTITY = Object.freeze({
  status: 'READY',
  mode: 'RIGID_3D',
  rotation: Object.freeze([
    Object.freeze([1, 0, 0]),
    Object.freeze([0, 1, 0]),
    Object.freeze([0, 0, 1]),
  ]),
  translation: Object.freeze([0, 0, 0]),
});

function point(x, y = 0, z = 0) { return { x, y, z }; }
function edge(id, from, to, fromPos, toPos, options = {}) {
  const lengthMm = Math.hypot(toPos.x - fromPos.x, toPos.y - fromPos.y, toPos.z - fromPos.z);
  return {
    elementId: id,
    routeFrom: String(from),
    routeTo: String(to),
    componentKind: 'PIPE',
    lengthMm,
    diameter: options.diameter ?? 100,
    wall: 6,
    fromPos,
    toPos,
    pathStationMidMm: options.pathStationMidMm ?? 500,
    pathTotalLengthMm: options.pathTotalLengthMm ?? 2000,
    pathSequenceContext: options.pathSequenceContext ?? ['PIPE', 'PIPE', 'PIPE'],
    fromContext: { degree: options.fromDegree ?? 2, neighbourhoodLayers: [] },
    toContext: { degree: options.toDegree ?? 2, neighbourhoodLayers: [] },
  };
}
function match(refEdge, targetEdge) { return { op: 'MATCH', refEdge, targetEdge }; }
function insert(targetEdge) { return { op: 'INSERT_TARGET', targetEdge }; }
function remove(refEdge) { return { op: 'DELETE_REFERENCE', refEdge }; }
function derive(operations, options = {}) {
  return deriveCiiAlignmentCorrespondence({ operations }, { geometryTransform: IDENTITY, ...options });
}
function rowFor(result, source, target) {
  return result.nodeRows.find((row) => row.sourceNodeId === String(source) && row.targetNodeId === String(target));
}

// Existing MATCH→MATCH behavior remains intact and gains local candidate evidence.
{
  const leftS = edge('S1', 1, 2, point(-1000), point(0));
  const rightS = edge('S2', 2, 3, point(0), point(1000));
  const leftT = edge('T1', 11, 12, point(-1000), point(0));
  const rightT = edge('T2', 12, 13, point(0), point(1000));
  const result = derive([match(leftS, leftT), match(rightS, rightT)]);
  const row = rowFor(result, 2, 12);
  assert(row);
  assert.equal(row.status, 'HIGH');
  assert.equal(row.authority, 'ADJACENT_MATCH_BOUNDARY');
  assert.equal(row.evidence.boundaryIdentity.identitySupported, true);
  assert.deepEqual(row.evidence.boundaryIdentity.supportingSides, ['TO', 'FROM']);
}

// Whole left edge remains MEDIUM/REVIEW because its far endpoint is wrong,
// while the shared registered node is locally correct on both sides.
{
  const leftS = edge('S3', 20, 21, point(-1000), point(0));
  const rightS = edge('S4', 21, 22, point(0), point(1000));
  const leftT = edge('T3', 120, 121, point(-5000), point(0), { pathStationMidMm: 450 });
  const rightT = edge('T4', 121, 122, point(0), point(1000), { pathStationMidMm: 550 });
  const result = derive([match(leftS, leftT), match(rightS, rightT)]);
  const row = rowFor(result, 21, 121);
  assert(row);
  assert.equal(row.status, 'REVIEW', 'whole-edge status must remain review');
  assert.equal(row.evidence.leftElement.identityConfidence, 'MEDIUM');
  assert.equal(row.evidence.leftElement.methods.m1Spatial.pass, false);
  assert.equal(row.evidence.leftElement.methods.m2Network.pass, true);
  assert.equal(row.evidence.leftElement.methods.m1Spatial.endpointDistancesMm[1], 0);
  assert.equal(row.evidence.boundaryIdentity.identitySupported, true,
    'shared endpoint may be supported without promoting the whole edge');
}

// MATCH→INSERT_TARGET emits only a REVIEW node candidate with candidate-only evidence.
{
  const source = edge('S5', 30, 31, point(-1000), point(0));
  const matchedTarget = edge('T5', 130, 131, point(-1000), point(0));
  const insertedTarget = edge('TI1', 131, 132, point(0), point(4000));
  const result = derive([match(source, matchedTarget), insert(insertedTarget)]);
  const row = rowFor(result, 31, 131);
  assert(row);
  assert.equal(row.status, 'REVIEW');
  assert.equal(row.authority, 'ADJACENT_MATCH_BOUNDARY');
  assert.equal(row.evidence.boundaryIdentity.identitySupported, true);
  assert.equal(row.evidence.identitySupported, undefined,
    'U4.1 must not promote top-level automatic identity');
  assert.equal(result.elementRows[1].status, 'INSERTED');
}

// INSERT_TARGET→MATCH is symmetric.
{
  const insertedTarget = edge('TI2', 140, 141, point(-4000), point(0));
  const source = edge('S6', 40, 41, point(0), point(1000));
  const matchedTarget = edge('T6', 141, 142, point(0), point(1000));
  const result = derive([insert(insertedTarget), match(source, matchedTarget)]);
  const row = rowFor(result, 40, 141);
  assert(row);
  assert.equal(row.status, 'REVIEW');
  assert.equal(row.evidence.boundaryIdentity.identitySupported, true);
}

// Local endpoint outside spatial tolerance must not create insertion-boundary identity.
{
  const source = edge('S7', 50, 51, point(-1000), point(0));
  const matchedTarget = edge('T7', 150, 151, point(-1000), point(500));
  const insertedTarget = edge('TI3', 151, 152, point(500), point(4500));
  const result = derive([match(source, matchedTarget), insert(insertedTarget)]);
  assert.equal(result.nodeRows.length, 0);
}

// Reversed spatial orientation is not accepted as local path-boundary evidence.
{
  const source = edge('S8', 60, 61, point(-1000), point(0));
  const reversedTarget = edge('T8', 160, 161, point(0), point(-1000));
  const insertedTarget = edge('TI4', 161, 162, point(-1000), point(3000));
  const result = derive([match(source, reversedTarget), insert(insertedTarget)]);
  assert.equal(result.nodeRows.length, 0);
}

// M2 topology failure blocks the local boundary even when geometry matches.
{
  const source = edge('S9', 70, 71, point(-1000), point(0), { toDegree: 3 });
  const target = edge('T9', 170, 171, point(-1000), point(0), { toDegree: 2 });
  const inserted = edge('TI5', 171, 172, point(0), point(4000));
  const result = derive([match(source, target), insert(inserted)]);
  assert.equal(result.nodeRows.length, 0);
}

// OD mismatch blocks local endpoint support.
{
  const source = edge('S10', 80, 81, point(-1000), point(0), { diameter: 100 });
  const target = edge('T10', 180, 181, point(-1000), point(0), { diameter: 140 });
  const inserted = edge('TI6', 181, 182, point(0), point(4000), { diameter: 140 });
  const result = derive([match(source, target), insert(inserted)]);
  assert.equal(result.nodeRows.length, 0);
}

// Target-path discontinuity must not create a boundary row.
{
  const source = edge('S11', 90, 91, point(-1000), point(0));
  const target = edge('T11', 190, 191, point(-1000), point(0));
  const inserted = edge('TI7', 999, 192, point(0), point(4000));
  const result = derive([match(source, target), insert(inserted)]);
  assert.equal(result.nodeRows.length, 0);
}

// DELETE_REFERENCE adjacency remains outside automatic node-boundary evidence.
{
  const sourceA = edge('S12', 100, 101, point(-1000), point(0));
  const targetA = edge('T12', 200, 201, point(-1000), point(0));
  const sourceDelete = edge('SD', 101, 102, point(0), point(1000));
  const result = derive([match(sourceA, targetA), remove(sourceDelete)]);
  assert.equal(result.nodeRows.length, 0);
}

// Two supported insertion boundaries for one source node remain separate claims;
// later arbitration can conflict-veto them rather than alignment choosing by stable ID.
{
  const leftS = edge('S13', 110, 111, point(-1000), point(0));
  const leftT = edge('T13', 210, 211, point(-1000), point(0));
  const inserted = edge('TI8', 211, 212, point(0), point(50));
  const rightS = edge('S14', 111, 112, point(0), point(1000));
  const rightT = edge('T14', 212, 213, point(50), point(1050));
  const result = derive([match(leftS, leftT), insert(inserted), match(rightS, rightT)]);
  const claims = result.nodeRows.filter((row) => row.sourceNodeId === '111');
  assert.equal(claims.length, 2);
  assert.deepEqual(claims.map((row) => row.targetNodeId).sort(), ['211', '212']);
  assert(claims.every((row) => row.status === 'REVIEW'));
}

console.log('CII boundary-local endpoint alignment evidence checks: PASS');
