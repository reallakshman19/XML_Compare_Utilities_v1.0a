import { CII_WORKSPACE_SCHEMAS, deepFreeze, stableId } from './cii-workspace-contracts.js';
import { ciiWriter1AReadiness } from './cii-workspace-target-writer.js';
import { ciiWriter1BReadiness } from './cii-workspace-target-writer-1b.js';
import { ciiWriterCompositeReadiness } from './cii-workspace-target-writer-composite.js';
import { ciiWriter2CompositeReadiness } from './cii-workspace-writer2-composite-routing.js';
import { ciiWriter2SourceSetNodeNameReadiness } from './cii-workspace-multisource-writer2-readiness.js';
import { adaptCiiDocumentToTopologyGraph } from './cii-workspace-topology-adapter.js';
import { createCiiWorkspaceStageModel } from './cii-workspace-placeholders.js';
import { ciiWorkspaceArtifactBundle } from './cii-workspace-export.js';

function text(value) { return String(value ?? '').trim(); }
function operationId(operation) { return text(operation?.operationId); }
function isMutable(operation) { return operation?.action !== 'KEEP'; }
function uniqueOperations(plan) {
  const rows = new Map();
  for (const operation of [...(plan?.operations || []), ...(plan?.excludedOperations || [])]) {
    const id = operationId(operation); if (id && !rows.has(id)) rows.set(id, operation);
  }
  return [...rows.values()].sort((a, b) => operationId(a).localeCompare(operationId(b), undefined, { numeric: true }));
}
export function ciiTransferScopeCandidateOperations(plan) { return deepFreeze(uniqueOperations(plan)); }
function mutableCandidateIds(plan) { return uniqueOperations(plan).filter(isMutable).map(operationId).sort(); }
function decisionAccessor(decisions) {
  if (decisions instanceof Map) return (id) => decisions.get(id);
  if (typeof decisions === 'function') return decisions;
  const object = decisions && typeof decisions === 'object' ? decisions : {};
  return (id) => object[id];
}
function sourceAuthority(plan) {
  const sourceSetSha256 = text(plan?.sourceSetSha256 || plan?.sourceAuthority?.sourceSetSha256);
  if (sourceSetSha256) return Object.freeze({ kind: 'SOURCE_SET', hash: sourceSetSha256, sourceSetSha256, sourceSha256: '' });
  const sourceSha256 = text(plan?.sourceDocument?.contentSha256);
  return Object.freeze({ kind: 'DOCUMENT', hash: sourceSha256, sourceSetSha256: '', sourceSha256 });
}
function targetAuthority(plan) {
  const original = text(plan?.targetAuthority?.originalSha256);
  if (plan?.targetAuthorityKind === 'ORIGINAL_TARGET' && original) {
    return Object.freeze({ kind: 'ORIGINAL_TARGET', hash: original, targetSha256: original });
  }
  const targetSha256 = text(plan?.targetDocument?.contentSha256);
  return Object.freeze({ kind: 'DOCUMENT', hash: targetSha256, targetSha256 });
}
function sourceScopeFields(plan) {
  const authority = sourceAuthority(plan);
  return authority.kind === 'SOURCE_SET'
    ? { sourceAuthorityKind: 'SOURCE_SET', sourceSetSha256: authority.sourceSetSha256, sourceSha256: '' }
    : { sourceAuthorityKind: 'DOCUMENT', sourceSha256: authority.sourceSha256 };
}
function summary(operations) {
  const byAction = {};
  for (const operation of operations || []) byAction[operation.action || 'UNKNOWN'] = (byAction[operation.action || 'UNKNOWN'] || 0) + 1;
  return deepFreeze({
    operationCount: (operations || []).length,
    previewReadyCount: (operations || []).filter((item) => item.status === 'PREVIEW_READY').length,
    blockedCount: (operations || []).filter((item) => item.status === 'BLOCKED').length,
    protectedCount: (operations || []).filter((item) => item.status === 'PROTECTED').length,
    byAction: deepFreeze(byAction),
  });
}
function scopeRecord(plan, status, extra = {}) {
  const target = targetAuthority(plan);
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.transferScope,
    mode: 'EXPLICIT_APPLY_EXCLUDE', status,
    authority: 'USER_EXPLICIT_OPERATION_SCOPE',
    ...sourceScopeFields(plan),
    targetAuthorityKind: target.kind,
    targetSha256: target.targetSha256,
    candidateOperationIds: deepFreeze(mutableCandidateIds(plan)),
    ...extra,
  });
}
function annotated(operation, decision) { return deepFreeze({ ...operation, scopeDecision: decision }); }
function blockedPlan(plan, status, blockers, extra = {}) {
  const candidates = uniqueOperations(plan).map((operation) => annotated(operation, operation.action === 'KEEP' ? 'KEEP' : 'UNBOUND'));
  return deepFreeze({
    ...plan,
    operations: deepFreeze(candidates),
    excludedOperations: deepFreeze([]),
    status: 'BLOCKED',
    blockers: deepFreeze([...new Set([...(plan?.blockers || []), ...blockers])]),
    summary: summary(candidates),
    transferScope: scopeRecord(plan, status, extra),
  });
}
function normalizedSelection(selection) {
  if (!selection || selection.mode !== 'EXPLICIT_APPLY_EXCLUDE') return null;
  const rows = Array.isArray(selection.decisions) ? selection.decisions : [];
  return {
    sourceAuthorityKind: text(selection.sourceAuthorityKind || (selection.sourceSetSha256 ? 'SOURCE_SET' : 'DOCUMENT')).toUpperCase(),
    sourceSha256: text(selection.sourceSha256), sourceSetSha256: text(selection.sourceSetSha256), targetSha256: text(selection.targetSha256),
    decisions: rows.map((item) => ({ operationId: text(item?.operationId), decision: text(item?.decision).toUpperCase() })),
  };
}
export function createCiiTransferScopeSelection(plan, decisions = {}) {
  const read = decisionAccessor(decisions);
  const rows = uniqueOperations(plan).filter(isMutable).map((operation) => {
    const id = operationId(operation); const decision = text(read(id)).toUpperCase();
    return Object.freeze({ operationId: id, decision: decision === 'APPLY' ? 'APPLY' : 'EXCLUDE' });
  });
  const target = targetAuthority(plan);
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.transferScopeSelection,
    mode: 'EXPLICIT_APPLY_EXCLUDE',
    ...sourceScopeFields(plan),
    targetAuthorityKind: target.kind,
    targetSha256: target.targetSha256,
    decisions: deepFreeze(rows),
  });
}
export function applyCiiTransferScope(plan, selection = null) {
  if (!plan) throw new Error('CII_TRANSFER_SCOPE_PLAN_REQUIRED');
  const source = sourceAuthority(plan); const target = targetAuthority(plan);
  const mutableIds = mutableCandidateIds(plan);
  if (!mutableIds.length) return deepFreeze({ ...plan, excludedOperations: deepFreeze([]), transferScope: scopeRecord(plan, 'EMPTY', {
    scopeId: stableId('transfer-scope', 'empty', source.kind, source.hash, target.kind, target.hash),
    appliedOperationIds: deepFreeze([]), excludedOperationIds: deepFreeze([]),
  }) });
  const normalized = normalizedSelection(selection);
  if (!normalized) return blockedPlan(plan, 'UNBOUND', ['TRANSFER_SCOPE_EXPLICIT_SELECTION_REQUIRED']);
  const scopeBlockers = [];
  if (source.kind === 'SOURCE_SET') {
    if (normalized.sourceAuthorityKind !== 'SOURCE_SET' || normalized.sourceSetSha256 !== source.sourceSetSha256) {
      scopeBlockers.push('TRANSFER_SCOPE_SOURCE_SET_HASH_MISMATCH');
    }
  } else if (normalized.sourceSha256 !== source.sourceSha256) scopeBlockers.push('TRANSFER_SCOPE_SOURCE_HASH_MISMATCH');
  if (normalized.targetSha256 !== target.targetSha256) scopeBlockers.push('TRANSFER_SCOPE_TARGET_HASH_MISMATCH');
  const decisionMap = new Map();
  for (const row of normalized.decisions) {
    if (!row.operationId || !['APPLY', 'EXCLUDE'].includes(row.decision)) { scopeBlockers.push('TRANSFER_SCOPE_DECISION_INVALID'); continue; }
    if (decisionMap.has(row.operationId)) { scopeBlockers.push(`TRANSFER_SCOPE_DUPLICATE_OPERATION:${row.operationId}`); continue; }
    decisionMap.set(row.operationId, row.decision);
  }
  const selectedIds = [...decisionMap.keys()].sort();
  if (selectedIds.length !== mutableIds.length || selectedIds.some((id, index) => id !== mutableIds[index])) {
    scopeBlockers.push('TRANSFER_SCOPE_OPERATION_SET_MISMATCH');
  }
  if (scopeBlockers.length) return blockedPlan(plan, 'INVALID', scopeBlockers, {
    suppliedOperationIds: deepFreeze(selectedIds),
  });
  const candidateOperations = uniqueOperations(plan); const operations = []; const excludedOperations = [];
  for (const operation of candidateOperations) {
    if (!isMutable(operation)) { operations.push(annotated(operation, 'KEEP')); continue; }
    const decision = decisionMap.get(operationId(operation));
    if (decision === 'APPLY') operations.push(annotated(operation, 'APPLY'));
    else excludedOperations.push(annotated(operation, 'EXCLUDE'));
  }
  const appliedOperationIds = operations.filter(isMutable).map(operationId).sort();
  const excludedOperationIds = excludedOperations.map(operationId).sort();
  const blockers = [...(plan?.blockers || [])];
  if (!appliedOperationIds.length) blockers.push('TRANSFER_SCOPE_NO_APPLY_OPERATIONS');
  const scopeId = stableId('transfer-scope', source.kind, source.hash, target.kind, target.hash,
    [...decisionMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, decision]) => `${id}=${decision}`).join('|'));
  return deepFreeze({
    ...plan,
    operations: deepFreeze(operations),
    excludedOperations: deepFreeze(excludedOperations),
    status: blockers.length ? 'BLOCKED' : 'PREVIEW_READY',
    blockers: deepFreeze([...new Set(blockers)]),
    summary: summary(operations),
    transferScope: scopeRecord(plan, 'BOUND', {
      scopeId,
      appliedOperationIds: deepFreeze(appliedOperationIds), excludedOperationIds: deepFreeze(excludedOperationIds),
      appliedOperationCount: appliedOperationIds.length, excludedOperationCount: excludedOperationIds.length,
    }),
  });
}
function readinessFor(preview, transferPlan) {
  if (preview?.writerVersion === '1A') return ciiWriter1AReadiness(transferPlan);
  if (preview?.writerVersion === '1B') return ciiWriter1BReadiness(transferPlan);
  if (preview?.writerVersion === '1C') return ciiWriterCompositeReadiness(transferPlan, preview.targetDocument);
  if (preview?.writerVersion === '2') {
    if (transferPlan?.sourceAuthorityKind === 'SOURCE_SET') {
      return ciiWriter2SourceSetNodeNameReadiness(transferPlan, preview.targetDocument);
    }
    const targetGraph = adaptCiiDocumentToTopologyGraph(preview.targetDocument);
    return ciiWriter2CompositeReadiness(transferPlan, preview.targetDocument, targetGraph);
  }
  return Object.freeze({ schema: 'CIIWorkspaceWriterReadiness.v1', status: 'BLOCKED', ready: false,
    mutationCount: 0, blockers: Object.freeze([`WRITER_VERSION_UNSUPPORTED:${preview?.writerVersion || 'EMPTY'}`]) });
}
function writerLabel(preview) {
  return ['1A', '1B', '1C', '2'].includes(preview?.writerVersion) ? `WRITER_${preview.writerVersion}` : 'WRITER_UNSUPPORTED';
}
export function bindCiiTransferScopeToPreview(preview, selection = null) {
  if (!preview?.transferPlan || !preview?.audit) throw new Error('CII_TRANSFER_SCOPE_PREVIEW_REQUIRED');
  const transferPlan = applyCiiTransferScope(preview.transferPlan, selection);
  const writerReadiness = readinessFor(preview, transferPlan); const label = writerLabel(preview);
  const audit = deepFreeze({
    ...preview.audit,
    transferPreview: transferPlan,
    transferScope: transferPlan.transferScope,
    excludedTransferOperations: transferPlan.excludedOperations || deepFreeze([]),
    writerReadiness,
    mutationAuthority: deepFreeze({
      stage06: writerReadiness.ready ? `${label}_READY` : `${label}_BLOCKED`,
      modifiedTargetCiiExport: writerReadiness.ready ? `${label}_CONDITIONAL` : 'BLOCKED',
    }),
  });
  const result = {
    ...preview,
    stages: createCiiWorkspaceStageModel(writerReadiness),
    transferPlan, transferScope: transferPlan.transferScope, writerReadiness, audit,
  };
  result.artifacts = ciiWorkspaceArtifactBundle(result);
  return deepFreeze(result);
}

export const _test = Object.freeze({ mutableCandidateIds, normalizedSelection, summary, uniqueOperations, sourceAuthority, targetAuthority, readinessFor });
