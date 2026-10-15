import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRevisionComparisonBasis } from '../tabs/revision-compare/revision-comparison-basis.js';
import { createProjectDocument } from '../tabs/revision-compare/revision-session-contracts.js';
import { revisionVisualReadiness } from '../tabs/revision-compare/revision-compare-readiness.js';
import { _test as viewTest } from '../tabs/revision-compare/revision-compare-view.js';
import { _test as workspaceTest } from '../tabs/revision-compare/revision-compare-workspace.js';
import { revisionComparisonPreflight } from '../tabs/revision-compare/revision-preflight.js';
import {
  createRevisionVisualMetadataDeclaration, resolveRevisionVisualMetadata,
  revisionVisualMetadataDeclarationModel,
} from '../tabs/revision-compare/revision-visual-metadata-declaration.js';

function documentFixture(slotId, fill, metadata = {}) {
  return createProjectDocument({
    documentId: `DOC-${slotId}`, slotId,
    role: slotId === 'baseline' ? 'REFERENCE' : 'CANDIDATE',
    sourceHash: fill.repeat(64), scopedHash: (fill === 'a' ? 'c' : 'd').repeat(64),
    fileName: `${slotId}.json`, fileSizeBytes: 100, stagedSchema: 'fixture/v1', rootShape: 'branches',
    unit: metadata.unit ?? 'UNKNOWN', coordinateFrame: metadata.coordinateFrame ?? 'UNKNOWN',
    verticalAxis: metadata.verticalAxis ?? 'UNKNOWN',
    stats: { branchCount: 1, componentCount: 1, recordCount: 1 },
    scope: { wildcard: '', selectedIds: ['branch:A'] }, createdAt: '2026-07-29T00:00:00.000Z',
  });
}

function slot(document) {
  return Object.freeze({ document, blockers: Object.freeze([]), warnings: Object.freeze([]) });
}

function proposal() {
  return Object.freeze({
    proposalId: 'scope-1', commonBranches: Object.freeze([{ branchId: 'branch:A' }]),
    revAOnlyBranches: Object.freeze([]), revBOnlyBranches: Object.freeze([]),
    includedBranchIdsA: Object.freeze(['branch:A']), includedBranchIdsB: Object.freeze(['branch:A']),
    excludedBranches: Object.freeze([]), warnings: Object.freeze([]),
    summary: Object.freeze({ includedBranchCountA: 1, includedBranchCountB: 1 }),
    validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
  });
}

function stateFixture(revA, revB, declaration = null) {
  return {
    slots: { baseline: slot(revA), candidate: slot(revB) }, proposal: proposal(),
    visualMetadataDeclaration: declaration, basis: null, basisStatus: 'NONE',
  };
}

function assertUnknownRecovery(revA, revB) {
  const state = stateFixture(revA, revB);
  const preflight = revisionComparisonPreflight(state.slots.baseline, state.slots.candidate, state.proposal);
  assert.equal(preflight.status, 'READY');
  assert.equal(preflight.compatibility.unitCompatibility.status, 'UNKNOWN');
  assert(preflight.warnings.includes('Unit is not declared on both revisions.'));
  const model = revisionVisualMetadataDeclarationModel(state);
  assert.equal(model.status, 'REQUIRED');
  assert.deepEqual(model.unknownFields, ['Unit', 'Coordinate frame', 'Vertical axis']);
  const markup = viewTest.visualMetadataDeclarationMarkup(state);
  assert.match(markup, /Declare visual coordinate system/);
  assert.match(markup, /data-revc-apply-visual-metadata/);
  assert.match(markup, /does not modify either source/);
}

