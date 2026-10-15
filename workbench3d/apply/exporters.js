/**
 * exporters.js — deterministic audit/report serialization (Phase 7).
 * Every exported file embeds the config and contract version it came from.
 */

export function rowsToCsv(rows, columns) {
  const escapeCell = (value) => {
    const text = value === null || value === undefined ? '' : (typeof value === 'object' ? JSON.stringify(value) : String(value));
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = columns.map(([, label]) => escapeCell(label)).join(',');
  const body = (rows ?? []).map((row) => columns.map(([key]) => escapeCell(row?.[key])).join(','));
  return [header, ...body].join('\n');
}

export const DIFF_CSV_COLUMNS = Object.freeze([
  ['diffId', 'Diff'], ['status', 'Status'], ['sourceObjectId', 'Source'], ['targetObjectId', 'Target'],
  ['score', 'Score'], ['nextBestScore', 'Next best'], ['scoreGap', 'Gap'], ['confidence', 'Confidence'],
  ['via', 'Via'], ['geometryIssue', 'Geometry issue'], ['changedProperties', 'Changed properties'],
  ['reasons', 'Reasons'], ['conflicts', 'Conflicts'],
]);

export const CONFLICT_CSV_COLUMNS = Object.freeze([
  ['conflictId', 'Conflict'], ['diffId', 'Diff'], ['kind', 'Kind'],
  ['sourceObjectId', 'Source'], ['targetObjectId', 'Target'], ['detail', 'Detail'], ['resolution', 'Resolution'],
]);

export const TRANSFER_CSV_COLUMNS = Object.freeze([
  ['rowId', 'Row'], ['diffId', 'Diff'], ['sourceObjectId', 'Source'], ['targetObjectId', 'Target'],
  ['property', 'Property'], ['oldValue', 'Old value'], ['newValue', 'New value'], ['rule', 'Rule'],
  ['confidence', 'Confidence'], ['approval', 'Approval'], ['blockedReason', 'Blocked reason'], ['reason', 'Reason'],
]);

export const PATH_CSV_COLUMNS = Object.freeze([
  ['sourcePathId', 'Source path'], ['targetPathId', 'Target path'], ['pathStatus', 'Path status'],
  ['op', 'Operation'], ['sourceObjectId', 'Source element'], ['targetObjectId', 'Target element'], ['score', 'Score'],
]);

/** Assemble the full download package for a completed compare/transfer session. */
export function buildExportBundle({ compareAudit, transferPlan, rollbackLedger, outputXml, outputName }) {
  const files = [];
  if (compareAudit) {
    files.push({ filename: 'compare-audit.json', type: 'application/json;charset=utf-8', content: JSON.stringify(compareAudit, null, 2) });
    files.push({ filename: 'object-diff.csv', type: 'text/csv;charset=utf-8', content: rowsToCsv(compareAudit.objectDiff.rows, DIFF_CSV_COLUMNS) });
    files.push({ filename: 'conflicts.csv', type: 'text/csv;charset=utf-8', content: rowsToCsv(compareAudit.conflictLedger.rows, CONFLICT_CSV_COLUMNS) });
    files.push({ filename: 'path-alignment.csv', type: 'text/csv;charset=utf-8', content: rowsToCsv(compareAudit.pathAudit.alignmentRows, PATH_CSV_COLUMNS) });
  }
  if (transferPlan) {
    files.push({ filename: 'transfer-plan.json', type: 'application/json;charset=utf-8', content: JSON.stringify(transferPlan, null, 2) });
    files.push({ filename: 'transfer-preview.csv', type: 'text/csv;charset=utf-8', content: rowsToCsv(transferPlan.rows, TRANSFER_CSV_COLUMNS) });
  }
  if (rollbackLedger) {
    files.push({ filename: 'rollback-ledger.json', type: 'application/json;charset=utf-8', content: JSON.stringify(rollbackLedger, null, 2) });
  }
  if (outputXml) {
    files.push({ filename: outputName || 'transferred-target-inputxml.xml', type: 'application/xml;charset=utf-8', content: outputXml });
  }
  return files;
}

/** Browser download helper (no-op outside the browser). */
export function downloadFile(filename, content, type = 'text/plain;charset=utf-8') {
  if (typeof document === 'undefined') return false;
  const blob = new Blob([String(content ?? '')], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}
