import assert from 'node:assert/strict';
import { revisionBasisApprovalReadiness } from '../tabs/revision-compare/revision-compare-readiness.js';
import { revisionScopeMarkup } from '../tabs/revision-compare/revision-scope-view.js';
import { createProjectDocument } from '../tabs/revision-compare/revision-session-contracts.js';
import {
  bindRevisionVisualMetadataNavigation,
  focusRevisionBasisApproval,
  focusRevisionVisualMetadata,
  revisionVisualMetadataRecoveryModel,
} from '../tabs/revision-compare/revision-visual-metadata-navigation.js';

function documentFixture(slotId, fill) {
  return createProjectDocument({
    documentId: `DOC-${slotId}`,
    slotId,
    role: slotId === 'baseline' ? 'REFERENCE' : 'CANDIDATE',
    sourceHash: fill.repeat(64),
    scopedHash: (fill === 'a' ? 'c' : 'd').repeat(64),
    fileName: `${slotId}.json`,
    fileSizeBytes: 100,
    stagedSchema: 'fixture/v1',
    rootShape: 'branches',
    unit: 'UNKNOWN',
    coordinateFrame: 'UNKNOWN',
    verticalAxis: 'UNKNOWN',
    stats: { branchCount: 1, componentCount: 1, recordCount: 1 },
    scope: { wildcard: '', selectedIds: ['branch:A'] },
    createdAt: '2026-07-30T00:00:00.000Z',
  });
}

function proposalFixture() {
  return Object.freeze({
    commonBranches: Object.freeze([{ branchId: 'branch:A', label: 'A', site: '', owner: '', componentCountA: 1, componentCountB: 1 }]),
    revAOnlyBranches: Object.freeze([]),
    revBOnlyBranches: Object.freeze([]),
    includedBranchIdsA: Object.freeze(['branch:A']),
    includedBranchIdsB: Object.freeze(['branch:A']),
    excludedBranches: Object.freeze([]),
    summary: Object.freeze({
      commonBranchCount: 1, revAOnlyBranchCount: 0, revBOnlyBranchCount: 0,
      includedBranchCountA: 1, includedBranchCountB: 1,
      retainedComponentCountA: 1, retainedComponentCountB: 1, excludedBranchCount: 0,
    }),
  });
}

function stateFixture(imported = false) {
  const slot = (document) => Object.freeze({ document, blockers: Object.freeze([]), warnings: Object.freeze([]) });
  return {
    slots: { baseline: slot(documentFixture('baseline', 'a')), candidate: slot(documentFixture('candidate', 'b')) },
    proposal: proposalFixture(),
    visualMetadataDeclaration: null,
    basisStatus: 'NONE',
    search: { common: '', revAOnly: '', revBOnly: '' },
    evidencePackageImport: { status: imported ? 'VERIFIED' : 'IDLE' },
  };
}

function preflightFixture() {
  const item = (label) => Object.freeze({ label, status: 'UNKNOWN', revA: 'UNKNOWN', revB: 'UNKNOWN' });
  return Object.freeze({
    status: 'READY', blockers: Object.freeze([]), warnings: Object.freeze([]),
    compatibility: Object.freeze({
      unitCompatibility: item('Unit'),
      coordinateFrameCompatibility: item('Coordinate frame'),
      verticalAxisCompatibility: item('Vertical axis'),
    }),
  });
}

function assertRecoveryMarkup() {
  const state = stateFixture();
  const approval = revisionBasisApprovalReadiness(preflightFixture());
  const model = revisionVisualMetadataRecoveryModel(state, approval);
  assert.equal(model.visible, true);
  assert.deepEqual(model.missingFields, ['Unit', 'Coordinate frame', 'Vertical axis']);
  const markup = revisionScopeMarkup(state, preflightFixture());
  assert.match(markup, /Missing visual metadata: Unit, Coordinate frame, Vertical axis/);
  assert.match(markup, /data-revc-resolve-visual-metadata/);
  assert.match(markup, /aria-controls="revc-visual-metadata"/);
  assert.doesNotMatch(revisionScopeMarkup(stateFixture(true), preflightFixture()), /data-revc-resolve-visual-metadata/);
}

function focusable(value = '', disabled = false, missing = false) {
  return {
    value, disabled, focusCalls: [], scrollCalls: [],
    getAttribute: () => null,
    hasAttribute: (name) => missing && name === 'data-revc-visual-missing',
    focus(options) { this.focusCalls.push(options); },
    scrollIntoView(options) { this.scrollCalls.push(options); },
  };
}

function navigationRoot(reduced = false) {
  const unit = focusable('MM');
  const frame = focusable('PLANT', false, true);
  const axis = focusable('');
  const approval = focusable('', true);
  const section = focusable();
  const fields = new Map([
    ['[data-revc-visual-unit]', unit],
    ['[data-revc-visual-frame]', frame],
    ['[data-revc-visual-axis]', axis],
  ]);
  section.querySelector = (selector) => fields.get(selector) ?? null;
  const root = {
    ownerDocument: { defaultView: { matchMedia: () => ({ matches: reduced }) } },
    querySelector(selector) {
      if (selector === '[data-revc-visual-metadata]') return section;
      if (selector === '[data-revc-approve-basis]') return approval;
      return null;
    },
  };
  return { root, section, unit, frame, axis, approval };
}

function assertDirectFocus() {
  const elements = navigationRoot();
  assert.equal(focusRevisionVisualMetadata(elements.root), true);
  assert.equal(elements.frame.focusCalls.length, 1);
  assert.equal(elements.axis.focusCalls.length, 0);
  assert.deepEqual(elements.section.scrollCalls[0], { block: 'center', behavior: 'smooth' });
  assert.equal(focusRevisionBasisApproval(elements.root), false);
  elements.approval.disabled = false;
  assert.equal(focusRevisionBasisApproval(elements.root), true);
  assert.equal(elements.approval.focusCalls.length, 1);
  const reduced = navigationRoot(true);
  reduced.approval.disabled = false;
  focusRevisionBasisApproval(reduced.root);
  assert.equal(reduced.approval.scrollCalls[0].behavior, 'auto');
}

function button(attribute) {
  return { hasAttribute: (name) => name === attribute };
}

function assertBoundLifecycle() {
  const elements = navigationRoot();
  const scheduled = [];
  let listener = null;
  elements.root.addEventListener = (type, handler) => { if (type === 'click') listener = handler; };
  elements.root.removeEventListener = (type, handler) => { if (type === 'click' && listener === handler) listener = null; };
  const cleanup = bindRevisionVisualMetadataNavigation(elements.root, { schedule: (callback) => scheduled.push(callback) });
  listener({ target: { closest: () => button('data-revc-resolve-visual-metadata') } });
  assert.equal(elements.frame.focusCalls.length, 1);
  listener({ target: { closest: () => button('data-revc-apply-visual-metadata') } });
  scheduled.shift()();
  assert.equal(elements.approval.focusCalls.length, 0);
  elements.approval.disabled = false;
  scheduled.shift()();
  assert.equal(elements.approval.focusCalls.length, 1);
  cleanup();
  assert.equal(listener, null);
}

assertRecoveryMarkup();
assertDirectFocus();
assertBoundLifecycle();
console.log('revision-visual-metadata-navigation: PASS');
