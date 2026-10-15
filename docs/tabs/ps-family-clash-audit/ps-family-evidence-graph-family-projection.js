import { uniqueSorted } from './ps-family-token-utils.js';
import { PS_FAMILY_EVIDENCE_MODE, evidenceId } from './ps-family-evidence-graph-shared.js';
import {
  lineProjectionFields,
  resolveEdgeLineProjection,
} from './ps-family-evidence-line-memberships.js';

export function createLineMembershipRow(membership) {
  return {
    ...membership,
    memberCount: membership.memberIds.length,
    carrierCount: membership.carrierIds.length,
  };
}

export function createFamilySummaryRow(input) {
  const members = (input.family.members || []).map((member) => member.memberId).filter(Boolean);
  const structuralGroups = uniqueSorted(input.resolvedRelationships.map((row) => row.steelGroupId));
  const status = input.exceptions.some((row) => row.severity === 'ERROR')
    ? 'ERROR'
    : input.exceptions.some((row) => row.severity === 'WARN') ? 'WARN' : 'OK';
  return {
    no: input.index + 1,
    line: input.context.fullLineTag,
    fullLineTags: input.context.fullLineTags,
    branchNode: input.context.branchNode,
    branchNodes: input.context.branchNodes,
    lineFamily: input.context.lineFamily,
    lineFamilies: input.context.lineFamilies,
    lineMembershipCount: input.memberships.length,
    lineMembershipIds: input.memberships.map((row) => row.membershipId),
    psRoot: input.family.familyId,
    supportGroup: input.supportGroup,
    structuralGroupCount: structuralGroups.length,
    supportCount: members.length,
    supportMembers: members,
    evidenceIds: input.evidenceIds,
    status,
    remarks: summaryRemarks(input),
    evidenceMode: PS_FAMILY_EVIDENCE_MODE,
  };
}

export function createStructureContactRow(edge, membershipIndex, primaryMembership) {
  const projection = resolveEdgeLineProjection(edge, membershipIndex, primaryMembership);
  return {
    supportGroup: projection.membership?.supportGroup || primaryMembership?.supportGroup || '',
    structuralGroup: edge.steelGroupId || '',
    structuralMember: edge.structuralMemberId || '',
    support: edge.supportMemberId || '',
    ...lineProjectionFields(projection),
    contactEvidence: evidenceId(edge),
    distance: edge.distanceMm ?? null,
    point: edge.contactPointGlobal || edge.nearestPointOnSupportGlobal || null,
    evidenceClass: edge.evidenceClass || 'ANALYTICAL',
    contactEvidenceStatus: edge.contactEvidenceStatus || '',
    remarks: edge.relationshipStatus === 'RESOLVED_ANALYTICAL_CONTACT'
      ? 'Analytical support-member to structure contact candidate.'
      : 'Analytical support-member to structure proximity candidate.',
  };
}

export function createSupportChainRow(edge, membershipIndex, primaryMembership) {
  const projection = resolveEdgeLineProjection(edge, membershipIndex, primaryMembership);
  return {
    supportGroup: projection.membership?.supportGroup || primaryMembership?.supportGroup || '',
    supportA: edge.supportA,
    supportB: edge.supportB,
    ...lineProjectionFields(projection),
    chainEvidence: evidenceId(edge),
    distance: edge.distanceMm ?? null,
    point: edge.contactPointGlobal || null,
    evidenceClass: edge.evidenceClass || 'ANALYTICAL',
    contactEvidenceStatus: edge.contactEvidenceStatus || '',
    remarks: projection.crossLine
      ? 'Analytical support-member edge spans multiple line memberships.'
      : 'Analytical support-member chain edge.',
  };
}

export function createLineSupportTreeRow(input) {
  const memberIds = new Set(input.membership.memberIds || []);
  const members = (input.family.members || [])
    .filter((member) => memberIds.has(member.memberId))
    .map((member) => `${member.memberId || '(unresolved)'} [${member.semanticRole || 'OTHER'}]`);
  const steel = uniqueSorted(input.relationships
    .map((row) => row.structuralMemberId || row.steelGroupId)
    .filter(Boolean));
  const chains = input.memberEdges
    .filter((edge) => memberIds.has(edge.supportA) || memberIds.has(edge.supportB))
    .map((edge) => `${edge.supportA} ↔ ${edge.supportB}`);
  const terminals = input.terminalEdges
    .filter((edge) => memberIds.has(edge.supportMemberId))
    .map((edge) => `${edge.supportMemberId} → ${edge.structuralMemberId || edge.steelGroupId}`);
  return {
    membershipId: input.membership.membershipId,
    supportGroup: input.membership.supportGroup,
    lineFamily: input.membership.lineFamily,
    fullLineTag: input.membership.fullLineTag,
    branchNode: input.membership.branchNode,
    treeText: [
      `Line: ${input.membership.fullLineTag || 'Unknown'}`,
      `└─ Branch: ${input.membership.branchNode || 'None'}`,
      `   └─ SupportGroup: ${input.membership.supportGroup}`,
      `      ├─ Support family: ${input.family.familyId}`,
      `      ├─ Line membership: ${input.membership.membershipId}`,
      '      ├─ Members',
      ...(members.length ? members.map((item) => `      │  ├─ ${item}`) : ['      │  └─ None']),
      '      ├─ Member chain',
      ...(chains.length ? chains.map((item) => `      │  ├─ ${item}`) : ['      │  └─ None']),
      '      ├─ Structural terminals',
      ...(terminals.length ? terminals.map((item) => `      │  ├─ ${item}`) : ['      │  └─ None']),
      `      └─ Structural evidence: ${steel.join(', ') || 'None'}`,
    ].join('\n'),
  };
}

export function countMembershipEvidence(
  membership,
  relationships,
  memberEdges,
  referenceEdges,
  terminalEdges,
) {
  const memberIds = new Set(membership.memberIds || []);
  const rows = [
    ...relationships,
    ...memberEdges.filter((edge) => memberIds.has(edge.supportA) || memberIds.has(edge.supportB)),
    ...referenceEdges.filter((edge) => memberIds.has(edge.fromMemberId) || memberIds.has(edge.toMemberId)),
    ...terminalEdges.filter((edge) => memberIds.has(edge.supportMemberId)),
  ];
  return uniqueSorted(rows.map(evidenceId)).length;
}

function summaryRemarks(input) {
  const suffix = input.memberships.length > 1
    ? ` Shared across ${input.memberships.length} line memberships.`
    : '';
  if (input.physicalTerminals.length && input.memberEdges.length) {
    return `Analytical support chain with structural terminal.${suffix}`;
  }
  if (input.physicalTerminals.length) return `Direct analytical structural terminal.${suffix}`;
  if (input.symbolicTerminals.length) return `Symbolic structural reference only.${suffix}`;
  return `Incomplete XML-free relationship graph.${suffix}`;
}
