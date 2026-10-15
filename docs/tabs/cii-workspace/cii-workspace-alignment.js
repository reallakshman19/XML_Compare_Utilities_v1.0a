import { deepFreeze, stableId } from './cii-workspace-contracts.js';
import { scoreCiiEdgeCandidate } from './cii-workspace-evidence.js';

function confidence(evidence) {
  if (evidence.hardFail) return 'CONFLICT';
  if (evidence.identityConfidence === 'HIGH') return 'HIGH';
  if (['MEDIUM', 'REVIEW'].includes(evidence.identityConfidence)) return 'REVIEW';
  return 'UNRESOLVED';
}

function elementRow(operation, options) {
  if (operation.op === 'MATCH') {
    const evidence = scoreCiiEdgeCandidate(operation.refEdge, operation.targetEdge, options);
    return deepFreeze({
      correspondenceId: stableId('element', operation.refEdge.elementId, operation.targetEdge.elementId),
      kind: 'ELEMENT',
      sourceElementId: operation.refEdge.elementId,
      targetElementIds: Object.freeze([operation.targetEdge.elementId]),
      status: confidence(evidence),
      authority: 'PATH_SEQUENCE_ALIGNMENT',
      evidence,
    });
  }
  if (operation.op === 'DELETE_REFERENCE') {
    return deepFreeze({
      correspondenceId: stableId('delete', operation.refEdge?.elementId),
      kind: 'ELEMENT',
      sourceElementId: operation.refEdge?.elementId || null,
      targetElementIds: Object.freeze([]),
      status: 'DELETED',
      authority: 'PATH_SEQUENCE_ALIGNMENT',
    });
  }
  if (operation.op === 'INSERT_TARGET') {
    return deepFreeze({
      correspondenceId: stableId('insert-element', operation.targetEdge?.elementId),
      kind: 'ELEMENT',
      sourceElementId: null,
      targetElementIds: Object.freeze(operation.targetEdge?.elementId ? [operation.targetEdge.elementId] : []),
      status: 'INSERTED',
      authority: 'PATH_SEQUENCE_ALIGNMENT',
    });
  }
  return null;
}

function boundaryRow(left, right, options) {
  if (left?.op !== 'MATCH' || right?.op !== 'MATCH') return null;
  const sourceNodeId = String(left.refEdge?.routeTo ?? '');
  const targetNodeId = String(left.targetEdge?.routeTo ?? '');
  if (!sourceNodeId || !targetNodeId) return null;
  if (String(right.refEdge?.routeFrom ?? '') !== sourceNodeId) return null;
  if (String(right.targetEdge?.routeFrom ?? '') !== targetNodeId) return null;
  const leftEvidence = scoreCiiEdgeCandidate(left.refEdge, left.targetEdge, options);
  const rightEvidence = scoreCiiEdgeCandidate(right.refEdge, right.targetEdge, options);
  if (leftEvidence.hardFail || rightEvidence.hardFail) return null;
  const status = leftEvidence.identityConfidence === 'HIGH' && rightEvidence.identityConfidence === 'HIGH' ? 'HIGH' : 'REVIEW';
  return deepFreeze({
    correspondenceId: stableId('node', sourceNodeId, targetNodeId),
    kind: 'NODE',
    sourceNodeId,
    targetNodeId,
    status,
    authority: 'ADJACENT_MATCH_BOUNDARY',
    evidence: Object.freeze({ leftElement: leftEvidence, rightElement: rightEvidence }),
  });
}

export function deriveCiiAlignmentCorrespondence(alignment, options = {}) {
  const operations = Array.isArray(alignment?.operations) ? alignment.operations : [];
  const elementRows = operations.map((operation) => elementRow(operation, options)).filter(Boolean);
  const nodeRows = [];
  for (let index = 0; index < operations.length - 1; index += 1) {
    const row = boundaryRow(operations[index], operations[index + 1], options);
    if (row && !nodeRows.some((item) => item.correspondenceId === row.correspondenceId)) nodeRows.push(row);
  }
  return deepFreeze({ elementRows: Object.freeze(elementRows), nodeRows: Object.freeze(nodeRows) });
}
