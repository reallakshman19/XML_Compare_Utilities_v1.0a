export function exportCarrierToStructureCompletePathsCsv(audit) {
  const headers = [
    'PathId', 'PathStatus', 'SupportFamilyId', 'CarrierObjectId',
    'CarrierIdentityEdgeId', 'CarrierTopologyPathId', 'CarrierTopologyComponentIds',
    'CarrierTopologyEdgeIds', 'CarrierTopologyRepairEdgeIds',
    'CarrierAttachmentEdgeId', 'AttachmentSupportMemberId',
    'SupportChainEdgeIds', 'SupportChainMemberIds', 'StructuralTerminalEdgeId',
    'StructuralTerminalMemberId', 'SteelGroupId', 'StructuralMemberId',
    'RelationshipBasis', 'ContactEvidenceStatus', 'Confidence',
  ];
  return rowsToCsv(headers, (audit?.carrierToStructureCompletePathRows || []).map((row) => ({
    PathId: row.pathId,
    PathStatus: row.pathStatus,
    SupportFamilyId: row.supportFamilyId,
    CarrierObjectId: row.carrierObjectId,
    CarrierIdentityEdgeId: row.carrierIdentityEdgeId,
    CarrierTopologyPathId: row.carrierTopologyPathId,
    CarrierTopologyComponentIds: row.carrierTopologyComponentIds,
    CarrierTopologyEdgeIds: row.carrierTopologyEdgeIds,
    CarrierTopologyRepairEdgeIds: row.carrierTopologyRepairEdgeIds,
    CarrierAttachmentEdgeId: row.carrierAttachmentEdgeId,
    AttachmentSupportMemberId: row.attachmentSupportMemberId,
    SupportChainEdgeIds: row.supportChainEdgeIds,
    SupportChainMemberIds: row.supportChainMemberIds,
    StructuralTerminalEdgeId: row.structuralTerminalEdgeId,
    StructuralTerminalMemberId: row.structuralTerminalMemberId,
    SteelGroupId: row.steelGroupId,
    StructuralMemberId: row.structuralMemberId,
    RelationshipBasis: row.relationshipBasis,
    ContactEvidenceStatus: row.contactEvidenceStatus,
    Confidence: row.confidence,
  })));
}

export function exportCarrierToStructurePathExceptionsCsv(audit) {
  const headers = [
    'ExceptionId', 'ExceptionCode', 'Severity', 'SupportFamilyId',
    'SupportMemberId', 'CarrierObjectId', 'CarrierIdentityEdgeId',
    'TopologyPathId', 'TopologyPathIds', 'TopologyExceptionCodes',
    'AttachmentStatus', 'AttachmentSupportMemberId',
    'StructuralTerminalMemberIds', 'DistanceMm', 'Message',
  ];
  return rowsToCsv(headers, (audit?.carrierToStructurePathExceptionRows || []).map((row) => ({
    ExceptionId: row.exceptionId,
    ExceptionCode: row.exceptionCode,
    Severity: row.severity,
    SupportFamilyId: row.supportFamilyId,
    SupportMemberId: row.supportMemberId,
    CarrierObjectId: row.carrierObjectId,
    CarrierIdentityEdgeId: row.carrierIdentityEdgeId,
    TopologyPathId: row.topologyPathId,
    TopologyPathIds: row.topologyPathIds,
    TopologyExceptionCodes: row.topologyExceptionCodes,
    AttachmentStatus: row.attachmentStatus,
    AttachmentSupportMemberId: row.attachmentSupportMemberId,
    StructuralTerminalMemberIds: row.structuralTerminalMemberIds,
    DistanceMm: row.distanceMm,
    Message: row.message,
  })));
}

export function exportCarrierToStructureFamiliesCsv(audit) {
  const headers = [
    'SupportFamilyId', 'PathStatus', 'CompletePathIds', 'ExceptionIds',
    'ExceptionCodes', 'CarrierObjectIds', 'SteelGroupIds',
  ];
  return rowsToCsv(headers, (audit?.carrierToStructureFamilyRows || []).map((row) => ({
    SupportFamilyId: row.supportFamilyId,
    PathStatus: row.pathStatus,
    CompletePathIds: row.completePathIds,
    ExceptionIds: row.exceptionIds,
    ExceptionCodes: row.exceptionCodes,
    CarrierObjectIds: row.carrierObjectIds,
    SteelGroupIds: row.steelGroupIds,
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
