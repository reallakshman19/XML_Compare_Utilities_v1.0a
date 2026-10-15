import {
  SUPPORT_MEMBER_ANALYTICAL_GEOMETRY_SCHEMA,
  buildSupportMemberAnalyticalGeometry,
  pointToSupportMemberGeometryDistance,
  supportMemberGeometryDistance,
} from './support-member-analytical-geometry.js';

export const SUPPORT_MEMBER_CHAIN_SCHEMA = 'SupportMemberChainBundle.v1';
export const SUPPORT_MEMBER_CHAIN_EVIDENCE_SOURCE = 'STAGED_JSON_MEMBER_GEOMETRY_ENGINE';

const SYMBOLIC_ROLES = new Set(['DATUM', 'STRUCTURAL_REFERENCE']);
const DEFAULT_CONFIG = Object.freeze({
  memberContactToleranceMm: 2,
  memberCandidateToleranceMm: 25,
  requireAnalyticalGeometry: true,
  emitNearbyCandidates: true,
});

const ROLE_COMPATIBILITY = new Set([
  'WEAR_PLATE::PIPE_SHOE',
  'WEAR_PLATE::CLAMP_MEMBER',
  'WEAR_PLATE::OTHER_FAMILY_MEMBER',
  'PIPE_SHOE::GUIDE_MEMBER',
  'PIPE_SHOE::LINE_STOP_MEMBER',
  'PIPE_SHOE::ANCHOR_MEMBER',
  'PIPE_SHOE::SPRING_MEMBER',
  'PIPE_SHOE::BRACKET_MEMBER',
  'PIPE_SHOE::OTHER_FAMILY_MEMBER',
  'CLAMP_MEMBER::GUIDE_MEMBER',
  'CLAMP_MEMBER::LINE_STOP_MEMBER',
  'CLAMP_MEMBER::ANCHOR_MEMBER',
  'CLAMP_MEMBER::SPRING_MEMBER',
  'CLAMP_MEMBER::BRACKET_MEMBER',
  'CLAMP_MEMBER::OTHER_FAMILY_MEMBER',
  'GUIDE_MEMBER::BRACKET_MEMBER',
  'LINE_STOP_MEMBER::BRACKET_MEMBER',
  'ANCHOR_MEMBER::BRACKET_MEMBER',
  'SPRING_MEMBER::BRACKET_MEMBER',
  'BRACKET_MEMBER::OTHER_FAMILY_MEMBER',
]);

const EXPLICIT_MEMBER_REFERENCE_KEYS = Object.freeze([
  'CONNECTED_TO',
  'CONNECTS_TO',
  'MEMBER_REF',
  'SUPPORT_MEMBER_REF',
  'MATE',
  'PARENT_MEMBER',
  'CHILD_MEMBER',
]);

const EXPLICIT_STEEL_REFERENCE_KEYS = Object.freeze([
  'STEEL_REF',
  'STEELREF',
  'STRUCTURE_REF',
  'STRUCTUREREF',
  'SREF',
  'MDSSREF',
  'MDSGUIDEREF',
]);

