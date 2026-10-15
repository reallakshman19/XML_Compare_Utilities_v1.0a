import assert from 'node:assert/strict';
import { stableToken } from '../tabs/sequential-sketcher/sequential-sketcher-contract.js';
import { createSequentialBranchWorkspaceRegistry } from '../tabs/sequential-sketcher/sequential-branch-workspace-state.js';
import { createConfirmedSequentialConstruction } from '../tabs/sequential-sketcher/construction/sequential-construction-acceptance.js';
import {
  createSequentialConstructionSession,
  runConstructionUntilBlocked,
} from '../tabs/sequential-sketcher/construction/sequential-construction-runtime.js';
import {
  buildSequentialEvidenceModel,
  indexSequentialEvidence,
} from '../tabs/sequential-sketcher/source/sequential-evidence-model.js';
import { createSequentialEngineeringSvgOwnerBridge } from '../tabs/sequential-sketcher/sequential-engineering-svg-owner-bridge.js';
import { createSequentialJournalAdoption } from '../tabs/sequential-sketcher/scoped-edit/sequential-command-service.js';
import { deriveSequentialEditAuthority } from '../tabs/sequential-sketcher/scoped-edit/sequential-edit-authority.js';
import { createSequentialEditableTopologySnapshot } from '../tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-snapshot.js';
import { createSequentialGeometryEditBoundary } from '../tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-boundary.js';
import { createSequentialScopedEditReadModel } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-scene-adapter.js';
import { createSequentialSingleEntityMoveApplicationService } from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-application.js';
import { createSequentialSingleEntityMoveDraftStore } from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-draft.js';
import { selectSequentialSingleEntityMoveTarget } from '../tabs/sequential-sketcher/scoped-edit/sequential-single-entity-move-target.js';

const BRANCH = '/GEOMETRY/APPLY';
const records = [{
  type: 'BRANCH', name: BRANCH,
  attributes: { NAME: BRANCH, HPOS: { x: 0, y: 0, z: 0 } },
  children: [{ type: 'PIPE', name: 'P1',
    attributes: { APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 100, y: 0, z: 0 } } }],
}];
const evidenceModel = buildSequentialEvidenceModel(records);
const indexes = indexSequentialEvidence(evidenceModel);
const result = runConstructionUntilBlocked(
  createSequentialConstructionSession(BRANCH), evidenceModel, indexes,
);
assert.equal(result.session.state, 'ROUTE_COMPLETE');
const session = result.session;
const confirmedConstruction = createConfirmedSequentialConstruction(session, indexes);
const ownerBridge = createSequentialEngineeringSvgOwnerBridge({ readOwnerState: () => ({
  session, evidenceModel, indexes, confirmedConstruction, visibleProjection: 'ISO',
}) });
const ownerSnapshot = ownerBridge.getSnapshot();
const baseReadModel = createSequentialScopedEditReadModel(ownerSnapshot);
const baseScene = buildSequentialScopedEditEngineeringScene(baseReadModel);
const branchRegistry = createSequentialBranchWorkspaceRegistry();
branchRegistry.reset([BRANCH]); branchRegistry.save(BRANCH, { session });
const sourceFingerprint = `GEOMETRY-SOURCE-${stableToken(JSON.stringify(records))}`;
const journalState = createSequentialJournalAdoption({
  documentId: `sequential-document:${sourceFingerprint}`,
  sessionId: `sequential-session:${sourceFingerprint}`,
  sourceFingerprint, branchRegistry, adoptedAt: '2026-07-28T19:05:00.000Z',
});
const state = {
  sourceFingerprint, session, branchRegistry, journalState,
  confirmedConstruction, supportProjection: null, ownerSnapshot,
};
let publicationCount = 0;
const boundary = createSequentialGeometryEditBoundary({
  readBaseState: () => state,
  readBaseView: () => ({ readModel: baseReadModel, scene: baseScene }),
  onPublished: () => { publicationCount += 1; },
});
const view = boundary.readView();
const topology = createSequentialEditableTopologySnapshot(view.readModel);
const handle = topology.selectionCandidates[0].sceneEntityId;
const target = selectSequentialSingleEntityMoveTarget({
  objectId: handle, readModel: view.readModel, scene: view.scene,
});
assert.equal(target.rigidMoveEligible, true);
assert.equal(target.boundaryCuts.length, 0);
const store = createSequentialSingleEntityMoveDraftStore();
const preview = store.stage({
  target, constraint: 'X', delta: { x: 25, y: 0, z: 0 },
  interaction: { kind: 'numeric', source: 'exact-xyz' },
});
const service = createSequentialSingleEntityMoveApplicationService({
  readCurrentState: boundary.readCurrentState,
  readView: boundary.readView,
  readJournal: boundary.readJournal,
  publishCandidate: boundary.publishCandidate,
  now: () => '2026-07-28T19:06:00.000Z',
});
const prepared = service.prepare(preview, {
  actorId: 'GEOMETRY_TEST', reason: 'Verified isolated route-complete component.',
  evidenceNote: 'Exact before and after evidence reviewed.',
});
assert.equal(prepared.publicationState, 'NOT_PUBLISHED');
assert.equal(boundary.readJournal().entries.length, 0);
const acceptance = service.accept(prepared);
assert.equal(acceptance.accepted, true);
assert.equal(publicationCount, 1);
assert.equal(boundary.readJournal().entries.length, 1);
const effective = boundary.readView();
const moved = effective.scene.entities.find((row) => row.id === target.geometryPartIds[0]);
assert.equal(moved.geometry.start.x, 25);
assert.equal(effective.readModel.geometryEditJournal.entries.length, 1);
assert.equal(service.accept(prepared).accepted, false,
  'accepted prepared evidence must become stale after journal publication');
const currentAuthority = deriveSequentialEditAuthority(boundary.readCurrentState());
assert.throws(() => boundary.publishCandidate({
  preparedId: prepared.preparedId,
  expectedAuthority: currentAuthority,
  candidate: prepared.candidate,
}), /already been consumed/);
assert.equal(boundary.getState().branches[0].consumedPreparedCount, 1);
store.destroy(); boundary.destroy(); ownerBridge.destroy();
console.log('Sequential geometry edit boundary: ok');
