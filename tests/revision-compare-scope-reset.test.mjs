import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRevisionActions } from '../tabs/revision-compare/revision-compare-actions.js';
import { createInlineRevisionWorkerClient } from '../tabs/revision-compare/revision-intake-worker-client.js';
import { createRevisionLoadService } from '../tabs/revision-compare/revision-load-service.js';
import { revisionScopeBatchModel } from '../tabs/revision-compare/revision-scope-filter-batch.js';
import { createRevisionScopeProposal } from '../tabs/revision-compare/revision-scope-proposal.js';
import { revisionScopeResetModel } from '../tabs/revision-compare/revision-scope-reset.js';
import { _test as scopeViewTest } from '../tabs/revision-compare/revision-scope-view.js';
import {
  createRevisionWorkspaceState, finishWorkspaceLoad, setWorkspaceProposal, setWorkspaceSearch,
} from '../tabs/revision-compare/revision-workspace-state.js';

const NOW = '2026-07-30T01:10:00.000Z';

function branch(name, x) {
  return {
    name,
    attributes: { OWNER_SITE: `${name}-SITE`, OWNER: `${name}-OWNER` },
    children: [{ id: `${name}-PIPE`, position: { x, y: 0, z: 0 } }],
  };
}

function staged(names) {
  return {
    schema: 'StagedJSON.v1', unit: 'mm', coordinateFrame: 'GLOBAL', verticalAxis: 'Z',
    branches: names.map((name, index) => branch(name, index * 10)),
  };
}

async function loadSlot(service, state, slotId, value) {
  const generation = service.begin(slotId);
  const result = await service.loadText(slotId, `${slotId}.json`, JSON.stringify(value), NOW, generation);
  return finishWorkspaceLoad(state, slotId, result, NOW);
}

async function workspace(service) {
  let state = createRevisionWorkspaceState('scope-reset-session', NOW);
  state = await loadSlot(service, state, 'baseline', staged(['LINE-COMMON', 'LINE-A-ONLY']));
  state = await loadSlot(service, state, 'candidate', staged(['LINE-COMMON', 'LINE-B-ONLY']));
  const decisions = {
    'branch:LINE-COMMON': { excluded: true, reason: 'USER_EXCLUDED' },
    'branch:LINE-A-ONLY': { excluded: true, reason: 'USER_EXCLUDED' },
  };
  const proposal = await createRevisionScopeProposal(state.slots.baseline, state.slots.candidate, decisions, webcrypto);
  state = setWorkspaceProposal(state, proposal, decisions, NOW);
  state = setWorkspaceSearch(state, 'common', 'common');
  state = setWorkspaceSearch(state, 'revAOnly', 'a-only');
  const declaration = Object.freeze({ declarationId: 'visual-declaration-1' });
  return Object.freeze({ ...state, visualMetadataDeclaration: declaration });
}

function actionHarness(service, initialState) {
  let state = initialState;
  const toasts = [];
  const context = {
    root: { querySelector: () => null },
    options: { showToast: (message, tone) => toasts.push({ message, tone }) },
    service,
    compareService: { cancel: async () => {} },
    viewerAdapter: { clear: () => {} },
    cryptoRef: webcrypto,
    clock: () => 0,
    now: () => NOW,
    readState: () => state,
    writeState: (next) => { state = next; },
    render: (next) => { state = next; },
    downloadArtifact: () => {},
  };
  return { actions: createRevisionActions(context), readState: () => state, toasts };
}

function assertResetModel(state) {
  const model = revisionScopeResetModel(state);
  assert.equal(model.visible, true);
  assert.equal(model.decisionCount, 2);
  assert.equal(model.label, 'Reset 2 scope decisions');
  assert(Object.isFrozen(model));
  const batch = revisionScopeBatchModel(state, 'reset');
  assert.deepEqual(batch.branchIds, ['branch:LINE-A-ONLY', 'branch:LINE-COMMON']);
  assert.equal(batch.visibleCount, 2);
}

function assertResetMarkup(state) {
  const markup = scopeViewTest.scopeResetMarkup(state);
  assert.match(markup, /Reset 2 scope decisions/);
  assert.match(markup, /data-revc-group="reset"/);
  assert.match(markup, /data-revc-reset-count="2"/);
  const imported = Object.freeze({
    ...state,
    evidencePackageImport: Object.freeze({ ...state.evidencePackageImport, status: 'VERIFIED' }),
  });
  assert.equal(scopeViewTest.scopeResetMarkup(imported), '');
}

async function assertActionReset(service, state) {
  const declaration = state.visualMetadataDeclaration;
  const search = state.search;
  const harness = actionHarness(service, state);
  await harness.actions.setGroupIncluded('reset', true);
  const current = harness.readState();
  assert.deepEqual(current.scopeDecisions, {});
  assert.equal(current.proposal.summary.excludedBranchCount, 0);
  assert.deepEqual(current.search, search);
  assert.equal(current.visualMetadataDeclaration, declaration);
  assert.equal(revisionScopeResetModel(current).visible, false);
  assert.equal(scopeViewTest.scopeResetMarkup(current), '');
  assert.deepEqual(harness.toasts.at(-1), { message: 'Selected 2 branches.', tone: 'success' });
}

async function run() {
  const service = createRevisionLoadService(webcrypto, {
    clientFactory: () => createInlineRevisionWorkerClient({ cryptoRef: webcrypto }),
  });
  try {
    const state = await workspace(service);
    assertResetModel(state);
    assertResetMarkup(state);
    await assertActionReset(service, state);
  } finally {
    service.dispose();
  }
}

await run();
console.log('revision-compare-scope-reset: PASS');
