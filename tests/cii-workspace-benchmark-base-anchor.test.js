import assert from 'assert';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createCiiWorkspacePreview, inspectCiiWorkspaceModels } from '../tabs/cii-workspace/cii-workspace-core.js';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';
import { adaptCiiDocumentToTopologyGraph } from '../tabs/cii-workspace/cii-workspace-topology-adapter.js';
import { qualifyCiiGeometryTransform } from '../tabs/cii-workspace/cii-workspace-geometry.js';
import { qualifyCiiMethodBRunBasis } from '../tabs/cii-workspace/cii-workspace-pipe-runs.js';

async function text(relative) { return readFile(new URL(relative, import.meta.url), 'utf8'); }

const [sourceText, target1Text, target2Text, source3Text, target31Text] = await Promise.all([
  text('../Benchmark/CIICompare/BM_CII_SOURCE.CII'),
  text('../Benchmark/CIICompare/BM_CII_TARGET1.CII'),
  text('../Benchmark/CIICompare/BM_CII_TARGET2.CII'),
  text('../Benchmark/CIICompare/SOURCE 3.CII'),
  text('../Benchmark/CIICompare/TARGET 3-1.CII'),
]);

async function inspect(targetText, targetFileName) {
  return inspectCiiWorkspaceModels({
    sourceText,
    sourceFileName: 'BM_CII_SOURCE.CII',
    targetText,
    targetFileName,
  }, { cryptoRef: webcrypto });
}
async function graphFrom(textValue, fileName, side) {
  const document = await intakeCiiWorkspaceDocument(textValue, fileName, { side, cryptoRef: webcrypto });
  return adaptCiiDocumentToTopologyGraph(document);
}
function edgeByNodes(graph, from, to) {
  const left = String(from); const right = String(to);
  return graph.edges.find((edge) => String(edge.from) === left && String(edge.to) === right)
    || graph.edges.find((edge) => String(edge.from) === right && String(edge.to) === left);
}
function assertSameGeometry(sourceEdge, targetEdge, label) {
  assert(sourceEdge, `${label}: SOURCE edge missing`);
  assert(targetEdge, `${label}: TARGET edge missing`);
  for (const field of ['dx', 'dy', 'dz', 'lengthMm', 'diameter']) {
    assert(Math.abs(Number(sourceEdge[field]) - Number(targetEdge[field])) < 1e-9,
      `${label}: ${field} must match independently of node numbering`);
  }
  assert.strictEqual(sourceEdge.componentKind, targetEdge.componentKind, `${label}: component kind must match`);
}
function position(graph, nodeId) {
  return graph.nodes.find((node) => String(node.id) === String(nodeId))?.position || null;
}
function sourceOdAtNode(graph, nodeId) {
  const values = [...(graph.adjacency.get(String(nodeId)) || [])]
    .map((edge) => Number(edge.diameter)).filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.min(...values) : null;
}

const target1 = await inspect(target1Text, 'BM_CII_TARGET1.CII');
const target2 = await inspect(target2Text, 'BM_CII_TARGET2.CII');

const pair1 = target1.baseAnchorSuggestions.find((row) => row.sourceNodeId === '70' && row.targetNodeId === '20070');
const pair2 = target2.baseAnchorSuggestions.find((row) => row.sourceNodeId === '70' && row.targetNodeId === '10070');
assert(pair1, 'TARGET1 must expose the reviewed 70 ↔ 20070 base-anchor candidate');
assert(pair2, 'TARGET2 must expose the reviewed 70 ↔ 10070 base-anchor candidate under the same structural policy');
const allowedBasisMethods = new Set(['METHOD_A_SPATIAL', 'METHOD_B_NETWORK', 'METHOD_A_AND_B', 'LANDMARK_ONLY']);
for (const pair of [pair1, pair2]) {
  assert.strictEqual(pair.status, 'SUGGESTED');
  assert.strictEqual(pair.authority, 'EVIDENCE_ONLY_ENGINEER_ACCEPT_REQUIRED');
  assert.strictEqual(pair.reviewRequired, true);
  assert(allowedBasisMethods.has(pair.basisMethod), `unexpected Base Anchor basis method ${pair.basisMethod}`);
  assert.strictEqual(pair.candidateGeneration?.authorityRole, 'CANDIDATE_GENERATION_ONLY');
  assert(pair.methodA && ['READY', 'UNAVAILABLE'].includes(pair.methodA.status));
  if (pair.methodA.status === 'READY') assert(['METHOD_A_SPATIAL', 'METHOD_A_AND_B'].includes(pair.basisMethod));
  if (pair.methodB.status === 'READY') assert(['METHOD_B_NETWORK', 'METHOD_A_AND_B'].includes(pair.basisMethod));
  assert(pair.identityExclusions.includes('NODE_NUMBER_OFFSET_NOT_USED'));
  assert(pair.identityExclusions.includes('OD_NOT_IDENTITY_USED_AS_TOLERANCE_SCALE'));
  assert(pair.identityExclusions.includes('WALL_NOT_USED'));
  assert.strictEqual(pair.methodB.tolerancePolicy.factor, 2);
  assert.strictEqual(pair.methodB.tolerancePolicy.odAuthority, 'SOURCE');
  assert.notStrictEqual(pair.status, 'LOCKED');
}

