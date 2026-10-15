import assert from 'node:assert/strict';
import { stableToken } from '../tabs/sequential-sketcher/sequential-sketcher-contract.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import { createSequentialConstructionSession,
  runConstructionUntilBlocked } from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import { buildSequentialEvidenceModel,
  indexSequentialEvidence } from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import { createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { createSequentialGeometryEditBoundary } from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-boundary.js';
import { createSequentialTopologyEditBoundary } from '../tabs/sequential-sketcher/scoped-edit/sequential-topology-edit-boundary.js';
import { createSequentialScopedEditReadModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js';
import { createSequentialEditableTopologySnapshot } from '../tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-snapshot.js';
import { selectSequentialPipeSplitTarget } from '../tabs/sequential-sketcher/scoped-edit/sequential-pipe-split-target.js';
import { createSequentialPipeSplitDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-pipe-split-draft.js';
import { createSequentialPipeSplitApplicationService } from '../tabs/sequential-sketcher/scoped-edit/sequential-pipe-split-application.js';

const BRANCH = '/SPLIT/APPLY';
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
const sourceFingerprint = `SPLIT-SOURCE-${stableToken(JSON.stringify(records))}`;
const journalState = createSequentialJournalAdoption({
  documentId: `sequential-document:${sourceFingerprint}`,
  sessionId: `sequential-session:${sourceFingerprint}`,
  sourceFingerprint, branchRegistry, adoptedAt: '2026-07-29T04:25:00.000Z',
});
const state = { sourceFingerprint, session, branchRegistry, journalState,
  confirmedConstruction, supportProjection: null, ownerSnapshot };
const geometryBoundary = createSequentialGeometryEditBoundary({
  readBaseState: () => state,
  readBaseView: () => ({ readModel: baseReadModel, scene: baseScene }),
  onPublished: () => {},
});
let publicationCount = 0;
const topologyBoundary = createSequentialTopologyEditBoundary({
  readBaseState: geometryBoundary.readCurrentState,
  readBaseView: geometryBoundary.readView,
  onPublished: () => { publicationCount += 1; },
});
const initialView = topologyBoundary.readView();
assert.equal(initialView.readModel.authorityId, geometryBoundary.readView().readModel.authorityId,
  'empty topology journal must expose current geometry authority');
const topology = createSequentialEditableTopologySnapshot(initialView.readModel);
const pipe = topology.components.find((row) => row.canonicalType === 'PIPE');
const handle = topology.selectionCandidates
  .find((row) => row.resolvedComponentId === pipe.componentId).sceneEntityId;
const target = selectSequentialPipeSplitTarget({ objectId: handle,
  readModel: initialView.readModel, scene: initialView.scene });
const store = createSequentialPipeSplitDraftStore();
const preview = store.stage({ target, mode: 'PARAMETER', parameter: 0.5,
  minimumEndDistance: 1, projectionTolerance: 1e-6 });
const service = createSequentialPipeSplitApplicationService({
  readCurrentState: topologyBoundary.readCurrentState,
  readView: topologyBoundary.readView,
  readJournal: topologyBoundary.readJournal,
  publishCandidate: topologyBoundary.publishCandidate,
  now: () => '2026-07-29T04:26:00.000Z',
});
const prepared = service.prepare(preview, { actorId: 'SPLIT_TEST',
  reason: 'Exact straight-pipe split reviewed.', evidenceNote: 'Child identities verified.' });
assert.equal(prepared.publicationState, 'NOT_PUBLISHED');
assert.equal(topologyBoundary.readJournal().cursor, 0);
assert.equal(prepared.candidate.entry.type, 'SPLIT_PIPE');
const acceptance = service.accept(prepared);
assert.equal(acceptance.accepted, true);
assert.equal(acceptance.publication.schema, 'SequentialPipeSplitPublication.v1');
assert.equal(publicationCount, 1);
assert.equal(topologyBoundary.readJournal().cursor, 1);
const effectiveView = topologyBoundary.readView();
const effective = createSequentialEditableTopologySnapshot(effectiveView.readModel);
assert(!effective.components.some((row) => row.componentId === target.parentComponentId));
assert(effective.components.some((row) =>
  row.componentId === preview.identities.upstreamComponentId));
assert(effective.components.some((row) =>
  row.componentId === preview.identities.downstreamComponentId));
assert(effective.nodes.some((row) => row.nodeId === preview.identities.splitNodeId));
assert(effective.committedConnections.some((row) =>
  row.connectionId === preview.identities.splitConnectionId));
assert.equal(effectiveView.scene.entities.filter((row) =>
  [preview.identities.upstreamGeometryPartId,
    preview.identities.downstreamGeometryPartId].includes(row.id)).length, 2);
assert.equal(service.accept(prepared).accepted, false,
  'accepted prepared split must become stale after topology publication');
const undo = topologyBoundary.undo();
assert.equal(undo.cursor, 0);
assert.equal(topologyBoundary.readView().readModel.authorityId,
  geometryBoundary.readView().readModel.authorityId);
assert(createSequentialEditableTopologySnapshot(topologyBoundary.readView().readModel)
  .components.some((row) => row.componentId === target.parentComponentId));
const redo = topologyBoundary.redo();
assert.equal(redo.cursor, 1);
assert(!createSequentialEditableTopologySnapshot(topologyBoundary.readView().readModel)
  .components.some((row) => row.componentId === target.parentComponentId));
assert.equal(topologyBoundary.getState().branches[0].consumedPreparedCount, 1);
store.destroy(); topologyBoundary.destroy(); geometryBoundary.destroy(); ownerBridge.destroy();
console.log('Sequential pipe split application: ok');