export function buildSupportMemberChainBundle(input = {}) {
  const config = resolveConfig(input.config);
  const supportFamilies = input.supportFamilies || [];
  const relationships = input.relationships || [];
  const familyChains = supportFamilies.map((family) => buildFamilyChain(
    family,
    relationships.filter((row) => row.supportFamilyId === family.familyId),
    config,
  ));
  const supportChainEdges = familyChains.flatMap((family) => family.supportChainEdges);
  const nearbyCandidateEdges = familyChains.flatMap((family) => family.nearbyCandidateEdges);
  const referenceEdges = familyChains.flatMap((family) => family.referenceEdges);
  const structuralTerminalEdges = familyChains.flatMap((family) => family.structuralTerminalEdges);
  const diagnostics = familyChains.flatMap((family) => family.diagnostics);
  return {
    schema: SUPPORT_MEMBER_CHAIN_SCHEMA,
    geometrySchema: SUPPORT_MEMBER_ANALYTICAL_GEOMETRY_SCHEMA,
    evidenceSource: SUPPORT_MEMBER_CHAIN_EVIDENCE_SOURCE,
    bundlePurpose: 'XML_FREE_SUPPORT_MEMBER_CONNECTIVITY',
    config,
    summary: {
      familyCount: familyChains.length,
      memberCount: familyChains.reduce((sum, family) => sum + family.memberNodes.length, 0),
      analyticalMemberCount: familyChains.reduce((sum, family) => sum + family.analyticalMemberCount, 0),
      supportChainEdgeCount: supportChainEdges.length,
      nearbyCandidateEdgeCount: nearbyCandidateEdges.length,
      referenceEdgeCount: referenceEdges.length,
      structuralTerminalEdgeCount: structuralTerminalEdges.length,
      unresolvedPhysicalMemberCount: familyChains.reduce((sum, family) => sum + family.unresolvedPhysicalMemberIds.length, 0),
    },
    familyChains,
    supportChainEdges,
    nearbyCandidateEdges,
    referenceEdges,
    structuralTerminalEdges,
    diagnostics,
  };
}

function buildFamilyChain(family, relationships, config) {
  const memberNodes = (family.members || []).map((member) => ({
    ...member,
    analyticalGeometry: member.analyticalGeometry
      || buildSupportMemberAnalyticalGeometry(member, config),
  }));
  const physicalMembers = memberNodes.filter((member) => (
    !SYMBOLIC_ROLES.has(member.semanticRole)
    && member.analyticalGeometry?.physicalGeometryAvailable
  ));
  const supportChainEdges = [];
  const nearbyCandidateEdges = [];
  const diagnostics = [];

  for (let leftIndex = 0; leftIndex < physicalMembers.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < physicalMembers.length; rightIndex += 1) {
      const left = physicalMembers[leftIndex];
      const right = physicalMembers[rightIndex];
      const evidence = supportMemberGeometryDistance(left, right);
      if (!Number.isFinite(evidence.distanceMm)) continue;
      const compatible = rolesCompatible(left.semanticRole, right.semanticRole);
      if (evidence.distanceMm <= config.memberContactToleranceMm) {
        supportChainEdges.push(contactEdge(family, left, right, evidence, compatible, config));
      } else if (config.emitNearbyCandidates && evidence.distanceMm <= config.memberCandidateToleranceMm) {
        nearbyCandidateEdges.push(candidateEdge(family, left, right, evidence, compatible, config));
      }
    }
  }

  const referenceEdges = buildExplicitReferenceEdges(family, memberNodes);
  const structuralTerminalEdges = buildStructuralTerminalEdges(
    family,
    physicalMembers,
    memberNodes,
    relationships,
    config,
  );
  const connectedMemberIds = new Set([
    ...supportChainEdges.flatMap((edge) => [edge.supportA, edge.supportB]),
    ...structuralTerminalEdges
      .filter((edge) => edge.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE')
      .map((edge) => edge.supportMemberId),
  ]);
  const unresolvedPhysicalMemberIds = physicalMembers
    .map((member) => member.memberId)
    .filter((memberId) => memberId && !connectedMemberIds.has(memberId));

  if (!physicalMembers.length && memberNodes.length) {
    diagnostics.push({
      severity: 'WARNING',
      code: 'SUPPORT_FAMILY_HAS_NO_PHYSICAL_MEMBER_GEOMETRY',
      supportFamilyId: family.familyId,
      message: 'Family members were reconstructed, but no non-symbolic member has analytical axis or bounds geometry.',
    });
  }
  for (const memberId of unresolvedPhysicalMemberIds) {
    diagnostics.push({
      severity: 'INFO',
      code: 'SUPPORT_MEMBER_NOT_CONNECTED_BY_ANALYTICAL_GEOMETRY',
      supportFamilyId: family.familyId,
      memberId,
      message: 'No in-tolerance analytical contact edge was established for this physical support member.',
    });
  }
  return {
    familyId: family.familyId,
    memberNodes,
    analyticalMemberCount: physicalMembers.length,
    supportChainEdges,
    nearbyCandidateEdges,
    referenceEdges,
    structuralTerminalEdges,
    connectedComponents: connectedComponents(memberNodes, supportChainEdges),
    unresolvedPhysicalMemberIds,
    diagnostics,
  };
}

