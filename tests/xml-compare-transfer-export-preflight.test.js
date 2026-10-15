import assert from 'node:assert/strict';

import { createTransferExportPreflight, summarizeTransferExportPreflight, transferExportReadinessForAction } from '../xml-compare/XmlCompareTransferExportPreflight.js';
import { appendTransferExportHistory, emptyTransferExportHistory } from '../xml-compare/XmlCompareTransferExportHistory.js';
import { createTransferExportReceipt } from '../xml-compare/XmlCompareTransferExportReceipt.js';
import { _test as modalTest, renderXmlCompareTransferModalPopupHtml } from '../xml-compare/XmlCompareTransferModalPopup.js';
import { renderXmlCompareWorkspaceShellHtml } from '../xml-compare/XmlCompareWorkspaceShell.js';

const input = { source: { fileName: 'source.xml' }, target: { fileName: 'target.xml' }, aim: { transferBlocks: ['RestraintsBlock'] }, transferModal: { activeTab: 'transfer-compare', exportHistory: emptyTransferExportHistory() }, transferWorkflowGate: { blockers: [] } };
const sourceText = '<Source />';
const targetText = '<Target />';
function status(preflight, action) { return transferExportReadinessForAction(preflight, action).status; }
function buttonFor(html, action) { return html.match(new RegExp(`<button[^>]+data-xml-compare-action="${action}"[^>]*>`))?.[0] || ''; }
function stagedState() { return { transferStage: { scope: 'node', selectedBlocks: ['RestraintsBlock'] } }; }
function appliedState() { return { ...stagedState(), transferAudit: { updatedCount: 2, skippedCount: 1 }, transferLastResult: { ok: true, scope: 'node', updatedCount: 2, skippedCount: 1, blockedCount: 0, patchedTargetText: '<Target><Patched>true</Patched></Target>' } }; }

const noTransfer = createTransferExportPreflight({ input, tState: {} });
assert.equal(status(noTransfer, 'export-patched-target-xml'), 'not available', 'no staged/applied transfer blocks patched XML export');
assert.equal(status(noTransfer, 'export-transfer-audit-json'), 'not available');
assert.equal(status(noTransfer, 'download-transfer-proof-json'), 'not available');

const staged = createTransferExportPreflight({ input, tState: stagedState() });
assert.equal(status(staged, 'export-transfer-audit-json'), 'ready', 'staged transfer allows audit export');
assert.equal(status(staged, 'download-transfer-proof-json'), 'ready', 'staged transfer allows proof export');
assert.equal(status(staged, 'export-patched-target-xml'), 'blocked', 'staged transfer without patched output blocks patched XML export');
assert.equal(status(staged, 'copy-patched-target-preview'), 'blocked');
assert.equal(status(staged, 'export-transfer-artifact-bundle'), 'blocked');

const applied = createTransferExportPreflight({ input, tState: appliedState() });
assert.equal(status(applied, 'export-patched-target-xml'), 'ready', 'applied transfer with patched text allows patched XML');
assert.equal(status(applied, 'copy-patched-target-preview'), 'ready', 'applied transfer with patched text allows copy');
assert.equal(status(applied, 'export-transfer-artifact-bundle'), 'ready', 'applied transfer with patched text allows export-all');
assert.equal(status(applied, 'export-transfer-history-json'), 'not available', 'empty history blocks export history JSON');

const receipt = createTransferExportReceipt({ actionType: 'export-patched-target-xml', fileName: 'target_patched_target.xml', summary: { scope: 'node', selectedBlocks: ['RestraintsBlock'], updatedCount: 2, skippedCount: 1, blockedCount: 0, hasPatchedTargetText: true, outputStatus: 'exported' } });
const historyInput = { ...input, transferModal: { ...input.transferModal, exportHistory: appendTransferExportHistory(input.transferModal.exportHistory, receipt) } };
const withHistory = createTransferExportPreflight({ input: historyInput, tState: appliedState() });
assert.equal(status(withHistory, 'export-transfer-history-json'), 'ready', 'non-empty history allows export history JSON');
const preflightSummary = summarizeTransferExportPreflight(withHistory);
assert.equal(preflightSummary.readyCount, 6);

const modalHtml = renderXmlCompareTransferModalPopupHtml({ input: historyInput, tState: appliedState(), stageScope: 'node', transferPreview: {} });
assert.ok(modalHtml.includes('Export preflight'), 'modal renders Export preflight');
for (const row of withHistory.rows) {
  assert.ok(modalHtml.includes(`data-xml-compare-preflight-action="${row.actionType}"`), `preflight row rendered for ${row.actionType}`);
  const button = buttonFor(modalHtml, row.actionType);
  assert.ok(button.includes(`data-xml-compare-preflight-status="${row.status}"`), `button status agrees for ${row.actionType}`);
  assert.equal(button.includes('disabled'), !row.ready, `button disabled agrees for ${row.actionType}`);
}
const stagedHtml = renderXmlCompareTransferModalPopupHtml({ input, tState: stagedState(), stageScope: 'node', transferPreview: {} });
assert.ok(stagedHtml.includes('Detailed export preflight'), 'staged transfer still exposes preflight evidence');
assert.ok(stagedHtml.includes('data-xml-compare-preflight-action="export-patched-target-xml"'), 'staged preflight row still explains patched XML readiness');
assert.equal(buttonFor(stagedHtml, 'export-patched-target-xml'), '', 'staged-only view hides export buttons until patched output exists');

const beforeSource = sourceText;
const beforeTarget = targetText;
createTransferExportPreflight({ input: historyInput, tState: appliedState() });
assert.equal(beforeSource, sourceText, 'preflight does not mutate Source text');
assert.equal(beforeTarget, targetText, 'preflight does not mutate Target text');

const candidateA = modalTest.candidateTab(input, true);
const candidateB = modalTest.candidateTab({ ...input, transferModal: { ...input.transferModal, exportHistory: historyInput.transferModal.exportHistory } }, true);
assert.equal(candidateA, candidateB, 'Tab 1 Candidate Review markup is unchanged by preflight state');

const shellInput = { source: { records: [], levelView: { levelId: 'line', hierarchyProfile: { levels: [{ levelId: 'line', label: 'Line', recordCount: 1 }] }, fields: ['lineNo'] } }, target: { records: [], levelView: { levelId: 'line', hierarchyProfile: { levels: [{ levelId: 'line', label: 'Line', recordCount: 1 }] }, fields: ['lineNo'] } }, navStates: {}, compareFields: [], anchor: { sourceUid: 'S1', targetUid: 'T1' }, selectedRecords: {}, availableConnectors: [{ field: 'lineNo', label: 'LineNo', sourceValue: 'L1', targetValue: 'L1' }], enabledConnectorFields: ['lineNo'], aim: { connectionType: 'numeric', basis: 'coordinate' } };
const shellHtml = renderXmlCompareWorkspaceShellHtml(shellInput);
assert.ok(shellHtml.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="source"'), 'source hierarchy dropdown still renders');
assert.ok(shellHtml.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="target"'), 'target hierarchy dropdown still renders');
assert.ok(shellHtml.includes('data-xml-compare-main-connector'), 'main connector selector still renders');

console.log('XML Compare transfer export preflight tests passed');
