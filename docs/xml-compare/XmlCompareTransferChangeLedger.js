export const XML_COMPARE_TRANSFER_CHANGE_LEDGER_SCHEMA = 'xml-compare-transfer-change-ledger/v1';

const clean = (value) => String(value ?? '').trim();
const asArray = (items) => Object.freeze([...(Array.isArray(items) ? items : [])]);
const SUMMARY_REASON = 'Detailed field-level evidence is not available in the current transfer result.';

function baseName(name = '') {
  return clean(name).replace(/\.(xml|json|txt|csv)$/i, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'xml_compare';
}

function fileNameOf(input = {}, side = 'target') {
  const key = side === 'source' ? 'source' : 'target';
  const fallback = side === 'source' ? 'Source A' : 'Target B';
  return clean(input[key]?.fileName || input[`${key}FileName`] || input[side === 'source' ? 'fileA' : 'fileB']?.name || fallback);
}

function scopeOf(input = {}, tState = {}, summary = {}) {
  return clean(summary.scope || tState.transferLastResult?.scope || tState.transferStage?.scope || input.transferWorkflowGate?.scope || 'node');
}

function selectedBlocksOf(input = {}, tState = {}, summary = {}) {
  return asArray(summary.selectedBlocks?.length ? summary.selectedBlocks : tState.transferStage?.selectedBlocks?.length ? tState.transferStage.selectedBlocks : input.aim?.transferBlocks || []);
}

function hasEvidence(tState = {}, summary = {}) {
  return Boolean(summary.hasStage || summary.hasAppliedResult || tState.transferStage || tState.transferAudit || tState.transferLastResult);
}

function fieldOf(row = {}) {
  return clean(row.fieldName || row.field || row.name || row.key || row.path || row.column || '');
}

function valueOf(row = {}, names = []) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null) return String(row[name]);
  }
  return '';
}

function detailRow(row = {}, index = 0, fallbackStatus = 'updated') {
  return Object.freeze({
    rowNumber: index + 1,
    blockName: clean(row.blockName || row.block || row.blockCode || row.type || ''),
    sourceUid: clean(row.sourceUid || row.sourceUID || row.sourceId || row.sourceKey || ''),
    sourceLabel: clean(row.sourceLabel || row.sourceName || row.sourceDisplayName || ''),
    targetUid: clean(row.targetUid || row.targetUID || row.targetId || row.targetKey || ''),
    targetLabel: clean(row.targetLabel || row.targetName || row.targetDisplayName || ''),
    fieldName: fieldOf(row),
    previousValue: valueOf(row, ['previousValue', 'oldValue', 'targetValue', 'beforeValue', 'fromValue']),
    nextValue: valueOf(row, ['nextValue', 'newValue', 'sourceValue', 'afterValue', 'toValue']),
    status: clean(row.status || fallbackStatus),
    reason: clean(row.reason || row.message || row.code || ''),
  });
}

function detailedRows(tState = {}) {
  const audit = tState.transferAudit || {};
  const changed = asArray(audit.changedBlocks).map((row, index) => detailRow(row, index, clean(row.status) || 'updated'));
  const skipped = asArray(audit.skippedBlocks).map((row, index) => detailRow(row, changed.length + index, clean(row.status) || 'skipped'));
  return Object.freeze([...changed, ...skipped]);
}

function summaryRow(rowNumber, blockName, status, count) {
  return Object.freeze({ rowNumber, blockName, sourceUid: '', sourceLabel: '', targetUid: '', targetLabel: '', fieldName: '', previousValue: '', nextValue: '', status, reason: count ? `${count} ${status} transfer row(s). ${SUMMARY_REASON}` : SUMMARY_REASON });
}

function summaryRows(summary = {}) {
  const blocks = asArray(summary.selectedBlocks).join(', ') || '-';
  const rows = [];
  if (Number(summary.updatedCount || 0) > 0) rows.push(summaryRow(rows.length + 1, blocks, 'updated', summary.updatedCount));
  if (Number(summary.skippedCount || 0) > 0) rows.push(summaryRow(rows.length + 1, blocks, 'skipped', summary.skippedCount));
  if (Number(summary.blockedCount || 0) > 0) rows.push(summaryRow(rows.length + 1, blocks, 'blocked', summary.blockedCount));
  return Object.freeze(rows);
}

export function transferChangeLedgerFileNames(targetFileName = '') {
  const base = baseName(targetFileName);
  return Object.freeze({ json: `${base}_transfer_change_ledger.json`, csv: `${base}_transfer_change_ledger.csv` });
}

export function createTransferChangeLedger({ input = {}, tState = {}, transferSummary = {}, generatedAt = null } = {}) {
  const available = hasEvidence(tState, transferSummary);
  const sourceFileName = fileNameOf(input, 'source');
  const targetFileName = fileNameOf(input, 'target');
  const selectedBlocks = selectedBlocksOf(input, tState, transferSummary);
  const detail = detailedRows(tState);
  const summary = { ...transferSummary, selectedBlocks };
  const rows = available ? (detail.length ? detail : summaryRows(summary)) : Object.freeze([]);
  return Object.freeze({
    schema: XML_COMPARE_TRANSFER_CHANGE_LEDGER_SCHEMA,
    generatedAt: clean(generatedAt || new Date(0).toISOString()),
    status: available ? 'available' : 'not available',
    reason: available ? 'Transfer stage/result evidence is available.' : 'Stage or apply transfer first.',
    sourceFileName,
    targetFileName,
    scope: scopeOf(input, tState, transferSummary),
    selectedBlocks,
    updatedCount: Number(transferSummary.updatedCount ?? tState.transferLastResult?.updatedCount ?? tState.transferAudit?.updatedCount ?? 0),
    skippedCount: Number(transferSummary.skippedCount ?? tState.transferLastResult?.skippedCount ?? tState.transferAudit?.skippedCount ?? 0),
    blockedCount: Number(transferSummary.blockedCount ?? tState.transferLastResult?.blockedCount ?? tState.transferAudit?.blockerCount ?? 0),
    rowCount: rows.length,
    patchedTargetAvailable: Boolean(transferSummary.hasPatchedTargetText || clean(tState.transferLastResult?.patchedTargetText)),
    outputStatus: clean(transferSummary.outputStatus || (available ? 'staged' : 'no-stage')),
    fileNames: transferChangeLedgerFileNames(targetFileName),
    rows,
  });
}

export function serializeTransferChangeLedgerJson(ledger = {}) {
  return `${JSON.stringify(ledger, null, 2)}\n`;
}

function csvCell(value = '') {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeTransferChangeLedgerCsv(ledger = {}) {
  const header = ['rowNumber', 'blockName', 'sourceUid', 'sourceLabel', 'targetUid', 'targetLabel', 'fieldName', 'previousValue', 'nextValue', 'status', 'reason'];
  const lines = [header.join(',')];
  for (const row of ledger.rows || []) lines.push(header.map((key) => csvCell(row[key])).join(','));
  return `${lines.join('\n')}\n`;
}

export const _test = Object.freeze({ clean, asArray, baseName, fileNameOf, scopeOf, selectedBlocksOf, hasEvidence, fieldOf, valueOf, detailRow, detailedRows, summaryRow, summaryRows, csvCell });
