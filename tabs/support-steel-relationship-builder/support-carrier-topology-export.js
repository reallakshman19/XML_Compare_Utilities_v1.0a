export function supportCarrierTopologyToCsv(bundle) {
  const topology = bundle?.supportCarrierTopology || {};
  const headers = [
    'edgeId', 'edgeType', 'fromComponentId', 'fromPortId', 'fromPortRole',
    'toComponentId', 'toPortId', 'toPortRole', 'relationshipStatus',
    'relationshipBasis', 'gapMm', 'confidence', 'branchIds', 'lineFamilies',
  ];
  return rowsToCsv(headers, (topology.connectionEdges || []).map((row) => ({
    edgeId: row.edgeId,
    edgeType: row.edgeType,
    fromComponentId: row.fromComponentId,
    fromPortId: row.fromPortId,
    fromPortRole: row.fromPortRole,
    toComponentId: row.toComponentId,
    toPortId: row.toPortId,
    toPortRole: row.toPortRole,
    relationshipStatus: row.relationshipStatus,
    relationshipBasis: row.relationshipBasis,
    gapMm: row.gapMm,
    confidence: row.confidence,
    branchIds: row.branchIds,
    lineFamilies: row.lineFamilies,
  })));
}

export function supportCarrierTopologyExceptionsToCsv(bundle) {
  const headers = [
    'exceptionId', 'exceptionCode', 'severity', 'componentId', 'portId',
    'targetComponentId', 'candidatePortIds', 'message',
  ];
  return rowsToCsv(headers, (bundle?.supportCarrierTopology?.topologyExceptions || []).map((row) => ({
    exceptionId: row.exceptionId,
    exceptionCode: row.exceptionCode,
    severity: row.severity,
    componentId: row.componentId,
    portId: row.portId,
    targetComponentId: row.targetComponentId,
    candidatePortIds: row.candidatePortIds,
    message: row.message,
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
