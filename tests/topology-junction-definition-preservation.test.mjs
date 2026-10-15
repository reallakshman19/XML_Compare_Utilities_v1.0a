import assert from 'node:assert/strict';
import {
  assertTopologyJunctionDefinitionPreservation,
  createTopologyJunctionDefinitionPreservation,
  topologyJunctionDefinitionPreservationFileName,
  validateTopologyJunctionDefinitionPreservation,
} from '../tabs/topology-trace-validator/topology-junction-definition-preservation.js';
import { semanticHash } from '../tabs/topology-trace-validator/topology-validator-values.js';

const CREATED_AT = '2026-07-29T18:50:00.000Z';
const command = Object.freeze({ schema: 'TopologyEditCommand.v1', id: 'EC-000008',
  type: 'ADD_JUNCTION_DEFINITION', payload: Object.freeze({ nodeId: 'N2',
    edgeIds: ['E3', 'E1', 'E2'] }) });
const projectDocument = Object.freeze({ schema: 'ProjectDocument.v1', documentId: 'DOC-JUNCTION-1',
  slotId: 'candidate', fileName: 'junction-source.json', sourceHash: 'a'.repeat(64),
  scopedHash: 'b'.repeat(64), stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM',
  verticalAxis: 'Z', coordinateFrame: 'GLOBAL', stats: { branchCount: 3, componentCount: 3,
    scanned: 3, matched: 3, filtered: 0 }, scope: { wildcard: '*', selectedIds: [] },
  createdAt: CREATED_AT });
const canonical = Object.freeze({ schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'junction-topology-1',
  nodes: [
    { id: 'N1', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0].from'] },
    { id: 'N2', position: { x: 100, y: 0, z: 0 }, sourcePaths: ['$[0].to', '$[1].from', '$[2].from'] },
    { id: 'N3', position: { x: 200, y: 0, z: 0 }, sourcePaths: ['$[1].to'] },
    { id: 'N4', position: { x: 100, y: 100, z: 0 }, sourcePaths: ['$[2].to'] },
  ],
  edges: [
    { id: 'E1', fromNodeId: 'N1', toNodeId: 'N2', sourcePaths: ['$[0].edge'],
      sourceEntityIds: ['SE-1'], inputXmlElementIds: ['IX-1'] },
    { id: 'E2', fromNodeId: 'N2', toNodeId: 'N3', sourcePaths: ['$[1].edge'],
      sourceEntityIds: ['SE-2'], inputXmlElementIds: ['IX-2'] },
    { id: 'E3', fromNodeId: 'N2', toNodeId: 'N4', sourcePaths: ['$[2].edge'],
      sourceEntityIds: ['SE-3'], inputXmlElementIds: ['IX-3'] },
  ], supports: [], rigids: [], bends: [], boundaries: [], pointFeatures: [],
  junctions: [{ id: 'EDIT-JUNCTION-EC-000008', nodeId: 'N2', edgeIds: ['E1', 'E2', 'E3'],
    position: { x: 100, y: 0, z: 0 }, sourceEntityIds: ['SE-1', 'SE-2', 'SE-3'],
    inputXmlElementIds: ['IX-1', 'IX-2', 'IX-3'], editAncestry: ['EC-000008'] }] });
const input = Object.freeze({ canonical,
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-junction-1',
    commands: [command], redoCommands: [] },
  commandAuthority: { authorityId: 'AUTH-JUNCTION-1' }, projectDocument,
  junctionId: 'EDIT-JUNCTION-EC-000008', createdAt: CREATED_AT });

const evidence = createTopologyJunctionDefinitionPreservation(input);
assert.equal(evidence.activeCommand.commandId, 'EC-000008');
assert.deepEqual(evidence.activeCommand.payload.edgeIds, ['E1', 'E2', 'E3']);
assert.deepEqual(evidence.routeArms.map((row) => row.edgeId), ['E1', 'E2', 'E3']);
assert.deepEqual(evidence.targetEvidence.entityIds, ['E1', 'E2', 'E3', 'N2']);
assert.deepEqual(evidence.targetEvidence.sourceEntityIds, ['SE-1', 'SE-2', 'SE-3']);
assert.deepEqual(evidence.targetEvidence.inputXmlElementIds, ['IX-1', 'IX-2', 'IX-3']);
assert.deepEqual(evidence.targetEvidence.sourceBranchIndexes, [0, 1, 2]);
assert.equal(evidence.preservation.completedGate, 'SSK-TTV-CONV-9');
assert.equal(evidence.preservation.candidateSequentialOperation, null);
assert.equal(evidence.preservation.sequentialPublicationState, 'NOT_APPLICABLE');
assert.equal(Object.isFrozen(evidence), true);
assert.equal(assertTopologyJunctionDefinitionPreservation(evidence), evidence);
assert.equal(validateTopologyJunctionDefinitionPreservation(evidence, input).preservationFingerprint,
  evidence.preservationFingerprint);
