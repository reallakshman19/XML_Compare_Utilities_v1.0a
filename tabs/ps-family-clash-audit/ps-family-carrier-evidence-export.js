export function exportCarrierCatalogCsv(audit) {
  const headers = [
    'CarrierObjectId', 'CarrierObjectClass', 'SourceRecordType',
    'BranchNode', 'FullLineTag', 'LineFamily', 'PositionGlobal',
    'AnalyticalCarrierGeometryAvailable', 'GeometryMethods', 'OutsideRadiusMm',
    'PhysicalCarrierObjectAvailable', 'ContactEvidenceStatus', 'SourcePath',
  ];
  return rowsToCsv(headers, (audit?.carrierObjectRows || []).map((row) => ({
    CarrierObjectId: row.carrierObjectId,
    CarrierObjectClass: row.carrierObjectClass,
    SourceRecordType: row.sourceRecordType,
    BranchNode: row.lineContext?.branchNode,
    FullLineTag: row.lineContext?.fullLineTag,
    LineFamily: row.lineContext?.lineFamily,
    PositionGlobal: row.positionGlobal,
    AnalyticalCarrierGeometryAvailable: row.analyticalCarrierGeometryAvailable,
    GeometryMethods: row.analyticalGeometry?.geometryMethods,
    OutsideRadiusMm: row.analyticalGeometry?.outsideRadiusMm,
    PhysicalCarrierObjectAvailable: row.physicalCarrierObjectAvailable,
    ContactEvidenceStatus: row.contactEvidenceStatus,
    SourcePath: row.sourcePath,
  })));
}

export function exportCarrierResolutionCsv(audit) {
  const headers = [
    'EvidenceId', 'SupportFamilyId', 'SupportMemberId', 'SupportMemberRole',
    'ResolutionStatus', 'CarrierObjectId', 'BranchContextId', 'BranchNode',
    'ExplicitCarrierReference', 'HierarchyCarrierReference',
    'CandidateCarrierObjectIds', 'RelationshipBasis', 'RelationshipCardinality',
    'Confidence', 'PhysicalCarrierObjectAvailable', 'ContactEvidenceStatus',
  ];
  return rowsToCsv(headers, (audit?.carrierResolutionRows || []).map((row) => ({
    EvidenceId: row.evidenceId,
    SupportFamilyId: row.supportFamilyId,
    SupportMemberId: row.supportMemberId,
    SupportMemberRole: row.supportMemberRole,
    ResolutionStatus: row.resolutionStatus,
    CarrierObjectId: row.carrierObjectId,
    BranchContextId: row.branchContextId,
    BranchNode: row.branchNode,
    ExplicitCarrierReference: row.explicitCarrierReference,
    HierarchyCarrierReference: row.hierarchyCarrierReference,
    CandidateCarrierObjectIds: row.candidateCarrierObjectIds,
    RelationshipBasis: row.relationshipBasis,
    RelationshipCardinality: row.relationshipCardinality,
    Confidence: row.confidence,
    PhysicalCarrierObjectAvailable: row.physicalCarrierObjectAvailable,
    ContactEvidenceStatus: row.contactEvidenceStatus,
  })));
}

export function exportSupportCarrierEdgesCsv(audit) {
  const headers = [
    'EdgeId', 'EdgeType', 'SupportFamilyId', 'SupportMemberId',
    'CarrierObjectId', 'BranchContextId', 'RelationshipStatus',
    'RelationshipBasis', 'Confidence', 'EvidenceId', 'EvidenceClass',
    'ContactEvidenceStatus',
  ];
  const rows = [
    ...(audit?.supportCarrierEdgeRows || []),
    ...(audit?.branchContextEdgeRows || []),
  ];
  return rowsToCsv(headers, rows.map((row) => ({
    EdgeId: row.edgeId,
    EdgeType: row.edgeType,
    SupportFamilyId: row.supportFamilyId,
    SupportMemberId: row.supportMemberId,
    CarrierObjectId: row.carrierObjectId,
    BranchContextId: row.branchContextId,
    RelationshipStatus: row.relationshipStatus,
    RelationshipBasis: row.relationshipBasis,
    Confidence: row.confidence,
    EvidenceId: row.evidenceId,
    EvidenceClass: row.evidenceClass,
    ContactEvidenceStatus: row.contactEvidenceStatus,
  })));
}

