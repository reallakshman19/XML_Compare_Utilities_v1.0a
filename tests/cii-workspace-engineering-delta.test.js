import assert from 'assert';
import { buildCiiEngineeringDeltas, ciiIdentityConfidence } from '../tabs/cii-workspace/cii-workspace-engineering-delta.js';
import { buildCiiCompareReviewModel } from '../tabs/cii-workspace/cii-workspace-compare-review.js';

function capabilities() {
  const qualified = { state: 'PARSED', qualification: 'QUALIFIED', limitations: [] };
  return { families: {
    restraints: { state: 'PARSED', qualification: 'PARTIAL', limitations: ['gap/friction not normalized'] },
    hangers: { state: 'NOT_PARSED', qualification: 'NONE', limitations: ['not parsed'] },
    sifTee: { state: 'NOT_PARSED', qualification: 'NONE', limitations: ['not parsed'] },
    weightData: { state: 'NOT_PARSED', qualification: 'NONE', limitations: ['general weight not parsed'] },
    lineNumbers: { state: 'NOT_PARSED', qualification: 'NONE', limitations: ['not parsed'] },
    process: { state: 'PARSED', qualification: 'PARTIAL', limitations: ['element values only'] },
    nodeNames: qualified, pipeProperties: qualified, rigidMass: qualified,
  } };
}
function document(side, nodeNames, restraints) {
  return {
    fileName: `${side}.CII`, summary: { nodeCount: 3, elementCount: 2 }, nodeNames,
    parsed: { restraints }, capabilities: capabilities(),
  };
}
function context() { return { degree: 2, neighbourhoodLayers: [['D2->D2|PIPE']] }; }
function edge(id, from, to, dx, od, wall, P1 = 10, T1 = 100, mass = null) {
  return {
    elementId: id, from, to, dx, dy: 0, dz: 0, lengthMm: Math.abs(dx), diameter: od, wall, P1, T1,
    fromContext: context(), toContext: context(), componentKind: mass == null ? 'PIPE' : 'RIGID',
    rigidEvidence: mass == null ? { status: 'NONE' } : { status: 'UNIQUE_TERMINAL_RECORD', nodeId: to, mass },
  };
}
function graph(nodes, edges) {
  return { nodes: Object.entries(nodes).map(([id, position]) => ({ id, position })), edges };
}
function supportedCandidates(confidence, targetElementId, overrides = {}) {
  const m1 = overrides.m1 || { pass: true, available: true, score: 100, distanceMm: 0, toleranceMm: 100, basis: 'RAW_GLOBAL' };
  const m2 = overrides.m2 || { pass: true, available: true, score: 90, threshold: 55, components: {}, blockers: [] };
  const dimensions = overrides.dimensions || {
    diameter: { pass: true, available: true, source: 60.3, target: 60.3, relativeDelta: 0, tolerance: 0.1 },
    wall: { pass: true, available: true, source: 3.9, target: 3.9, relativeDelta: 0, tolerance: 0.1 },
  };
  return {
    status: 'SUPPORTED', winnerIdentityConfidence: confidence, winnerTargetElementId: targetElementId,
    winnerGap: 12, requiredWinnerGap: 8, reasons: [], methodWinners: { m1Spatial: targetElementId, m2Network: targetElementId, disagree: false },
    rankedCandidates: [{ targetElementId, score: confidence === 'MEDIUM' ? 45.5 : 100, rankingScore: 90, identityConfidence: confidence, methods: { m1Spatial: m1, m2Network: m2 }, dimensions }],
  };
}

const sourceDoc = document('SOURCE', { 10: 'OLD-NAME' }, [
  { node: 10, dofs: [15], stiffness: 0, rows: [[10, 15, 0, 0.1]] },
]);
const targetDoc = document('TARGET', { 20010: 'NEW-NAME' }, [
  { node: 20010, dofs: [9], stiffness: 0, rows: [[20010, 9, 0, 0.3]] },
]);
const sourceEdge = edge('S1', '10', '20', 1000, 60.3, 3.9);
const targetEdge = edge('T1', '20010', '20020', 1000, 114.3, 4.7752);
const sourceGraph = graph({ 10: { x: 0, y: 0, z: 0 }, 20: { x: 1000, y: 0, z: 0 } }, [sourceEdge]);
const targetGraph = graph({ 20010: { x: 0, y: 0, z: 0 }, 20020: { x: 1000, y: 0, z: 0 } }, [targetEdge]);
const nodeRow = { correspondenceId: 'node:10:20010', kind: 'NODE', sourceNodeId: '10', targetNodeId: '20010', status: 'HIGH', authority: 'TEST' };
const elementRow = {
  correspondenceId: 'element:S1:T1', kind: 'ELEMENT', sourceElementId: 'S1', targetElementIds: ['T1'], status: 'HIGH', authority: 'TEST',
  evidence: { candidates: supportedCandidates('HIGH', 'T1', { dimensions: {
    diameter: { pass: false, available: true, source: 60.3, target: 114.3, relativeDelta: (114.3 - 60.3) / 60.3, tolerance: 0.1 },
    wall: { pass: false, available: true, source: 3.9, target: 4.7752, relativeDelta: (4.7752 - 3.9) / 3.9, tolerance: 0.1 },
  } }) },
};
const correspondence = { status: 'READY', nodeRows: [nodeRow], elementRows: [elementRow], componentRows: [] };
const review = { reviewedCorrespondenceIds: [], lockedCorrespondenceIds: [], rejectedCorrespondenceIds: [] };
const deltas = buildCiiEngineeringDeltas(sourceDoc, targetDoc, sourceGraph, targetGraph, correspondence);

