import { stableStringify } from './cii-workspace-contracts.js';
import { ciiPhysicalSectionRows, createCiiPhysicalFile } from './cii-workspace-physical-file.js';
import { buildCiiWriter2NodeNameRelocationPlan } from './cii-workspace-writer2-nodename-relocation.js';
import { buildCiiWriter2SifDeleteRelocationPlan, CII_WRITER_2_SIF_CREATE_BLOCKER } from './cii-workspace-writer2-sif-delete.js';
import { buildCiiWriter2HangerDeletePlan, CII_WRITER_2_HANGER_CREATE_BLOCKER } from './cii-workspace-writer2-hanger-delete.js';
import { CII_HANGER_LAYOUTS } from './cii-workspace-hanger.js';
import { sha256CiiByteString } from './cii-workspace-byte-sha256.js';
import { _test as legacyValidatorTest } from './cii-workspace-writer2-composite-hanger-validation.js';
import { _test as partialValidatorTest } from './cii-workspace-writer2-hanger-partial-validation.js';

const NODE_PROPERTY = 'Node name / to-name';
const SIF_PROPERTY = 'SIF/Tee record presence';
const HANGER_PROPERTY = 'Hanger presence';
const SCOPE_MODE = 'EXPLICIT_APPLY_EXCLUDE';
const SCOPE_AUTHORITY = 'USER_EXPLICIT_OPERATION_SCOPE';
const PARTIAL_FAMILY = 'WRITER_2_HANGER_PARTIAL_DELETE';
const POSTIMAGE_HASH_AUTHORITY = 'SHA256_WRITER2_POSTIMAGE_BYTES';
const POSTIMAGE_REPRESENTATION_AUTHORITY = 'CII_PHYSICAL_POSTIMAGE_REINTAKE_EQUIVALENCE';