function contactEdge(family, left, right, evidence, compatible, config) {
  return {
    edgeId: `SSMC:${left.memberId}::${right.memberId}`,
    edgeType: 'SUPPORT_MEMBER_CONTACT',
    supportFamilyId: family.familyId,
    supportA: left.memberId,
    supportB: right.memberId,
    roleA: left.semanticRole,
    roleB: right.semanticRole,
    relationshipStatus: 'RESOLVED_ANALYTICAL_CONTACT',
    relationshipBasis: [
      'SAME_SUPPORT_FAMILY',
      compatible ? 'ROLE_COMPATIBILITY' : 'GEOMETRY_ONLY',
      'WORLD_ANALYTICAL_GEOMETRY',
    ],
    evidenceSource: SUPPORT_MEMBER_CHAIN_EVIDENCE_SOURCE,
    evidenceClass: 'ANALYTICAL',
    contactEvidenceStatus: 'ANALYTICAL_CONTACT_CANDIDATE',
    confidence: confidenceForEvidence(evidence.geometryQuality, compatible),
    distanceMm: evidence.distanceMm,
    contactToleranceMm: config.memberContactToleranceMm,
    geometryMethod: evidence.geometryMethod,
    geometryQuality: evidence.geometryQuality,
    contactPointGlobal: evidence.contactPointGlobal,
    nearestPointOnAGlobal: evidence.nearestPointOnLeftGlobal,
    nearestPointOnBGlobal: evidence.nearestPointOnRightGlobal,
  };
}

function candidateEdge(family, left, right, evidence, compatible, config) {
  return {
    edgeId: `SSMC-CANDIDATE:${left.memberId}::${right.memberId}`,
    edgeType: 'SUPPORT_MEMBER_NEARBY_CANDIDATE',
    supportFamilyId: family.familyId,
    supportA: left.memberId,
    supportB: right.memberId,
    roleA: left.semanticRole,
    roleB: right.semanticRole,
    relationshipStatus: 'NEARBY_ANALYTICAL_CANDIDATE',
    relationshipBasis: [
      'SAME_SUPPORT_FAMILY',
      compatible ? 'ROLE_COMPATIBILITY' : 'GEOMETRY_ONLY',
      'WORLD_ANALYTICAL_GEOMETRY',
    ],
    evidenceSource: SUPPORT_MEMBER_CHAIN_EVIDENCE_SOURCE,
    evidenceClass: 'ANALYTICAL',
    contactEvidenceStatus: 'CLEARANCE_ONLY',
    confidence: 'LOW',
    distanceMm: evidence.distanceMm,
    candidateToleranceMm: config.memberCandidateToleranceMm,
    geometryMethod: evidence.geometryMethod,
    geometryQuality: evidence.geometryQuality,
    contactPointGlobal: evidence.contactPointGlobal,
    nearestPointOnAGlobal: evidence.nearestPointOnLeftGlobal,
    nearestPointOnBGlobal: evidence.nearestPointOnRightGlobal,
  };
}

