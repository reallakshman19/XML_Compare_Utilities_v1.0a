/** RC-001 intake, RC-002 compare, RC-003 review, and RC-004 decision actions. */
import { createRevisionComparisonBasis } from './revision-comparison-basis.js';
import { createRevisionSessionManifest, createRevisionScopeManifest } from './revision-manifests.js';
import { revisionComparisonPreflight } from './revision-preflight.js';
import { revisionBasisApprovalReadiness, revisionVisualReadiness } from './revision-compare-readiness.js';
import { applyRevisionCompareSwapResults, revisionCompareSwapReadiness } from './revision-compare-intake-swap.js';
import { applyRevisionScopeBatch } from './revision-scope-filter-batch.js';
import { createRevisionScopeProposal, updateScopeDecision } from './revision-scope-proposal.js';
import {
  clearRevisionVisualMetadataDeclaration, createRevisionVisualMetadataDeclaration,
} from './revision-visual-metadata-declaration.js';
import { RevisionRequestSupersededError } from './revision-load-service.js';
import { RevisionCompareSupersededError } from './revision-compare-service.js';
import { RevisionComparisonCancelledError } from './revision-compare-engine.js';
import { createReviewSessionExport, parseReviewSessionJson } from './revision-review-manifest.js';
import { nextPriorityDifferenceId, previousPriorityDifferenceId, projectReviewPriority, selectionAfterReviewMutation } from './revision-review-priority.js';
import { reviewSessionMatchesAudit, setReviewItemNote, setReviewItemState } from './revision-review-session.js';
import { filterDecisionAwareProjection } from './revision-decision-projection.js';
import {
  acceptSelectedCandidate, confirmSelectedNoMatch, deferSelectedDecision, downloadDecisionLedger,
  importDecisionLedger, previewDecisionCandidate, revokeSelectedDecision, selectDecisionDifference,
  setUnresolvedAmbiguityFilter, startNewDecisionLedger, stepDecisionCandidate, toggleDecisionStateFilter,
} from './revision-decision-actions.js';
import {
  cancelWorkspaceComparison, completeWorkspaceComparison, failWorkspaceComparison, failWorkspaceLoad,
  finishWorkspaceLoad, finishWorkspaceScope, progressWorkspaceComparison, resetWorkspaceSlot,
  selectWorkspaceDifference, setWorkspaceBasis, setWorkspaceMessage, setWorkspaceNeedsDecision,
  setWorkspacePresentation, setWorkspaceProposal, setWorkspaceQueueSearch, setWorkspaceReviewImportError, setWorkspaceViewerBackend,
  setWorkspaceReviewSearch, setWorkspaceReviewSession, setWorkspaceReviewVisible, setWorkspaceSearch,
  startWorkspaceComparison, startWorkspaceLoad, startWorkspaceNewReviewSession, toggleWorkspaceCategory,
  toggleWorkspaceChangedReason, toggleWorkspaceReviewFilter,
} from './revision-workspace-state.js';

