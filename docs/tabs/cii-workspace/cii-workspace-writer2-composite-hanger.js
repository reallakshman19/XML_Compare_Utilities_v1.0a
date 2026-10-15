import { deepFreeze } from './cii-workspace-contracts.js';
import { applyCiiWriter2NodeNameRelocation } from './cii-workspace-writer2-nodename-write.js';
import { applyCiiWriter2SifDeleteRelocation } from './cii-workspace-writer2-sif-delete-write.js';
import { applyCiiWriter2HangerDeleteAll } from './cii-workspace-writer2-hanger-delete-all-write.js';
import { applyCiiWriter2HangerPartialDelete } from './cii-workspace-writer2-hanger-partial-write.js';
import { CII_WRITER_2_SIF_CREATE_BLOCKER } from './cii-workspace-writer2-sif-delete.js';
import { buildCiiWriter2HangerDeletePlan, CII_WRITER_2_HANGER_CREATE_BLOCKER } from './cii-workspace-writer2-hanger-delete.js';

const NODE_PROPERTY = 'Node name / to-name';
const SIF_PROPERTY = 'SIF/Tee record presence';
const HANGER_PROPERTY = 'Hanger presence';
const SCOPE_MODE = 'EXPLICIT_APPLY_EXCLUDE';
const SCOPE_AUTHORITY = 'USER_EXPLICIT_OPERATION_SCOPE';
const PARTIAL_HANGER_FAMILY = 'WRITER_2_HANGER_PARTIAL_DELETE';

