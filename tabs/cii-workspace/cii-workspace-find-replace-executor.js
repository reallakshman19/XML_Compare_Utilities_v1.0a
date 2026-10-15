import { sha256CiiByteString } from './cii-workspace-byte-sha256.js';
import { validateFindReplacePostimage } from './cii-workspace-find-replace-validator.js';

/*
 * CII v14 Find & Replace postimage executor.
 *
 * This module does not perform file I/O and is not an Apply authority. It is a
 * deterministic in-memory assembler used to qualify the validated claim set.
 * Every claim is re-checked against immutable TARGET0 before assembly, and the
 * resulting TARGET1 is independently checked by the postimage validator.
 */

function orderedClaims(preimageValidation) {
  return [...(preimageValidation?.claims || [])].sort((a, b) => a.start - b.start || a.end - b.end || a.operationIndex - b.operationIndex);
}

function validateClaimSet(target0, claims) {
  const blockers = [];
  let previousEnd = 0;
  claims.forEach((claim, index) => {
    const start = Number(claim?.start); const end = Number(claim?.end);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > target0.length) {
      blockers.push(`CLAIM_RANGE_INVALID:${index}`);
      return;
    }
    if (index > 0 && start < previousEnd) blockers.push(`CLAIM_OVERLAP:${index - 1}:${index}`);
    previousEnd = Math.max(previousEnd, end);
    const before = String(claim?.before ?? ''); const after = String(claim?.after ?? '');
    if (end - start !== before.length) blockers.push(`CLAIM_BEFORE_WIDTH_MISMATCH:${index}`);
    if (before.length !== after.length) blockers.push(`CLAIM_REPLACEMENT_WIDTH_MISMATCH:${index}`);
    if (target0.slice(start, end) !== before) blockers.push(`CLAIM_PREIMAGE_STALE:${index}:${start}`);
  });
  return [...new Set(blockers)];
}

export function buildValidatedFindReplacePostimage(target0Input, preimageValidation) {
  const target0 = String(target0Input ?? '');
  const blockers = [];
  if (preimageValidation?.status !== 'PASS') blockers.push('PREIMAGE_VALIDATION_NOT_PASS');
  if (!preimageValidation?.sourceHash) blockers.push('PREIMAGE_SOURCE_HASH_REQUIRED');
  if (preimageValidation?.sourceHash && sha256CiiByteString(target0) !== preimageValidation.sourceHash) blockers.push('TARGET0_HASH_MISMATCH');

  const claims = orderedClaims(preimageValidation);
  if (!claims.length) blockers.push('NO_VALIDATED_CLAIMS');
  blockers.push(...validateClaimSet(target0, claims));
  if (blockers.length) {
    return Object.freeze({
      status: 'BLOCKED',
      target1: null,
      blockers: Object.freeze([...new Set(blockers)]),
      audit: null,
    });
  }

  const parts = [];
  let cursor = 0;
  for (const claim of claims) {
    parts.push(target0.slice(cursor, claim.start));
    parts.push(claim.after);
    cursor = claim.end;
  }
  parts.push(target0.slice(cursor));
  const target1 = parts.join('');
  const postimageValidation = validateFindReplacePostimage(target0, target1, preimageValidation);
  if (postimageValidation.status !== 'PASS') {
    return Object.freeze({
      status: 'BLOCKED',
      target1: null,
      blockers: Object.freeze(['INDEPENDENT_POSTIMAGE_VALIDATION_FAILED', ...(postimageValidation.blockers || [])]),
      audit: Object.freeze({ postimageValidation }),
    });
  }

  const audit = Object.freeze({
    schema: 'CIIWorkspaceFindReplacePostimageAudit.v1',
    sourceHash: preimageValidation.sourceHash,
    targetHash: sha256CiiByteString(target1),
    sourceLength: target0.length,
    targetLength: target1.length,
    claimCount: claims.length,
    claims: Object.freeze(claims.map((claim) => Object.freeze({
      operationIndex: claim.operationIndex,
      start: claim.start,
      end: claim.end,
      scope: claim.scope || null,
      block: claim.block || null,
      authority: claim.authority || null,
      before: claim.before,
      after: claim.after,
    }))),
    postimageValidation,
  });

  return Object.freeze({
    status: 'QUALIFIED_POSTIMAGE',
    target1,
    blockers: Object.freeze([]),
    audit,
  });
}

export const _test = Object.freeze({ orderedClaims, validateClaimSet });
