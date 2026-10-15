import { extractFamilyRoot, uniqueSorted } from './ps-family-token-utils.js';
import {
  PS_FAMILY_EVIDENCE_SOURCE_SCHEMA,
  SYMBOLIC_SUPPORT_ROLES,
  evidenceId,
  formatEvidencePoint,
  representativeEvidenceSupport,
} from './ps-family-evidence-graph-shared.js';
import {
  lineProjectionFields,
  resolveEdgeLineProjection,
  resolveMemberLineMembership,
} from './ps-family-evidence-line-memberships.js';

export function createEvidenceMemberRows(
  family,
  supportGroup,
  relationships,
  chainEdges,
  referenceEdges,
  terminalEdges,
  membershipIndex = new Map(),
  primaryMembership = null,
) {
  const representative = representativeEvidenceSupport(family);
  const rows = (family.members || []).map((member) => memberRow(
    member,
    family,
    supportGroup,
    representative,
    chainEdges,
    referenceEdges,
    terminalEdges,
    membershipIndex,
    primaryMembership,
  ));
  uniqueSorted(relationships.map((row) => row.steelGroupId).filter(Boolean)).forEach((steelGroupId) => {
    rows.push({
      supportGroup,
      representativeSupport: representative,
      support: steelGroupId,
      memberType: 'StructuralGroup',
      connectedTo: uniqueSorted(terminalEdges
        .filter((edge) => edge.steelGroupId === steelGroupId)
        .map((edge) => edge.supportMemberId)),
      evidenceIds: relationships.filter((row) => row.steelGroupId === steelGroupId).map(evidenceId),
      coverageRole: 'Resolved structural group',
      remarks: 'Structural group from relationship evidence.',
      ...lineProjectionFields(primaryMembership),
    });
  });
  return rows;
}

export function createEvidenceInputRows(
  family,
  supportGroup,
  context,
  relationships,
  memberEdges,
  nearbyEdges,
  referenceEdges,
  terminalEdges,
  membershipIndex = new Map(),
  primaryMembership = null,
) {
  const row = (edge, fromType, toType, parsedEdge, familyLevel = false) => {
    const projection = familyLevel
      ? { membership: primaryMembership, lineMembershipIds: [primaryMembership?.membershipId].filter(Boolean) }
      : resolveEdgeLineProjection(edge, membershipIndex, primaryMembership);
    return {
      sourceInput: PS_FAMILY_EVIDENCE_SOURCE_SCHEMA,
      sourceSchema: edge.sourceSchema || PS_FAMILY_EVIDENCE_SOURCE_SCHEMA,
      evidenceId: evidenceId(edge),
      evidenceClass: edge.evidenceClass || 'INFERRED',
      fromType,
      toType,
      ...lineProjectionFields(projection),
      supportGroup: projection.membership?.supportGroup || supportGroup,
      distance: edge.distanceMm ?? null,
      parsedEdge,
      supportFamilyId: family.familyId,
      contactEvidenceStatus: edge.contactEvidenceStatus || '',
    };
  };
  return [
    ...relationships.map((edge) => row(
      edge,
      'SUPPORT_FAMILY',
      'STRUCTURAL_GROUP',
      edge.relationshipSemantic || edge.relationshipStatus,
      true,
    )),
    ...memberEdges.map((edge) => row(edge, 'SUPPORT_MEMBER', 'SUPPORT_MEMBER', edge.edgeType)),
    ...nearbyEdges.map((edge) => row(edge, 'SUPPORT_MEMBER', 'SUPPORT_MEMBER', edge.edgeType)),
    ...referenceEdges.map((edge) => row(edge, 'SUPPORT_MEMBER', 'SUPPORT_MEMBER', edge.edgeType)),
    ...terminalEdges.map((edge) => row(
      edge,
      'SUPPORT_MEMBER',
      edge.edgeType === 'STRUCTURAL_REFERENCE' ? 'STRUCTURAL_GROUP' : 'STRUCTURAL_MEMBER',
      edge.edgeType,
    )),
  ];
}

export function createEvidenceMatrixRows(
  supportGroup,
  relationships,
  memberEdges,
  referenceEdges,
  terminalEdges,
) {
  return [
    ...relationships.filter((edge) => edge.steelGroupId).map((edge) => ({
      supportGroup,
      from: edge.supportFamilyId,
      to: edge.steelGroupId,
      edgeType: 'SUPPORT_FAMILY_TO_STRUCTURE',
      evidenceId: evidenceId(edge),
      sourceInput: PS_FAMILY_EVIDENCE_SOURCE_SCHEMA,
      status: edge.relationshipStatus,
    })),
    ...memberEdges.map((edge) => ({
      supportGroup,
      from: edge.supportA,
      to: edge.supportB,
      edgeType: edge.edgeType,
      evidenceId: evidenceId(edge),
      sourceInput: PS_FAMILY_EVIDENCE_SOURCE_SCHEMA,
      status: edge.contactEvidenceStatus,
    })),
    ...referenceEdges.map((edge) => ({
      supportGroup,
      from: edge.fromMemberId,
      to: edge.toMemberId,
      edgeType: edge.edgeType,
      evidenceId: evidenceId(edge),
      sourceInput: PS_FAMILY_EVIDENCE_SOURCE_SCHEMA,
      status: edge.relationshipStatus,
    })),
    ...terminalEdges.map((edge) => ({
      supportGroup,
      from: edge.supportMemberId,
      to: edge.structuralMemberId || edge.steelGroupId,
      edgeType: edge.edgeType,
      evidenceId: evidenceId(edge),
      sourceInput: PS_FAMILY_EVIDENCE_SOURCE_SCHEMA,
      status: edge.contactEvidenceStatus || edge.relationshipStatus,
    })),
  ];
}

