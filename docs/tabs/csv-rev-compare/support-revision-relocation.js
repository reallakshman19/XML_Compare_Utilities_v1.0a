export const SUPPORT_REVISION_RELOCATION_SCHEMA = 'support-revision-relocation-evidence/v2-validated-axes';
export const SUPPORT_REVISION_RELOCATION_POLICY_V2 = Object.freeze({
  policyId: 'SUPPORT_REV_RELOCATION_V2',
  version: '2.1.0',
  minimumAnchors: 3,
  minimumValidatedAxes: 2,
  roundingToleranceMm: 1,
  relocationToleranceMm: 5,
  eligibleCardinalities: Object.freeze(['1->1', '1->N', 'N->1', 'N->M']),
});

/**
 * Relocation is a user-facing state only on an accepted lineage edge when the
 * revision frame is trusted and validated-axis evidence proves actual movement.
 * Common-support anchors retain the same gate plus their persistent-reference
 * continuity requirement in the event layer.
 *
 * Movement is classified only from axes validated by the revision frame. A
 * HIGH_RESIDUAL axis is retained in the audit receipt but cannot trigger the
 * relocation decision.
 */
export function assessRelocationEvidence(source, target, edge, coordinateFrame, policy = SUPPORT_REVISION_RELOCATION_POLICY_V2) {
  const rawCoordinate = edge?.coordinateEvidence?.find((item) =>
    item.sourceNodeId === source?.nodeId && item.targetNodeId === target?.nodeId) || null;
  const validatedAxes = Object.entries(coordinateFrame?.axes || {})
    .filter(([, axis]) => axis?.status === 'VALIDATED')
    .map(([axis]) => axis);
  const minimumAnchors = Math.max(Number(coordinateFrame?.scoreMinimumAnchors || 0), Number(policy.minimumAnchors || 0));
  const anchorCount = Number(coordinateFrame?.anchorCount || 0);
  const frameTrusted = Boolean(coordinateFrame?.scoreFrameUsable)
    && anchorCount >= minimumAnchors
    && validatedAxes.length >= Number(policy.minimumValidatedAxes || 2);
  const structuralEligible = policy.eligibleCardinalities.includes(edge?.cardinality);
  const coordinate = validatedCoordinateEvidence(rawCoordinate, validatedAxes, policy);
  const relocated = structuralEligible && frameTrusted && coordinate?.classification === 'ACTUAL_POSITION_CHANGED';
  return Object.freeze({
    schema: SUPPORT_REVISION_RELOCATION_SCHEMA,
    policyId: policy.policyId,
    policyVersion: policy.version,
    relocated,
    structuralEligible,
    coordinate,
    frameTrusted,
    frameStatus: coordinateFrame?.status || 'UNPROVEN_DEFAULT',
    anchorCount,
    minimumAnchors,
    validatedAxes: Object.freeze(validatedAxes),
    excludedAxes: Object.freeze(['x', 'y', 'z'].filter((axis) => !validatedAxes.includes(axis))),
    reasonCodes: Object.freeze(reasonCodes({ relocated, structuralEligible, frameTrusted, coordinate })),
  });
}

function validatedCoordinateEvidence(rawCoordinate, validatedAxes, policy) {
  if (!rawCoordinate) return null;
  const validatedDeltas = Object.freeze(Object.fromEntries(['x', 'y', 'z'].map((axis) => [
    axis,
    validatedAxes.includes(axis) && Number.isFinite(rawCoordinate.deltas?.[axis]) ? rawCoordinate.deltas[axis] : null,
  ])));
  const finite = Object.values(validatedDeltas).filter(Number.isFinite);
  const validatedResidualMm = finite.length
    ? Math.sqrt(finite.reduce((sum, value) => sum + (value * value), 0))
    : null;
  const classification = classify(rawCoordinate.rawChanged, validatedResidualMm, policy);
  return Object.freeze({
    ...rawCoordinate,
    allAxisClassification: rawCoordinate.classification,
    allAxisResidualMm: rawCoordinate.residualMm,
    validatedDeltas,
    validatedResidualMm,
    residualMm: validatedResidualMm,
    classification,
  });
}

function classify(rawChanged, residualMm, policy) {
  if (rawChanged && residualMm != null && residualMm <= policy.roundingToleranceMm) return 'FORMAT_CHANGED';
  if (residualMm != null && residualMm <= policy.relocationToleranceMm) return residualMm > policy.roundingToleranceMm ? 'ROUNDING_ONLY' : 'UNCHANGED';
  if (residualMm != null) return 'ACTUAL_POSITION_CHANGED';
  return rawChanged ? 'FORMAT_CHANGED' : 'UNCHANGED';
}

function reasonCodes({ relocated, structuralEligible, frameTrusted, coordinate }) {
  if (!structuralEligible) return ['LOCATION_CARDINALITY_NOT_ELIGIBLE'];
  if (!frameTrusted) return ['UNTRUSTED_COORDINATE_FRAME'];
  if (relocated) return ['TRUSTED_COORDINATE_FRAME', 'VALIDATED_AXES_ONLY', 'NORMALIZED_POSITION_CHANGED'];
  return ['TRUSTED_COORDINATE_FRAME', 'VALIDATED_AXES_ONLY', coordinate?.classification || 'NO_COORDINATE_EVIDENCE'];
}

export const _test = Object.freeze({ validatedCoordinateEvidence, classify, reasonCodes });
