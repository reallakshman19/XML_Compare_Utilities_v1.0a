import { deepFreeze } from './cii-workspace-contracts.js';

function riskyRows(correspondence) {
  return (correspondence?.elementRows || []).filter((row) => ['REVIEW', 'UNRESOLVED', 'CONFLICT'].includes(row.status));
}

function rowSourceIds(row) {
  return row.sourceElementIds || (row.sourceElementId ? [row.sourceElementId] : []);
}

function uniqueNodeRows(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    const previous = byId.get(row.correspondenceId);
    if (!previous || row.status === 'LOCKED' || previous.status !== 'LOCKED') byId.set(row.correspondenceId, row);
  }
  return [...byId.values()].sort((a, b) => String(a.correspondenceId).localeCompare(String(b.correspondenceId), undefined, { numeric: true }));
}

function rowTargetIds(row) {
  return row.targetElementIds || (row.targetElementId ? [row.targetElementId] : []);
}

function highIdentityEvidence(evidence) {
  return evidence?.identitySupported === true && evidence?.identityConfidence === 'HIGH';
}

function qualifiedMethodABoundaryIdentity(correspondence, row) {
  if (correspondence?.status !== 'READY') return false;
  if ((correspondence?.conflicts || []).length || (correspondence?.targetCustodyConflicts || []).length) return false;
  if (row?.kind !== 'NODE' || row?.status !== 'REVIEW') return false;
  if (!['METHOD_A_SPATIAL', 'METHOD_A_AND_B'].includes(row?.basisMethod)) return false;
  const evidence = row?.evidence;
  if (evidence?.identitySupported !== true || !['HIGH', 'MEDIUM'].includes(evidence?.identityConfidence)) return false;
  if (evidence?.identityEvidenceBasis !== 'METHOD_A_QUALIFIED_ADJACENT_BOUNDARY') return false;
  if (!highIdentityEvidence(evidence?.leftElement) || !highIdentityEvidence(evidence?.rightElement)) return false;
  return (evidence?.multiBaseProvenance || []).some((item) =>
    item?.method === 'METHOD_A_SPATIAL'
    && ['HIGH', 'MEDIUM'].includes(item?.baseConfidence)
    && item?.rowStatus === 'REVIEW'
    && item?.rowAuthority === 'ADJACENT_MATCH_BOUNDARY');
}
function qualifiedMethodABoundaryLocalIdentity(correspondence, row) {
  if (correspondence?.status !== 'READY') return false;
  if ((correspondence?.conflicts || []).length || (correspondence?.targetCustodyConflicts || []).length) return false;
  if (row?.kind !== 'NODE' || row?.status !== 'REVIEW') return false;
  if (!['METHOD_A_SPATIAL', 'METHOD_A_AND_B'].includes(row?.basisMethod)) return false;
  const evidence = row?.evidence;
  if (evidence?.identitySupported !== true || !['HIGH', 'MEDIUM'].includes(evidence?.identityConfidence)) return false;
  if (evidence?.identityEvidenceBasis !== 'METHOD_A_QUALIFIED_ADJACENT_BOUNDARY') return false;
  const boundary = evidence?.boundaryIdentity;
  if (boundary?.identitySupported !== true || boundary?.reason !== 'REGISTERED_ENDPOINT_M2_OD_SUPPORTED') return false;
  if (String(boundary?.sourceNodeId || '') !== String(row.sourceNodeId || '')) return false;
  if (String(boundary?.targetNodeId || '') !== String(row.targetNodeId || '')) return false;
  if (!Number.isFinite(Number(boundary?.supportCount)) || Number(boundary.supportCount) < 1) return false;
  if (!Array.isArray(boundary?.supportingSides) || boundary.supportingSides.length < 1) return false;
  return (evidence?.multiBaseProvenance || []).some((item) =>
    item?.method === 'METHOD_A_SPATIAL'
    && ['HIGH', 'MEDIUM'].includes(item?.baseConfidence)
    && item?.rowStatus === 'REVIEW'
    && item?.rowAuthority === 'ADJACENT_MATCH_BOUNDARY');
}

