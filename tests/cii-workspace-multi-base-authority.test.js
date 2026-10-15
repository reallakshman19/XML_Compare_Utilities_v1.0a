import assert from 'assert';
import { extractCiiPipeRunsAtNode, qualifyCiiMethodBRunBasis } from '../tabs/cii-workspace/cii-workspace-pipe-runs.js';
import { qualifyCiiMultiBaseAuthority } from '../tabs/cii-workspace/cii-workspace-multi-base-anchor.js';

const point = (x, y, z) => ({ x, y, z });
const radians = (degrees) => degrees * Math.PI / 180;
function edge(id, from, to, dx, dy, dz, diameter = 273) {
  return { elementId: id, from: String(from), to: String(to), dx, dy, dz,
    lengthMm: Math.hypot(dx, dy, dz), componentKind: 'PIPE', diameter };
}
function graph(edges) {
  const adjacency = new Map();
  for (const item of edges) for (const node of [item.from, item.to]) {
    if (!adjacency.has(node)) adjacency.set(node, []); adjacency.get(node).push(item);
  }
  return { adjacency, nodes: [...adjacency.keys()].map((id) => ({ id, degree: adjacency.get(id).length })) };
}
function lineGraph(prefix, count, diameter = 273) {
  const edges = [];
  for (let i = 0; i < count; i += 1) edges.push(edge(`${prefix}${i}`, `${prefix}${i}`, `${prefix}${i + 1}`, 1000, 0, 0, diameter));
  return graph(edges);
}
const anchor = (sourceNodeId, targetNodeId, source, target, sourceOdMm = 273) => ({ sourceNodeId, targetNodeId, source, target, sourceOdMm });

const oneAxisSource = lineGraph('S', 20); const oneAxisTarget = lineGraph('T', 20, 88.9);
const oneAxisRuns = extractCiiPipeRunsAtNode(oneAxisSource, 'S10');
assert.strictEqual(oneAxisRuns.runCount, 1, 'opposite collinear rays must merge into one undirected run');
assert.strictEqual(oneAxisRuns.independentAxisRunCount, 1);
const b1 = qualifyCiiMethodBRunBasis(oneAxisSource, oneAxisTarget, 'S10', 'T10');
assert.strictEqual(b1.status, 'REVIEW');
assert.strictEqual(b1.reason, 'METHOD_B_TWO_AXIS_GATE_NOT_MET');
assert.strictEqual(b1.weight.geometryComplexity, 0);

const twoAxisSource = graph([
  edge('SX', 'S0', 'S1', 12000, 0, 0, 273),
  edge('SZ', 'S0', 'S2', 0, 0, 7000, 273),
]);
const twoAxisTarget = graph([
  edge('TY', 'T0', 'T1', 0, 12400, 0, 88.9),
  edge('TZ', 'T0', 'T2', 0, 0, 7000, 88.9),
]);
const b2 = qualifyCiiMethodBRunBasis(twoAxisSource, twoAxisTarget, 'S0', 'T0');
assert.strictEqual(b2.status, 'READY');
assert.strictEqual(b2.source.independentAxisRunCount, 2);
assert.strictEqual(b2.target.independentAxisRunCount, 2);
assert.strictEqual(b2.tolerancePolicy.odRefMm, 273);
assert.strictEqual(b2.tolerancePolicy.toleranceMm, 546);
assert.strictEqual(b2.weight.geometryComplexity, 24);
assert(b2.selectedBasis.mapping.maxNormalizedLengthError < 1);

const b2Tight = qualifyCiiMethodBRunBasis(twoAxisSource, twoAxisTarget, 'S0', 'T0', { odToleranceFactor: 1 });
assert.strictEqual(b2Tight.status, 'REVIEW', '400 mm run mismatch must fail when x=1 gives 273 mm tolerance');
const twoAxisTargetLargeOd = graph([
  edge('TY', 'T0', 'T1', 0, 12400, 0, 1000),
  edge('TZ', 'T0', 'T2', 0, 0, 7000, 1000),
]);
const b2TargetOd = qualifyCiiMethodBRunBasis(twoAxisSource, twoAxisTargetLargeOd, 'S0', 'T0');
assert.strictEqual(b2TargetOd.tolerancePolicy.toleranceMm, 546, 'TARGET OD must not alter Method B tolerance');

