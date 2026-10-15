import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTopologyJunctionDefinitionPreservationController, _test } from
  '../tabs/topology-trace-validator/topology-junction-definition-preservation-controller.js';

const CREATED_AT = '2026-07-29T18:50:00.000Z';
const clicked = [];
const documentRef = { createElement() { return { click() { clicked.push(this.download); } }; } };
const command = { schema: 'TopologyEditCommand.v1', id: 'EC-000008',
  type: 'ADD_JUNCTION_DEFINITION', payload: { nodeId: 'N2', edgeIds: ['E1', 'E2', 'E3'] } };
const canonical = { schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'junction-ui-1',
  nodes: [{ id: 'N1', position: { x: 0, y: 0, z: 0 }, sourcePaths: ['$[0].from'] },
    { id: 'N2', position: { x: 100, y: 0, z: 0 }, sourcePaths: ['$[0].to'] },
    { id: 'N3', position: { x: 200, y: 0, z: 0 }, sourcePaths: ['$[1].to'] },
    { id: 'N4', position: { x: 100, y: 100, z: 0 }, sourcePaths: ['$[2].to'] }],
  edges: [{ id: 'E1', fromNodeId: 'N1', toNodeId: 'N2', sourcePaths: ['$[0].edge'],
    sourceEntityIds: ['SE-1'], inputXmlElementIds: ['IX-1'] },
  { id: 'E2', fromNodeId: 'N2', toNodeId: 'N3', sourcePaths: ['$[1].edge'],
    sourceEntityIds: ['SE-2'], inputXmlElementIds: ['IX-2'] },
  { id: 'E3', fromNodeId: 'N2', toNodeId: 'N4', sourcePaths: ['$[2].edge'],
    sourceEntityIds: ['SE-3'], inputXmlElementIds: ['IX-3'] }],
  supports: [], rigids: [], bends: [], boundaries: [], pointFeatures: [],
  junctions: [{ id: 'EDIT-JUNCTION-EC-000008', nodeId: 'N2', edgeIds: ['E1', 'E2', 'E3'],
    position: { x: 100, y: 0, z: 0 }, sourceEntityIds: ['SE-1', 'SE-2', 'SE-3'],
    inputXmlElementIds: ['IX-1', 'IX-2', 'IX-3'], editAncestry: ['EC-000008'] }] };
const evidence = { selection: [{ kind: 'junction', id: 'EDIT-JUNCTION-EC-000008' }],
  editedArtifacts: { canonicalTopology: canonical },
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-ui-junction',
    commands: [command], redoCommands: [] }, commandAuthority: { authorityId: 'AUTH-UI-JUNCTION' },
  projectDocument: { schema: 'ProjectDocument.v1', documentId: 'DOC-UI-JUNCTION', slotId: 'candidate',
    fileName: 'ui-junction.json', sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64),
    stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM', verticalAxis: 'Z',
    coordinateFrame: 'GLOBAL', stats: { branchCount: 3, componentCount: 3, scanned: 3,
      matched: 3, filtered: 0 }, scope: { wildcard: '*', selectedIds: [] }, createdAt: CREATED_AT } };
const delegated = [];
const base = { evidence: () => evidence,
  runOperation(operation) { delegated.push(operation); return operation; } };
const controller = createTopologyJunctionDefinitionPreservationController(base,
  { documentRef, now: () => CREATED_AT });
const artifact = controller.runOperation('JUNCTION_PRESERVATION_EXPORT');
assert.equal(artifact.junctionDefinition.junctionId, 'EDIT-JUNCTION-EC-000008');
assert.equal(clicked.length, 1);
assert.equal(controller.runOperation('DELETE'), 'DELETE');
assert.deepEqual(delegated, ['DELETE']);
assert.equal(_test.selectedJunctionIntent(evidence).junctionId, 'EDIT-JUNCTION-EC-000008');
assert.throws(() => _test.selectedJunctionIntent({ selection: [] }), RangeError);
assert.throws(() => _test.selectedJunctionIntent({ selection: [
  { kind: 'junction', id: 'J1' }, { kind: 'edge', id: 'E1' },
] }), RangeError);
const registry = await readFile(new URL(
  '../tabs/topology-trace-validator/topology-edit-inspector-registry.js', import.meta.url), 'utf8');
const chain = await readFile(new URL(
  '../tabs/topology-trace-validator/topology-sequential-merge-nodes-controller.js', import.meta.url), 'utf8');
assert.match(registry, /JUNCTION_PRESERVATION_EXPORT/);
assert.match(registry, /Download junction preservation evidence/);
assert.match(chain, /createTopologyJunctionDefinitionPreservationController/);
assert.doesNotMatch(chain,
  /appendTopology|publishTopology|topologyJournal|geometryJournal|applicationService/i);
console.log('[PASS] visible junction preservation action, fail-closed selection and unchanged delegation');
