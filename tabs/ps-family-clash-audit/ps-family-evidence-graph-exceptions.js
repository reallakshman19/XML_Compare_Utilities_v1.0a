import {
  PS_FAMILY_EVIDENCE_SOURCE_SCHEMA,
  SYMBOLIC_SUPPORT_ROLES,
  evidenceId,
} from './ps-family-evidence-graph-shared.js';

export function createEvidenceFamilyExceptions(input) {
  const rows = [];
  const base = {
    supportGroup: input.supportGroup,
    lineFamily: input.context.lineFamily,
    fullLineTag: input.context.fullLineTag,
    branchNode: input.context.branchNode,
    sourceInput: PS_FAMILY_EVIDENCE_SOURCE_SCHEMA,
  };
  const add = (code, severity, reason, extra = {}) => rows.push({
    exceptionCode: code,
    severity,
    ...base,
    structuralGroup: '',
    support: '',
    supportA: '',
    supportB: '',
    evidenceId: '',
    reason,
    ...extra,
  });

  if (!input.context.branchNode || !input.context.lineFamily) {
    add('MISSING_LINE_CONTEXT', 'ERROR', 'The support family has no reliable branch and line context.');
  }
  if (input.context.ownerFallbackUsed) {
    add(
      'OWNER_FALLBACK_LINE_CONTEXT',
      'WARN',
      'At least one member uses OWNER because explicit or hierarchical line context was unavailable.',
    );
  }
  if ((input.memberships || []).length > 1) {
    add(
      'MULTI_LINE_SUPPORT_FAMILY',
      'WARN',
      `The support family is projected into ${input.memberships.length} member-level line memberships.`,
    );
  }
  if ((input.context.branchNodes || []).length > 1) {
    add(
      'MULTI_BRANCH_SUPPORT_FAMILY',
      'WARN',
      `The support family contains ${input.context.branchNodes.length} branch contexts.`,
    );
  }
  for (const edge of input.crossLineEdges || []) {
    add(
      'CROSS_LINE_SUPPORT_MEMBER_EDGE',
      'WARN',
      'A physical support-member edge connects members assigned to different line memberships.',
      {
        supportA: edge.supportA || '',
        supportB: edge.supportB || '',
        evidenceId: evidenceId(edge),
      },
    );
  }
  if (input.ambiguousRelationships.length) {
    add(
      'AMBIGUOUS_SUPPORT_STEEL_RELATIONSHIP',
      'ERROR',
      'More than one structural group satisfies the strongest relationship evidence.',
      { evidenceId: evidenceId(input.ambiguousRelationships[0]) },
    );
  }
  if (!input.resolvedRelationships.length) {
    add('FAMILY_WITHOUT_RESOLVED_STRUCTURE', 'ERROR', 'No resolved support-family to structural-group relationship exists.');
  }
  if (!input.physicalTerminals.length) {
    const referenceOnly = input.symbolicTerminals.length > 0;
    add(
      referenceOnly ? 'REFERENCE_ONLY_STRUCTURAL_CONNECTION' : 'NO_ANALYTICAL_STRUCTURAL_TERMINAL',
      referenceOnly ? 'WARN' : 'ERROR',
      referenceOnly
        ? 'The family has a symbolic structural reference but no analytical support-member terminal.'
        : 'No analytical support-member to structure terminal was established.',
    );
  }

  const physicalMembers = (input.family.members || []).filter((member) => (
    !SYMBOLIC_SUPPORT_ROLES.has(member.semanticRole)
    && Boolean(
      member.analyticalGeometry?.physicalGeometryAvailable
      || member.analyticalGeometry?.geometryAvailable,
    )
  ));
  if (physicalMembers.length > 1 && !input.memberEdges.length) {
    add('NO_PHYSICAL_MEMBER_CHAIN', 'ERROR', 'Multiple analytical support members exist but no physical member-chain edge was established.');
  }
  if ((input.familyChain.components || []).length > 1) {
    add('DISCONNECTED_SUPPORT_MEMBER_COMPONENTS', 'ERROR', 'Physical support members form more than one disconnected component.');
  }
  (input.familyChain.unresolvedPhysicalMemberIds || []).forEach((memberId) => {
    add(
      'UNRESOLVED_PHYSICAL_SUPPORT_MEMBER',
      'ERROR',
      `${memberId} is not connected to another support member or structural terminal.`,
      { support: memberId },
    );
  });
  if (input.nearbyEdges.length) {
    add(
      'NEARBY_SUPPORT_MEMBER_CLEARANCE',
      'WARN',
      `${input.nearbyEdges.length} analytical member pair(s) are near but outside the contact tolerance.`,
    );
  }
  return rows;
}
