import {
  deleteProfileRowsCommand,
  moveTable2RowsCommand,
  moveTable3MarkerRowsCommand,
} from './pipeline-3d-model-cad-batch-commands.js';

function validEdits(detail = {}) {
  return Array.isArray(detail.edits) ? detail.edits.filter((edit) => edit?.id) : [];
}
function frozenIds(values = []) {
  return Object.freeze([...values].map(String));
}
function publish(controller, type, detail) {
  controller?.dispatchEvent?.(new CustomEvent(type, { detail: Object.freeze(detail) }));
}

export function executePipelineCadBatchMove(controller, detail = {}) {
  if (!controller?.model) return false;
  const edits = validEdits(detail); if (!edits.length) return false;
  const appliedEntityIds = frozenIds(edits.map((edit) => edit.id));
  const skippedEntityIds = Object.freeze([...(detail.skippedEntityIds || [])].map(String).sort());
  if (detail.graph === 'table2x' && detail.entityType === 'elevation-node') {
    const changed = controller.execute(moveTable2RowsCommand(controller.model, edits), 'move-table2-selection');
    publish(controller, 'batchSelectionResolved', { operation: 'TABLE2_ELEVATION', appliedEntityIds, skippedEntityIds });
    return changed;
  }
  if (detail.graph === 'table3x' && detail.entityType === 'marker') {
    const changed = controller.execute(moveTable3MarkerRowsCommand(controller.model, edits), 'move-table3-marker-selection');
    publish(controller, 'batchSelectionResolved', { operation: 'TABLE3_MARKER_POSITION', appliedEntityIds, skippedEntityIds });
    return changed;
  }
  publish(controller, 'batchMoveRejected', {
    code: 'TABLE3_DEPTH_BATCH_NOT_AUTHORIZED', graph: detail.graph || null,
    entityType: detail.entityType || null, skippedEntityIds: Object.freeze(edits.map((edit) => String(edit.id)).sort()),
  });
  return false;
}

export function executePipelineCadBatchDelete(controller, detail = {}) {
  if (!controller?.model) return false;
  const requested = [...new Set((detail.entityIds || []).map(String).filter(Boolean))];
  const ids = requested.filter((id) => controller.model.findRow?.(id));
  if (!ids.length) return false;
  const skippedEntityIds = Object.freeze(requested.filter((id) => !ids.includes(id)).sort());
  const changed = controller.execute(deleteProfileRowsCommand(controller.model, ids), 'delete-profile-selection');
  publish(controller, 'batchSelectionResolved', {
    operation: 'DELETE', appliedEntityIds: frozenIds(ids), skippedEntityIds,
  });
  return changed;
}

export function clearPipelineCadBatchOverrides(graph) {
  graph?.visualOverrides?.clear?.(); graph?.depthOverrides?.clear?.(); graph?.markerOverrides?.clear?.();
  if (graph) graph.groupDrag = null;
  graph?.render?.();
}

export const _test = Object.freeze({ frozenIds, validEdits });