import { SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA } from './support-primary-relationship.js';
import { reconcileSupportPrimaryAssemblies } from './support-primary-reconciliation.js';
import {
  resolveSupportPrimaryOrphans,
  SUPPORT_PRIMARY_ORPHAN_RECOVERY_SCHEMA,
} from './support-primary-orphan-recovery.js?v=20260929-support-primary-orphan-split-1';
import {
  buildSupportPrimaryCountProjection,
  buildFamilyCountSummary,
  relationshipFamilyIndex,
  groupRecoveryRows,
} from './support-primary-count-projection.js?v=20260929-support-primary-count-projection-1';

export const SUPPORT_PRIMARY_COUNT_SCHEMA = 'SupportPrimaryCountProjection.v1';

export function applySupportPrimaryAssemblyCounts(input = {}) {
  const locationGroups = Array.isArray(input.locationGroups) ? input.locationGroups : [];
  const relationshipBundle = input.relationshipBundle || null;
  const reconciliation = reconcileSupportPrimaryAssemblies({ locationGroups, relationshipBundle });
  const rawOrphanRecovery = resolveSupportPrimaryOrphans({
    locationGroups,
    reconciliation,
    config: input.orphanRecoveryConfig,
  });
  const orphanRecovery = enforceOrphanTraversalSafety(rawOrphanRecovery);
  const projection = buildSupportPrimaryCountProjection({
    locationGroups,
    relationshipBundle,
    reconciliation,
    orphanRecovery,
  });
  const diagnostics = [
    ...(orphanRecovery.diagnostics || []),
    ...projection.familySummaries.flatMap((row) => row.diagnostics),
  ];
  return Object.freeze({
    schema: SUPPORT_PRIMARY_COUNT_SCHEMA,
    relationshipSchema: relationshipBundle?.schema || '',
    relationshipEvidenceAvailable: relationshipBundle?.schema === SUPPORT_PRIMARY_RELATIONSHIP_SCHEMA,
    orphanRecoverySchema: SUPPORT_PRIMARY_ORPHAN_RECOVERY_SCHEMA,
    orphanRecovery,
    reconciliation,
    groups: projection.groups,
    familySummaries: projection.familySummaries,
    diagnostics: Object.freeze(diagnostics),
    summary: Object.freeze({
      familyCount: projection.familySummaries.length,
      explicitAuthorityFamilyCount: projection.familySummaries.filter((row) => row.explicitRelationshipFamilyAvailable).length,
      ambiguityFamilyCount: projection.familySummaries.filter((row) => row.ambiguityCount > 0).length,
      orphanRecoveredGroupCount: orphanRecovery.summary.recoveredExplicitCount + orphanRecovery.summary.recoveredGeometryCount,
      orphanAmbiguousGroupCount: orphanRecovery.summary.ambiguousCount,
      orphanUnresolvedGroupCount: orphanRecovery.summary.unresolvedCount + orphanRecovery.summary.nonReciprocalCount,
      orphanCrossTraversalGeometryWithheldCount: orphanRecovery.summary.crossTraversalGeometryWithheldCount || 0,
    }),
  });
}

function enforceOrphanTraversalSafety(recovery) {
  if (!recovery || !Array.isArray(recovery.resolutions)) return recovery;
  const withheld = [];
  const resolutions = recovery.resolutions.map((row) => {
    if (row?.recoveryStatus !== 'ORPHAN_RECOVERED_GEOMETRY'
      || row?.branchRelationship !== 'DIFFERENT_TRAVERSAL') return row;
    const guarded = Object.freeze({
      ...row,
      recoveryStatus: 'ORPHAN_UNRESOLVED',
      recoveryBasis: 'DIFFERENT_TRAVERSAL_GEOMETRY_RECOVERY_WITHHELD',
      effectiveAssemblyId: row.originalAssemblyId || row.effectiveAssemblyId || '',
    });
    withheld.push(guarded);
    return guarded;
  });
  const withheldCount = withheld.length;
  const diagnostics = [
    ...(recovery.diagnostics || []),
    ...withheld.map((row) => Object.freeze({
      severity: 'INFO',
      code: 'ORPHAN_CROSS_TRAVERSAL_GEOMETRY_WITHHELD',
      groupId: row.groupId,
      familyId: row.familyId,
      candidateTargetIds: row.candidateTargetIds,
      candidateTargetGroupIds: row.candidateTargetGroupIds,
      message: 'Provisional geometry recovery crossed known pipe traversals and was withheld from count authority; explicit assembly evidence is required to override traversal separation.',
    })),
  ];
  return Object.freeze({
    ...recovery,
    resolutions: Object.freeze(resolutions),
    diagnostics: Object.freeze(diagnostics),
    summary: Object.freeze({
      ...(recovery.summary || {}),
      recoveredGeometryCount: Math.max(0, Number(recovery.summary?.recoveredGeometryCount || 0) - withheldCount),
      unresolvedCount: Number(recovery.summary?.unresolvedCount || 0) + withheldCount,
      crossTraversalGeometryWithheldCount: withheldCount,
    }),
  });
}

export const _test = Object.freeze({
  buildFamilyCountSummary,
  enforceOrphanTraversalSafety,
  relationshipFamilyIndex,
  groupRecoveryRows,
});
