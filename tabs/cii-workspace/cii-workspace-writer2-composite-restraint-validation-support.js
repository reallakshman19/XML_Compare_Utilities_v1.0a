import { stableStringify } from './cii-workspace-contracts.js';
import { isCiiSha256Hex, sha256CiiByteString } from './cii-workspace-byte-sha256.js';
import { _test as legacyValidatorTest } from './cii-workspace-writer2-composite-hanger-validation.js';
import { _test as hangerPartialValidatorTest } from './cii-workspace-writer2-hanger-partial-validation.js';
import { _test as restraintValidatorTest } from './cii-workspace-writer2-restraint-delete-validation.js';

// Deliberately independent of the W2.12 Writer and its support module.
export const CII_WRITER_2_RESTRAINT_COMPOSITE_AUTHORITY = 'CII_WRITER_2_RESTRAINT_ONE_TARGET0_COMPOSITE';
export const CII_WRITER_2_RESTRAINT_COMPOSITE_FAMILY = 'WRITER_2_RESTRAINT_BLOCK_DELETE';
export const PARTIAL_HANGER_FAMILY = 'WRITER_2_HANGER_PARTIAL_DELETE';
export const DELETE_ALL_HANGER_FAMILY = 'WRITER_2_HANGER_DELETE_ALL';
export const TARGET0_HASH_AUTHORITY = 'SHA256_ORIGINAL_TARGET0_BYTES';
export const POSTIMAGE_HASH_AUTHORITY = 'SHA256_WRITER2_POSTIMAGE_BYTES';
export const POSTIMAGE_REPRESENTATION_AUTHORITY = 'CII_PHYSICAL_POSTIMAGE_REINTAKE_EQUIVALENCE';

const NODE_PROPERTY = 'Node name / to-name';
const SIF_PROPERTY = 'SIF/Tee record presence';
const HANGER_PROPERTY = 'Hanger presence';
const RESTRAINT_PROPERTY = 'Qualified restraint slot mutation';
const SCOPE_MODE = 'EXPLICIT_APPLY_EXCLUDE';
const SCOPE_AUTHORITY = 'USER_EXPLICIT_OPERATION_SCOPE';

