import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTopologyBendDefinitionPreservationController, _test } from
  '../tabs/topology-trace-validator/topology-bend-definition-preservation-controller.js';

const CREATED_AT = '2026-07-29T17:20:00.000Z';
const clicked = [];
const documentRef = { createElement() { return { click() { clicked.push(this.download); } }; } };
const command = { schema: 'TopologyEditCommand.v1', id: 'EC-000007',
  type: 'ADD_BEND_DEFINITION', payload: { nodeId: 'N2', edgeIds: ['E1', 'E2'],
    radiusMm: 150, angleDeg: 90, radiusAuthority: 'CATALOG' } };
const canonical = { schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'bend-ui-1',
  nodes: [{ id: 'N1', position: { x: 0, y: 0, z: 0 } },
    { id: 'N2', position: { x: 100, y: 0, z: 0 } },
    { id: 'N3', position: { x: 100, y: 100, z: 0 } }],
  edges: [{ id: 'E1', fromNodeId: 'N1', toNodeId: 'N2', sourceEntityIds: ['SE-1'],
    inputXmlElementIds: ['IX-1'] },
  { id: 'E2', fromNodeId: 'N2', toNodeId: 'N3', sourceEntityIds: ['SE-2'],
    inputXmlElementIds: ['IX-2'] }],
  supports: [], rigids: [], junctions: [], boundaries: [], pointFeatures: [],
  bends: [{ id: 'EDIT-BEND-EC-000007', nodeId: 'N2', edgeIds: ['E1', 'E2'],
    position: { x: 100, y: 0, z: 0 }, radiusMm: 150, angleDeg: 90,
    radiusAuthority: 'CATALOG', sourceEntityIds: ['SE-1', 'SE-2'],
    inputXmlElementId: 'IX-1', editAncestry: ['EC-000007'] }] };
const evidence = { selection: [{ kind: 'bend', id: 'EDIT-BEND-EC-000007' }],
  editedArtifacts: { canonicalTopology: canonical },
  draft: { schema: 'TopologyEditDraft.v1', topologyEditDraftHash: 'draft-ui-bend',
    commands: [command], redoCommands: [] }, commandAuthority: { authorityId: 'AUTH-UI-BEND' },
  projectDocument: { schema: 'ProjectDocument.v1', documentId: 'DOC-UI-BEND', slotId: 'candidate',
    fileName: 'ui-bend.json', sourceHash: 'a'.repeat(64), scopedHash: 'b'.repeat(64),
    stagedSchema: 'StagedJSON.v1', rootShape: 'ARRAY', unit: 'MM', verticalAxis: 'Z',
    coordinateFrame: 'GLOBAL', stats: { branchCount: 1, componentCount: 2, scanned: 2,
      matched: 2, filtered: 0 }, scope: { wildcard: '*', selectedIds: [] }, createdAt: CREATED_AT } };
const delegated = [];
const base = { evidence: () => evidence,
  runOperation(operation) { delegated.push(operation); return operation; } };
const controller = createTopologyBendDefinitionPreservationController(base,
  { documentRef, now: () => CREATED_AT });
const artifact = controller.runOperation('BEND_PRESERVATION_EXPORT');
assert.equal(artifact.bendDefinition.bendId, 'EDIT-BEND-EC-000007');
assert.equal(clicked.length, 1);
assert.equal(controller.runOperation('DELETE'), 'DELETE');
assert.deepEqual(delegated, ['DELETE']);
assert.equal(_test.selectedBendIntent(evidence).bendId, 'EDIT-BEND-EC-000007');
assert.throws(() => _test.selectedBendIntent({ selection: [] }), RangeError);
assert.throws(() => _test.selectedBendIntent({ selection: [
  { kind: 'bend', id: 'B1' }, { kind: 'edge', id: 'E1' },
] }), RangeError);
const registry = await readFile(new URL(
  '../tabs/topology-trace-validator/topology-edit-inspector-registry.js', import.meta.url), 'utf8');
const chain = await readFile(new URL(
  '../tabs/topology-trace-validator/topology-sequential-merge-nodes-controller.js', import.meta.url), 'utf8');
assert.match(registry, /BEND_PRESERVATION_EXPORT/);
assert.match(registry, /Download bend preservation evidence/);
assert.match(chain, /createTopologyBendDefinitionPreservationController/);
assert.doesNotMatch(chain,
  /appendTopology|publishTopology|topologyJournal|geometryJournal|applicationService/i);
console.log('[PASS] visible bend preservation action, fail-closed selection and unchanged delegation');
