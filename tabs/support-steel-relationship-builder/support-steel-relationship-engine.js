import {
  SUPPORT_STEEL_EVIDENCE_SOURCE,
  SUPPORT_STEEL_RELATIONSHIP_SCHEMA,
  SUPPORT_STEEL_RELATIONSHIP_SEMANTIC,
  resolveSupportSteelConfig,
} from './support-steel-relationship-contracts.js';
import {
  SUPPORT_STEEL_ANALYTICAL_GEOMETRY_SCHEMA,
  minimumSupportToSteelGeometryDistance,
} from './support-steel-analytical-geometry.js';
import {
  SUPPORT_MEMBER_CHAIN_SCHEMA,
  buildSupportMemberChainBundle,
} from './support-member-chain-engine.js';
import { collectSteelGroups, collectSupportFamilies } from './support-steel-source-reader.js';
import { cleanText, cloneJson } from './support-steel-source-utils.js';

export function buildSupportSteelRelationshipBundle(input = {}) {
  const config = resolveSupportSteelConfig(input.config);
  const supportFamilies = collectSupportFamilies(input.supportInput, config);
  const steelGroups = collectSteelGroups(input.steelInput, config);
  const diagnostics = [];
  const relationships = [];
  const supportOutput = supportFamilies.map((family) => {
    const result = resolveFamilyRelationships(family, steelGroups, config);
    relationships.push(...result.relationships);
    diagnostics.push(...result.diagnostics);
    return { ...cloneJson(family), steelRelationships: result.relationships };
  });
  const steelOutput = projectSteelRelationships(steelGroups, relationships);
  const supportMemberChain = buildSupportMemberChainBundle({
    supportFamilies: supportOutput,
    steelGroups: steelOutput,
    relationships,
    config,
  });
  diagnostics.push(...supportMemberChain.diagnostics);
  const unresolvedSupportFamilies = supportOutput
    .filter((family) => family.steelRelationships.every((row) => row.relationshipStatus === 'UNRESOLVED'))
    .map((family) => family.familyId);
  return {
    schema: SUPPORT_STEEL_RELATIONSHIP_SCHEMA,
    geometryEngineSchema: SUPPORT_STEEL_ANALYTICAL_GEOMETRY_SCHEMA,
    memberChainEngineSchema: SUPPORT_MEMBER_CHAIN_SCHEMA,
    bundlePurpose: 'RELATIONSHIP_AND_MEMBER_CONNECTIVITY_INFERENCE',
    contactEvidenceAvailable: false,
    analyticalMemberContactEvidenceAvailable: supportMemberChain.summary.supportChainEdgeCount > 0,
    coordinateSystem: {
      units: 'mm',
      globalAxes: { x: 'EAST', y: 'NORTH', z: 'UP' },
    },
    config: publicConfig(config),
    summary: buildSummary(supportOutput, steelOutput, relationships, supportMemberChain),
    supportFamilies: supportOutput,
    steelGroups: steelOutput,
    relationships,
    supportMemberChain,
    unresolvedSupportFamilies,
    diagnostics,
  };
}

function resolveFamilyRelationships(family, steelGroups, config) {
  const explicit = explicitCandidates(family, steelGroups, config);
  if (explicit.length === 1) return resolvedExplicit(family, explicit[0]);
  if (explicit.length > 1) return ambiguousRelationships(family, explicit, 'EXPLICIT_REFERENCE');
  const spatial = spatialCandidates(family, steelGroups, config);
  if (spatial.length) return resolvedSpatial(family, spatial, config.ambiguityDeltaMm);
  const owners = sharedOwnerCandidates(family, steelGroups, config);
  if (owners.length === 1) return resolvedOwner(family, owners[0]);
  if (owners.length > 1) return ambiguousRelationships(family, owners, 'SHARED_OWNER');
  return unresolvedRelationship(family, steelGroups, config);
}

function explicitCandidates(family, steelGroups, config) {
  const refs = new Set((family.explicitReferences || []).map(normalizeToken));
  const familyToken = normalizeToken(family.familyId);
  return steelGroups.flatMap((steel) => {
    const steelToken = normalizeToken(steel.steelGroupId);
    const bases = [];
    if (steelToken === familyToken) bases.push('SAME_CANONICAL_ID');
    if ([...refs].some((ref) => tokenMatches(ref, steelToken))) bases.push('EXPLICIT_REFERENCE');
    return bases.length ? [candidateRecord(family, steel, bases, config)] : [];
  });
}