export function createEvidenceStructureBasisRows(
  bundle,
  family,
  supportGroup,
  context,
  relationships,
  physicalTerminals,
  membershipIndex = new Map(),
  primaryMembership = null,
) {
  const groups = groupRelationshipsBySteel(relationships);
  return [...groups.entries()].map(([steelGroupId, rows]) => {
    const steel = (bundle.steelGroups || []).find((item) => item.steelGroupId === steelGroupId);
    const terminals = physicalTerminals.filter((edge) => edge.steelGroupId === steelGroupId);
    const supports = uniqueSorted(terminals.map((edge) => edge.supportMemberId));
    const representative = terminals[0];
    const membership = resolveMemberLineMembership(
      membershipIndex,
      representative?.supportMemberId,
      primaryMembership,
    );
    const lineFields = lineProjectionFields(membership);
    return {
      structuralGroupRoot: extractFamilyRoot(steelGroupId) || steelGroupId,
      structuralGroupNames: uniqueSorted((steel?.records || [])
        .map((record) => record.recordId)
        .filter(Boolean)).join('|') || steelGroupId,
      lineNo: lineFields.fullLineTag || context.fullLineTag,
      lineFamily: lineFields.lineFamily || context.lineFamily,
      branchNode: lineFields.branchNode || context.branchNode,
      lineMembershipId: lineFields.lineMembershipId,
      supportGroup: membership?.supportGroup || supportGroup,
      supportsWithin250mm: supports.join('|'),
      supportCount: supports.length,
      totalSupportCount: supports.length,
      representativeSupport: representative?.supportMemberId || representativeEvidenceSupport(family),
      representativeCoordinate: formatEvidencePoint(
        representative?.contactPointGlobal || representative?.nearestPointOnSupportGlobal,
      ),
      evidenceIds: uniqueSorted([...rows.map(evidenceId), ...terminals.map(evidenceId)]).join('|'),
      remarks: terminals.length
        ? 'Analytical structural terminal basis.'
        : 'Relationship basis without analytical member terminal.',
    };
  });
}

function memberRow(
  member,
  family,
  supportGroup,
  representative,
  chainEdges,
  referenceEdges,
  terminalEdges,
  membershipIndex,
  primaryMembership,
) {
  const connectedTo = [];
  chainEdges.forEach((edge) => {
    if (edge.supportA === member.memberId) connectedTo.push(edge.supportB);
    if (edge.supportB === member.memberId) connectedTo.push(edge.supportA);
  });
  referenceEdges.forEach((edge) => {
    if (edge.fromMemberId === member.memberId) connectedTo.push(edge.toMemberId);
    if (edge.toMemberId === member.memberId) connectedTo.push(edge.fromMemberId);
  });
  terminalEdges.forEach((edge) => {
    if (edge.supportMemberId === member.memberId) {
      connectedTo.push(edge.structuralMemberId || edge.steelGroupId);
    }
  });
  const membership = resolveMemberLineMembership(membershipIndex, member.memberId, primaryMembership);
  return {
    supportGroup: membership?.supportGroup || supportGroup,
    representativeSupport: representative,
    support: member.memberId,
    memberType: member.semanticRole || 'OTHER_FAMILY_MEMBER',
    connectedTo: uniqueSorted(connectedTo),
    evidenceIds: uniqueSorted([
      ...chainEdges.filter((edge) => edge.supportA === member.memberId || edge.supportB === member.memberId).map(evidenceId),
      ...referenceEdges.filter((edge) => edge.fromMemberId === member.memberId || edge.toMemberId === member.memberId).map(evidenceId),
      ...terminalEdges.filter((edge) => edge.supportMemberId === member.memberId).map(evidenceId),
    ]),
    coverageRole: memberCoverageRole(member),
    remarks: connectedTo.length ? 'Connected in evidence graph.' : 'No graph connection established.',
    supportFamilyId: family.familyId,
    ...lineProjectionFields(membership),
  };
}

function memberCoverageRole(member) {
  if (SYMBOLIC_SUPPORT_ROLES.has(member.semanticRole)) return 'Symbolic evidence node';
  if (member.analyticalGeometry?.physicalGeometryAvailable || member.analyticalGeometry?.geometryAvailable) {
    return 'Analytical physical member';
  }
  return 'Physical member without analytical geometry';
}

function groupRelationshipsBySteel(relationships) {
  const groups = new Map();
  relationships.filter((row) => row.steelGroupId).forEach((relationship) => {
    if (!groups.has(relationship.steelGroupId)) groups.set(relationship.steelGroupId, []);
    groups.get(relationship.steelGroupId).push(relationship);
  });
  return groups;
}
