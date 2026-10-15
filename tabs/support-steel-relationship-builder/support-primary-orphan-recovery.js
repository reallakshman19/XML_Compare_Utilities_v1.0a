import {
  axisSeparation,
  branchRelationship,
  buildOrphanRecoveryGeometryContext,
  buildPipeGeometryIndex,
  recoveryBoreMm,
  selectAxisModel,
  trustedPipeModel,
} from './support-primary-orphan-geometry.js?v=20260929-support-primary-orphan-split-1';
import {
  collapseCandidateIdentities,
  evaluateOrphanCandidate,
  evaluateOrphanSource,
} from './support-primary-orphan-candidates.js?v=20260929-support-primary-orphan-split-1';

export const SUPPORT_PRIMARY_ORPHAN_RECOVERY_SCHEMA = 'SupportPrimaryOrphanRecovery.v1';
export const SUPPORT_PRIMARY_ORPHAN_RECOVERY_PROFILE = 'SUPPORT_PRIMARY_ORPHAN_V1';
export const SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS = Object.freeze({
  enabled: true,
  axialMultiplier: 1,
  lateralMultiplier: 2,
  requireSameFamily: true,
  requireSamePipe: true,
  requireSameBore: true,
  requireUniqueTarget: true,
});

let runtimeConfig = SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS;

export function normalizeSupportPrimaryOrphanRecoveryConfig(input = {}) {
  return Object.freeze({
    enabled: booleanValue(input.enabled, SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS.enabled),
    axialMultiplier: nonNegative(input.axialMultiplier, SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS.axialMultiplier),
    lateralMultiplier: nonNegative(input.lateralMultiplier, SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS.lateralMultiplier),
    requireSameFamily: booleanValue(input.requireSameFamily, SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS.requireSameFamily),
    requireSamePipe: booleanValue(input.requireSamePipe, SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS.requireSamePipe),
    requireSameBore: booleanValue(input.requireSameBore, SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS.requireSameBore),
    requireUniqueTarget: true,
  });
}

export function setSupportPrimaryOrphanRecoveryRuntimeConfig(input = {}) {
  runtimeConfig = normalizeSupportPrimaryOrphanRecoveryConfig(input);
  return runtimeConfig;
}

export function supportPrimaryOrphanRecoveryRuntimeConfig() {
  return runtimeConfig;
}

export function resolveSupportPrimaryOrphans(input = {}) {
  const config = normalizeSupportPrimaryOrphanRecoveryConfig(
    input.config == null ? supportPrimaryOrphanRecoveryRuntimeConfig() : input.config,
  );
  const locationGroups = Array.isArray(input.locationGroups) ? input.locationGroups : [];
  const assignments = Array.isArray(input.reconciliation?.assignments)
    ? input.reconciliation.assignments : [];
  const assignmentByGroupId = new Map(assignments.map((row) => [clean(row?.groupId), row]));
  const groupById = new Map(locationGroups.map((row) => [clean(row?.groupId), row]));
  const evidenceRows = locationGroups.flatMap((group) => Array.isArray(group?.evidenceRows) ? group.evidenceRows : []);
  const geometryContext = buildOrphanRecoveryGeometryContext(evidenceRows);
  const context = Object.freeze({
    config,
    locationGroups,
    assignmentByGroupId,
    groupById,
    ...geometryContext,
  });

  const sourceEvaluations = new Map();
  for (const group of locationGroups) {
    const groupId = clean(group?.groupId);
    const assignment = assignmentByGroupId.get(groupId) || null;
    if (assignment?.status !== 'GEOMETRY_ONLY') continue;
    sourceEvaluations.set(groupId, evaluateOrphanSource(group, assignment, context));
  }

  const resolutions = locationGroups.map((group) => resolveGroup(
    group,
    assignmentByGroupId.get(clean(group?.groupId)) || null,
    sourceEvaluations,
    context,
  ));
  const diagnostics = resolutions.flatMap((row) => resolutionDiagnostics(row));
  return Object.freeze({
    schema: SUPPORT_PRIMARY_ORPHAN_RECOVERY_SCHEMA,
    profileId: SUPPORT_PRIMARY_ORPHAN_RECOVERY_PROFILE,
    config,
    resolutions: Object.freeze(resolutions),
    diagnostics: Object.freeze(diagnostics),
    summary: Object.freeze({
      locationGroupCount: resolutions.length,
      orphanSourceCount: resolutions.filter((row) => row.sourceStatus === 'GEOMETRY_ONLY').length,
      recoveredExplicitCount: countStatus(resolutions, 'ORPHAN_RECOVERED_EXPLICIT'),
      recoveredGeometryCount: countStatus(resolutions, 'ORPHAN_RECOVERED_GEOMETRY'),
      ambiguousCount: countStatus(resolutions, 'ORPHAN_AMBIGUOUS'),
      nonReciprocalCount: countStatus(resolutions, 'ORPHAN_NONRECIPROCAL'),
      unresolvedCount: countStatus(resolutions, 'ORPHAN_UNRESOLVED'),
      disabledCount: countStatus(resolutions, 'DISABLED'),
    }),
  });
}