function spatialCandidates(family, steelGroups, config) {
  return steelGroups
    .map((steel) => candidateRecord(family, steel, [], config))
    .map((candidate) => ({
      ...candidate,
      relationshipBasis: [candidate.geometryEvidence.analyticalGeometryAvailable
        ? 'ANALYTICAL_GEOMETRY_PROXIMITY'
        : 'REPRESENTATIVE_POINT_PROXIMITY'],
    }))
    .filter((candidate) => Number.isFinite(candidate.distanceMm) && candidate.distanceMm <= config.projectionToleranceMm)
    .filter((candidate) => !config.requireAnalyticalGeometryForSpatialResolution
      || candidate.geometryEvidence.analyticalGeometryAvailable)
    .sort(compareCandidates);
}

function sharedOwnerCandidates(family, steelGroups, config) {
  const branches = new Set((family.branchIds || []).map(normalizeToken));
  return steelGroups.flatMap((steel) => {
    const matched = (steel.owners || []).some((owner) => branches.has(normalizeToken(owner)));
    return matched ? [candidateRecord(family, steel, ['SHARED_OWNER'], config)] : [];
  });
}

function candidateRecord(family, steel, relationshipBasis, config) {
  const geometryEvidence = minimumSupportToSteelGeometryDistance(family, steel);
  return {
    steel,
    relationshipBasis,
    distanceMm: geometryEvidence.distanceMm,
    geometryEvidence: {
      ...geometryEvidence,
      withinProjectionTolerance: Number.isFinite(geometryEvidence.distanceMm)
        ? geometryEvidence.distanceMm <= config.projectionToleranceMm
        : false,
      projectionToleranceMm: config.projectionToleranceMm,
    },
  };
}

function resolvedExplicit(family, candidate) {
  return {
    relationships: [relationshipRecord(
      family,
      candidate,
      'RESOLVED_EXPLICIT',
      'HIGH',
      'ONE_TO_ONE',
    )],
    diagnostics: geometryDiagnostics(family, candidate, 'EXPLICIT'),
  };
}

function resolvedSpatial(family, candidates, ambiguityDeltaMm) {
  const first = candidates[0];
  const second = candidates[1];
  if (second && second.distanceMm - first.distanceMm <= ambiguityDeltaMm) {
    const tied = candidates.filter((candidate) => candidate.distanceMm - first.distanceMm <= ambiguityDeltaMm);
    return ambiguousRelationships(family, tied, 'ANALYTICAL_GEOMETRY_PROXIMITY');
  }
  return {
    relationships: [relationshipRecord(
      family,
      first,
      'RESOLVED_SPATIAL',
      spatialConfidence(first.geometryEvidence.geometryQuality),
      'ONE_TO_ONE',
    )],
    diagnostics: geometryDiagnostics(family, first, 'SPATIAL'),
  };
}

function resolvedOwner(family, candidate) {
  return {
    relationships: [relationshipRecord(
      family,
      candidate,
      'RESOLVED_SHARED_OWNER',
      'LOW',
      'ONE_TO_ONE',
    )],
    diagnostics: [{
      severity: 'WARNING',
      code: 'RELATIONSHIP_RESOLVED_BY_SHARED_OWNER_ONLY',
      supportFamilyId: family.familyId,
      steelGroupId: candidate.steel.steelGroupId,
      message: 'Relationship uses shared owner evidence because explicit and analytical spatial evidence were unavailable.',
    }, ...geometryDiagnostics(family, candidate, 'OWNER')],
  };
}

function ambiguousRelationships(family, candidates, basis) {
  const candidateSteelGroupIds = candidates.map((candidate) => candidate.steel.steelGroupId);
  const relationships = candidates.map((candidate) => ({
    ...relationshipRecord(
      family,
      candidate,
      'AMBIGUOUS',
      'NONE',
      'ONE_TO_MANY_AMBIGUOUS',
    ),
    candidateSteelGroupIds,
  }));
  return {
    relationships,
    diagnostics: [{
      severity: 'WARNING',
      code: 'AMBIGUOUS_SUPPORT_STEEL_RELATIONSHIP',
      supportFamilyId: family.familyId,
      candidateSteelGroupIds,
      relationshipBasis: basis,
      relationshipCardinality: 'ONE_TO_MANY_AMBIGUOUS',
      message: 'More than one steel group satisfies the strongest available relationship evidence.',
    }],
  };
}

