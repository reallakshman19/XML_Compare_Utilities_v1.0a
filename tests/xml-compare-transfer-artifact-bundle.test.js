import assert from 'node:assert/strict';

import { _test as tabTest } from '../tabs/xml-compare-tab.js';
import { createTransferArtifactManifest, serializeTransferArtifactManifestJson, transferArtifactFileNames } from '../xml-compare/XmlCompareTransferArtifactBundle.js';
import { summarizeTransferExportReceipt } from '../xml-compare/XmlCompareTransferExportReceipt.js';
import { _test as modalTest, renderXmlCompareTransferModalPopupHtml } from '../xml-compare/XmlCompareTransferModalPopup.js';
import { renderXmlCompareWorkspaceShellHtml } from '../xml-compare/XmlCompareWorkspaceShell.js';

const patchedText = '<Target><Patched>true</Patched></Target>';
const sourceText = '<Source><A /></Source>';
const targetText = '<Target><Old /></Target>';
const input = { source: { fileName: 'source.xml' }, target: { fileName: 'target.xml' }, aim: { transferBlocks: ['RestraintsBlock'] }, transferModal: { activeTab: 'transfer-compare' }, transferWorkflowGate: { blockers: [] } };
function transferState(hasPatch = true) { return { transferStage: { scope: 'node', selectedBlocks: ['RestraintsBlock'] }, transferAudit: { updatedCount: 2, skippedCount: 1, skippedBlocks: [], diagnostics: [] }, transferLastResult: hasPatch ? { ok: true, scope: 'node', updatedCount: 2, skippedCount: 1, blockedCount: 0, patchedTargetText: patchedText } : null }; }
function bundleButton(html) { return html.match(/<button[^>]+data-xml-compare-action="export-transfer-artifact-bundle"[^>]*>/)?.[0] || ''; }

const noPatchHtml = renderXmlCompareTransferModalPopupHtml({ input, tState: transferState(false), stageScope: 'node', transferPreview: {} });
assert.equal(bundleButton(noPatchHtml), '', 'export-all button is hidden until patched Target XML exists');
const patchHtml = renderXmlCompareTransferModalPopupHtml({ input, tState: transferState(true), stageScope: 'node', transferPreview: {} });
assert.ok(bundleButton(patchHtml).includes('Export all transfer artifacts'), 'export-all button is visible');
assert.equal(bundleButton(patchHtml).includes('disabled'), false, 'export-all enabled when patched Target XML exists');

const summary = tabTest.currentTransferSummary({ fileA: { name: 'source.xml' }, fileB: { name: 'target.xml' }, textA: sourceText, textB: targetText, aim: input.aim, transferModal: input.transferModal, canvasState: transferState(true) }, 'export-bundle');
const names = transferArtifactFileNames(summary);
assert.equal(names.patchedTargetXml, 'target_patched_target.xml');
assert.equal(names.transferAuditJson, 'target_transfer_audit.json');
assert.equal(names.transferProofJson, 'target_transfer_proof.json');
assert.equal(names.transferManifestJson, 'target_transfer_manifest.json');
const manifest = createTransferArtifactManifest({ input, tState: transferState(true), summary, generatedAt: '2026-07-06T00:00:00.000Z' });
const manifestJson = JSON.parse(serializeTransferArtifactManifestJson(manifest));
assert.deepEqual(manifestJson.artifacts.map((a) => a.fileName), ['target_patched_target.xml', 'target_transfer_audit.json', 'target_transfer_proof.json', 'target_transfer_manifest.json']);

const savedDocument = globalThis.document;
const savedUrl = globalThis.URL;
const blobByUrl = new Map();
const downloads = [];
globalThis.URL = { createObjectURL(blob) { const url = `blob:test-${blobByUrl.size}`; blobByUrl.set(url, blob); return url; }, revokeObjectURL() {} };
globalThis.document = { createElement() { return { href: '', download: '', click() { downloads.push({ fileName: this.download, blob: blobByUrl.get(this.href) }); }, remove() {} }; }, body: { append() {} } };

const state = tabTest.createInitialState();
state.fileA = { name: 'source.xml', size: sourceText.length };
state.fileB = { name: 'target.xml', size: targetText.length };
state.textA = sourceText;
state.textB = targetText;
state.aim = input.aim;
state.canvasState = { ...state.canvasState, ...transferState(true) };
const result = tabTest.exportTransferArtifactBundle(state);
assert.ok(result, 'bundle export returns payloads');
assert.equal(state.textA, sourceText, 'Source text is not mutated');
assert.equal(state.textB, targetText, 'Target text is not mutated');
const receipt = summarizeTransferExportReceipt(state.transferModal.lastOutputReceipt);
assert.equal(receipt.actionType, 'export-transfer-artifact-bundle');
assert.equal(receipt.fileName, 'target_transfer_manifest.json');
assert.equal(receipt.updatedCount, 2);
assert.equal(receipt.skippedCount, 1);
assert.equal(receipt.blockedCount, 0);
assert.equal(receipt.patchedTargetAvailable, true);

const downloaded = await Promise.all(downloads.map(async (item) => ({ fileName: item.fileName, text: await item.blob.text() })));
assert.deepEqual(downloaded.map((item) => item.fileName), ['target_patched_target.xml', 'target_transfer_audit.json', 'target_transfer_proof.json', 'target_transfer_manifest.json']);
assert.equal(downloaded[0].text, patchedText, 'patched Target XML export uses actual patched text');
assert.equal(JSON.parse(downloaded[1].text).schema, 'xml-compare-transfer-audit-export/v1', 'audit export uses existing audit payload');
assert.equal(JSON.parse(downloaded[2].text).schema, 'xml-compare-transfer-proof/v1', 'proof export uses existing proof payload');
assert.deepEqual(JSON.parse(downloaded[3].text).artifacts.map((a) => a.fileName), ['target_patched_target.xml', 'target_transfer_audit.json', 'target_transfer_proof.json', 'target_transfer_manifest.json']);
globalThis.document = savedDocument;
globalThis.URL = savedUrl;

const candidateA = modalTest.candidateTab(input, true);
const candidateB = modalTest.candidateTab({ ...input, transferModal: { ...input.transferModal, lastOutputReceipt: state.transferModal.lastOutputReceipt } }, true);
assert.equal(candidateA, candidateB, 'Tab 1 Candidate Review markup is unchanged by bundle receipt state');

const shellInput = { source: { records: [], levelView: { levelId: 'line', hierarchyProfile: { levels: [{ levelId: 'line', label: 'Line', recordCount: 1 }] }, fields: ['lineNo'] } }, target: { records: [], levelView: { levelId: 'line', hierarchyProfile: { levels: [{ levelId: 'line', label: 'Line', recordCount: 1 }] }, fields: ['lineNo'] } }, navStates: {}, compareFields: [], anchor: { sourceUid: 'S1', targetUid: 'T1' }, selectedRecords: {}, availableConnectors: [{ field: 'lineNo', label: 'LineNo', sourceValue: 'L1', targetValue: 'L1' }], enabledConnectorFields: ['lineNo'], aim: { connectionType: 'numeric', basis: 'coordinate' } };
const shellHtml = renderXmlCompareWorkspaceShellHtml(shellInput);
assert.ok(shellHtml.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="source"'), 'source hierarchy dropdown still renders');
assert.ok(shellHtml.includes('data-xml-compare-level-select="levelId" data-xml-compare-side="target"'), 'target hierarchy dropdown still renders');
assert.ok(shellHtml.includes('data-xml-compare-main-connector'), 'main connector selector still renders');

console.log('XML Compare transfer artifact bundle tests passed');