function resolveGroup(group, assignment, sourceEvaluations, context) {
  const groupId = clean(group?.groupId);
  const originalAssemblyId = clean(assignment?.primarySupportAssemblyId || assignment?.provisionalAssemblyId);
  if (assignment?.status !== 'GEOMETRY_ONLY') return freezeResolution({
    groupId,
    familyId: clean(group?.secondarySupportFamilyId),
    sourceStatus: assignment?.status || 'UNRESOLVED',
    recoveryStatus: 'NOT_APPLICABLE',
    recoveryBasis: 'NON_GEOMETRY_ASSIGNMENT_IMMUTABLE',
    originalAssemblyId,
    effectiveAssemblyId: originalAssemblyId,
  });
  if (!context.config.enabled) return freezeResolution({
    groupId,
    familyId: clean(group?.secondarySupportFamilyId),
    sourceStatus: assignment.status,
    recoveryStatus: 'DISABLED',
    recoveryBasis: 'ORPHAN_RECOVERY_DISABLED',
    originalAssemblyId,
    effectiveAssemblyId: originalAssemblyId,
  });

  const evaluation = sourceEvaluations.get(groupId);
  const candidates = evaluation?.candidateIdentities || [];
  if (!candidates.length) return freezeResolution({
    groupId,
    familyId: clean(group?.secondarySupportFamilyId),
    sourceStatus: assignment.status,
    recoveryStatus: 'ORPHAN_UNRESOLVED',
    recoveryBasis: 'NO_UNIQUE_QUALIFYING_TARGET',
    originalAssemblyId,
    effectiveAssemblyId: originalAssemblyId,
    candidateTargetIds: [],
    candidateTargetGroupIds: [],
    nearestRejectedCandidate: evaluation?.nearestRejectedCandidate || null,
    rejectionSummary: evaluation?.rejectionSummary || {},
  });
  if (candidates.length > 1) return freezeResolution({
    groupId,
    familyId: clean(group?.secondarySupportFamilyId),
    sourceStatus: assignment.status,
    recoveryStatus: 'ORPHAN_AMBIGUOUS',
    recoveryBasis: 'MULTIPLE_QUALIFYING_TARGET_IDENTITIES',
    originalAssemblyId,
    effectiveAssemblyId: originalAssemblyId,
    candidateTargetIds: candidates.map((row) => row.targetAssemblyId || row.targetIdentity),
    candidateTargetGroupIds: unique(candidates.flatMap((row) => row.targetGroupIds)).sort(),
    candidateAudits: candidates,
    rejectionSummary: evaluation?.rejectionSummary || {},
  });

  const selected = candidates[0];
  if (selected.targetKind === 'EXPLICIT') return freezeResolution({
    groupId,
    familyId: clean(group?.secondarySupportFamilyId),
    sourceStatus: assignment.status,
    recoveryStatus: 'ORPHAN_RECOVERED_EXPLICIT',
    recoveryBasis: 'UNIQUE_EXPLICIT_ASSEMBLY_TARGET',
    originalAssemblyId,
    effectiveAssemblyId: selected.targetAssemblyId,
    targetAssemblyId: selected.targetAssemblyId,
    targetGroupIds: selected.targetGroupIds,
    candidateTargetIds: [selected.targetAssemblyId],
    candidateTargetGroupIds: selected.targetGroupIds,
    selectedCandidate: selected,
    rejectionSummary: evaluation?.rejectionSummary || {},
  });

  const targetGroupId = selected.targetGroupIds[0] || '';
  const reciprocal = sourceEvaluations.get(targetGroupId);
  const reciprocalCandidates = reciprocal?.candidateIdentities || [];
  const reciprocalUnique = reciprocalCandidates.length === 1
    && reciprocalCandidates[0].targetKind === 'GEOMETRY'
    && reciprocalCandidates[0].targetGroupIds.includes(groupId);
  if (!reciprocalUnique) return freezeResolution({
    groupId,
    familyId: clean(group?.secondarySupportFamilyId),
    sourceStatus: assignment.status,
    recoveryStatus: 'ORPHAN_NONRECIPROCAL',
    recoveryBasis: 'PROVISIONAL_TARGET_NOT_RECIPROCALLY_UNIQUE',
    originalAssemblyId,
    effectiveAssemblyId: originalAssemblyId,
    targetAssemblyId: selected.targetAssemblyId,
    targetGroupIds: selected.targetGroupIds,
    candidateTargetIds: [selected.targetAssemblyId || selected.targetIdentity],
    candidateTargetGroupIds: selected.targetGroupIds,
    selectedCandidate: selected,
    rejectionSummary: evaluation?.rejectionSummary || {},
  });

  const pairGroupIds = [groupId, targetGroupId].sort();
  const pairAssemblyId = recoveredPairAssemblyId(pairGroupIds, context.groupById);
  return freezeResolution({
    groupId,
    familyId: clean(group?.secondarySupportFamilyId),
    sourceStatus: assignment.status,
    recoveryStatus: 'ORPHAN_RECOVERED_GEOMETRY',
    recoveryBasis: 'RECIPROCAL_UNIQUE_PROVISIONAL_TARGET',
    originalAssemblyId,
    effectiveAssemblyId: pairAssemblyId,
    targetAssemblyId: selected.targetAssemblyId,
    targetGroupIds: selected.targetGroupIds,
    candidateTargetIds: [selected.targetAssemblyId || selected.targetIdentity],
    candidateTargetGroupIds: selected.targetGroupIds,
    selectedCandidate: selected,
    rejectionSummary: evaluation?.rejectionSummary || {},
  });
}

