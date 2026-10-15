import { summarizeTransferOutput } from './XmlCompareTransferOutputModel.js';
import { summarizeTransferExportHistory } from './XmlCompareTransferExportHistory.js';

export const XML_COMPARE_TRANSFER_EXPORT_PREFLIGHT_SCHEMA = 'xml-compare-transfer-export-preflight/v1';

const clean = (value) => String(value ?? '').trim();
const EXPORT_ACTIONS = Object.freeze([
  ['export-patched-target-xml', 'Patched Target XML'],
  ['export-transfer-audit-json', 'Transfer audit JSON'],
  ['download-transfer-proof-json', 'Transfer proof JSON'],
  ['copy-patched-target-preview', 'Copy patched Target preview'],
  ['export-transfer-artifact-bundle', 'Export all transfer artifacts'],
  ['export-transfer-diff-summary-json', 'Transfer diff summary JSON'],
  ['export-transfer-change-ledger-json', 'Transfer change ledger JSON'],
  ['export-transfer-change-ledger-csv', 'Transfer change ledger CSV'],
  ['export-transfer-history-json', 'Export history JSON'],
]);
const LEGACY_COUNTED_ACTIONS = new Set([
  'export-patched-target-xml',
  'export-transfer-audit-json',
  'download-transfer-proof-json',
  'copy-patched-target-preview',
  'export-transfer-artifact-bundle',
  'export-transfer-history-json',
]);

function row(actionType, label, status, reason, nextAction) {
  return Object.freeze({ actionType, label, status, reason, nextAction, ready: status === 'ready' });
}

function stagedOrApplied(summary = {}) {
  return Boolean(summary.hasStage || summary.hasAppliedResult);
}

function patchedReadiness(action, label, hasPatched, hasStage) {
  if (hasPatched) return row(action, label, 'ready', 'Patched Target XML is available.', `Run ${label}.`);
  return hasStage
    ? row(action, label, 'blocked', 'Patched Target XML is not available yet.', 'Apply staged transfer first.')
    : row(action, label, 'not available', 'No transfer stage or applied transfer result exists.', 'Stage transfer, then apply staged transfer.');
}

function stagedReadiness(action, label, hasStage) {
  return hasStage
    ? row(action, label, 'ready', 'Transfer stage/result evidence is available.', `Export ${label}.`)
    : row(action, label, 'not available', 'No transfer stage or applied transfer result exists.', 'Stage or apply transfer first.');
}

function readinessRows(summary = {}, history = {}) {
  const hasPatched = Boolean(summary.hasPatchedTargetText);
  const hasStage = stagedOrApplied(summary);
  const hasHistory = !summarizeTransferExportHistory(history).isEmpty;
  return Object.freeze(EXPORT_ACTIONS.map(([action, label]) => {
    if (action === 'export-transfer-history-json') {
      return hasHistory
        ? row(action, label, 'ready', 'Export history has visible rows.', 'Download the export history JSON.')
        : row(action, label, 'not available', 'No export history rows exist in this active tab session.', 'Run any transfer export or copy action first.');
    }
    if (action === 'export-transfer-change-ledger-json' || action === 'export-transfer-change-ledger-csv') return stagedReadiness(action, label, hasStage);
    if (action === 'export-transfer-audit-json' || action === 'download-transfer-proof-json') {
      return hasStage
        ? row(action, label, 'ready', 'Transfer is staged or applied.', `Export ${label}.`)
        : row(action, label, 'not available', 'No transfer stage or applied transfer result exists.', 'Stage transfer first.');
    }
    return patchedReadiness(action, label, hasPatched, hasStage);
  }));
}

function countedRows(rows = []) {
  return rows.filter((item) => LEGACY_COUNTED_ACTIONS.has(item.actionType));
}

export function createTransferExportPreflight({ input = {}, tState = {}, summary = null } = {}) {
  const output = summary || summarizeTransferOutput({ input, tState, lastAction: input.transferModal?.lastTransferOutputAction || '' });
  return Object.freeze({
    schema: XML_COMPARE_TRANSFER_EXPORT_PREFLIGHT_SCHEMA,
    rows: readinessRows(output, input.transferModal?.exportHistory),
    outputStatus: output.outputStatus,
    patchedTargetAvailable: Boolean(output.hasPatchedTargetText),
    stagedOrApplied: stagedOrApplied(output),
    historyRows: summarizeTransferExportHistory(input.transferModal?.exportHistory).rowCount,
  });
}

export function transferExportReadinessForAction(preflight = {}, actionType = '') {
  const action = clean(actionType);
  return preflight.rows?.find((item) => item.actionType === action) || row(action, action, 'not available', 'Unknown export action.', 'Choose a supported transfer export action.');
}

export function summarizeTransferExportPreflight(preflight = {}) {
  const value = preflight?.schema === XML_COMPARE_TRANSFER_EXPORT_PREFLIGHT_SCHEMA ? preflight : createTransferExportPreflight();
  const counted = countedRows(value.rows || []);
  return Object.freeze({
    schema: XML_COMPARE_TRANSFER_EXPORT_PREFLIGHT_SCHEMA,
    rows: Object.freeze([...(value.rows || [])]),
    readyCount: counted.filter((item) => item.status === 'ready').length,
    blockedCount: counted.filter((item) => item.status === 'blocked').length,
    notAvailableCount: counted.filter((item) => item.status === 'not available').length,
  });
}

export const _test = Object.freeze({ clean, EXPORT_ACTIONS, LEGACY_COUNTED_ACTIONS, row, stagedOrApplied, patchedReadiness, stagedReadiness, readinessRows, countedRows });