export function text(value) { return String(value ?? '').trim(); }
export function operationId(operation) { return text(operation?.operationId); }
export function sorted(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}
export function exactIds(values, code) {
  if (!Array.isArray(values)) throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_${code}_ARRAY_REQUIRED`);
  const ids = values.map(text);
  if (ids.some((id) => !id)) throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_${code}_ID_REQUIRED`);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_${code}_DUPLICATE_ID`);
  }
  return Object.freeze(sorted(ids));
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
export function supportedApply(operation) {
  return isNodeMutation(operation) || isSifDelete(operation) || isHangerDelete(operation) || isRestraintDelete(operation);
}
export function appliedOperations(transferPlan) {
  return (transferPlan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY');
}

export function independentCanonicalSubscope(transferPlan, predicate, family, parentCustody) {
  const projectedApply = []; const siblingExcludes = []; const keeps = [];
  for (const operation of transferPlan?.operations || []) {
    if (operation?.scopeDecision === 'APPLY' && isMutable(operation)) {
      if (predicate(operation)) projectedApply.push(operation);
      else siblingExcludes.push(Object.freeze({ ...operation, scopeDecision: 'EXCLUDE' }));
    } else if (operation?.action === 'KEEP' && operation?.scopeDecision === 'KEEP') {
      keeps.push(operation);
    } else {
      throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_PROJECTED_OPERATION_CONTAINER_INVALID:${operationId(operation) || 'UNKNOWN'}`);
    }
  }
  const inheritedExcluded = [...(transferPlan?.excludedOperations || [])];
  for (const operation of inheritedExcluded) {
    if (!isMutable(operation) || operation?.scopeDecision !== 'EXCLUDE') {
      throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_PROJECTED_EXCLUDE_CONTAINER_INVALID:${operationId(operation) || 'UNKNOWN'}`);
    }
  }
  const projectedExcluded = [...inheritedExcluded, ...siblingExcludes];
  exactIds([...keeps, ...projectedApply, ...projectedExcluded].map(operationId), 'PROJECTED_OPERATION');
  const appliedIds = exactIds(projectedApply.map(operationId), 'PROJECTED_APPLY');
  const excludedIds = exactIds(projectedExcluded.map(operationId), 'PROJECTED_EXCLUDE');
  if (appliedIds.some((id) => excludedIds.includes(id))) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_PROJECTED_APPLY_EXCLUDE_OVERLAP');
  }
  const candidateIds = Object.freeze(sorted([...appliedIds, ...excludedIds]));
  const scopeId = `${parentCustody.parentScopeId}::${family}`;
  const sourceFields = parentCustody.sourceAuthorityKind === 'SOURCE_SET'
    ? { sourceAuthorityKind: 'SOURCE_SET', sourceSetSha256: parentCustody.sourceSetSha256, sourceSha256: '' }
    : { sourceAuthorityKind: 'DOCUMENT', sourceSha256: parentCustody.sourceSha256 };
  return Object.freeze({
    ...transferPlan,
    operations: Object.freeze([...keeps, ...projectedApply]),
    excludedOperations: Object.freeze(projectedExcluded),
    transferScope: Object.freeze({
      status: 'BOUND', mode: SCOPE_MODE, authority: SCOPE_AUTHORITY, scopeId,
      ...sourceFields, targetAuthorityKind: 'DOCUMENT', targetSha256: parentCustody.targetSha256,
      parentTargetAuthorityKind: parentCustody.targetAuthorityKind, parentTargetSha256: parentCustody.parentTargetSha256,
      candidateOperationIds: candidateIds, appliedOperationIds: appliedIds, excludedOperationIds: excludedIds,
    }),
    familyProjection: Object.freeze({
      schema: 'CIIWorkspaceWriter2FamilyProjection.v1', status: 'DERIVED_CANONICAL_BOUND_SUBSCOPE',
      authority: 'PARENT_TRANSFER_SCOPE_CANONICAL_SUBSCOPE', family,
      parentScopeId: parentCustody.parentScopeId, projectedScopeId: scopeId,
      parentAppliedOperationIds: parentCustody.appliedOperationIds,
      projectedAppliedOperationIds: appliedIds,
      siblingAppliedOperationIds: Object.freeze(sorted(siblingExcludes.map(operationId))),
    }),
  });
}

export function independentTarget0Custody(before) {
  const original = String(before?.physicalFile?.originalByteString ?? '');
  const declared = text(before?.contentSha256);
  if (before?.writer1CByteEligible !== true || before?.physicalFile?.writer1CByteEligible !== true) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_ORIGINAL_BYTE_AUTHORITY_REQUIRED');
  }
  if (!isCiiSha256Hex(declared)) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_TARGET0_SHA256_FORMAT_REQUIRED');
  }
  if (!original || Number(before?.physicalFile?.byteLength) !== original.length) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_TARGET0_BYTE_LENGTH_MISMATCH');
  }
  const actual = sha256CiiByteString(original);
  if (actual !== declared) throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_TARGET0_SHA256_MISMATCH');
  return Object.freeze({ authority: TARGET0_HASH_AUTHORITY, contentSha256: actual, byteLength: original.length });
}

export function restraintExpectedClaims(before, plan) {
  return [
    restraintValidatorTest.independentControlReplacement(before, plan),
    ...restraintValidatorTest.independentPointerReplacements(before, plan),
    restraintValidatorTest.independentRestraintReplacement(before, plan),
  ].filter((item) => item.beforeField !== item.afterField)
    .map((item) => ({ ...item, authorityFamily: CII_WRITER_2_RESTRAINT_COMPOSITE_FAMILY }));
}

export function hangerExpectedClaims(before, plan) {
  if (plan?.compaction?.deleteAll === true && Number(plan.countAfter) === 0) {
    return legacyValidatorTest.hangerExpectedClaims(before, plan);
  }
  const partial = plan?.compaction?.partialMultiRecordDelete === true
    && Number(plan.countBefore) > 1 && Number(plan.countAfter) > 0 && Number(plan.countAfter) < Number(plan.countBefore);
  if (!partial) throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_HANGER_SCOPE_UNQUALIFIED');
  const retained = hangerPartialValidatorTest.independentlyRetained(Number(plan.countBefore), plan.deletedRecordIndices);
  if (stableStringify(retained.retained) !== stableStringify(plan.retainedRecordIndices)
    || stableStringify(retained.oldToNew) !== stableStringify(plan.oldToNewRecordIndex)) {
    throw new Error('CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_HANGER_RECORD_MAP_MISMATCH');
  }
  const counts = hangerPartialValidatorTest.expectedCounts(before, retained.retained.length);
  return hangerPartialValidatorTest.expectedReplacements(before, plan, retained.retained, counts)
    .map((claim) => ({ ...claim, authorityFamily: PARTIAL_HANGER_FAMILY }));
}

export function expectedMutationTestimony(claims) {
  return claims.map((item) => ({
    authorityFamily: item.authorityFamily,
    kind: item.kind,
    byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd),
    beforeField: item.beforeField, afterField: item.afterField,
    ...(item.parsedElementIndex != null ? { parsedElementIndex: Number(item.parsedElementIndex) } : {}),
  }));
}
export function actualMutationTestimony(writerResult) {
  return (writerResult?.mutations || []).map((item) => ({
    authorityFamily: item.authorityFamily,
    kind: item.kind,
    byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd),
    beforeField: item.beforeField, afterField: item.afterField,
    ...(item.parsedElementIndex != null ? { parsedElementIndex: Number(item.parsedElementIndex) } : {}),
  }));
}
export function bytesFromByteString(value) {
  const input = String(value ?? ''); const out = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    if (code > 0xff) throw new Error(`CII_WRITER_2_COMPOSITE_RESTRAINT_VALIDATOR_NON_BYTE_CODE_UNIT:${index}:${code}`);
    out[index] = code;
  }
  return out;
}
export function sameBytes(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
}
export function representationCustody(physical) {
  return Object.freeze({
    authority: POSTIMAGE_REPRESENTATION_AUTHORITY,
    byteLength: Number(physical.byteLength), textLength: String(physical.text ?? '').length,
    textEncodingAuthority: physical.textEncodingAuthority, lineCount: (physical.lines || []).length,
    lineEndingStyle: physical.lineEndings?.style || null,
    finalLineTerminated: physical.lineEndings?.finalLineTerminated === true,
  });
}
