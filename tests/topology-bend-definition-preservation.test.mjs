import assert from 'node:assert/strict';
import {
  assertTopologyBendDefinitionPreservation,
  createTopologyBendDefinitionPreservation,
  topologyBendDefinitionPreservationFileName,
  validateTopologyBendDefinitionPreservation,
} from '../tabs/topology-trace-validator/topology-bend-definition-preservation.js';
import { semanticHash } from '../tabs/topology-trace-validator/topology-validator-values.js';

const CREATED_AT = '2026-07-29T17:20:00.000Z';
const command = Object.freeze({ schema: 'TopologyEditCommand.v1', id: 'EC-000007',
  type: 'ADD_BEND_DEFINITION', payload: Object.freeze({ nodeId: 'N2', edgeIds: ['E1', 'E2'],
    radiusMm: 150, angleDeg: 90, radiusAuthority: 'CATALOG' }) });
const projectDocument = Object.freeze({ schema: 'ProjectDocument.v1', documentId: 'DOC-BEND-1',
  slotId: 'candidate', fileName: 'bend-source.json', sourceHash: 'a'.repeat(64),
  scopedHash: 'b'.repeat(64), stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM',
  verticalAxis: 'Z', coordinateFrame: 'GLOBAL', stats: { branchCount: 1, componentCount: 2,
    scanned: 2, matched: 2, filtered: 0 }, scope: { wildcard: '*', selectedIds: [] },
  createdAt: CREATED_AT });
const canonical = Object.freeze({ schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'bend-topology-1',
  nodes: [
    { id: 'N1', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0].from'] },
    { id: 'N2', position: { x: 100, y: 0, z: 0 }, sourcePaths: ['$[0].to', '$[1].from'] },
    { id: 'N3', position: { x: 100, y: 100, z: 0 }, sourcePaths: ['$[1].to'] },
  ],
  edges: [
    { id: 'E1', fromNodeId: 'N1', toNodeId: 'N2', sourcePaths: ['$[0].edge'],
      sourceEntityIds: ['SE-1'], inputXmlElementIds: ['IX-1'] },
    { id: 'E2', fromNodeId: 'N2', toNodeId: 'N3', sourcePaths: ['$[1].edge'],
      sourceEntityIds: ['SE-2'], inputXmlElementIds: ['IX-2'] },
  ],
  supports: [], rigids: [], junctions: [], boundaries: [], pointFeatures: [],
  bends: [{ id: 'EDIT-BEND-EC-000007', nodeId: 'N2', edgeIds: ['E1', 'E2'],
    position: { x: 100, y: 0, z: 0 }, radiusMm: 150, angleDeg: 90,
    radiusAuthority: 'CATALOG', sourceEntityIds: ['SE-1', 'SE-2'],
    inputXmlElementId: 'IX-1', editAncestry: ['EC-000007'] }] });
const input = Object.freeze({ canonical,
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-bend-1',
    commands: [command], redoCommands: [] },
  commandAuthority: { authorityId: 'AUTH-BEND-1' }, projectDocument,
  bendId: 'EDIT-BEND-EC-000007', createdAt: CREATED_AT });

const evidence = createTopologyBendDefinitionPreservation(input);
assert.equal(evidence.activeCommand.commandId, 'EC-000007');
assert.deepEqual(evidence.draftReplayEvidence.activeCommandIds, ['EC-000007']);
assert.deepEqual(evidence.draftReplayEvidence.redoCommandIds, []);
assert.equal(evidence.bendDefinition.bendId, 'EDIT-BEND-EC-000007');
assert.deepEqual(evidence.routeArms.map((row) => row.edgeId), ['E1', 'E2']);
assert.deepEqual(evidence.targetEvidence.entityIds, ['E1', 'E2', 'N2']);
assert.deepEqual(evidence.targetEvidence.sourcePaths,
  ['$[0].edge', '$[0].to', '$[1].edge', '$[1].from']);
assert.deepEqual(evidence.targetEvidence.sourceBranchIndexes, [0, 1]);
assert.equal(evidence.preservation.authorityOwner, 'TOPOLOGY_VALIDATOR');
assert.equal(evidence.preservation.coverage, 'PRESERVED_SEPARATELY');
assert.equal(evidence.preservation.completedGate, 'SSK-TTV-CONV-8');
assert.equal(evidence.preservation.candidateSequentialOperation, null);
assert.equal(evidence.preservation.sequentialPublicationState, 'NOT_APPLICABLE');
assert.equal(Object.isFrozen(evidence), true);
assert.equal(assertTopologyBendDefinitionPreservation(evidence), evidence);
assert.equal(validateTopologyBendDefinitionPreservation(evidence, input).preservationFingerprint,
  evidence.preservationFingerprint);
assert.equal(topologyBendDefinitionPreservationFileName(evidence, 'model.json'),
  'model.EDIT-BEND-EC-000007.topology-bend-definition-preservation.v1.json');

const redoInput = { ...input, draft: { ...input.draft, commands: [], redoCommands: [command] } };
assert.throws(() => createTopologyBendDefinitionPreservation(redoInput),
  (error) => error.code === 'TOPOLOGY_BEND_PRESERVATION_COMMAND_INVALID');
