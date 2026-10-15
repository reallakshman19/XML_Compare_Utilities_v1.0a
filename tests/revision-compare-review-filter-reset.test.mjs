import assert from 'node:assert/strict';
import { routeRevisionCompareActionClick } from '../tabs/revision-compare/revision-compare-event-routing.js';
import {
  clearRevisionReviewFilters,
  createRevisionReviewFilterResetAction,
  renderRevisionReviewFilterResetControl,
  revisionReviewFilterResetModel,
} from '../tabs/revision-compare/revision-review-filter-reset.js';
import { createRevisionWorkspaceState } from '../tabs/revision-compare/revision-workspace-state.js';

const NOW = '2026-07-30T03:05:00.000Z';

function activatedWorkspace() {
  const base = createRevisionWorkspaceState('review-filter-reset-session', NOW);
  return Object.freeze({
    ...base,
    basis: Object.freeze({ basisId: 'basis-1' }),
    visualMetadataDeclaration: Object.freeze({ declarationId: 'declaration-1' }),
    compare: Object.freeze({ ...base.compare,
      audit: Object.freeze({ auditId: 'audit-1' }), selectedDifferenceId: 'difference-1',
      queue: Object.freeze({ ...base.compare.queue, search: 'legacy-queue-search',
        categories: Object.freeze(['CHANGED']), changedReasons: Object.freeze(['GEOMETRY']), needsDecisionOnly: true }) }),
    review: Object.freeze({ ...base.review,
      session: Object.freeze({ reviewSessionId: 'review-1' }),
      filters: Object.freeze({ ...base.review.filters, categories: Object.freeze(['ADDED', 'CHANGED']),
        search: ' pump ', reviewStates: Object.freeze(['UNREVIEWED']), certainties: Object.freeze(['AMBIGUOUS']) }) }),
    decision: Object.freeze({ ...base.decision,
      ledger: Object.freeze({ ledgerId: 'ledger-1' }),
      preview: Object.freeze({ differenceId: 'difference-1', candidateIndex: 2 }),
      filters: Object.freeze({ decisionStates: Object.freeze(['UNDECIDED']), unresolvedOnly: true }) }),
  });
}

function authorityReferences(state) {
  return Object.freeze({
    slots: state.slots, session: state.session, scopeDecisions: state.scopeDecisions,
    proposal: state.proposal, basis: state.basis, audit: state.compare.audit,
    selectedDifferenceId: state.compare.selectedDifferenceId, reviewSession: state.review.session,
    decisionLedger: state.decision.ledger, decisionPreview: state.decision.preview,
    signOff: state.signOff, trustReceipt: state.trustReceipt, transfer: state.transfer,
    visualMetadataDeclaration: state.visualMetadataDeclaration,
  });
}

function assertSameReferences(actual, expected) {
  for (const key of Object.keys(expected)) assert.equal(actual[key], expected[key], `${key} reference changed`);
}

function assertModel(state) {
  const model = revisionReviewFilterResetModel(state);
  assert.equal(model.visible, true);
  assert.equal(model.activeCount, 8);
  assert.deepEqual(model.activeDimensions, [
    'reviewSearch', 'reviewStates', 'categories', 'certainties',
    'changedReasons', 'needsDecisionOnly', 'decisionStates', 'unresolvedOnly',
  ]);
  assert.equal(model.label, 'Clear 8 review filters');
  assert(Object.isFrozen(model));
  assert(Object.isFrozen(model.activeDimensions));
}

function assertPureReset(state) {
  const before = authorityReferences(state);
  const result = clearRevisionReviewFilters(state);
  assert.equal(result.message, 'Cleared 8 review filters.');
  assert.equal(result.state.message, result.message);
  assert.equal(result.state.compare.queue.search, 'legacy-queue-search');
  assert.deepEqual(result.state.review.filters.categories, ['ADDED', 'CHANGED']);
  assert.equal(result.state.review.filters.search, '');
  assert.equal(result.state.compare.queue.needsDecisionOnly, false);
  assert.equal(result.state.decision.filters.unresolvedOnly, false);
  assert.equal(revisionReviewFilterResetModel(result.state).visible, false);
  assertSameReferences(authorityReferences(result.state), before);
  assert.notEqual(result.state.compare, state.compare);
  assert.notEqual(result.state.review, state.review);
  assert.notEqual(result.state.decision, state.decision);
}

function actionHarness(initialState) {
  let state = initialState; const writes = [], renders = [], toasts = [];
  const action = createRevisionReviewFilterResetAction({
    readState: () => state,
    writeState: (next) => { state = next; writes.push(next); },
    render: (next) => renders.push(next),
    showToast: (message, tone) => toasts.push({ message, tone }),
  });
  return Object.freeze({ action, readState: () => state, renders, toasts, writes });
}

function assertAction(state) {
  const harness = actionHarness(state);
  harness.action();
  assert.equal(harness.writes.length, 1);
  assert.equal(harness.renders.length, 1);
  assert.equal(harness.writes[0], harness.renders[0]);
  assert.equal(harness.readState().message, 'Cleared 8 review filters.');
  assert.deepEqual(harness.toasts, [{ message: 'Cleared 8 review filters.', tone: 'success' }]);
  harness.action();
  assert.equal(harness.writes.length, 1);
}

function fakeDom() {
  const inserted = [];
  const header = { after: (value) => inserted.push(value) };
  const queue = { querySelector: (selector) => selector === 'header' ? header : null };
  const createElement = (tag) => ({
    tag, attributes: {}, children: [], className: '', textContent: '', type: '',
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...values) { this.children.push(...values); },
  });
  const root = { ownerDocument: { createElement }, querySelector: (selector) => selector === '.revc-review-queue' ? queue : null };
  return { inserted, root };
}

function assertControl(state) {
  const dom = fakeDom();
  const control = renderRevisionReviewFilterResetControl(dom.root, state);
  assert.equal(control, dom.inserted[0]);
  assert.equal(control.children[0].textContent, 'Restore the complete review queue by clearing 8 active filters.');
  assert.equal(control.children[1].textContent, 'Clear 8 review filters');
  assert.equal(control.children[1].attributes['data-revc-review-filter-count'], '8');
  const imported = Object.freeze({ ...state,
    evidencePackageImport: Object.freeze({ ...state.evidencePackageImport, status: 'VERIFIED' }) });
  assert.equal(renderRevisionReviewFilterResetControl(fakeDom().root, imported), null);
}

function assertRoute() {
  let calls = 0;
  const actions = { clearReviewFilters: () => { calls += 1; }, transferClick: () => {} };
  const button = { dataset: {}, hasAttribute: (name) => name === 'data-revc-clear-review-filters' };
  routeRevisionCompareActionClick(actions, { closest: () => button });
  assert.equal(calls, 1);
}

const state = activatedWorkspace();
assertModel(state);
assertPureReset(state);
assertAction(state);
assertControl(state);
assertRoute();
console.log('revision-compare-review-filter-reset: PASS');
