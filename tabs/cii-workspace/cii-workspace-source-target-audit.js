import { compareNodeIds, deepFreeze, stableStringify } from './cii-workspace-contracts.js';

export const CII_SOURCE_TARGET_AUDIT_SCHEMA = 'CIIWorkspaceSourceTargetAudit.v1';

const CONFIDENCE_RANK = Object.freeze({ LOCKED: 5, HIGH: 4, MEDIUM: 3, REVIEW: 2, UNRESOLVED: 1 });

function text(value) { return String(value ?? '').trim(); }
function normalizedNodeId(value) {
  const raw = text(value); if (!raw) return '';
  const number = Number(raw); return Number.isFinite(number) ? String(Math.round(number)) : raw;
}
function unique(values) { return [...new Set((values || []).map(text).filter(Boolean))]; }
function sortedNodes(values) { return unique(values).sort(compareNodeIds); }
function documentNodeIds(document) {
  const ids = [];
  for (const element of document?.parsed?.elements || []) {
    ids.push(normalizedNodeId(element?.from), normalizedNodeId(element?.to));
  }
  const parsedNodes = document?.parsed?.nodes;
  if (Array.isArray(parsedNodes)) {
    for (const node of parsedNodes) ids.push(normalizedNodeId(node?.id ?? node?.node ?? node));
  } else if (parsedNodes && typeof parsedNodes === 'object') ids.push(...Object.keys(parsedNodes).map(normalizedNodeId));
  ids.push(...Object.keys(document?.nodeNames || {}).map(normalizedNodeId));
  return sortedNodes(ids);
}
function nodeName(document, nodeId) { return text(document?.nodeNames?.[String(nodeId)]); }
function nodeReviewRows(compareReview, sourceId, sourceNodeId) {
  return (compareReview?.rows || []).filter((row) => row?.kind === 'NODE'
    && text(row?.sourceId) === sourceId && normalizedNodeId(row?.source) === sourceNodeId);
}
function nodeNameDeltas(engineeringDeltas, sourceId, sourceNodeId) {
  return (engineeringDeltas?.rows || []).filter((row) => text(row?.sourceId) === sourceId
    && normalizedNodeId(row?.sourceIdentity) === sourceNodeId
    && row?.category === 'NODE_NAME' && row?.property === 'Node name / to-name');
}
function operationsForRows(transferPlan, correspondenceIds) {
  const ids = new Set(correspondenceIds);
  return (transferPlan?.operations || []).filter((operation) => ids.has(text(operation?.matchAuthority?.correspondenceId)));
}
function reviewDecision(row, overrides) {
  const id = text(row?.correspondenceId);
  const override = overrides?.get?.(id) ?? (id ? overrides?.[id] : undefined);
  return text(override || row?.decision);
}
function confidenceFor(rows) {
  return [...(rows || [])].map((row) => text(row?.confidence) || 'UNRESOLVED')
    .sort((a, b) => (CONFIDENCE_RANK[b] || 0) - (CONFIDENCE_RANK[a] || 0) || a.localeCompare(b))[0] || 'UNRESOLVED';
}
function stateFor(rows, targetNodeIds) {
  if (!rows.length) return 'UNEMITTED';
  if (targetNodeIds.length > 1) return 'AMBIGUOUS';
  if (targetNodeIds.length === 1 && rows.some((row) => row?.identityBound === true)) return 'BOUND';
  return 'UNRESOLVED';
}
function boundaryReviewReasons(row) {
  const evidence = row?.methodABoundaryDiagnostics;
  if (!evidence || row?.identityBound === true) return [];
  if (evidence.custodyVeto) return [
    'NODE_CUSTODY_VETO:' + text(evidence.custodyVeto.blocker || 'CUSTODY_REVIEW_REQUIRED'),
  ];
  if (evidence.upstreamIdentitySupported === false) return [
    'METHOD_A_BOUNDARY_UPSTREAM_SUPPORT_MISSING',
  ];
  if (evidence.upstreamIdentitySupported === true) return [
    'METHOD_A_BOUNDARY_DOWNSTREAM_IDENTITY_NOT_BOUND',
  ];
  return [];
}
function reasonsFor(state, rows) {
  if (state === 'UNEMITTED') return Object.freeze(['NO_NODE_CORRESPONDENCE_EMITTED']);
  if (state === 'AMBIGUOUS') return Object.freeze(['MULTIPLE_TARGET_NODE_CLAIMS']);
  if (state === 'BOUND') return Object.freeze([]);
  const reasons = unique(rows.flatMap((row) => [
    row?.candidateStatus && row.candidateStatus !== 'SUPPORTED' ? `CANDIDATE_${row.candidateStatus}` : '',
    ...(row?.reasons || []),
    ...(row?.identityReasons || []),
    ...boundaryReviewReasons(row),
  ]));
  return Object.freeze(reasons.length ? reasons : ['IDENTITY_NOT_BOUND']);
}
function memberPreviewById(memberPreviews) {
  return new Map((memberPreviews || []).map((item) => [text(item?.sourceId), item?.preview || null]));
}
function censusRow(sourceId, sourceDocument, targetDocument, sourceNodeId, context) {
  const reviewRows = nodeReviewRows(context.compareReview, sourceId, sourceNodeId);
  const correspondenceIds = unique(reviewRows.map((row) => row?.correspondenceId));
  const targetNodeIds = sortedNodes(reviewRows.map((row) => row?.target));
  const state = stateFor(reviewRows, targetNodeIds);
  const deltas = nodeNameDeltas(context.engineeringDeltas, sourceId, sourceNodeId);
  const operations = operationsForRows(context.transferPlan, correspondenceIds);
  const targetNames = targetNodeIds.map((id) => nodeName(targetDocument, id));
  const sourceNodeName = nodeName(sourceDocument, sourceNodeId);
  const uniqueTargetName = targetNodeIds.length === 1 ? targetNames[0] : '';
  return deepFreeze({
    rowKey: `${sourceId}:${sourceNodeId}`,
    sourceId,
    sourceFileName: text(sourceDocument?.fileName),
    sourceNodeId,
    sourceNodeName,
    state,
    emitted: reviewRows.length > 0,
    identityBound: state === 'BOUND',
    confidence: confidenceFor(reviewRows),
    targetNodeIds: deepFreeze(targetNodeIds),
    targetNodeNames: deepFreeze(targetNames),
    targetNodeId: targetNodeIds.length === 1 ? targetNodeIds[0] : null,
    targetNodeName: targetNodeIds.length === 1 ? uniqueTargetName : null,
    nodeNameDifferent: targetNodeIds.length === 1 ? sourceNodeName !== uniqueTargetName : null,
    qualifiedNodeNameChange: deltas.some((row) => row?.changed === true),
    nodeNameDeltaIds: deepFreeze(unique(deltas.map((row) => row?.deltaId))),
    correspondenceIds: deepFreeze(correspondenceIds),
    workflowStatuses: deepFreeze(unique(reviewRows.map((row) => row?.workflowStatus))),
    authorities: deepFreeze(unique(reviewRows.map((row) => row?.authority))),
    evidenceBases: deepFreeze(unique(reviewRows.map((row) => row?.identityEvidenceBasis))),
    methodABoundaryDiagnostics: deepFreeze(reviewRows.filter((row) => row?.methodABoundaryDiagnostics)
      .map((row) => deepFreeze({ correspondenceId: text(row.correspondenceId), ...row.methodABoundaryDiagnostics }))),
    reviewDecisions: deepFreeze(unique(reviewRows.map((row) => reviewDecision(row, context.reviewDecisionOverrides)))),
    writerActions: deepFreeze(unique(operations.map((operation) => operation?.action))),
    writerStatuses: deepFreeze(unique(operations.map((operation) => operation?.status))),
    reasons: reasonsFor(state, reviewRows),
  });
}
function countStates(rows) {
  const counts = { BOUND: 0, UNRESOLVED: 0, AMBIGUOUS: 0, UNEMITTED: 0 };
  for (const row of rows) if (Object.hasOwn(counts, row.state)) counts[row.state] += 1;
  return Object.freeze(counts);
}
function sourceSummary(sourceId, document, rows) {
  const declared = Number(document?.summary?.nodeCount);
  const declaredNodeCount = Number.isFinite(declared) ? declared : null;
  const states = countStates(rows);
  return deepFreeze({
    sourceId,
    sourceFileName: text(document?.fileName),
    declaredNodeCount,
    enumeratedNodeCount: rows.length,
    populationStatus: declaredNodeCount == null ? 'UNKNOWN' : (declaredNodeCount === rows.length ? 'MATCH' : 'MISMATCH'),
    ...states,
    qualifiedNodeNameChangeCount: rows.filter((row) => row.qualifiedNodeNameChange).length,
  });
}

