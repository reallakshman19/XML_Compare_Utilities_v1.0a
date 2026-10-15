export function createPsFamilyIndependentBenchmarkExports(result = {}) {
  return {
    benchmarkJson: `${JSON.stringify(result, null, 2)}\n`,
    metricsCsv: buildMetricsCsv(result),
    coverageCsv: buildCoverageCsv(result.coverage || []),
    gapsCsv: buildGapsCsv(result.gaps || []),
  };
}

function buildMetricsCsv(result) {
  const headers = ['Area', 'Status', 'MatchCount', 'ModelEvidenceCount', 'XmlReferenceCount', 'Precision', 'Recall', 'FalsePositiveCount', 'FalseNegativeCount'];
  const rows = [
    metricRow('FAMILY_TO_STEEL', result.reference?.structural?.metrics),
    metricRow('SUPPORT_MEMBER_CHAIN', result.reference?.chain?.metrics),
    metricRow('MEMBER_TO_STEEL_TERMINAL', result.memberTerminal?.metrics),
  ];
  return csv(headers, rows);
}

function buildCoverageCsv(rows) {
  const headers = ['Layer', 'CoverageStatus', 'ModelEvidenceCount', 'XmlReferenceCount', 'ClaimBoundary'];
  return csv(headers, rows.map((row) => ({
    Layer: row.layer,
    CoverageStatus: row.coverageStatus,
    ModelEvidenceCount: row.modelEvidenceCount,
    XmlReferenceCount: row.referenceEvidenceCount,
    ClaimBoundary: row.claimBoundary,
  })));
}

function buildGapsCsv(rows) {
  const headers = ['Code', 'Severity', 'Message'];
  return csv(headers, rows.map((row) => ({ Code: row.code, Severity: row.severity, Message: row.message })));
}

function metricRow(area, metrics = {}) {
  return {
    Area: area,
    Status: metrics.status,
    MatchCount: metrics.matchCount,
    ModelEvidenceCount: metrics.graphAcceptedCount,
    XmlReferenceCount: metrics.xmlReferenceCount,
    Precision: metrics.precision,
    Recall: metrics.recall,
    FalsePositiveCount: metrics.falsePositiveReferenceCount,
    FalseNegativeCount: metrics.falseNegativeReferenceCount,
  };
}

function csv(headers, rows) {
  return `${headers.join(',')}\n${rows.map((row) => headers.map((key) => cell(row[key])).join(',')).join('\n')}\n`;
}

function cell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
