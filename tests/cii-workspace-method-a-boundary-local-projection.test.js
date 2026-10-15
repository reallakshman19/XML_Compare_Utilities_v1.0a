import assert from 'node:assert/strict';
import { deriveCiiAlignmentCorrespondence } from '../tabs/cii-workspace/cii-workspace-alignment.js';
import { _test as projectionTest } from '../tabs/cii-workspace/cii-workspace-multi-base-correspondence.js';

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
function derive(operations) {
  return deriveCiiAlignmentCorrespondence({ operations }, { geometryTransform: IDENTITY });
}
function rowFor(result, source, target) {
  return result.nodeRows.find((row) => row.sourceNodeId === String(source) && row.targetNodeId === String(target));
}
function loop(confidence = 'MEDIUM') {
  return { loopId: `A-${confidence}`, baseId: `A-${confidence}`, method: 'METHOD_A_SPATIAL', confidence };
}
function project(row, confidence = 'MEDIUM') {
  return projectionTest.projectMethodABoundaryRow(row, loop(confidence));
}

// Existing HIGH/HIGH whole-edge path remains supported and is capped by the loop.
{
  const result = derive([
    match(edge('S1', 1, 2, point(-1000), point(0)), edge('T1', 11, 12, point(-1000), point(0))),
    match(edge('S2', 2, 3, point(0), point(1000)), edge('T2', 12, 13, point(0), point(1000))),
  ]);
  const raw = rowFor(result, 2, 12);
  assert(raw);
  const projected = project(raw, 'MEDIUM');
  assert.equal(projected.status, 'REVIEW');
  assert.equal(projected.authority, 'ADJACENT_MATCH_BOUNDARY');
  assert.equal(projected.evidence.identitySupported, true);
  assert.equal(projected.evidence.identityConfidence, 'MEDIUM');
  assert.equal(projected.evidence.identityEvidenceBasis, 'METHOD_A_QUALIFIED_ADJACENT_BOUNDARY');
}

// Whole-edge MEDIUM caused by a bad far endpoint no longer erases a locally correct shared node.
{
  const result = derive([
    match(
      edge('S3', 20, 21, point(-1000), point(0)),
      edge('T3', 120, 121, point(-5000), point(0), { pathStationMidMm: 450 }),
    ),
    match(
      edge('S4', 21, 22, point(0), point(1000)),
      edge('T4', 121, 122, point(0), point(1000), { pathStationMidMm: 550 }),
    ),
  ]);
  const raw = rowFor(result, 21, 121);
  assert(raw);
  assert.equal(raw.status, 'REVIEW');
  assert.equal(raw.evidence.leftElement.identityConfidence, 'MEDIUM');
  assert.equal(raw.evidence.boundaryIdentity.identitySupported, true);
  const projected = project(raw, 'HIGH');
  assert.equal(projected.status, 'REVIEW');
  assert.equal(projected.evidence.identitySupported, true);
  assert.equal(projected.evidence.identityConfidence, 'HIGH');
}

// MATCH→INSERT_TARGET raw candidate becomes qualified only through the Method-A loop.
{
  const result = derive([
    match(edge('S5', 30, 31, point(-1000), point(0)), edge('T5', 130, 131, point(-1000), point(0))),
    insert(edge('TI1', 131, 132, point(0), point(4000))),
  ]);
  const raw = rowFor(result, 31, 131);
  assert(raw);
  assert.equal(raw.status, 'REVIEW');
  assert.equal(raw.evidence.identitySupported, undefined);
  assert.equal(raw.evidence.boundaryIdentity.identitySupported, true);

  const projected = project(raw, 'MEDIUM');
  assert.equal(projected.status, 'REVIEW');
  assert.equal(projected.evidence.identitySupported, true);
  assert.equal(projected.evidence.identityConfidence, 'MEDIUM');
  assert.equal(projected.evidence.identityEvidenceBasis, 'METHOD_A_QUALIFIED_ADJACENT_BOUNDARY');
}

// INSERT_TARGET→MATCH is symmetric.
{
  const result = derive([
    insert(edge('TI2', 140, 141, point(-4000), point(0))),
    match(edge('S6', 40, 41, point(0), point(1000)), edge('T6', 141, 142, point(0), point(1000))),
  ]);
  const raw = rowFor(result, 40, 141);
  assert(raw);
  const projected = project(raw, 'MEDIUM');
  assert.equal(projected.evidence.identitySupported, true);
  assert.equal(projected.evidence.identityConfidence, 'MEDIUM');
}

// REVIEW Method-A loop cannot promote otherwise valid boundary-local evidence.
{
  const result = derive([
    match(edge('S7', 50, 51, point(-1000), point(0)), edge('T7', 150, 151, point(-1000), point(0))),
    insert(edge('TI3', 151, 152, point(0), point(4000))),
  ]);
  const raw = rowFor(result, 51, 151);
  assert(raw);
  const projected = project(raw, 'REVIEW');
  assert.equal(projected.status, 'REVIEW');
  assert.equal(projected.evidence.identitySupported, false);
  assert.equal(projected.evidence.identityConfidence, 'REVIEW');
}

// Unsupported local evidence does not create identity when whole-edge HIGH/HIGH also fails.
{
  const raw = {
    correspondenceId: 'node:generic',
    kind: 'NODE',
    sourceNodeId: 'A',
    targetNodeId: 'B',
    status: 'REVIEW',
    authority: 'ADJACENT_MATCH_BOUNDARY',
    evidence: {
      leftElement: { identitySupported: false, identityConfidence: 'MEDIUM' },
      rightElement: { identitySupported: true, identityConfidence: 'HIGH' },
      boundaryIdentity: { identitySupported: false },
    },
  };
  const projected = project(raw, 'MEDIUM');
  assert.equal(projected.evidence.identitySupported, false);
  assert.equal(projected.evidence.identityConfidence, 'REVIEW');
}

// Conflict/unresolved rows are not rewritten by projection.
for (const status of ['CONFLICT', 'UNRESOLVED']) {
  const raw = {
    correspondenceId: `node:${status}`,
    kind: 'NODE',
    sourceNodeId: 'A',
    targetNodeId: 'B',
    status,
    authority: 'ADJACENT_MATCH_BOUNDARY',
    evidence: { boundaryIdentity: { identitySupported: true } },
  };
  assert.strictEqual(project(raw, 'HIGH'), raw);
}

console.log('CII Method-A boundary-local projection checks: PASS');