function text(value) { return String(value ?? '').trim(); }
function operationId(operation) { return text(operation?.operationId); }
function sortedUnique(values) {
  return [...new Set((values || []).map(text).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function sameStrings(left, right) {
  const a = sortedUnique(left); const b = sortedUnique(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function exactIds(values, code) {
  if (!Array.isArray(values)) throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_${code}_ARRAY_REQUIRED`);
  const ids = values.map(text);
  if (ids.some((id) => !id)) throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_${code}_ID_REQUIRED`);
  if (new Set(ids).size !== ids.length) throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_${code}_DUPLICATE_ID`);
  return Object.freeze([...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
}
function exactOperationIds(operations, code) { return exactIds((operations || []).map(operationId), code); }
function isMutable(operation) { return operation?.action !== 'KEEP'; }
function isNodeMutation(operation) {
  return operation?.scopeDecision === 'APPLY'
    && operation?.family === 'NODE_NAME'
    && operation?.property === NODE_PROPERTY
    && ['CREATE', 'DELETE'].includes(operation?.action);
}
function isSifCreate(operation) {
  return operation?.scopeDecision === 'APPLY'
    && operation?.family === 'SIF_TEE'
    && operation?.property === SIF_PROPERTY
    && operation?.action === 'CREATE';
}
function isSifDelete(operation) {
  return operation?.scopeDecision === 'APPLY'
    && operation?.family === 'SIF_TEE'
    && operation?.property === SIF_PROPERTY
    && operation?.action === 'DELETE';
}
function isHangerCreate(operation) {
  return operation?.scopeDecision === 'APPLY'
    && operation?.family === 'HANGER'
    && operation?.property === HANGER_PROPERTY
    && operation?.action === 'CREATE';
}
function isHangerDelete(operation) {
  return operation?.scopeDecision === 'APPLY'
    && operation?.family === 'HANGER'
    && operation?.property === HANGER_PROPERTY
    && operation?.action === 'DELETE';
}
function supportedApply(operation) { return isNodeMutation(operation) || isSifDelete(operation) || isHangerDelete(operation); }
function appliedOperations(transferPlan) {
  return (transferPlan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY');
}
function excludedOperations(transferPlan) {
  return (transferPlan?.excludedOperations || []).filter((operation) => operation?.scopeDecision === 'EXCLUDE');
}
function assertBoundScopeCustody(transferPlan, targetDocument) {
  const scope = transferPlan?.transferScope;
  if (scope?.status !== 'BOUND' || scope?.mode !== SCOPE_MODE || scope?.authority !== SCOPE_AUTHORITY || !text(scope?.scopeId)) {
    throw new Error('CII_WRITER_2_COMPOSITE_HANGER_CANONICAL_BOUND_SCOPE_REQUIRED');
  }
  const allPlanRows = [...(transferPlan?.operations || []), ...(transferPlan?.excludedOperations || [])];
  exactOperationIds(allPlanRows, 'PLAN_OPERATION');
  const appliedRows = appliedOperations(transferPlan).filter(isMutable);
  const excludedRows = excludedOperations(transferPlan).filter(isMutable);
  const appliedIds = exactOperationIds(appliedRows, 'PLAN_APPLY');
  const excludedIds = exactOperationIds(excludedRows, 'PLAN_EXCLUDE');
  if (appliedIds.some((id) => excludedIds.includes(id))) throw new Error('CII_WRITER_2_COMPOSITE_HANGER_PLAN_APPLY_EXCLUDE_OVERLAP');
  const candidateIds = Object.freeze([...appliedIds, ...excludedIds]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  const scopeAppliedIds = exactIds(scope.appliedOperationIds, 'SCOPE_APPLY');
  const scopeExcludedIds = exactIds(scope.excludedOperationIds, 'SCOPE_EXCLUDE');
  const scopeCandidateIds = exactIds(scope.candidateOperationIds, 'SCOPE_CANDIDATE');
  if (scopeAppliedIds.some((id) => scopeExcludedIds.includes(id))) throw new Error('CII_WRITER_2_COMPOSITE_HANGER_SCOPE_APPLY_EXCLUDE_OVERLAP');
  if (!sameStrings(appliedIds, scopeAppliedIds)) throw new Error('CII_WRITER_2_COMPOSITE_HANGER_SCOPE_APPLY_SET_MISMATCH');
  if (!sameStrings(excludedIds, scopeExcludedIds)) throw new Error('CII_WRITER_2_COMPOSITE_HANGER_SCOPE_EXCLUDE_SET_MISMATCH');
  if (!sameStrings(candidateIds, scopeCandidateIds)) throw new Error('CII_WRITER_2_COMPOSITE_HANGER_SCOPE_CANDIDATE_SET_MISMATCH');

  const sourceAuthorityKind = text(scope?.sourceAuthorityKind || transferPlan?.sourceAuthorityKind || 'DOCUMENT').toUpperCase();
  let sourceSha256 = ''; let sourceSetSha256 = '';
  if (sourceAuthorityKind === 'SOURCE_SET') {
    sourceSetSha256 = text(transferPlan?.sourceSetSha256 || transferPlan?.sourceAuthority?.sourceSetSha256);
    if (!sourceSetSha256 || sourceSetSha256 !== text(scope?.sourceSetSha256)) {
      throw new Error('CII_WRITER_2_COMPOSITE_HANGER_SCOPE_SOURCE_SET_HASH_MISMATCH');
    }
  } else {
    sourceSha256 = text(transferPlan?.sourceDocument?.contentSha256);
    if (!sourceSha256 || sourceSha256 !== text(scope?.sourceSha256)) {
      throw new Error('CII_WRITER_2_COMPOSITE_HANGER_SCOPE_SOURCE_HASH_MISMATCH');
    }
  }

  const normalizedTargetSha256 = text(targetDocument?.contentSha256);
  if (!normalizedTargetSha256 || (text(transferPlan?.targetDocument?.contentSha256) && text(transferPlan?.targetDocument?.contentSha256) !== normalizedTargetSha256)) {
    throw new Error('CII_WRITER_2_COMPOSITE_HANGER_NORMALIZED_TARGET_HASH_MISMATCH');
  }
  const targetAuthorityKind = text(scope?.targetAuthorityKind || transferPlan?.targetAuthorityKind || 'DOCUMENT').toUpperCase();
  let originalTargetSha256 = '';
  if (targetAuthorityKind === 'ORIGINAL_TARGET') {
    originalTargetSha256 = text(transferPlan?.targetAuthority?.originalSha256);
    if (!originalTargetSha256 || originalTargetSha256 !== text(scope?.targetSha256)) {
      throw new Error('CII_WRITER_2_COMPOSITE_HANGER_SCOPE_ORIGINAL_TARGET_HASH_MISMATCH');
    }
  } else if (text(scope?.targetSha256) !== normalizedTargetSha256) {
    throw new Error('CII_WRITER_2_COMPOSITE_HANGER_SCOPE_TARGET_HASH_MISMATCH');
  }
  return deepFreeze({
    parentScopeId: text(scope.scopeId), sourceAuthorityKind, sourceSha256, sourceSetSha256,
    targetAuthorityKind, targetSha256: normalizedTargetSha256, originalTargetSha256,
    parentTargetSha256: text(scope?.targetSha256),
    candidateOperationIds: deepFreeze(candidateIds), appliedOperationIds: deepFreeze(appliedIds), excludedOperationIds: deepFreeze(excludedIds),
  });
}
function projectTransferPlan(transferPlan, predicate, family, parentCustody) {
  const projectedApply = []; const siblingExcludes = []; const keeps = [];
  for (const operation of transferPlan?.operations || []) {
    if (operation?.scopeDecision === 'APPLY') {
      if (predicate(operation)) projectedApply.push(operation);
      else siblingExcludes.push(deepFreeze({ ...operation, scopeDecision: 'EXCLUDE' }));
    } else keeps.push(operation);
  }
  const projectedAppliedIds = sortedUnique(projectedApply.map(operationId));
  const siblingAppliedIds = sortedUnique(siblingExcludes.map(operationId));
  return deepFreeze({
    ...transferPlan,
    operations: deepFreeze([...keeps, ...projectedApply]),
    excludedOperations: deepFreeze([...(transferPlan?.excludedOperations || []), ...siblingExcludes]),
    transferScope: transferPlan.transferScope,
    familyProjection: deepFreeze({
      schema: 'CIIWorkspaceWriter2FamilyProjection.v1', status: 'DERIVED_BOUND_SUBSET', authority: 'PARENT_TRANSFER_SCOPE_SUBSET_ONLY', family,
      parentScopeId: parentCustody.parentScopeId, parentAppliedOperationIds: parentCustody.appliedOperationIds,
      projectedAppliedOperationIds: deepFreeze(projectedAppliedIds), siblingAppliedOperationIds: deepFreeze(siblingAppliedIds),
    }),
  });
}
function projectCanonicalFamilySubscope(transferPlan, predicate, family, parentCustody) {
  const projectedApply = []; const siblingExcludes = []; const keeps = [];
  for (const operation of transferPlan?.operations || []) {
    if (operation?.scopeDecision === 'APPLY') {
      if (predicate(operation)) projectedApply.push(operation);
      else siblingExcludes.push(deepFreeze({ ...operation, scopeDecision: 'EXCLUDE' }));
    } else if (operation?.action === 'KEEP' && operation?.scopeDecision === 'KEEP') keeps.push(operation);
    else throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_PROJECTED_OPERATION_CONTAINER_INVALID:${operationId(operation) || 'UNKNOWN'}`);
  }
  const inheritedExcluded = [...(transferPlan?.excludedOperations || [])];
  for (const operation of inheritedExcluded) {
    if (!isMutable(operation) || operation?.scopeDecision !== 'EXCLUDE') {
      throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_PROJECTED_EXCLUDE_CONTAINER_INVALID:${operationId(operation) || 'UNKNOWN'}`);
    }
  }
  const projectedExcluded = [...inheritedExcluded, ...siblingExcludes];
  exactOperationIds([...keeps, ...projectedApply, ...projectedExcluded], 'PROJECTED_OPERATION');
  const appliedIds = exactOperationIds(projectedApply, 'PROJECTED_APPLY');
  const excludedIds = exactOperationIds(projectedExcluded, 'PROJECTED_EXCLUDE');
  if (appliedIds.some((id) => excludedIds.includes(id))) throw new Error('CII_WRITER_2_COMPOSITE_HANGER_PROJECTED_APPLY_EXCLUDE_OVERLAP');
  const candidateIds = Object.freeze([...appliedIds, ...excludedIds]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  const childScopeId = `${parentCustody.parentScopeId}::${family}`;
  const sourceFields = parentCustody.sourceAuthorityKind === 'SOURCE_SET'
    ? { sourceAuthorityKind: 'SOURCE_SET', sourceSetSha256: parentCustody.sourceSetSha256, sourceSha256: '' }
    : { sourceAuthorityKind: 'DOCUMENT', sourceSha256: parentCustody.sourceSha256 };
  return deepFreeze({
    ...transferPlan,
    operations: deepFreeze([...keeps, ...projectedApply]),
    excludedOperations: deepFreeze(projectedExcluded),
    transferScope: deepFreeze({
      status: 'BOUND', mode: SCOPE_MODE, authority: SCOPE_AUTHORITY, scopeId: childScopeId,
      ...sourceFields, targetAuthorityKind: 'DOCUMENT', targetSha256: parentCustody.targetSha256,
      parentTargetAuthorityKind: parentCustody.targetAuthorityKind, parentTargetSha256: parentCustody.parentTargetSha256,
      candidateOperationIds: candidateIds, appliedOperationIds: deepFreeze(appliedIds), excludedOperationIds: deepFreeze(excludedIds),
    }),
    familyProjection: deepFreeze({
      schema: 'CIIWorkspaceWriter2FamilyProjection.v1', status: 'DERIVED_CANONICAL_BOUND_SUBSCOPE',
      authority: 'PARENT_TRANSFER_SCOPE_CANONICAL_SUBSCOPE', family,
      parentScopeId: parentCustody.parentScopeId, projectedScopeId: childScopeId,
      parentAppliedOperationIds: parentCustody.appliedOperationIds,
      projectedAppliedOperationIds: deepFreeze(appliedIds),
      siblingAppliedOperationIds: deepFreeze(sortedUnique(siblingExcludes.map(operationId))),
    }),
  });
}
function originalBytes(targetDocument) {
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  if (!original || targetDocument?.writer1CByteEligible !== true) throw new Error('CII_WRITER_2_COMPOSITE_HANGER_ORIGINAL_BYTE_AUTHORITY_REQUIRED');
  return original;
}
function normalizeClaim(claim, authorityFamily, original) {
  const byteStart = Number(claim?.byteStart); const byteEnd = Number(claim?.byteEnd);
  if (!Number.isSafeInteger(byteStart) || !Number.isSafeInteger(byteEnd) || byteStart < 0 || byteEnd < byteStart || byteEnd > original.length) {
    throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_CLAIM_SPAN_INVALID:${authorityFamily}:${claim?.kind || 'UNKNOWN'}`);
  }
  const beforeField = String(claim?.beforeField ?? ''); const afterField = String(claim?.afterField ?? '');
  if (original.slice(byteStart, byteEnd) !== beforeField) {
    throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_CLAIM_PREIMAGE_MISMATCH:${authorityFamily}:${claim?.kind || 'UNKNOWN'}:${byteStart}`);
  }
  return deepFreeze({ ...claim, authorityFamily, byteStart, byteEnd, beforeField, afterField });
}
function arbitrateClaims(claims, original) {
  const sorted = claims.map((item) => normalizeClaim(item.claim, item.authorityFamily, original))
    .filter((item) => item.beforeField !== item.afterField)
    .sort((a, b) => a.byteStart - b.byteStart || a.byteEnd - b.byteEnd || a.authorityFamily.localeCompare(b.authorityFamily));
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]; const current = sorted[index];
    if (current.byteStart < previous.byteEnd) {
      throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_ORIGINAL_SPAN_OVERLAP:${previous.authorityFamily}:${previous.kind}:${current.authorityFamily}:${current.kind}`);
    }
  }
  return deepFreeze(sorted);
}
function applyClaims(original, claims) {
  let cursor = 0; let output = '';
  for (const claim of claims) {
    if (original.slice(claim.byteStart, claim.byteEnd) !== claim.beforeField) {
      throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_STALE_PREIMAGE:${claim.authorityFamily}:${claim.kind}:${claim.byteStart}`);
    }
    output += original.slice(cursor, claim.byteStart) + claim.afterField;
    cursor = claim.byteEnd;
  }
  return output + original.slice(cursor);
}
function byteStringToBytes(value) {
  const valueText = String(value ?? ''); const out = new Uint8Array(valueText.length);
  for (let index = 0; index < valueText.length; index += 1) out[index] = valueText.charCodeAt(index) & 0xff;
  return out;
}

export function applyCiiWriter2CompositeWithHangerDeleteAll({ targetDocument, targetGraph, transferPlan }) {
  const original = originalBytes(targetDocument);
  if (transferPlan?.status !== 'PREVIEW_READY') throw new Error('CII_WRITER_2_COMPOSITE_HANGER_TRANSFER_PLAN_NOT_PREVIEW_READY');
  if ((transferPlan?.blockers || []).length) throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_TRANSFER_BLOCKED:${transferPlan.blockers.join('|')}`);
  const parentCustody = assertBoundScopeCustody(transferPlan, targetDocument);
  const applied = appliedOperations(transferPlan);
  if (!applied.length) throw new Error('CII_WRITER_2_COMPOSITE_HANGER_NO_MUTATIONS');
  const sifCreates = applied.filter(isSifCreate);
  if (sifCreates.length) throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_${CII_WRITER_2_SIF_CREATE_BLOCKER}:${sifCreates.map((item) => item.operationId || 'unknown').join(',')}`);
  const hangerCreates = applied.filter(isHangerCreate);
  if (hangerCreates.length) throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_${CII_WRITER_2_HANGER_CREATE_BLOCKER}:${hangerCreates.map((item) => item.operationId || 'unknown').join(',')}`);
  const unsupported = applied.filter((operation) => !supportedApply(operation));
  if (unsupported.length) throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_UNSUPPORTED_APPLY:${unsupported.map((item) => item.operationId || 'unknown').join(',')}`);

  const nodeCount = applied.filter(isNodeMutation).length;
  const sifDeleteCount = applied.filter(isSifDelete).length;
  const hangerDeleteCount = applied.filter(isHangerDelete).length;
  const nodePlan = nodeCount ? projectTransferPlan(transferPlan, isNodeMutation, 'WRITER_2_NODENAME', parentCustody) : null;
  const sifPlan = sifDeleteCount ? projectTransferPlan(transferPlan, isSifDelete, 'WRITER_2_SIF_DELETE', parentCustody) : null;
  const hangerLegacyPlan = hangerDeleteCount ? projectTransferPlan(transferPlan, isHangerDelete, 'WRITER_2_HANGER_DELETE_ALL', parentCustody) : null;
  const hangerDecision = hangerLegacyPlan ? buildCiiWriter2HangerDeletePlan({ targetDocument, transferPlan: hangerLegacyPlan }) : null;
  if (hangerDecision && !hangerDecision.ready) throw new Error(`CII_WRITER_2_COMPOSITE_HANGER_PLAN_BLOCKED:${hangerDecision.blockers.join('|')}`);
  const hangerIsDeleteAll = Boolean(hangerDecision?.compaction?.deleteAll === true && Number(hangerDecision?.countAfter) === 0);
  const hangerIsPartial = Boolean(hangerDecision?.compaction?.partialMultiRecordDelete === true
    && Number(hangerDecision?.countBefore) > 1 && Number(hangerDecision?.countAfter) > 0
    && Number(hangerDecision?.countAfter) < Number(hangerDecision?.countBefore));
  if (hangerDeleteCount && !hangerIsDeleteAll && !hangerIsPartial) throw new Error('CII_WRITER_2_COMPOSITE_HANGER_DELETE_SCOPE_UNQUALIFIED');
  const hangerPartialPlan = hangerIsPartial
    ? projectCanonicalFamilySubscope(transferPlan, isHangerDelete, PARTIAL_HANGER_FAMILY, parentCustody) : null;

  const nodeResult = nodePlan ? applyCiiWriter2NodeNameRelocation({ targetDocument, transferPlan: nodePlan }) : null;
  const sifResult = sifPlan ? applyCiiWriter2SifDeleteRelocation({ targetDocument, targetGraph, transferPlan: sifPlan }) : null;
  const hangerDeleteAllResult = hangerIsDeleteAll
    ? applyCiiWriter2HangerDeleteAll({ targetDocument, transferPlan: hangerLegacyPlan }) : null;
  const hangerPartialResult = hangerIsPartial
    ? applyCiiWriter2HangerPartialDelete({ targetDocument, transferPlan: hangerPartialPlan }) : null;

  const candidateClaims = [
    ...(nodeResult?.mutations || []).map((claim) => ({ authorityFamily: 'WRITER_2_NODENAME', claim })),
    ...(sifResult?.mutations || []).map((claim) => ({ authorityFamily: 'WRITER_2_SIF_DELETE', claim })),
    ...(hangerDeleteAllResult?.mutations || []).map((claim) => ({ authorityFamily: 'WRITER_2_HANGER_DELETE_ALL', claim })),
    ...(hangerPartialResult?.mutations || []).map((claim) => ({ authorityFamily: PARTIAL_HANGER_FAMILY, claim })),
  ];
  const mutations = arbitrateClaims(candidateClaims, original);
  if (!mutations.length) throw new Error('CII_WRITER_2_COMPOSITE_HANGER_NO_PHYSICAL_MUTATIONS');
  const byteString = applyClaims(original, mutations); const bytes = byteStringToBytes(byteString);
  return Object.freeze({
    schema: 'CIIWorkspaceWriter2CompositeHangerResult.v1', status: 'APPLIED', writer: 'WRITER_2', mode: 'ONE_ORIGINAL_PREIMAGE_COMPOSITE',
    byteString, bytes, text: new TextDecoder('utf-8').decode(bytes), byteLengthBefore: original.length, byteLengthAfter: byteString.length,
    mutationCount: mutations.length, mutations, parentScopeCustody: parentCustody,
    familyMutationCounts: deepFreeze({
      nodeNameOperations: nodeCount, sifDeleteOperations: sifDeleteCount, hangerDeleteOperations: hangerDeleteCount,
      hangerDeleteAllOperations: hangerIsDeleteAll ? hangerDeleteCount : 0,
      hangerPartialDeleteOperations: hangerIsPartial ? hangerDeleteCount : 0,
      nodeNameClaims: nodeResult?.mutations?.length || 0, sifDeleteClaims: sifResult?.mutations?.length || 0,
      hangerDeleteClaims: (hangerDeleteAllResult?.mutations?.length || 0) + (hangerPartialResult?.mutations?.length || 0),
      hangerDeleteAllClaims: hangerDeleteAllResult?.mutations?.length || 0,
      hangerPartialDeleteClaims: hangerPartialResult?.mutations?.length || 0,
    }),
    components: Object.freeze({
      nodeName: nodeResult, sifDelete: sifResult, hangerDeleteAll: hangerDeleteAllResult, hangerPartialDelete: hangerPartialResult,
    }),
  });
}

export const _test = deepFreeze({
  text, operationId, sortedUnique, sameStrings, exactIds, exactOperationIds,
  isNodeMutation, isSifCreate, isSifDelete, isHangerCreate, isHangerDelete,
  supportedApply, appliedOperations, excludedOperations, assertBoundScopeCustody, projectTransferPlan, projectCanonicalFamilySubscope,
  normalizeClaim, arbitrateClaims, applyClaims,
});