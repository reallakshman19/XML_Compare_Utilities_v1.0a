export function supportRestraintAssessmentsToCsv(bundle) {
  return rowsToCsv([
    'AssessmentId', 'SupportFamilyId', 'CarrierObjectId', 'SupportFunction',
    'FunctionStatus', 'RequiredDirections', 'EvidencedDirections', 'Confidence',
  ], (bundle?.supportRestraintFunction?.functionAssessments || []).map((row) => ({
    AssessmentId: row.assessmentId,
    SupportFamilyId: row.supportFamilyId,
    CarrierObjectId: row.carrierObjectId,
    SupportFunction: row.supportFunction,
    FunctionStatus: row.functionStatus,
    RequiredDirections: row.requiredDirections,
    EvidencedDirections: row.evidencedDirections,
    Confidence: row.confidence,
  })));
}

export function supportRestraintDirectionsToCsv(bundle) {
  return rowsToCsv([
    'EdgeId', 'SupportFamilyId', 'SupportMemberId', 'CarrierObjectId',
    'MovementDirection', 'RelationshipStatus', 'Confidence', 'EvidenceId',
  ], (bundle?.supportRestraintFunction?.restraintEdges || []).map((row) => ({
    EdgeId: row.edgeId,
    SupportFamilyId: row.supportFamilyId,
    SupportMemberId: row.supportMemberId,
    CarrierObjectId: row.carrierObjectId,
    MovementDirection: row.movementDirection,
    RelationshipStatus: row.relationshipStatus,
    Confidence: row.confidence,
    EvidenceId: row.evidenceId,
  })));
}

export function supportRestraintExceptionsToCsv(bundle) {
  return rowsToCsv([
    'ExceptionId', 'ExceptionCode', 'Severity', 'SupportFamilyId',
    'CarrierObjectId', 'SupportFunction', 'Message',
  ], (bundle?.supportRestraintFunction?.functionExceptions || []).map((row) => ({
    ExceptionId: row.exceptionId,
    ExceptionCode: row.exceptionCode,
    Severity: row.severity,
    SupportFamilyId: row.supportFamilyId,
    CarrierObjectId: row.carrierObjectId,
    SupportFunction: row.supportFunction,
    Message: row.message,
  })));
}

export function supportRestraintFamiliesToCsv(bundle) {
  return rowsToCsv([
    'SupportFamilyId', 'FunctionStatus', 'IntendedFunctions', 'CarrierObjectIds',
    'AssessmentIds', 'ExceptionIds', 'ExceptionCodes',
  ], (bundle?.supportRestraintFunction?.familyResults || []).map((row) => ({
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
