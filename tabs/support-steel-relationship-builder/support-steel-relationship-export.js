export function supportSteelRelationshipsToCsv(bundle) {
  const headers = [
    'evidenceId',
    'evidenceSource',
    'evidenceClass',
    'sourceSchema',
    'geometryEngineSchema',
    'relationshipSemantic',
    'contactEvidenceStatus',
    'supportFamilyId',
    'steelGroupId',
    'structuralMemberId',
    'relationshipStatus',
    'relationshipCardinality',
    'confidence',
    'relationshipBasis',
    'analyticalGeometryAvailable',
    'geometryMethod',
    'geometryQuality',
    'distanceMm',
    'projectionToleranceMm',
    'withinProjectionTolerance',
    'nearestPointOnSteelGlobal',
    'branchNode',
    'branchIds',
    'fullLineTag',
    'fullLineTags',
    'lineFamily',
    'lineFamilies',
    'pipeOwner',
    'carrierIds',
    'lineContextQuality',
    'ownerFallbackUsed',
    'lineContextConflicts',
    'memberCount',
    'candidateSteelGroupIds',
  ];
  const families = new Map((bundle?.supportFamilies || []).map((family) => [family.familyId, family]));
  const rows = (bundle?.relationships || []).map((relationship) => {
    const family = families.get(relationship.supportFamilyId) || {};
    const context = family.lineContext || {};
    return {
      evidenceId: relationship.evidenceId,
      evidenceSource: relationship.evidenceSource,
      evidenceClass: relationship.evidenceClass,
      sourceSchema: relationship.sourceSchema,
      geometryEngineSchema: relationship.geometryEngineSchema,
      relationshipSemantic: relationship.relationshipSemantic,
      contactEvidenceStatus: relationship.contactEvidenceStatus,
      supportFamilyId: relationship.supportFamilyId,
      steelGroupId: relationship.steelGroupId || '',
      structuralMemberId: relationship.structuralMemberId || '',
      relationshipStatus: relationship.relationshipStatus,
      relationshipCardinality: relationship.relationshipCardinality,
      confidence: relationship.confidence,
      relationshipBasis: (relationship.relationshipBasis || []).join('|'),
      analyticalGeometryAvailable: relationship.analyticalGeometryAvailable,
      geometryMethod: relationship.geometryMethod,
      geometryQuality: relationship.geometryQuality,
      distanceMm: relationship.distanceMm ?? '',
      projectionToleranceMm: relationship.projectionToleranceMm ?? '',
      withinProjectionTolerance: relationship.withinProjectionTolerance,
      nearestPointOnSteelGlobal: pointText(relationship.nearestPointOnSteelGlobal),
      branchNode: context.branchNode || family.branchId || '',
      branchIds: (context.branchNodes || family.branchIds || relationship.branchIds || []).join('|'),
      fullLineTag: context.fullLineTag || family.fullLineTag || '',
      fullLineTags: (context.fullLineTags || family.fullLineTags || []).join('|'),
      lineFamily: context.lineFamily || family.lineFamily || '',
      lineFamilies: (context.lineFamilies || family.lineFamilies || []).join('|'),
      pipeOwner: context.pipeOwner || family.pipeOwner || '',
      carrierIds: (context.carrierIds || family.carrierIds || relationship.carrierIds || []).join('|'),
      lineContextQuality: context.contextQuality || '',
      ownerFallbackUsed: context.ownerFallbackUsed ?? '',
      lineContextConflicts: (context.contextConflicts || []).join('|'),
      memberCount: relationship.memberCount ?? 0,
      candidateSteelGroupIds: (relationship.candidateSteelGroupIds || []).join('|'),
    };
  });
  return [headers.join(','), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(','))].join('\n');
}

export function supportMemberChainToCsv(bundle) {
  const chain = bundle?.supportMemberChain || {};
  const rows = [
    ...(chain.supportChainEdges || []),
    ...(chain.nearbyCandidateEdges || []),
    ...(chain.referenceEdges || []),
    ...(chain.structuralTerminalEdges || []),
  ];
  const headers = [
    'edgeId', 'edgeType', 'supportFamilyId',
    'supportA', 'supportB', 'fromMemberId', 'toMemberId',
    'supportMemberId', 'supportMemberRole', 'steelGroupId', 'structuralMemberId',
    'relationshipStatus', 'contactEvidenceStatus', 'relationshipBasis',
    'evidenceSource', 'evidenceClass', 'confidence',
    'distanceMm', 'geometryMethod', 'geometryQuality', 'contactPointGlobal',
  ];
  return [headers.join(','), ...rows.map((row) => headers.map((key) => csvCell(chainCell(row, key))).join(','))].join('\n');
}

