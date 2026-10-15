/** Workspace transitions for patched-target completion and dependent archive authority. */
import { deepFreeze } from './revision-contract-utils.js';
import {
  completeRevisionCompareTransferCompletionState, createRevisionCompareTransferCompletionState,
  failRevisionCompareTransferCompletionState, revisionCompareTransferCompletionAuthorityMatches,
  revisionCompareTransferCompletionStateForReadiness, staleRevisionCompareTransferCompletionState,
} from './revision-transfer-completion-state.js';
import { reconcileRevisionCompareTransferArchiveAfterAuthorityChange } from './revision-transfer-archive-workspace-state.js';

function nextCompletion(previous, next) {
  const prior = previous?.transferCompletion ?? createRevisionCompareTransferCompletionState();
  return prior.report ? staleRevisionCompareTransferCompletionState(prior)
    : revisionCompareTransferCompletionStateForReadiness(next);
}
export function reconcileRevisionCompareTransferCompletionAfterAuthorityChange(previous, next) {
  const transferCompletion = nextCompletion(previous, next);
  const completed = transferCompletion === next.transferCompletion ? next : deepFreeze({ ...next, transferCompletion });
  return reconcileRevisionCompareTransferArchiveAfterAuthorityChange(previous, completed);
}
export function completeWorkspaceTransferCompletion(state, captured, application) {
  let next;
  if (!revisionCompareTransferCompletionAuthorityMatches(captured, state)) {
    next = deepFreeze({ ...state, transferCompletion: failRevisionCompareTransferCompletionState(
      'Transfer completion authority changed during creation. Create the completion record again.',
    ) });
  } else {
    next = deepFreeze({ ...state, transferCompletion: completeRevisionCompareTransferCompletionState(application, state) });
  }
  return reconcileRevisionCompareTransferArchiveAfterAuthorityChange(state, next);
}
export function failWorkspaceTransferCompletion(state, error) {
  const next = deepFreeze({ ...state, transferCompletion: failRevisionCompareTransferCompletionState(error) });
  return reconcileRevisionCompareTransferArchiveAfterAuthorityChange(state, next);
}
export const _test = Object.freeze({ nextCompletion });
