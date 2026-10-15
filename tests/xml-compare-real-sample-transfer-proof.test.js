import assert from 'node:assert/strict';
import fs from 'node:fs';

import { applyXmlCompareCanvasAction, createXmlCompareCanvasState } from '../xml-compare/XmlCompareCanvasStateController.js';
import { createApprovedConnectorValidationModel } from '../xml-compare/XmlCompareApprovedConnectorModel.js';
import { applyCategorizedTransferPlan, parseCategorizedTransferDocument } from '../xml-compare/XmlCompareCategorizedTransferApplier.js';
import { createTransferProof, serializeTransferProofJson } from '../xml-compare/XmlCompareTransferProofModel.js';
import { renderXmlCompareTransferResultReviewPanelHtml } from '../xml-compare/XmlCompareTransferResultReviewPanel.js';
import { _test as tabTest } from '../tabs/xml-compare-tab.js';

const root = new URL('../samples/xml-compare/transfer-proof/', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const normalize = (xml) => String(xml).replace(/>\s+</g, '><').trim();

const sourceText = read('source-categorized.xml');
const targetText = read('target-categorized.xml');
const expectedText = read('expected-target-after-node-transfer.xml');
const proofPlan = JSON.parse(read('transfer-proof-plan.json'));

assert.ok(sourceText.includes('Line id="L-100"'), 'sample source fixture loads');
assert.ok(targetText.includes('Line id="L-200"'), 'sample target fixture loads');
assert.equal(proofPlan.schema, 'xml-compare-transfer-proof-plan/v1');
assert.equal(proofPlan.sourceRecords[0].lineNo, 'L-100');
assert.equal(proofPlan.sourceRecords[0].elementKey, 'E-L100-10-20');
assert.equal(proofPlan.sourceRecords[0].nodeNumber, '10');
assert.equal(proofPlan.targetRecords[0].role, 'FROM');

let state = createXmlCompareCanvasState();
state = applyXmlCompareCanvasAction(state, { type: 'accept-candidate', candidate: proofPlan.candidate });
const approvedValidationModel = createApprovedConnectorValidationModel({ state, sourceRecords: proofPlan.sourceRecords, targetRecords: proofPlan.targetRecords, compareFields: [] });
state = applyXmlCompareCanvasAction(state, { type: 'stage-transfer', scope: proofPlan.scope, selectedBlocks: proofPlan.selectedBlocks, sourceText, targetText, workspaceRevision: 1, approvedMatchSet: state.approvedMatchSet, approvedValidationModel, sourceRecords: proofPlan.sourceRecords, targetRecords: proofPlan.targetRecords });
state = applyXmlCompareCanvasAction(state, { type: 'apply-staged-transfer', sourceText, targetText, workspaceRevision: 1, downloadName: 'sample-target-after.xml' });

assert.equal(normalize(state.transferLastResult.patchedTargetText), normalize(expectedText), 'state-gated transfer matches expected target fixture');
assert.equal(sourceText, read('source-categorized.xml'), 'source fixture text remains unchanged');
assert.equal(parseCategorizedTransferDocument(state.transferLastResult.patchedTargetText).rootName, 'CategorizedInputXML');

const proof = createTransferProof({ transferAudit: state.transferAudit, postTransferValidation: state.postTransferValidation, transferLastResult: state.transferLastResult, generatedAt: '2026-07-03T00:00:00.000Z' });
assert.equal(proof.schema, 'xml-compare-transfer-proof/v1');
assert.equal(proof.updatedCount, proofPlan.expected.updatedCount);
assert.equal(proof.skippedCount, proofPlan.expected.skippedCount);
assert.equal(proof.blockedCount, proofPlan.expected.blockedCount);
assert.equal(proof.changedBlocks.length, 2, 'proof includes block-level changed rows');
assert.ok(proof.changedBlocks.every((row) => row.beforeXml && row.afterXml), 'proof changed rows include before and after XML');
assert.ok(serializeTransferProofJson(proof).includes('xml-compare-transfer-proof/v1'));

const reviewHtml = renderXmlCompareTransferResultReviewPanelHtml({ transferState: { transferAudit: state.transferAudit, postTransferValidation: state.postTransferValidation, transferLastResult: state.transferLastResult } });
assert.ok(reviewHtml.includes('Transfer result review'));
assert.ok(reviewHtml.includes('Updated'));
assert.ok(reviewHtml.includes('Skipped'));
assert.ok(reviewHtml.includes('NodeNameBlock'));
assert.ok(reviewHtml.includes('SupportBlock'));
assert.ok(reviewHtml.includes('&lt;NodeNameBlock'), 'before/after XML snippets are escaped for UI');
assert.ok(reviewHtml.includes('data-xml-compare-action="download-transfer-proof-json"'));
assert.ok(reviewHtml.includes('data-xml-compare-action="copy-patched-target-preview"'));

assert.equal(tabTest.currentTransferProof({ canvasState: state }).schema, 'xml-compare-transfer-proof/v1', 'proof action reads application state');
const tabSource = fs.readFileSync(new URL('../tabs/xml-compare-tab.js', import.meta.url), 'utf8');
assert.equal(/querySelector\([^)]*transfer-review/i.test(tabSource), false, 'proof action must not parse rendered transfer review rows');

const appendResult = applyCategorizedTransferPlan(targetText, sourceText, { scope: proofPlan.scope, transferScope: proofPlan.scope, selectedBlocks: ['NodeNameBlock'], pairs: [{ ...proofPlan.sourceRecords[0], ...proofPlan.targetRecords[0], sourceLine: 'L-100', sourceElement: 'E-L100-10-20', sourceNode: '10', sourceRole: 'FROM', targetLine: 'L-200', targetElement: 'E-L200-110-120', targetNode: '110', targetRole: 'FROM' }] }, { policy: 'append' });
assert.ok((appendResult.xml.match(/<NodeNameBlock\b/g) || []).length > (targetText.match(/<NodeNameBlock\b/g) || []).length, 'append policy is proven by sample fixture');

const skipResult = applyCategorizedTransferPlan(targetText, sourceText, { scope: proofPlan.scope, transferScope: proofPlan.scope, selectedBlocks: ['NodeNameBlock'], pairs: [{ sourceLine: 'L-100', sourceElement: 'E-L100-10-20', sourceNode: '10', sourceRole: 'FROM', targetLine: 'L-200', targetElement: 'E-L200-110-120', targetNode: '110', targetRole: 'FROM' }] }, { policy: 'skip-existing' });
assert.equal(skipResult.audit[0].status, 'skipped', 'skip-existing behavior is proven by sample fixture');
assert.equal(normalize(skipResult.xml), normalize(targetText), 'skip-existing preserves target when selected block exists');

console.log('XML Compare real sample transfer proof tests passed');
