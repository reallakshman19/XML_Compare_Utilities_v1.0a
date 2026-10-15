import { SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA } from './support-primary-relationship.js';

export function buildSupportPrimaryCountProjection(input = {}) {
  const locationGroups = Array.isArray(input.locationGroups) ? input.locationGroups : [];
  const relationshipFamilies = relationshipFamilyIndex(input.relationshipBundle);
  const assignments = input.reconciliation?.assignments || [];
  const recoveries = input.orphanRecovery?.resolutions || [];
  const assignmentsByFamily = groupAssignments(assignments);
  const recoveryByFamily = groupRecoveryRows(recoveries);
  const groupsByFamily = groupLocationRows(locationGroups);
  const familyIds = unique([
    ...groupsByFamily.keys(),
    ...relationshipFamilies.keys(),
  ]).sort();
  const familySummaries = familyIds.map((familyId) => buildFamilyCountSummary({
    familyId,
    locationGroups: groupsByFamily.get(familyId) || [],
    assignments: assignmentsByFamily.get(familyId) || [],
    recoveries: recoveryByFamily.get(familyId) || [],
    relationshipFamily: relationshipFamilies.get(familyId) || null,
    orphanRecovery: input.orphanRecovery,
  }));
  const summaryByFamily = new Map(familySummaries.map((row) => [row.familyId, row]));
  const assignmentByGroupId = new Map(assignments.map((row) => [clean(row.groupId), row]));
  const recoveryByGroupId = new Map(recoveries.map((row) => [clean(row.groupId), row]));
  const groups = locationGroups.map((group) => projectCountedGroup(
    group,
    assignmentByGroupId.get(clean(group?.groupId)) || null,
    recoveryByGroupId.get(clean(group?.groupId)) || null,
    summaryByFamily.get(normalizeFamilyId(group?.secondarySupportFamilyId)) || null,
  ));
  return Object.freeze({
    groups: Object.freeze(groups),
    familySummaries: Object.freeze(familySummaries),
  });
}

export function buildFamilyCountSummary({ familyId, locationGroups, assignments, recoveries, relationshipFamily, orphanRecovery }) {
  const legacyGeometryCount = locationGroups.length;
  const explicitAssemblyIds = relationshipFamily
    ? (relationshipFamily.assemblies || []).filter((row) => row?.countable).map((row) => clean(row.assemblyId)).filter(Boolean).sort()
    : [];
  const explicitSet = new Set(explicitAssemblyIds);
  const assignmentByGroupId = new Map((assignments || []).map((row) => [clean(row.groupId), row]));
  const recoveryByGroupId = new Map((recoveries || []).map((row) => [clean(row.groupId), row]));
  const geometryOnlyAssignments = assignments.filter((row) => row.status === 'GEOMETRY_ONLY');
  const partialAssignments = assignments.filter((row) => row.status === 'PARTIAL_EXPLICIT');
  const conflictAssignments = assignments.filter((row) => row.status === 'CONFLICT');
  const ambiguityCount = partialAssignments.length + conflictAssignments.length;
  const explicitRelationshipFamilyAvailable = Boolean(relationshipFamily);
  const geometryOccurrenceIds = unique(geometryOnlyAssignments.map((row) => {
    const recovery = recoveryByGroupId.get(clean(row.groupId));
    return clean(recovery?.effectiveAssemblyId || row.primarySupportAssemblyId || row.provisionalAssemblyId);
  }).filter(Boolean)).sort();
  const legacyFallbackOccurrenceIds = unique(locationGroups.map((group) => {
    const groupId = clean(group?.groupId);
    const assignment = assignmentByGroupId.get(groupId) || null;
    const recovery = recoveryByGroupId.get(groupId) || null;
    if (assignment?.status === 'GEOMETRY_ONLY') {
      const effective = clean(recovery?.effectiveAssemblyId || assignment.primarySupportAssemblyId || assignment.provisionalAssemblyId);
      return effective ? `RECOVERABLE::${effective}` : `LEGACY_GROUP::${groupId}`;
    }
    return `LEGACY_GROUP::${groupId}`;
  }).filter(Boolean)).sort();
  const additionalGeometryOccurrenceIds = geometryOccurrenceIds.filter((id) => !explicitSet.has(id));
  const recoveredRows = (recoveries || []).filter((row) => isRecovered(row?.recoveryStatus));
  const ambiguousRows = (recoveries || []).filter((row) => row?.recoveryStatus === 'ORPHAN_AMBIGUOUS');
  const unresolvedRows = (recoveries || []).filter((row) => ['ORPHAN_UNRESOLVED', 'ORPHAN_NONRECIPROCAL'].includes(row?.recoveryStatus));
  const recoveryApplied = recoveredRows.length > 0;

  if (!explicitRelationshipFamilyAvailable) {
    const total = legacyFallbackOccurrenceIds.length;
    return freezeFamilySummary({
      familyId,
      totalSupportPointsOnSecondary: total,
      countBasis: recoveryApplied ? 'GEOMETRY_ORPHAN_RECOVERY' : 'LEGACY_GEOMETRY_GROUP_COUNT',
      legacyGeometryCount,
      explicitAssemblyIds: [],
      geometryOnlyGroupIds: geometryOnlyAssignments.map((row) => clean(row.groupId)).filter(Boolean),
      geometryOccurrenceIds,
      legacyFallbackOccurrenceIds,
      ambiguityCount: 0,
      explicitRelationshipFamilyAvailable: false,
      orphanRecovery,
      recoveries,
      recoveredRows,
      ambiguousRows,
      unresolvedRows,
      diagnostics: [],
    });
  }

  const geometryOnlyGroupIds = geometryOnlyAssignments.map((row) => clean(row.groupId)).filter(Boolean);
  const derivedMinimumCount = explicitAssemblyIds.length + additionalGeometryOccurrenceIds.length;
  const total = ambiguityCount
    ? Math.max(legacyGeometryCount, derivedMinimumCount)
    : derivedMinimumCount;
  const countBasis = ambiguityCount
    ? 'EXPLICIT_ASSEMBLY_PLUS_GEOMETRY_AMBIGUITY_FLOOR'
    : recoveryApplied ? 'EXPLICIT_ASSEMBLY_PLUS_ORPHAN_RECOVERY' : 'EXPLICIT_ASSEMBLY_PLUS_GEOMETRY';
  const diagnostics = ambiguityCount ? [Object.freeze({
    level: 'WARN',
    code: 'PRIMARY_ASSEMBLY_COUNT_AMBIGUITY_FLOOR',
    familyId,
    legacyGeometryCount,
    derivedMinimumCount,
    totalSupportPointsOnSecondary: total,
    partialExplicitGroupIds: Object.freeze(partialAssignments.map((row) => clean(row.groupId)).filter(Boolean)),
    conflictGroupIds: Object.freeze(conflictAssignments.map((row) => clean(row.groupId)).filter(Boolean)),
    message: 'Primary-support topology contains partial/conflicting location evidence; total count is conservatively floored so it cannot fall below existing geometry evidence.',
  })] : [];

  return freezeFamilySummary({
    familyId,
    totalSupportPointsOnSecondary: total,
    countBasis,
    legacyGeometryCount,
    explicitAssemblyIds,
    geometryOnlyGroupIds,
    geometryOccurrenceIds,
    legacyFallbackOccurrenceIds: [],
    ambiguityCount,
    explicitRelationshipFamilyAvailable: true,
    orphanRecovery,
    recoveries,
    recoveredRows,
    ambiguousRows,
    unresolvedRows,
    diagnostics,
  });
}

