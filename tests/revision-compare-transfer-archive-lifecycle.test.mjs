import assert from 'node:assert/strict';
import { deepFreeze } from '../tabs/revision-compare/revision-contract-utils.js';
import { createRevisionCompareTransferArchiveArtifact } from '../tabs/revision-compare/revision-transfer-archive.js';
import { completeRevisionCompareTransferArchiveState, failRevisionCompareTransferArchiveState } from '../tabs/revision-compare/revision-transfer-archive-state.js';
import {
  adoptRevisionCompareTransferArchiveWorkspace, completeWorkspaceTransferArchive,
  failWorkspaceTransferArchive, reconcileRevisionCompareTransferArchiveAfterAuthorityChange,
} from '../tabs/revision-compare/revision-transfer-archive-workspace-state.js';
import { downloadRevisionCompareTransferArchive, printRevisionCompareTransferArchive } from '../tabs/revision-compare/revision-transfer-archive-controller.js';
import { clone, cryptoRef, transferArchiveFixture } from './revision-compare-transfer-archive-fixtures.mjs';

const fixture = await transferArchiveFixture();
const artifact = await createRevisionCompareTransferArchiveArtifact(fixture.workspace, { cryptoRef });
const createdState = completeRevisionCompareTransferArchiveState(artifact, fixture.workspace);
assert.equal(createdState.status, 'CREATED');
assert.equal(Object.isFrozen(createdState.artifact), true);
const created = deepFreeze({ ...fixture.workspace, transferArchive: createdState });
const presentation = deepFreeze({
  ...created, compare: { ...created.compare, presentationMode: 'side-by-side', queue: { search: 'x' } },
});
assert.equal(presentation.transferArchive.status, 'CREATED');
const changed = clone(created); changed.review.session.revision += 1;
const stale = reconcileRevisionCompareTransferArchiveAfterAuthorityChange(created, deepFreeze(changed));
assert.equal(stale.transferArchive.status, 'STALE');
assert.equal(stale.transferArchive.artifact, artifact);
const restored = deepFreeze({ ...stale, review: created.review });
assert.equal(reconcileRevisionCompareTransferArchiveAfterAuthorityChange(stale, restored).transferArchive.status, 'STALE');

const failedHistorical = failWorkspaceTransferArchive(stale, new Error('replacement failed'));
assert.equal(failedHistorical.transferArchive.status, 'STALE');
assert.equal(failedHistorical.transferArchive.artifact, artifact);
assert.equal(failedHistorical.transferArchive.error, 'replacement failed');
const historicalRace = completeWorkspaceTransferArchive(stale, fixture.workspace, artifact);
assert.equal(historicalRace.transferArchive.status, 'STALE');
assert.equal(historicalRace.transferArchive.artifact, artifact);

const race = clone(fixture.workspace); race.transferCompletion.bundle.contentSha256 = 'f'.repeat(64);
assert.equal(completeWorkspaceTransferArchive(deepFreeze(race), fixture.workspace, artifact).transferArchive.status, 'FAILED');
assert.equal(failRevisionCompareTransferArchiveState(new Error('failed')).artifact, null);

const legacyV12 = deepFreeze({ ...fixture.workspace, schema: 'RevisionCompareWorkspaceState.v12' });
assert.equal(adoptRevisionCompareTransferArchiveWorkspace(legacyV12).schema, 'RevisionCompareWorkspaceState.v13');
const successorInspection = deepFreeze({ schema: 'RevisionCompareTransferHandoverInspectionState.v1', status: 'IDLE' });
const successorV14 = deepFreeze({
  ...fixture.workspace, schema: 'RevisionCompareWorkspaceState.v14', handoverInspection: successorInspection,
});
assert.strictEqual(adoptRevisionCompareTransferArchiveWorkspace(successorV14), successorV14);
const failedV14 = failWorkspaceTransferArchive(successorV14, new Error('v14 failure'));
assert.equal(failedV14.schema, 'RevisionCompareWorkspaceState.v14');
assert.strictEqual(failedV14.handoverInspection, successorInspection);
const completedV14 = completeWorkspaceTransferArchive(successorV14, successorV14, artifact);
assert.equal(completedV14.schema, 'RevisionCompareWorkspaceState.v14');
assert.strictEqual(completedV14.handoverInspection, successorInspection);

let clicked = 0; let revoked = 0; let removed = 0;
const anchor = { click: () => { clicked += 1; }, remove: () => { removed += 1; } };
const root = {
  appendChild: () => {},
  ownerDocument: {
    createElement: () => anchor,
    defaultView: {
      crypto: cryptoRef,
      URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => { revoked += 1; } },
      Blob: class {},
    },
  },
};
await downloadRevisionCompareTransferArchive(root, artifact, { cryptoRef });
assert.deepEqual([clicked, removed, revoked], [1, 1, 1]);
let written = ''; let printed = 0;
const printWindow = {
  document: { open: () => {}, write: (value) => { written = value; }, close: () => {} },
  focus: () => {}, print: () => { printed += 1; },
};
await printRevisionCompareTransferArchive(printWindow, artifact, cryptoRef);
assert.equal(written, artifact.text); assert.equal(printed, 1);
console.log('revision-compare-transfer-archive-lifecycle.test.mjs passed');
