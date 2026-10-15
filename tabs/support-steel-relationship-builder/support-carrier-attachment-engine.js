import { supportToCarrierGeometryDistance } from './support-carrier-analytical-geometry.js';

export const SUPPORT_CARRIER_ATTACHMENT_SCHEMA = 'SupportCarrierAttachmentBundle.v1';

const SYMBOLIC_ROLES = new Set(['DATUM', 'STRUCTURAL_REFERENCE']);

export function buildSupportCarrierAttachmentBundle(input = {}) {
  const config = resolveAttachmentConfig(input.config);
  const memberIndex = indexSupportMembers(input.supportFamilies || []);
  const carrierIndex = new Map((input.carrierObjects || []).map((row) => [row.carrierObjectId, row]));
  const evaluations = [];
  const supportCarrierAttachmentEdges = [];
  const nearbyCarrierAttachmentCandidates = [];
  const unresolvedCarrierAttachments = [];
  const diagnostics = [];

  for (const identityEdge of input.supportCarrierEdges || []) {
    const member = memberIndex.get(identityEdge.supportMemberId);
    const carrier = carrierIndex.get(identityEdge.carrierObjectId);
    const evaluation = evaluateAttachment(identityEdge, member, carrier, config);
    evaluations.push(evaluation);
    if (evaluation.attachmentStatus === 'ANALYTICAL_CARRIER_CONTACT_CANDIDATE') {
      supportCarrierAttachmentEdges.push(attachmentEdge(evaluation));
    } else if (evaluation.attachmentStatus === 'ANALYTICAL_CARRIER_NEARBY_CANDIDATE') {
      nearbyCarrierAttachmentCandidates.push(nearbyEdge(evaluation));
    } else if (evaluation.attachmentStatus.startsWith('UNRESOLVED_')) {
      unresolvedCarrierAttachments.push(evaluation);
      diagnostics.push(attachmentDiagnostic(evaluation));
    }
  }

  return {
    schema: SUPPORT_CARRIER_ATTACHMENT_SCHEMA,
    relationshipSemantic: 'SUPPORT_MEMBER_TO_CARRIER_ANALYTICAL_ATTACHMENT',
    confirmedPhysicalContactAvailable: false,
    config,
    evaluations,
    supportCarrierAttachmentEdges,
    nearbyCarrierAttachmentCandidates,
    unresolvedCarrierAttachments,
    summary: {
      evaluatedCarrierEdgeCount: evaluations.length,
      analyticalCarrierContactCandidateCount: supportCarrierAttachmentEdges.length,
      nearbyCarrierAttachmentCandidateCount: nearbyCarrierAttachmentCandidates.length,
      unresolvedCarrierAttachmentCount: unresolvedCarrierAttachments.length,
      analyticalCarrierGeometryCount: unique(
        (input.carrierObjects || [])
          .filter((row) => row.analyticalGeometry?.physicalCarrierGeometryAvailable)
          .map((row) => row.carrierObjectId),
      ).length,
    },
    diagnostics,
  };
}

export function resolveAttachmentConfig(config = {}) {
  const contact = positiveOrZero(config.carrierContactToleranceMm, 2);
  const candidate = Math.max(
    contact,
    positiveOrZero(config.carrierCandidateToleranceMm, 25),
  );
  return {
    carrierContactToleranceMm: contact,
    carrierCandidateToleranceMm: candidate,
    requireAnalyticalCarrierGeometry: config.requireAnalyticalCarrierGeometry !== false,
    emitNearbyCarrierCandidates: config.emitNearbyCarrierCandidates !== false,
  };
}