function freezeFamilySummary(input) {
  return Object.freeze({
    familyId: input.familyId,
    totalSupportPointsOnSecondary: input.totalSupportPointsOnSecondary,
    multiplePrimarySupport: input.totalSupportPointsOnSecondary > 1,
    countBasis: input.countBasis,
    legacyGeometryCount: input.legacyGeometryCount,
    explicitAssemblyIds: Object.freeze([...(input.explicitAssemblyIds || [])]),
    geometryOnlyGroupIds: Object.freeze([...(input.geometryOnlyGroupIds || [])]),
    geometryOccurrenceIds: Object.freeze([...(input.geometryOccurrenceIds || [])]),
    legacyFallbackOccurrenceIds: Object.freeze([...(input.legacyFallbackOccurrenceIds || [])]),
    ambiguityCount: input.ambiguityCount || 0,
    explicitRelationshipFamilyAvailable: Boolean(input.explicitRelationshipFamilyAvailable),
    orphanRecoverySchema: input.orphanRecovery?.schema || '',
    orphanRecoveryProfileId: input.orphanRecovery?.profileId || '',
    orphanRecoveryConfig: input.orphanRecovery?.config || null,
    orphanRecoveredGroupIds: Object.freeze((input.recoveredRows || []).map((row) => clean(row.groupId)).filter(Boolean)),
    orphanAmbiguousGroupIds: Object.freeze((input.ambiguousRows || []).map((row) => clean(row.groupId)).filter(Boolean)),
    orphanUnresolvedGroupIds: Object.freeze((input.unresolvedRows || []).map((row) => clean(row.groupId)).filter(Boolean)),
    orphanRecoveryResolutions: Object.freeze([...(input.recoveries || [])]),
    diagnostics: Object.freeze([...(input.diagnostics || [])]),
  });
}