assert.equal(topologyJunctionDefinitionPreservationFileName(evidence, 'model.json'),
  'model.EDIT-JUNCTION-EC-000008.topology-junction-definition-preservation.v1.json');

const redoInput = { ...input, draft: { ...input.draft, commands: [], redoCommands: [command] } };
assert.throws(() => createTopologyJunctionDefinitionPreservation(redoInput),
  (error) => error.code === 'TOPOLOGY_JUNCTION_PRESERVATION_COMMAND_INVALID');
const duplicateArm = { ...command, payload: { ...command.payload, edgeIds: ['E1', 'E2', 'E2'] } };
assert.throws(() => createTopologyJunctionDefinitionPreservation({ ...input,
  draft: { ...input.draft, commands: [duplicateArm] } }),
(error) => error.code === 'TOPOLOGY_JUNCTION_PRESERVATION_COMMAND_INVALID');
const incomplete = { ...command, payload: { ...command.payload, edgeIds: ['E1', 'E2', 'E3'] } };
const extraIncident = { ...canonical, edges: [...canonical.edges,
  { id: 'E4', fromNodeId: 'N2', toNodeId: 'N1', sourceEntityIds: ['SE-4'], inputXmlElementIds: ['IX-4'] }] };
assert.throws(() => createTopologyJunctionDefinitionPreservation({ ...input, canonical: extraIncident,
  draft: { ...input.draft, commands: [incomplete] } }),
(error) => error.code === 'TOPOLOGY_JUNCTION_PRESERVATION_JUNCTION_INVALID');
const sourceMismatch = { ...canonical, junctions: [{ ...canonical.junctions[0], sourceEntityIds: ['SE-1'] }] };
assert.throws(() => createTopologyJunctionDefinitionPreservation({ ...input, canonical: sourceMismatch }),
  (error) => error.code === 'TOPOLOGY_JUNCTION_PRESERVATION_ANCESTRY_INVALID');
const inputMismatch = { ...canonical, junctions: [{ ...canonical.junctions[0], inputXmlElementIds: ['IX-1'] }] };
assert.throws(() => createTopologyJunctionDefinitionPreservation({ ...input, canonical: inputMismatch }),
  (error) => error.code === 'TOPOLOGY_JUNCTION_PRESERVATION_ANCESTRY_INVALID');

function refingerprint(value) {
  const material = { ...value }; delete material.preservationFingerprint;
  value.preservationFingerprint = semanticHash(material); return value;
}
const forgeries = [
  (value) => { value.activeCommand.canonicalRecord.payload.edgeIds = ['E1', 'E2', 'E4']; },
  (value) => { value.junctionDefinition.canonicalRecord.nodeId = 'N9'; },
  (value) => { value.junctionNode.position.x = 999; },
  (value) => { value.routeArms[2].edgeId = 'E9'; value.routeArms[2].canonicalRecord.id = 'E9'; },
  (value) => { value.targetEvidence.sourceEntityIds = ['SE-1']; },
  (value) => { value.targetEvidence.inputXmlElementIds = ['IX-1']; },
  (value) => { value.draftReplayEvidence.activeCommandIds = []; value.draftReplayEvidence.redoCommandIds = ['EC-000008']; },
  (value) => { value.validatorAuthority.sourceHash = 'not-a-hash'; },
  (value) => { value.preservation.candidateSequentialOperation = 'ADD_JUNCTION'; },
];
for (const forge of forgeries) {
  const value = structuredClone(evidence); forge(value); refingerprint(value);
  assert.throws(() => assertTopologyJunctionDefinitionPreservation(value),
    (error) => error.code === 'TOPOLOGY_JUNCTION_PRESERVATION_EVIDENCE_INVALID');
}
const staleCanonical = { ...canonical, nodes: canonical.nodes.map((row) =>
  row.id === 'N2' ? { ...row, position: { x: 101, y: 0, z: 0 } } : row) };
assert.throws(() => validateTopologyJunctionDefinitionPreservation(evidence, { ...input,
  canonical: staleCanonical }),
(error) => ['TOPOLOGY_JUNCTION_PRESERVATION_ANCESTRY_INVALID',
  'TOPOLOGY_JUNCTION_PRESERVATION_EVIDENCE_INVALID'].includes(error.code));
console.log('[PASS] junction command, complete incidence, ancestry, authority, tamper and regeneration');
