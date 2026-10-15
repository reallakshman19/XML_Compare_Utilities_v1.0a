/** Immutable workspace state for trusted compare, guided review, decisions and transfer execution. */
import { deepFreeze } from './revision-contract-utils.js';
import { attachProjectDocument, createProjectSession, detachProjectDocument } from './revision-session-contracts.js';
import { beginRevisionLoad, completeRevisionLoad, completeRevisionScope, createRevisionIntakeState, failRevisionLoad } from './revision-intake-state.js';
import {
  cancelComparisonState, completeComparisonState, createComparisonLifecycleState, failComparisonState,
  invalidateComparisonState, progressComparisonState, readyComparisonState, setComparisonPresentation,
  setComparisonQueueSearch, setComparisonReviewVisible, setComparisonSelection, setNeedsDecisionOnly,
  setComparisonViewerBackend, startComparisonState, toggleChangedReason, toggleComparisonCategory,
} from './revision-compare-lifecycle.js';
import {
  attachReviewAudit, createReviewLifecycleState, setReviewImportError, setReviewLifecycleSession,
  setReviewSearch, staleReviewLifecycle, startNewReviewForAudit, toggleReviewFilter,
} from './revision-review-lifecycle.js';
import {
  attachDecisionAudit, createDecisionLifecycleState, setDecisionImportError, setDecisionLifecycleLedger,
  setDecisionPreview, setDecisionUnresolvedOnly, staleDecisionLifecycle, startNewDecisionForAudit, toggleDecisionFilter,
} from './revision-decision-lifecycle.js';
import {
  createRevisionCompareSignOffState, signOffStateForReadiness, staleRevisionCompareSignOffState,
} from './revision-sign-off.js';
import {
  REVISION_COMPARE_TRUST_STATUS, createRevisionCompareTrustReceiptState,
  reconcileRevisionCompareTrustReceiptState,
} from './revision-trust-receipt.js';
import {
  captureRevisionCompareTransferAuthority, completeRevisionCompareTransferPlanRequest,
  createRevisionCompareTransferState, failRevisionCompareTransferPlanRequest,
  invalidateRevisionCompareTransferAuthority, reconcileRevisionCompareTransferAuthority,
  setRevisionCompareTransferPolicyVersion,
  setRevisionCompareTransferSelection, startRevisionCompareTransferPlanRequest,
} from './revision-transfer-contracts.js';
import {
  captureRevisionCompareTransferApplyAuthority, completeRevisionCompareTransferApplyRequest,
  failRevisionCompareTransferApplyRequest, reconcileRevisionCompareTransferApplyAuthority,
  startRevisionCompareTransferApplyRequest,
} from './revision-transfer-apply-state.js';
import { createRevisionCompareTransferReviewState } from './revision-transfer-review-state.js';
import { createRevisionCompareTransferCompletionState } from './revision-transfer-completion-state.js';
import { reconcileRevisionCompareTransferCompletionAfterAuthorityChange } from './revision-transfer-completion-workspace-state.js';
export { setWorkspaceTransferReviewDraft, setWorkspaceTransferReviewPresentation } from './revision-transfer-review-workspace-state.js';