function projectCountedGroup(group, assignment, recovery, familySummary) {
  const total = familySummary?.totalSupportPointsOnSecondary
    ?? Number(group?.totalSupportPointsOnSecondary || 0);
  const effectiveAssemblyId = clean(recovery?.effectiveAssemblyId || assignment?.primarySupportAssemblyId);
  const recoveryCandidateIds = recovery?.candidateTargetIds || [];
  const assignmentCandidateIds = assignment?.candidateAssemblyIds || [];
  const recovered = isRecovered(recovery?.recoveryStatus);
  return Object.freeze({
    ...group,
    totalSupportPointsOnSecondary: total,
    multiplePrimarySupport: total > 1,
    primarySupportAssemblyId: effectiveAssemblyId,
    primarySupportAssemblyOriginalId: clean(assignment?.primarySupportAssemblyId),
    primarySupportAssemblyStatus: assignment?.status || 'GEOMETRY_ONLY',
    primarySupportAssemblyBasis: recovered
      ? recovery.recoveryBasis : assignment?.assignmentBasis || 'LEGACY_GEOMETRY_GROUP',
    primarySupportAssemblyCandidateIds: Object.freeze(unique([
      ...assignmentCandidateIds,
      ...recoveryCandidateIds,
    ]).sort()),
    primarySupportAssemblyProvisionalId: clean(assignment?.provisionalAssemblyId),
    primarySupportAssemblyCountBasis: familySummary?.countBasis || 'LEGACY_GEOMETRY_GROUP_COUNT',
    primarySupportFamilyExplicitAssemblyIds: Object.freeze([...(familySummary?.explicitAssemblyIds || [])]),
    primarySupportFamilyGeometryOnlyGroupIds: Object.freeze([...(familySummary?.geometryOnlyGroupIds || [])]),
    primarySupportFamilyGeometryOccurrenceIds: Object.freeze([...(familySummary?.geometryOccurrenceIds || [])]),
    primarySupportFamilyAmbiguityCount: familySummary?.ambiguityCount || 0,
    primarySupportOrphanRecoveryStatus: recovery?.recoveryStatus || 'NOT_RUN',
    primarySupportOrphanRecoveryBasis: recovery?.recoveryBasis || '',
    primarySupportOrphanRecoveryTargetAssemblyId: clean(recovery?.targetAssemblyId),
    primarySupportOrphanRecoveryTargetGroupIds: Object.freeze([...(recovery?.targetGroupIds || [])]),
    primarySupportOrphanRecoveryCandidateTargetIds: Object.freeze([...(recovery?.candidateTargetIds || [])]),
    primarySupportOrphanRecoveryCandidateTargetGroupIds: Object.freeze([...(recovery?.candidateTargetGroupIds || [])]),
    primarySupportOrphanRecoveryAxialMm: recovery?.axialMm ?? null,
    primarySupportOrphanRecoveryLateralMm: recovery?.lateralMm ?? null,
    primarySupportOrphanRecoveryBaseAxialToleranceMm: recovery?.baseAxialToleranceMm ?? null,
    primarySupportOrphanRecoveryBaseLateralToleranceMm: recovery?.baseLateralToleranceMm ?? null,
    primarySupportOrphanRecoveryAxialToleranceMm: recovery?.recoveryAxialToleranceMm ?? null,
    primarySupportOrphanRecoveryLateralToleranceMm: recovery?.recoveryLateralToleranceMm ?? null,
    primarySupportOrphanRecoveryAxisBasis: recovery?.axisBasis || '',
    primarySupportOrphanRecoveryAxisConfidenceRatio: recovery?.axisConfidenceRatio ?? null,
    primarySupportOrphanRecoveryBranchRelationship: recovery?.branchRelationship || '',
  });
}

export function relationshipFamilyIndex(bundle) {
  const output = new Map();
  if (bundle?.schema !== SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA) return output;
  for (const family of bundle?.families || []) {
    const familyId = normalizeFamilyId(family?.familyId);
    if (familyId && !output.has(familyId)) output.set(familyId, family);
  }
  return output;
}

function groupAssignments(rows = []) {
  return groupByFamily(rows, (row) => row?.familyId);
}

export function groupRecoveryRows(rows = []) {
  return groupByFamily(rows, (row) => row?.familyId);
}

function groupLocationRows(rows = []) {
  return groupByFamily(rows, (row) => row?.secondarySupportFamilyId);
}

function groupByFamily(rows, familyValue) {
  const output = new Map();
  for (const row of rows || []) {
    const familyId = normalizeFamilyId(familyValue(row));
    if (!familyId) continue;
    if (!output.has(familyId)) output.set(familyId, []);
    output.get(familyId).push(row);
  }
  return output;
}

function normalizeFamilyId(value) {
  return clean(value).replace(/^\/+/, '').replace(/\(REF\)$/iu, '').toUpperCase();
}
function isRecovered(status) { return status === 'ORPHAN_RECOVERED_EXPLICIT' || status === 'ORPHAN_RECOVERED_GEOMETRY'; }
function clean(value) { return value == null ? '' : String(value).trim(); }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }
