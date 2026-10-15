import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRevisionActions } from '../tabs/revision-compare/revision-compare-actions.js';
import { createInlineRevisionWorkerClient } from '../tabs/revision-compare/revision-intake-worker-client.js';
import { createRevisionLoadService } from '../tabs/revision-compare/revision-load-service.js';
import {
  applyRevisionScopeBatch,
  filterRevisionScopeEntries,
  revisionScopeBatchModel,
} from '../tabs/revision-compare/revision-scope-filter-batch.js';
import { createRevisionScopeProposal } from '../tabs/revision-compare/revision-scope-proposal.js';
import { revisionScopeMarkup } from '../tabs/revision-compare/revision-scope-view.js';
import {
  createRevisionWorkspaceState,
  finishWorkspaceLoad,
  setWorkspaceProposal,
  setWorkspaceSearch,
} from '../tabs/revision-compare/revision-workspace-state.js';

const NOW = '2026-07-29T11:30:00.000Z';

function component(id, x) {
  return { id, position: { x, y: 0, z: 0 } };
}

function branch(name, site, owner, x) {
  return {
    name,
    attributes: { OWNER_SITE: site, OWNER: owner },
    children: [component(`${name}-PIPE`, x)],
  };
}

function staged(branches) {
  return {
    schema: 'StagedJSON.v1',
    unit: 'mm',
    verticalAxis: 'Z',
    coordinateFrame: 'GLOBAL',
    branches,
  };
}

function revisionDocuments() {
  return {
    baseline: staged([
      branch('LINE-NORTH', 'North Area', 'Operations', 0),
      branch('LINE-SOUTH', 'South Area', 'Projects', 10),
      branch('LINE-A-ONLY', 'West Area', 'Legacy', 20),
    ]),
    candidate: staged([
      branch('LINE-NORTH', 'North Area', 'Operations', 1),
      branch('LINE-SOUTH', 'South Area', 'Projects', 11),
      branch('LINE-B-ONLY', 'East Area', 'Projects', 30),
    ]),
  };
}

function decisionIds(decisions) {
  return Object.keys(decisions).sort();
}

async function loadSlot(service, state, slotId, value) {
  const generation = service.begin(slotId);
  const result = await service.loadText(slotId, `${slotId}.json`, JSON.stringify(value), NOW, generation);
  return finishWorkspaceLoad(state, slotId, result, NOW);
}

async function loadedWorkspace(service, decisions = {}) {
  const documents = revisionDocuments();
  let state = createRevisionWorkspaceState('scope-filter-session', NOW);
  state = await loadSlot(service, state, 'baseline', documents.baseline);
  state = await loadSlot(service, state, 'candidate', documents.candidate);
  const proposal = await createRevisionScopeProposal(state.slots.baseline, state.slots.candidate, decisions, webcrypto);
  return setWorkspaceProposal(state, proposal, decisions, NOW);
}

function actionContext(service, initialState) {
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

function assertPureBatchModel(state) {
  const model = revisionScopeBatchModel(state, 'common');
  assert.equal(model.filtered, true);
  assert.equal(model.visibleCount, 1);
  assert.equal(model.hiddenCount, 1);
  assert.deepEqual(model.branchIds, ['branch:LINE-NORTH']);
  assert.equal(model.selectLabel, 'Select visible');
  assert.equal(model.clearLabel, 'Clear visible');
  assert(Object.isFrozen(model));
  assert(Object.isFrozen(model.branchIds));
}

function assertFilterMatching(proposal) {
  const ownerMatch = filterRevisionScopeEntries(proposal.commonBranches, ' projects ');
  assert.deepEqual(ownerMatch.map((entry) => entry.branchId), ['branch:LINE-SOUTH']);
  const siteMatch = filterRevisionScopeEntries(proposal.commonBranches, 'NORTH AREA');
  assert.deepEqual(siteMatch.map((entry) => entry.branchId), ['branch:LINE-NORTH']);
  assert.throws(() => revisionScopeBatchModel({ proposal, search: {} }, 'unknown'), /Unknown revision scope group/);
}

function assertPureDecisionPreservation(state) {
  const before = state.scopeDecisions;
  const cleared = applyRevisionScopeBatch(before, state, 'common', false);
  assert.deepEqual(decisionIds(cleared.decisions), ['branch:LINE-NORTH', 'branch:LINE-SOUTH']);
  assert.deepEqual(decisionIds(before), ['branch:LINE-SOUTH']);
  const selected = applyRevisionScopeBatch(cleared.decisions, state, 'common', true);
  assert.deepEqual(decisionIds(selected.decisions), ['branch:LINE-SOUTH']);
}

function assertFilteredMarkup(state) {
  const markup = revisionScopeMarkup(state, { status: 'READY' });
  assert.match(markup, />Select visible</);
  assert.match(markup, />Clear visible</);
  assert.match(markup, /1 visible · 1 hidden/);
  assert.match(markup, /batch actions preserve 1 hidden row/);
  assert.match(markup, /data-revc-branch-id="branch:LINE-NORTH"/);
  assert.doesNotMatch(markup, /data-revc-branch-id="branch:LINE-SOUTH"/);
}

function assertZeroMatchMarkup(state) {
  const noMatch = setWorkspaceSearch(state, 'common', 'not-present');
  const markup = revisionScopeMarkup(noMatch, { status: 'READY' });
  assert.match(markup, /0 visible · 2 hidden/);
  assert.match(markup, /No branches match this filter/);
  assert.match(markup, /data-revc-group="common"[^>]*disabled/);
}

async function assertRealActionPath(service, state) {
  const harness = actionContext(service, state);
  await harness.actions.setGroupIncluded('common', false);
  let current = harness.readState();
  assert.deepEqual(decisionIds(current.scopeDecisions), ['branch:LINE-NORTH', 'branch:LINE-SOUTH']);
  assert.deepEqual(current.proposal.includedBranchIdsA, ['branch:LINE-A-ONLY']);
  assert.deepEqual(current.proposal.includedBranchIdsB, ['branch:LINE-B-ONLY']);
  assert.deepEqual(harness.toasts.at(-1), { message: 'Cleared 1 visible branch(es).', tone: 'success' });

  await harness.actions.setGroupIncluded('common', true);
  current = harness.readState();
  assert.deepEqual(decisionIds(current.scopeDecisions), ['branch:LINE-SOUTH']);

  harness.actions.setSearch('common', '');
  await harness.actions.setGroupIncluded('common', true);
  current = harness.readState();
  assert.deepEqual(current.scopeDecisions, {});
  assert.deepEqual(harness.toasts.at(-1), { message: 'Selected 2 branch(es).', tone: 'success' });
}

async function run() {
  const service = createRevisionLoadService(webcrypto, {
    clientFactory: () => createInlineRevisionWorkerClient({ cryptoRef: webcrypto }),
  });
  try {
    let state = await loadedWorkspace(service, {
      'branch:LINE-SOUTH': { excluded: true, reason: 'USER_EXCLUDED' },
    });
    state = setWorkspaceSearch(state, 'common', ' north ');
    assertPureBatchModel(state);
    assertFilterMatching(state.proposal);
    assertPureDecisionPreservation(state);
    assertFilteredMarkup(state);
    assertZeroMatchMarkup(state);
    await assertRealActionPath(service, state);
  } finally {
    service.dispose();
  }
}

await run();
console.log('revision-compare-scope-filter-batch: PASS');
