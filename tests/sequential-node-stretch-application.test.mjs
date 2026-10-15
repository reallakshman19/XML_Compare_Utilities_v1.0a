import assert from 'node:assert/strict';
import { stableToken } from '../tabs/sequential-sketcher/sequential-sketcher-contract.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { createSequentialConstructionSession, runConstructionUntilBlocked } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import { createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { createSequentialGeometryEditBoundary } from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-boundary.js';
import { createSequentialScopedEditReadModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js';
import { createSequentialEditableTopologySnapshot } from '../tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-snapshot.js';
import { selectSequentialNodeStretchComponent, createSequentialNodeStretchTarget } from '../tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-target.js';
import { createSequentialNodeStretchDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-draft.js';
import { createSequentialNodeStretchApplicationService } from '../tabs/sequential-sketcher/scoped-edit/sequential-node-stretch-application.js';

const BRANCH = '/STRETCH/APPLY';
const records = [{ type: 'BRANCH', name: BRANCH,
  attributes: { NAME: BRANCH, HPOS: { x: 0, y: 0, z: 0 } }, children: [
    { type: 'PIPE', name: 'P1', attributes: {
      APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 },
    } },
    { type: 'CAP', name: 'C1', attributes: { APOS: { x: 100, y: 0, z: 0 } } },
  ] }];
const evidenceModel = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidenceModel);
const construction = runConstructionUntilBlocked(
  createSequentialConstructionSession(BRANCH), evidenceModel, indexes,
);
assert.equal(construction.session.state, 'ROUTE_COMPLETE');
const session = construction.session;
const confirmedConstruction = createConfirmedSequentialConstruction(session, indexes);
const ownerBridge = createSequentialEngineeringSvgOwnerBridge({ readOwnerState: () => ({
  session, evidenceModel, indexes, confirmedConstruction, visibleProjection: 'ISO',
}) });
const ownerSnapshot = ownerBridge.getSnapshot();
const baseReadModel = createSequentialScopedEditReadModel(ownerSnapshot);
const baseScene = buildSequentialScopedEditEngineeringScene(baseReadModel);
const branchRegistry = createSequentialBranchWorkspaceRegistry();
branchRegistry.reset([BRANCH]); branchRegistry.save(BRANCH, { session });
const sourceFingerprint = `STRETCH-SOURCE-${stableToken(JSON.stringify(records))}`;
const journalState = createSequentialJournalAdoption({
  documentId: `sequential-document:${sourceFingerprint}`,
  sessionId: `sequential-session:${sourceFingerprint}`,
  sourceFingerprint, branchRegistry, adoptedAt: '2026-07-28T19:15:00.000Z',
});
const state = { sourceFingerprint, session, branchRegistry, journalState,
  confirmedConstruction, supportProjection: null, ownerSnapshot };
let publicationCount = 0;
const boundary = createSequentialGeometryEditBoundary({
  readBaseState: () => state,
  readBaseView: () => ({ readModel: baseReadModel, scene: baseScene }),
  onPublished: () => { publicationCount += 1; },
});
const view = boundary.readView();
const topology = createSequentialEditableTopologySnapshot(view.readModel);
const pipe = topology.components.find((row) => row.canonicalType === 'PIPE');
const handle = topology.selectionCandidates.find((row) => row.resolvedComponentId === pipe.componentId)
  .sceneEntityId;
const selection = selectSequentialNodeStretchComponent({ objectId: handle,
  readModel: view.readModel, scene: view.scene });
const node = selection.nodes.find((row) => row.affectedComponentIds.length > 1)
  || selection.nodes.at(-1);
const target = createSequentialNodeStretchTarget({ selection, nodeId: node.nodeId,
  readModel: view.readModel, scene: view.scene });
const store = createSequentialNodeStretchDraftStore();
const targetPosition = { x: node.position.x + 20, y: node.position.y, z: node.position.z };
const preview = store.stage({ target, targetPosition,
  profile: { minimumLengthMm: 1, zeroLengthToleranceMm: 1e-9,
    collinearityTolerance: 1e-9 } });
const service = createSequentialNodeStretchApplicationService({
  readCurrentState: boundary.readCurrentState,
  readView: boundary.readView,
  readJournal: boundary.readJournal,
  publishCandidate: boundary.publishCandidate,
  now: () => '2026-07-28T19:16:00.000Z',
});
const prepared = service.prepare(preview, { actorId: 'STRETCH_TEST',
  reason: 'Qualified connected node stretch reviewed.', evidenceNote: 'Exact target verified.' });
assert.equal(prepared.publicationState, 'NOT_PUBLISHED');
assert.equal(boundary.readJournal().entries.length, 0);
assert.equal(prepared.candidate.entry.type, 'STRETCH_NODE');
const acceptance = service.accept(prepared);
assert.equal(acceptance.accepted, true);
assert.equal(acceptance.publication.schema, 'SequentialNodeStretchPublication.v1');
assert.equal(publicationCount, 1);
assert.equal(boundary.readJournal().entries.length, 1);
const effective = boundary.readView();
const effectiveTopology = createSequentialEditableTopologySnapshot(effective.readModel);
assert.deepEqual(effectiveTopology.nodes.find((row) => row.nodeId === node.nodeId).position,
  targetPosition);
assert(effectiveTopology.ports.filter((row) => row.nodeId === node.nodeId)
  .every((row) => row.position.x === targetPosition.x));
assert.equal(service.accept(prepared).accepted, false,
  'accepted prepared stretch must become stale after journal publication');
assert.equal(boundary.getState().branches[0].consumedPreparedCount, 1);
store.destroy(); boundary.destroy(); ownerBridge.destroy();
console.log('Sequential node stretch application: ok');
