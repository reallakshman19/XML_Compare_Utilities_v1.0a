import assert from 'node:assert/strict';
import {
  clearRevisionScopeFilters,
  createRevisionScopeFilterResetAction,
  revisionScopeFilterResetModel,
} from '../tabs/revision-compare/revision-scope-filter-reset.js';
import { _test as scopeViewTest } from '../tabs/revision-compare/revision-scope-view.js';
import {
  createRevisionWorkspaceState,
  setWorkspaceSearch,
} from '../tabs/revision-compare/revision-workspace-state.js';

const NOW = '2026-07-30T02:20:00.000Z';

function workspace() {
  let state = createRevisionWorkspaceState('scope-filter-reset-session', NOW);
  state = setWorkspaceSearch(state, 'common', ' north ');
  state = setWorkspaceSearch(state, 'revAOnly', '   ');
  state = setWorkspaceSearch(state, 'revBOnly', 'projects');
  return Object.freeze({
    ...state,
    scopeDecisions: Object.freeze({ 'branch:LINE-1': Object.freeze({ excluded: true, reason: 'USER_EXCLUDED' }) }),
    proposal: Object.freeze({ proposalId: 'proposal-1' }),
    basis: Object.freeze({ basisId: 'basis-1' }),
    visualMetadataDeclaration: Object.freeze({ declarationId: 'declaration-1' }),
  });
}

function authorityReferences(state) {
  return Object.freeze({
    slots: state.slots,
    session: state.session,
    scopeDecisions: state.scopeDecisions,
    proposal: state.proposal,
    basis: state.basis,
    compare: state.compare,
    review: state.review,
    decision: state.decision,
    signOff: state.signOff,
    trustReceipt: state.trustReceipt,
    transfer: state.transfer,
    visualMetadataDeclaration: state.visualMetadataDeclaration,
  });
}

function assertSameReferences(actual, expected) {
  for (const key of Object.keys(expected)) assert.equal(actual[key], expected[key], `${key} reference changed`);
}

function assertModel(state) {
  const model = revisionScopeFilterResetModel(state);
  assert.equal(model.visible, true);
  assert.equal(model.activeCount, 2);
  assert.deepEqual(model.activeGroups, ['common', 'revBOnly']);
  assert.equal(model.label, 'Clear 2 scope filters');
  assert.equal(model.message, 'Reveal all branches by clearing 2 active scope filters.');
  assert(Object.isFrozen(model));
  assert(Object.isFrozen(model.activeGroups));
}

function assertPureClear(state) {
  const before = authorityReferences(state);
  const result = clearRevisionScopeFilters(state, setWorkspaceSearch);
  assert.deepEqual(result.state.search, { common: '', revAOnly: '', revBOnly: '' });
  assert.equal(result.state.message, 'Cleared 2 scope filters.');
  assert.equal(result.message, 'Cleared 2 scope filters.');
  assert.equal(result.model.activeCount, 2);
  assertSameReferences(authorityReferences(result.state), before);
  assert.notEqual(result.state, state);
  assert.throws(() => clearRevisionScopeFilters(state, null), /Scope-search transition is required/);
}

function actionHarness(initialState) {
  let state = initialState;
  const writes = [];
  const renders = [];
  const toasts = [];
  const action = createRevisionScopeFilterResetAction({
    readState: () => state,
    writeState: (next) => { state = next; writes.push(next); },
    render: (next) => renders.push(next),
    setSearch: setWorkspaceSearch,
    showToast: (message, tone) => toasts.push({ message, tone }),
  });
  return Object.freeze({ action, readState: () => state, writes, renders, toasts });
}

function assertAction(state) {
  const harness = actionHarness(state);
  harness.action();
  assert.deepEqual(harness.readState().search, { common: '', revAOnly: '', revBOnly: '' });
  assert.equal(harness.readState().message, 'Cleared 2 scope filters.');
  assert.equal(harness.writes.length, 1);
  assert.equal(harness.renders.length, 1);
  assert.equal(harness.writes[0], harness.renders[0]);
  assert.deepEqual(harness.toasts, [{ message: 'Cleared 2 scope filters.', tone: 'success' }]);
  harness.action();
  assert.equal(harness.writes.length, 1);
  assert.equal(harness.renders.length, 1);
  assert.equal(harness.toasts.length, 1);
}

function assertSingular() {
  let state = createRevisionWorkspaceState('single-filter-session', NOW);
  state = setWorkspaceSearch(state, 'common', 'north');
  const model = revisionScopeFilterResetModel(state);
  assert.equal(model.label, 'Clear 1 scope filter');
  assert.equal(model.message, 'Reveal all branches by clearing 1 active scope filter.');
  const harness = actionHarness(state);
  harness.action();
  assert.equal(harness.readState().message, 'Cleared 1 scope filter.');
  assert.deepEqual(harness.toasts, [{ message: 'Cleared 1 scope filter.', tone: 'success' }]);
}

function assertMarkup(state) {
  const markup = scopeViewTest.filterResetMarkup(state);
  assert.match(markup, /Clear 2 scope filters/);
  assert.match(markup, /data-revc-clear-scope-filters/);
  assert.match(markup, /data-revc-filter-count="2"/);
  const imported = Object.freeze({
    ...state,
    evidencePackageImport: Object.freeze({ ...state.evidencePackageImport, status: 'VERIFIED' }),
  });
  assert.equal(scopeViewTest.filterResetMarkup(imported), '');
  const cleared = clearRevisionScopeFilters(state, setWorkspaceSearch).state;
  assert.equal(scopeViewTest.filterResetMarkup(cleared), '');
}

const state = workspace();
assertModel(state);
assertPureClear(state);
assertAction(state);
assertSingular();
assertMarkup(state);
console.log('revision-compare-scope-filter-reset: PASS');