const duplicateCommand = { ...command, payload: { ...command.payload, edgeIds: ['E1', 'E1'] } };
assert.throws(() => createTopologyBendDefinitionPreservation({ ...input,
  draft: { ...input.draft, commands: [duplicateCommand] } }),
(error) => error.code === 'TOPOLOGY_BEND_PRESERVATION_COMMAND_INVALID');
const nonIncident = { ...canonical, edges: canonical.edges.map((row) =>
  row.id === 'E2' ? { ...row, fromNodeId: 'N3', toNodeId: 'N1' } : row) };
assert.throws(() => createTopologyBendDefinitionPreservation({ ...input, canonical: nonIncident }),
  (error) => error.code === 'TOPOLOGY_BEND_PRESERVATION_BEND_INVALID');
const sourceMismatch = { ...canonical, bends: [{ ...canonical.bends[0], sourceEntityIds: ['SE-1'] }] };
assert.throws(() => createTopologyBendDefinitionPreservation({ ...input, canonical: sourceMismatch }),
  (error) => error.code === 'TOPOLOGY_BEND_PRESERVATION_ANCESTRY_INVALID');
const inputMismatch = { ...canonical, bends: [{ ...canonical.bends[0], inputXmlElementId: 'IX-X' }] };
assert.throws(() => createTopologyBendDefinitionPreservation({ ...input, canonical: inputMismatch }),
  (error) => error.code === 'TOPOLOGY_BEND_PRESERVATION_ANCESTRY_INVALID');

function refingerprint(value) {
  const material = { ...value }; delete material.preservationFingerprint;
  value.preservationFingerprint = semanticHash(material); return value;
}
const forgedBend = structuredClone(evidence);
forgedBend.bendDefinition.canonicalRecord.radiusMm = 200; refingerprint(forgedBend);
assert.throws(() => assertTopologyBendDefinitionPreservation(forgedBend),
  (error) => error.code === 'TOPOLOGY_BEND_PRESERVATION_EVIDENCE_INVALID');
const forgedCommand = structuredClone(evidence);
forgedCommand.activeCommand.canonicalRecord.payload.angleDeg = 45; refingerprint(forgedCommand);
assert.throws(() => assertTopologyBendDefinitionPreservation(forgedCommand),
  (error) => error.code === 'TOPOLOGY_BEND_PRESERVATION_EVIDENCE_INVALID');
const forgedTarget = structuredClone(evidence);
forgedTarget.targetEvidence.entityIds = ['E1', 'N2']; refingerprint(forgedTarget);
assert.throws(() => assertTopologyBendDefinitionPreservation(forgedTarget),
  (error) => error.code === 'TOPOLOGY_BEND_PRESERVATION_EVIDENCE_INVALID');
const forgedNode = structuredClone(evidence);
forgedNode.bendNode.nodeId = 'N9';
forgedNode.bendNode.canonicalRecord.id = 'N9';
forgedNode.targetEvidence.entityIds = ['E1', 'E2', 'N9']; refingerprint(forgedNode);
assert.throws(() => assertTopologyBendDefinitionPreservation(forgedNode),
  (error) => error.code === 'TOPOLOGY_BEND_PRESERVATION_EVIDENCE_INVALID');
const forgedArm = structuredClone(evidence);
forgedArm.routeArms[1].edgeId = 'E9';
forgedArm.routeArms[1].canonicalRecord.id = 'E9'; refingerprint(forgedArm);
assert.throws(() => assertTopologyBendDefinitionPreservation(forgedArm),
  (error) => error.code === 'TOPOLOGY_BEND_PRESERVATION_EVIDENCE_INVALID');
const forgedReplay = structuredClone(evidence);
forgedReplay.draftReplayEvidence.activeCommandIds = [];
forgedReplay.draftReplayEvidence.redoCommandIds = ['EC-000007']; refingerprint(forgedReplay);
assert.throws(() => assertTopologyBendDefinitionPreservation(forgedReplay),
  (error) => error.code === 'TOPOLOGY_BEND_PRESERVATION_EVIDENCE_INVALID');
const forgedAuthority = structuredClone(evidence);
forgedAuthority.validatorAuthority.sourceHash = 'not-a-hash'; refingerprint(forgedAuthority);
assert.throws(() => assertTopologyBendDefinitionPreservation(forgedAuthority),
  (error) => error.code === 'TOPOLOGY_BEND_PRESERVATION_EVIDENCE_INVALID');
const forgedDisposition = structuredClone(evidence);
forgedDisposition.preservation.candidateSequentialOperation = 'ADD_BEND'; refingerprint(forgedDisposition);
assert.throws(() => assertTopologyBendDefinitionPreservation(forgedDisposition),
  (error) => error.code === 'TOPOLOGY_BEND_PRESERVATION_EVIDENCE_INVALID');
const staleCanonical = { ...canonical, nodes: canonical.nodes.map((row) =>
  row.id === 'N2' ? { ...row, position: { x: 101, y: 0, z: 0 } } : row) };
assert.throws(() => validateTopologyBendDefinitionPreservation(evidence, { ...input,
  canonical: staleCanonical }),
(error) => ['TOPOLOGY_BEND_PRESERVATION_ANCESTRY_INVALID',
  'TOPOLOGY_BEND_PRESERVATION_EVIDENCE_INVALID'].includes(error.code));
console.log('[PASS] bend command, geometry, ancestry, authority, tamper and regeneration');