function evaluateAttachment(identityEdge, member, carrier, config) {
  const base = {
    evaluationId: `SSCA:${identityEdge.supportMemberId}::${identityEdge.carrierObjectId}`,
    identityEvidenceId: identityEdge.evidenceId || identityEdge.edgeId,
    supportFamilyId: identityEdge.supportFamilyId,
    supportMemberId: identityEdge.supportMemberId,
    supportMemberRole: member?.semanticRole || 'UNKNOWN',
    carrierObjectId: identityEdge.carrierObjectId,
    carrierObjectClass: carrier?.carrierObjectClass || null,
    attachmentStatus: 'UNRESOLVED_ATTACHMENT',
    contactEvidenceStatus: 'NOT_PROVEN',
    relationshipCardinality: 'ONE_TO_ONE',
    relationshipBasis: [...(identityEdge.relationshipBasis || [])],
    carrierContactToleranceMm: config.carrierContactToleranceMm,
    carrierCandidateToleranceMm: config.carrierCandidateToleranceMm,
    distanceMm: null,
    geometryMethod: 'UNAVAILABLE',
    geometryQuality: 'NONE',
    analyticalGeometryAvailable: false,
    contactPointGlobal: null,
    nearestPointOnSupportGlobal: null,
    nearestPointOnCarrierGlobal: null,
  };
  if (!member) return { ...base, attachmentStatus: 'UNRESOLVED_SUPPORT_MEMBER_NOT_FOUND' };
  if (!carrier) return { ...base, attachmentStatus: 'UNRESOLVED_CARRIER_OBJECT_NOT_FOUND' };
  if (SYMBOLIC_ROLES.has(member.semanticRole)) {
    return { ...base, attachmentStatus: 'NOT_APPLICABLE_SYMBOLIC_MEMBER' };
  }
  if (!member.analyticalGeometry?.physicalGeometryAvailable) {
    return { ...base, attachmentStatus: 'UNRESOLVED_SUPPORT_ANALYTICAL_GEOMETRY' };
  }
  if (!carrier.analyticalGeometry?.physicalCarrierGeometryAvailable) {
    return { ...base, attachmentStatus: 'UNRESOLVED_CARRIER_ANALYTICAL_GEOMETRY' };
  }
  const distance = supportToCarrierGeometryDistance(member, carrier);
  const analytical = Boolean(distance.analyticalGeometryAvailable);
  const record = {
    ...base,
    distanceMm: distance.distanceMm,
    geometryMethod: distance.geometryMethod,
    geometryQuality: distance.geometryQuality,
    analyticalGeometryAvailable: analytical,
    contactPointGlobal: distance.contactPointGlobal,
    nearestPointOnSupportGlobal: distance.nearestPointOnLeftGlobal,
    nearestPointOnCarrierGlobal: distance.nearestPointOnRightGlobal,
    relationshipBasis: [...base.relationshipBasis, 'WORLD_ANALYTICAL_GEOMETRY_DISTANCE'],
  };
  if (!analytical || !Number.isFinite(distance.distanceMm)) {
    return { ...record, attachmentStatus: 'UNRESOLVED_ANALYTICAL_DISTANCE' };
  }
  if (distance.distanceMm <= config.carrierContactToleranceMm) {
    return {
      ...record,
      attachmentStatus: 'ANALYTICAL_CARRIER_CONTACT_CANDIDATE',
      contactEvidenceStatus: 'ANALYTICAL_CONTACT_CANDIDATE',
      confidence: geometryConfidence(distance.geometryQuality),
    };
  }
  if (distance.distanceMm <= config.carrierCandidateToleranceMm) {
    return {
      ...record,
      attachmentStatus: config.emitNearbyCarrierCandidates
        ? 'ANALYTICAL_CARRIER_NEARBY_CANDIDATE'
        : 'OUTSIDE_CARRIER_CONTACT_TOLERANCE',
      contactEvidenceStatus: 'CLEARANCE_ONLY',
      confidence: 'NONE',
    };
  }
  return {
    ...record,
    attachmentStatus: 'OUTSIDE_CARRIER_CANDIDATE_TOLERANCE',
    contactEvidenceStatus: 'OUT_OF_TOLERANCE',
    confidence: 'NONE',
  };
}

function attachmentEdge(row) {
  return {
    edgeId: `SSCA-EDGE:${row.supportMemberId}::${row.carrierObjectId}`,
    edgeType: 'SUPPORT_MEMBER_TO_CARRIER_ATTACHMENT',
    supportFamilyId: row.supportFamilyId,
    supportMemberId: row.supportMemberId,
    supportMemberRole: row.supportMemberRole,
    carrierObjectId: row.carrierObjectId,
    relationshipStatus: row.attachmentStatus,
    relationshipBasis: row.relationshipBasis,
    confidence: row.confidence,
    evidenceId: row.evaluationId,
    identityEvidenceId: row.identityEvidenceId,
    evidenceClass: 'ANALYTICAL',
    contactEvidenceStatus: row.contactEvidenceStatus,
    distanceMm: row.distanceMm,
    geometryMethod: row.geometryMethod,
    geometryQuality: row.geometryQuality,
    contactPointGlobal: row.contactPointGlobal,
    nearestPointOnSupportGlobal: row.nearestPointOnSupportGlobal,
    nearestPointOnCarrierGlobal: row.nearestPointOnCarrierGlobal,
  };
}

function nearbyEdge(row) {
  return {
    ...attachmentEdge(row),
    edgeId: `SSCA-NEARBY:${row.supportMemberId}::${row.carrierObjectId}`,
    edgeType: 'SUPPORT_MEMBER_TO_CARRIER_NEARBY',
    confidence: 'NONE',
  };
}

function attachmentDiagnostic(row) {
  return {
    severity: 'INFO',
    code: row.attachmentStatus,
    supportFamilyId: row.supportFamilyId,
    supportMemberId: row.supportMemberId,
    carrierObjectId: row.carrierObjectId,
    message: diagnosticMessage(row.attachmentStatus),
  };
}

function diagnosticMessage(status) {
  return ({
    UNRESOLVED_SUPPORT_MEMBER_NOT_FOUND: 'The resolved carrier identity edge references an unavailable support member.',
    UNRESOLVED_CARRIER_OBJECT_NOT_FOUND: 'The resolved carrier identity edge references an unavailable carrier object.',
    UNRESOLVED_SUPPORT_ANALYTICAL_GEOMETRY: 'The support member has no analytical bounds or axis for carrier attachment evaluation.',
    UNRESOLVED_CARRIER_ANALYTICAL_GEOMETRY: 'The carrier object has no analytical bounds or axis for attachment evaluation.',
    UNRESOLVED_ANALYTICAL_DISTANCE: 'Analytical support-to-carrier distance could not be calculated.',
  })[status] || 'Carrier attachment evidence remains unresolved.';
}

function indexSupportMembers(families) {
  const map = new Map();
  for (const family of families || []) {
    for (const member of family.members || []) {
      if (member.memberId) map.set(member.memberId, member);
    }
  }
  return map;
}

function geometryConfidence(quality) {
  if (quality === 'HIGH') return 'HIGH';
  if (quality === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

function positiveOrZero(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}
