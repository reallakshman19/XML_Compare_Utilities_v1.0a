import { deepFreeze } from './cii-workspace-contracts.js';
import { applyCiiWriter2NodeNamePlanContract } from './cii-workspace-writer2-routing.js';
import {
  buildCiiWriter2NodeNameRelocationPlan,
  CII_WRITER_2_NODENAME_RELOCATION_POLICY,
} from './cii-workspace-writer2-nodename-relocation.js';
import {
  applyCiiWriter2SifDeletePlanContract,
  buildCiiWriter2SifDeleteRelocationPlan,
  CII_WRITER_2_SIF_CREATE_BLOCKER,
  CII_WRITER_2_SIF_DELETE_POLICY,
} from './cii-workspace-writer2-sif-delete.js';
import {
  applyCiiWriter2HangerDeletePlanContract,
  buildCiiWriter2HangerDeletePlan,
  CII_WRITER_2_HANGER_CREATE_BLOCKER,
  CII_WRITER_2_HANGER_DELETE_POLICY,
} from './cii-workspace-writer2-hanger-delete.js';
import {
  buildCiiWriter2RestraintDeleteCompactionPlan,
  CII_WRITER_2_RESTRAINT_CREATE_BLOCKER,
} from './cii-workspace-writer2-restraint-delete-compaction-plan.js';
import {
  assertBoundScopeCustody as assertRestraintCompositeBoundScope,
  isRestraintCreate,
  isRestraintDelete,
  projectCanonicalSubscope as projectRestraintCompositeSubscope,
} from './cii-workspace-writer2-composite-restraint-support.js';

const NODE_PROPERTY = 'Node name / to-name';
const SIF_PROPERTY = 'SIF/Tee record presence';
const HANGER_PROPERTY = 'Hanger presence';
const RESTRAINT_PROPERTY = 'Qualified restraint slot mutation';
const RESTRAINT_SLOT_POLICY = 'CII_WRITER_1B_EXISTING_BLOCK_FIXED_SLOT';
const RESTRAINT_DELETE_FAMILY = 'WRITER_2_RESTRAINT_BLOCK_DELETE';
const GENERIC_NO_TRANSFER = 'NO_TRANSFERABLE_PREVIEW_OPERATIONS';
const UNSUPPORTED_POLICY = 'CII_WRITER_2_COMPOSITE_UNSUPPORTED_FAMILY';
const SCOPE_MODE = 'EXPLICIT_APPLY_EXCLUDE';
const SCOPE_AUTHORITY = 'USER_EXPLICIT_OPERATION_SCOPE';
const POSITIONAL_SEMANTIC_AUTHORITY = 'NONE_POSITIONAL_PHYSICAL_CUSTODY_ONLY';