function freezeResolution(input) {
  const selected = input.selectedCandidate || null;
  return Object.freeze({
    groupId: input.groupId || '',
    familyId: input.familyId || '',
    sourceStatus: input.sourceStatus || '',
    recoveryStatus: input.recoveryStatus || '',
    recoveryBasis: input.recoveryBasis || '',
    originalAssemblyId: input.originalAssemblyId || '',
    effectiveAssemblyId: input.effectiveAssemblyId || input.originalAssemblyId || '',
    targetAssemblyId: input.targetAssemblyId || '',
    targetGroupIds: Object.freeze([...(input.targetGroupIds || [])]),
    candidateTargetIds: Object.freeze([...(input.candidateTargetIds || [])]),
    candidateTargetGroupIds: Object.freeze([...(input.candidateTargetGroupIds || [])]),
    candidateAudits: Object.freeze([...(input.candidateAudits || [])]),
    nearestRejectedCandidate: input.nearestRejectedCandidate || null,
    rejectionSummary: Object.freeze({ ...(input.rejectionSummary || {}) }),
    axialMm: selected?.axialMm ?? null,
    lateralMm: selected?.lateralMm ?? null,
    baseAxialToleranceMm: selected?.baseAxialToleranceMm ?? null,
    baseLateralToleranceMm: selected?.baseLateralToleranceMm ?? null,
    recoveryAxialToleranceMm: selected?.recoveryAxialToleranceMm ?? null,
    recoveryLateralToleranceMm: selected?.recoveryLateralToleranceMm ?? null,
    axisBasis: selected?.axisBasis || '',
    axisConfidenceRatio: Number.isFinite(selected?.axisConfidenceRatio) ? selected.axisConfidenceRatio : null,
    branchRelationship: selected?.branchRelationship || '',
  });
}

function resolutionDiagnostics(row) {
  if (row.recoveryStatus === 'ORPHAN_AMBIGUOUS') return [Object.freeze({
    severity: 'WARNING',
    code: 'ORPHAN_AMBIGUOUS',
    groupId: row.groupId,
    familyId: row.familyId,
    candidateTargetIds: row.candidateTargetIds,
    candidateTargetGroupIds: row.candidateTargetGroupIds,
    message: 'Orphan geometry evidence has multiple qualifying target identities; automatic recovery was withheld.',
  })];
  if (row.recoveryStatus === 'ORPHAN_NONRECIPROCAL') return [Object.freeze({
    severity: 'INFO',
    code: 'ORPHAN_NONRECIPROCAL',
    groupId: row.groupId,
    familyId: row.familyId,
    candidateTargetIds: row.candidateTargetIds,
    message: 'A provisional geometry target was unique from this orphan but not reciprocally unique; automatic recovery was withheld.',
  })];
  return [];
}

function recoveredPairAssemblyId(groupIds, groupById) {
  const families = unique(groupIds.map((id) => familyToken(groupById.get(id)?.secondarySupportFamilyId))).sort();
  const signature = groupIds.join('|');
  return `PSA::RECOVERED::${families.join('+') || 'UNRESOLVED'}::G-${fnv1a(signature)}`;
}

function familyToken(value) { return token(value).replace(/\.(?:\d+)$/u, ''); }
function token(value) { return clean(value).replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase(); }
function clean(value) { return value == null ? '' : String(value).trim(); }
function nonNegative(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}
function booleanValue(value, fallback) { return typeof value === 'boolean' ? value : fallback; }
function countStatus(rows, status) { return rows.filter((row) => row.recoveryStatus === status).length; }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }
function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export const _test = Object.freeze({
  axisSeparation,
  branchRelationship,
  buildPipeGeometryIndex,
  collapseCandidateIdentities,
  evaluateCandidate: evaluateOrphanCandidate,
  recoveredPairAssemblyId,
  recoveryBoreMm,
  selectAxisModel,
  trustedPipeModel,
});