function buildExplicitReferenceEdges(family, members) {
  const memberIds = new Set(members.map((member) => normalizeId(member.memberId)).filter(Boolean));
  const edges = [];
  for (const member of members) {
    for (const key of EXPLICIT_MEMBER_REFERENCE_KEYS) {
      const target = normalizeId(member.attributes?.[key]);
      if (!target || !memberIds.has(target) || target === normalizeId(member.memberId)) continue;
      const targetMember = members.find((candidate) => normalizeId(candidate.memberId) === target);
      const ordered = [member.memberId, targetMember?.memberId].sort();
      const edgeId = `SSMR:${ordered[0]}::${ordered[1]}`;
      if (edges.some((edge) => edge.edgeId === edgeId)) continue;
      edges.push({
        edgeId,
        edgeType: 'SUPPORT_MEMBER_REFERENCE',
        supportFamilyId: family.familyId,
        fromMemberId: member.memberId,
        toMemberId: targetMember?.memberId || target,
        relationshipStatus: 'RESOLVED_EXPLICIT_REFERENCE',
        relationshipBasis: [`ATTRIBUTE:${key}`],
        evidenceSource: SUPPORT_MEMBER_CHAIN_EVIDENCE_SOURCE,
        evidenceClass: 'EXPLICIT_REFERENCE',
        contactEvidenceStatus: 'NOT_PROVEN',
        confidence: 'HIGH',
      });
    }
  }
  return edges;
}

function buildStructuralTerminalEdges(family, physicalMembers, allMembers, relationships, config) {
  const edges = [];
  for (const relationship of relationships) {
    if (!relationship.steelGroupId || relationship.relationshipStatus === 'AMBIGUOUS') continue;
    const srefMembers = allMembers.filter((member) => (
      member.semanticRole === 'STRUCTURAL_REFERENCE'
      && symbolicReferenceMatchesRelationship(member, relationship)
    ));
    for (const sref of srefMembers) {
      edges.push({
        edgeId: `SSMR-STRUCT:${sref.memberId}::${relationship.structuralMemberId || relationship.steelGroupId}`,
        edgeType: 'STRUCTURAL_REFERENCE',
        supportFamilyId: family.familyId,
        supportMemberId: sref.memberId,
        steelGroupId: relationship.steelGroupId,
        structuralMemberId: relationship.structuralMemberId || null,
        relationshipStatus: 'RESOLVED_STRUCTURAL_REFERENCE',
        relationshipBasis: ['EXPLICIT_SREF_TARGET_MATCH', ...(relationship.relationshipBasis || [])],
        evidenceSource: SUPPORT_MEMBER_CHAIN_EVIDENCE_SOURCE,
        evidenceClass: 'REFERENCE',
        contactEvidenceStatus: 'NOT_PROVEN',
        confidence: relationship.confidence,
      });
    }

    if (!relationship.nearestPointOnSteelGlobal || !relationship.analyticalGeometryAvailable) continue;
    const candidates = physicalMembers
      .map((member) => ({
        member,
        evidence: pointToSupportMemberGeometryDistance(relationship.nearestPointOnSteelGlobal, member),
      }))
      .filter((candidate) => candidate.evidence.analyticalGeometryAvailable && Number.isFinite(candidate.evidence.distanceMm))
      .sort((left, right) => left.evidence.distanceMm - right.evidence.distanceMm);
    const nearest = candidates[0];
    if (!nearest || nearest.evidence.distanceMm > config.memberCandidateToleranceMm) continue;
    const inContact = nearest.evidence.distanceMm <= config.memberContactToleranceMm;
    edges.push({
      edgeId: `SSMC-STRUCT:${nearest.member.memberId}::${relationship.structuralMemberId || relationship.steelGroupId}`,
      edgeType: 'SUPPORT_MEMBER_TO_STRUCTURE',
      supportFamilyId: family.familyId,
      supportMemberId: nearest.member.memberId,
      supportMemberRole: nearest.member.semanticRole,
      steelGroupId: relationship.steelGroupId,
      structuralMemberId: relationship.structuralMemberId || null,
      relationshipStatus: inContact ? 'RESOLVED_ANALYTICAL_CONTACT' : 'NEARBY_ANALYTICAL_CANDIDATE',
      relationshipBasis: ['FAMILY_TO_STEEL_RELATIONSHIP', 'WORLD_ANALYTICAL_GEOMETRY'],
      evidenceSource: SUPPORT_MEMBER_CHAIN_EVIDENCE_SOURCE,
      evidenceClass: 'ANALYTICAL',
      contactEvidenceStatus: inContact ? 'ANALYTICAL_CONTACT_CANDIDATE' : 'CLEARANCE_ONLY',
      confidence: inContact ? confidenceForEvidence(nearest.evidence.geometryQuality, true) : 'LOW',
      distanceMm: nearest.evidence.distanceMm,
      geometryMethod: nearest.evidence.geometryMethod,
      geometryQuality: nearest.evidence.geometryQuality,
      contactPointGlobal: nearest.evidence.contactPointGlobal,
      nearestPointOnSupportGlobal: nearest.evidence.nearestPointOnRightGlobal,
      nearestPointOnSteelGlobal: relationship.nearestPointOnSteelGlobal,
    });
  }
  return deduplicateEdges(edges);
}

function symbolicReferenceMatchesRelationship(member, relationship) {
  const targets = EXPLICIT_STEEL_REFERENCE_KEYS
    .map((key) => normalizeId(member.attributes?.[key]))
    .filter(Boolean);
  if (!targets.length) return false;
  const steelGroup = normalizeId(relationship.steelGroupId);
  const structuralMember = normalizeId(relationship.structuralMemberId);
  return targets.some((target) => (
    identityMatches(target, steelGroup)
    || identityMatches(target, structuralMember)
  ));
}

function identityMatches(reference, target) {
  if (!reference || !target) return false;
  return reference === target
    || reference.startsWith(`${target}/`)
    || target.startsWith(`${reference}/`);
}

function connectedComponents(members, edges) {
  const ids = members.map((member) => member.memberId).filter(Boolean);
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id) => {
    let current = id;
    while (parent.get(current) !== current) {
      parent.set(current, parent.get(parent.get(current)));
      current = parent.get(current);
    }
    return current;
  };
  const union = (left, right) => {
    if (!parent.has(left) || !parent.has(right)) return;
    const rootLeft = find(left);
    const rootRight = find(right);
    if (rootLeft !== rootRight) parent.set(rootRight, rootLeft);
  };
  edges.forEach((edge) => union(edge.supportA, edge.supportB));
  const groups = new Map();
  for (const id of ids) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }
  return [...groups.values()].map((membersInComponent, index) => ({
    componentId: `COMPONENT-${index + 1}`,
    memberIds: membersInComponent.sort(),
  }));
}

function rolesCompatible(roleA, roleB) {
  const direct = `${roleA}::${roleB}`;
  const reverse = `${roleB}::${roleA}`;
  return ROLE_COMPATIBILITY.has(direct) || ROLE_COMPATIBILITY.has(reverse);
}

function confidenceForEvidence(quality, compatible) {
  if (quality === 'HIGH' && compatible) return 'HIGH';
  if ((quality === 'HIGH' || quality === 'MEDIUM') && compatible) return 'MEDIUM';
  return 'LOW';
}

function deduplicateEdges(edges) {
  const seen = new Set();
  return edges.filter((edge) => {
    if (seen.has(edge.edgeId)) return false;
    seen.add(edge.edgeId);
    return true;
  });
}

function normalizeId(value) {
  const text = String(value || '').trim().replace(/\(REF\)$/iu, '').toUpperCase();
  if (!text) return '';
  return text.startsWith('/') ? text : `/${text}`;
}

function resolveConfig(overrides = {}) {
  const nearbySetting = overrides.emitNearbyCandidates ?? overrides.emitNearbyMemberCandidates;
  return {
    memberContactToleranceMm: nonNegativeNumber(overrides.memberContactToleranceMm, DEFAULT_CONFIG.memberContactToleranceMm),
    memberCandidateToleranceMm: positiveNumber(overrides.memberCandidateToleranceMm, DEFAULT_CONFIG.memberCandidateToleranceMm),
    requireAnalyticalGeometry: overrides.requireAnalyticalGeometry !== false,
    emitNearbyCandidates: nearbySetting !== false,
  };
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}
