/** Workspace transitions for authority-bearing transfer draft and presentation-only query state. */
import { deepFreeze } from './revision-contract-utils.js';
import {
  createRevisionCompareSignOffState, signOffStateForReadiness, staleRevisionCompareSignOffState,
} from './revision-sign-off.js';
import { reconcileRevisionCompareTrustReceiptState } from './revision-trust-receipt.js';
import {
  invalidateRevisionCompareTransferRequest, setRevisionCompareTransferSelection,
} from './revision-transfer-contracts.js';
import { reconcileRevisionCompareTransferCompletionAfterAuthorityChange } from './revision-transfer-completion-workspace-state.js';

function signOffAfterDraftChange(previous, next) {
  const prior = previous?.signOff ?? createRevisionCompareSignOffState();
  const signOff = prior.report ? staleRevisionCompareSignOffState(prior) : signOffStateForReadiness({ ...next, signOff: prior });
  const trustReceipt = reconcileRevisionCompareTrustReceiptState(previous?.trustReceipt, signOff);
  return deepFreeze({ ...next, signOff, trustReceipt });
}
function transferAfterDraftChange(state, selection) {
  const selected = setRevisionCompareTransferSelection(state.transfer, selection);
  return selected === state.transfer ? invalidateRevisionCompareTransferRequest(state.transfer, state.transfer.authority) : selected;
}
export function setWorkspaceTransferReviewDraft(state, transferReview, selection) {
  if (transferReview === state.transferReview) return state;
  const transfer = transferAfterDraftChange(state, selection);
  const next = signOffAfterDraftChange(state, deepFreeze({ ...state, transferReview, transfer }));
  return reconcileRevisionCompareTransferCompletionAfterAuthorityChange(state, next);
}
export function reconcileWorkspaceTransferReviewState(state, transferReview) {
  return transferReview === state.transferReview ? state : deepFreeze({ ...state, transferReview });
}
export function setWorkspaceTransferReviewPresentation(state, transferReview) {
  return transferReview === state.transferReview ? state : deepFreeze({ ...state, transferReview });
}
export const _test = Object.freeze({ signOffAfterDraftChange, transferAfterDraftChange });
