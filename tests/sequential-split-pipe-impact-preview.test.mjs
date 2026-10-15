import assert from 'node:assert/strict';
import {
  assertSequentialSplitPipeImpact,
  createSequentialSplitPipeImpact,
  parseSequentialSplitPipeRequestText,
  validateSequentialSplitPipeImpact,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-split-pipe-impact-preview.js';
import { sequentialSemanticFingerprint } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-contracts.js';
import { createTopologySequentialSplitEdgeRequest } from '../tabs/topology-trace-validator/topology-sequential-split-edge-request.js';

const request = createTopologySequentialSplitEdgeRequest({
  canonical: { schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'CANONICAL-1',
    nodes: [
      { id: 'V1', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0].nodes[0]'] },
      { id: 'V2', position: { x: 10, y: 0, z: 0 }, sourcePaths: ['$[0].nodes[1]'] },
    ],
    edges: [{ id: 'VE1', fromNodeId: 'V1', toNodeId: 'V2', segmentRole: 'PIPE',
      sourcePaths: ['$[0].edges[0]'] }] },
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'DRAFT-1' },
  commandAuthority: { authorityId: 'AUTH-1' },
  projectDocument: { documentId: 'DOC-1', sourceHash: 'SOURCE-1', scopedHash: 'SCOPED-1',
    fileName: 'model.json' }, edgeId: 'VE1', fraction: 0.5,
  createdAt: '2026-07-29T13:30:00.000Z',
});

function topology(overrides = {}) {
  const base = {
    schema: 'SequentialEditableTopologySnapshot.v1',
    authority: { authorityId: 'SSK-AUTH-1' },
    topologyFingerprint: 'TOP-1', geometryFingerprint: 'GEO-1',
    ancestryFingerprint: 'ANC-1', snapshotFingerprint: 'SNAP-1',
    branch: { branchId: 'B1', branchIds: ['B1'], state: 'CONFIRMED' },
    components: [{ componentId: 'C1', canonicalType: 'PIPE', branchId: 'B1',
      geometryPartIds: ['G1'], internalEdgeIds: ['IE1'], portIds: ['P1', 'P2'],
      nodeIds: ['N1', 'N2'], neighbourComponentIds: [], supportAttachmentIds: [],
      ancestry: { sourceComponentId: 'SRC-C1', strokeId: 'STROKE-1' } }],
    geometryParts: [{ geometryPartId: 'G1', componentId: 'C1', role: 'primary',
      geometry: { schema: 'EngineeringGeometry.v1', kind: 'segment',
        start: { x: 0, y: 0, z: 0 }, end: { x: 20, y: 0, z: 0 } },
      nodeIds: ['N1', 'N2'], portIds: ['P1', 'P2'], sourceStrokeId: 'STROKE-1' }],
    internalEdges: [{ edgeId: 'IE1', componentId: 'C1', geometryPartId: 'G1',
      order: 0, fromNodeId: 'N1', toNodeId: 'N2' }],
    nodes: [
      { nodeId: 'N1', position: { x: 0, y: 0, z: 0 }, portIds: ['P1'], degree: 1,
        boundaryClass: 'OPEN_TERMINAL', incidentEdgeIds: ['IE1'], committedConnectionIds: [] },
      { nodeId: 'N2', position: { x: 20, y: 0, z: 0 }, portIds: ['P2'], degree: 1,
        boundaryClass: 'OPEN_TERMINAL', incidentEdgeIds: ['IE1'], committedConnectionIds: [] },
    ],
    ports: [{ portId: 'P1', nodeId: 'N1', componentId: 'C1' },
      { portId: 'P2', nodeId: 'N2', componentId: 'C1' }],
    committedConnections: [], componentBoundaryCuts: [], repairs: [], supportAttachments: [],
  };
  return structuredClone({ ...base, ...overrides });
}
const input = { request, sequentialComponentId: 'C1', sequentialGeometryPartId: 'G1',
  sequentialInternalEdgeId: 'IE1', sequentialBranchId: 'B1' };

