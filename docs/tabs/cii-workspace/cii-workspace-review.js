import { CII_WORKSPACE_SCHEMAS, deepFreeze, stableStringify } from './cii-workspace-contracts.js';

function sorted(values) { return Object.freeze([...(values || [])].map(String).sort()); }
function anchorIdentity(anchors) {
  return stableStringify((anchors || []).map((pair) => ({ sourceNodeId: String(pair.sourceNodeId), targetNodeId: String(pair.targetNodeId), locked: true })));
}
function hasDecisions(review) {
  return Boolean(review?.reviewedCorrespondenceIds?.length || review?.rejectedCorrespondenceIds?.length || review?.lockedCorrespondenceIds?.length);
}

export function createCiiWorkspaceReviewLedger(sourceDocument, targetDocument, anchors, correspondence, decisions = {}) {
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.reviewLedger,
    sourceContentSha256: sourceDocument?.contentSha256 || '',
    targetContentSha256: targetDocument?.contentSha256 || '',
    anchorIdentity: anchorIdentity(anchors),
    correspondenceIdentity: correspondence?.correspondenceIdentity || '',
    reviewedCorrespondenceIds: sorted(decisions.reviewedCorrespondenceIds),
    lockedCorrespondenceIds: sorted(decisions.lockedCorrespondenceIds),
    rejectedCorrespondenceIds: sorted(decisions.rejectedCorrespondenceIds),
  });
}

export function normalizeCiiWorkspaceReview(review, sourceDocument, targetDocument, anchors, correspondence) {
  if (!review?.schema && !hasDecisions(review)) return createCiiWorkspaceReviewLedger(sourceDocument, targetDocument, anchors, correspondence);
  if (review?.schema !== CII_WORKSPACE_SCHEMAS.reviewLedger) {
    return deepFreeze({
      schema: 'CIIWorkspaceReviewLedger.UNBOUND',
      reviewedCorrespondenceIds: sorted(review?.reviewedCorrespondenceIds),
      lockedCorrespondenceIds: sorted(review?.lockedCorrespondenceIds),
      rejectedCorrespondenceIds: sorted(review?.rejectedCorrespondenceIds),
    });
  }
  return deepFreeze({
    ...review,
    reviewedCorrespondenceIds: sorted(review.reviewedCorrespondenceIds),
    lockedCorrespondenceIds: sorted(review.lockedCorrespondenceIds),
    rejectedCorrespondenceIds: sorted(review.rejectedCorrespondenceIds),
  });
}

export function ciiReviewLedgerBlockers(review, sourceDocument, targetDocument, correspondence) {
  const blockers = [];
  if (review?.schema !== CII_WORKSPACE_SCHEMAS.reviewLedger) return Object.freeze(['REVIEW_LEDGER_AUTHORITY_REQUIRED']);
  if (review.sourceContentSha256 !== sourceDocument?.contentSha256) blockers.push('STALE_REVIEW_SOURCE_IDENTITY');
  if (review.targetContentSha256 !== targetDocument?.contentSha256) blockers.push('STALE_REVIEW_TARGET_IDENTITY');
  if (review.correspondenceIdentity !== correspondence?.correspondenceIdentity) blockers.push('STALE_REVIEW_CORRESPONDENCE_IDENTITY');
  return Object.freeze(blockers);
}

export function updateCiiReviewDecisions(review, decisions = {}) {
  if (review?.schema !== CII_WORKSPACE_SCHEMAS.reviewLedger) throw new Error('CII_REVIEW_LEDGER_REQUIRED');
  return deepFreeze({
    ...review,
    reviewedCorrespondenceIds: sorted(decisions.reviewedCorrespondenceIds),
    lockedCorrespondenceIds: sorted(decisions.lockedCorrespondenceIds),
    rejectedCorrespondenceIds: sorted(decisions.rejectedCorrespondenceIds),
  });
}
