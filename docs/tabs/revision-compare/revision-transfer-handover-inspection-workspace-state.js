/** Workspace v14 adoption and deterministic isolation for imported handovers. */
import { deepFreeze } from './revision-contract-utils.js';
import { createRevisionCompareHandoverInspectionState } from './revision-transfer-handover-inspection-state.js';

export const REVISION_COMPARE_HANDOVER_INSPECTION_WORKSPACE_SCHEMA = 'RevisionCompareWorkspaceState.v14';
const ACTIVE_COMPARE = Object.freeze(['PROJECTING', 'COMPARING', 'BUILDING_VISUAL']);
function sourceAuthorityBlocker(state) {
  if (state.slots?.baseline?.document || state.slots?.baseline?.jsonSnapshot) return 'Remove the current Rev A source before importing a handover.';
  if (state.slots?.candidate?.document || state.slots?.candidate?.jsonSnapshot) return 'Remove the current Rev B source before importing a handover.';
  if (state.session?.documents?.baseline || state.session?.documents?.candidate) return 'Open a workspace with no session-attached revision sources.';
  if (state.proposal) return 'Open a workspace with no comparison-scope proposal.';
  if (state.basis) return 'Open a workspace with no comparison basis.';
  if (state.compare?.audit) return 'Open a workspace with no comparison audit.';
  if (state.review?.session) return 'Open a workspace with no review session.';
  if (state.decision?.ledger) return 'Open a workspace with no ambiguity-decision ledger.';
  return null;
}
function transferAuthorityBlocker(state) {
  const transfer = state.transfer;
  if (transfer?.plan || transfer?.result || transfer?.patchedSnapshot || transfer?.artifacts?.length) {
    return 'Open a workspace with no retained transfer authority.';
  }
  const completion = state.transferCompletion;
  if (completion?.report || completion?.bundle || completion?.reportArtifact || completion?.bundleArtifact) {
    return 'Open a workspace with no transfer completion authority.';
  }
  if (state.transferArchive?.artifact) return 'Open a workspace with no offline transfer archive.';
  if (state.signOff?.report) return 'Open a workspace with no retained completion sign-off.';
  if (state.trustReceipt?.receipt) return 'Open a workspace with no retained external trust receipt.';
  return null;
}
function activeOperationBlocker(state, activity) {
  if (state.slots?.baseline?.status === 'LOADING' || state.slots?.candidate?.status === 'LOADING') return 'Wait for active revision source loading to finish.';
  if (ACTIVE_COMPARE.includes(state.compare?.status)) return 'Wait for active comparison execution to finish.';
  if (state.evidencePackageImport?.status === 'IMPORTING') return 'Wait for evidence-package verification to finish.';
  if (activity.reviewImportBusy) return 'Wait for active review import to finish.';
  if (activity.decisionImportBusy) return 'Wait for active decision import to finish.';
  if (state.transfer?.request) return 'Wait for the active transfer-plan request to finish.';
  if (state.transfer?.applyRequest) return 'Wait for the active transfer-apply request to finish.';
  if (activity.completionBusy) return 'Wait for active transfer completion creation to finish.';
  if (activity.archiveBusy) return 'Wait for active archive creation to finish.';
  return null;
}
function inspectionBlocker(state, activity) {
  const status = state.handoverInspection?.status ?? 'IDLE';
  if (status === 'IMPORTING' && activity.allowImportSupersede) return null;
  if (status === 'VERIFIED') return 'Clear the verified handover inspection before importing another file.';
  if (status !== 'IDLE') return 'Clear the current handover inspection before importing another file.';
  return null;
}
export function revisionCompareHandoverInspectionReadiness(state, activity = {}) {
  if (!state) return deepFreeze({ status: 'BLOCKED', blockers: Object.freeze(['Revision Compare workspace state is required.']) });
  const blocker = sourceAuthorityBlocker(state) ?? transferAuthorityBlocker(state)
    ?? activeOperationBlocker(state, activity) ?? inspectionBlocker(state, activity);
  const blockers = Object.freeze(blocker ? [blocker] : []);
  return deepFreeze({ status: blockers.length ? 'BLOCKED' : 'READY', blockers });
}
export function revisionCompareWorkspaceIsFreshForHandoverInspection(state, activity = {}) {
  return revisionCompareHandoverInspectionReadiness(state, activity).status === 'READY';
}
export function revisionCompareHandoverInspectionLocksAuthority(state) {
  return ['IMPORTING', 'VERIFIED'].includes(state?.handoverInspection?.status);
}
export function adoptRevisionCompareHandoverInspectionWorkspace(state) {
  if (state?.schema === REVISION_COMPARE_HANDOVER_INSPECTION_WORKSPACE_SCHEMA && state.handoverInspection) return state;
  return deepFreeze({
    ...state, schema: REVISION_COMPARE_HANDOVER_INSPECTION_WORKSPACE_SCHEMA,
    handoverInspection: state?.handoverInspection ?? createRevisionCompareHandoverInspectionState(),
  });
}
export function setWorkspaceHandoverInspection(state, inspection) {
  const adopted = adoptRevisionCompareHandoverInspectionWorkspace(state);
  return deepFreeze({ ...adopted, handoverInspection: inspection });
}