const preview = createSequentialSplitPipeImpact(topology(), input);
assert.equal(preview.impactStatus, 'REVIEWABLE');
assert.equal(preview.sequentialSplitGeometry.lengthMm, 20);
assert.deepEqual(preview.sequentialSplitGeometry.splitPosition, { x: 10, y: 0, z: 0 });
assert.deepEqual(preview.reviewFlags, ['SOURCE_LENGTH_DIFFERS', 'SOURCE_SPLIT_POSITION_DIFFERS']);
assert.equal(preview.candidateNativeOperation, 'SPLIT_PIPE');
assert.equal(preview.publicationState, 'NOT_PUBLISHED');
assert.deepEqual(createSequentialSplitPipeImpact(topology(), input), preview);
assert.deepEqual(validateSequentialSplitPipeImpact(preview, topology(), input), preview);
assert.deepEqual(parseSequentialSplitPipeRequestText(JSON.stringify(request)), request);

assert.throws(() => createSequentialSplitPipeImpact(topology(), { ...input,
  sequentialBranchId: 'MISSING' }), /Branch is unavailable/);
assert.throws(() => createSequentialSplitPipeImpact(topology(), { ...input,
  sequentialGeometryPartId: 'MISSING' }), /Geometry part is unavailable/);

const supported = topology({ supportAttachments: [{ supportAttachmentId: 'S1', carrierId: 'C1' }] });
supported.components[0].supportAttachmentIds = ['S1'];
const blockedSupport = createSequentialSplitPipeImpact(supported, input);
assert.equal(blockedSupport.impactStatus, 'BLOCKED');
assert.ok(blockedSupport.blockers.some((row) => row.code === 'SUPPORTED_COMPONENT'));

const nonPipe = topology();
nonPipe.components[0].canonicalType = 'ELBOW';
nonPipe.components[0].geometryPartIds = ['G1', 'G2'];
nonPipe.components[0].internalEdgeIds = ['IE1', 'IE2'];
const blockedShape = createSequentialSplitPipeImpact(nonPipe, input);
assert.deepEqual(blockedShape.blockers.map((row) => row.code),
  ['MULTI_PART_COMPONENT', 'MULTI_SEGMENT_COMPONENT', 'NON_PIPE_COMPONENT']);

const repaired = topology({ repairs: [{ repairId: 'R1', connectionId: 'K1',
  fromNodeId: 'N1', toNodeId: 'NX' }] });
const blockedRepair = createSequentialSplitPipeImpact(repaired, input);
assert.ok(blockedRepair.blockers.some((row) => row.code === 'REPAIR_MEDIATED_CONTINUITY'));

const requestTamper = structuredClone(request); requestTamper.sourceCommand.payload.fraction = 0.25;
assert.throws(() => createSequentialSplitPipeImpact(topology(), { ...input, request: requestTamper }),
  /Validator split request is invalid/);

const forged = structuredClone(preview);
forged.internalEdge.componentId = 'FORGED';
const forgedMaterial = { ...forged }; delete forgedMaterial.previewFingerprint;
forged.previewFingerprint = sequentialSemanticFingerprint('SSKSPLITPIPEIMPACT', forgedMaterial);
assert.throws(() => assertSequentialSplitPipeImpact(forged), /immutable structural-topology/);

const forgedSource = structuredClone(preview);
forgedSource.validatorSource.splitGeometry.splitPosition.x = 999;
let forgedSourceMaterial = { ...forgedSource }; delete forgedSourceMaterial.previewFingerprint;
forgedSource.previewFingerprint = sequentialSemanticFingerprint('SSKSPLITPIPEIMPACT', forgedSourceMaterial);
assert.throws(() => assertSequentialSplitPipeImpact(forgedSource), /immutable structural-topology/);

const forgedEndpoint = structuredClone(preview);
forgedEndpoint.endpoints[0].position.x = 3;
forgedSourceMaterial = { ...forgedEndpoint }; delete forgedSourceMaterial.previewFingerprint;
forgedEndpoint.previewFingerprint = sequentialSemanticFingerprint('SSKSPLITPIPEIMPACT', forgedSourceMaterial);
assert.throws(() => assertSequentialSplitPipeImpact(forgedEndpoint), /immutable structural-topology/);


const forgedPartGeometry = structuredClone(preview);
forgedPartGeometry.geometryPart.geometry.start.x = 4;
forgedSourceMaterial = { ...forgedPartGeometry }; delete forgedSourceMaterial.previewFingerprint;
forgedPartGeometry.previewFingerprint = sequentialSemanticFingerprint('SSKSPLITPIPEIMPACT', forgedSourceMaterial);
assert.throws(() => assertSequentialSplitPipeImpact(forgedPartGeometry), /immutable structural-topology/);

console.log('sequential SPLIT_PIPE impact preview tests: PASS');
