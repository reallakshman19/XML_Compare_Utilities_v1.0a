import { CII_WORKSPACE_SCHEMAS, deepFreeze, stableId } from './cii-workspace-contracts.js';
import { ciiReviewLedgerBlockers } from './cii-workspace-review.js';
import { classifyCiiTransferDelta, ciiTransferPolicySummary } from './cii-workspace-transfer-policy.js';

function edgeMap(graph) { return new Map((graph?.edges || []).map((edge) => [edge.elementId, edge])); }
function nodeMap(graph) { return new Map((graph?.nodes || []).map((node) => [String(node.id), node])); }
function reviewAuthority(review, correspondenceId) {
  const rejected = new Set(review?.rejectedCorrespondenceIds || []);
  if (rejected.has(correspondenceId)) return null;
  if (new Set(review?.lockedCorrespondenceIds || []).has(correspondenceId)) return 'LOCKED';
  return new Set(review?.reviewedCorrespondenceIds || []).has(correspondenceId) ? 'REVIEWED' : null;
}
function allCorrespondenceRows(correspondence) {
  return [...(correspondence?.nodeRows || []), ...(correspondence?.elementRows || []), ...(correspondence?.componentRows || [])];
}
function correspondenceRowMap(correspondence) { return new Map(allCorrespondenceRows(correspondence).map((row) => [row.correspondenceId, row])); }
function rowAuthority(row, review) {
  if (!row) return null;
  if (new Set(review?.rejectedCorrespondenceIds || []).has(row.correspondenceId)) return null;
  if (row.status === 'LOCKED') return 'LOCKED';
  return reviewAuthority(review, row.correspondenceId);
}
function blocked(blockers) { return blockers.length ? 'BLOCKED' : 'PREVIEW_READY'; }

function operationBase(property, custody, row, source, target, before, proposed, blockers, authorityStatus = 'REVIEWED', extra = {}) {
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.transferOperation,
    operationId: stableId('op', property, row.correspondenceId), direction: 'SOURCE_TO_TARGET',
    property, custody, sourceEvidence: source, targetEvidence: target,
    matchAuthority: Object.freeze({ correspondenceId: row.correspondenceId, kind: row.kind, status: authorityStatus,
      candidateStatus: row.status, authority: row.authority || 'REVIEWED_CORRESPONDENCE' }),
    before, proposed, status: blocked(blockers), blockers: Object.freeze(blockers), ...extra,
  });
}

function nodeNameOperations(sourceGraph, targetGraph, correspondence, review) {
  const sourceNodes = nodeMap(sourceGraph); const targetNodes = nodeMap(targetGraph); const operations = [];
  for (const row of correspondence?.nodeRows || []) {
    if (row.kind !== 'NODE' || !row.sourceNodeId || !row.targetNodeId) continue;
    const inherentLock = row.status === 'LOCKED'; const reviewedAuthority = reviewAuthority(review, row.correspondenceId);
    if (!inherentLock && !reviewedAuthority) continue;
    if (['CONFLICT', 'UNRESOLVED', 'INSERTED', 'DELETED'].includes(row.status)) continue;
    const source = sourceNodes.get(String(row.sourceNodeId)); const target = targetNodes.get(String(row.targetNodeId));
    if (!source?.nodeName) continue;
    const before = target?.nodeName || ''; const blockers = [];
    if (!target) blockers.push('TARGET_NODE_NOT_FOUND');
    if (before && before !== source.nodeName) blockers.push('TARGET_NODENAME_NONBLANK');
    operations.push(operationBase('NodeName', 'NODE', row,
      Object.freeze({ nodeId: source.id, nodeName: source.nodeName }), Object.freeze({ nodeId: row.targetNodeId, nodeName: before }),
      before, source.nodeName, blockers, inherentLock ? 'LOCKED' : reviewedAuthority,
      { action: before === source.nodeName ? 'KEEP' : 'COPY', family: 'NODE_NAME', inputAuthority: 'LEGACY_COMPATIBILITY' }));
  }
  return operations;
}

