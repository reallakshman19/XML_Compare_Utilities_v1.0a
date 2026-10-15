import assert from 'node:assert/strict';

import { createXmlCompareCanvasState } from '../xml-compare/XmlCompareCanvasStateController.js';
import { emptyTransferExportReceipt, summarizeTransferExportReceipt } from '../xml-compare/XmlCompareTransferExportReceipt.js';
import { summarizeTransferOutput } from '../xml-compare/XmlCompareTransferOutputModel.js';
import { _test as modalTest, renderXmlCompareTransferModalPopupHtml } from '../xml-compare/XmlCompareTransferModalPopup.js';
import { renderXmlCompareWorkspaceShellHtml } from '../xml-compare/XmlCompareWorkspaceShell.js';
import { _test as tabTest } from '../tabs/xml-compare-tab.js';

const originalDocument = globalThis.document;
const originalUrl = globalThis.URL;
const originalNavigator = globalThis.navigator;
globalThis.document = { createElement: () => ({ href: '', download: '', click() {}, remove() {} }), body: { append() {} }, addEventListener() {}, activeElement: null };
globalThis.URL = { createObjectURL: () => 'blob:xml-compare-test', revokeObjectURL() {} };
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: () => Promise.resolve() } }, configurable: true });

const patchedText = '<Target><Patched>true</Patched></Target>';
const input = {
  source: { fileName: 'source.xml' },
  target: { fileName: 'target.xml' },
  aim: { transferBlocks: ['RestraintsBlock', 'NodeNameBlock'] },
  transferModal: { activeTab: 'transfer-compare' },
  transferWorkflowGate: { blockers: [] },
};
function tState() {
  return {
    transferStage: { scope: 'node', selectedBlocks: ['RestraintsBlock'] },
    transferAudit: { updatedCount: 3, skippedCount: 2, skippedBlocks: [{ reason: 'unchanged' }], diagnostics: [] },
    transferLastResult: { ok: true, scope: 'node', updatedCount: 3, skippedCount: 2, blockedCount: 1, patchedTargetText: patchedText },
  };
}
function tabState() {
  const state = tabTest.createInitialState();
  state.fileA = { name: 'source.xml', size: 10 };
  state.fileB = { name: 'target.xml', size: 10 };
  state.textA = '<Source />';
  state.textB = '<Target />';
  state.canvasState = createXmlCompareCanvasState(tState());
  state.transferModal = { ...state.transferModal, open: true, activeTab: 'transfer-compare', lastOutputReceipt: null };
  return state;
}

const empty = summarizeTransferExportReceipt(emptyTransferExportReceipt());
assert.equal(empty.isEmpty, true, 'receipt is empty before export');
const before = tState();
summarizeTransferOutput({ input, tState: before, lastAction: 'export-patched' });
assert.equal(before.transferLastResult.lastOutputReceipt, undefined, 'summary helper does not mutate transfer output state');

let state = tabState();
const sourceText = state.textA, targetText = state.textB;
tabTest.exportPatchedTargetXml(state);
let receipt = summarizeTransferExportReceipt(state.transferModal.lastOutputReceipt);
assert.equal(receipt.actionType, 'export-patched-target-xml');
assert.equal(receipt.fileName, 'target_patched_target.xml');
assert.equal(receipt.updatedCount, 3);
assert.equal(receipt.skippedCount, 2);
assert.equal(receipt.blockedCount, 1);
assert.equal(receipt.patchedTargetAvailable, true);
assert.equal(receipt.outputStatus, 'exported');
assert.equal(state.textA, sourceText, 'patched export does not alter Source text');
assert.equal(state.textB, targetText, 'patched export does not alter Target text');

state = tabState();
tabTest.downloadTransferAuditExport(state);
receipt = summarizeTransferExportReceipt(state.transferModal.lastOutputReceipt);
assert.equal(receipt.actionType, 'export-transfer-audit-json');
assert.equal(receipt.fileName, 'target_transfer_audit.json');

state = tabState();
tabTest.downloadTransferProof(state);
receipt = summarizeTransferExportReceipt(state.transferModal.lastOutputReceipt);
assert.equal(receipt.actionType, 'download-transfer-proof-json');
assert.equal(receipt.fileName, 'target_transfer_proof.json');

state = tabState();
tabTest.copyPatchedTargetPreview(state);
receipt = summarizeTransferExportReceipt(state.transferModal.lastOutputReceipt);
assert.equal(receipt.actionType, 'copy-patched-target-preview');
assert.equal(receipt.fileName, 'Copied patched Target preview');

const modalBefore = renderXmlCompareTransferModalPopupHtml({ input, tState: tState(), stageScope: 'node', transferPreview: {} });
assert.ok(modalBefore.includes('Last output receipt'));
assert.ok(modalBefore.includes('No transfer output action has been exported or copied yet.'));
const modalAfter = renderXmlCompareTransferModalPopupHtml({ input: { ...input, transferModal: { activeTab: 'transfer-compare', lastOutputReceipt: state.transferModal.lastOutputReceipt } }, tState: tState(), stageScope: 'node', transferPreview: {} });
assert.ok(modalAfter.includes('Last output receipt'));
assert.ok(modalAfter.includes('copy-patched-target-preview'));
assert.ok(modalAfter.includes('Copied patched Target preview'));
assert.ok(modalAfter.includes('Updated count'));
assert.ok(modalAfter.includes('Patched Target available'));
assert.ok(modalAfter.includes('exported'));

const candidateA = modalTest.candidateTab(input, true);
const candidateB = modalTest.candidateTab({ ...input, transferModal: { ...input.transferModal, lastOutputReceipt: state.transferModal.lastOutputReceipt } }, true);
assert.equal(candidateA, candidateB, 'Tab 1 Candidate Review markup is unchanged by receipt state');

const shellInput = { source: { records: [], levelView: { levelId: 'line', hierarchyProfile: { levels: [{ levelId: 'line', label: 'Line', recordCount: 1 }] }, fields: ['lineNo'] } }, target: { records: [], levelView: { levelId: 'line', hierarchyProfile: { levels: [{ levelId: 'line', label: 'Line', recordCount: 1 }] }, fields: ['lineNo'] } }, navStates: {}, compareFields: [], anchor: { sourceUid: 'S1', targetUid: 'T1' }, selectedRecords: {}, availableConnectors: [{ field: 'lineNo', label: 'LineNo', sourceValue: 'L1', targetValue: 'L1' }], enabledConnectorFields: ['lineNo'], aim: { connectionType: 'numeric', basis: 'coordinate' } };
const shellHtml = renderXmlCompareWorkspaceShellHtml(shellInput);
assert.ok(shellHtml.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="source"'), 'source hierarchy dropdown still renders');
assert.ok(shellHtml.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="target"'), 'target hierarchy dropdown still renders');
assert.ok(shellHtml.includes('data-xml-compare-main-connector'), 'main connector selector still renders');

if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
globalThis.URL = originalUrl;
Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
console.log('XML Compare transfer export receipt tests passed');
