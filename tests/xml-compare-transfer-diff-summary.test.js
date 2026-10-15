import assert from 'node:assert/strict';

import { _test as tabTest } from '../tabs/xml-compare-tab.js';
import { createTransferDiffSummary, serializeTransferDiffSummaryJson, transferDiffSummaryFileName } from '../xml-compare/XmlCompareTransferDiffSummary.js';
import { createTransferExportPreflight, transferExportReadinessForAction } from '../xml-compare/XmlCompareTransferExportPreflight.js';
import { summarizeTransferExportHistory } from '../xml-compare/XmlCompareTransferExportHistory.js';
import { summarizeTransferExportReceipt } from '../xml-compare/XmlCompareTransferExportReceipt.js';
import { _test as modalTest, renderXmlCompareTransferModalPopupHtml } from '../xml-compare/XmlCompareTransferModalPopup.js';
import { renderXmlCompareWorkspaceShellHtml } from '../xml-compare/XmlCompareWorkspaceShell.js';

const originalTarget = '<Target>\n  <A>1</A>\n  <B>2</B>\n</Target>';
const patchedTarget = '<Target>\n  <A>1</A>\n  <B>3</B>\n  <C>4</C>\n</Target>';
const transferSummary = { scope: 'node', selectedBlocks: ['RestraintsBlock'], updatedCount: 2, skippedCount: 1, blockedCount: 0, hasPatchedTargetText: true, outputStatus: 'exported' };
const input = { target: { fileName: 'target.xml', text: originalTarget }, targetText: originalTarget, aim: { transferBlocks: ['RestraintsBlock'] }, transferModal: { activeTab: 'transfer-compare' }, transferWorkflowGate: { blockers: [] } };
function tState(hasPatched = true) { return { transferStage: { scope: 'node', selectedBlocks: ['RestraintsBlock'] }, transferAudit: { updatedCount: 2, skippedCount: 1 }, transferLastResult: hasPatched ? { ok: true, scope: 'node', updatedCount: 2, skippedCount: 1, blockedCount: 0, patchedTargetText: patchedTarget } : null }; }

const unavailable = createTransferDiffSummary({ targetFileName: 'target.xml', originalTargetText: originalTarget, patchedTargetText: '', transferSummary: { ...transferSummary, outputStatus: 'no-stage' } });
assert.equal(unavailable.status, 'not available');
assert.equal(unavailable.reason, 'Apply staged transfer first.');
assert.equal(unavailable.patchedTargetAvailable, false);

const available = createTransferDiffSummary({ targetFileName: 'target.xml', patchedTargetFileName: 'target_patched_target.xml', originalTargetText: originalTarget, patchedTargetText: patchedTarget, transferSummary, generatedAt: '2026-07-06T00:00:00.000Z' });
assert.equal(available.status, 'available');
assert.equal(available.originalCharCount, originalTarget.length);
assert.equal(available.patchedCharCount, patchedTarget.length);
assert.equal(available.charDelta, patchedTarget.length - originalTarget.length);
assert.equal(available.originalLineCount, 4);
assert.equal(available.patchedLineCount, 5);
assert.equal(available.changedLineCount, 3);
assert.deepEqual(available.selectedBlocks, ['RestraintsBlock']);
assert.equal(available.scope, 'node');
assert.equal(transferDiffSummaryFileName('target.xml'), 'target_transfer_diff_summary.json');
assert.equal(JSON.parse(serializeTransferDiffSummaryJson(available)).changedLineCount, 3);

assert.equal(transferExportReadinessForAction(createTransferExportPreflight({ input, tState: tState(true) }), 'export-transfer-diff-summary-json').status, 'ready');
assert.notEqual(transferExportReadinessForAction(createTransferExportPreflight({ input, tState: tState(false) }), 'export-transfer-diff-summary-json').status, 'ready');

const modalBefore = renderXmlCompareTransferModalPopupHtml({ input, tState: tState(false), stageScope: 'node', transferPreview: {} });
assert.ok(modalBefore.includes('Patched Target diff summary'));
assert.ok(modalBefore.includes('Apply staged transfer first.'));
assert.ok(modalBefore.match(/data-xml-compare-action="export-transfer-diff-summary-json"[^>]*disabled/));
const modalAfter = renderXmlCompareTransferModalPopupHtml({ input, tState: tState(true), stageScope: 'node', transferPreview: {} });
assert.ok(modalAfter.includes('Changed lines'));
const diffButton = modalAfter.match(/<button[^>]+data-xml-compare-action="export-transfer-diff-summary-json"[^>]*>/)?.[0] || '';
assert.ok(diffButton.includes('data-xml-compare-preflight-status="ready"'));
assert.equal(diffButton.includes('disabled'), false);

const state = { transferModal: { lastOutputReceipt: null, exportHistory: undefined }, textA: '<Source />', textB: originalTarget };
tabTest.setOutputReceipt(state, 'export-transfer-diff-summary-json', available.exportFileName, available, available.generatedAt);
const receipt = summarizeTransferExportReceipt(state.transferModal.lastOutputReceipt);
assert.equal(receipt.actionType, 'export-transfer-diff-summary-json');
assert.equal(receipt.fileName, 'target_transfer_diff_summary.json');
assert.equal(receipt.updatedCount, 2);
assert.equal(receipt.patchedTargetAvailable, true);
assert.equal(summarizeTransferExportHistory(state.transferModal.exportHistory).rows.at(-1).actionType, 'export-transfer-diff-summary-json');
assert.equal(state.textA, '<Source />');
assert.equal(state.textB, originalTarget);

const candidateA = modalTest.candidateTab(input, true);
const candidateB = modalTest.candidateTab({ ...input, transferModal: { ...input.transferModal, lastOutputReceipt: state.transferModal.lastOutputReceipt, exportHistory: state.transferModal.exportHistory } }, true);
assert.equal(candidateA, candidateB, 'Tab 1 Candidate Review markup is unchanged');

const shellInput = { source: { records: [], levelView: { levelId: 'line', hierarchyProfile: { levels: [{ levelId: 'line', label: 'Line', recordCount: 1 }] }, fields: ['lineNo'] } }, target: { records: [], levelView: { levelId: 'line', hierarchyProfile: { levels: [{ levelId: 'line', label: 'Line', recordCount: 1 }] }, fields: ['lineNo'] } }, navStates: {}, compareFields: [], anchor: { sourceUid: 'S1', targetUid: 'T1' }, selectedRecords: {}, availableConnectors: [{ field: 'lineNo', label: 'LineNo', sourceValue: 'L1', targetValue: 'L1' }], enabledConnectorFields: ['lineNo'], aim: { connectionType: 'numeric', basis: 'coordinate' } };
const shellHtml = renderXmlCompareWorkspaceShellHtml(shellInput);
assert.ok(shellHtml.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="source"'));
assert.ok(shellHtml.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="target"'));
assert.ok(shellHtml.includes('data-xml-compare-main-connector'));

console.log('XML Compare transfer diff summary tests passed');
