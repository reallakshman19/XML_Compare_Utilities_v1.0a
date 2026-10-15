import { deepFreeze } from './cii-workspace-contracts.js';
import { isCiiSha256Hex, sha256CiiByteString } from './cii-workspace-byte-sha256.js';

const NODE_PROPERTY = 'Node name / to-name';
const SIF_PROPERTY = 'SIF/Tee record presence';
const HANGER_PROPERTY = 'Hanger presence';
const RESTRAINT_PROPERTY = 'Qualified restraint slot mutation';
const SCOPE_MODE = 'EXPLICIT_APPLY_EXCLUDE';
const SCOPE_AUTHORITY = 'USER_EXPLICIT_OPERATION_SCOPE';
export const TARGET0_HASH_AUTHORITY = 'SHA256_ORIGINAL_TARGET0_BYTES';
export const POSTIMAGE_HASH_AUTHORITY = 'SHA256_WRITER2_POSTIMAGE_BYTES';
export const POSTIMAGE_REPRESENTATION_AUTHORITY = 'CII_PHYSICAL_POSTIMAGE_REINTAKE_EQUIVALENCE';

export function text(value) { return String(value ?? '').trim(); }
export function operationId(operation) { return text(operation?.operationId); }
export function sorted(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}
export function exactIds(values, code) {
  if (!Array.isArray(values)) throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_${code}_ARRAY_REQUIRED`);
  const ids = values.map(text);
  if (ids.some((id) => !id)) throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_${code}_ID_REQUIRED`);
  if (new Set(ids).size !== ids.length) throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_${code}_DUPLICATE_ID`);
  return Object.freeze(sorted(ids));
}
export function sameStrings(left, right) {
  const a = sorted(left || []); const b = sorted(right || []);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function isMutable(operation) { return operation?.action !== 'KEEP'; }
export function isNodeMutation(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'NODE_NAME'
    && operation?.property === NODE_PROPERTY && ['CREATE', 'DELETE'].includes(operation?.action);
}
export function isSifDelete(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'SIF_TEE'
    && operation?.property === SIF_PROPERTY && operation?.action === 'DELETE';
}
export function isSifCreate(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'SIF_TEE'
    && operation?.property === SIF_PROPERTY && operation?.action === 'CREATE';
}
export function isHangerDelete(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'HANGER'
    && operation?.property === HANGER_PROPERTY && operation?.action === 'DELETE';
}
export function isHangerCreate(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'HANGER'
    && operation?.property === HANGER_PROPERTY && operation?.action === 'CREATE';
}
export function isRestraintDelete(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'RESTRAINT'
    && operation?.property === RESTRAINT_PROPERTY && operation?.action === 'DELETE';
}
export function isRestraintCreate(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'RESTRAINT'
    && operation?.property === RESTRAINT_PROPERTY && operation?.action === 'CREATE';
}
export function isExistingCompositeMutation(operation) {
  return isNodeMutation(operation) || isSifDelete(operation) || isHangerDelete(operation);
}
export function supportedApply(operation) {
  return isExistingCompositeMutation(operation) || isRestraintDelete(operation);
}
export function appliedOperations(transferPlan) {
  return (transferPlan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY');
}

export function target0Custody(targetDocument) {
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  const declared = text(targetDocument?.contentSha256);
  if (targetDocument?.writer1CByteEligible !== true || targetDocument?.physicalFile?.writer1CByteEligible !== true) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_ORIGINAL_BYTE_AUTHORITY_REQUIRED');
  }
  if (!isCiiSha256Hex(declared)) throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_TARGET0_SHA256_FORMAT_REQUIRED');
  if (!original || Number(targetDocument?.physicalFile?.byteLength) !== original.length) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_TARGET0_BYTE_LENGTH_MISMATCH');
  }
  if (targetDocument?.byteLength != null && Number(targetDocument.byteLength) !== original.length) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_TARGET0_DOCUMENT_BYTE_LENGTH_MISMATCH');
  }
  const actual = sha256CiiByteString(original);
  if (actual !== declared) throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_TARGET0_SHA256_MISMATCH');
  return deepFreeze({ authority: TARGET0_HASH_AUTHORITY, contentSha256: actual, byteLength: original.length });
}

export function assertBoundScopeCustody(transferPlan, targetDocument) {
  const scope = transferPlan?.transferScope;
  if (scope?.status !== 'BOUND' || scope?.mode !== SCOPE_MODE || scope?.authority !== SCOPE_AUTHORITY || !text(scope?.scopeId)) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_CANONICAL_BOUND_SCOPE_REQUIRED');
  }
  if (!Array.isArray(transferPlan?.operations) || !Array.isArray(transferPlan?.excludedOperations)) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_OPERATION_CONTAINERS_REQUIRED');
  }
  const all = [...transferPlan.operations, ...transferPlan.excludedOperations];
  const allIds = exactIds(all.map(operationId), 'PLAN_OPERATION');
  const appliedRows = transferPlan.operations.filter((item) => item?.scopeDecision === 'APPLY' && isMutable(item));
  const excludedRows = transferPlan.excludedOperations.filter((item) => item?.scopeDecision === 'EXCLUDE' && isMutable(item));
  const appliedIds = exactIds(appliedRows.map(operationId), 'PLAN_APPLY');
  const excludedIds = exactIds(excludedRows.map(operationId), 'PLAN_EXCLUDE');
  if (appliedIds.some((id) => excludedIds.includes(id))) throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_PLAN_APPLY_EXCLUDE_OVERLAP');
  const candidateIds = Object.freeze(sorted([...appliedIds, ...excludedIds]));
  if (!sameStrings(appliedIds, exactIds(scope.appliedOperationIds, 'SCOPE_APPLY'))) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_SCOPE_APPLY_SET_MISMATCH');
  }
  if (!sameStrings(excludedIds, exactIds(scope.excludedOperationIds, 'SCOPE_EXCLUDE'))) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_SCOPE_EXCLUDE_SET_MISMATCH');
  }
  if (!sameStrings(candidateIds, exactIds(scope.candidateOperationIds, 'SCOPE_CANDIDATE'))) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_SCOPE_CANDIDATE_SET_MISMATCH');
  }
  if (allIds.length !== all.length) throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_PLAN_OPERATION_CARDINALITY_MISMATCH');
  const sourceAuthorityKind = text(scope?.sourceAuthorityKind || transferPlan?.sourceAuthorityKind || 'DOCUMENT').toUpperCase();
  let sourceSha256 = ''; let sourceSetSha256 = '';
  if (sourceAuthorityKind === 'SOURCE_SET') {
    sourceSetSha256 = text(transferPlan?.sourceSetSha256 || transferPlan?.sourceAuthority?.sourceSetSha256);
    if (!sourceSetSha256 || sourceSetSha256 !== text(scope?.sourceSetSha256)) {
      throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_SCOPE_SOURCE_SET_HASH_MISMATCH');
    }
  } else {
    sourceSha256 = text(transferPlan?.sourceDocument?.contentSha256);
    if (!isCiiSha256Hex(sourceSha256) || sourceSha256 !== text(scope?.sourceSha256)) {
      throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_SCOPE_SOURCE_HASH_MISMATCH');
    }
  }

  const normalizedTargetSha256 = text(targetDocument?.contentSha256);
  if (!normalizedTargetSha256 || (text(transferPlan?.targetDocument?.contentSha256)
    && text(transferPlan?.targetDocument?.contentSha256) !== normalizedTargetSha256)) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_NORMALIZED_TARGET_HASH_MISMATCH');
  }
  const targetAuthorityKind = text(scope?.targetAuthorityKind || transferPlan?.targetAuthorityKind || 'DOCUMENT').toUpperCase();
  let originalTargetSha256 = '';
  if (targetAuthorityKind === 'ORIGINAL_TARGET') {
    originalTargetSha256 = text(transferPlan?.targetAuthority?.originalSha256);
    if (!originalTargetSha256 || originalTargetSha256 !== text(scope?.targetSha256)) {
      throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_SCOPE_ORIGINAL_TARGET_HASH_MISMATCH');
    }
  } else if (text(scope?.targetSha256) !== normalizedTargetSha256) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_SCOPE_TARGET_HASH_MISMATCH');
  }
  return deepFreeze({
    parentScopeId: text(scope.scopeId), sourceAuthorityKind, sourceSha256, sourceSetSha256,
    targetAuthorityKind, targetSha256: normalizedTargetSha256, originalTargetSha256,
    parentTargetSha256: text(scope?.targetSha256),
    candidateOperationIds: candidateIds, appliedOperationIds: appliedIds, excludedOperationIds: excludedIds,
  });
}

export function projectCanonicalSubscope(transferPlan, predicate, family, parentCustody) {
  const projectedApply = []; const siblingExcludes = []; const keeps = [];
  for (const operation of transferPlan?.operations || []) {
    if (operation?.scopeDecision === 'APPLY' && isMutable(operation)) {
      if (predicate(operation)) projectedApply.push(operation);
      else siblingExcludes.push(deepFreeze({ ...operation, scopeDecision: 'EXCLUDE' }));
    } else if (operation?.action === 'KEEP' && operation?.scopeDecision === 'KEEP') {
      keeps.push(operation);
    } else {
      throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_PROJECTED_OPERATION_CONTAINER_INVALID:${operationId(operation) || 'UNKNOWN'}`);
    }
  }
  const inheritedExcluded = [...(transferPlan?.excludedOperations || [])];
  for (const operation of inheritedExcluded) {
    if (!isMutable(operation) || operation?.scopeDecision !== 'EXCLUDE') {
      throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_PROJECTED_EXCLUDE_CONTAINER_INVALID:${operationId(operation) || 'UNKNOWN'}`);
    }
  }
  const projectedExcluded = [...inheritedExcluded, ...siblingExcludes];
  exactIds([...keeps, ...projectedApply, ...projectedExcluded].map(operationId), 'PROJECTED_OPERATION');
  const appliedIds = exactIds(projectedApply.map(operationId), 'PROJECTED_APPLY');
  const excludedIds = exactIds(projectedExcluded.map(operationId), 'PROJECTED_EXCLUDE');
  if (appliedIds.some((id) => excludedIds.includes(id))) throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_PROJECTED_APPLY_EXCLUDE_OVERLAP');
  const candidateIds = Object.freeze(sorted([...appliedIds, ...excludedIds]));
  const childScopeId = `${parentCustody.parentScopeId}::${family}`;
  return deepFreeze({
    ...transferPlan,
    operations: deepFreeze([...keeps, ...projectedApply]),
    excludedOperations: deepFreeze(projectedExcluded),
    transferScope: deepFreeze({
      status: 'BOUND', mode: SCOPE_MODE, authority: SCOPE_AUTHORITY, scopeId: childScopeId,
      ...(parentCustody.sourceAuthorityKind === 'SOURCE_SET'
        ? { sourceAuthorityKind: 'SOURCE_SET', sourceSetSha256: parentCustody.sourceSetSha256, sourceSha256: '' }
        : { sourceAuthorityKind: 'DOCUMENT', sourceSha256: parentCustody.sourceSha256 }),
      targetAuthorityKind: 'DOCUMENT', targetSha256: parentCustody.targetSha256,
      parentTargetAuthorityKind: parentCustody.targetAuthorityKind, parentTargetSha256: parentCustody.parentTargetSha256,
      candidateOperationIds: candidateIds, appliedOperationIds: appliedIds, excludedOperationIds: excludedIds,
    }),
    familyProjection: deepFreeze({
      schema: 'CIIWorkspaceWriter2FamilyProjection.v1', status: 'DERIVED_CANONICAL_BOUND_SUBSCOPE',
      authority: 'PARENT_TRANSFER_SCOPE_CANONICAL_SUBSCOPE', family,
      parentScopeId: parentCustody.parentScopeId, projectedScopeId: childScopeId,
      parentAppliedOperationIds: parentCustody.appliedOperationIds,
      projectedAppliedOperationIds: appliedIds,
      siblingAppliedOperationIds: deepFreeze(sorted(siblingExcludes.map(operationId))),
    }),
  });
}

export function normalizeClaim(claim, authorityFamily, original) {
  const byteStart = Number(claim?.byteStart); const byteEnd = Number(claim?.byteEnd);
  if (!Number.isSafeInteger(byteStart) || !Number.isSafeInteger(byteEnd)
    || byteStart < 0 || byteEnd < byteStart || byteEnd > original.length) {
    throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_CLAIM_SPAN_INVALID:${authorityFamily}:${claim?.kind || 'UNKNOWN'}`);
  }
  const beforeField = String(claim?.beforeField ?? ''); const afterField = String(claim?.afterField ?? '');
  if (original.slice(byteStart, byteEnd) !== beforeField) {
    throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_CLAIM_PREIMAGE_MISMATCH:${authorityFamily}:${claim?.kind || 'UNKNOWN'}:${byteStart}`);
  }
  return deepFreeze({ ...claim, authorityFamily, byteStart, byteEnd, beforeField, afterField });
}

export function arbitrateClaims(claims, original) {
  const rows = claims.map((item) => normalizeClaim(item.claim, item.authorityFamily, original))
    .filter((item) => item.beforeField !== item.afterField)
    .sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd || a.authorityFamily.localeCompare(b.authorityFamily));
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index].byteStart < rows[index - 1].byteEnd) {
      throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_ORIGINAL_SPAN_OVERLAP:${rows[index - 1].authorityFamily}:${rows[index - 1].kind}:${rows[index].authorityFamily}:${rows[index].kind}`);
    }
  }
  return deepFreeze(rows);
}

export function applyClaims(original, claims) {
  let cursor = 0; let output = '';
  for (const claim of claims) {
    if (original.slice(claim.byteStart, claim.byteEnd) !== claim.beforeField) {
      throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_STALE_PREIMAGE:${claim.authorityFamily}:${claim.kind}:${claim.byteStart}`);
    }
    output += original.slice(cursor, claim.byteStart) + claim.afterField;
    cursor = claim.byteEnd;
  }
  return output + original.slice(cursor);
}

export function byteStringToBytes(value) {
  const input = String(value ?? ''); const out = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    if (code > 0xff) throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_NON_BYTE_CODE_UNIT:${index}:${code}`);
    out[index] = code;
  }
  return out;
}

export function representationCustody(physicalFile) {
  return deepFreeze({
    authority: POSTIMAGE_REPRESENTATION_AUTHORITY,
    byteLength: Number(physicalFile.byteLength), textLength: String(physicalFile.text ?? '').length,
    textEncodingAuthority: physicalFile.textEncodingAuthority, lineCount: (physicalFile.lines || []).length,
    lineEndingStyle: physicalFile.lineEndings?.style || null,
    finalLineTerminated: physicalFile.lineEndings?.finalLineTerminated === true,
  });
}
