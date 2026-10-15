/**
 * This component enables the Revision Impact Report by connecting the deterministic
 * report contract to a machine-readable CSV artifact consumed by workspace downloads.
 */
import { REVISION_IMPACT_REPORT_SCHEMA } from './revision-impact-report-model.js';

export const REVISION_IMPACT_CSV_COLUMNS = Object.freeze([
  'recordType', 'section', 'key', 'value', 'differenceId', 'priorityRank',
  'branchId', 'componentType', 'differenceCategory', 'effectiveDifferenceCategory',
  'matchCertainty', 'reviewState', 'decisionState', 'changeReasons',
  'changedPropertyCount', 'changedPropertyKeys', 'geometryStatus', 'maximumPointDelta',
  'revAIdentity', 'revBIdentity', 'sourceRecordId', 'targetRecordId',
  'acceptedTargetRecordId', 'consumedByDifferenceId', 'candidateCount',
  'candidateLimit', 'reachedCandidateLimit', 'reviewNote', 'decisionRationale',
  'evidenceSummary',
]);

function safeCsvText(value) {
  const text = Array.isArray(value) ? value.join(' | ') : String(value);
  if (typeof value === 'number' || typeof value === 'boolean') return text;
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = safeCsvText(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvLine(record) {
  return REVISION_IMPACT_CSV_COLUMNS.map((column) => csvCell(record[column])).join(',');
}

function metricRecord(section, key, value) {
  return { recordType: 'METRIC', section, key, value };
}

function metadataRecords(report) {
  const values = {
    schema: report.schema,
    reportId: report.reportId,
    scope: report.scope,
    sessionId: report.authority.sessionId,
    basisId: report.authority.basisId,
    auditId: report.authority.auditId,
    reviewSessionId: report.authority.reviewSessionId,
    reviewRevision: report.authority.reviewRevision,
    decisionLedgerId: report.authority.decisionLedgerId,
    decisionRevision: report.authority.decisionRevision,
    revAFileName: report.authority.revAFileName,
    revBFileName: report.authority.revBFileName,
  };
  return Object.entries(values).map(([key, value]) => metricRecord('metadata', key, value));
}

function coverageRecords(report) {
  return Object.entries(report.coverage).map(([key, value]) => metricRecord('coverage', key, value));
}

function scalarSummaryRecords(summary) {
  const keys = [
    'geometryChanged', 'propertyChanged', 'ambiguous', 'unresolvedDecision',
    'unresolvedReview', 'notesPresent', 'rationalesPresent',
  ];
  return keys.map((key) => metricRecord('summary', key, summary[key]));
}

function seriesRecords(section, values) {
  return values.map((entry) => metricRecord(section, entry.key, entry.count));
}

function summaryRecords(report) {
  const summary = report.summary;
  return [
    ...scalarSummaryRecords(summary),
    ...seriesRecords('differenceCategories', summary.differenceCategories),
    ...seriesRecords('effectiveCategories', summary.effectiveCategories),
    ...seriesRecords('matchCertainties', summary.matchCertainties),
    ...seriesRecords('reviewStates', summary.reviewStates),
    ...seriesRecords('decisionStates', summary.decisionStates),
    ...seriesRecords('changeReasons', summary.changeReasons),
    ...seriesRecords('branches', summary.branches),
    ...seriesRecords('componentTypes', summary.componentTypes),
    ...seriesRecords('changedProperties', summary.changedProperties),
  ];
}

function detailRecord(row) {
  return {
    recordType: 'DETAIL',
    section: 'differenceRows',
    differenceId: row.differenceId,
    priorityRank: row.priorityRank,
    branchId: row.branchId,
    componentType: row.componentType,
    differenceCategory: row.differenceCategory,
    effectiveDifferenceCategory: row.effectiveDifferenceCategory,
    matchCertainty: row.matchCertainty,
    reviewState: row.reviewState,
    decisionState: row.decisionState,
    changeReasons: row.changeReasons,
    changedPropertyCount: row.changedPropertyCount,
    changedPropertyKeys: row.changedPropertyKeys,
    geometryStatus: row.geometryStatus,
    maximumPointDelta: row.maximumPointDelta,
    revAIdentity: row.revAIdentity,
    revBIdentity: row.revBIdentity,
    sourceRecordId: row.sourceRecordId,
    targetRecordId: row.targetRecordId,
    acceptedTargetRecordId: row.acceptedTargetRecordId,
    consumedByDifferenceId: row.consumedByDifferenceId,
    candidateCount: row.candidateEvidence.candidateCount,
    candidateLimit: row.candidateEvidence.candidateLimit,
    reachedCandidateLimit: row.candidateEvidence.reachedCandidateLimit,
    reviewNote: row.reviewNote,
    decisionRationale: row.decisionRationale,
    evidenceSummary: row.evidenceSummary,
  };
}

function assertReport(report) {
  if (report?.schema !== REVISION_IMPACT_REPORT_SCHEMA) throw new TypeError(`Expected ${REVISION_IMPACT_REPORT_SCHEMA}.`);
  if (report.validation?.status !== 'READY') throw new TypeError('Only a ready impact report can be serialized.');
}

export function serializeRevisionImpactReportCsv(report) {
  assertReport(report);
  const records = [
    ...metadataRecords(report),
    ...coverageRecords(report),
    ...summaryRecords(report),
    ...report.rows.map(detailRecord),
  ];
  return `${csvLine(Object.fromEntries(REVISION_IMPACT_CSV_COLUMNS.map((column) => [column, column])))}\n${records.map(csvLine).join('\n')}\n`;
}

export const _test = Object.freeze({ csvCell, detailRecord, metadataRecords, safeCsvText, summaryRecords });
