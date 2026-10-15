import assert from 'node:assert/strict';
import { _test as snapshotTest } from '../tabs/topology-trace-validator/topology-scoped-edit-production-snapshot.js';

const canonical = Object.freeze({ schema: 'CanonicalTopology.v1', canonicalTopologyHash: 'CAN-A0',
  coordinateFrame: Object.freeze({ schema: 'ManagedStage.XYZ.v1', unit: 'mm' }),
  nodes: Object.freeze([{ id: 'N1', sourcePaths: ['$[0]'], position: { x: 0, y: 0, z: 0 } }]),
  edges: Object.freeze([]), supports: Object.freeze([]), rigids: Object.freeze([]),
  junctions: Object.freeze([]), boundaries: Object.freeze([]), bends: Object.freeze([]),
  pointFeatures: Object.freeze([]) });
const draft = Object.freeze({ schema: 'TopologyEditDraft.v1', baseCanonicalTopologyHash: 'BASE',
  topologyEditDraftHash: 'DRAFT-A0', commands: Object.freeze([]), redoCommands: Object.freeze([]),
  engineeringOverrides: Object.freeze({}), settings: Object.freeze({}), nextCommandSequence: 1 });
const ledger = Object.freeze({ schema: 'AttributeEditLedger.v1', edits: Object.freeze([]),
  redoEdits: Object.freeze([]), nextSequence: 1 });
const journal = Object.freeze({ schema: 'CommandJournal.v1', journalId: 'J1', sessionId: 'S1',
  documentId: 'D1', createdAt: '2026-07-26T00:00:00.000Z', updatedAt: '2026-07-26T00:00:00.000Z',
  entries: Object.freeze([]), activeCommandIds: Object.freeze([]), redoCommandIds: Object.freeze([]),
  checkpoints: Object.freeze([]), nextSequence: 1 });
const authority = Object.freeze({ schema: 'TopologyScopedEditAuthorityBasis.v1', authorityId: 'A0',
  documentId: 'D1', sourceHash: 'SRC', baseCanonicalTopologyHash: 'BASE', currentDraftHash: 'DRAFT-A0' });
const edit = Object.freeze({ baseArtifacts: Object.freeze({ canonicalTopology: canonical }),
  editedArtifacts: Object.freeze({ editDraft: draft, canonicalTopology: canonical,
    editLedger: Object.freeze({ schema: 'TopologyEditLedger.v1', entries: Object.freeze([]) }),
    editValidation: Object.freeze({ schema: 'TopologyEditValidation.v1', findings: Object.freeze([]) }) }),
  draft, selection: Object.freeze([{ kind: 'node', id: 'N1' }]), projectSession: Object.freeze({ sessionId: 'S1' }),
  projectDocument: Object.freeze({ documentId: 'D1', fileName: 'model.json', sourceHash: 'SRC', unit: 'MM',
    verticalAxis: 'Y', coordinateFrame: 'UNKNOWN' }), commandJournal: journal, commandAuthority: authority,
  attributeLedger: ledger, remarks: Object.freeze({}), editScope: null });
const workspaceEvidence = Object.freeze({ trace: Object.freeze({ artifacts: Object.freeze({
  source: Object.freeze({ raw: Object.freeze([{ id: 'branch-1' }]) }), canonical }),
  fileNames: Object.freeze({ source: 'model.json' }) }) });
const controller = Object.freeze({ evidence: () => workspaceEvidence,
  edit: Object.freeze({ evidence: () => edit }), modelMode: () => Object.freeze({ kind: 'SMALL_FULL' }) });
const core = Object.freeze({ createTopologyEditDraft: () => draft });
const sourceKey = (await import('../tabs/topology-trace-validator/topology-scoped-edit-production-snapshot.js'))
  .topologyProductionShadowSourceKey({ controller, root: {} });
assert(sourceKey);
const snapshot = await snapshotTest.createWithCore({ controller, root: {} }, core);
assert.equal(snapshot.schema, 'TopologyProductionShadowSnapshot.v1');
assert.equal(snapshot.authority.authorityId, 'A0');
assert.deepEqual(snapshot.selectionSnapshot.entityIds, ['N1']);
assert.deepEqual(snapshot.commandScopeBasis.editableEntityIds, ['N1']);
assert.equal(snapshot.coordinateSystemEvidence.authority, 'CanonicalTopology.v1');
assert(Object.isFrozen(snapshot));
console.log('[PASS] live Topology edit evidence produces one immutable P4B shadow snapshot');