export function buildCiiSourceTargetAudit(input = {}) {
  const members = memberPreviewById(input.memberPreviews);
  const sourceIds = [...members.keys()].sort();
  const rows = []; const bySource = [];
  for (const sourceId of sourceIds) {
    const preview = members.get(sourceId); const sourceDocument = preview?.sourceDocument;
    const sourceRows = documentNodeIds(sourceDocument).map((nodeId) => censusRow(sourceId, sourceDocument, input.targetDocument, nodeId, input));
    rows.push(...sourceRows); bySource.push(sourceSummary(sourceId, sourceDocument, sourceRows));
  }
  const states = countStates(rows);
  return deepFreeze({
    schema: CII_SOURCE_TARGET_AUDIT_SCHEMA,
    sourceSetSha256: text(input?.sourceSetSha256 || input?.sourceSet?.sourceSetSha256),
    target: deepFreeze({ fileName: text(input?.targetDocument?.fileName), contentSha256: text(input?.targetDocument?.contentSha256) }),
    rows: deepFreeze(rows),
    summary: deepFreeze({
      totalSourceNodes: rows.length,
      ...states,
      qualifiedNodeNameChangeCount: rows.filter((row) => row.qualifiedNodeNameChange).length,
      bySource: deepFreeze(bySource),
    }),
  });
}

