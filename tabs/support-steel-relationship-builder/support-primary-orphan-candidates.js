import {
  evaluateOrphanRecoveryGeometry,
  positive,
} from './support-primary-orphan-geometry.js?v=20260929-support-primary-orphan-split-1';

const EPSILON = 1e-9;

export function evaluateOrphanSource(sourceGroup, sourceAssignment, context) {
  const evaluations = [];
  for (const targetGroup of context.locationGroups) {
    if (clean(targetGroup?.groupId) === clean(sourceGroup?.groupId)) continue;
    const targetAssignment = context.assignmentByGroupId.get(clean(targetGroup?.groupId)) || null;
    if (!eligibleTargetAssignment(targetAssignment)) continue;
    evaluations.push(evaluateOrphanCandidate(
      sourceGroup,
      sourceAssignment,
      targetGroup,
      targetAssignment,
      context,
    ));
  }
  const qualifying = evaluations.filter((row) => row.qualifies);
  const candidateIdentities = collapseCandidateIdentities(qualifying);
  const rejected = evaluations.filter((row) => !row.qualifies && Number.isFinite(row.normalizedScore))
    .sort(candidateEvaluationCompare);
  return Object.freeze({
    sourceGroupId: clean(sourceGroup?.groupId),
    sourceProvisionalAssemblyId: clean(sourceAssignment?.provisionalAssemblyId || sourceAssignment?.primarySupportAssemblyId),
    candidateIdentities: Object.freeze(candidateIdentities),
    nearestRejectedCandidate: rejected[0] ? freezeCandidateAudit(rejected[0]) : null,
    rejectionSummary: Object.freeze(rejectionSummary(evaluations)),
  });
}

export function evaluateOrphanCandidate(sourceGroup, sourceAssignment, targetGroup, targetAssignment, context) {
  const config = context.config;
  const sourceFamily = familyToken(sourceGroup?.secondarySupportFamilyId);
  const targetFamily = familyToken(targetGroup?.secondarySupportFamilyId);
  const sourcePipe = token(sourceGroup?.fullLineTag);
  const targetPipe = token(targetGroup?.fullLineTag);
  const familyAvailable = Boolean(sourceFamily && targetFamily);
  const pipeAvailable = Boolean(sourcePipe && targetPipe);
  const familyMatch = familyAvailable && sourceFamily === targetFamily;
  const pipeMatch = pipeAvailable && sourcePipe === targetPipe;
  const geometry = evaluateOrphanRecoveryGeometry(sourceGroup, targetGroup, config, context, pipeMatch);
  const sourceBoreMm = geometry.sourceBoreMm;
  const targetBoreMm = geometry.targetBoreMm;
  const boreAvailable = positive(sourceBoreMm) && positive(targetBoreMm);
  const boreMatch = boreAvailable && Math.abs(sourceBoreMm - targetBoreMm) <= EPSILON;
  const familyPass = !config.requireSameFamily || (familyAvailable && familyMatch);
  const pipePass = !config.requireSamePipe || (pipeAvailable && pipeMatch);
  const borePass = !config.requireSameBore || (boreAvailable && boreMatch);
  const branchOverridePass = !geometry.branches.different || (
    config.requireSameFamily && config.requireSamePipe && config.requireSameBore
    && familyMatch && pipeMatch && boreMatch
  );
  const qualifies = config.enabled && familyPass && pipePass && borePass && branchOverridePass
    && geometry.pointAvailable && positive(geometry.boreForToleranceMm)
    && Boolean(geometry.axisModel?.trusted) && geometry.geometryPass;
  const targetKind = targetAssignment?.status === 'EXPLICIT_ASSEMBLY' ? 'EXPLICIT' : 'GEOMETRY';
  const targetAssemblyId = targetKind === 'EXPLICIT'
    ? clean(targetAssignment?.primarySupportAssemblyId)
    : clean(targetAssignment?.provisionalAssemblyId || targetAssignment?.primarySupportAssemblyId);
  const targetIdentity = targetKind === 'EXPLICIT'
    ? `EXPLICIT::${targetAssemblyId}`
    : `GEOMETRY::${clean(targetGroup?.groupId)}`;
  const normalizedScore = geometry.metrics
    && positive(geometry.recoveryAxialToleranceMm) && positive(geometry.recoveryLateralToleranceMm)
    ? Math.max(
      geometry.metrics.axialMm / geometry.recoveryAxialToleranceMm,
      geometry.metrics.lateralMm / geometry.recoveryLateralToleranceMm,
    )
    : Number.POSITIVE_INFINITY;
  return Object.freeze({
    sourceGroupId: clean(sourceGroup?.groupId),
    sourceAssemblyId: clean(sourceAssignment?.provisionalAssemblyId || sourceAssignment?.primarySupportAssemblyId),
    targetGroupId: clean(targetGroup?.groupId),
    targetFamilyId: clean(targetGroup?.secondarySupportFamilyId),
    targetKind,
    targetAssemblyId,
    targetIdentity,
    qualifies,
    normalizedScore,
    familyAvailable,
    familyMatch,
    familyPass,
    pipeAvailable,
    pipeMatch,
    pipePass,
    boreAvailable,
    boreMatch,
    borePass,
    branchRelationship: geometry.branches.status,
    branchOverridePass,
    pointAvailable: geometry.pointAvailable,
    sourceBoreMm,
    targetBoreMm,
    toleranceBoreMm: geometry.boreForToleranceMm,
    axisBasis: geometry.axisModel?.basis || 'UNAVAILABLE',
    axisConfidenceRatio: Number.isFinite(geometry.axisModel?.confidenceRatio) ? geometry.axisModel.confidenceRatio : null,
    axialMm: geometry.metrics?.axialMm ?? null,
    lateralMm: geometry.metrics?.lateralMm ?? null,
    baseAxialToleranceMm: geometry.baseAxialToleranceMm,
    baseLateralToleranceMm: geometry.baseLateralToleranceMm,
    recoveryAxialToleranceMm: geometry.recoveryAxialToleranceMm,
    recoveryLateralToleranceMm: geometry.recoveryLateralToleranceMm,
    geometryPass: geometry.geometryPass,
    rejectionReasons: Object.freeze(candidateRejectionReasons({
      config,
      familyPass,
      pipePass,
      borePass,
      branchOverridePass,
      pointAvailable: geometry.pointAvailable,
      boreForToleranceMm: geometry.boreForToleranceMm,
      axisModel: geometry.axisModel,
      geometryPass: geometry.geometryPass,
    })),
  });
}