async function declaredBasis(revA, revB) {
  const declaration = await createRevisionVisualMetadataDeclaration(revA, revB, {
    unit: 'mm', coordinateFrame: 'PLANT', verticalAxis: 'Z',
  }, webcrypto);
  const state = stateFixture(revA, revB, declaration);
  const resolved = resolveRevisionVisualMetadata(revA, revB, declaration);
  assert.equal(resolved.unitCompatibility.status, 'COMPATIBLE');
  assert.equal(resolved.unitCompatibility.revAOrigin, 'OPERATOR_DECLARATION');
  assert.equal(resolved.unitCompatibility.declarationId, declaration.declarationId);
  assert.equal(Object.isFrozen(declaration), true);
  const preflight = revisionComparisonPreflight(state.slots.baseline, state.slots.candidate, state.proposal, declaration);
  assert.equal(preflight.status, 'READY');
  assert.equal(preflight.warnings.some((item) => item.startsWith('Unit is not declared')), false);
  assert(preflight.notes.some((item) => item.startsWith('Unit compatibility includes explicit operator-declared evidence')));
  const basis = await createRevisionComparisonBasis({
    sessionId: 'session-1', revA: state.slots.baseline, revB: state.slots.candidate,
    proposal: state.proposal, preflight, visualMetadataDeclaration: declaration,
  }, webcrypto);
  assert.equal(basis.visualMetadataDeclaration.declarationId, declaration.declarationId);
  assert.equal(declaration.unit, 'MM');
  assert.equal(revisionVisualReadiness({ ...state, basis, basisStatus: 'CURRENT' }).status, 'READY');
  const staleBasisOnly = revisionVisualMetadataDeclarationModel({
    ...stateFixture(revA, revB), basis, visualMetadataDeclaration: null,
  });
  assert.equal(staleBasisOnly.status, 'REQUIRED');
  return { declaration, basis };
}

async function assertFailClosed(revA, revB, declaration) {
  const knownA = documentFixture('baseline', 'a', { unit: 'm' });
  await assert.rejects(
    createRevisionVisualMetadataDeclaration(knownA, revB, {
      unit: 'mm', coordinateFrame: 'PLANT', verticalAxis: 'Z',
    }, webcrypto),
    /conflicts with Rev A source metadata/,
  );
  const stale = { ...declaration, revAContentHash: 'e'.repeat(64) };
  const stalePreflight = revisionComparisonPreflight(slot(revA), slot(revB), proposal(), stale);
  assert.equal(stalePreflight.status, 'BLOCKED');
  assert(stalePreflight.blockers.some((item) => item.includes('invalid or does not match')));
  const tampered = { ...declaration, coordinateFrame: 'LOCAL' };
  assert.equal(resolveRevisionVisualMetadata(revA, revB, tampered).declaration, null);
  const completeA = documentFixture('baseline', 'a', { unit: 'mm', coordinateFrame: 'PLANT', verticalAxis: 'Z' });
  const completeB = documentFixture('candidate', 'b', { unit: 'mm', coordinateFrame: 'PLANT', verticalAxis: 'Z' });
  await assert.rejects(
    createRevisionVisualMetadataDeclaration(completeA, completeB, {
      unit: 'mm', coordinateFrame: 'PLANT', verticalAxis: 'Z',
    }, webcrypto),
    /already declare complete visual metadata/,
  );
}

function assertPartialPrefill() {
  const revA = documentFixture('baseline', 'a', { unit: 'mm', coordinateFrame: 'PLANT', verticalAxis: 'Z' });
  const revB = documentFixture('candidate', 'b');
  const model = revisionVisualMetadataDeclarationModel(stateFixture(revA, revB));
  assert.deepEqual(model.defaults, { unit: 'MM', coordinateFrame: 'PLANT', verticalAxis: 'Z' });
}

function assertWorkspaceRoutes() {
  const calls = [];
  const actions = new Proxy({ transferClick: () => {} }, {
    get(target, key) { return target[key] ?? (() => calls.push(key)); },
  });
  const button = (attribute) => ({ dataset: {}, hasAttribute: (name) => name === attribute });
  workspaceTest.actionClick(actions, { closest: () => button('data-revc-apply-visual-metadata') });
  workspaceTest.actionClick(actions, { closest: () => button('data-revc-clear-visual-metadata') });
  assert.deepEqual(calls, ['applyVisualMetadata', 'clearVisualMetadata']);
}

const revA = documentFixture('baseline', 'a');
const revB = documentFixture('candidate', 'b');
assertUnknownRecovery(revA, revB);
const { declaration } = await declaredBasis(revA, revB);
await assertFailClosed(revA, revB, declaration);
assertPartialPrefill();
assertWorkspaceRoutes();
console.log('revision-visual-metadata-declaration: PASS');
