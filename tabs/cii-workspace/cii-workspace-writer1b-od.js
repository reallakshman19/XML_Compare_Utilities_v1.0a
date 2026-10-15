function sameNumber(a, b, tolerance) {
  const left = Number(a); const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right)
    && Math.abs(left - right) <= Math.max(tolerance, Math.abs(right) * 1e-12);
}
function remainingDiameters(context, currentDiameter, tolerance) {
  const values = (context?.diameters || []).map(Number).filter(Number.isFinite);
  if (!values.length) return null;
  const index = values.findIndex((value) => sameNumber(value, currentDiameter, tolerance));
  if (index < 0) return null;
  return [...values.slice(0, index), ...values.slice(index + 1)];
}
function endpointClosed(context, currentTargetDiameter, proposedDiameter, tolerance) {
  const remaining = remainingDiameters(context, currentTargetDiameter, tolerance);
  return remaining != null && remaining.every((value) => sameNumber(value, proposedDiameter, tolerance));
}

export function ciiWriter1BOdEligibility(source, target, options = {}) {
  const tolerance = Number(options.engineeringNumericTolerance ?? 1e-9); const blockers = [];
  if (source?.componentKind !== 'PIPE' || target?.componentKind !== 'PIPE') blockers.push('OD_WRITER_1B_PLAIN_PIPE_REQUIRED');
  if (Number(source?.auxiliaryPointers?.reducer || 0) !== 0) blockers.push('OD_SOURCE_REDUCER_POINTER_PRESENT');
  if (Number(target?.auxiliaryPointers?.reducer || 0) !== 0) blockers.push('OD_TARGET_REDUCER_POINTER_PRESENT');
  if (!source?.fromContext || !source?.toContext || !target?.fromContext || !target?.toContext) blockers.push('OD_TOPOLOGY_CONTEXT_REQUIRED');
  if (source?.fromContext?.sizeTransition || source?.toContext?.sizeTransition) blockers.push('OD_SOURCE_SIZE_TRANSITION_NOT_SINGLE_FIELD_SAFE');
  const proposed = Number(source?.diameter); const before = Number(target?.diameter);
  if (Number.isFinite(proposed) && Number.isFinite(before)) {
    if (target?.fromContext && !endpointClosed(target.fromContext, before, proposed, tolerance)) blockers.push('OD_TARGET_FROM_RUN_NOT_CLOSED');
    if (target?.toContext && !endpointClosed(target.toContext, before, proposed, tolerance)) blockers.push('OD_TARGET_TO_RUN_NOT_CLOSED');
  } else blockers.push('OD_NUMERIC_EVIDENCE_REQUIRED');
  return Object.freeze([...new Set(blockers)]);
}
