export function exportPsFamilyValidationMetricsCsv(benchmark) {
  const headers = [
    'Area', 'Status', 'MatchCount', 'GraphAcceptedCount', 'XmlReferenceCount',
    'Precision', 'Recall', 'PrecisionThreshold', 'RecallThreshold',
    'FalsePositiveReferenceCount', 'FalseNegativeReferenceCount',
  ];
  const rows = [
    metricRow('STRUCTURAL_RELATIONSHIPS', benchmark?.structural?.metrics),
    metricRow('SUPPORT_CHAIN', benchmark?.chain?.metrics),
  ];
  return csv(headers, rows);
}

export function exportPsFamilyValidationDisagreementsCsv(benchmark) {
  const headers = [
    'Area', 'Classification', 'SupportFamilyId', 'GraphTargets', 'XmlTargets',
    'GraphPairs', 'XmlPairs', 'EvidenceIds', 'ReferenceIds',
    'DistanceMm', 'ToleranceMm',
  ];
  const rows = [
    ...(benchmark?.structural?.disagreements || []).map((row) => disagreementRow('STRUCTURAL_RELATIONSHIPS', row)),
    ...(benchmark?.chain?.disagreements || []).map((row) => disagreementRow('SUPPORT_CHAIN', row)),
  ];
  return csv(headers, rows);
}

export function exportPsFamilyValidationJson(benchmark) {
  return `${JSON.stringify(benchmark, null, 2)}\n`;
}

export function createPsFamilyValidationExports(benchmark) {
  return {
    metricsCsv: exportPsFamilyValidationMetricsCsv(benchmark),
    disagreementsCsv: exportPsFamilyValidationDisagreementsCsv(benchmark),
    validationJson: exportPsFamilyValidationJson(benchmark),
  };
}

function metricRow(area, metrics = {}) {
  return {
    Area: area,
    Status: metrics.status,
    MatchCount: metrics.matchCount,
    GraphAcceptedCount: metrics.graphAcceptedCount,
    XmlReferenceCount: metrics.xmlReferenceCount,
    Precision: metrics.precision,
    Recall: metrics.recall,
    PrecisionThreshold: metrics.precisionThreshold,
    RecallThreshold: metrics.recallThreshold,
    FalsePositiveReferenceCount: metrics.falsePositiveReferenceCount,
    FalseNegativeReferenceCount: metrics.falseNegativeReferenceCount,
  };
}

function disagreementRow(area, row) {
  return {
    Area: area,
    Classification: row.classification,
    SupportFamilyId: row.supportFamilyId,
    GraphTargets: list(row.graphSteelGroupIds),
    XmlTargets: list(row.xmlSteelGroupIds),
    GraphPairs: pairList(row.graphPairs),
    XmlPairs: pairList(row.xmlPairs),
    EvidenceIds: list(row.evidenceIds),
    ReferenceIds: list(row.referenceIds),
    DistanceMm: row.distanceMm,
    ToleranceMm: row.toleranceMm,
  };
}

function pairList(rows) {
  return (rows || []).map((row) => `${row.supportA || ''} ↔ ${row.supportB || ''}`).join('|');
}

function list(value) {
  return Array.isArray(value) ? value.join('|') : value ?? '';
}

function csv(headers, rows) {
  return [headers.join(','), ...rows.map((row) => headers.map((key) => cell(row[key])).join(','))].join('\n');
}

function cell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