// Real multi-base benchmark added to main on 2026-08-19.
// The same SOURCE/TARGET file pair contains multiple incompatible node-number offsets,
// so a single global node-offset registration policy is demonstrably invalid.
const source3 = await graphFrom(source3Text, 'SOURCE 3.CII', 'SOURCE');
const target31 = await graphFrom(target31Text, 'TARGET 3-1.CII', 'TARGET');
assert.strictEqual(source3.edges.length, 219, 'SOURCE 3 CONTROL declares 219 ELEMENT records');
assert.strictEqual(target31.edges.length, 223, 'TARGET 3-1 CONTROL declares 223 ELEMENT records');

const knownCorrespondences = [
  { source: ['20000', '20010'], target: ['7000', '7010'], offset: -13000, label: 'base-A' },
  { source: ['60880', '60890'], target: ['7250', '7260'], offset: -53630, label: 'base-B' },
  { source: ['6030', '6040'], target: ['7650', '7660'], offset: 1620, label: 'base-C' },
];
for (const row of knownCorrespondences) {
  const sourceEdge = edgeByNodes(source3, ...row.source); const targetEdge = edgeByNodes(target31, ...row.target);
  assertSameGeometry(sourceEdge, targetEdge, row.label);
  assert.strictEqual(Number(row.target[0]) - Number(row.source[0]), row.offset, `${row.label}: benchmark offset custody changed`);
}
assert.strictEqual(new Set(knownCorrespondences.map((row) => row.offset)).size, 3,
  'SOURCE 3/TARGET 3-1 must retain at least three incompatible local node-number offsets');

// Real Method A basis around the 60930 ↔ 7300 direction change.
// 60920→60930 is vertical; 60930→60940 is horizontal, so the three anchors are non-collinear.
const methodAAnchors = [
  ['60920', '7290'], ['60930', '7300'], ['60940', '7310'],
].map(([sourceNodeId, targetNodeId]) => ({
  sourceNodeId, targetNodeId,
  source: position(source3, sourceNodeId), target: position(target31, targetNodeId),
  sourceOdMm: sourceOdAtNode(source3, sourceNodeId),
}));
assert(methodAAnchors.every((row) => row.source && row.target && row.sourceOdMm), 'real Method A benchmark anchors must resolve');
const realMethodA = qualifyCiiGeometryTransform(methodAAnchors);
assert.strictEqual(realMethodA.status, 'READY', 'real non-collinear benchmark basis must qualify Method A');
assert.strictEqual(realMethodA.tolerancePolicy.factor, 2);
assert(Math.abs(realMethodA.tolerancePolicy.basisAgreementToleranceMm - 228.6) < 1e-9,
  'x=2 with SOURCE OD=114.3 mm must give 228.6 mm Method A tolerance');
assert(realMethodA.maxNormalizedResidual <= 1);

// Real Method B two-axis anchor at the same physical elbow/direction-change location.
const realMethodB = qualifyCiiMethodBRunBasis(source3, target31, '60930', '7300');
assert(realMethodB.source.independentAxisRunCount >= 2, 'SOURCE real benchmark must expose >=2 independent runs');
assert(realMethodB.target.independentAxisRunCount >= 2, 'TARGET real benchmark must expose >=2 independent runs');
assert.strictEqual(realMethodB.tolerancePolicy.odAuthority, 'SOURCE');
assert(Math.abs(realMethodB.tolerancePolicy.odRefMm - 114.3) < 1e-9);
assert(Math.abs(realMethodB.tolerancePolicy.toleranceMm - 228.6) < 1e-9);
assert.strictEqual(realMethodB.status, 'READY', 'real two-axis benchmark basis must qualify Method B');
assert(realMethodB.weight.geometryComplexity >= 24, 'qualified real two-axis evidence must earn at least two-axis geometry weight');

// Workspace-level orchestration: the same real local region is submitted as independent A OR B loops.
// A READY correspondence is sufficient for the union; if whole-component B propagation encounters a revised region,
// its unresolved result must remain diagnostic and must not poison the valid A loop.
const realPreview = await createCiiWorkspacePreview({
  sourceText: source3Text, sourceFileName: 'SOURCE 3.CII', targetText: target31Text, targetFileName: 'TARGET 3-1.CII',
  baseLoops: [
    { baseId: 'REAL_A_60930', method: 'METHOD_A', anchorPairs: [
      { sourceNodeId: '60920', targetNodeId: '7290' },
      { sourceNodeId: '60930', targetNodeId: '7300' },
      { sourceNodeId: '60940', targetNodeId: '7310' },
    ] },
    { baseId: 'REAL_B_60930', method: 'METHOD_B', sourceNodeId: '60930', targetNodeId: '7300' },
  ],
}, { cryptoRef: webcrypto });
assert.strictEqual(realPreview.multiBaseAuthority.status, 'READY');
assert.strictEqual(realPreview.multiBaseAuthority.methodAReadyCount, 1);
assert.strictEqual(realPreview.multiBaseAuthority.methodBReadyCount, 1);
assert.strictEqual(realPreview.multiBaseCorrespondence.status, 'READY');
assert(realPreview.multiBaseCorrespondence.contributingLoopIds.includes('REAL_A_60930'),
  'real Method A loop must contribute an end-to-end workspace correspondence');
assert(realPreview.multiBaseCorrespondence.loopResults.some((row) => row.loop.loopId === 'REAL_B_60930'),
  'real Method B loop result must remain auditable even if revised downstream geometry stops its propagation');
assert.strictEqual(realPreview.multiBaseCorrespondence.combination, 'OR_WITH_CONFLICT_VETO');

console.log('CII real benchmark OD-scaled multi-base checks passed.');
