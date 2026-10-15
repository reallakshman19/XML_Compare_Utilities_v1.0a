import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createInlineRevisionWorkerClient } from '../tabs/revision-compare/revision-intake-worker-client.js';
import { createRevisionLoadService } from '../tabs/revision-compare/revision-load-service.js';
import {
  createRevisionWorkspaceState,
  finishWorkspaceLoad,
  setWorkspaceBasis,
  startWorkspaceLoad,
} from '../tabs/revision-compare/revision-workspace-state.js';
import {
  applyRevisionCompareSwapResults,
  revisionCompareSwapReadiness,
} from '../tabs/revision-compare/revision-compare-intake-swap.js';
import { _test as viewTest } from '../tabs/revision-compare/revision-compare-view.js';

const NOW = '2026-07-29T10:45:00.000Z';
const staged = (name, x) => JSON.stringify([{
  name,
  children: [{ id: `${name}-1`, position: [x, 0, 0] }],
}]);

function attach(state, slotId, result) {
  const loading = startWorkspaceLoad(
    state,
    slotId,
    result.generation,
    result.document.fileName,
    result.document.fileSizeBytes,
    NOW,
  );
  return finishWorkspaceLoad(loading, slotId, result, NOW);
}

function componentId(result) {
  return result.jsonSnapshot.entityIndex.find((entry) => entry.entityKind === 'COMPONENT').entityId;
}

function assertRoles(result, slotId, role, side, marker) {
  assert.equal(result.document.slotId, slotId);
  assert.equal(result.document.role, role);
  assert.equal(result.jsonSnapshot.side, side);
  assert.equal(result.jsonSnapshot.parsedValue[0].name, marker);
  const code = side === 'REV_A' ? 'A' : 'B';
  assert.match(componentId(result), new RegExp(`^record:${code}:${slotId}:`));
}

async function loadPair(service) {
  const baseline = await service.loadText('baseline', 'A.json', staged('A', 0), NOW);
  const candidate = await service.loadText('candidate', 'B.json', staged('B', 1), NOW);
  return Object.freeze({ baseline, candidate });
}

function loadedState(pair) {
  let state = createRevisionWorkspaceState('swap-session', NOW);
  state = attach(state, 'baseline', pair.baseline);
  state = attach(state, 'candidate', pair.candidate);
  return setWorkspaceBasis(state, Object.freeze({ basisId: 'before-swap' }));
}

async function verifyForwardSwap(service, pair, state) {
  const swapped = service.swapLoadedSlots();
  assert.equal(swapped.baseline.document.sourceHash, pair.candidate.document.sourceHash);
  assert.equal(swapped.candidate.document.sourceHash, pair.baseline.document.sourceHash);
  assertRoles(swapped.baseline, 'baseline', 'REFERENCE', 'REV_A', 'B');
  assertRoles(swapped.candidate, 'candidate', 'CANDIDATE', 'REV_B', 'A');
  const scopeA = await service.applyScope('baseline', { selectedIds: ['branch:B'] }, NOW);
  const scopeB = await service.applyScope('candidate', { selectedIds: ['branch:A'] }, NOW);
  assert.deepEqual(scopeA.scopeResult.selectedBranchIds, ['branch:B']);
  assert.deepEqual(scopeB.scopeResult.selectedBranchIds, ['branch:A']);
  return applyRevisionCompareSwapResults(state, swapped, NOW);
}

async function verifyReverseSwap(service, pair) {
  const restored = service.swapLoadedSlots();
  assert.equal(restored.baseline.document.sourceHash, pair.baseline.document.sourceHash);
  const scope = await service.applyScope('baseline', { selectedIds: ['branch:A'] }, NOW);
  assert.deepEqual(scope.scopeResult.selectedBranchIds, ['branch:A']);
}

function verifyWorkspaceState(state, pair) {
  assert.equal(state.slots.baseline.document.sourceHash, pair.candidate.document.sourceHash);
  assert.equal(state.slots.candidate.document.sourceHash, pair.baseline.document.sourceHash);
  assert.equal(state.proposal, null);
  assert.deepEqual(state.scopeDecisions, {});
  assert.equal(state.basisStatus, 'STALE');
  assert.equal(state.compare.audit, null);
}

function verifyUiAndImportedBoundary(state) {
  assert.equal(revisionCompareSwapReadiness(state).status, 'READY');
  assert.match(viewTest.swapControl(state), /data-revc-swap-revisions/);
  assert.doesNotMatch(viewTest.swapControl(state), /data-revc-swap-revisions disabled/);
  const imported = Object.freeze({
    ...state,
    evidencePackageImport: Object.freeze({ ...state.evidencePackageImport, status: 'VERIFIED' }),
  });
  assert.equal(revisionCompareSwapReadiness(imported).status, 'BLOCKED');
  assert.match(viewTest.swapControl(imported), /data-revc-swap-revisions disabled/);
}

async function main() {
  const service = createRevisionLoadService(webcrypto, {
    clientFactory: () => createInlineRevisionWorkerClient({ cryptoRef: webcrypto }),
  });
  const pair = await loadPair(service);
  const before = loadedState(pair);
  verifyUiAndImportedBoundary(before);
  const swapped = await verifyForwardSwap(service, pair, before);
  verifyWorkspaceState(swapped, pair);
  await verifyReverseSwap(service, pair);
  service.dispose();
  console.log('revision-compare-intake-swap: PASS');
}

await main();