function text(value) { return String(value ?? '').trim(); }
function operationId(operation) { return text(operation?.operationId); }
function sorted(values) { return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
function isMutable(operation) { return operation?.action !== 'KEEP'; }
function isNodeMutation(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'NODE_NAME'
    && operation?.property === NODE_PROPERTY && ['CREATE', 'DELETE'].includes(operation?.action);
}
function isSifCreate(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'SIF_TEE'
    && operation?.property === SIF_PROPERTY && operation?.action === 'CREATE';
}
function isSifDelete(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'SIF_TEE'
    && operation?.property === SIF_PROPERTY && operation?.action === 'DELETE';
}
function isHangerCreate(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'HANGER'
    && operation?.property === HANGER_PROPERTY && operation?.action === 'CREATE';
}
function isHangerDelete(operation) {
  return operation?.scopeDecision === 'APPLY' && operation?.family === 'HANGER'
    && operation?.property === HANGER_PROPERTY && operation?.action === 'DELETE';
}
function appliedOperations(transferPlan) {
  return (transferPlan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY');
}
function uniqueIds(operations, code) {
  const ids = operations.map(operationId);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error(`${code}_INVALID_OPERATION_IDS`);
  return Object.freeze(sorted(ids));
}
function independentCanonicalPartialSubscope(transferPlan, parentCustody) {
  const projectedApply = []; const keeps = []; const siblingExcludes = [];
  for (const operation of transferPlan?.operations || []) {
    if (operation?.scopeDecision === 'APPLY') {
      if (isHangerDelete(operation)) projectedApply.push(operation);
      else siblingExcludes.push(Object.freeze({ ...operation, scopeDecision: 'EXCLUDE' }));
    } else if (operation?.action === 'KEEP' && operation?.scopeDecision === 'KEEP') keeps.push(operation);
    else throw new Error(`COMPOSITE_PARTIAL_VALIDATOR_PROJECTED_OPERATION_CONTAINER_INVALID:${operationId(operation) || 'UNKNOWN'}`);
  }
  const inheritedExcluded = [...(transferPlan?.excludedOperations || [])];
  for (const operation of inheritedExcluded) {
    if (!isMutable(operation) || operation?.scopeDecision !== 'EXCLUDE') {
      throw new Error(`COMPOSITE_PARTIAL_VALIDATOR_PROJECTED_EXCLUDE_CONTAINER_INVALID:${operationId(operation) || 'UNKNOWN'}`);
    }
  }
  const projectedExcluded = [...inheritedExcluded, ...siblingExcludes];
  uniqueIds([...keeps, ...projectedApply, ...projectedExcluded], 'COMPOSITE_PARTIAL_VALIDATOR_PROJECTED_ALL');
  const appliedIds = uniqueIds(projectedApply, 'COMPOSITE_PARTIAL_VALIDATOR_PROJECTED_APPLY');
  const excludedIds = uniqueIds(projectedExcluded, 'COMPOSITE_PARTIAL_VALIDATOR_PROJECTED_EXCLUDE');
  if (appliedIds.some((id) => excludedIds.includes(id))) throw new Error('COMPOSITE_PARTIAL_VALIDATOR_PROJECTED_APPLY_EXCLUDE_OVERLAP');
  const candidateIds = Object.freeze(sorted([...appliedIds, ...excludedIds]));
  const childScopeId = `${parentCustody.parentScopeId}::${PARTIAL_FAMILY}`;
  return Object.freeze({
    ...transferPlan,
    operations: Object.freeze([...keeps, ...projectedApply]),
    excludedOperations: Object.freeze(projectedExcluded),
    transferScope: Object.freeze({
      status: 'BOUND', mode: SCOPE_MODE, authority: SCOPE_AUTHORITY, scopeId: childScopeId,
      sourceSha256: parentCustody.sourceSha256, targetSha256: parentCustody.targetSha256,
      candidateOperationIds: candidateIds, appliedOperationIds: appliedIds, excludedOperationIds: excludedIds,
    }),
    familyProjection: Object.freeze({
      schema: 'CIIWorkspaceWriter2FamilyProjection.v1', status: 'DERIVED_CANONICAL_BOUND_SUBSCOPE',
      authority: 'PARENT_TRANSFER_SCOPE_CANONICAL_SUBSCOPE', family: PARTIAL_FAMILY,
      parentScopeId: parentCustody.parentScopeId, projectedScopeId: childScopeId,
      parentAppliedOperationIds: parentCustody.appliedOperationIds,
      projectedAppliedOperationIds: appliedIds,
      siblingAppliedOperationIds: Object.freeze(sorted(siblingExcludes.map(operationId))),
    }),
  });
}
function byteStringToBytes(value) {
  const input = String(value ?? ''); const out = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) out[index] = input.charCodeAt(index) & 0xff;
  return out;
}
function sameBytes(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
}
function representationCustody(byteString) {
  const physical = createCiiPhysicalFile(byteStringToBytes(byteString));
  return Object.freeze({
    authority: POSTIMAGE_REPRESENTATION_AUTHORITY, byteLength: physical.byteLength, textLength: physical.text.length,
    textEncodingAuthority: physical.textEncodingAuthority, lineCount: physical.lines.length,
    lineEndingStyle: physical.lineEndings.style, finalLineTerminated: physical.lineEndings.finalLineTerminated,
  });
}
function expectedMutationTestimony(claims) {
  return claims.map((item) => ({
    authorityFamily: item.authorityFamily, kind: item.kind, byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd),
    beforeField: item.beforeField, afterField: item.afterField,
    ...(item.parsedElementIndex != null ? { parsedElementIndex: Number(item.parsedElementIndex) } : {}),
  }));
}
function actualMutationTestimony(writerResult) {
  return (writerResult?.mutations || []).map((item) => ({
    authorityFamily: item.authorityFamily, kind: item.kind, byteStart: Number(item.byteStart), byteEnd: Number(item.byteEnd),
    beforeField: item.beforeField, afterField: item.afterField,
    ...(item.parsedElementIndex != null ? { parsedElementIndex: Number(item.parsedElementIndex) } : {}),
  }));
}
function partialPlanTestimony(plan) {
  if (!plan) return null;
  return {
    countBefore: Number(plan.countBefore), countAfter: Number(plan.countAfter),
    deletedRecordIndices: [...(plan.deletedRecordIndices || [])], retainedRecordIndices: [...(plan.retainedRecordIndices || [])],
    oldToNewRecordIndex: { ...(plan.oldToNewRecordIndex || {}) },
    packedRowsBefore: Number(plan?.compaction?.packedRowsBefore), packedRowsAfter: Number(plan?.compaction?.packedRowsAfter),
    expectedMiscelRowsAfter: Number(plan?.compaction?.expectedMiscelRowsAfter),
    tailOrder: plan?.physicalCustody?.recordBinding?.tailOrder,
  };
}
function componentScopeTestimony(value) {
  if (!value) return null;
  return {
    scopeId: text(value.scopeId), sourceSha256: text(value.sourceSha256), targetSha256: text(value.targetSha256),
    candidateOperationIds: [...(value.candidateOperationIds || [])], appliedOperationIds: [...(value.appliedOperationIds || [])],
    excludedOperationIds: [...(value.excludedOperationIds || [])],
  };
}
function parentScopeTestimony(value) {
  if (!value) return null;
  return {
    parentScopeId: text(value.parentScopeId), sourceSha256: text(value.sourceSha256), targetSha256: text(value.targetSha256),
    candidateOperationIds: [...(value.candidateOperationIds || [])], appliedOperationIds: [...(value.appliedOperationIds || [])],
    excludedOperationIds: [...(value.excludedOperationIds || [])],
  };
}
function markerName(value) {
  const match = String(value ?? '').match(/^\s*#\$\s*(.*?)\s*$/);
  return match ? match[1].trim().toUpperCase() : null;
}
function connectivity(document) {
  return (document?.parsed?.elements || []).map((item) => ({ index: Number(item.index), from: String(item.from), to: String(item.to) }));
}
function sectionOrder(document) {
  return (document?.physicalFile?.lines || []).map((line) => markerName(line.text)).filter(Boolean);
}
function recordNode(plan, index) {
  const record = (plan?.physicalCustody?.recordBinding?.records || []).find((item) => Number(item?.recordIndex) === Number(index));
  return record == null ? null : String(record.node);
}

export function validateCiiWriter2CompositeWithPartialHangerRoundTrip(before, after, targetGraph, transferPlan, writerResult) {
  const errors = [];
  const parentCheck = legacyValidatorTest.independentBoundScopeCustody(transferPlan, before);
  errors.push(...parentCheck.errors.map((item) => `PARENT_SCOPE:${item}`));
  const applied = appliedOperations(transferPlan);
  const sifCreates = applied.filter(isSifCreate); const hangerCreates = applied.filter(isHangerCreate);
  if (sifCreates.length) errors.push(`${CII_WRITER_2_SIF_CREATE_BLOCKER}:${sifCreates.map(operationId).join(',')}`);
  if (hangerCreates.length) errors.push(`${CII_WRITER_2_HANGER_CREATE_BLOCKER}:${hangerCreates.map(operationId).join(',')}`);
  const unsupported = applied.filter((item) => !isNodeMutation(item) && !isSifDelete(item) && !isHangerDelete(item)
    && !isSifCreate(item) && !isHangerCreate(item));
  if (unsupported.length) errors.push(`UNSUPPORTED_APPLY:${unsupported.map(operationId).join(',')}`);

  const nodeCount = applied.filter(isNodeMutation).length;
  const sifCount = applied.filter(isSifDelete).length;
  const hangerCount = applied.filter(isHangerDelete).length;
  if (!hangerCount) errors.push('PARTIAL_HANGER_OPERATION_REQUIRED');
  const scopeReady = parentCheck.errors.length === 0;
  const nodePlan = nodeCount && scopeReady ? buildCiiWriter2NodeNameRelocationPlan({
    targetDocument: before, transferPlan: legacyValidatorTest.projectPlan(transferPlan, isNodeMutation, 'WRITER_2_NODENAME', parentCheck.custody),
  }) : null;
  const sifPlan = sifCount && scopeReady ? buildCiiWriter2SifDeleteRelocationPlan({
    targetDocument: before, targetGraph,
    transferPlan: legacyValidatorTest.projectPlan(transferPlan, isSifDelete, 'WRITER_2_SIF_DELETE', parentCheck.custody),
  }) : null;
  let partialSubscope = null; let target0Custody = null; let hangerPlan = null;
  let retainedInfo = null; let hangerCounts = null; let partialClaims = [];
  try {
    if (hangerCount && scopeReady) {
      partialSubscope = independentCanonicalPartialSubscope(transferPlan, parentCheck.custody);
      target0Custody = partialValidatorTest.independentlyValidateTarget0HashCustody(before, partialSubscope);
      hangerPlan = buildCiiWriter2HangerDeletePlan({ targetDocument: before, transferPlan: partialSubscope });
      if (!hangerPlan.ready) errors.push(...hangerPlan.blockers.map((item) => `INDEPENDENT_HANGER_PLAN_BLOCKED:${item}`));
      if (hangerPlan?.compaction?.partialMultiRecordDelete !== true || hangerPlan?.compaction?.deleteAll === true
        || Number(hangerPlan.countBefore) <= 1 || Number(hangerPlan.countAfter) <= 0 || Number(hangerPlan.countAfter) >= Number(hangerPlan.countBefore)) {
        errors.push('INDEPENDENT_HANGER_PARTIAL_SCOPE_NOT_PROVEN');
      } else {
        retainedInfo = partialValidatorTest.independentlyRetained(Number(hangerPlan.countBefore), hangerPlan.deletedRecordIndices);
        hangerCounts = partialValidatorTest.expectedCounts(before, retainedInfo.retained.length);
        partialClaims = partialValidatorTest.expectedReplacements(before, hangerPlan, retainedInfo.retained, hangerCounts)
          .map((claim) => ({ ...claim, authorityFamily: PARTIAL_FAMILY }));
      }
    }
  } catch (error) { errors.push(error.message); }
  if (nodePlan && !nodePlan.ready) errors.push(...nodePlan.blockers.map((item) => `INDEPENDENT_NODE_PLAN_BLOCKED:${item}`));
  if (sifPlan && !sifPlan.ready) errors.push(...sifPlan.blockers.map((item) => `INDEPENDENT_SIF_PLAN_BLOCKED:${item}`));

  const original = String(before?.physicalFile?.originalByteString || '');
  let arbitrated = []; let expectedBytes = original;
  try {
    const claims = [];
    if (nodePlan?.ready) claims.push(...legacyValidatorTest.nodeExpectedClaims(before, nodePlan));
    if (sifPlan?.ready) claims.push(...legacyValidatorTest.sifExpectedClaims(before, sifPlan));
    claims.push(...partialClaims);
    arbitrated = legacyValidatorTest.arbitrateExpected(claims, original);
    expectedBytes = legacyValidatorTest.applyExpected(original, arbitrated);
  } catch (error) { errors.push(error.message); }
  const actualBytes = String(after?.physicalFile?.originalByteString || '');
  const canonicalAfter = createCiiPhysicalFile(byteStringToBytes(actualBytes));
  if (after?.writer1CByteEligible !== true || after?.physicalFile?.writer1CByteEligible !== true) errors.push('POST_ORIGINAL_BYTE_CUSTODY_NOT_QUALIFIED');
  if (actualBytes !== expectedBytes) errors.push('EXACT_PARTIAL_HANGER_COMPOSITE_POSTIMAGE_MISMATCH');
  if (text(after?.contentSha256) !== sha256CiiByteString(actualBytes)) errors.push('POSTIMAGE_SHA256_MISMATCH');
  if (String(after?.physicalFile?.text ?? '') !== canonicalAfter.text
    || stableStringify(after?.physicalFile?.lines || []) !== stableStringify(canonicalAfter.lines)
    || stableStringify(after?.physicalFile?.lineEndings || {}) !== stableStringify(canonicalAfter.lineEndings)) {
    errors.push('POSTIMAGE_PHYSICAL_REPRESENTATION_MISMATCH');
  }
  if (String(writerResult?.byteString ?? '') !== actualBytes) errors.push('RESULT_BYTES_MISMATCH');
  if (!sameBytes(writerResult?.bytes, byteStringToBytes(actualBytes))) errors.push('RESULT_BYTE_ARRAY_MISMATCH');
  if (String(writerResult?.text ?? '') !== canonicalAfter.text) errors.push('RESULT_TEXT_MISMATCH');
  if (writerResult?.schema !== 'CIIWorkspaceWriter2CompositeHangerResult.v1' || writerResult?.status !== 'APPLIED'
    || writerResult?.writer !== 'WRITER_2' || writerResult?.mode !== 'ONE_ORIGINAL_PREIMAGE_COMPOSITE') errors.push('RESULT_CONTRACT_MISMATCH');
  if (Number(writerResult?.mutationCount) !== arbitrated.length) errors.push('COMPOSITE_MUTATION_COUNT_MISMATCH');
  if (stableStringify(actualMutationTestimony(writerResult)) !== stableStringify(expectedMutationTestimony(arbitrated))) {
    errors.push('COMPOSITE_MUTATION_TESTIMONY_MISMATCH');
  }
  if (stableStringify(parentScopeTestimony(writerResult?.parentScopeCustody)) !== stableStringify(parentScopeTestimony(parentCheck.custody))) {
    errors.push('PARENT_SCOPE_TESTIMONY_MISMATCH');
  }

  const counts = writerResult?.familyMutationCounts || {};
  if (Number(counts.nodeNameOperations) !== nodeCount || Number(counts.sifDeleteOperations) !== sifCount
    || Number(counts.hangerDeleteOperations) !== hangerCount || Number(counts.hangerDeleteAllOperations) !== 0
    || Number(counts.hangerPartialDeleteOperations) !== hangerCount) errors.push('FAMILY_OPERATION_COUNT_TESTIMONY_MISMATCH');
  const expectedNodeClaims = arbitrated.filter((item) => item.authorityFamily === 'WRITER_2_NODENAME').length;
  const expectedSifClaims = arbitrated.filter((item) => item.authorityFamily === 'WRITER_2_SIF_DELETE').length;
  const expectedPartialClaims = arbitrated.filter((item) => item.authorityFamily === PARTIAL_FAMILY).length;
  if (Number(counts.nodeNameClaims) !== expectedNodeClaims || Number(counts.sifDeleteClaims) !== expectedSifClaims
    || Number(counts.hangerPartialDeleteClaims) !== expectedPartialClaims || Number(counts.hangerDeleteAllClaims) !== 0
    || Number(counts.hangerDeleteClaims) !== expectedPartialClaims) errors.push('FAMILY_CLAIM_COUNT_TESTIMONY_MISMATCH');

  const component = writerResult?.components?.hangerPartialDelete;
  if (!component || writerResult?.components?.hangerDeleteAll != null) errors.push('HANGER_PARTIAL_COMPONENT_DISPATCH_MISMATCH');
  if (hangerPlan && stableStringify(partialPlanTestimony(component?.deletePlan)) !== stableStringify(partialPlanTestimony(hangerPlan))) {
    errors.push('HANGER_PARTIAL_COMPONENT_PLAN_TESTIMONY_MISMATCH');
  }
  if (target0Custody && stableStringify(component?.target0HashCustody || {}) !== stableStringify(target0Custody)) {
    errors.push('HANGER_PARTIAL_COMPONENT_TARGET0_HASH_TESTIMONY_MISMATCH');
  }
  if (partialSubscope) {
    const expectedScope = {
      scopeId: partialSubscope.transferScope.scopeId, sourceSha256: partialSubscope.transferScope.sourceSha256,
      targetSha256: partialSubscope.transferScope.targetSha256, candidateOperationIds: [...partialSubscope.transferScope.candidateOperationIds],
      appliedOperationIds: [...partialSubscope.transferScope.appliedOperationIds], excludedOperationIds: [...partialSubscope.transferScope.excludedOperationIds],
    };
    if (stableStringify(componentScopeTestimony(component?.scopeCustody)) !== stableStringify(expectedScope)) {
      errors.push('HANGER_PARTIAL_COMPONENT_SCOPE_TESTIMONY_MISMATCH');
    }
  }

  if (hangerPlan && retainedInfo && hangerCounts) {
    const expectedNodes = retainedInfo.retained.map((index) => recordNode(hangerPlan, index));
    if (expectedNodes.some((node) => node == null)) errors.push('HANGER_PARTIAL_RECORD_NODE_TESTIMONY_MISSING');
    if (after?.hangerEvidence?.status !== 'QUALIFIED' || after?.hangerEvidence?.layout !== CII_HANGER_LAYOUTS.SYNCHRONIZER
      || Number(after?.hangerEvidence?.count) !== retainedInfo.retained.length
      || stableStringify(after?.hangerEvidence?.nodes || []) !== stableStringify(expectedNodes)) errors.push('POST_HANGER_PARTIAL_CUSTODY_MISMATCH');
    if (ciiPhysicalSectionRows(after?.physicalFile, 'MISCEL_1').length !== hangerCounts.rowCountAfter) errors.push('POST_HANGER_PARTIAL_MISCEL_ROW_COUNT_MISMATCH');
  }

  if (component && partialClaims.length) {
    const partialOnlyClaims = legacyValidatorTest.arbitrateExpected(partialClaims, original);
    const partialOnlyBytes = legacyValidatorTest.applyExpected(original, partialOnlyClaims);
    const expectedPartialBytes = byteStringToBytes(partialOnlyBytes);
    const expectedPartialPhysical = createCiiPhysicalFile(expectedPartialBytes);
    const expectedHashCustody = { authority: POSTIMAGE_HASH_AUTHORITY, contentSha256: sha256CiiByteString(partialOnlyBytes), byteLength: partialOnlyBytes.length };
    const expectedRepresentation = representationCustody(partialOnlyBytes);
    if (String(component.byteString ?? '') !== partialOnlyBytes) errors.push('HANGER_PARTIAL_COMPONENT_BYTES_MISMATCH');
    if (!sameBytes(component.bytes, expectedPartialBytes)) errors.push('HANGER_PARTIAL_COMPONENT_BYTE_ARRAY_MISMATCH');
    if (String(component.text ?? '') !== expectedPartialPhysical.text) errors.push('HANGER_PARTIAL_COMPONENT_TEXT_MISMATCH');
    if (Number(component.byteLengthBefore) !== original.length || Number(component.byteLengthAfter) !== partialOnlyBytes.length
      || Number(component.mutationCount) !== partialOnlyClaims.length) errors.push('HANGER_PARTIAL_COMPONENT_LENGTH_OR_MUTATION_TESTIMONY_MISMATCH');
    if (stableStringify(component.postimageHashCustody || {}) !== stableStringify(expectedHashCustody)) errors.push('HANGER_PARTIAL_COMPONENT_POSTIMAGE_HASH_MISMATCH');
    if (stableStringify(component.postimageRepresentationCustody || {}) !== stableStringify(expectedRepresentation)) {
      errors.push('HANGER_PARTIAL_COMPONENT_REPRESENTATION_CUSTODY_MISMATCH');
    }
  }

  if (nodePlan && after?.nodeNameEvidence?.physicalCustody?.status !== 'QUALIFIED') errors.push('POST_NODENAME_CUSTODY_NOT_QUALIFIED');
  if (sifPlan && after?.sifWriter1CEvidence?.status !== 'QUALIFIED') errors.push('POST_SIF_CUSTODY_NOT_QUALIFIED');
  if (stableStringify(connectivity(before)) !== stableStringify(connectivity(after))) errors.push('CONNECTIVITY_CHANGED');
  if (stableStringify(sectionOrder(before)) !== stableStringify(sectionOrder(after))) errors.push('SECTION_ORDER_CHANGED');
  if (errors.length) throw new Error(`CII_WRITER_2_COMPOSITE_PARTIAL_HANGER_ROUNDTRIP_FAILED:${[...new Set(errors)].join('|')}`);
  return Object.freeze({
    schema: 'CIIWorkspaceWriter2CompositePartialHangerValidation.v1', status: 'PASS',
    checks: Object.freeze([
      'INDEPENDENT_PARENT_SCOPE_CUSTODY', 'INDEPENDENT_CANONICAL_PARTIAL_HANGER_SUBSCOPE',
      'INDEPENDENT_NODE_PLAN', 'INDEPENDENT_SIF_PLAN', 'INDEPENDENT_PARTIAL_HANGER_PLAN',
      'PR1027_INDEPENDENT_RAW_I13_AND_TAIL_ORACLE_REUSED', 'INDEPENDENT_ORIGINAL_COORDINATE_ARBITRATION',
      'EXACT_FULL_BYTE_POSTIMAGE', 'COMPOSITE_POSTIMAGE_HASH_AND_REPRESENTATION_CUSTODY',
      'PARTIAL_COMPONENT_TARGET0_HASH_POSTIMAGE_AND_REPRESENTATION_CUSTODY',
      'POST_FAMILY_CUSTODY', 'CONNECTIVITY_STABLE', 'SECTION_ORDER_STABLE', 'WRITER_TESTIMONY_MATCH',
    ]),
    nodeNameOperations: nodeCount, sifDeleteOperations: sifCount, hangerPartialDeleteOperations: hangerCount,
    mutationCount: arbitrated.length,
  });
}

export const _test = Object.freeze({
  isNodeMutation, isSifDelete, isHangerDelete, independentCanonicalPartialSubscope,
  representationCustody, partialPlanTestimony, componentScopeTestimony, parentScopeTestimony,
});
