import { deepFreeze } from './cii-workspace-contracts.js';
import { buildWriter1CNodeNamePlan } from './cii-workspace-writer1c-nodename.js';
import { buildCiiWriter2NodeNameRelocationPlan } from './cii-workspace-writer2-nodename-relocation.js';
import {
  ciiBm001CorrespondenceCoverage,
  ciiNodeNameMutationOperation,
  ciiNodeNamePhysicalMutationConflicts,
  ciiNodeNamePhysicalMutationKey,
  ciiWriter1CNodeNameReplacementOperation,
  ciiWriter2NodeNameCardinalityOperation,
} from './cii-workspace-multisource-bm001-correspondence.js';
import { CII_MS_SOURCE_SET_SHA256, CII_MS_TARGET_SHA256 } from './cii-workspace-multisource-nodename-authority.js';

function text(value) { return String(value ?? '').trim(); }
function operationId(operation) { return text(operation?.operationId); }
function sameIds(left, right) {
  const a = [...left].sort(); const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function isQualifiedExpectedApply(operation) {
  return operation?.scopeDecision === 'APPLY' && ciiNodeNameMutationOperation(operation);
}
function duplicatePhysicalMutationBlockers(operations) {
  const byKey = new Map(); const blockers = [];
  for (const operation of operations || []) {
    const key = ciiNodeNamePhysicalMutationKey(operation); if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(operationId(operation));
  }
  for (const [key, ids] of byKey) if (ids.length > 1) {
    blockers.push(`CII_MS_WRITER2_DUPLICATE_PHYSICAL_MUTATION:${key}:${ids.sort().join(',')}`);
  }
  return blockers;
}
function conflictingPhysicalMutationBlockers(operations) {
  return ciiNodeNamePhysicalMutationConflicts(operations)
    .map((item) => `CII_MS_WRITER2_PHYSICAL_MUTATION_CONFLICT:${item.physicalTargetKey}:${item.operationIds.join(',')}`);
}
function custodyBlockers(transferPlan, targetDocument) {
  const blockers = []; const scope = transferPlan?.transferScope;
  if (transferPlan?.sourceAuthorityKind !== 'SOURCE_SET') blockers.push('CII_MS_WRITER2_SOURCE_SET_AUTHORITY_REQUIRED');
  if (text(transferPlan?.sourceSetSha256) !== CII_MS_SOURCE_SET_SHA256) blockers.push('CII_MS_WRITER2_SOURCE_SET_HASH_MISMATCH');
  if (text(transferPlan?.targetAuthority?.originalSha256) !== CII_MS_TARGET_SHA256) blockers.push('CII_MS_WRITER2_ORIGINAL_TARGET_HASH_MISMATCH');
  if (text(transferPlan?.targetAuthority?.normalizedSha256) !== text(targetDocument?.contentSha256)) blockers.push('CII_MS_WRITER2_NORMALIZED_TARGET_HASH_MISMATCH');
  if (scope?.status !== 'BOUND' || scope?.mode !== 'EXPLICIT_APPLY_EXCLUDE' || scope?.authority !== 'USER_EXPLICIT_OPERATION_SCOPE') {
    blockers.push('CII_MS_WRITER2_BOUND_SCOPE_REQUIRED');
  }
  if (scope?.sourceAuthorityKind !== 'SOURCE_SET' || text(scope?.sourceSetSha256) !== CII_MS_SOURCE_SET_SHA256) {
    blockers.push('CII_MS_WRITER2_SCOPE_SOURCE_SET_HASH_MISMATCH');
  }
  if (text(scope?.targetSha256) !== CII_MS_TARGET_SHA256) blockers.push('CII_MS_WRITER2_SCOPE_TARGET_HASH_MISMATCH');
  const applied = (transferPlan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY' && operation?.action !== 'KEEP');
  const excluded = (transferPlan?.excludedOperations || []).filter((operation) => operation?.scopeDecision === 'EXCLUDE' && operation?.action !== 'KEEP');
  const candidateIds = [...applied, ...excluded].map(operationId).filter(Boolean);
  if (!sameIds(candidateIds, scope?.candidateOperationIds || [])) blockers.push('CII_MS_WRITER2_SCOPE_CANDIDATE_SET_MISMATCH');
  if (!sameIds(applied.map(operationId), scope?.appliedOperationIds || [])) blockers.push('CII_MS_WRITER2_SCOPE_APPLY_SET_MISMATCH');
  if (!sameIds(excluded.map(operationId), scope?.excludedOperationIds || [])) blockers.push('CII_MS_WRITER2_SCOPE_EXCLUDE_SET_MISMATCH');
  return blockers;
}
function familyPlan(transferPlan, predicate) {
  return deepFreeze({
    ...transferPlan,
    operations: deepFreeze((transferPlan?.operations || []).filter((operation) => operation?.action === 'KEEP' || predicate(operation))),
  });
}

export function ciiWriter2SourceSetNodeNameReadiness(transferPlan, targetDocument) {
  const blockers = [...(transferPlan?.blockers || []), ...custodyBlockers(transferPlan, targetDocument)];
  if (transferPlan?.status !== 'PREVIEW_READY') blockers.push('CII_MS_WRITER2_TRANSFER_PLAN_NOT_PREVIEW_READY');

  const correspondenceCoverage = ciiBm001CorrespondenceCoverage(transferPlan);
  if (correspondenceCoverage.status !== 'READY') {
    blockers.push(`CII_MS_WRITER2_BM001_CORRESPONDENCE_COVERAGE_REQUIRED:${correspondenceCoverage.matchedRowCount}/${correspondenceCoverage.expectedRowCount}`);
  }

  const applied = (transferPlan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY');
  const qualified = applied.filter(isQualifiedExpectedApply);
  const replacements = qualified.filter(ciiWriter1CNodeNameReplacementOperation);
  const structural = qualified.filter(ciiWriter2NodeNameCardinalityOperation);
  for (const operation of applied) if (!isQualifiedExpectedApply(operation)) {
    blockers.push(`CII_MS_WRITER2_UNAUTHORIZED_APPLY:${operationId(operation) || 'unknown'}`);
  }
  blockers.push(...duplicatePhysicalMutationBlockers(qualified));
  blockers.push(...conflictingPhysicalMutationBlockers(qualified));
  if (!qualified.length) blockers.push('CII_MS_WRITER2_NO_EXPECTED_NODENAME_MUTATIONS');

  let replacementPlan = null;
  if (replacements.length) {
    replacementPlan = buildWriter1CNodeNamePlan({ transferPlan: familyPlan(transferPlan, ciiWriter1CNodeNameReplacementOperation), targetDocument });
    if (!replacementPlan.ready) blockers.push(...replacementPlan.blockers.map((item) => `CII_MS_WRITER1C_REPLACE:${item}`));
  }

  let relocationPlan = null;
  if (structural.length) {
    const uniqueBeforePlan = [...new Set(blockers)];
    const structuralTransferPlan = deepFreeze({
      ...familyPlan(transferPlan, ciiWriter2NodeNameCardinalityOperation),
      blockers: deepFreeze(uniqueBeforePlan.filter((item) => !String(item).startsWith('CII_MS_WRITER1C_REPLACE:'))),
    });
    relocationPlan = buildCiiWriter2NodeNameRelocationPlan({ targetDocument, transferPlan: structuralTransferPlan });
    if (!relocationPlan.ready) blockers.push(...relocationPlan.blockers);
  }

  const unique = deepFreeze([...new Set(blockers)]);
  return deepFreeze({
    schema: 'CIIWorkspaceWriter2SourceSetNodeNameReadiness.v2',
    status: unique.length ? 'BLOCKED' : 'READY', ready: unique.length === 0,
    mutationCount: qualified.length, mutationOperationCount: qualified.length,
    familyMutationCounts: deepFreeze({
      nodeName: qualified.length,
      nodeNameReplace: replacements.length,
      nodeNameStructural: structural.length,
      sifDelete: 0, hangerDelete: 0, restraintDelete: 0,
    }),
    blockers: unique,
    bm001CorrespondenceCoverage: correspondenceCoverage,
    components: deepFreeze({
      writer1CNodeNameReplacement: replacementPlan,
      nodeName: relocationPlan,
      sifDelete: null, hangerDeleteAll: null, hangerPartialDelete: null, restraintDelete: null,
    }),
    sourceSetSha256: text(transferPlan?.sourceSetSha256), originalTargetSha256: text(transferPlan?.targetAuthority?.originalSha256),
  });
}

export const _test = Object.freeze({
  sameIds, isQualifiedExpectedApply, duplicatePhysicalMutationBlockers, conflictingPhysicalMutationBlockers, custodyBlockers, familyPlan,
});