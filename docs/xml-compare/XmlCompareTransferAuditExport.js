import { summarizeTransferOutput } from './XmlCompareTransferOutputModel.js';

export const XML_COMPARE_TRANSFER_AUDIT_EXPORT_SCHEMA = 'xml-compare-transfer-audit-export/v1';
const clean = (value) => String(value ?? '').trim();
const asArray = (items) => Object.freeze([...(Array.isArray(items) ? items : [])]);

function blockedReasons(audit = {}, summary = {}) {
  return asArray([...(audit?.diagnostics || []), ...(summary.blockedReasons || [])])
    .map((item) => typeof item === 'string' ? item : clean(item.message || item.code))
    .filter(Boolean);
}

export function createTransferAuditExport({ input = {}, tState = {}, generatedAt = null, exportedFileName = '' } = {}) {
  const summary = summarizeTransferOutput({ input, tState, lastAction: 'export-audit' });
  const audit = tState.transferAudit || null;
  return Object.freeze({
    schema: XML_COMPARE_TRANSFER_AUDIT_EXPORT_SCHEMA,
    generatedAt: clean(generatedAt || new Date(0).toISOString()),
    sourceFileName: summary.sourceFileName,
    targetFileName: summary.targetFileName,
    scope: summary.scope,
    selectedBlocks: summary.selectedBlocks,
    updatedCount: summary.updatedCount,
    skippedCount: summary.skippedCount,
    blockedCount: summary.blockedCount,
    blockedReasons: blockedReasons(audit || {}, summary),
    exportedFileName: clean(exportedFileName || summary.fileNames.transferAuditJson),
    patchedTargetAvailable: summary.hasPatchedTargetText,
    exportSucceeded: Boolean(tState.transferStage || audit || tState.transferLastResult),
    hierarchyConnectorAnchorMutatedByExport: false,
    transferAudit: audit,
  });
}

export function serializeTransferAuditExportJson(payload = {}) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export const _test = Object.freeze({ clean, asArray, blockedReasons });
