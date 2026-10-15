import { deepFreeze, stableId } from './cii-workspace-contracts.js';

function edgeMap(graph) { return new Map((graph?.edges || []).map((edge) => [edge.elementId, edge])); }
function pointerBound(edge) { return edge?.rigidEvidence?.status === 'POINTER_BOUND_RECORD' && Number(edge.rigidEvidence.pointer) > 0; }

export function attachCiiComponentCorrespondence(correspondence, sourceGraph, targetGraph) {
  const sourceEdges = edgeMap(sourceGraph); const targetEdges = edgeMap(targetGraph); const componentRows = [];
  for (const row of correspondence?.elementRows || []) {
    const sourceId = row.sourceElementId || (row.sourceElementIds?.length === 1 ? row.sourceElementIds[0] : null);
    const targetId = row.targetElementIds?.length === 1 ? row.targetElementIds[0] : null;
    const source = sourceEdges.get(sourceId); const target = targetEdges.get(targetId);
    if (!source || !target || source.componentKind !== 'RIGID' || target.componentKind !== 'RIGID') continue;
    const sourceBound = pointerBound(source); const targetBound = pointerBound(target);
    const blockers = [];
    if (!sourceBound || !targetBound) blockers.push('RIGID_COMPONENT_POINTER_CUSTODY_UNAVAILABLE');
    const sourceComponentId = sourceBound ? `RIGID_PTR@${source.rigidEvidence.pointer}` : null;
    const targetComponentId = targetBound ? `RIGID_PTR@${target.rigidEvidence.pointer}` : null;
    componentRows.push(deepFreeze({
      correspondenceId: stableId('component', 'RIGID', sourceId, targetId),
      kind: 'COMPONENT', componentKind: 'RIGID', sourceElementId: sourceId, targetElementIds: Object.freeze([targetId]),
      sourceComponentId, targetComponentId,
      status: blockers.length ? 'CONFLICT' : row.status,
      authority: 'POINTER_BOUND_RIGID_COMPONENT_CONTEXT',
      parentElementCorrespondenceId: row.correspondenceId,
      evidence: deepFreeze({
        source: source.rigidEvidence, target: target.rigidEvidence,
        sourceLengthMm: source.lengthMm, targetLengthMm: target.lengthMm,
        blockers: Object.freeze(blockers),
      }),
    }));
  }
  return deepFreeze({ ...correspondence, componentRows: Object.freeze(componentRows) });
}
