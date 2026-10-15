import {
  buildGeometryAuthorityRoute,
  buildRawBendCandidates,
} from './pipeline-3d-model-bend-route.js?v=20260721-bend-policy-v3-1';
import { resolveBendCandidateSet } from './pipeline-3d-model-bend-resolution.js?v=20260721-bend-policy-v3-1';
import { calculateElasticBendScreening } from './pipeline-3d-model-bend-screening.js?v=20260721-p3d-meta-phase1-1';

export { calculateElasticBendScreening } from './pipeline-3d-model-bend-screening.js?v=20260721-p3d-meta-phase1-1';
export { buildGeometryAuthorityRoute } from './pipeline-3d-model-bend-route.js?v=20260721-bend-policy-v3-1';

export function resolvePipelineElasticBends({
  points = [],
  coordinateRows = [],
  branchInfo = {},
  settings = {},
} = {}) {
  const screening = calculateElasticBendScreening(settings, branchInfo);
  const geometryRoute = buildGeometryAuthorityRoute(points, coordinateRows);
  const rawCandidates = buildRawBendCandidates(geometryRoute.entries, screening);
  const resolved = resolveBendCandidateSet(
    rawCandidates,
    geometryRoute.coordinateRows,
    screening,
  );
  const diagnostics = Object.freeze({
    candidateCount: resolved.candidates.length,
    emittedCount: resolved.emitted.length,
    feasibleCount: resolved.candidates.filter((candidate) => candidate.geometryFits).length,
    omittedCount: resolved.candidates.filter((candidate) => ![
      'EMITTED',
      'READY_NOT_EMITTED',
      'DISABLED',
    ].includes(candidate.status)).length,
    blockedCount: resolved.errors.length,
    sharedSegmentFailureCount: resolved.shared.failures.length,
    excludedMarkerCount: geometryRoute.excludedMarkerCount,
    ignoredShortSegmentCount: resolved.ignoredShortSegmentCount,
  });
  return Object.freeze({
    schema: 'PipelineBendResolution.v3',
    screening,
    candidates: resolved.candidates,
    bendByIncomingElementIndex: Object.freeze(Object.fromEntries(
      resolved.emitted.map((candidate) => [candidate.incomingElementIndex, candidate]),
    )),
    geometryRows: geometryRoute.coordinateRows,
    geometryPoints: geometryRoute.points,
    sharedSegmentFailures: resolved.shared.failures,
    warnings: resolved.warnings,
    errors: resolved.errors,
    hasBlockingErrors: resolved.errors.length > 0,
    diagnostics,
  });
}

function value(input, digits = 3) {
  return Number.isFinite(Number(input)) ? Number(input).toFixed(digits) : '';
}

export function buildElasticBendLedgerText(resolution) {
  const header = [
    'BendId', 'RequestedDesignBasis', 'ResolvedDesignBasis', 'ProfileFallbackApplied',
    'ProfileResolutionReason', 'SourceBasis', 'GeometricClass', 'BendClass',
    'ClassificationReason', 'RadiusBasis', 'PreviousNode', 'CornerNode', 'NextNode',
    'ClassificationPreviousNode', 'ClassificationNextNode', 'PlanAngleDeg',
    'ProfileAngleDeg', 'TurnAngleDeg', 'RadiusMm', 'RadiusD', 'TangentMm',
    'IncomingLengthMm', 'OutgoingLengthMm', 'IgnoredSegments', 'IgnoredNodes',
    'IgnoredLengthMm', 'NearNode', 'MidNode', 'Status', 'GreNominalBoreMm',
    'GreBendRadiusMm', 'GreBendBreakBasis', 'GreBendBreakMultiplierBore',
    'GreBendBreakLengthMm', 'GreBendLocalThicknessMm', 'GreTeeBreakBasis',
    'GreTeeBreakLengthMm', 'GreTeeLocalThicknessMm', 'GreRequirementReference',
    'GreGeometryApplied', 'GreInputXmlApplied',
  ];
  const settings = resolution?.screening?.settings || {};
  const gre = resolution?.screening?.grePlaceholder || {};
  const rows = (resolution?.candidates || []).map((item) => {
    const near = item.curvatureNodes?.find((node) => node.role === 'NEAR_POINT')?.nodeNumber ?? '';
    const mid = item.curvatureNodes?.find((node) => node.role === 'MIDPOINT')?.nodeNumber ?? '';
    return [
      item.id, settings.requestedDesignBasis, item.designBasis, settings.profileFallbackApplied,
      settings.profileResolutionReason, item.sourceBasis, item.classification, item.bendClass,
      item.classificationReason, item.radiusBasis, item.previousNode, item.cornerNode,
      item.nextNode, item.classificationPreviousNode, item.classificationNextNode,
      value(item.planAngleDeg), value(item.profileAngleDeg), value(item.turnAngleDeg),
      value(item.radiusMm), value(item.radiusD), value(item.tangentMm),
      value(item.incomingLengthMm), value(item.outgoingLengthMm),
      item.ignoredSegmentIndexes.join(','), item.ignoredNodeNumbers.join(','),
      value(item.ignoredTotalLengthMm), near, mid, item.status,
      value(gre.bend?.nominalBoreMm), value(gre.bend?.radiusMm),
      gre.bend?.breakLengthBasis || '', value(gre.bend?.breakMultiplierBore),
      value(gre.bend?.breakLengthMm), value(gre.bend?.localThicknessMm),
      gre.tee?.breakLengthBasis || '', value(gre.tee?.breakLengthMm),
      value(gre.tee?.localThicknessMm), gre.requirementReference || '',
      gre.geometryApplied ? 'YES' : 'NO', gre.inputXmlApplied ? 'YES' : 'NO',
    ];
  });
  return [header, ...rows].map((row) => row.join('\t')).join('\n');
}
