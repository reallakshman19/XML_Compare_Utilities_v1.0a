/*
 * CII v14 Find & Replace transaction boundary.
 *
 * This module remains deliberately non-authoritative for mutation. It records
 * reviewed proposals and reports readiness, but canApply stays false until a
 * separately qualified mutation/validation implementation is introduced.
 */

const VALID_STATUSES = new Set(['PROPOSED', 'APPROVED', 'REJECTED', 'BLOCKED']);

function copyOperation(operation) {
  const status = String(operation?.status || 'PROPOSED').toUpperCase();
  return Object.freeze({
    source: operation?.source || 'UNKNOWN',
    scope: operation?.scope ?? 'UNKNOWN',
    entity: operation?.entity ?? null,
    id: operation?.id ?? null,
    from: operation?.from ?? null,
    to: operation?.to ?? null,
    block: operation?.block ?? null,
    field: operation?.field ?? null,
    before: operation?.before ?? null,
    after: operation?.after ?? null,
    findText: operation?.findText ?? null,
    replaceText: operation?.replaceText ?? null,
    authority: operation?.authority ?? null,
    evidenceStatus: operation?.evidenceStatus ?? null,
    correspondenceId: operation?.correspondenceId ?? null,
    status: VALID_STATUSES.has(status) ? status : 'BLOCKED',
    blockers: Object.freeze([...(operation?.blockers || (VALID_STATUSES.has(status) ? [] : ['INVALID_OPERATION_STATUS']))]),
  });
}

export function createFindReplaceTransaction(input = {}) {
  return Object.freeze({
    version: 'v14',
    sourceHash: input?.sourceHash ?? null,
    sourceFile: input?.sourceFile ?? null,
    createdFrom: input?.createdFrom ?? 'PREVIEW',
    operations: Object.freeze(Array.isArray(input?.operations) ? input.operations.map(copyOperation) : []),
  });
}

export function validateMutationBoundary(transaction) {
  const operations = transaction?.operations || [];
  const approved = operations.filter((operation) => operation.status === 'APPROVED').length;
  const proposed = operations.filter((operation) => operation.status === 'PROPOSED').length;
  const blocked = operations.filter((operation) => operation.status === 'BLOCKED').length;
  const blockers = [];

  if (!transaction?.sourceHash) blockers.push('SOURCE_HASH_REQUIRED');
  if (approved === 0) blockers.push('AT_LEAST_ONE_APPROVED_OPERATION_REQUIRED');
  if (proposed > 0) blockers.push('PROPOSED_OPERATIONS_REQUIRE_REVIEW');
  if (blocked > 0) blockers.push('BLOCKED_OPERATIONS_PRESENT');

  const readyForMutationImplementation = blockers.length === 0;
  return Object.freeze({
    canApply: false,
    readyForMutationImplementation,
    reason: readyForMutationImplementation
      ? 'Mutation implementation is intentionally not enabled in this phase'
      : 'Preview/validation requirements are not satisfied',
    blockers: Object.freeze(blockers),
    summary: Object.freeze({
      total: operations.length,
      approved,
      proposed,
      rejected: operations.filter((operation) => operation.status === 'REJECTED').length,
      blocked,
    }),
    transaction,
  });
}
