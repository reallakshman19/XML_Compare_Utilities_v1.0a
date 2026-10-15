import assert from 'node:assert/strict';

import { _test as tabTest } from '../tabs/xml-compare-tab.js';
import { createTransferChangeLedger, serializeTransferChangeLedgerCsv, serializeTransferChangeLedgerJson, transferChangeLedgerFileNames } from '../xml-compare/XmlCompareTransferChangeLedger.js';
import { createTransferExportPreflight, transferExportReadinessForAction } from '../xml-compare/XmlCompareTransferExportPreflight.js';
import { summarizeTransferExportHistory } from '../xml-compare/XmlCompareTransferExportHistory.js';
import { summarizeTransferExportReceipt } from '../xml-compare/XmlCompareTransferExportReceipt.js';
import { _test as modalTest, renderXmlCompareTransferModalPopupHtml } from '../xml-compare/XmlCompareTransferModalPopup.js';
import { renderXmlCompareWorkspaceShellHtml } from '../xml-compare/XmlCompareWorkspaceShell.js';

const summary = { hasStage: true, scope: 'node', selectedBlocks: ['RestraintsBlock'], updatedCount: 2, skippedCount: 1, blockedCount: 1, hasPatchedTargetText: true, outputStatus: 'exported' };
const input = { source: { fileName: 'source.xml' }, target: { fileName: 'target.xml' }, aim: { transferBlocks: ['RestraintsBlock'] }, transferModal: { activeTab: 'transfer-compare' }, transferWorkflowGate: { blockers: [] } };
const staged = { transferStage: { scope: 'node', selectedBlocks: ['RestraintsBlock'] } };
const applied = { ...staged, transferAudit: { updatedCount: 2, skippedCount: 1, blockerCount: 1 }, transferLastResult: { ok: true, scope: 'node', updatedCount: 2, skippedCount: 1, blockedCount: 1, patchedTargetText: '<Target />' } };

const unavailable = createTransferChangeLedger({ input, tState: {}, transferSummary: {} });
assert.equal(unavailable.status, 'not available');
assert.equal(unavailable.reason, 'Stage or apply transfer first.');
assert.equal(unavailable.rowCount, 0);

const ledger = createTransferChangeLedger({ input, tState: applied, transferSummary: summary, generatedAt: '2026-07-06T00:00:00.000Z' });
assert.equal(ledger.status, 'available');
assert.equal(ledger.sourceFileName, 'source.xml');
assert.equal(ledger.targetFileName, 'target.xml');
assert.equal(ledger.scope, 'node');
assert.deepEqual(ledger.selectedBlocks, ['RestraintsBlock']);
assert.equal(ledger.updatedCount, 2);
assert.equal(ledger.skippedCount, 1);
assert.equal(ledger.blockedCount, 1);
assert.equal(ledger.rowCount, 3);
assert.deepEqual(ledger.rows.map((row) => row.status), ['updated', 'skipped', 'blocked']);
assert.ok(ledger.rows.every((row) => row.reason.includes('Detailed field-level evidence is not available')));
assert.deepEqual(transferChangeLedgerFileNames('target.xml'), { json: 'target_transfer_change_ledger.json', csv: 'target_transfer_change_ledger.csv' });
assert.equal(JSON.parse(serializeTransferChangeLedgerJson(ledger)).rowCount, 3);
assert.ok(serializeTransferChangeLedgerCsv(ledger).includes('rowNumber,blockName,sourceUid'));

const detailLedger = createTransferChangeLedger({ input, tState: { transferAudit: { changedBlocks: [{ blockName: 'RestraintsBlock', sourceUid: 'S1', targetUid: 'T1', fieldName: 'SupportType', previousValue: 'OLD', nextValue: 'NEW' }] } }, transferSummary: { ...summary, updatedCount: 1, skippedCount: 0, blockedCount: 0 } });
assert.equal(detailLedger.rowCount, 1);
assert.equal(detailLedger.rows[0].fieldName, 'SupportType');
assert.equal(detailLedger.rows[0].previousValue, 'OLD');
assert.equal(detailLedger.rows[0].nextValue, 'NEW');

const preflight = createTransferExportPreflight({ input, tState: applied, summary });
assert.equal(transferExportReadinessForAction(preflight, 'export-transfer-change-ledger-json').status, 'ready');
assert.equal(transferExportReadinessForAction(preflight, 'export-transfer-change-ledger-csv').status, 'ready');
const blockedPreflight = createTransferExportPreflight({ input, tState: {}, summary: {} });
assert.equal(transferExportReadinessForAction(blockedPreflight, 'export-transfer-change-ledger-json').status, 'not available');