function unresolvedRelationship(family, steelGroups, config) {
  const nearest = steelGroups
    .map((steel) => candidateRecord(family, steel, [], config))
    .filter((row) => Number.isFinite(row.distanceMm))
    .sort(compareCandidates)[0];
  const record = baseEvidenceRecord(family, null, 'UNRESOLVED');
  Object.assign(record, {
    relationshipId: `${family.familyId}::UNRESOLVED`,
    evidenceId: `SSRB:${family.familyId}::UNRESOLVED`,
    steelGroupId: null,
    relationshipStatus: 'UNRESOLVED',
    relationshipBasis: [],
    relationshipCardinality: 'UNRESOLVED',
    confidence: 'NONE',
    distanceMm: nearest?.distanceMm ?? null,
    nearestSteelGroupId: nearest?.steel.steelGroupId ?? null,
    steelPositionGlobal: nearest?.steel.steelPositionGlobal || null,
    candidateSteelGroupIds: [],
    ...geometryFields(nearest?.geometryEvidence),
  });
  const diagnostics = [{
    severity: 'WARNING',
    code: 'UNRESOLVED_SUPPORT_STEEL_RELATIONSHIP',
    supportFamilyId: family.familyId,
    nearestSteelGroupId: record.nearestSteelGroupId,
    nearestDistanceMm: record.distanceMm,
    message: 'No explicit, in-tolerance analytical geometry, or unique shared-owner relationship was established.',
  }];
  if (nearest?.geometryEvidence?.geometryQuality === 'FALLBACK'
      && nearest.geometryEvidence.withinProjectionTolerance
      && config.requireAnalyticalGeometryForSpatialResolution) {
    diagnostics.push({
      severity: 'WARNING',
      code: 'REPRESENTATIVE_POINT_PROXIMITY_NOT_ACCEPTED',
      supportFamilyId: family.familyId,
      nearestSteelGroupId: nearest.steel.steelGroupId,
      nearestDistanceMm: nearest.distanceMm,
      message: 'Representative point proximity is retained as diagnostic evidence but cannot resolve the relationship without analytical structural geometry.',
    });
  }
  return { relationships: [record], diagnostics };
}

function relationshipRecord(family, candidate, status, confidence, relationshipCardinality) {
  const record = baseEvidenceRecord(family, candidate.steel, relationshipCardinality);
  return {
    ...record,
    relationshipId: `${family.familyId}::${candidate.steel.steelGroupId}`,
    evidenceId: `SSRB:${family.familyId}::${candidate.steel.steelGroupId}`,
    steelGroupId: candidate.steel.steelGroupId,
    relationshipStatus: status,
    relationshipBasis: [...candidate.relationshipBasis],
    relationshipCardinality,
    confidence,
    distanceMm: finiteOrNull(candidate.distanceMm),
    steelPositionGlobal: candidate.steel.steelPositionGlobal || null,
    candidateSteelGroupIds: [],
    ...geometryFields(candidate.geometryEvidence),
  };
}

function baseEvidenceRecord(family, steel, relationshipCardinality) {
  return {
    evidenceSource: SUPPORT_STEEL_EVIDENCE_SOURCE,
    evidenceClass: 'INFERRED',
    sourceSchema: SUPPORT_STEEL_RELATIONSHIP_SCHEMA,
    geometryEngineSchema: SUPPORT_STEEL_ANALYTICAL_GEOMETRY_SCHEMA,
    relationshipSemantic: SUPPORT_STEEL_RELATIONSHIP_SEMANTIC,
    contactEvidenceStatus: 'NOT_PROVEN',
    relationshipCardinality,
    supportFamilyId: family.familyId,
    supportPositionGlobal: family.supportPositionGlobal || null,
    steelPositionGlobal: steel?.steelPositionGlobal || null,
    branchIds: [...(family.branchIds || [])],
    carrierIds: [...(family.carrierIds || [])],
    memberCount: family.members?.length || 0,
  };
}

function geometryFields(evidence = {}) {
  return {
    analyticalGeometryAvailable: Boolean(evidence.analyticalGeometryAvailable),
    geometryMethod: evidence.geometryMethod || 'UNAVAILABLE',
    geometryQuality: evidence.geometryQuality || 'NONE',
    structuralMemberId: evidence.structuralMemberId || null,
    supportPointUsedGlobal: evidence.supportPointGlobal || null,
    nearestPointOnSteelGlobal: evidence.nearestPointOnSteelGlobal || null,
    projectionToleranceMm: evidence.projectionToleranceMm ?? null,
    withinProjectionTolerance: Boolean(evidence.withinProjectionTolerance),
    contactEvidenceStatus: evidence.analyticalGeometryAvailable
      ? 'ANALYTICAL_PROXIMITY_ONLY'
      : 'NOT_PROVEN',
  };
}

function geometryDiagnostics(family, candidate, resolutionMode) {
  const evidence = candidate.geometryEvidence;
  if (evidence.analyticalGeometryAvailable) return [];
  return [{
    severity: 'INFO',
    code: 'ANALYTICAL_GEOMETRY_UNAVAILABLE',
    supportFamilyId: family.familyId,
    steelGroupId: candidate.steel.steelGroupId,
    resolutionMode,
    geometryMethod: evidence.geometryMethod,
    message: 'The relationship is not backed by a structural axis or bounds; representative position is retained only as supporting context.',
  }];
}

