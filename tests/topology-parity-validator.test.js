import assert from 'node:assert/strict';
import { readParsedInputXmlTopology, readTopologyParityReport, readTopologySvgScene } from '../tabs/topology-trace-validator/topology-parity-artifact-reader.js';
import { buildTopologyParityState } from '../tabs/topology-trace-validator/topology-parity-state.js';
import { buildTopologySceneViewModel } from '../tabs/topology-trace-validator/topology-scene-view-model.js';
import { topologyParitySvgMarkup, TOPOLOGY_PARITY_SVG_LAYERS } from '../tabs/topology-trace-validator/topology-parity-svg-renderer.js';
import { projectTopologyPoint, TOPOLOGY_PROJECTION_PLANES } from '../tabs/topology-trace-validator/topology-svg-projections.js';
import { topologyParityMismatchTableMarkup, topologyParitySummaryMarkup } from '../tabs/topology-trace-validator/topology-parity-panel.js';

const canonicalHash = 'fnv1a64:canonical';
const ledgerHash = 'fnv1a64:ledger';
const sceneHash = 'fnv1a64:scene';
const inputHash = 'fnv1a64:input';
const parsedHash = 'fnv1a64:parsed';
const reportHash = 'fnv1a64:report';

const scene = readTopologySvgScene({
  schema: 'TopologySvgScene.v1',
  sourceIdentity: { sourceName: 'fixture.json' },
  canonicalTopologyHash: canonicalHash,
  topologyTraceLedgerHash: ledgerHash,
  svgSceneHash: sceneHash,
  coordinateFrame: { unit: 'mm' },
  nodes: [
    { id: 'CN-1', canonicalNodeId: 'CN-1', inputXmlNodeId: '10', position: { x: 0, y: 0, z: 0 }, sourceEntityIds: ['SRC-1'], sourcePortIds: ['PORT-A'], branchIds: ['BR-1'] },
    { id: 'CN-2', canonicalNodeId: 'CN-2', inputXmlNodeId: '20', position: { x: 100, y: 50, z: 25 }, sourceEntityIds: ['SRC-1'], sourcePortIds: ['PORT-L'], branchIds: ['BR-1'] },
  ],
  edges: [{
    id: 'CE-1', canonicalEdgeId: 'CE-1', inputXmlElementId: 'PE-1',
    fromCanonicalNodeId: 'CN-1', toCanonicalNodeId: 'CN-2',
    fromPosition: { x: 0, y: 0, z: 0 }, toPosition: { x: 100, y: 50, z: 25 },
    sourceEntityIds: ['SRC-1'], sourcePortIds: ['PORT-A', 'PORT-L'], sourcePaths: ['$[0]'], branchIds: ['BR-1'],
    sourceTypes: ['PIPE'], segmentRole: 'PIPE', topologyOperation: 'PIPE', projectionCardinality: 'ONE_TO_ONE', mergeAuthority: '',
  }],
  supports: [{
    id: 'SUP-1', canonicalSupportId: 'SUP-1', canonicalNodeId: 'CN-2', inputXmlNodeId: '20', inputXmlRestraintIds: ['RESTRAINT:SUP-1:1'], tag: 'PS-1',
    position: { x: 100, y: 50, z: 25 }, sourcePosition: { x: 100, y: 70, z: 25 }, attachmentPosition: { x: 100, y: 50, z: 25 },
    sourceEntityIds: ['SRC-SUPPORT'], sourcePaths: ['$[0].children[1]'], branchIds: ['BR-1'], attachmentAuthority: 'ATTACHED_COMPONENT_REF',
    attachmentReferences: ['=CARRIER'], connectionResidual: 20, restraintCount: 1, topologyBearing: true,
  }],
  deferredSupports: [{
    id: 'TL-DEFERRED', sourceEntityId: 'SRC-DEFERRED', sourceEntityIds: ['SRC-DEFERRED'], sourcePath: '$[0].children[2]', sourceRef: '=1006649732/53464',
    branchIds: ['BR-1'], position: { x: 40, y: 20, z: 0 }, primaryDisposition: 'DEFER_SUPPORT', projectionCardinality: 'DEFERRED',
    lossClassification: 'DEFERRED_NON_RESTRAINT_ATTACHMENT', status: 'ACCEPTED', topologyBearing: false, deferred: true,
  }],
  rigids: [{ id: 'RIGID:CE-1', canonicalEdgeId: 'CE-1', sourceEntityIds: ['SRC-RIGID'], branchIds: ['BR-1'], assignmentAuthorities: ['SOURCE_COMPONENT_EDGE'], sourceBodyCount: 1 }],
  junctions: [{ id: 'CJ-1', canonicalJunctionId: 'CJ-1', canonicalNodeId: 'CN-2', kind: 'TEE', position: { x: 100, y: 50, z: 25 }, participatingCanonicalEdgeIds: ['CE-1'], sourceEntityIds: ['SRC-JUNCTION'], branchIds: ['BR-1'] }],
  boundaries: [{ id: 'CB-1', canonicalBoundaryId: 'CB-1', canonicalNodeId: 'CN-1', position: { x: 0, y: 0, z: 0 }, participatingCanonicalEdgeIds: ['CE-1'], sourceEntityIds: ['SRC-1'], branchIds: ['BR-1'], relationship: 'HREF:EXTERNAL' }],
  pointFeatures: [{ id: 'PF-1', canonicalPointFeatureId: 'PF-1', kind: 'FLANGE', position: { x: 50, y: 25, z: 12.5 }, sourceEntityIds: ['SRC-POINT'], branchIds: ['BR-1'], topologyBearing: false }],
  issues: [],
  summary: { nodes: 2, edges: 1, supports: 1, deferredSupports: 1, rigids: 1, junctions: 1, boundaries: 1, pointFeatures: 1, issues: 0 },
});

