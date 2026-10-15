import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRevisionActions } from '../tabs/revision-compare/revision-compare-actions.js';
import { createRevisionComparisonBasis } from '../tabs/revision-compare/revision-comparison-basis.js';
import {
  revisionBasisApprovalReadiness,
  revisionVisualReadiness,
} from '../tabs/revision-compare/revision-compare-readiness.js';
import { revisionComparisonPreflight } from '../tabs/revision-compare/revision-preflight.js';
import { createProjectDocument } from '../tabs/revision-compare/revision-session-contracts.js';
import { revisionScopeMarkup } from '../tabs/revision-compare/revision-scope-view.js';
import { createRevisionVisualMetadataDeclaration } from '../tabs/revision-compare/revision-visual-metadata-declaration.js';

function documentFixture(slotId, fill, metadata = {}) {
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
    unit: metadata.unit ?? 'UNKNOWN',
    coordinateFrame: metadata.coordinateFrame ?? 'UNKNOWN',
    verticalAxis: metadata.verticalAxis ?? 'UNKNOWN',
    stats: { branchCount: 1, componentCount: 1, recordCount: 1 },
    scope: { wildcard: '', selectedIds: ['branch:A'] },
    createdAt: '2026-07-30T00:00:00.000Z',
  });
}

function slot(document) {
  return Object.freeze({ document, blockers: Object.freeze([]), warnings: Object.freeze([]) });
}

function proposal() {
  return Object.freeze({
    proposalId: 'scope-1',
    commonBranches: Object.freeze([{ branchId: 'branch:A', label: 'A', site: '', owner: '', componentCountA: 1, componentCountB: 1 }]),
    revAOnlyBranches: Object.freeze([]),
    revBOnlyBranches: Object.freeze([]),
    includedBranchIdsA: Object.freeze(['branch:A']),
    includedBranchIdsB: Object.freeze(['branch:A']),
    excludedBranches: Object.freeze([]),
    warnings: Object.freeze([]),
    summary: Object.freeze({
      commonBranchCount: 1,
      revAOnlyBranchCount: 0,
      revBOnlyBranchCount: 0,
      includedBranchCountA: 1,
      includedBranchCountB: 1,
      retainedComponentCountA: 1,
      retainedComponentCountB: 1,
      excludedBranchCount: 0,
    }),
    validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
  });
}

function workspace(revA, revB, declaration = null) {
  return {
    slots: { baseline: slot(revA), candidate: slot(revB) },
    proposal: proposal(),
    visualMetadataDeclaration: declaration,
    basis: null,
    basisStatus: 'NONE',
    search: { common: '', revAOnly: '', revBOnly: '' },
  };
}

async function assertUnknownIsNotApprovable(revA, revB) {
  const state = workspace(revA, revB);
  const preflight = revisionComparisonPreflight(state.slots.baseline, state.slots.candidate, state.proposal);
  assert.equal(preflight.status, 'READY');
  const readiness = revisionBasisApprovalReadiness(preflight);
  assert.equal(readiness.status, 'BLOCKED');
  assert.deepEqual(readiness.blockers, [
    'Unit must be declared before approving the comparison basis.',
    'Coordinate frame must be declared before approving the comparison basis.',
    'Vertical axis must be declared before approving the comparison basis.',
  ]);
  const markup = revisionScopeMarkup(state, preflight);
  assert.match(markup, /data-revc-approve-basis disabled/);
  assert.match(markup, /Unit must be declared before approving/);
  assert.match(markup, /Coordinate frame must be declared before approving/);
  assert.match(markup, /Vertical axis must be declared before approving/);
  await assert.rejects(createRevisionComparisonBasis({
    sessionId: 'session-1', revA: state.slots.baseline, revB: state.slots.candidate,
    proposal: state.proposal, preflight,
  }, webcrypto), /unitCompatibility\.status must be COMPATIBLE/);
}

async function assertActionGatePreventsScopeMutation(revA, revB) {
  let state = workspace(revA, revB);
  let scopeCalls = 0;
  let reported = '';
  const actions = createRevisionActions({
    root: { querySelector: () => null },
    options: { showToast: (message) => { reported = message; } },
    service: { applyScope: async () => { scopeCalls += 1; } },
    cryptoRef: webcrypto,
    readState: () => state,
    writeState: (next) => { state = next; },
    render: () => {},
    now: () => '2026-07-30T00:00:00.000Z',
    downloadArtifact: () => {},
  });
  await actions.approveBasis();
  assert.equal(scopeCalls, 0);
  assert.match(reported, /Unit must be declared before approving/);
}

async function assertDeclarationUnlocksApproval(revA, revB) {
  const declaration = await createRevisionVisualMetadataDeclaration(revA, revB, {
    unit: 'mm', coordinateFrame: 'plant', verticalAxis: 'z',
  }, webcrypto);
  const state = workspace(revA, revB, declaration);
  const preflight = revisionComparisonPreflight(state.slots.baseline, state.slots.candidate, state.proposal, declaration);
  assert.equal(revisionBasisApprovalReadiness(preflight).status, 'READY');
  const markup = revisionScopeMarkup(state, preflight);
  assert.doesNotMatch(markup, /data-revc-approve-basis disabled/);
  assert.match(markup, /Visual metadata is complete/);
  const basis = await createRevisionComparisonBasis({
    sessionId: 'session-1', revA: state.slots.baseline, revB: state.slots.candidate,
    proposal: state.proposal, preflight, visualMetadataDeclaration: declaration,
  }, webcrypto);
  assert.equal(revisionVisualReadiness({ ...state, basis, basisStatus: 'CURRENT' }).status, 'READY');
}

const revA = documentFixture('baseline', 'a');
const revB = documentFixture('candidate', 'b');
await assertUnknownIsNotApprovable(revA, revB);
await assertActionGatePreventsScopeMutation(revA, revB);
await assertDeclarationUnlocksApproval(revA, revB);
console.log('revision-basis-approval-readiness: PASS');
