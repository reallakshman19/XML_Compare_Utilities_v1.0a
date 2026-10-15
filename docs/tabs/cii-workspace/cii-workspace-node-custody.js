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

export function applyCiiNodeCustodyGates(correspondence, sourceGraph) {
  const risky = riskyRows(correspondence);
  const riskyIds = new Set(risky.flatMap(rowSourceIds));
  const nodeRows = uniqueNodeRows(correspondence?.nodeRows).map((row) => {
    if (!riskyIds.size || row.status === 'LOCKED' || !row.sourceNodeId) return row;
    const incident = sourceGraph?.adjacency?.get(String(row.sourceNodeId)) || [];
    const affected = incident.filter((edge) => riskyIds.has(edge.elementId)).map((edge) => edge.elementId).sort();
    if (!affected.length) return row;
    const linkedCandidates = risky.filter((item) => rowSourceIds(item).some((id) => affected.includes(id))).map((item) => Object.freeze({
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