function projectSteelRelationships(steelGroups, relationships) {
  return steelGroups.map((steel) => ({
    ...cloneJson(steel),
    supportFamilyIds: relationships
      .filter((row) => row.steelGroupId === steel.steelGroupId && row.relationshipStatus !== 'AMBIGUOUS')
      .map((row) => row.supportFamilyId)
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort(),
  }));
}

function buildSummary(supportFamilies, steelGroups, relationships, supportMemberChain) {
  const familyStatuses = supportFamilies.map((family) => strongestFamilyStatus(family.steelRelationships));
  return {
    supportFamilyCount: supportFamilies.length,
    steelGroupCount: steelGroups.length,
    analyticalSteelGroupCount: steelGroups.filter((steel) => steel.analyticalGeometry?.analyticalMemberCount > 0).length,
    analyticalSupportMemberCount: supportMemberChain.summary.analyticalMemberCount,
    relationshipCount: relationships.filter((row) => row.steelGroupId).length,
    resolvedFamilyCount: familyStatuses.filter((status) => status.startsWith('RESOLVED_')).length,
    analyticalSpatialResolvedFamilyCount: supportFamilies.filter((family) => family.steelRelationships.some(
      (row) => row.relationshipStatus === 'RESOLVED_SPATIAL' && row.analyticalGeometryAvailable,
    )).length,
    supportChainEdgeCount: supportMemberChain.summary.supportChainEdgeCount,
    nearbyMemberCandidateCount: supportMemberChain.summary.nearbyCandidateEdgeCount,
    structuralTerminalEdgeCount: supportMemberChain.summary.structuralTerminalEdgeCount,
    unresolvedPhysicalMemberCount: supportMemberChain.summary.unresolvedPhysicalMemberCount,
    ambiguousFamilyCount: familyStatuses.filter((status) => status === 'AMBIGUOUS').length,
    unresolvedFamilyCount: familyStatuses.filter((status) => status === 'UNRESOLVED').length,
  };
}

function strongestFamilyStatus(rows = []) {
  if (rows.some((row) => row.relationshipStatus === 'AMBIGUOUS')) return 'AMBIGUOUS';
  if (rows.some((row) => row.relationshipStatus === 'RESOLVED_EXPLICIT')) return 'RESOLVED_EXPLICIT';
  if (rows.some((row) => row.relationshipStatus === 'RESOLVED_SPATIAL')) return 'RESOLVED_SPATIAL';
  if (rows.some((row) => row.relationshipStatus === 'RESOLVED_SHARED_OWNER')) return 'RESOLVED_SHARED_OWNER';
  return 'UNRESOLVED';
}

function compareCandidates(left, right) {
  const distanceDelta = left.distanceMm - right.distanceMm;
  if (Math.abs(distanceDelta) > 1e-9) return distanceDelta;
  return geometryRank(left.geometryEvidence?.geometryQuality) - geometryRank(right.geometryEvidence?.geometryQuality);
}

function geometryRank(quality) {
  return ({ HIGH: 0, MEDIUM: 1, LOW: 2, FALLBACK: 3, NONE: 4 })[quality] ?? 5;
}

function spatialConfidence(quality) {
  if (quality === 'HIGH') return 'HIGH';
  if (quality === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

function tokenMatches(reference, steelToken) {
  return reference === steelToken || reference.startsWith(`${steelToken}/`) || steelToken.startsWith(`${reference}/`);
}

function normalizeToken(value) {
  return cleanText(value).replace(/\(REF\)$/iu, '').toUpperCase();
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function publicConfig(config) {
  return {
    supportFamilyPattern: config.supportFamilyPattern,
    steelGroupPattern: config.steelGroupPattern,
    supportTypes: [...config.supportTypes],
    steelTypes: [...config.steelTypes],
    explicitSteelReferenceKeys: [...config.explicitSteelReferenceKeys],
    ownerEvidenceKeys: [...config.ownerEvidenceKeys],
    projectionToleranceMm: config.projectionToleranceMm,
    ambiguityDeltaMm: config.ambiguityDeltaMm,
    requireAnalyticalGeometryForSpatialResolution: config.requireAnalyticalGeometryForSpatialResolution,
    memberContactToleranceMm: Number.isFinite(Number(config.memberContactToleranceMm)) ? Number(config.memberContactToleranceMm) : 2,
    memberCandidateToleranceMm: Number.isFinite(Number(config.memberCandidateToleranceMm)) ? Number(config.memberCandidateToleranceMm) : 25,
  };
}
