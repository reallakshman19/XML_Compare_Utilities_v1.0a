export function supportCarrierToStructurePathsToCsv(bundle) {
  const pathBundle = bundle?.supportCarrierToStructurePath || {};
  const headers = [
    'recordType', 'pathId', 'pathStatus', 'exceptionId', 'exceptionCode',
    'supportFamilyId', 'supportMemberId', 'carrierObjectId',
    'carrierTopologyPathId', 'carrierAttachmentEdgeId', 'supportChainEdgeIds',
    'structuralTerminalEdgeId', 'steelGroupId', 'structuralMemberId',
    'relationshipBasis', 'contactEvidenceStatus', 'confidence', 'message',
  ];
  const completeRows = (pathBundle.completePaths || []).map((row) => ({
    recordType: 'COMPLETE_PATH',
    pathId: row.pathId,
    pathStatus: row.pathStatus,
    supportFamilyId: row.supportFamilyId,
    supportMemberId: row.attachmentSupportMemberId,
    carrierObjectId: row.carrierObjectId,
    carrierTopologyPathId: row.carrierTopologyPathId,
    carrierAttachmentEdgeId: row.carrierAttachmentEdgeId,
    supportChainEdgeIds: row.supportChainEdgeIds,
    structuralTerminalEdgeId: row.structuralTerminalEdgeId,
    steelGroupId: row.steelGroupId,
    structuralMemberId: row.structuralMemberId,
    relationshipBasis: row.relationshipBasis,
    contactEvidenceStatus: row.contactEvidenceStatus,
    confidence: row.confidence,
  }));
  const exceptionRows = (pathBundle.pathExceptions || []).map((row) => ({
    recordType: 'PATH_EXCEPTION',
    exceptionId: row.exceptionId,
    exceptionCode: row.exceptionCode,
    supportFamilyId: row.supportFamilyId,
    supportMemberId: row.supportMemberId,
    carrierObjectId: row.carrierObjectId,
    message: row.message,
  }));
  return rowsToCsv(headers, [...completeRows, ...exceptionRows]);
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
