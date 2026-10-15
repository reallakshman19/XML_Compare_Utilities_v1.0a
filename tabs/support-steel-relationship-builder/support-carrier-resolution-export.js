export function supportCarrierResolutionToCsv(bundle) {
  const headers = [
    'evidenceId', 'supportFamilyId', 'supportMemberId', 'supportMemberRole',
    'resolutionStatus', 'carrierObjectId', 'branchContextId', 'branchNode',
    'explicitCarrierReference', 'hierarchyCarrierReference',
    'candidateCarrierObjectIds', 'relationshipBasis', 'relationshipCardinality',
    'confidence', 'physicalCarrierObjectAvailable', 'contactEvidenceStatus',
  ];
  return rowsToCsv(headers, (bundle?.supportCarrierResolution?.resolutions || []).map((row) => ({
    evidenceId: row.evidenceId,
    supportFamilyId: row.supportFamilyId,
    supportMemberId: row.supportMemberId,
    supportMemberRole: row.supportMemberRole,
    resolutionStatus: row.resolutionStatus,
    carrierObjectId: row.carrierObjectId,
    branchContextId: row.branchContextId,
    branchNode: row.branchNode,
    explicitCarrierReference: row.explicitCarrierReference,
    hierarchyCarrierReference: row.hierarchyCarrierReference,
    candidateCarrierObjectIds: row.candidateCarrierObjectIds,
    relationshipBasis: row.relationshipBasis,
    relationshipCardinality: row.relationshipCardinality,
    confidence: row.confidence,
    physicalCarrierObjectAvailable: row.physicalCarrierObjectAvailable,
    contactEvidenceStatus: row.contactEvidenceStatus,
  })));
}

export function supportCarrierAttachmentToCsv(bundle) {
  const headers = [
    'evaluationId', 'identityEvidenceId', 'supportFamilyId', 'supportMemberId',
    'supportMemberRole', 'carrierObjectId', 'attachmentStatus',
    'relationshipBasis', 'confidence', 'contactEvidenceStatus', 'distanceMm',
    'geometryMethod', 'geometryQuality', 'carrierContactToleranceMm',
    'carrierCandidateToleranceMm', 'contactPointGlobal',
    'nearestPointOnSupportGlobal', 'nearestPointOnCarrierGlobal',
  ];
  return rowsToCsv(headers, (bundle?.supportCarrierAttachment?.evaluations || []).map((row) => ({
    evaluationId: row.evaluationId,
    identityEvidenceId: row.identityEvidenceId,
    supportFamilyId: row.supportFamilyId,
    supportMemberId: row.supportMemberId,
    supportMemberRole: row.supportMemberRole,
    carrierObjectId: row.carrierObjectId,
    attachmentStatus: row.attachmentStatus,
    relationshipBasis: row.relationshipBasis,
    confidence: row.confidence,
    contactEvidenceStatus: row.contactEvidenceStatus,
    distanceMm: row.distanceMm,
    geometryMethod: row.geometryMethod,
    geometryQuality: row.geometryQuality,
    carrierContactToleranceMm: row.carrierContactToleranceMm,
    carrierCandidateToleranceMm: row.carrierCandidateToleranceMm,
    contactPointGlobal: row.contactPointGlobal,
    nearestPointOnSupportGlobal: row.nearestPointOnSupportGlobal,
    nearestPointOnCarrierGlobal: row.nearestPointOnCarrierGlobal,
  })));
}

function rowsToCsv(headers, rows) {
  return `${[
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n')}\n`;
}

function csvCell(value) {
  const text = Array.isArray(value)
    ? value.join('|')
    : value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}
