import { stableStringify, uniqueStrings } from './cii-workspace-contracts.js';

function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function rowSource(row) { return row.sourceNodeId || row.sourceComponentId || (row.sourceElementIds || [row.sourceElementId]).filter(Boolean).join('|') || ''; }
function rowTarget(row) { return row.targetNodeId || row.targetComponentId || (row.targetElementIds || []).filter(Boolean).join('|') || ''; }
function rowOperation(row) {
  if (row.status === 'INSERTED') return 'INSERT_TARGET';
  if (row.status === 'DELETED') return 'DELETE_SOURCE';
  if (row.kind === 'ELEMENT_PATH' && (row.targetElementIds || []).length > 1) return 'SOURCE_1_TO_TARGET_N';
  return row.sourceNodeId || row.sourceComponentId || row.sourceElementId || row.sourceElementIds?.length ? 'MATCH' : 'UNRESOLVED';
}
function reviewDecision(row, review) {
  if (row.status === 'LOCKED') return 'LOCKED';
  const id = row.correspondenceId;
  if ((review?.rejectedCorrespondenceIds || []).includes(id)) return 'REJECTED';
  if ((review?.lockedCorrespondenceIds || []).includes(id)) return 'LOCKED';
  if ((review?.reviewedCorrespondenceIds || []).includes(id)) return 'ACCEPTED';
  return 'UNREVIEWED';
}
function transferFields(row, transferPlan) {
  const operations = (transferPlan?.operations || [])
    .filter((item) => item.matchAuthority?.correspondenceId === row.correspondenceId)
    .sort((a, b) => String(a.operationId).localeCompare(String(b.operationId)));
  return {
    properties: uniqueStrings(operations.map((item) => item.property)).join('|'),
    custodies: uniqueStrings(operations.map((item) => item.custody)).join('|'),
    statuses: uniqueStrings(operations.map((item) => item.status)).join('|'),
    blockers: uniqueStrings(operations.flatMap((item) => item.blockers || [])).join('|'),
  };
}
function reviewProjection(row, compareReview) {
  return (compareReview?.rows || []).find((item) => item.correspondenceId === row.correspondenceId) || null;
}
function sourceMember(row, sourceSet) {
  const id = String(row?.sourceId || '');
  if (!id) return null;
  return (sourceSet?.members || []).find((member) => String(member?.sourceId || '') === id) || null;
}

export function correspondenceRowsToCsv(correspondence, context = {}) {
  const targetFileName = context?.targetDocument?.fileName || '';
  const targetOriginalSha256 = context?.targetAuthority?.originalSha256 || '';
  const operationsByCorrespondenceId = new Map();
  for (const item of context?.transferPlan?.operations || []) {
    const id = item?.matchAuthority?.correspondenceId;
    if (!id) continue;
    let list = operationsByCorrespondenceId.get(id);
    if (!list) { list = []; operationsByCorrespondenceId.set(id, list); }
    list.push(item);
  }
  const reviewProjectionByCorrespondenceId = new Map();
  for (const item of context?.compareReview?.rows || []) {
    if (item?.correspondenceId) reviewProjectionByCorrespondenceId.set(item.correspondenceId, item);
  }
  const rows = [
    ...(correspondence?.nodeRows || []),
    ...(correspondence?.elementRows || []),
    ...(correspondence?.componentRows || []),
  ].map((row) => {
    const directOps = operationsByCorrespondenceId.get(row.correspondenceId);
    const operations = directOps
      ? [...directOps].sort((a, b) => String(a.operationId).localeCompare(String(b.operationId)))
      : (context?.transferPlan ? [] : (context?.transferPlan?.operations || [])
        .filter((item) => item.matchAuthority?.correspondenceId === row.correspondenceId)
        .sort((a, b) => String(a.operationId).localeCompare(String(b.operationId))));
    const transfer = {
      properties: uniqueStrings(operations.map((item) => item.property)).join('|'),
      custodies: uniqueStrings(operations.map((item) => item.custody)).join('|'),
      statuses: uniqueStrings(operations.map((item) => item.status)).join('|'),
      blockers: uniqueStrings(operations.flatMap((item) => item.blockers || [])).join('|'),
    };
    const projection = reviewProjectionByCorrespondenceId.get(row.correspondenceId) || reviewProjection(row, context.compareReview);
    const member = sourceMember(row, context.sourceSet);
    return {
      kind: row.kind,
      sourceId: row.sourceId || '',
      sourceFileName: member?.fileName || '',
      sourceOriginalSha256: member?.originalSha256 || '',
      targetFileName,
      targetOriginalSha256,
      operation: rowOperation(row),
      confidence: projection?.confidence || row.status,
      workflowStatus: row.status,
      source: rowSource(row),
      target: rowTarget(row),
      correspondenceId: row.correspondenceId,
      authority: row.authority || '',
      reviewDecision: reviewDecision(row, context.review),
      engineeringChangeCount: projection?.changeCount || 0,
      engineeringChangeFamilies: (projection?.changeFamilies || []).join('|'),
      evidence: row.evidence ? stableStringify(row.evidence) : '',
      transferProperties: transfer.properties,
      transferCustodies: transfer.custodies,
      transferStatuses: transfer.statuses,
      blockers: transfer.blockers,
    };
  });
  const headers = ['kind', 'sourceId', 'sourceFileName', 'sourceOriginalSha256', 'targetFileName', 'targetOriginalSha256', 'operation', 'confidence', 'workflowStatus', 'source', 'target', 'correspondenceId', 'authority', 'reviewDecision', 'engineeringChangeCount', 'engineeringChangeFamilies', 'evidence', 'transferProperties', 'transferCustodies', 'transferStatuses', 'blockers'];
  return [headers.join(','), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(','))].join('\n');
}

export function ciiWorkspaceAuditToJson(audit) {
  return stableStringify(audit);
}

export function ciiWorkspaceArtifactBundle(result) {
  let _csv = undefined;
  let _json = undefined;
  const bundle = {
    get correspondenceCsv() {
      if (_csv === undefined) {
        const review = result?.audit?.review || result?.review || {};
        const sourceSet = result?.sourceSet || result?.audit?.sourceSet || null;
        const targetDocument = result?.targetAuthority ? result?.targetDocument || null : null;
        const targetAuthority = result?.targetAuthority || null;
        _csv = correspondenceRowsToCsv(result?.correspondence, {
          review,
          sourceSet,
          targetDocument,
          targetAuthority,
          transferPlan: result?.transferPlan,
          compareReview: result?.compareReview,
        });
      }
      return _csv;
    },
    get auditJson() {
      if (_json === undefined) {
        _json = ciiWorkspaceAuditToJson(result?.audit);
      }
      return _json;
    },
    modifiedTargetCii: null,
  };
  return Object.freeze(bundle);
}