function text(value) { return String(value ?? '').trim(); }
function operationId(operation) { return text(operation?.operationId); }
function sortedUnique(values) {
  return [...new Set((values || []).map(text).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function sortedStrings(values) {
  return (values || []).map(text).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function sameStrings(left, right) {
  const a = sortedStrings(left); const b = sortedStrings(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
function scopeIds(scope, field, label, blockers) {
  const values = scope?.[field];
  if (!Array.isArray(values)) {
    blockers.push(`WRITER_2_COMPOSITE_SCOPE_${label}_IDS_ARRAY_REQUIRED`);
    return [];
  }
  const ids = values.map(text);
  if (ids.some((id) => !id)) blockers.push(`WRITER_2_COMPOSITE_SCOPE_${label}_IDS_ID_REQUIRED`);
  if (new Set(ids).size !== ids.length) blockers.push(`WRITER_2_COMPOSITE_SCOPE_${label}_IDS_DUPLICATE`);
  return sortedStrings(ids);
}
function isNodeRoute(operation) {
  return operation?.family === 'NODE_NAME' && operation?.property === NODE_PROPERTY;
}
function isSifPresenceRoute(operation) {
  return operation?.family === 'SIF_TEE' && operation?.property === SIF_PROPERTY;
}
function isHangerPresenceRoute(operation) {
  return operation?.family === 'HANGER' && operation?.property === HANGER_PROPERTY;
}
function isRestraintRoute(operation) {
  return operation?.family === 'RESTRAINT' && operation?.property === RESTRAINT_PROPERTY;
}
function isNodeMutation(operation) {
  return operation?.scopeDecision === 'APPLY'
    && isNodeRoute(operation)
    && ['CREATE', 'DELETE'].includes(operation?.action);
}
function isSifDelete(operation) {
  return operation?.scopeDecision === 'APPLY'
    && isSifPresenceRoute(operation)
    && operation?.action === 'DELETE';
}
function isSifCreate(operation) {
  return operation?.scopeDecision === 'APPLY'
    && isSifPresenceRoute(operation)
    && operation?.action === 'CREATE';
}
function isHangerDelete(operation) {
  return operation?.scopeDecision === 'APPLY'
    && isHangerPresenceRoute(operation)
    && operation?.action === 'DELETE';
}
function isHangerCreate(operation) {
  return operation?.scopeDecision === 'APPLY'
    && isHangerPresenceRoute(operation)
    && operation?.action === 'CREATE';
}
function qualifiedCompositeMutation(operation) {
  if (operation?.status !== 'PREVIEW_READY') return false;
  if (isNodeRoute(operation) && ['CREATE', 'DELETE'].includes(operation?.action)) {
    return operation?.policyAuthority === CII_WRITER_2_NODENAME_RELOCATION_POLICY;
  }
  if (isSifPresenceRoute(operation) && operation?.action === 'DELETE') {
    return operation?.policyAuthority === CII_WRITER_2_SIF_DELETE_POLICY;
  }
  if (isHangerPresenceRoute(operation) && operation?.action === 'DELETE') {
    return operation?.policyAuthority === CII_WRITER_2_HANGER_DELETE_POLICY;
  }
  return isRestraintRoute(operation) && operation?.action === 'DELETE'
    && operation?.policyAuthority === RESTRAINT_SLOT_POLICY;
}
function operationMap(contract) {
  const rows = new Map();
  for (const operation of contract?.operations || []) {
    const id = operationId(operation);
    if (id && !rows.has(id)) rows.set(id, operation);
  }
  return rows;
}
function blockedOperation(operation, blocker) {
  return deepFreeze({
    ...operation,
    action: operation?.action === 'KEEP' ? 'KEEP' : 'BLOCKED',
    status: operation?.action === 'KEEP' ? operation?.status : 'BLOCKED',
    blockers: deepFreeze([...new Set([...(operation?.blockers || []), blocker])]),
    ...(operation?.action === 'KEEP' ? {} : { policyAuthority: UNSUPPORTED_POLICY }),
  });
}
function operationSummary(operations) {
  const byAction = {};
  for (const operation of operations || []) byAction[operation.action || 'UNKNOWN'] = (byAction[operation.action || 'UNKNOWN'] || 0) + 1;
  const mutations = (operations || []).filter(qualifiedCompositeMutation);
  return deepFreeze({
    operationCount: (operations || []).length,
    previewReadyCount: (operations || []).filter((item) => item.status === 'PREVIEW_READY').length,
    blockedCount: (operations || []).filter((item) => item.status === 'BLOCKED').length,
    protectedCount: (operations || []).filter((item) => item.status === 'PROTECTED').length,
    writer2CompositeMutationCount: mutations.length,
    nodeNameMutationCount: mutations.filter((item) => isNodeRoute(item)).length,
    sifDeleteMutationCount: mutations.filter((item) => isSifPresenceRoute(item)).length,
    hangerDeleteMutationCount: mutations.filter((item) => isHangerPresenceRoute(item)).length,
    restraintDeleteMutationCount: mutations.filter((item) => isRestraintRoute(item)).length,
    byAction: deepFreeze(byAction),
  });
}

export function applyCiiWriter2CompositePlanContract(plan) {
  if (!plan) return plan;
  const nodeContract = applyCiiWriter2NodeNamePlanContract(plan);
  const sifContract = applyCiiWriter2SifDeletePlanContract(plan);
  const hangerContract = applyCiiWriter2HangerDeletePlanContract(plan);
  const nodeById = operationMap(nodeContract);
  const sifById = operationMap(sifContract);
  const hangerById = operationMap(hangerContract);
  const blockers = (plan.blockers || []).filter((item) => item !== GENERIC_NO_TRANSFER);
  const seen = new Set(); const operations = [];

  for (const operation of plan.operations || []) {
    const id = operationId(operation);
    if (!id) {
      blockers.push('WRITER_2_COMPOSITE_ROUTING_OPERATION_ID_REQUIRED');
      operations.push(blockedOperation(operation, 'WRITER_2_COMPOSITE_ROUTING_OPERATION_ID_REQUIRED'));
      continue;
    }
    if (seen.has(id)) {
      const blocker = `WRITER_2_COMPOSITE_ROUTING_DUPLICATE_OPERATION_ID:${id}`;
      blockers.push(blocker); operations.push(blockedOperation(operation, blocker)); continue;
    }
    seen.add(id);
    if (isNodeRoute(operation)) {
      operations.push(nodeById.get(id) || blockedOperation(operation, `WRITER_2_COMPOSITE_NODE_ROUTE_MISSING:${id}`));
    } else if (isSifPresenceRoute(operation)) {
      operations.push(sifById.get(id) || blockedOperation(operation, `WRITER_2_COMPOSITE_SIF_ROUTE_MISSING:${id}`));
    } else if (isHangerPresenceRoute(operation)) {
      operations.push(hangerById.get(id) || blockedOperation(operation, `WRITER_2_COMPOSITE_HANGER_ROUTE_MISSING:${id}`));
    } else if (isRestraintRoute(operation) && operation?.action === 'DELETE') {
      operations.push(operation);
    } else if (isRestraintRoute(operation) && operation?.action === 'CREATE') {
      blockers.push(CII_WRITER_2_RESTRAINT_CREATE_BLOCKER);
      operations.push(blockedOperation(operation, CII_WRITER_2_RESTRAINT_CREATE_BLOCKER));
    } else if (operation?.action === 'KEEP') {
      operations.push(operation);
    } else {
      operations.push(blockedOperation(operation, 'WRITER_2_COMPOSITE_UNSUPPORTED_FAMILY'));
    }
  }

  const summary = operationSummary(operations);
  if (!summary.writer2CompositeMutationCount) blockers.push('NO_WRITER_2_COMPOSITE_TRANSFERABLE_OPERATIONS');
  const unique = deepFreeze([...new Set(blockers)]);
  return deepFreeze({
    ...plan,
    mutationAuthority: unique.length ? 'BLOCKED' : 'WRITER_2_COMPOSITE_CARDINALITY_CONDITIONAL',
    operations: deepFreeze(operations),
    status: unique.length ? 'BLOCKED' : 'PREVIEW_READY',
    blockers: unique,
    summary,
    policy: deepFreeze({
      ...(plan.policy || {}),
      geometryProtected: true,
      nodeNumberProtected: true,
      topologyProtected: true,
      nodeNameMutation: 'CREATE_DELETE_RELOCATION_ONLY',
      nodeNameOverwrite: 'WRITER_1C_ONLY',
      sifTeeMutation: 'V11_EXISTING_BLOCK_DELETE_REINDEX_ONLY',
      sifTeeCreate: 'BLOCKED_ITEMS_27_30_UNRESOLVED',
      hangerMutation: 'EXISTING_HANGER_DELETE_ALL_OR_QUALIFIED_PARTIAL',
      hangerCreate: 'BLOCKED_PAYLOAD_SEMANTICS_NOT_QUALIFIED',
      hangerPartialMultiDelete: 'QUALIFIED_POSITIONAL_RECORD_COMPACTION_ONLY',
      restraintMutation: 'QUALIFIED_EXISTING_24_ROW_BLOCK_DELETE_COMPACTION_ONLY',
      restraintCreate: 'BLOCKED_ALLOCATION_DEFAULT_GUID_AUTHORITY_NOT_QUALIFIED',
      mixedCardinalityMutation: 'ONE_ORIGINAL_PREIMAGE_COMPOSITE',
      processDefault: 'BLOCKED_WRITER_2_COMPOSITE',
      restraintCardinality: 'QUALIFIED_DELETE_COMPACTION_ONLY',
      topologyMutation: 'BLOCKED_WRITER_3_ONLY',
    }),
  });
}

function projectPlan(transferPlan, predicate) {
  return deepFreeze({
    ...transferPlan,
    operations: deepFreeze((transferPlan?.operations || []).map((operation) => operation?.scopeDecision === 'APPLY' && !predicate(operation)
      ? deepFreeze({ ...operation, scopeDecision: 'EXCLUDE' }) : operation)),
  });
}
function exactScopeBlockers(transferPlan, targetDocument) {
  const blockers = [];
  const scope = transferPlan?.transferScope;
  if (scope?.status !== 'BOUND') return ['WRITER_2_COMPOSITE_BOUND_TRANSFER_SCOPE_REQUIRED'];
  if (scope?.mode !== SCOPE_MODE || scope?.authority !== SCOPE_AUTHORITY || !text(scope?.scopeId)) {
    blockers.push('WRITER_2_COMPOSITE_CANONICAL_BOUND_TRANSFER_SCOPE_REQUIRED');
  }
  const allRows = [...(transferPlan?.operations || []), ...(transferPlan?.excludedOperations || [])];
  const allIds = allRows.map(operationId);
  if (allIds.some((id) => !id)) blockers.push('WRITER_2_COMPOSITE_SCOPE_OPERATION_ID_REQUIRED');
  if (new Set(allIds).size !== allIds.length) blockers.push('WRITER_2_COMPOSITE_SCOPE_DUPLICATE_OPERATION_ID');
  const appliedIds = sortedStrings((transferPlan?.operations || [])
    .filter((operation) => operation?.scopeDecision === 'APPLY' && operation?.action !== 'KEEP').map(operationId));
  const excludedIds = sortedStrings((transferPlan?.excludedOperations || [])
    .filter((operation) => operation?.scopeDecision === 'EXCLUDE' && operation?.action !== 'KEEP').map(operationId));
  if (appliedIds.some((id) => excludedIds.includes(id))) blockers.push('WRITER_2_COMPOSITE_SCOPE_APPLY_EXCLUDE_OVERLAP');
  const candidateIds = sortedStrings([...appliedIds, ...excludedIds]);
  const scopeAppliedIds = scopeIds(scope, 'appliedOperationIds', 'APPLY', blockers);
  const scopeExcludedIds = scopeIds(scope, 'excludedOperationIds', 'EXCLUDE', blockers);
  const scopeCandidateIds = scopeIds(scope, 'candidateOperationIds', 'CANDIDATE', blockers);
  if (!sameStrings(appliedIds, scopeAppliedIds)) blockers.push('WRITER_2_COMPOSITE_SCOPE_APPLY_SET_MISMATCH');
  if (!sameStrings(excludedIds, scopeExcludedIds)) blockers.push('WRITER_2_COMPOSITE_SCOPE_EXCLUDE_SET_MISMATCH');
  if (!sameStrings(candidateIds, scopeCandidateIds)) blockers.push('WRITER_2_COMPOSITE_SCOPE_CANDIDATE_SET_MISMATCH');
  const sourceSha = text(transferPlan?.sourceDocument?.contentSha256);
  const targetSha = text(transferPlan?.targetDocument?.contentSha256);
  if (!sourceSha || sourceSha !== text(scope?.sourceSha256)) blockers.push('WRITER_2_COMPOSITE_SCOPE_SOURCE_HASH_MISMATCH');
  if (!targetSha || targetSha !== text(scope?.targetSha256) || targetSha !== text(targetDocument?.contentSha256)) {
    blockers.push('WRITER_2_COMPOSITE_SCOPE_TARGET_HASH_MISMATCH');
  }
  return blockers;
}
function hangerTransactionClass(plan) {
  if (!plan?.ready) return null;
  if (plan?.compaction?.deleteAll === true && Number(plan.countAfter) === 0) return 'DELETE_ALL';
  const binding = plan?.physicalCustody?.recordBinding;
  const bindingAuthority = text(binding?.authority);
  const partial = Number(plan.countBefore) > 1
    && Number(plan.countAfter) > 0
    && Number(plan.countAfter) < Number(plan.countBefore)
    && plan?.compaction?.partialMultiRecordDelete === true
    && plan?.compaction?.plannerPartialRecordAuthority === true
    && plan?.compaction?.partialRecordCompactionAuthorized === true
    && binding?.status === 'QUALIFIED'
    && Boolean(bindingAuthority)
    && binding?.semanticAuthority === POSITIONAL_SEMANTIC_AUTHORITY
    && text(plan?.compaction?.recordBindingAuthority) === bindingAuthority;
  return partial ? 'PARTIAL_H_GT_1' : null;
}
function restraintParentCustody(transferPlan, targetDocument, blockers, scopeReady) {
  if (!scopeReady) return null;
  try {
    return assertRestraintCompositeBoundScope(transferPlan, targetDocument);
  } catch (error) {
    blockers.push(`WRITER_2_RESTRAINT_PRODUCT_SCOPE:${text(error?.message) || 'UNKNOWN'}`);
    return null;
  }
}
function readinessFamilyPlan(transferPlan, predicate, family, restraintParent) {
  return restraintParent
    ? projectRestraintCompositeSubscope(transferPlan, predicate, family, restraintParent)
    : projectPlan(transferPlan, predicate);
}
function buildRestraintPlan(transferPlan, targetDocument, blockers, parent) {
  if (!parent) return null;
  const child = projectRestraintCompositeSubscope(
    transferPlan, isRestraintDelete, RESTRAINT_DELETE_FAMILY, parent,
  );
  const plan = buildCiiWriter2RestraintDeleteCompactionPlan({ targetDocument, transferPlan: child });
  if (!plan.ready) blockers.push(...plan.blockers);
  return plan;
}

export function ciiWriter2CompositeReadiness(transferPlan, targetDocument, targetGraph) {
  const blockers = [...(transferPlan?.blockers || [])];
  if (transferPlan?.status !== 'PREVIEW_READY') blockers.push('WRITER_2_COMPOSITE_TRANSFER_PLAN_NOT_PREVIEW_READY');
  const scopeBlockers = exactScopeBlockers(transferPlan, targetDocument);
  blockers.push(...scopeBlockers);
  const applied = (transferPlan?.operations || []).filter((operation) => operation?.scopeDecision === 'APPLY');
  const sifCreates = applied.filter(isSifCreate);
  const hangerCreates = applied.filter(isHangerCreate);
  const restraintCreates = applied.filter(isRestraintCreate);
  if (sifCreates.length) blockers.push(CII_WRITER_2_SIF_CREATE_BLOCKER);
  if (hangerCreates.length) blockers.push(CII_WRITER_2_HANGER_CREATE_BLOCKER);
  if (restraintCreates.length) blockers.push(CII_WRITER_2_RESTRAINT_CREATE_BLOCKER);
  const unsupported = applied.filter((operation) => !isNodeMutation(operation) && !isSifDelete(operation) && !isSifCreate(operation)
    && !isHangerDelete(operation) && !isHangerCreate(operation) && !isRestraintDelete(operation) && !isRestraintCreate(operation));
  for (const operation of unsupported) blockers.push(`WRITER_2_COMPOSITE_UNSUPPORTED_APPLY:${operationId(operation) || 'unknown'}`);

  const nodeOperations = applied.filter(isNodeMutation);
  const sifDeletes = applied.filter(isSifDelete);
  const hangerDeletes = applied.filter(isHangerDelete);
  const restraintDeletes = applied.filter(isRestraintDelete);
  if (!nodeOperations.length && !sifDeletes.length && !hangerDeletes.length && !restraintDeletes.length) {
    blockers.push('WRITER_2_COMPOSITE_NO_MUTATIONS');
  }

  const restraintParent = restraintDeletes.length
    ? restraintParentCustody(transferPlan, targetDocument, blockers, scopeBlockers.length === 0)
    : null;
  const nodePlan = nodeOperations.length
    ? buildCiiWriter2NodeNameRelocationPlan({
      targetDocument,
      transferPlan: readinessFamilyPlan(transferPlan, isNodeMutation, 'WRITER_2_NODENAME', restraintParent),
    })
    : null;
  const sifPlan = sifDeletes.length
    ? buildCiiWriter2SifDeleteRelocationPlan({
      targetDocument, targetGraph,
      transferPlan: readinessFamilyPlan(transferPlan, isSifDelete, 'WRITER_2_SIF_DELETE', restraintParent),
    })
    : null;
  const hangerPlan = hangerDeletes.length
    ? buildCiiWriter2HangerDeletePlan({
      targetDocument,
      transferPlan: readinessFamilyPlan(transferPlan, isHangerDelete, 'WRITER_2_HANGER_DELETE', restraintParent),
    })
    : null;
  const restraintPlan = restraintDeletes.length
    ? buildRestraintPlan(transferPlan, targetDocument, blockers, restraintParent)
    : null;
  if (nodePlan && !nodePlan.ready) blockers.push(...nodePlan.blockers);
  if (sifPlan && !sifPlan.ready) blockers.push(...sifPlan.blockers);
  if (hangerPlan && !hangerPlan.ready) blockers.push(...hangerPlan.blockers);
  if (sifPlan && sifPlan.createAuthority?.ready !== false) blockers.push('WRITER_2_SIF_CREATE_AUTHORITY_UNEXPECTEDLY_READY');
  if (hangerPlan && hangerPlan.createAuthority?.ready !== false) blockers.push('WRITER_2_HANGER_CREATE_AUTHORITY_UNEXPECTEDLY_READY');
  if (restraintPlan && restraintPlan.createAuthority?.ready !== false) blockers.push('WRITER_2_RESTRAINT_CREATE_AUTHORITY_UNEXPECTEDLY_READY');
  const hangerClass = hangerPlan?.ready ? hangerTransactionClass(hangerPlan) : null;
  if (hangerPlan?.ready && !hangerClass) blockers.push('WRITER_2_HANGER_PRODUCT_TRANSACTION_CLASS_UNQUALIFIED');

  const unique = deepFreeze([...new Set(blockers)]);
  const ready = unique.length === 0;
  const mutationCount = nodeOperations.length + sifDeletes.length + hangerDeletes.length + restraintDeletes.length;
  return deepFreeze({
    schema: 'CIIWorkspaceWriter2CompositeReadiness.v1',
    status: ready ? 'READY' : 'BLOCKED',
    ready,
    mutationCount,
    mutationOperationCount: mutationCount,
    familyMutationCounts: deepFreeze({
      nodeName: nodeOperations.length,
      sifDelete: sifDeletes.length,
      hangerDelete: hangerDeletes.length,
      restraintDelete: restraintDeletes.length,
    }),
    blockers: unique,
    components: deepFreeze({
      nodeName: nodePlan,
      sifDelete: sifPlan,
      hangerDeleteAll: hangerClass === 'DELETE_ALL' ? hangerPlan : null,
      hangerPartialDelete: hangerClass === 'PARTIAL_H_GT_1' ? hangerPlan : null,
      restraintDelete: restraintPlan,
    }),
    hangerTransactionClass: hangerClass,
    restraintTransactionClass: restraintPlan?.ready ? 'BLOCK_DELETE_COMPACTION' : null,
    createAuthority: deepFreeze({
      ready: false,
      sifTeeBlocker: CII_WRITER_2_SIF_CREATE_BLOCKER,
      hangerBlocker: CII_WRITER_2_HANGER_CREATE_BLOCKER,
      restraintBlocker: CII_WRITER_2_RESTRAINT_CREATE_BLOCKER,
    }),
  });
}

export const _test = deepFreeze({
  text, operationId, sortedUnique, sortedStrings, sameStrings, scopeIds,
  isNodeRoute, isSifPresenceRoute, isHangerPresenceRoute, isRestraintRoute,
  isNodeMutation, isSifDelete, isSifCreate, isHangerDelete, isHangerCreate, isRestraintDelete, isRestraintCreate,
  qualifiedCompositeMutation, operationSummary, projectPlan, exactScopeBlockers, hangerTransactionClass,
  restraintParentCustody, readinessFamilyPlan, buildRestraintPlan,
});