export function supportSteelHierarchyToText(bundle) {
  const lines = [];
  lines.push(`schema: ${bundle?.schema || 'SupportSteelRelationshipBundle.v1'}`);
  lines.push(`geometry engine: ${bundle?.geometryEngineSchema || 'UNAVAILABLE'}`);
  lines.push(`member chain: ${bundle?.memberChainEngineSchema || 'UNAVAILABLE'}`);
  lines.push(`purpose: ${bundle?.bundlePurpose || 'RELATIONSHIP_INFERENCE'}`);
  lines.push(`contact evidence: ${bundle?.contactEvidenceAvailable ? 'AVAILABLE' : 'NOT_PROVEN'}`);
  lines.push('');
  for (const family of bundle?.supportFamilies || []) {
    const context = family.lineContext || {};
    lines.push(family.familyId);
    lines.push(`├── primary branch: ${context.branchNode || family.branchId || 'none'}`);
    lines.push(`├── branches: ${(context.branchNodes || family.branchIds || []).join(', ') || 'none'}`);
    lines.push(`├── full line tags: ${(context.fullLineTags || family.fullLineTags || []).join(', ') || 'none'}`);
    lines.push(`├── line families: ${(context.lineFamilies || family.lineFamilies || []).join(', ') || 'none'}`);
    lines.push(`├── pipe owner: ${context.pipeOwner || family.pipeOwner || 'none'}`);
    lines.push(`├── carriers: ${(context.carrierIds || family.carrierIds || []).join(', ') || 'none'}`);
    lines.push(`├── line context: ${context.contextQuality || 'NONE'} · OWNER fallback ${context.ownerFallbackUsed ? 'YES' : 'NO'}`);
    lines.push(`├── context evidence: ${(context.contextEvidence || []).join(', ') || 'none'}`);
    lines.push(`├── context cardinality: ${(context.contextConflicts || []).join(', ') || 'single context'}`);
    lines.push('├── members');
    family.members.forEach((member, index) => {
      const last = index === family.members.length - 1;
      lines.push(`│   ${last ? '└──' : '├──'} ${member.memberId || '(unresolved member)'} [${member.semanticRole || 'OTHER'}]`);
    });
    lines.push('├── inferred steel relationships');
    family.steelRelationships.forEach((relationship, index) => {
      const last = index === family.steelRelationships.length - 1;
      const target = relationship.steelGroupId || relationship.nearestSteelGroupId || 'UNRESOLVED';
      const member = relationship.structuralMemberId || 'no analytical member';
      const method = relationship.geometryMethod || 'UNAVAILABLE';
      lines.push(`│   ${last ? '└──' : '├──'} ${target} — ${relationship.relationshipStatus} — ${relationship.relationshipCardinality}`);
      lines.push(`│       geometry: ${member} · ${method} · ${relationship.distanceMm ?? '—'} mm`);
    });
    const familyChain = bundle?.supportMemberChain?.familyChains?.find((row) => row.supportFamilyId === family.familyId);
    lines.push('└── support member chain');
    if (!familyChain) {
      lines.push('    └── unavailable');
      continue;
    }
    lines.push(`    ├── physical members: ${(familyChain.physicalMemberIds || []).join(', ') || 'none'}`);
    lines.push(`    ├── symbolic members: ${(familyChain.symbolicMemberIds || []).join(', ') || 'none'}`);
    lines.push(`    ├── connected components: ${(familyChain.components || []).map((row) => `[${row.memberIds.join(' ↔ ')}]`).join(', ') || 'none'}`);
    lines.push(`    └── unresolved physical members: ${(familyChain.unresolvedPhysicalMemberIds || []).join(', ') || 'none'}`);
  }
  return lines.join('\n');
}

export function supportSteelBundleToJson(bundle) {
  return JSON.stringify(bundle, null, 2);
}

function chainCell(row, key) {
  if (key === 'relationshipBasis') return (row.relationshipBasis || []).join('|');
  if (key === 'contactPointGlobal') return pointText(row.contactPointGlobal);
  return row[key] ?? '';
}

function pointText(point) {
  return point ? `${point.x} ${point.y} ${point.z}` : '';
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