function qualifiedMethodABaseAnchorIdentity(correspondence, row) {
  if (correspondence?.status !== 'READY') return false;
  if ((correspondence?.conflicts || []).length || (correspondence?.targetCustodyConflicts || []).length) return false;
  if (row?.kind !== 'NODE' || row?.status !== 'REVIEW') return false;
  if (!['METHOD_A_SPATIAL', 'METHOD_A_AND_B'].includes(row?.basisMethod)) return false;
  const evidence = row?.evidence;
  if (evidence?.identitySupported !== true || !['HIGH', 'MEDIUM'].includes(evidence?.identityConfidence)) return false;
  if (evidence?.identityEvidenceBasis !== 'METHOD_A_QUALIFIED_BASE_ANCHOR') return false;
  return (evidence?.multiBaseProvenance || []).some((item) =>
    item?.method === 'METHOD_A_SPATIAL'
    && ['HIGH', 'MEDIUM'].includes(item?.baseConfidence)
    && item?.rowStatus === 'REVIEW'
    && item?.rowAuthority === 'METHOD_A_QUALIFIED_ANCHOR');
}

function winnerGapOnlyReview(row) {
  if (row?.status !== 'REVIEW') return false;
  const candidates = row?.evidence?.candidates;
  if (candidates?.status !== 'AMBIGUOUS' || candidates?.winnerIdentityConfidence !== 'HIGH') return false;
  if (candidates?.methodWinners?.disagree !== false) return false;
  const targets = rowTargetIds(row).map(String);
  if (targets.length !== 1 || String(candidates?.winnerTargetElementId || '') !== targets[0]) return false;
  const reasons = [...(candidates?.reasons || [])];
  return reasons.length === 1 && reasons[0] === 'WINNER_GAP_NOT_SATISFIED';
}

function reviewOnlyAmbiguousElement(row) {
  return row?.status === 'REVIEW'
    && row?.evidence?.hardFail !== true
    && row?.evidence?.candidates?.status === 'AMBIGUOUS';
}

function preservesQualifiedMethodAIdentity(correspondence, row, affectedRows) {
  if (affectedRows.length < 1) return false;
  if (qualifiedMethodABoundaryLocalIdentity(correspondence, row)) {
    return affectedRows.every(reviewOnlyAmbiguousElement);
  }
  return (qualifiedMethodABoundaryIdentity(correspondence, row)
      || qualifiedMethodABaseAnchorIdentity(correspondence, row))
    && affectedRows.every(winnerGapOnlyReview);
}

export function applyCiiNodeCustodyGates(correspondence, sourceGraph) {
  const risky = riskyRows(correspondence);
  const riskyIds = new Set(risky.flatMap(rowSourceIds));
  const nodeRows = uniqueNodeRows(correspondence?.nodeRows).map((row) => {
    if (!riskyIds.size || row.status === 'LOCKED' || !row.sourceNodeId) return row;
    const incident = sourceGraph?.adjacency?.get(String(row.sourceNodeId)) || [];
    const affected = incident.filter((edge) => riskyIds.has(edge.elementId)).map((edge) => edge.elementId).sort();
    if (!affected.length) return row;
    const affectedRows = risky.filter((item) => rowSourceIds(item).some((id) => affected.includes(id)));
    if (preservesQualifiedMethodAIdentity(correspondence, row, affectedRows)) return row;
    const linkedCandidates = affectedRows.map((item) => Object.freeze({
      correspondenceId: item.correspondenceId,
      status: item.status,
      candidates: item.evidence?.candidates || null,
    }));
    return deepFreeze({
      ...row,
      status: row.status === 'CONFLICT' ? 'CONFLICT' : 'REVIEW',
      evidence: deepFreeze({
        ...(row.evidence || {}),
        nodeCustodyGate: Object.freeze({
          status: 'REVIEW_REQUIRED', blocker: 'ADJACENT_ELEMENT_CANDIDATE_AMBIGUITY',
          sourceElementIds: Object.freeze(affected), linkedCandidateEvidence: Object.freeze(linkedCandidates),
        }),
      }),
    });
  });
  return deepFreeze({ ...correspondence, nodeRows: Object.freeze(nodeRows) });
}