// Workspace transition: RevisionCompareWorkspaceState.v11 -> RevisionCompareWorkspaceState.v12.
export const REVISION_WORKSPACE_STATE_SCHEMA = 'RevisionCompareWorkspaceState.v12';
export const REVISION_EVIDENCE_PACKAGE_IMPORT_STATE_SCHEMA = 'RevisionEvidencePackageImportState.v1';
export const REVISION_EVIDENCE_PACKAGE_IMPORT_STATUS = Object.freeze({
  IDLE: 'IDLE', IMPORTING: 'IMPORTING', VERIFIED: 'VERIFIED', FAILED: 'FAILED',
});
export const REVISION_EVIDENCE_PACKAGE_FRESH_WORKSPACE_ERROR = 'Close this workspace and open a new Revision Compare workspace before importing an evidence package.';
export const REVISION_TRUST_REPORT_REQUIRED_ERROR = 'Create or retain a completion report before importing an external signature receipt.';
export const BASIS_STATUS = Object.freeze({ NONE: 'NONE', CURRENT: 'CURRENT', STALE: 'STALE' });
function staleStatus(state) { return state.basis ? BASIS_STATUS.STALE : BASIS_STATUS.NONE; }
function invalidated(state, updatedAt) { return { compare: invalidateComparisonState(state.compare), review: staleReviewLifecycle(state.review, updatedAt), decision: staleDecisionLifecycle(state.decision, updatedAt) }; }
function signOffAfterAuthorityChange(previous, next) {
  const prior = previous?.signOff ?? createRevisionCompareSignOffState();
  const signOff = prior.report ? staleRevisionCompareSignOffState(prior) : signOffStateForReadiness({ ...next, signOff: prior });
  const trustReceipt = reconcileRevisionCompareTrustReceiptState(previous?.trustReceipt, signOff);
  return deepFreeze({ ...next, signOff, trustReceipt });
}
function transferAfterAuthorityChange(previous, next) {
  const prior = previous?.transfer ?? createRevisionCompareTransferState();
  return deepFreeze({ ...next, transfer: invalidateRevisionCompareTransferAuthority(prior, next) });
}
function authorityAfterChange(previous, next) { return reconcileRevisionCompareTransferCompletionAfterAuthorityChange(previous, transferAfterAuthorityChange(previous, signOffAfterAuthorityChange(previous, next))); }
function transferLifecycleChange(previous, transfer) { return transfer === previous.transfer ? previous : reconcileRevisionCompareTransferCompletionAfterAuthorityChange(previous, signOffAfterAuthorityChange(previous, deepFreeze({ ...previous, transfer }))); }
export function createRevisionEvidencePackageImportState() {
  return deepFreeze({
    schema: REVISION_EVIDENCE_PACKAGE_IMPORT_STATE_SCHEMA, status: REVISION_EVIDENCE_PACKAGE_IMPORT_STATUS.IDLE,
    requestGeneration: 0, fileName: '', packageId: null, contentSha256: null,
    integrityStatus: 'NOT_VERIFIED', reviewReattached: false, decisionReattached: false,
    authenticityStatus: 'NOT_ESTABLISHED', error: null,
  });
}
function sourceIntakeActive(slot) { return slot?.status === 'LOADING'; }
export function revisionWorkspaceIsFreshForEvidencePackageImport(state) {
  return Boolean(state && !sourceIntakeActive(state.slots?.baseline) && !sourceIntakeActive(state.slots?.candidate)
    && !state.slots?.baseline?.document && !state.slots?.candidate?.document
    && !state.session?.documents?.baseline && !state.session?.documents?.candidate
    && !state.basis && !state.compare?.audit && !state.review?.session && !state.decision?.ledger);
}
export function createRevisionWorkspaceState(sessionId, createdAt) {
  const state = {
    schema: REVISION_WORKSPACE_STATE_SCHEMA, session: createProjectSession({ sessionId, createdAt }),
    slots: { baseline: createRevisionIntakeState('baseline', 'REFERENCE'), candidate: createRevisionIntakeState('candidate', 'CANDIDATE') },
    scopeDecisions: {}, proposal: null, basis: null, basisStatus: BASIS_STATUS.NONE,
    search: { common: '', revAOnly: '', revBOnly: '' }, message: 'Load Rev A and Rev B staged JSON files.',
    compare: createComparisonLifecycleState(), review: createReviewLifecycleState(), decision: createDecisionLifecycleState(),
    evidencePackageImport: createRevisionEvidencePackageImportState(), signOff: createRevisionCompareSignOffState(),
    trustReceipt: createRevisionCompareTrustReceiptState(), transferReview: createRevisionCompareTransferReviewState(),
    transferCompletion: createRevisionCompareTransferCompletionState(),
  };
  return deepFreeze({ ...state, transfer: createRevisionCompareTransferState(undefined, captureRevisionCompareTransferAuthority(state)) });
}
export function startWorkspaceEvidencePackageImport(state, generation, fileName) {
  const base = { ...createRevisionEvidencePackageImportState(), requestGeneration: generation, fileName: String(fileName ?? '') };
  const failed = !revisionWorkspaceIsFreshForEvidencePackageImport(state);
  const next = deepFreeze({
    ...state,
    evidencePackageImport: deepFreeze({ ...base, status: failed ? 'FAILED' : 'IMPORTING',
      integrityStatus: failed ? 'FAILED' : 'VERIFYING', error: failed ? REVISION_EVIDENCE_PACKAGE_FRESH_WORKSPACE_ERROR : null }),
    message: failed ? REVISION_EVIDENCE_PACKAGE_FRESH_WORKSPACE_ERROR : 'Importing and verifying evidence package…',
  });
  return transferAfterAuthorityChange(state, next);
}
export function failWorkspaceEvidencePackageImport(state, generation, error) {
  if (state.evidencePackageImport.requestGeneration !== generation) return state;
  const message = String(error?.message ?? error);
  return transferAfterAuthorityChange(state, deepFreeze({
    ...state,
    evidencePackageImport: deepFreeze({
      ...state.evidencePackageImport, status: 'FAILED', packageId: null, contentSha256: null,
      integrityStatus: 'FAILED', reviewReattached: false, decisionReattached: false, error: message,
    }),
    message,
  }));
}
function firstReviewable(audit) {
  return audit.differenceRows.find((row) => row.differenceCategory !== 'UNCHANGED')?.differenceId
    ?? audit.differenceRows[0]?.differenceId ?? null;
}
function importedComparison(compare, audit) {
  return deepFreeze({
    ...compare, status: 'COMPLETE', runGeneration: compare.runGeneration + 1, runId: null,
    progress: null, audit, auditBasisId: audit.basisId, error: null,
    selectedDifferenceId: firstReviewable(audit), reviewVisible: true,
  });
}
export function completeWorkspaceEvidencePackageImport(state, generation, verified) {
  if (state.evidencePackageImport.requestGeneration !== generation
      || state.evidencePackageImport.status !== 'IMPORTING') return state;
  if (!revisionWorkspaceIsFreshForEvidencePackageImport(state)) {
    return failWorkspaceEvidencePackageImport(state, generation, REVISION_EVIDENCE_PACKAGE_FRESH_WORKSPACE_ERROR);
  }
  const receipt = verified.receipt;
  const next = {
    ...state, session: verified.session, slots: verified.slots, scopeDecisions: {}, proposal: verified.proposal,
    basis: verified.basis, basisStatus: BASIS_STATUS.CURRENT, compare: importedComparison(state.compare, verified.audit),
    review: deepFreeze({ ...state.review, session: verified.reviewSession, replacementRequired: false, importError: null }),
    decision: deepFreeze({ ...state.decision, ledger: verified.decisionLedger, replacementRequired: false, importError: null, preview: { differenceId: null, candidateIndex: 0 } }),
    evidencePackageImport: deepFreeze({
      schema: REVISION_EVIDENCE_PACKAGE_IMPORT_STATE_SCHEMA, status: 'VERIFIED', requestGeneration: generation,
      fileName: receipt.fileName, packageId: receipt.packageId, contentSha256: receipt.contentSha256,
      integrityStatus: receipt.integrityStatus, reviewReattached: receipt.reviewReattached,
      decisionReattached: receipt.decisionReattached, authenticityStatus: receipt.authenticityStatus, error: null,
    }),
    message: 'Evidence package imported and authority chain reopened.',
  };
  return authorityAfterChange(state, next);
}
function currentTrust(state) { return state.trustReceipt ?? createRevisionCompareTrustReceiptState(); }
export function startWorkspaceTrustReceiptImport(state, generation, fileName) {
  const current = currentTrust(state); const report = state.signOff?.report;
  const next = deepFreeze({ ...current, status: REVISION_COMPARE_TRUST_STATUS.IMPORTING,
    requestGeneration: generation, fileName: String(fileName ?? ''), error: null });
  if (!report) return deepFreeze({ ...state, trustReceipt: deepFreeze({ ...next,
    status: REVISION_COMPARE_TRUST_STATUS.FAILED, error: REVISION_TRUST_REPORT_REQUIRED_ERROR }), message: REVISION_TRUST_REPORT_REQUIRED_ERROR });
  return deepFreeze({ ...state, trustReceipt: next, message: 'Importing and verifying external signature receipt…' });
}
export function failWorkspaceTrustReceiptImport(state, generation, error) {
  const current = currentTrust(state); if (current.requestGeneration !== generation) return state;
  const message = String(error?.message ?? error);
  return deepFreeze({ ...state, trustReceipt: deepFreeze({ ...current,
    status: REVISION_COMPARE_TRUST_STATUS.FAILED,
    cryptographicStatus: current.receipt ? 'VALID' : 'INVALID', error: message }), message });
}
export function completeWorkspaceTrustReceiptImport(state, generation, receipt) {
  const current = currentTrust(state);
  if (current.requestGeneration !== generation || current.status !== REVISION_COMPARE_TRUST_STATUS.IMPORTING) return state;
  const report = state.signOff?.report;
  if (!report || receipt.subject.signOffReportId !== report.reportId || receipt.subject.signOffContentSha256 !== report.contentSha256) {
    return failWorkspaceTrustReceiptImport(state, generation, 'The verified receipt no longer matches the retained completion report.');
  }
  const status = state.signOff.status === 'CREATED'
    ? REVISION_COMPARE_TRUST_STATUS.VERIFIED_CURRENT : REVISION_COMPARE_TRUST_STATUS.VERIFIED_HISTORICAL;
  return deepFreeze({ ...state, trustReceipt: deepFreeze({
    schema: 'RevisionCompareTrustReceiptState.v1', status, requestGeneration: generation,
    fileName: current.fileName, receipt, receiptId: receipt.receiptId, contentSha256: receipt.contentSha256,
    publicKeySha256: receipt.signature.publicKeySha256, cryptographicStatus: 'VALID',
    identityStatus: 'EXTERNALLY_ASSERTED', trustStatus: 'NOT_ESTABLISHED', error: null,
  }), message: 'External signature receipt verified.' });
}
export function startWorkspaceLoad(state, slotId, generation, fileName, fileSizeBytes, updatedAt) {
  return authorityAfterChange(state, {
    ...state, session: detachProjectDocument(state.session, slotId, updatedAt),
    slots: { ...state.slots, [slotId]: beginRevisionLoad(state.slots[slotId], generation, fileName, fileSizeBytes) },
    proposal: null, scopeDecisions: {}, basisStatus: staleStatus(state), ...invalidated(state, updatedAt),
    message: `Loading ${slotId === 'baseline' ? 'Rev A' : 'Rev B'}…`,
  });
}
export function finishWorkspaceLoad(state, slotId, result, updatedAt) {
  const slot = completeRevisionLoad(state.slots[slotId], result); if (slot === state.slots[slotId]) return state;
  return authorityAfterChange(state, {
    ...state, session: attachProjectDocument(state.session, result.document, updatedAt),
    slots: { ...state.slots, [slotId]: slot }, proposal: null, scopeDecisions: {}, basisStatus: staleStatus(state),
    ...invalidated(state, updatedAt), message: `${slotId === 'baseline' ? 'Rev A' : 'Rev B'} is ready.`,
  });
}
export function failWorkspaceLoad(state, slotId, generation, error) {
  const slot = failRevisionLoad(state.slots[slotId], generation, error); if (slot === state.slots[slotId]) return state;
  return authorityAfterChange(state, { ...state, slots: { ...state.slots, [slotId]: slot }, proposal: null,
    basisStatus: staleStatus(state), ...invalidated(state, state.session.updatedAt), message: slot.error });
}
export function setWorkspaceProposal(state, proposal, decisions = state.scopeDecisions, updatedAt = state.session.updatedAt) {
  return authorityAfterChange(state, {
    ...state, scopeDecisions: decisions, proposal,
    basisStatus: state.basisStatus === BASIS_STATUS.CURRENT ? BASIS_STATUS.STALE : state.basisStatus,
    ...invalidated(state, updatedAt), message: proposal ? 'Review the proposed common and one-sided branch scope.' : state.message,
  });
}
export function finishWorkspaceScope(state, results, scopeDrafts, updatedAt) {
  const baseline = completeRevisionScope(state.slots.baseline, results.baseline, scopeDrafts.baseline);
  const candidate = completeRevisionScope(state.slots.candidate, results.candidate, scopeDrafts.candidate);
  let session = attachProjectDocument(state.session, baseline.document, updatedAt);
  session = attachProjectDocument(session, candidate.document, updatedAt);
  return authorityAfterChange(state, { ...state, session, slots: { baseline, candidate } });
}
export function setWorkspaceBasis(state, basis) {
  return authorityAfterChange(state, { ...state, basis, basisStatus: BASIS_STATUS.CURRENT,
    compare: readyComparisonState(state.compare), message: 'Comparison basis approved and ready for visual comparison.' });
}
export function setWorkspaceSearch(state, group, value) { return Object.hasOwn(state.search, group) ? deepFreeze({ ...state, search: { ...state.search, [group]: String(value ?? '') } }) : state; }
export function setWorkspaceMessage(state, message) { return deepFreeze({ ...state, message: String(message ?? '') }); }
export function resetWorkspaceSlot(state, slotId, generation, updatedAt) {
  return authorityAfterChange(state, { ...state, session: detachProjectDocument(state.session, slotId, updatedAt),
    slots: { ...state.slots, [slotId]: deepFreeze({ ...createRevisionIntakeState(slotId, state.slots[slotId].role), requestGeneration: generation }) },
    proposal: null, scopeDecisions: {}, basisStatus: staleStatus(state), ...invalidated(state, updatedAt),
    message: `${slotId === 'baseline' ? 'Rev A' : 'Rev B'} load cancelled.` });
}
export function startWorkspaceComparison(state, token) { return authorityAfterChange(state, { ...state, compare: startComparisonState(state.compare, token), message: 'Projecting approved revision scope.' }); }
export function progressWorkspaceComparison(state, token, progress) { const compare = progressComparisonState(state.compare, token, progress); return compare === state.compare ? state : deepFreeze({ ...state, compare, message: progress.stage }); }
export function completeWorkspaceComparison(state, token, audit, updatedAt) {
  const compare = completeComparisonState(state.compare, token, audit); if (compare === state.compare) return state;
  return authorityAfterChange(state, { ...state, compare, review: attachReviewAudit(state.review, audit, updatedAt),
    decision: attachDecisionAudit(state.decision, audit, updatedAt), message: 'Visual comparison complete.' });
}
export function cancelWorkspaceComparison(state) { return deepFreeze({ ...state, compare: cancelComparisonState(state.compare), message: 'Visual comparison cancelled.' }); }
export function failWorkspaceComparison(state, error) { return deepFreeze({ ...state, compare: failComparisonState(state.compare, error), message: String(error?.message ?? error) }); }
export function selectWorkspaceDifference(state, id) { return deepFreeze({ ...state, compare: setComparisonSelection(state.compare, id) }); }
export function setWorkspacePresentation(state, mode) { return deepFreeze({ ...state, compare: setComparisonPresentation(state.compare, mode) }); }
export function setWorkspaceViewerBackend(state, backend) { return deepFreeze({ ...state, compare: setComparisonViewerBackend(state.compare, backend) }); }
export function setWorkspaceQueueSearch(state, value) { return deepFreeze({ ...state, compare: setComparisonQueueSearch(state.compare, value) }); }
export function toggleWorkspaceCategory(state, category) { return deepFreeze({ ...state, compare: toggleComparisonCategory(state.compare, category) }); }
export function toggleWorkspaceChangedReason(state, reason) { return deepFreeze({ ...state, compare: toggleChangedReason(state.compare, reason) }); }
export function setWorkspaceNeedsDecision(state, enabled) { return deepFreeze({ ...state, compare: setNeedsDecisionOnly(state.compare, enabled) }); }
export function setWorkspaceReviewVisible(state, visible) { return deepFreeze({ ...state, compare: setComparisonReviewVisible(state.compare, visible) }); }
export function setWorkspaceReviewSession(state, session) { return authorityAfterChange(state, { ...state, review: setReviewLifecycleSession(state.review, session) }); }
export function setWorkspaceReviewImportError(state, error) { return authorityAfterChange(state, { ...state, review: setReviewImportError(state.review, error) }); }
export function startWorkspaceNewReviewSession(state, createdAt) {
  if (!state.compare.audit) throw new Error('A current comparison audit is required.');
  return authorityAfterChange(state, { ...state, review: startNewReviewForAudit(state.review, state.compare.audit, createdAt), compare: setComparisonSelection(state.compare, null) });
}
export function setWorkspaceReviewSearch(state, value) { return deepFreeze({ ...state, review: setReviewSearch(state.review, value) }); }
export function toggleWorkspaceReviewFilter(state, group, value) { return deepFreeze({ ...state, review: toggleReviewFilter(state.review, group, value) }); }
export function setWorkspaceDecisionLedger(state, ledger) { return authorityAfterChange(state, { ...state, decision: setDecisionLifecycleLedger(state.decision, ledger) }); }
export function setWorkspaceDecisionImportError(state, error) { return authorityAfterChange(state, { ...state, decision: setDecisionImportError(state.decision, error) }); }
export function startWorkspaceNewDecisionLedger(state, createdAt) {
  if (!state.compare.audit) throw new Error('A current comparison audit is required.');
  return authorityAfterChange(state, { ...state, decision: startNewDecisionForAudit(state.decision, state.compare.audit, createdAt) });
}
export function setWorkspaceDecisionPreview(state, differenceId, candidateIndex) { return deepFreeze({ ...state, decision: setDecisionPreview(state.decision, differenceId, candidateIndex) }); }
export function toggleWorkspaceDecisionFilter(state, value) { return deepFreeze({ ...state, decision: toggleDecisionFilter(state.decision, value) }); }
export function setWorkspaceDecisionUnresolvedOnly(state, enabled) { return deepFreeze({ ...state, decision: setDecisionUnresolvedOnly(state.decision, enabled) }); }
export function setWorkspaceSignOffReport(state, report) {
  const signOff = deepFreeze({ schema: 'RevisionCompareSignOffState.v1', status: 'CREATED', report,
    sourcePackageId: report.sourceEvidence.packageId, sourcePackageContentSha256: report.sourceEvidence.packageContentSha256, error: null });
  return deepFreeze({ ...state, signOff, trustReceipt: createRevisionCompareTrustReceiptState() });
}
export function failWorkspaceSignOff(state, error) {
  const signOff = deepFreeze({ ...state.signOff, status: 'FAILED', error: String(error?.message ?? error) });
  return deepFreeze({ ...state, signOff, trustReceipt: reconcileRevisionCompareTrustReceiptState(state.trustReceipt, signOff) });
}
export function setWorkspaceTransferSelection(state, selection) { return transferLifecycleChange(state, setRevisionCompareTransferSelection(state.transfer, selection)); }
export function startWorkspaceTransferPlan(state, selection) { return transferLifecycleChange(state, startRevisionCompareTransferPlanRequest(state.transfer, selection, captureRevisionCompareTransferAuthority(state))); }
export function completeWorkspaceTransferPlan(state, generation, plan) {
  const current = reconcileRevisionCompareTransferAuthority(state.transfer, state);
  return transferLifecycleChange(state, completeRevisionCompareTransferPlanRequest(current, generation, plan));
}
export function failWorkspaceTransferPlan(state, generation, error) {
  const current = reconcileRevisionCompareTransferAuthority(state.transfer, state);
  return transferLifecycleChange(state, failRevisionCompareTransferPlanRequest(current, generation, error));
}
export function setWorkspaceTransferPolicyVersion(state, policyVersion) { return transferLifecycleChange(state, setRevisionCompareTransferPolicyVersion(state.transfer, policyVersion)); }
export function startWorkspaceTransferApply(state, createdAt) {
  const current = reconcileRevisionCompareTransferAuthority(state.transfer, state);
  const workspace = current === state.transfer ? state : deepFreeze({ ...state, transfer: current });
  const authority = captureRevisionCompareTransferApplyAuthority(workspace);
  return transferLifecycleChange(workspace, startRevisionCompareTransferApplyRequest(current, authority, createdAt));
}
export function completeWorkspaceTransferApply(state, generation, application) {
  const current = reconcileRevisionCompareTransferApplyAuthority(state.transfer, state);
  return transferLifecycleChange(state, completeRevisionCompareTransferApplyRequest(current, generation, application));
}
export function failWorkspaceTransferApply(state, generation, error) {
  const current = reconcileRevisionCompareTransferApplyAuthority(state.transfer, state);
  return transferLifecycleChange(state, failRevisionCompareTransferApplyRequest(current, generation, error));
}