export function collapseCandidateIdentities(rows) {
  const byIdentity = new Map();
  for (const row of rows || []) {
    const key = row.targetIdentity;
    if (!key) continue;
    if (!byIdentity.has(key)) byIdentity.set(key, []);
    byIdentity.get(key).push(row);
  }
  return [...byIdentity.entries()].map(([targetIdentity, candidates]) => {
    const sorted = [...candidates].sort(candidateEvaluationCompare);
    const best = sorted[0];
    return Object.freeze({
      targetIdentity,
      targetKind: best.targetKind,
      targetAssemblyId: best.targetAssemblyId,
      targetFamilyId: best.targetFamilyId,
      targetGroupIds: Object.freeze(unique(sorted.map((row) => row.targetGroupId)).sort()),
      familyMatch: best.familyMatch,
      pipeMatch: best.pipeMatch,
      boreMatch: best.boreMatch,
      branchRelationship: best.branchRelationship,
      axisBasis: best.axisBasis,
      axisConfidenceRatio: best.axisConfidenceRatio,
      axialMm: best.axialMm,
      lateralMm: best.lateralMm,
      baseAxialToleranceMm: best.baseAxialToleranceMm,
      baseLateralToleranceMm: best.baseLateralToleranceMm,
      recoveryAxialToleranceMm: best.recoveryAxialToleranceMm,
      recoveryLateralToleranceMm: best.recoveryLateralToleranceMm,
      normalizedScore: best.normalizedScore,
    });
  }).sort((left, right) => left.normalizedScore - right.normalizedScore
    || left.targetIdentity.localeCompare(right.targetIdentity));
}

function freezeCandidateAudit(row) {
  return Object.freeze({
    targetIdentity: row.targetIdentity,
    targetKind: row.targetKind,
    targetAssemblyId: row.targetAssemblyId,
    targetGroupId: row.targetGroupId,
    targetFamilyId: row.targetFamilyId,
    familyMatch: row.familyMatch,
    pipeMatch: row.pipeMatch,
    boreMatch: row.boreMatch,
    branchRelationship: row.branchRelationship,
    axisBasis: row.axisBasis,
    axisConfidenceRatio: row.axisConfidenceRatio,
    axialMm: row.axialMm,
    lateralMm: row.lateralMm,
    baseAxialToleranceMm: row.baseAxialToleranceMm,
    baseLateralToleranceMm: row.baseLateralToleranceMm,
    recoveryAxialToleranceMm: row.recoveryAxialToleranceMm,
    recoveryLateralToleranceMm: row.recoveryLateralToleranceMm,
    normalizedScore: row.normalizedScore,
    rejectionReasons: row.rejectionReasons,
  });
}

function candidateRejectionReasons(input) {
  const rows = [];
  if (!input.config.enabled) rows.push('ORPHAN_RECOVERY_DISABLED');
  if (!input.familyPass) rows.push('FAMILY_GATE_FAILED');
  if (!input.pipePass) rows.push('PIPE_GATE_FAILED');
  if (!input.borePass) rows.push('BORE_GATE_FAILED');
  if (!input.branchOverridePass) rows.push('BRANCH_OVERRIDE_GUARDS_FAILED');
  if (!input.pointAvailable) rows.push('POINT_EVIDENCE_UNAVAILABLE');
  if (!positive(input.boreForToleranceMm)) rows.push('BORE_EVIDENCE_UNAVAILABLE');
  if (!input.axisModel?.trusted) rows.push('AXIS_EVIDENCE_UNAVAILABLE');
  if (input.axisModel?.trusted && !input.geometryPass) rows.push('RECOVERY_WINDOW_FAILED');
  return rows;
}

function rejectionSummary(rows) {
  const counts = {};
  for (const row of rows || []) {
    if (row.qualifies) continue;
    for (const reason of row.rejectionReasons || []) counts[reason] = (counts[reason] || 0) + 1;
  }
  return counts;
}

function eligibleTargetAssignment(assignment) {
  return assignment?.status === 'EXPLICIT_ASSEMBLY' || assignment?.status === 'GEOMETRY_ONLY';
}
function candidateEvaluationCompare(left, right) {
  return left.normalizedScore - right.normalizedScore
    || left.targetIdentity.localeCompare(right.targetIdentity)
    || left.targetGroupId.localeCompare(right.targetGroupId);
}
function familyToken(value) { return token(value).replace(/\.(?:\d+)$/u, ''); }
function token(value) { return clean(value).replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase(); }
function clean(value) { return value == null ? '' : String(value).trim(); }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }
