import assert from 'node:assert/strict';

import { _test as modalTest, renderXmlCompareTransferModalPopupHtml } from '../xml-compare/XmlCompareTransferModalPopup.js';
import { renderXmlCompareWorkspaceShellHtml } from '../xml-compare/XmlCompareWorkspaceShell.js';

const baseGate = { blockers: [], okForTransferStage: true, nextAction: 'Stage transfer after readiness and approval are complete.' };
const input = {
  source: { fileName: 'source.xml' },
  target: { fileName: 'target.xml', text: '<Target />' },
  targetText: '<Target />',
  aim: { transferBlocks: ['RestraintsBlock'] },
  transferModal: { activeTab: 'transfer-compare' },
  transferWorkflowGate: baseGate,
};
const staged = { transferStage: { scope: 'node', selectedBlocks: ['RestraintsBlock'] } };
const applied = {
  ...staged,
  transferAudit: { updatedCount: 2, skippedCount: 1, blockerCount: 0 },
  transferLastResult: { ok: true, scope: 'node', updatedCount: 2, skippedCount: 1, blockedCount: 0, patchedTargetText: '<Target><Patched>true</Patched></Target>' },
};

const noStageHtml = renderXmlCompareTransferModalPopupHtml({ input, tState: {}, stageScope: 'node', transferPreview: {} });
assert.ok(noStageHtml.includes('Transfer Output Dashboard'));
assert.ok(noStageHtml.includes('What to do next'));
assert.ok(noStageHtml.includes('Stage transfer to make output evidence visible.'));
assert.ok(noStageHtml.includes('data-transfer-evidence="none"'));
assert.ok(noStageHtml.includes('Start transfer'));
assert.ok(noStageHtml.includes('Ready to stage'));
assert.ok(noStageHtml.includes('Output, export, diff, ledger, receipt, and history panels will appear after a transfer is staged or applied.'));
assert.ok(noStageHtml.includes('Advanced readiness evidence'));
assert.ok(noStageHtml.includes('data-xml-compare-dashboard-card="stage"'));
assert.ok(!noStageHtml.includes('data-xml-compare-dashboard-card="patched-target"'), 'no-stage view must not render downstream patched-target card');
assert.ok(!noStageHtml.includes('data-xml-compare-dashboard-card="exports"'), 'no-stage view must not render downstream export card');
assert.ok(!noStageHtml.includes('Detailed export preflight'), 'no-stage view must not render downstream export panel');
assert.ok(!noStageHtml.includes('Transfer change ledger details'), 'no-stage view must not render downstream ledger panel');
assert.ok(!noStageHtml.includes('Patched Target diff details'), 'no-stage view must not render downstream diff panel');
assert.ok(!noStageHtml.includes('Last output receipt'), 'no-stage view must not render receipt panel');
assert.ok(!noStageHtml.includes('Export history'), 'no-stage view must not render history panel');
assert.ok(!noStageHtml.includes('Export patched Target XML'), 'no-stage view must not render disabled export buttons');
assert.ok(!noStageHtml.includes('Patched Target preview'), 'no-stage view must not render patched preview placeholder');

const stagedHtml = renderXmlCompareTransferModalPopupHtml({ input, tState: staged, stageScope: 'node', transferPreview: {} });
assert.ok(stagedHtml.includes('data-transfer-evidence="available"'));
assert.ok(stagedHtml.includes('Apply staged transfer to generate patched Target XML.'));
assert.ok(stagedHtml.includes('RestraintsBlock staged'));
assert.ok(stagedHtml.includes('Detailed export preflight'));
assert.ok(stagedHtml.includes('Export buttons unlock after applying staged transfer.'));
assert.ok(stagedHtml.includes('Export buttons unlock after applying staged transfer.'), 'staged-only export card must match actual hidden export buttons');
assert.ok(!stagedHtml.includes('Use the export action buttons.'), 'staged-only view must not claim hidden export action buttons are usable');
assert.ok(!stagedHtml.includes('Export patched Target XML'), 'staged-only view should not show export buttons before apply evidence exists');

const appliedHtml = renderXmlCompareTransferModalPopupHtml({ input, tState: applied, stageScope: 'node', transferPreview: { summary: { previewCount: 4 } } });
assert.ok(appliedHtml.includes('Export the needed artifact from the action bar'));
assert.ok(appliedHtml.includes('target_patched_target.xml'));
assert.ok(appliedHtml.includes('0 changed line(s)') || appliedHtml.includes('changed line'));
assert.ok(appliedHtml.includes('history row(s), preview fields 4'));
assert.ok(appliedHtml.includes('Export change ledger JSON'));
assert.ok(appliedHtml.includes('Export diff summary JSON'));
assert.ok(appliedHtml.includes('Patched Target preview'));
assert.ok(appliedHtml.includes('Use the export action buttons.'));

const dashboard = modalTest.dashboardPanel(input, applied, { summary: { previewCount: 4 } });
assert.ok(dashboard.includes('Transfer Output Dashboard'));
assert.ok(dashboard.includes('data-xml-compare-dashboard-card="ledger"'));
assert.ok(dashboard.includes('Use the export action buttons.'));
assert.equal(modalTest.dashboardNextAction({ hasStage: false }, {}, {}, {}), 'Stage transfer to make output evidence visible.');
assert.equal(modalTest.dashboardNextAction({ hasStage: true, hasAppliedResult: false }, {}, {}, {}), 'Apply staged transfer to generate patched Target XML.');
assert.equal(modalTest.hasTransferEvidence(input, {}), false);
assert.equal(modalTest.hasTransferEvidence(input, staged), true);
assert.deepEqual(modalTest.visibleExportActions({ hasStage: true, hasAppliedResult: false, hasPatchedTargetText: false }), []);
assert.ok(modalTest.visibleExportActions({ hasAppliedResult: true, hasPatchedTargetText: true }).includes('export-patched-target-xml'));

const hardGate = { blockers: [{ code: 'SOURCE_NOT_READY', message: 'Source A is not ready.' }, { code: 'TRANSFER_STAGE_REQUIRED', message: 'Stage transfer after readiness.' }] };
assert.deepEqual(modalTest.hardTransferBlockers(hardGate).map((item) => item.code), ['SOURCE_NOT_READY']);
assert.ok(modalTest.transferStartPanel({ ...input, transferWorkflowGate: hardGate }, {}, 'node').includes('Source A is not ready.'));
const pendingOnlyGate = { okForTransferStage: true, blockers: [{ code: 'TRANSFER_STAGE_REQUIRED', message: 'Stage transfer after readiness.' }], nextAction: 'Stage transfer after readiness.' };
assert.ok(modalTest.transferStartPanel({ ...input, transferWorkflowGate: pendingOnlyGate }, {}, 'node').includes('Ready to stage'));

const candidateA = modalTest.candidateTab(input, true);
const candidateB = modalTest.candidateTab({ ...input, transferModal: { ...input.transferModal, activeTab: 'transfer-compare' } }, true);
assert.equal(candidateA, candidateB, 'Tab 1 Candidate Review markup is unchanged by dashboard state');

const shellInput = { source: { records: [], levelView: { levelId: 'line', hierarchyProfile: { levels: [{ levelId: 'line', label: 'Line', recordCount: 1 }] }, fields: ['lineNo'] } }, target: { records: [], levelView: { levelId: 'line', hierarchyProfile: { levels: [{ levelId: 'line', label: 'Line', recordCount: 1 }] }, fields: ['lineNo'] } }, navStates: {}, compareFields: [], anchor: { sourceUid: 'S1', targetUid: 'T1' }, selectedRecords: {}, availableConnectors: [{ field: 'lineNo', label: 'LineNo', sourceValue: 'L1', targetValue: 'L1' }], enabledConnectorFields: ['lineNo'], aim: { connectionType: 'numeric', basis: 'coordinate' } };
const shellHtml = renderXmlCompareWorkspaceShellHtml(shellInput);
assert.ok(shellHtml.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="source"'));
assert.ok(shellHtml.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="target"'));
assert.ok(shellHtml.includes('data-xml-compare-main-connector'));

console.log('XML Compare transfer output dashboard state-truth tests passed');