function labelFor(slotId) { return slotId === 'baseline' ? 'Rev A' : 'Rev B'; }
function preflight(context, state) {
  return revisionComparisonPreflight(state.slots.baseline, state.slots.candidate, state.proposal, state.visualMetadataDeclaration);
}
function commit(context, state) { context.writeState(state); context.render(state); return state; }
function clockValue(context) { return Number(context.clock?.()) || 0; }
export function createRevisionActionAuthority() {
  let revision = 0;
  return Object.freeze({ invalidate: () => { revision += 1; return revision; }, capture: () => revision, isCurrent: (token) => token === revision });
}
function commitAuthoritative(context, state) { context.authority.invalidate(); return commit(context, state); }
async function proposalFor(context, state, decisions) {
  if (!state.slots.baseline.document || !state.slots.candidate.document) return null;
  return createRevisionScopeProposal(state.slots.baseline, state.slots.candidate, decisions, context.cryptoRef);
}
function report(context, error) {
  const message = error?.message || String(error); const live = context.root.querySelector('[data-revc-live]');
  if (live) live.textContent = message; context.options?.showToast?.(message, 'error');
}
async function stopComparison(context) { await context.compareService?.cancel?.(); context.viewerAdapter?.clear?.(); }
async function refreshProposal(context, decisions) {
  const token = context.authority.capture(); const proposal = await proposalFor(context, context.readState(), decisions);
  if (!context.authority.isCurrent(token)) return false;
  commitAuthoritative(context, setWorkspaceProposal(context.readState(), proposal, decisions, context.now())); return true;
}
async function loadRevision(context, slotId, file) {
  await stopComparison(context); const generation = context.service.begin(slotId);
  const cleared = clearRevisionVisualMetadataDeclaration(context.readState());
  commitAuthoritative(context, startWorkspaceLoad(cleared, slotId, generation, file.name, file.size, context.now()));
  try {
    const result = await context.service.loadFile(slotId, file, context.now(), generation);
    const loaded = finishWorkspaceLoad(context.readState(), slotId, result, context.now()); if (loaded === context.readState()) return;
    commitAuthoritative(context, loaded); await refreshProposal(context, {}); context.options?.showToast?.(`${labelFor(slotId)} loaded.`, 'success');
  } catch (error) {
    if (error instanceof RevisionRequestSupersededError) return;
    const failed = failWorkspaceLoad(context.readState(), slotId, generation, error);
    if (failed !== context.readState()) commitAuthoritative(context, failed); report(context, error);
  }
}
async function cancelRevision(context, slotId) {
  const token = context.authority.invalidate(); await stopComparison(context);
  try {
    const generation = await context.service.cancel(slotId); if (!context.authority.isCurrent(token)) return;
    const reset = resetWorkspaceSlot(context.readState(), slotId, generation, context.now());
    commitAuthoritative(context, clearRevisionVisualMetadataDeclaration(reset));
  } catch (error) { report(context, error); }
}
function swappedWorkspaceState(context) {
  const results = context.service.swapLoadedSlots();
  try {
    const state = clearRevisionVisualMetadataDeclaration(context.readState());
    return applyRevisionCompareSwapResults(state, results, context.now());
  } catch (error) {
    try { context.service.swapLoadedSlots(); }
    catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'Revision swap failed and service rollback was not completed.');
    }
    throw error;
  }
}
async function swapRevisions(context) {
  const readiness = revisionCompareSwapReadiness(context.readState());
  if (readiness.status !== 'READY') throw new Error(readiness.blockers[0]);
  const token = context.authority.invalidate(); await stopComparison(context);
  if (!context.authority.isCurrent(token)) return;
  const current = revisionCompareSwapReadiness(context.readState());
  if (current.status !== 'READY') throw new Error(current.blockers[0]);
  commitAuthoritative(context, swappedWorkspaceState(context));
  await refreshProposal(context, {});
  context.options?.showToast?.('Rev A and Rev B swapped.', 'success');
}
async function refineScope(context, decisions) {
  const token = context.authority.invalidate(); await stopComparison(context);
  const proposal = await proposalFor(context, context.readState(), decisions); if (!context.authority.isCurrent(token)) return false;
  commitAuthoritative(context, setWorkspaceProposal(context.readState(), proposal, decisions, context.now()));
  return true;
}
async function setBranch(context, branchId, included) {
  const decisions = updateScopeDecision(context.readState().scopeDecisions, branchId, !included); await refineScope(context, decisions);
}
function batchToast(result, included) {
  const qualifier = result.batch.filtered ? 'visible ' : '';
  return `${included ? 'Selected' : 'Cleared'} ${result.batch.visibleCount} ${qualifier}branch(es).`;
}
async function setGroup(context, group, included) {
  const state = context.readState();
  const result = applyRevisionScopeBatch(state.scopeDecisions, state, group, included);
  if (!result.batch.branchIds.length) return;
  const committed = await refineScope(context, result.decisions);
  if (committed) context.options?.showToast?.(batchToast(result, included), 'success');
}
function visualMetadataValues(context) {
  return {
    unit: context.root.querySelector('[data-revc-visual-unit]')?.value,
    coordinateFrame: context.root.querySelector('[data-revc-visual-frame]')?.value,
    verticalAxis: context.root.querySelector('[data-revc-visual-axis]')?.value,
  };
}
function declarationTransition(context, declaration, message) {
  const state = { ...context.readState(), visualMetadataDeclaration: declaration };
  const invalidated = setWorkspaceProposal(state, state.proposal, state.scopeDecisions, context.now());
  return setWorkspaceMessage(invalidated, message);
}
async function applyVisualMetadata(context) {
  const token = context.authority.invalidate(); await stopComparison(context);
  const state = context.readState();
  const declaration = await createRevisionVisualMetadataDeclaration(
    state.slots.baseline.document, state.slots.candidate.document, visualMetadataValues(context), context.cryptoRef,
  );
  if (!context.authority.isCurrent(token)) return;
  commitAuthoritative(context, declarationTransition(context, declaration, 'Visual coordinate declaration applied. Reapprove the comparison basis.'));
  context.options?.showToast?.('Visual coordinate declaration applied. Reapprove the comparison basis.', 'success');
}
async function clearVisualMetadata(context) {
  if (!context.readState().visualMetadataDeclaration) return;
  const token = context.authority.invalidate(); await stopComparison(context);
  if (!context.authority.isCurrent(token)) return;
  commitAuthoritative(context, declarationTransition(context, null, 'Visual coordinate declaration cleared.'));
  context.options?.showToast?.('Visual coordinate declaration cleared.', 'success');
}
function scopeDraft(proposal, side) { return Object.freeze({ selectedIds: side === 'A' ? proposal.includedBranchIdsA : proposal.includedBranchIdsB, exclusions: proposal.excludedBranches }); }
async function approveBasis(context) {
  await stopComparison(context); const token = context.authority.invalidate(); const state = context.readState(); const current = preflight(context, state);
  const readiness = revisionBasisApprovalReadiness(current);
  if (readiness.status !== 'READY') throw new Error(readiness.blockers[0] || 'Comparison basis is blocked.');
  const proposal = state.proposal;
  const [baseline, candidate] = await Promise.all([
    context.service.applyScope('baseline', { selectedIds: proposal.includedBranchIdsA }, context.now()),
    context.service.applyScope('candidate', { selectedIds: proposal.includedBranchIdsB }, context.now()),
  ]);
  if (!context.authority.isCurrent(token)) return;
  const scoped = finishWorkspaceScope(context.readState(), { baseline, candidate }, { baseline: scopeDraft(proposal, 'A'), candidate: scopeDraft(proposal, 'B') }, context.now());
  commitAuthoritative(context, scoped); const basisToken = context.authority.capture();
  const basis = await createRevisionComparisonBasis({
    sessionId: scoped.session.sessionId, revA: scoped.slots.baseline, revB: scoped.slots.candidate,
    proposal, preflight: preflight(context, scoped), visualMetadataDeclaration: scoped.visualMetadataDeclaration,
  }, context.cryptoRef);
  if (!context.authority.isCurrent(basisToken)) return;
  commitAuthoritative(context, setWorkspaceBasis(context.readState(), basis)); context.options?.showToast?.('Comparison basis approved.', 'success');
}
function projectionProgress(context, token, stage) {
  commit(context, progressWorkspaceComparison(context.readState(), token, { stage, recordsProcessed: 0, candidatePairsEvaluated: 0, maximumCandidatesForOneRecord: 0 }));
}
async function projectApprovedScope(context, token, basis) {
  projectionProgress(context, token, 'Projecting Rev A scope'); let started = clockValue(context);
  const revA = await context.service.projectCompareRecords('baseline', basis); const projectRevAMilliseconds = Math.max(0, clockValue(context) - started);
  projectionProgress(context, token, 'Projecting Rev B scope'); started = clockValue(context);
  const revB = await context.service.projectCompareRecords('candidate', basis); const projectRevBMilliseconds = Math.max(0, clockValue(context) - started);
  return { revA, revB, projectionReceipt: { projectRevAMilliseconds, projectRevBMilliseconds } };
}
function ensureRunAuthority(context, basisId) {
  const state = context.readState(); if (state.basisStatus !== 'CURRENT' || state.basis?.basisId !== basisId) throw new RevisionCompareSupersededError();
}
function combinedReviewFilters(state) {
  return { ...state.review.filters, categories: state.compare.queue.categories, search: state.review.filters.search,
    needsDecisionOnly: state.compare.queue.needsDecisionOnly, changedReasons: state.compare.queue.changedReasons };
}
function reviewProjection(state) {
  const audit = state.compare.audit; const session = state.review.session;
  if (!audit || !reviewSessionMatchesAudit(session, audit)) return { all: [], visible: [], visibleCount: 0, hiddenCount: 0 };
  return filterDecisionAwareProjection(projectReviewPriority(audit, session, combinedReviewFilters(state)), audit, state.decision);
}
async function runVisualComparison(context) {
  const initial = context.readState(); const readiness = revisionVisualReadiness(initial); if (readiness.status !== 'READY') throw new Error(readiness.blockers[0]);
  const basis = initial.basis; const token = await context.compareService.begin(basis.basisId); commit(context, startWorkspaceComparison(context.readState(), token));
  try {
    const projection = await projectApprovedScope(context, token, basis); ensureRunAuthority(context, basis.basisId);
    const audit = await context.compareService.compare(token, { basis, ...projection }, (progress) => {
      if (context.readState().compare.runGeneration === token.generation) commit(context, progressWorkspaceComparison(context.readState(), token, progress));
    });
    ensureRunAuthority(context, basis.basisId); const completed = completeWorkspaceComparison(context.readState(), token, audit, context.now()); commit(context, completed);
    const first = reviewProjection(completed).visible[0]?.row.differenceId ?? completed.compare.selectedDifferenceId;
    selectDecisionDifference(decisionContext(context), first); context.options?.showToast?.('Visual comparison complete.', 'success');
  } catch (error) {
    if (error instanceof RevisionCompareSupersededError) return;
    if (error instanceof RevisionComparisonCancelledError || error?.code === 'REVISION_COMPARE_CANCELLED') { commit(context, cancelWorkspaceComparison(context.readState())); return; }
    commit(context, failWorkspaceComparison(context.readState(), error)); report(context, error);
  }
}
async function cancelComparison(context) { await context.compareService.cancel(); commit(context, cancelWorkspaceComparison(context.readState())); }
function commitReviewMutation(context, session, before, currentId) {
  let next = setWorkspaceReviewSession(context.readState(), session); const after = reviewProjection(next);
  const selection = selectionAfterReviewMutation(before, after, currentId); commit(context, next);
  if (selection !== currentId) selectDecisionDifference(decisionContext(context), selection);
}
function setReviewState(context, reviewState) {
  const state = context.readState(); const id = state.compare.selectedDifferenceId; if (!id) return;
  const before = reviewProjection(state); const session = setReviewItemState(state.review.session, state.compare.audit, id, reviewState, context.now());
  if (session !== state.review.session) commitReviewMutation(context, session, before, id);
}
async function saveReviewNote(context) {
  const state = context.readState(); const id = state.compare.selectedDifferenceId; if (!id) return;
  const field = context.root.querySelector('[data-revc-review-note]'); const before = reviewProjection(state);
  const session = await setReviewItemNote(state.review.session, state.compare.audit, id, field?.value ?? '', context.now(), context.cryptoRef);
  if (session !== state.review.session) commitReviewMutation(context, session, before, id);
}
function navigateReview(context, direction) {
  const state = context.readState(); const projection = reviewProjection(state); const current = state.compare.selectedDifferenceId;
  const id = direction === 'previous' ? previousPriorityDifferenceId(projection, current) : nextPriorityDifferenceId(projection, current);
  if (id) selectDecisionDifference(decisionContext(context), id);
}
async function importReviewSession(context, file) {
  const state = context.readState(); const audit = state.compare.audit; if (!audit) throw new Error('Run the exact comparison audit before importing a review session.');
  try {
    const text = file.text ? await file.text() : new TextDecoder().decode(await file.arrayBuffer());
    const session = await parseReviewSessionJson(text, audit, context.now(), context.cryptoRef);
    commit(context, setWorkspaceReviewSession(setWorkspaceReviewImportError(context.readState(), null), session)); context.options?.showToast?.('Review session imported.', 'success');
  } catch (error) { commit(context, setWorkspaceReviewImportError(context.readState(), error)); report(context, error); }
}
function startNewReview(context) {
  const next = startWorkspaceNewReviewSession(context.readState(), context.now()); commit(context, next);
  const first = reviewProjection(next).visible[0]?.row.differenceId ?? null; selectDecisionDifference(decisionContext(context), first);
}
function downloadSession(context) {
  const state = context.readState(); context.downloadArtifact(context.root, `${state.session.sessionId}.session.json`, createRevisionSessionManifest(state, preflight(context, state)));
}
function downloadScope(context) {
  const state = context.readState(); context.downloadArtifact(context.root, `${state.session.sessionId}.scope-basis.json`, createRevisionScopeManifest(state, preflight(context, state)));
}
function downloadReview(context) {
  const session = createReviewSessionExport(context.readState().review.session); context.downloadArtifact(context.root, `${session.reviewSessionId}.json`, session);
}
function safe(context, operation) { return async (...args) => { try { await operation(...args); } catch (error) { report(context, error); } }; }
function updateAndRender(context, transition, ...args) { return commit(context, transition(context.readState(), ...args)); }
function decisionContext(context) { return { ...context, commit: (state) => commit(context, state), report: (error) => report(context, error) }; }
export function createRevisionActions(context) {
  const guarded = { ...context, authority: createRevisionActionAuthority() }; const decisions = decisionContext(guarded);
  return Object.freeze({
    load: (slotId, file) => loadRevision(guarded, slotId, file), cancel: (slotId) => cancelRevision(guarded, slotId),
    swapRevisions: safe(guarded, () => swapRevisions(guarded)),
    applyVisualMetadata: safe(guarded, () => applyVisualMetadata(guarded)), clearVisualMetadata: safe(guarded, () => clearVisualMetadata(guarded)),
    setBranchIncluded: safe(guarded, (id, included) => setBranch(guarded, id, included)), setGroupIncluded: safe(guarded, (group, included) => setGroup(guarded, group, included)),
    setSearch: (group, value) => updateAndRender(guarded, setWorkspaceSearch, group, value), approveBasis: safe(guarded, () => approveBasis(guarded)),
    runVisualComparison: safe(guarded, () => runVisualComparison(guarded)), cancelComparison: safe(guarded, () => cancelComparison(guarded)),
    selectDifference: (id) => selectDecisionDifference(decisions, id),
    setPresentation: (mode) => { updateAndRender(guarded, setWorkspacePresentation, mode); guarded.viewerAdapter.setPresentationMode(mode); },
    setViewerBackend: (backend) => updateAndRender(guarded, setWorkspaceViewerBackend, backend),
    setQueueSearch: (value) => updateAndRender(guarded, setWorkspaceQueueSearch, value), toggleCategory: (category) => updateAndRender(guarded, toggleWorkspaceCategory, category),
    toggleChangedReason: (reason) => updateAndRender(guarded, toggleWorkspaceChangedReason, reason), setNeedsDecision: (enabled) => updateAndRender(guarded, setWorkspaceNeedsDecision, enabled),
    toggleReviewFilter: (group, value) => updateAndRender(guarded, toggleWorkspaceReviewFilter, group, value), setReviewSearch: (value) => updateAndRender(guarded, setWorkspaceReviewSearch, value),
    setReviewState: safe(guarded, (state) => setReviewState(guarded, state)), saveReviewNote: safe(guarded, () => saveReviewNote(guarded)),
    nextPriority: () => navigateReview(guarded, 'next'), previousPriority: () => navigateReview(guarded, 'previous'),
    importReviewSession: (file) => importReviewSession(guarded, file), startNewReviewSession: safe(guarded, () => startNewReview(guarded)),
    downloadReviewSession: safe(guarded, () => downloadReview(guarded)),
    previewCandidate: (index) => previewDecisionCandidate(decisions, index), previousCandidate: () => stepDecisionCandidate(decisions, 'previous'), nextCandidate: () => stepDecisionCandidate(decisions, 'next'),
    acceptCandidate: safe(guarded, () => acceptSelectedCandidate(decisions)), confirmNoMatch: safe(guarded, () => confirmSelectedNoMatch(decisions)),
    deferDecision: safe(guarded, () => deferSelectedDecision(decisions)), revokeDecision: safe(guarded, () => revokeSelectedDecision(decisions)),
    toggleDecisionFilter: (value) => toggleDecisionStateFilter(decisions, value), setUnresolvedAmbiguity: (enabled) => setUnresolvedAmbiguityFilter(decisions, enabled),
    importDecisionLedger: (file) => importDecisionLedger(decisions, file), startNewDecisionLedger: safe(guarded, () => startNewDecisionLedger(decisions)),
    downloadDecisionLedger: safe(guarded, () => downloadDecisionLedger(decisions)),
    showSetup: () => updateAndRender(guarded, setWorkspaceReviewVisible, false), showReview: () => updateAndRender(guarded, setWorkspaceReviewVisible, true),
    fitAll: () => guarded.viewerAdapter.fitAll(), fitSelected: () => guarded.viewerAdapter.fitSelected(), downloadSession: safe(guarded, () => downloadSession(guarded)),
    downloadScope: safe(guarded, () => downloadScope(guarded)), close: () => guarded.options?.close?.(), setMessage: (message) => updateAndRender(guarded, setWorkspaceMessage, message),
  });
}
