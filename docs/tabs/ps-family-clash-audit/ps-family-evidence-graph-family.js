import { uniqueSorted } from './ps-family-token-utils.js';
import {
  createEvidenceSupportGroup,
  deriveEvidenceFamilyContext,
  evidenceId,
} from './ps-family-evidence-graph-shared.js';
import { createEvidenceFamilyExceptions } from './ps-family-evidence-graph-exceptions.js';
import {
  createEvidenceInputRows,
  createEvidenceMatrixRows,
  createEvidenceMemberRows,
  createEvidenceStructureBasisRows,
} from './ps-family-evidence-graph-edges.js';
import {
  createMemberLineMembershipIndex,
  deriveEvidenceFamilyLineMemberships,
  resolveEdgeLineProjection,
} from './ps-family-evidence-line-memberships.js';
import {
  countMembershipEvidence,
  createFamilySummaryRow,
  createLineMembershipRow,
  createLineSupportTreeRow,
  createStructureContactRow,
  createSupportChainRow,
} from './ps-family-evidence-graph-family-projection.js';

export function projectEvidenceFamily(bundle, family, index, chain) {
  const context = deriveEvidenceFamilyContext(family);
  const memberships = deriveEvidenceFamilyLineMemberships(family, context);
  const membershipIndex = createMemberLineMembershipIndex(memberships);
  const primaryMembership = memberships.find((row) => row.isPrimary) || memberships[0] || null;
  const supportGroup = primaryMembership?.supportGroup
    || createEvidenceSupportGroup(context.lineFamily, family.familyId);
  const relationships = (bundle.relationships || []).filter((row) => (
    row.supportFamilyId === family.familyId
  ));
  const resolvedRelationships = relationships.filter((row) => (
    row.steelGroupId && String(row.relationshipStatus || '').startsWith('RESOLVED_')
  ));
  const ambiguousRelationships = relationships.filter((row) => row.relationshipStatus === 'AMBIGUOUS');
  const memberEdges = familyEdges(chain.supportChainEdges, family.familyId);
  const nearbyEdges = familyEdges(chain.nearbyCandidateEdges, family.familyId);
  const referenceEdges = familyEdges(chain.referenceEdges, family.familyId);
  const terminalEdges = familyEdges(chain.structuralTerminalEdges, family.familyId);
  const physicalTerminals = terminalEdges.filter((row) => row.edgeType === 'SUPPORT_MEMBER_TO_STRUCTURE');
  const symbolicTerminals = terminalEdges.filter((row) => row.edgeType === 'STRUCTURAL_REFERENCE');
  const familyChain = (chain.familyChains || []).find((row) => (
    row.supportFamilyId === family.familyId
  )) || {};
  const crossLineEdges = memberEdges.filter((edge) => (
    resolveEdgeLineProjection(edge, membershipIndex, primaryMembership).crossLine
  ));
  const exceptions = createEvidenceFamilyExceptions({
    family,
    context,
    memberships,
    crossLineEdges,
    supportGroup,
    resolvedRelationships,
    ambiguousRelationships,
    memberEdges,
    nearbyEdges,
    physicalTerminals,
    symbolicTerminals,
    familyChain,
  });
  const evidenceIds = uniqueSorted([
    ...relationships.map(evidenceId),
    ...memberEdges.map(evidenceId),
    ...referenceEdges.map(evidenceId),
    ...terminalEdges.map(evidenceId),
  ]);
  const summaryInput = {
    family,
    index,
    context,
    supportGroup,
    memberships,
    resolvedRelationships,
    physicalTerminals,
    symbolicTerminals,
    memberEdges,
    exceptions,
    evidenceIds,
  };

  return {
    supportSummaryRow: createFamilySummaryRow(summaryInput),
    lineMembershipRows: memberships.map(createLineMembershipRow),
    lineSupportTreeRows: memberships.map((membership) => createLineSupportTreeRow({
      family,
      membership,
      relationships,
      memberEdges,
      terminalEdges,
    })),
    structureContactRows: physicalTerminals.map((edge) => createStructureContactRow(
      edge,
      membershipIndex,
      primaryMembership,
    )),
    supportChainRows: memberEdges.map((edge) => createSupportChainRow(
      edge,
      membershipIndex,
      primaryMembership,
    )),
    supportMemberRows: createEvidenceMemberRows(
      family,
      supportGroup,
      relationships,
      memberEdges,
      referenceEdges,
      terminalEdges,
      membershipIndex,
      primaryMembership,
    ),
    supportExceptionRows: exceptions,
    inputEvidenceRows: createEvidenceInputRows(
      family,
      supportGroup,
      context,
      relationships,
      memberEdges,
      nearbyEdges,
      referenceEdges,
      terminalEdges,
      membershipIndex,
      primaryMembership,
    ),
    connectivityMatrixRows: createEvidenceMatrixRows(
      supportGroup,
      relationships,
      memberEdges,
      referenceEdges,
      terminalEdges,
    ),
    structureLineProximityRows: createEvidenceStructureBasisRows(
      bundle,
      family,
      supportGroup,
      context,
      relationships,
      physicalTerminals,
      membershipIndex,
      primaryMembership,
    ),
    lineFamilyRows: memberships.map((membership) => ({
      lineFamily: membership.lineFamily || 'NO_LINE_FAMILY',
      fullLineTag: membership.fullLineTag,
      branchNode: membership.branchNode,
      lineMembershipId: membership.membershipId,
      evidenceCount: countMembershipEvidence(
        membership,
        relationships,
        memberEdges,
        referenceEdges,
        terminalEdges,
      ),
      supportGroup: membership.supportGroup,
      supportFamilyId: family.familyId,
    })),
    relationshipCount: relationships.length,
    symbolicReferenceCount: referenceEdges.length + symbolicTerminals.length,
    crossLineSupportEdgeCount: crossLineEdges.length,
  };
}

function familyEdges(rows = [], familyId) {
  return rows.filter((row) => row.supportFamilyId === familyId);
}