function sizeBlockers(sourceEdges, targetEdges, toleranceMm) {
  const blockers = [];
  if (!sourceEdges.length || !targetEdges.length) return ['ELEMENT_PATH_EVIDENCE_MISSING'];
  if (sourceEdges.length !== 1) blockers.push('SOURCE_PATH_CARDINALITY_UNSUPPORTED');
  const reference = sourceEdges[0].diameter;
  if (sourceEdges.some((edge) => Math.abs(edge.diameter - reference) > toleranceMm)) blockers.push('SOURCE_PATH_SIZE_TRANSITION');
  if (targetEdges.some((edge) => Math.abs(edge.diameter - reference) > toleranceMm)) blockers.push('TARGET_PATH_SIZE_TRANSITION_UNREPRESENTED_IN_SOURCE');
  if (targetEdges.some((edge) => edge.fromContext?.sizeTransition || edge.toContext?.sizeTransition)) blockers.push('TARGET_PATH_REDUCER_CONTEXT_REQUIRES_SPLIT');
  return [...new Set(blockers)];
}
function operatingOperations(sourceGraph, targetGraph, correspondence, review, options) {
  const sourceEdges = edgeMap(sourceGraph); const targetEdges = edgeMap(targetGraph); const operations = [];
  for (const row of correspondence?.elementRows || []) {
    const authority = reviewAuthority(review, row.correspondenceId); if (!authority) continue;
    const sourceIds = row.sourceElementIds || (row.sourceElementId ? [row.sourceElementId] : []); const targetIds = row.targetElementIds || [];
    const sources = sourceIds.map((id) => sourceEdges.get(id)).filter(Boolean); const targets = targetIds.map((id) => targetEdges.get(id)).filter(Boolean);
    const baseBlockers = sizeBlockers(sources, targets, Number(options.diameterToleranceMm || 2));
    for (const property of ['P1', 'T1']) {
      const source = sources[0]; if (!source || !Number.isFinite(Number(source[property])) || Number(source[property]) === 0) continue;
      const before = targets.map((edge) => Number(edge[property] || 0)); const blockers = [...baseBlockers];
      if (row.status === 'CONFLICT' || row.status === 'UNRESOLVED') blockers.push('CORRESPONDENCE_NOT_TRANSFERABLE');
      operations.push(operationBase(property, 'ELEMENT_PATH', row,
        Object.freeze({ elementIds: Object.freeze(sourceIds), value: Number(source[property]), unitAuthority: 'SOURCE_CII_NATIVE' }),
        Object.freeze({ elementIds: Object.freeze(targetIds), values: Object.freeze(before), diameters: Object.freeze(targets.map((edge) => edge.diameter)) }),
        Object.freeze(before), Number(source[property]), blockers, authority,
        { action: 'COPY', family: 'PROCESS', inputAuthority: 'LEGACY_COMPATIBILITY' }));
    }
  }
  return operations;
}
function rigidWeightOperations(sourceGraph, targetGraph, correspondence, review, options) {
  const sourceEdges = edgeMap(sourceGraph); const targetEdges = edgeMap(targetGraph); const operations = [];
  for (const row of correspondence?.componentRows || []) {
    const authority = reviewAuthority(review, row.correspondenceId);
    if (row.kind !== 'COMPONENT' || row.componentKind !== 'RIGID' || !authority) continue;
    const sourceId = row.sourceElementId; const targetId = row.targetElementIds?.[0];
    const source = sourceEdges.get(sourceId); const target = targetEdges.get(targetId); if (!source || !target) continue;
    const blockers = [...(row.evidence?.blockers || [])];
    if (Math.abs(source.lengthMm - target.lengthMm) > Number(options.rigidLengthToleranceMm || 6)) blockers.push('RIGID_LENGTH_INCOMPATIBLE');
    const before = target.rigidEvidence?.mass ?? null; const proposed = source.rigidEvidence?.mass ?? null;
    operations.push(operationBase('rigidWeight', 'RIGID_COMPONENT', row,
      Object.freeze({ componentId: row.sourceComponentId, elementId: sourceId, mass: proposed, lengthMm: source.lengthMm }),
      Object.freeze({ componentId: row.targetComponentId, elementId: targetId, mass: before, lengthMm: target.lengthMm }),
      before, proposed, [...new Set(blockers)], authority,
      { action: before === proposed ? 'KEEP' : 'COPY', family: 'WEIGHT_RIGID', inputAuthority: 'LEGACY_COMPATIBILITY' }));
  }
  return operations;
}
function custodyForDelta(delta) {
  if (delta.category === 'RESTRAINT' || delta.category === 'HANGER' || delta.category === 'NODE_NAME') return 'NODE';
  if (delta.category === 'WEIGHT_RIGID') return 'RIGID_COMPONENT';
  if (delta.category === 'SIF_TEE' || delta.category === 'PROCESS') return 'ELEMENT';
  if (['GEOMETRY', 'PIPE_SIZE', 'WALL'].includes(delta.category)) return delta.identityKind || 'IDENTITY';
  return delta.identityKind || 'IDENTITY';
}
function deltaOperation(delta, row, authorityStatus, classification) {
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.transferOperation,
    operationId: stableId('op', classification.family, delta.property, delta.correspondenceId), direction: 'SOURCE_TO_TARGET',
    family: classification.family, action: classification.action, property: delta.property, custody: custodyForDelta(delta),
    sourceEvidence: Object.freeze({ identity: delta.sourceIdentity, value: delta.sourceValue, evidenceStatus: delta.evidenceStatus, authority: delta.authority }),
    targetEvidence: Object.freeze({ identity: delta.targetIdentity, value: delta.targetValue }),
    before: delta.targetValue, proposed: classification.proposedValue, semanticChange: delta.semanticChange, engineeringDeltaId: delta.deltaId,
    evidenceStatus: classification.evidenceStatus, evidenceAuthority: classification.evidenceAuthority,
    policyAuthority: classification.policyAuthority || 'CII_TRANSFER_PREVIEW_POLICY', protected: classification.protected === true,
    sifField: classification.sifField || delta.sifField || null,
    sifContext: classification.sifContext || null,
    status: classification.status, blockers: classification.blockers,
    matchAuthority: Object.freeze({ correspondenceId: row.correspondenceId, kind: row.kind, status: authorityStatus,
      candidateStatus: row.status, authority: row.authority || 'REVIEWED_CORRESPONDENCE' }),
  });
}
function engineeringDeltaOperations(engineeringDeltas, correspondence, review, options) {
  const rows = correspondenceRowMap(correspondence); const operations = [];
  for (const delta of engineeringDeltas?.rows || []) {
    const row = rows.get(delta.correspondenceId); const authority = rowAuthority(row, review);
    if (!row || !authority) continue;
    if (['CONFLICT', 'UNRESOLVED', 'INSERTED', 'DELETED'].includes(row.status)) continue;
    if (!delta.changed && options.includeUnchangedPreview !== true && delta.category !== 'WEIGHT_RIGID') continue;
    const classification = classifyCiiTransferDelta(delta, options); if (!classification) continue;
    operations.push(deltaOperation(delta, row, authority, classification));
  }
  operations.sort((a, b) => `${a.matchAuthority.correspondenceId}|${a.family}|${a.property}`.localeCompare(`${b.matchAuthority.correspondenceId}|${b.family}|${b.property}`, undefined, { numeric: true }));
  return operations;
}
function blockedPlan(sourceDocument, targetDocument, blockers, inputAuthority = 'NONE') {
  return deepFreeze({ schema: CII_WORKSPACE_SCHEMAS.transferPlan, direction: 'SOURCE_TO_TARGET', inputAuthority, mutationAuthority: 'BLOCKED',
    sourceDocument: Object.freeze({ fileName: sourceDocument.fileName, contentSha256: sourceDocument.contentSha256 }),
    targetDocument: Object.freeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256 }),
    operations: Object.freeze([]), status: 'BLOCKED', blockers: Object.freeze(blockers),
    summary: Object.freeze({ operationCount: 0, previewReadyCount: 0, blockedCount: 0, protectedCount: 0, byAction: Object.freeze({}) }) });
}

