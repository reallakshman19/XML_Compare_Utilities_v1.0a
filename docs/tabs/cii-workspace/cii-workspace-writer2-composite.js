import { deepFreeze } from './cii-workspace-contracts.js';
import { applyCiiWriter2NodeNameRelocation } from './cii-workspace-writer2-nodename-write.js';
import { applyCiiWriter2SifDeleteRelocation } from './cii-workspace-writer2-sif-delete-write.js';
import { CII_WRITER_2_SIF_CREATE_BLOCKER } from './cii-workspace-writer2-sif-delete.js';

const NODE_PROPERTY = 'Node name / to-name';
const SIF_PROPERTY = 'SIF/Tee record presence';
const SCOPE_MODE = 'EXPLICIT_APPLY_EXCLUDE';
const SCOPE_AUTHORITY = 'USER_EXPLICIT_OPERATION_SCOPE';

function text(value) { return String(value ?? '').trim(); }
function operationId(operation) { return text(operation?.operationId); }
function sortedUnique(values) { return [...new Set((values || []).map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
function sameStrings(left, right) {
  const a = sortedUnique(left); const b = sortedUnique(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function exactIds(values, code) {
  if (!Array.isArray(values)) throw new Error(`CII_WRITER_2_COMPOSITE_${code}_ARRAY_REQUIRED`);
  const ids = values.map(text);
  if (ids.some((id) => !id)) throw new Error(`CII_WRITER_2_COMPOSITE_${code}_ID_REQUIRED`);
  if (new Set(ids).size !== ids.length) throw new Error(`CII_WRITER_2_COMPOSITE_${code}_DUPLICATE_ID`);
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
function supportedApply(operation) { return isNodeMutation(operation) || isSifDelete(operation); }
function appliedOperations(transferPlan) {
  return (transferPlan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY');
}
function excludedOperations(transferPlan) {
  return (transferPlan?.excludedOperations || []).filter((operation) => operation?.scopeDecision === 'EXCLUDE');
}
function assertBoundScopeCustody(transferPlan, targetDocument) {
  const scope = transferPlan?.transferScope;
  if (scope?.status !== 'BOUND' || scope?.mode !== SCOPE_MODE || scope?.authority !== SCOPE_AUTHORITY || !text(scope?.scopeId)) {
    throw new Error('CII_WRITER_2_COMPOSITE_CANONICAL_BOUND_SCOPE_REQUIRED');
  }
  const allPlanRows = [...(transferPlan?.operations || []), ...(transferPlan?.excludedOperations || [])];
  exactOperationIds(allPlanRows, 'PLAN_OPERATION');
  const appliedRows = appliedOperations(transferPlan).filter(isMutable); const excludedRows = excludedOperations(transferPlan).filter(isMutable);
  const appliedIds = exactOperationIds(appliedRows, 'PLAN_APPLY'); const excludedIds = exactOperationIds(excludedRows, 'PLAN_EXCLUDE');
  if (appliedIds.some((id) => excludedIds.includes(id))) throw new Error('CII_WRITER_2_COMPOSITE_PLAN_APPLY_EXCLUDE_OVERLAP');
  const candidateIds = Object.freeze([...appliedIds, ...excludedIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  const scopeAppliedIds = exactIds(scope.appliedOperationIds, 'SCOPE_APPLY');
  const scopeExcludedIds = exactIds(scope.excludedOperationIds, 'SCOPE_EXCLUDE');
  const scopeCandidateIds = exactIds(scope.candidateOperationIds, 'SCOPE_CANDIDATE');
  if (scopeAppliedIds.some((id) => scopeExcludedIds.includes(id))) throw new Error('CII_WRITER_2_COMPOSITE_SCOPE_APPLY_EXCLUDE_OVERLAP');
  if (!sameStrings(appliedIds, scopeAppliedIds)) throw new Error('CII_WRITER_2_COMPOSITE_SCOPE_APPLY_SET_MISMATCH');
  if (!sameStrings(excludedIds, scopeExcludedIds)) throw new Error('CII_WRITER_2_COMPOSITE_SCOPE_EXCLUDE_SET_MISMATCH');
  if (!sameStrings(candidateIds, scopeCandidateIds)) throw new Error('CII_WRITER_2_COMPOSITE_SCOPE_CANDIDATE_SET_MISMATCH');
  const sourceSha = text(transferPlan?.sourceDocument?.contentSha256); const targetSha = text(transferPlan?.targetDocument?.contentSha256);
  if (!sourceSha || sourceSha !== text(scope.sourceSha256)) throw new Error('CII_WRITER_2_COMPOSITE_SCOPE_SOURCE_HASH_MISMATCH');
  if (!targetSha || targetSha !== text(scope.targetSha256) || targetSha !== text(targetDocument?.contentSha256)) {
    throw new Error('CII_WRITER_2_COMPOSITE_SCOPE_TARGET_HASH_MISMATCH');
  }
  return deepFreeze({
    parentScopeId: text(scope.scopeId), sourceSha256: sourceSha, targetSha256: targetSha,
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
function originalBytes(targetDocument) {
  const original = String(targetDocument?.physicalFile?.originalByteString ?? '');
  if (!original || targetDocument?.writer1CByteEligible !== true) throw new Error('CII_WRITER_2_COMPOSITE_ORIGINAL_BYTE_AUTHORITY_REQUIRED');
  return original;
}
function normalizeClaim(claim, authorityFamily, original) {
  const byteStart = Number(claim?.byteStart); const byteEnd = Number(claim?.byteEnd);
  if (!Number.isSafeInteger(byteStart) || !Number.isSafeInteger(byteEnd) || byteStart < 0 || byteEnd < byteStart || byteEnd > original.length) {
    throw new Error(`CII_WRITER_2_COMPOSITE_CLAIM_SPAN_INVALID:${authorityFamily}:${claim?.kind || 'UNKNOWN'}`);
  }
  const beforeField = String(claim?.beforeField ?? ''); const afterField = String(claim?.afterField ?? '');
  if (original.slice(byteStart, byteEnd) !== beforeField) {
    throw new Error(`CII_WRITER_2_COMPOSITE_CLAIM_PREIMAGE_MISMATCH:${authorityFamily}:${claim?.kind || 'UNKNOWN'}:${byteStart}`);
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
      throw new Error(`CII_WRITER_2_COMPOSITE_ORIGINAL_SPAN_OVERLAP:${previous.authorityFamily}:${previous.kind}:${current.authorityFamily}:${current.kind}`);
    }
  }
  return deepFreeze(sorted);
}
function applyClaims(original, claims) {
  let cursor = 0; let output = '';
  for (const claim of claims) {
    if (original.slice(claim.byteStart, claim.byteEnd) !== claim.beforeField) {
      throw new Error(`CII_WRITER_2_COMPOSITE_STALE_PREIMAGE:${claim.authorityFamily}:${claim.kind}:${claim.byteStart}`);
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

export function applyCiiWriter2Composite({ targetDocument, targetGraph, transferPlan }) {
  const original = originalBytes(targetDocument);
  if (transferPlan?.status !== 'PREVIEW_READY') throw new Error('CII_WRITER_2_COMPOSITE_TRANSFER_PLAN_NOT_PREVIEW_READY');
  if ((transferPlan?.blockers || []).length) throw new Error(`CII_WRITER_2_COMPOSITE_TRANSFER_BLOCKED:${transferPlan.blockers.join('|')}`);
  const parentCustody = assertBoundScopeCustody(transferPlan, targetDocument);
  const applied = appliedOperations(transferPlan);
  if (!applied.length) throw new Error('CII_WRITER_2_COMPOSITE_NO_MUTATIONS');
  const sifCreates = applied.filter(isSifCreate);
  if (sifCreates.length) throw new Error(`CII_WRITER_2_COMPOSITE_${CII_WRITER_2_SIF_CREATE_BLOCKER}:${sifCreates.map((item) => item.operationId || 'unknown').join(',')}`);
  const unsupported = applied.filter((operation) => !supportedApply(operation));
  if (unsupported.length) throw new Error(`CII_WRITER_2_COMPOSITE_UNSUPPORTED_APPLY:${unsupported.map((item) => item.operationId || 'unknown').join(',')}`);
  const nodeCount = applied.filter(isNodeMutation).length; const sifDeleteCount = applied.filter(isSifDelete).length;
  const nodePlan = nodeCount ? projectTransferPlan(transferPlan, isNodeMutation, 'WRITER_2_NODENAME', parentCustody) : null;
  const sifPlan = sifDeleteCount ? projectTransferPlan(transferPlan, isSifDelete, 'WRITER_2_SIF_DELETE', parentCustody) : null;
  const nodeResult = nodePlan ? applyCiiWriter2NodeNameRelocation({ targetDocument, transferPlan: nodePlan }) : null;
  const sifResult = sifPlan ? applyCiiWriter2SifDeleteRelocation({ targetDocument, targetGraph, transferPlan: sifPlan }) : null;
  const candidateClaims = [
    ...(nodeResult?.mutations || []).map((claim) => ({ authorityFamily: 'WRITER_2_NODENAME', claim })),
    ...(sifResult?.mutations || []).map((claim) => ({ authorityFamily: 'WRITER_2_SIF_DELETE', claim })),
  ];
  const mutations = arbitrateClaims(candidateClaims, original);
  if (!mutations.length) throw new Error('CII_WRITER_2_COMPOSITE_NO_PHYSICAL_MUTATIONS');
  const byteString = applyClaims(original, mutations); const bytes = byteStringToBytes(byteString);
  return Object.freeze({
    schema: 'CIIWorkspaceWriter2CompositeResult.v1', status: 'APPLIED', writer: 'WRITER_2', mode: 'ONE_ORIGINAL_PREIMAGE_COMPOSITE',
    byteString, bytes, text: new TextDecoder('utf-8').decode(bytes), byteLengthBefore: original.length, byteLengthAfter: byteString.length,
    mutationCount: mutations.length, mutations, parentScopeCustody: parentCustody,
    familyMutationCounts: deepFreeze({ nodeNameOperations: nodeCount, sifDeleteOperations: sifDeleteCount,
      nodeNameClaims: nodeResult?.mutations?.length || 0, sifDeleteClaims: sifResult?.mutations?.length || 0 }),
    components: Object.freeze({ nodeName: nodeResult, sifDelete: sifResult }),
  });
}

export const _test = deepFreeze({ text, operationId, sortedUnique, sameStrings, exactIds, exactOperationIds, isNodeMutation, isSifCreate, isSifDelete,
  supportedApply, appliedOperations, excludedOperations, assertBoundScopeCustody, projectTransferPlan, normalizeClaim, arbitrateClaims, applyClaims });