function tiltedTwoAxisTarget(angleDeg) {
  const length = 12000; const angle = radians(angleDeg);
  return graph([
    edge('TA', 'T0', 'T1', length * Math.cos(angle), 0, length * Math.sin(angle), 88.9),
    edge('TZ', 'T0', 'T2', 0, 0, 7000, 88.9),
  ]);
}
const bAngle3 = qualifyCiiMethodBRunBasis(twoAxisSource, tiltedTwoAxisTarget(3), 'S0', 'T0');
assert.strictEqual(bAngle3.status, 'READY', '3 degree mismatch over 7 m must remain inside 2x273 mm transverse tolerance');
assert(bAngle3.selectedBasis.angularDisplacementMm < 546);
const bAngle5 = qualifyCiiMethodBRunBasis(twoAxisSource, tiltedTwoAxisTarget(5), 'S0', 'T0');
assert.strictEqual(bAngle5.status, 'REVIEW', '5 degree mismatch over 7 m must exceed 2x273 mm transverse tolerance');
assert(bAngle5.compatibleBasisCount === 0);

const threeAxisSource = graph([
  edge('SX', 'S0', 'S1', 10000, 0, 0, 273), edge('SY', 'S0', 'S2', 0, 9000, 0, 273), edge('SZ', 'S0', 'S3', 0, 0, 8000, 273),
]);
const threeAxisTarget = graph([
  edge('TX', 'T0', 'T1', 0, 10000, 0, 88.9), edge('TY', 'T0', 'T2', -9000, 0, 0, 88.9), edge('TZ', 'T0', 'T3', 0, 0, 8000, 88.9),
]);
const b3 = qualifyCiiMethodBRunBasis(threeAxisSource, threeAxisTarget, 'S0', 'T0');
assert.strictEqual(b3.status, 'READY');
assert.strictEqual(b3.source.geometry.dimension, 'FULL_3D');
assert.strictEqual(b3.target.geometry.dimension, 'FULL_3D');
assert.strictEqual(b3.weight.geometryComplexity, 40);
assert.strictEqual(b3.weight.compatibleIndependentRunCount, 3);
assert(b3.weight.geometryComplexity > b2.weight.geometryComplexity, 'genuine 3D geometry must receive more weight than two-axis geometry');

const threeAxisTargetBadThird = graph([
  edge('TX', 'T0', 'T1', 0, 10000, 0, 88.9), edge('TY', 'T0', 'T2', -9000, 0, 0, 88.9), edge('TZ', 'T0', 'T3', 0, 0, 20000, 88.9),
]);
const b3BadThird = qualifyCiiMethodBRunBasis(threeAxisSource, threeAxisTargetBadThird, 'S0', 'T0');
assert.strictEqual(b3BadThird.status, 'READY', 'compatible two-axis evidence may remain READY when an unrelated third run changes');
assert.strictEqual(b3BadThird.target.geometry.dimension, 'FULL_3D', 'target still has three raw independent directions');
assert.strictEqual(b3BadThird.weight.compatibleIndependentRunCount, 2, 'changed third run must not earn cross-revision 3D complexity credit');
assert.strictEqual(b3BadThird.weight.geometryComplexity, 24);