const parsed = readParsedInputXmlTopology({
  schema: 'ParsedInputXmlTopology.v1', inputXmlHash: inputHash, canonicalTopologyHash: canonicalHash,
  topologyTraceLedgerHash: ledgerHash, parsedInputXmlTopologyHash: parsedHash,
  nodes: [
    { id: 'CN-1', canonicalNodeId: 'CN-1', inputXmlNodeId: '10', position: { x: 0, y: 0, z: 0 } },
    { id: 'CN-2', canonicalNodeId: 'CN-2', inputXmlNodeId: '20', position: { x: 100, y: 50, z: 25 } },
  ],
  elements: [{
    id: 'PE-1', canonicalEdgeId: 'CE-1', fromNode: '10', toNode: '20', fromCanonicalNodeId: 'CN-1', toCanonicalNodeId: 'CN-2',
    fromPosition: { x: 0, y: 0, z: 0 }, toPosition: { x: 100, y: 50, z: 25 }, sourceEntityIds: ['SRC-1'], sourcePortIds: ['PORT-A', 'PORT-L'], branchIds: ['BR-1'],
  }],
  restraints: [{ id: 'RESTRAINT:SUP-1:1', supportId: 'SUP-1', canonicalNodeId: 'CN-2', sourceEntityIds: ['SRC-SUPPORT'] }],
  rigids: [{ id: 'RIGID:CE-1', canonicalEdgeId: 'CE-1', sourceEntityIds: ['SRC-RIGID'] }],
  issues: [], summary: { nodes: 2, elements: 1, restraints: 1, rigids: 1, issues: 0, blockingIssues: 0 },
});

const report = readTopologyParityReport({
  schema: 'TopologyParityReport.v1', canonicalTopologyHash: canonicalHash, topologyTraceLedgerHash: ledgerHash,
  inputXmlHash: inputHash, parsedInputXmlTopologyHash: parsedHash, svgSceneHash: sceneHash, topologyParityReportHash: reportHash,
  ok: true, status: 'PASS', normalization: { toleranceMm: 0 },
  summary: { canonicalNodes: 2, canonicalEdges: 1, inputXmlNodes: 2, inputXmlElements: 1, svgNodes: 2, svgEdges: 1, supports: 1, rigids: 1, junctions: 1, deferredRecords: 1, topologyMismatchCount: 0 },
  mismatches: [],
});

const canonical = { schema: 'CanonicalTopology.v1', canonicalTopologyHash: canonicalHash };
const ledger = { schema: 'TopologyTraceLedger.v1', canonicalTopologyHash: canonicalHash, topologyTraceLedgerHash: ledgerHash };
const passState = buildTopologyParityState({ canonical, ledger, scene, parsed, report });
assert.equal(passState.status, 'PASS');
assert.equal(passState.stale, false);

const staleScene = { ...scene, svgSceneHash: 'fnv1a64:changed' };
const staleState = buildTopologyParityState({ canonical, ledger, scene: staleScene, parsed, report });
assert.equal(staleState.status, 'STALE');
assert(staleState.reasons.some((row) => row.label === 'report scene hash'));
assert.equal(buildTopologyParityState({ canonical, ledger, scene, parsed, report: null }).status, 'NOT_RUN');
assert.equal(buildTopologyParityState({ canonical, ledger, scene, parsed, report }, { running: true }).status, 'RUNNING');

assert.deepEqual(TOPOLOGY_PROJECTION_PLANES, ['ISO', 'XY', 'XZ', 'YZ']);
const iso = projectTopologyPoint({ x: 100, y: 50, z: 25 }, 'ISO');
assert(Math.abs(iso.x - 43.30127018922194) < 1e-9);
assert.equal(iso.y, 100);

const viewModel = buildTopologySceneViewModel({ scene, parsed, report, state: { projection: 'ISO', branch: 'BR-1', labels: true } });
assert.equal(viewModel.schema, 'TopologyParitySvgViewModel.v1');
assert.equal(viewModel.activeEdges.length, 1);
assert.equal(viewModel.supports[0].projectedSourcePosition !== null, true);
assert.equal(viewModel.deferredSupports[0].topologyBearing, false);
const markup = topologyParitySvgMarkup(viewModel);
for (const layer of TOPOLOGY_PARITY_SVG_LAYERS) assert.match(markup, new RegExp(`data-layer="${layer}"`));
for (const attribute of ['data-canonical-edge-id="CE-1"', 'data-inputxml-element-id="PE-1"', 'data-from-canonical-node-id="CN-1"', 'data-to-canonical-node-id="CN-2"', 'data-source-port-ids="PORT-A,PORT-L"', 'data-projection-cardinality="ONE_TO_ONE"', 'data-topology-operation="PIPE"']) assert(markup.includes(attribute), attribute);
for (const attribute of ['data-canonical-node-id="CN-1"', 'data-inputxml-node-id="10"', 'data-world-x="0"', 'data-world-y="0"', 'data-world-z="0"']) assert(markup.includes(attribute), attribute);
assert.match(markup, /data-topology-bearing="false"/);
assert.match(markup, /ttv-parity-residual/);
assert.match(topologyParitySummaryMarkup(passState, report), /Parity Status/);
assert.match(topologyParityMismatchTableMarkup(report), /No topology mismatches/);

assert.throws(() => readTopologySvgScene({ ...scene, canonicalTopologyHash: '' }), /canonicalTopologyHash/);
assert.throws(() => readParsedInputXmlTopology({ ...parsed, elements: [{ id: 'PE-X' }] }), /canonicalEdgeId/);
assert.throws(() => readTopologyParityReport({ ...report, status: 'STALE' }), /status is invalid/);

console.log('topology parity validator contracts passed');