export function createCiiTransferPreview(sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence, review = {}, engineeringDeltas = null, options = {}) {
  if (engineeringDeltas && engineeringDeltas.schema !== CII_WORKSPACE_SCHEMAS.engineeringDeltaSet) { options = engineeringDeltas; engineeringDeltas = null; }
  const reviewBlockers = ciiReviewLedgerBlockers(review, sourceDocument, targetDocument, correspondence);
  const inputAuthority = engineeringDeltas ? 'ENGINEERING_DELTA_SET' : 'LEGACY_COMPATIBILITY';
  if (reviewBlockers.length) return blockedPlan(sourceDocument, targetDocument, reviewBlockers, inputAuthority);
  const operations = engineeringDeltas
    ? engineeringDeltaOperations(engineeringDeltas, correspondence, review, options)
    : [...nodeNameOperations(sourceGraph, targetGraph, correspondence, review),
      ...operatingOperations(sourceGraph, targetGraph, correspondence, review, options),
      ...rigidWeightOperations(sourceGraph, targetGraph, correspondence, review, options)];
  const policySummary = engineeringDeltas
    ? ciiTransferPolicySummary(operations.map((operation) => ({ action: operation.action, status: operation.status })))
    : deepFreeze({ byAction: Object.freeze(Object.fromEntries(operations.reduce((map, item) => map.set(item.action || 'COPY', (map.get(item.action || 'COPY') || 0) + 1), new Map()))),
      protectedCount: operations.filter((item) => item.status === 'PROTECTED').length,
      blockedCount: operations.filter((item) => item.status === 'BLOCKED').length,
      previewReadyCount: operations.filter((item) => item.status === 'PREVIEW_READY').length });
  const blockers = [];
  if (!operations.length) blockers.push('NO_REVIEWED_TRANSFER_PREVIEW_OPERATIONS');
  if (operations.length && !policySummary.previewReadyCount && !policySummary.protectedCount) blockers.push('NO_TRANSFERABLE_PREVIEW_OPERATIONS');
  if (correspondence?.status === 'CONFLICT') blockers.push('CORRESPONDENCE_CONTAINS_STRUCTURAL_CONFLICT');
  else if (correspondence?.status !== 'READY') blockers.push('CORRESPONDENCE_NOT_READY');
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.transferPlan, direction: 'SOURCE_TO_TARGET', inputAuthority,
    mutationAuthority: 'WRITER_1B_CONDITIONAL',
    policy: deepFreeze({
      geometryProtected: true, nodeNumberProtected: true, topologyProtected: true,
      odProtected: 'CONDITIONAL_WRITER_1B_PLAIN_PIPE_NO_REDUCER', wallProtected: false,
      processDefault: 'WRITER_1B_EXACT_FIXED_FIELDS_ONLY',
      restraintCardinality: 'EXISTING_24_ROW_BLOCK_ONE_SLOT_STEP_ONLY',
      sifTeeMutation: 'BLOCKED_EXCEPT_WRITER_1C_V11_ITEM3_ITEM4',
    }),
    sourceDocument: Object.freeze({ fileName: sourceDocument.fileName, contentSha256: sourceDocument.contentSha256 }),
    targetDocument: Object.freeze({ fileName: targetDocument.fileName, contentSha256: targetDocument.contentSha256 }),
    operations: Object.freeze(operations), status: blockers.length ? 'BLOCKED' : 'PREVIEW_READY', blockers: Object.freeze(blockers),
    summary: Object.freeze({ operationCount: operations.length, previewReadyCount: policySummary.previewReadyCount,
      blockedCount: policySummary.blockedCount, protectedCount: policySummary.protectedCount, byAction: policySummary.byAction }),
  });
}
