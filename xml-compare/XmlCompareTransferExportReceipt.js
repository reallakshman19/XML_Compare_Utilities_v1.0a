export const XML_COMPARE_TRANSFER_EXPORT_RECEIPT_SCHEMA = 'xml-compare-transfer-export-receipt/v1';

const clean = (value) => String(value ?? '').trim();
const asArray = (items) => Object.freeze([...(Array.isArray(items) ? items : [])]);

export function emptyTransferExportReceipt() {
  return Object.freeze({
    schema: XML_COMPARE_TRANSFER_EXPORT_RECEIPT_SCHEMA,
    empty: true,
    actionType: '',
    fileName: '',
    label: '',
    timestamp: '',
    scope: '',
    selectedBlocks: Object.freeze([]),
    updatedCount: 0,
    skippedCount: 0,
    blockedCount: 0,
    patchedTargetAvailable: false,
    outputStatus: 'no-stage',
  });
}

function patchedAvailable(input = {}, summary = {}) {
  return Boolean(input.patchedTargetAvailable ?? summary.patchedTargetAvailable ?? summary.hasPatchedTargetText);
}

export function createTransferExportReceipt(input = {}) {
  const summary = input.summary || {};
  const fileName = clean(input.fileName || input.exportedFileName || summary.fileName || '');
  const label = clean(input.label || fileName || input.actionType || 'output action');
  return Object.freeze({
    schema: XML_COMPARE_TRANSFER_EXPORT_RECEIPT_SCHEMA,
    empty: false,
    actionType: clean(input.actionType || input.type || 'output-action'),
    fileName,
    label,
    timestamp: clean(input.timestamp || input.generatedAt || new Date().toISOString()),
    scope: clean(input.scope || summary.scope),
    selectedBlocks: asArray(input.selectedBlocks || summary.selectedBlocks),
    updatedCount: Number(input.updatedCount ?? summary.updatedCount ?? 0),
    skippedCount: Number(input.skippedCount ?? summary.skippedCount ?? 0),
    blockedCount: Number(input.blockedCount ?? summary.blockedCount ?? 0),
    patchedTargetAvailable: patchedAvailable(input, summary),
    outputStatus: clean(input.outputStatus || summary.outputStatus || 'no-stage'),
  });
}

export function summarizeTransferExportReceipt(receipt = null) {
  const value = receipt?.schema === XML_COMPARE_TRANSFER_EXPORT_RECEIPT_SCHEMA ? receipt : emptyTransferExportReceipt();
  return Object.freeze({
    isEmpty: Boolean(value.empty),
    actionType: value.actionType,
    fileName: value.fileName,
    label: value.label,
    timestamp: value.timestamp,
    scope: value.scope,
    selectedBlocks: asArray(value.selectedBlocks),
    updatedCount: Number(value.updatedCount || 0),
    skippedCount: Number(value.skippedCount || 0),
    blockedCount: Number(value.blockedCount || 0),
    patchedTargetAvailable: Boolean(value.patchedTargetAvailable),
    outputStatus: value.outputStatus || 'no-stage',
  });
}

export const _test = Object.freeze({ clean, asArray, patchedAvailable });