function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
export function ciiSourceTargetAuditToCsv(audit) {
  const headers = ['sourceId', 'sourceFileName', 'sourceNodeId', 'sourceNodeName', 'state', 'confidence', 'targetNodeIds', 'targetNodeNames',
    'identityBound', 'nodeNameDifferent', 'qualifiedNodeNameChange', 'workflowStatuses', 'authorities', 'evidenceBases', 'reviewDecisions',
    'writerActions', 'writerStatuses', 'correspondenceIds', 'reasons', 'methodABoundaryDiagnostics'];
  const rows = (audit?.rows || []).map((row) => ({
    ...row,
    targetNodeIds: (row.targetNodeIds || []).join('|'), targetNodeNames: (row.targetNodeNames || []).join('|'),
    workflowStatuses: (row.workflowStatuses || []).join('|'), authorities: (row.authorities || []).join('|'),
    evidenceBases: (row.evidenceBases || []).join('|'), reviewDecisions: (row.reviewDecisions || []).join('|'),
    writerActions: (row.writerActions || []).join('|'), writerStatuses: (row.writerStatuses || []).join('|'),
    correspondenceIds: (row.correspondenceIds || []).join('|'), reasons: (row.reasons || []).join('|'),
    methodABoundaryDiagnostics: stableStringify(row.methodABoundaryDiagnostics || []),
  }));
  return [headers.join(','), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(','))].join('\n');
}

export function ciiSourceTargetAuditToJson(audit) { return stableStringify(audit); }

export const _test = Object.freeze({ documentNodeIds, nodeReviewRows, reviewDecision, stateFor, confidenceFor, countStates });