const modalBefore = renderXmlCompareTransferModalPopupHtml({ input, tState: {}, stageScope: 'node', transferPreview: {} });
assert.ok(modalBefore.includes('data-transfer-evidence="none"'));
assert.ok(modalBefore.includes('Start transfer'));
assert.ok(!modalBefore.includes('Transfer change ledger'), 'ledger panel must not render before transfer evidence exists');
assert.ok(!modalBefore.includes('export-transfer-change-ledger-json'), 'ledger export button must not render before transfer evidence exists');
const modalAfter = renderXmlCompareTransferModalPopupHtml({ input, tState: applied, stageScope: 'node', transferPreview: {} });
assert.ok(modalAfter.includes('Ledger row count'));
assert.ok(modalAfter.includes('Export change ledger JSON'));
const jsonButton = modalAfter.match(/<button[^>]+data-xml-compare-action="export-transfer-change-ledger-json"[^>]*>/)?.[0] || '';
const csvButton = modalAfter.match(/<button[^>]+data-xml-compare-action="export-transfer-change-ledger-csv"[^>]*>/)?.[0] || '';
assert.ok(jsonButton.includes('data-xml-compare-preflight-status="ready"'));
assert.ok(csvButton.includes('data-xml-compare-preflight-status="ready"'));
assert.equal(jsonButton.includes('disabled'), false);
assert.equal(csvButton.includes('disabled'), false);

const state = { transferModal: { lastOutputReceipt: null, exportHistory: undefined }, textA: '<Source />', textB: '<Target />' };
tabTest.setOutputReceipt(state, 'export-transfer-change-ledger-json', ledger.fileNames.json, ledger, ledger.generatedAt);
let receipt = summarizeTransferExportReceipt(state.transferModal.lastOutputReceipt);
assert.equal(receipt.actionType, 'export-transfer-change-ledger-json');
assert.equal(receipt.fileName, 'target_transfer_change_ledger.json');
assert.equal(receipt.updatedCount, 2);
assert.equal(summarizeTransferExportHistory(state.transferModal.exportHistory).rows.at(-1).actionType, 'export-transfer-change-ledger-json');
tabTest.setOutputReceipt(state, 'export-transfer-change-ledger-csv', ledger.fileNames.csv, ledger, ledger.generatedAt);
receipt = summarizeTransferExportReceipt(state.transferModal.lastOutputReceipt);
assert.equal(receipt.actionType, 'export-transfer-change-ledger-csv');
assert.equal(receipt.fileName, 'target_transfer_change_ledger.csv');
assert.equal(summarizeTransferExportHistory(state.transferModal.exportHistory).rows.at(-1).actionType, 'export-transfer-change-ledger-csv');
assert.equal(state.textA, '<Source />');
assert.equal(state.textB, '<Target />');

const candidateA = modalTest.candidateTab(input, true);
const candidateB = modalTest.candidateTab({ ...input, transferModal: { ...input.transferModal, lastOutputReceipt: state.transferModal.lastOutputReceipt, exportHistory: state.transferModal.exportHistory } }, true);
assert.equal(candidateA, candidateB, 'Tab 1 Candidate Review markup is unchanged');

const shellInput = { source: { records: [], levelView: { levelId: 'line', hierarchyProfile: { levels: [{ levelId: 'line', label: 'Line', recordCount: 1 }] }, fields: ['lineNo'] } }, target: { records: [], levelView: { levelId: 'line', hierarchyProfile: { levels: [{ levelId: 'line', label: 'Line', recordCount: 1 }] }, fields: ['lineNo'] } }, navStates: {}, compareFields: [], anchor: { sourceUid: 'S1', targetUid: 'T1' }, selectedRecords: {}, availableConnectors: [{ field: 'lineNo', label: 'LineNo', sourceValue: 'L1', targetValue: 'L1' }], enabledConnectorFields: ['lineNo'], aim: { connectionType: 'numeric', basis: 'coordinate' } };
const shellHtml = renderXmlCompareWorkspaceShellHtml(shellInput);
assert.ok(shellHtml.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="source"'));
assert.ok(shellHtml.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="target"'));
assert.ok(shellHtml.includes('data-xml-compare-main-connector'));

console.log('XML Compare transfer change ledger tests passed');
