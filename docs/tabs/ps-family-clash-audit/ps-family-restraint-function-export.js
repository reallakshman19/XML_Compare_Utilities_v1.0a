export function exportCarrierFramesCsv(audit) {
  return rowsToCsv([
    'CarrierObjectId', 'FrameStatus', 'FrameQuality', 'FrameOrthogonal', 'VerticalPipe',
    'OriginGlobal', 'AxialAxis', 'LateralAxis', 'VerticalAxis', 'AxialGravityAlignment',
    'RelationshipBasis',
  ], (audit?.carrierFrameRows || []).map((row) => ({
    CarrierObjectId: row.carrierObjectId,
    FrameStatus: row.frameStatus,
    FrameQuality: row.frameQuality,
    FrameOrthogonal: row.frameOrthogonal,
    VerticalPipe: row.verticalPipe,
    OriginGlobal: row.originGlobal,
    AxialAxis: row.axialAxis,
    LateralAxis: row.lateralAxis,
    VerticalAxis: row.verticalAxis,
    AxialGravityAlignment: row.axialGravityAlignment,
    RelationshipBasis: row.relationshipBasis,
  })));
}

export function exportRestraintFunctionAssessmentsCsv(audit) {
  return rowsToCsv([
    'AssessmentId', 'SupportFamilyId', 'CarrierObjectId', 'SupportFunction',
    'FunctionStatus', 'RequiredDirections', 'EvidencedDirections', 'Confidence',
    'EvidenceBoundary',
  ], (audit?.restraintFunctionAssessmentRows || []).map((row) => ({
    AssessmentId: row.assessmentId,
    SupportFamilyId: row.supportFamilyId,
    CarrierObjectId: row.carrierObjectId,
    SupportFunction: row.supportFunction,
    FunctionStatus: row.functionStatus,
    RequiredDirections: row.requiredDirections,
    EvidencedDirections: row.evidencedDirections,
    Confidence: row.confidence,
    EvidenceBoundary: row.evidenceBoundary,
  })));
}

export function exportRestraintDirectionEdgesCsv(audit) {
  return rowsToCsv([
    'EdgeId', 'EdgeType', 'SupportFamilyId', 'SupportMemberId', 'CarrierObjectId',
    'MovementDirection', 'RelationshipStatus', 'RelationshipBasis', 'Confidence',
    'EvidenceId', 'ContactEvidenceStatus',
  ], (audit?.restraintDirectionEdgeRows || []).map((row) => ({
    EdgeId: row.edgeId,
    EdgeType: row.edgeType,
    SupportFamilyId: row.supportFamilyId,
    SupportMemberId: row.supportMemberId,
    CarrierObjectId: row.carrierObjectId,
    MovementDirection: row.movementDirection,
    RelationshipStatus: row.relationshipStatus,
    RelationshipBasis: row.relationshipBasis,
    Confidence: row.confidence,
    EvidenceId: row.evidenceId,
    ContactEvidenceStatus: row.contactEvidenceStatus,
  })));
}

export function exportRestraintFunctionExceptionsCsv(audit) {
  return rowsToCsv([
    'ExceptionId', 'ExceptionCode', 'Severity', 'SupportFamilyId', 'CarrierObjectId',
    'SupportFunction', 'Message',
  ], (audit?.restraintFunctionExceptionRows || []).map((row) => ({
    ExceptionId: row.exceptionId,
    ExceptionCode: row.exceptionCode,
    Severity: row.severity,
    SupportFamilyId: row.supportFamilyId,
    CarrierObjectId: row.carrierObjectId,
    SupportFunction: row.supportFunction,
    Message: row.message,
  })));
}

export function exportRestraintFunctionFamiliesCsv(audit) {
  return rowsToCsv([
    'SupportFamilyId', 'FunctionStatus', 'IntendedFunctions', 'CarrierObjectIds',
    'AssessmentIds', 'ExceptionIds', 'ExceptionCodes',
  ], (audit?.restraintFunctionFamilyRows || []).map((row) => ({
    SupportFamilyId: row.supportFamilyId,
    FunctionStatus: row.functionStatus,
    IntendedFunctions: row.intendedFunctions,
    CarrierObjectIds: row.carrierObjectIds,
    AssessmentIds: row.assessmentIds,
    ExceptionIds: row.exceptionIds,
    ExceptionCodes: row.exceptionCodes,
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
