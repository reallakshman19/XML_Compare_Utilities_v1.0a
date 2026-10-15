export function exportCarrierTopologyComponentsCsv(audit) {
  const headers = [
    'ComponentId', 'CanonicalType', 'SourceRecordType', 'BranchNode',
    'FullLineTag', 'LineFamily', 'PortCount', 'PortRoles',
    'ReferenceTargets', 'TerminalComponent', 'BranchComponent', 'SourcePath',
  ];
  return rowsToCsv(headers, (audit?.carrierTopologyComponentRows || []).map((row) => ({
    ComponentId: row.componentId,
    CanonicalType: row.canonicalType,
    SourceRecordType: row.sourceRecordType,
    BranchNode: row.lineContext?.branchNode,
    FullLineTag: row.lineContext?.fullLineTag,
    LineFamily: row.lineContext?.lineFamily,
    PortCount: row.ports?.length || 0,
    PortRoles: (row.ports || []).map((port) => port.role),
    ReferenceTargets: (row.references || []).map((ref) => `${ref.kind}:${ref.targetComponentId}`),
    TerminalComponent: row.terminalComponent,
    BranchComponent: row.branchComponent,
    SourcePath: row.sourcePath,
  })));
}

export function exportCarrierTopologyPortsCsv(audit) {
  const headers = [
    'PortId', 'ComponentId', 'Role', 'PositionGlobal', 'BoreMm', 'SourceKey',
  ];
  return rowsToCsv(headers, (audit?.carrierTopologyPortRows || []).map((row) => ({
    PortId: row.portId,
    ComponentId: row.componentId,
    Role: row.role,
    PositionGlobal: row.positionGlobal,
    BoreMm: row.boreMm,
    SourceKey: row.sourceKey,
  })));
}

export function exportCarrierTopologyConnectionsCsv(audit) {
  const headers = [
    'EdgeId', 'EdgeType', 'FromComponentId', 'FromPortId', 'FromPortRole',
    'ToComponentId', 'ToPortId', 'ToPortRole', 'RelationshipStatus',
    'RelationshipBasis', 'GapMm', 'Confidence', 'BranchIds', 'LineFamilies',
  ];
  return rowsToCsv(headers, (audit?.carrierTopologyConnectionRows || []).map((row) => ({
    EdgeId: row.edgeId,
    EdgeType: row.edgeType,
    FromComponentId: row.fromComponentId,
    FromPortId: row.fromPortId,
    FromPortRole: row.fromPortRole,
    ToComponentId: row.toComponentId,
    ToPortId: row.toPortId,
    ToPortRole: row.toPortRole,
    RelationshipStatus: row.relationshipStatus,
    RelationshipBasis: row.relationshipBasis,
    GapMm: row.gapMm,
    Confidence: row.confidence,
    BranchIds: row.branchIds,
    LineFamilies: row.lineFamilies,
  })));
}

export function exportCarrierTopologyPathsCsv(audit) {
  const headers = [
    'PathId', 'PathStatus', 'ComponentIds', 'EdgeIds',
    'BranchIds', 'LineFamilies', 'ExceptionCodes',
  ];
  return rowsToCsv(headers, (audit?.carrierTopologyPathRows || []).map((row) => ({
    PathId: row.pathId,
    PathStatus: row.pathStatus,
    ComponentIds: row.componentIds,
    EdgeIds: row.edgeIds,
    BranchIds: row.branchIds,
    LineFamilies: row.lineFamilies,
    ExceptionCodes: row.exceptionCodes,
  })));
}

export function exportCarrierTopologyExceptionsCsv(audit) {
  const headers = [
    'ExceptionId', 'ExceptionCode', 'Severity', 'ComponentId', 'PortId',
    'TargetComponentId', 'CandidatePortIds', 'Message',
  ];
  return rowsToCsv(headers, (audit?.carrierTopologyExceptionRows || []).map((row) => ({
    ExceptionId: row.exceptionId,
    ExceptionCode: row.exceptionCode,
    Severity: row.severity,
    ComponentId: row.componentId,
    PortId: row.portId,
    TargetComponentId: row.targetComponentId,
    CandidatePortIds: row.candidatePortIds,
    Message: row.message,
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