const planarSource = graph([
  edge('PX', 'P0', 'P1', 10000, 0, 0), edge('PY', 'P0', 'P2', 0, 9000, 0), edge('PD', 'P0', 'P3', 6000, 6000, 0),
]);
const planarTarget = graph([
  edge('QX', 'Q0', 'Q1', 0, 10000, 0, 88.9), edge('QY', 'Q0', 'Q2', -9000, 0, 0, 88.9), edge('QD', 'Q0', 'Q3', -6000, 6000, 0, 88.9),
]);
const bp = qualifyCiiMethodBRunBasis(planarSource, planarTarget, 'P0', 'Q0');
assert.strictEqual(bp.status, 'READY');
assert.strictEqual(bp.source.geometry.dimension, 'PLANAR_MULTI_AXIS');
assert.strictEqual(bp.weight.geometryComplexity, 32);
assert(bp.weight.geometryComplexity > b2.weight.geometryComplexity && bp.weight.geometryComplexity < b3.weight.geometryComplexity);

const baseA1 = {
  baseId: 'A-LOCAL-1',
  anchorPairs: [
    anchor('10', '1010', point(0, 0, 0), point(0, 100, 0)),
    anchor('20', '1020', point(100, 0, 0), point(100, 100, 0)),
    anchor('30', '1030', point(0, 100, 0), point(0, 200, 0)),
  ],
};
const baseA2 = {
  baseId: 'A-LOCAL-2',
  anchorPairs: [
    anchor('210', '2210', point(10000, 0, 0), point(10000, -200, 0)),
    anchor('220', '2220', point(10100, 0, 0), point(10100, -200, 0)),
    anchor('230', '2230', point(10000, 100, 0), point(10000, -100, 0)),
  ],
};
const multiA = qualifyCiiMultiBaseAuthority({ methodABases: [baseA1, baseA2] });
assert.strictEqual(multiA.status, 'READY');
assert.strictEqual(multiA.combination, 'OR_WITH_CONFLICT_VETO');
assert.strictEqual(multiA.methodAReadyCount, 2);
assert.deepStrictEqual(multiA.loops.map((loop) => loop.geometry.translation), [[0, 100, 0], [0, -200, 0]],
  'independent local Method A bases may retain materially different transforms');
assert(multiA.loops.every((loop) => loop.weight && loop.geometry.tolerancePolicy.factor === 2));

const methodBOnly = qualifyCiiMultiBaseAuthority({
  sourceGraph: twoAxisSource, targetGraph: twoAxisTarget,
  methodBAnchors: [{ baseId: 'B-LOCAL-1', sourceNodeId: 'S0', targetNodeId: 'T0' }],
});
assert.strictEqual(methodBOnly.status, 'READY');
assert.strictEqual(methodBOnly.methodAReadyCount, 0);
assert.strictEqual(methodBOnly.methodBReadyCount, 1, 'Method B alone must satisfy OR union when independently qualified');

const mixed = qualifyCiiMultiBaseAuthority({
  sourceGraph: oneAxisSource, targetGraph: oneAxisTarget,
  methodABases: [baseA1], methodBAnchors: [{ sourceNodeId: 'S10', targetNodeId: 'T10' }],
});
assert.strictEqual(mixed.status, 'READY');
assert.strictEqual(mixed.methodAReadyCount, 1);
assert.strictEqual(mixed.methodBReadyCount, 0, 'one-axis Method B remains REVIEW without blocking ready Method A loop');

const conflicting = qualifyCiiMultiBaseAuthority({
  methodABases: [baseA1, { ...baseA2, baseId: 'A-CONFLICT', anchorPairs: [
    anchor('10', '9999', point(10000, 0, 0), point(10000, -200, 0)),
    anchor('320', '3320', point(10100, 0, 0), point(10100, -200, 0)),
    anchor('330', '3330', point(10000, 100, 0), point(10000, -100, 0)),
  ] }],
});
assert.strictEqual(conflicting.status, 'AMBIGUOUS');
assert.strictEqual(conflicting.reason, 'CROSS_LOOP_ANCHOR_IDENTITY_CONFLICT');
assert(conflicting.conflicts.some((row) => row.kind === 'SOURCE_TO_MULTIPLE_TARGETS' && row.key === '10'));

console.log('CII independent multi-base OD-scaled A/B authority checks passed.');