// Identity remains HIGH even though multiple engineering properties changed.
assert.strictEqual(ciiIdentityConfidence(elementRow), 'HIGH');
assert(deltas.changedRows.some((row) => row.category === 'PIPE_SIZE' && row.property === 'OD'));
assert(deltas.changedRows.some((row) => row.category === 'WALL'));
assert(deltas.changedRows.some((row) => row.category === 'NODE_NAME'));
assert(deltas.changedRows.some((row) => row.category === 'RESTRAINT' && row.property === 'Restraint code set'));
const rawRestraint = deltas.changedRows.find((row) => row.property === 'Raw restraint records');
assert.strictEqual(rawRestraint.semanticChange, 'RAW_ROWS_CHANGED');
assert(rawRestraint.limitations[0].includes('without labelling unqualified columns'));
assert(!deltas.rows.some((row) => /friction|gap/i.test(row.property)), 'legacy restraint fixtures without auxiliary custody must not receive gap/friction semantics');
assert.strictEqual(deltas.summary.identityMutationAuthority, 'NONE_READ_ONLY_DOWNSTREAM');

const model = buildCiiCompareReviewModel(sourceDoc, targetDoc, correspondence, review, deltas);
const elementProjection = model.rows.find((row) => row.correspondenceId === elementRow.correspondenceId);
assert.strictEqual(elementProjection.confidence, 'HIGH');
assert(elementProjection.changeCount >= 2);
assert.strictEqual(elementProjection.methodA.pass, true);
assert.strictEqual(elementProjection.methodB.pass, true);
assert.strictEqual(elementProjection.od.pass, false);
assert.strictEqual(elementProjection.wall.pass, false);

// Benchmark-style 205: a 200 mm matched node move is an engineering geometry
// change while M2-supported identity remains MEDIUM / workflow REVIEW.
const movedSource = document('SOURCE205', {}, []); const movedTarget = document('TARGET205', {}, []);
const movedSourceEdge = edge('S205', '200', '205', -1213.79, 88.9, 5.5);
const movedTargetEdge = edge('T205', '20200', '20205', -1013.79, 88.9, 5.5);
const movedSourceGraph = graph({ 200: { x: 0, y: 0, z: 0 }, 205: { x: -1213.79, y: 0, z: 0 } }, [movedSourceEdge]);
const movedTargetGraph = graph({ 20200: { x: 0, y: 0, z: 0 }, 20205: { x: -1013.79, y: 0, z: 0 } }, [movedTargetEdge]);
const movedCandidates = supportedCandidates('MEDIUM', 'T205', {
  m1: { pass: false, available: true, score: 0, distanceMm: 200, toleranceMm: 100, basis: 'RAW_GLOBAL' },
});
const movedCorrespondence = { status: 'READY', nodeRows: [
  { correspondenceId: 'node:200:20200', kind: 'NODE', sourceNodeId: '200', targetNodeId: '20200', status: 'LOCKED' },
  { correspondenceId: 'node:205:20205', kind: 'NODE', sourceNodeId: '205', targetNodeId: '20205', status: 'REVIEW', evidence: { candidates: movedCandidates } },
], elementRows: [
  { correspondenceId: 'element:S205:T205', kind: 'ELEMENT', sourceElementId: 'S205', targetElementIds: ['T205'], status: 'REVIEW', evidence: { candidates: movedCandidates } },
], componentRows: [] };
const movedDeltas = buildCiiEngineeringDeltas(movedSource, movedTarget, movedSourceGraph, movedTargetGraph, movedCorrespondence);
const movedLocation = movedDeltas.changedRows.find((row) => row.correspondenceId === 'node:205:20205' && row.property === 'Node location (native basis)');
assert(movedLocation && Math.abs(movedLocation.delta.distanceMm - 200) < 1e-9);
assert.strictEqual(movedDeltas.summary.geometryBases.native, 'PARSED_NATIVE_NODE_COORDINATES');
assert.strictEqual(movedDeltas.summary.geometryBases.registered, 'UNAVAILABLE');
const movedReview = buildCiiCompareReviewModel(movedSource, movedTarget, movedCorrespondence, review, movedDeltas);
const movedElementProjection = movedReview.rows.find((row) => row.correspondenceId === 'element:S205:T205');
assert.strictEqual(movedElementProjection.confidence, 'MEDIUM');
assert.strictEqual(movedElementProjection.workflowStatus, 'REVIEW');
assert.strictEqual(movedElementProjection.methodA.pass, false);
assert.strictEqual(movedElementProjection.methodB.pass, true);

// Capability truthfulness: unsupported families remain visible limitations.
for (const family of ['hangers', 'sifTee', 'lineNumbers']) {
  const item = deltas.limitations.find((entry) => entry.family === family);
  assert(item);
  assert.notStrictEqual(item.comparisonState, 'QUALIFIED');
}

console.log('CII engineering delta / Compare Review separation checks passed.');