export function exportCarrierAttachmentCsv(audit) {
  const headers = [
    'EvaluationId', 'IdentityEvidenceId', 'SupportFamilyId', 'SupportMemberId',
    'SupportMemberRole', 'CarrierObjectId', 'AttachmentStatus',
    'RelationshipBasis', 'Confidence', 'ContactEvidenceStatus',
    'DistanceMm', 'GeometryMethod', 'GeometryQuality',
    'CarrierContactToleranceMm', 'CarrierCandidateToleranceMm',
    'ContactPointGlobal', 'NearestPointOnSupportGlobal', 'NearestPointOnCarrierGlobal',
  ];
  return rowsToCsv(headers, (audit?.carrierAttachmentEvaluationRows || []).map((row) => ({
    EvaluationId: row.evaluationId,
    IdentityEvidenceId: row.identityEvidenceId,
    SupportFamilyId: row.supportFamilyId,
    SupportMemberId: row.supportMemberId,
    SupportMemberRole: row.supportMemberRole,
    CarrierObjectId: row.carrierObjectId,
    AttachmentStatus: row.attachmentStatus,
    RelationshipBasis: row.relationshipBasis,
    Confidence: row.confidence,
    ContactEvidenceStatus: row.contactEvidenceStatus,
    DistanceMm: row.distanceMm,
    GeometryMethod: row.geometryMethod,
    GeometryQuality: row.geometryQuality,
    CarrierContactToleranceMm: row.carrierContactToleranceMm,
    CarrierCandidateToleranceMm: row.carrierCandidateToleranceMm,
    ContactPointGlobal: row.contactPointGlobal,
    NearestPointOnSupportGlobal: row.nearestPointOnSupportGlobal,
    NearestPointOnCarrierGlobal: row.nearestPointOnCarrierGlobal,
  })));
}

export function exportCarrierAttachmentEdgesCsv(audit) {
  const headers = [
    'EdgeId', 'EdgeType', 'SupportFamilyId', 'SupportMemberId',
    'SupportMemberRole', 'CarrierObjectId', 'RelationshipStatus',
    'RelationshipBasis', 'Confidence', 'EvidenceId', 'IdentityEvidenceId',
    'EvidenceClass', 'ContactEvidenceStatus', 'DistanceMm',
    'GeometryMethod', 'GeometryQuality', 'ContactPointGlobal',
  ];
  const rows = [
    ...(audit?.carrierAttachmentRows || []),
    ...(audit?.nearbyCarrierAttachmentRows || []),
  ];
  return rowsToCsv(headers, rows.map((row) => ({
    EdgeId: row.edgeId,
    EdgeType: row.edgeType,
    SupportFamilyId: row.supportFamilyId,
    SupportMemberId: row.supportMemberId,
    SupportMemberRole: row.supportMemberRole,
    CarrierObjectId: row.carrierObjectId,
    RelationshipStatus: row.relationshipStatus,
    RelationshipBasis: row.relationshipBasis,
    Confidence: row.confidence,
    EvidenceId: row.evidenceId,
    IdentityEvidenceId: row.identityEvidenceId,
    EvidenceClass: row.evidenceClass,
    ContactEvidenceStatus: row.contactEvidenceStatus,
    DistanceMm: row.distanceMm,
    GeometryMethod: row.geometryMethod,
    GeometryQuality: row.geometryQuality,
    ContactPointGlobal: row.contactPointGlobal,
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
