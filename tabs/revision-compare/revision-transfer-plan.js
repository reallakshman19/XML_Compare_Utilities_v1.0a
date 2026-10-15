/** Deterministic eligibility evaluation and immutable Revision Compare transfer planning. */
import { assertJsonSafe, deepFreeze, stableStringify } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';
import { revisionCompareJsonSnapshotMatchesDocument } from './revision-json-document.js';
import { createRevisionCompareTransferOperation } from './revision-transfer-operation.js';
import {
  REVISION_COMPARE_TRANSFER_DIRECTION,
  REVISION_COMPARE_TRANSFER_POLICY,
} from './revision-transfer-policy.js';
import {
  captureRevisionCompareTransferAuthority,
  REVISION_COMPARE_TRANSFER_PLAN_ID_PREFIX,
  REVISION_COMPARE_TRANSFER_PLAN_SCHEMA,
  REVISION_COMPARE_TRANSFER_SELECTION_SCHEMA,
} from './revision-transfer-contracts.js';

const ACTIVE_COMPARE = Object.freeze(['PROJECTING', 'COMPARING', 'BUILDING_VISUAL']);
function frozen(values) { return Object.freeze(values); }
function canonical(value) { return JSON.parse(stableStringify(value)); }
function unique(values, label, blockers) {
  if (!values.length) blockers.push(`${label} resolves to zero records.`);
  if (values.length > 1) blockers.push(`${label} resolves to multiple records.`);
  return values.length === 1 ? values[0] : null;
}
function snapshotFor(state, slotId) { return state?.slots?.[slotId]?.jsonSnapshot ?? null; }
function reviewMatchesAudit(review, audit) {
  return Boolean(review && audit && review.auditId === audit.auditId
    && review.basisId === audit.basisId && review.revADocumentId === audit.revADocumentId
    && review.revBDocumentId === audit.revBDocumentId);
}
function decisionMatchesAudit(decision, audit) {
  return Boolean(decision && audit && decision.auditId === audit.auditId
    && decision.basisId === audit.basisId && decision.revADocumentId === audit.revADocumentId
    && decision.revBDocumentId === audit.revBDocumentId);
}
function snapshotBlockers(state, basis, blockers) {
  const revA = snapshotFor(state, 'baseline');
  const revB = snapshotFor(state, 'candidate');
  if (!revisionCompareJsonSnapshotMatchesDocument(revA, state?.slots?.baseline?.document)) {
    blockers.push('Rev A lossless snapshot does not match the current source document.');
  }
  if (!revisionCompareJsonSnapshotMatchesDocument(revB, state?.slots?.candidate?.document)) {
    blockers.push('Rev B lossless snapshot does not match the current receiver document.');
  }
  if (basis && revA && (basis.revADocumentId !== revA.sourceDocumentId
      || basis.revAContentHash !== revA.sourceContentSha256)) {
    blockers.push('Rev A snapshot identity or SHA-256 does not match the comparison basis.');
  }
  if (basis && revB && (basis.revBDocumentId !== revB.sourceDocumentId
      || basis.revBContentHash !== revB.sourceContentSha256)) {
    blockers.push('Rev B snapshot identity or SHA-256 does not match the comparison basis.');
  }
}
function authorityBlockers(state, selection, policy, requestActive) {
  const blockers = [];
  const basis = state?.basis;
  const audit = state?.compare?.audit;
  const review = state?.review?.session;
  const decision = state?.decision?.ledger;
  if (selection?.schema !== REVISION_COMPARE_TRANSFER_SELECTION_SCHEMA
      || selection.direction !== REVISION_COMPARE_TRANSFER_DIRECTION) {
    blockers.push('A valid explicit REV_A_TO_REV_B transfer selection is required.');
  }
  snapshotBlockers(state, basis, blockers);
  if (state?.basisStatus !== 'CURRENT' || !basis) {
    blockers.push('Transfer planning requires a CURRENT comparison basis.');
  }
  if (!audit || audit.validation?.status !== 'READY' || audit.basisId !== basis?.basisId) {
    blockers.push('Transfer planning requires a READY audit matching the current basis.');
  }
  if (!review || review.status !== 'CURRENT' || review.validation?.status !== 'READY'
      || !reviewMatchesAudit(review, audit)) {
    blockers.push('Transfer planning requires a CURRENT review session matching the audit.');
  }
  if (!decision || decision.status !== 'CURRENT' || decision.validation?.status !== 'READY'
      || !decisionMatchesAudit(decision, audit)) {
    blockers.push('Transfer planning requires a CURRENT ambiguity-decision ledger matching the audit.');
  }
  if (state?.slots?.baseline?.status === 'LOADING'
      || state?.slots?.candidate?.status === 'LOADING') {
    blockers.push('Transfer planning is blocked while source loading is active.');
  }
  if (ACTIVE_COMPARE.includes(state?.compare?.status)) {
    blockers.push('Transfer planning is blocked while comparison is active.');
  }
  if (requestActive) blockers.push('Transfer planning is blocked while another transfer-plan request is active.');
  if (policy?.policyVersion !== state?.transfer?.policyVersion && state?.transfer?.policyVersion) {
    blockers.push('Transfer policy version does not match the workspace policy authority.');
  }
  return blockers;
}
function reviewItemFor(review, differenceId, blockers) {
  const item = unique((review?.items ?? []).filter((entry) => entry.differenceId === differenceId),
    `Review item ${differenceId}`, blockers);
  if (item && item.reviewState !== 'REVIEWED') {
    blockers.push(`Review item ${differenceId} is ${item.reviewState}; only REVIEWED items are transferable.`);
  }
  return item;
}
function resolvedTarget(row, item, audit, ledger, blockers) {
  if (row?.targetRecordId) {
    if (row.targetRecordId !== item.targetRecordId) {
      blockers.push('Selected target record does not match the audited source-target pair.');
    }
    return { targetRecordId: row.targetRecordId, targetDifferenceId: row.differenceId, decision: null };
  }
  if (row?.matchCertainty !== 'AMBIGUOUS') {
    blockers.push('Selected source has no audited target relationship.');
    return null;
  }
  const decision = unique((ledger?.decisions ?? []).filter((entry) => entry.differenceId === row.differenceId),
    `Decision ${row.differenceId}`, blockers);
  if (!decision) return null;
  if (['UNDECIDED', 'DEFERRED', 'REVOKED'].includes(decision.decisionState)) {
    blockers.push(`Ambiguity decision ${row.differenceId} is ${decision.decisionState}.`);
  }
  if (decision.decisionState === 'CONFIRMED_NO_MATCH') {
    blockers.push(`Ambiguity decision ${row.differenceId} confirms no target match.`);
  }
  if (decision.decisionState !== 'ACCEPTED_CANDIDATE') return null;
  if (decision.acceptedTargetRecordId !== item.targetRecordId) {
    blockers.push('Selected target does not match the accepted ambiguity decision.');
  }
  const targetRow = unique((audit?.differenceRows ?? []).filter((entry) =>
    entry.differenceId === decision.acceptedTargetDifferenceId
      && entry.targetRecordId === decision.acceptedTargetRecordId),
  `Accepted target row ${decision.acceptedTargetDifferenceId}`, blockers);
  return targetRow ? {
    targetRecordId: decision.acceptedTargetRecordId,
    targetDifferenceId: targetRow.differenceId,
    decision,
  } : null;
}
async function selectedOperations(state, selection, policy, cryptoRef) {
  const operations = [];
  const blockers = [];
  const audit = state.compare.audit;
  const review = state.review.session;
  const decision = state.decision.ledger;
  const revA = snapshotFor(state, 'baseline');
  const revB = snapshotFor(state, 'candidate');
  for (const item of selection.items) {
    const itemBlockers = [];
    const row = unique(audit.differenceRows.filter((entry) => entry.differenceId === item.differenceId),
      `Audit row ${item.differenceId}`, itemBlockers);
    if (row && row.sourceRecordId !== item.sourceRecordId) {
      itemBlockers.push('Selected source record does not match the audit row.');
    }
    reviewItemFor(review, item.differenceId, itemBlockers);
    const target = row ? resolvedTarget(row, item, audit, decision, itemBlockers) : null;
    if (target?.targetDifferenceId !== item.differenceId) {
      reviewItemFor(review, target?.targetDifferenceId, itemBlockers);
    }
    if (row && target) {
      for (const field of item.fields) {
        const result = await createRevisionCompareTransferOperation({
          audit, review, decision, revA, revB, item, row, target, field, policy,
        }, cryptoRef);
        if (result.operation) operations.push(result.operation);
        itemBlockers.push(...result.blockers);
      }
    }
    blockers.push(...itemBlockers.map((message) => `${item.differenceId}: ${message}`));
  }
  return { operations, blockers };
}
function documentIdentity(snapshot) {
  return {
    schema: snapshot.schema, side: snapshot.side,
    documentId: snapshot.sourceDocumentId, contentSha256: snapshot.sourceContentSha256,
    fileName: snapshot.fileName, rootKind: snapshot.rootKind, profile: snapshot.profile,
  };
}
function blockedOperations(operations, blockers) {
  if (!blockers.length) return operations;
  return operations.map((operation) => deepFreeze({
    ...operation,
    status: 'BLOCKED',
    blockers: frozen([...new Set([
      ...operation.blockers, 'The transfer plan contains blocking eligibility errors.',
    ])]),
  }));
}
function planSummary(selection, operations) {
  return {
    selectedItemCount: selection?.items?.length ?? 0,
    operationCount: operations.length,
    readyOperationCount: operations.filter((item) => item.status === 'READY').length,
    blockedOperationCount: operations.filter((item) => item.status === 'BLOCKED').length,
    replaceExistingCount: operations.filter((item) =>
      item.operationType === 'REPLACE_EXISTING_PROPERTY').length,
    addMissingCount: operations.filter((item) =>
      item.operationType === 'ADD_MISSING_PROPERTY').length,
  };
}
export async function createRevisionCompareTransferPlan(state, selection, options = {}) {
  const policy = options.policy ?? REVISION_COMPARE_TRANSFER_POLICY;
  const cryptoRef = options.cryptoRef ?? globalThis.crypto;
  const blockers = authorityBlockers(state, selection, policy, Boolean(options.requestActive));
  let operations = [];
  if (!blockers.length) {
    const selected = await selectedOperations(state, selection, policy, cryptoRef);
    operations = selected.operations;
    blockers.push(...selected.blockers);
  }
  if (!operations.length) blockers.push('Transfer plan contains no eligible field operation.');
  operations = blockedOperations(operations, blockers);
  const authority = captureRevisionCompareTransferAuthority(state);
  const revA = snapshotFor(state, 'baseline');
  const revB = snapshotFor(state, 'candidate');
  const material = canonical({
    schema: REVISION_COMPARE_TRANSFER_PLAN_SCHEMA,
    direction: REVISION_COMPARE_TRANSFER_DIRECTION,
    sourceDocument: revA ? documentIdentity(revA) : null,
    receiverDocument: revB ? documentIdentity(revB) : null,
    scope: authority.scope,
    comparisonBasis: authority.comparisonBasis,
    audit: authority.audit,
    reviewSession: authority.reviewSession,
    decisionLedger: authority.decisionLedger,
    activity: authority.activity,
    selection,
    policyVersion: policy.policyVersion,
    operations,
    summary: planSummary(selection, operations),
    status: blockers.length ? 'BLOCKED' : 'READY',
    blockers: frozen([...new Set(blockers)]),
  });
  const contentSha256 = await sha256Text(JSON.stringify(material), cryptoRef);
  const plan = deepFreeze({
    ...material,
    planId: `${REVISION_COMPARE_TRANSFER_PLAN_ID_PREFIX}${contentSha256}`,
    contentSha256,
  });
  assertJsonSafe(plan, REVISION_COMPARE_TRANSFER_PLAN_SCHEMA);
  return plan;
}
export const _test = Object.freeze({ authorityBlockers, resolvedTarget });
