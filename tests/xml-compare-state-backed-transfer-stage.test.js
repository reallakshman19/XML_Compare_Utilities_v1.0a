import assert from 'node:assert/strict';
import fs from 'node:fs';

import { applyXmlCompareCanvasAction, createXmlCompareCanvasState } from '../xml-compare/XmlCompareCanvasStateController.js';
import { createApprovedConnectorValidationModel } from '../xml-compare/XmlCompareApprovedConnectorModel.js';
import { buildTransferPlanPreview, applyStagedTransfer, stageTransfer } from '../xml-compare/XmlCompareTransferStateModel.js';

const sourceText = '<CategorizedInputXML><Line id="L1"><Element elementKey="E1"><Node nodeNumber="10" role="FROM"><NodeNameBlock NODE="10"><Name>S10</Name></NodeNameBlock></Node></Element></Line></CategorizedInputXML>';
const targetText = '<CategorizedInputXML><Line id="L2"><Element elementKey="E2"><Node nodeNumber="20" role="FROM"></Node></Element></Line></CategorizedInputXML>';
const sourceRecords = [{ uid: 'S-10', nodeNumber: '10', lineNo: 'L1', elementKey: 'E1', role: 'FROM', position: { x: 0, y: 0, z: 0 }, coordinateFrameStatus: { comparableForDelta: true } }];
const targetRecords = [{ uid: 'T-20', nodeNumber: '20', lineNo: 'L2', elementKey: 'E2', role: 'FROM', position: { x: 0, y: 0, z: 0 }, coordinateFrameStatus: { comparableForDelta: true } }];

const emptyPlan = buildTransferPlanPreview({ sourceText, targetText, selectedBlocks: ['NodeNameBlock'], workspaceRevision: 1 });
assert.equal(emptyPlan.ok, false, 'plan cannot be created without approved transfer cases');
assert.equal(emptyPlan.diagnostics.some((item) => item.code === 'APPROVED_TRANSFER_CASE_REQUIRED'), true);

let canvas = createXmlCompareCanvasState();
canvas = applyXmlCompareCanvasAction(canvas, { type: 'accept-candidate', candidate: { sourceUid: 'S-10', targetUid: 'T-20', basis: ['manual'], score: 0.95, identityConfidence: 0.95 } });
const approvedValidationModel = createApprovedConnectorValidationModel({ state: canvas, sourceRecords, targetRecords, compareFields: [] });
canvas = applyXmlCompareCanvasAction(canvas, { type: 'stage-transfer', scope: 'node', selectedBlocks: ['NodeNameBlock'], sourceText, targetText, workspaceRevision: 1, approvedMatchSet: canvas.approvedMatchSet, approvedValidationModel, sourceRecords, targetRecords });

assert.equal(canvas.transferStage.scope, 'node');
assert.ok(canvas.transferStage.sourceHash, 'stage stores sourceHash');
assert.ok(canvas.transferStage.targetHash, 'stage stores targetHash');
assert.ok(canvas.transferStage.planHash, 'stage stores planHash');
assert.equal(canvas.transferStage.workspaceRevision, 1, 'stage stores workspaceRevision');
assert.equal(canvas.transferStage.plan.schema, 'transfer-plan/v1');
assert.equal(canvas.transferStage.plan.ok, true);
assert.equal(canvas.transferLastResult, null, 'stage does not mark transfer applied');

let applied = applyXmlCompareCanvasAction(canvas, { type: 'apply-staged-transfer', sourceText, targetText, workspaceRevision: 1 });
assert.equal(applied.transferLastResult.ok, true, 'stage validates and applies when unchanged');
assert.equal(applied.transferAudit.schema, 'transfer-patch-audit/v1');
assert.equal(applied.postTransferValidation.schema, 'post-transfer-validation/v1');

const staleSource = applyXmlCompareCanvasAction(canvas, { type: 'apply-staged-transfer', sourceText: `${sourceText} `, targetText, workspaceRevision: 1 });
assert.equal(staleSource.transferLastResult.ok, false);
assert.equal(staleSource.transferAudit.diagnostics.some((item) => item.code === 'BLOCKED_STALE_STAGE_SOURCE'), true);

const staleTarget = applyXmlCompareCanvasAction(canvas, { type: 'apply-staged-transfer', sourceText, targetText: `${targetText} `, workspaceRevision: 1 });
assert.equal(staleTarget.transferAudit.diagnostics.some((item) => item.code === 'BLOCKED_STALE_STAGE_TARGET'), true);

const staleWorkspace = applyXmlCompareCanvasAction(canvas, { type: 'apply-staged-transfer', sourceText, targetText, workspaceRevision: 2 });
assert.equal(staleWorkspace.transferAudit.diagnostics.some((item) => item.code === 'BLOCKED_STALE_STAGE_WORKSPACE'), true);

const missingStage = applyXmlCompareCanvasAction(createXmlCompareCanvasState(), { type: 'apply-staged-transfer', sourceText, targetText, workspaceRevision: 1 });
assert.equal(missingStage.transferLastResult.ok, false);
assert.equal(missingStage.transferAudit.diagnostics.some((item) => item.code === 'TRANSFER_STAGE_MISSING'), true);

const changedPlan = { ...canvas.transferStage.plan, selectedBlocks: ['OtherBlock'] };
const stalePlan = applyStagedTransfer({ ...canvas, transferPreviewPlans: { node: changedPlan } }, { sourceText, targetText, workspaceRevision: 1 });
assert.equal(stalePlan.transferAudit.diagnostics.some((item) => item.code === 'BLOCKED_STALE_STAGE_PLAN'), true);

const exported = applyXmlCompareCanvasAction(canvas, { type: 'export-staged-transfer', sourceText, targetText, workspaceRevision: 1, downloadName: 'target_out.xml' });
assert.equal(exported.transferLastResult.ok, true);
assert.equal(exported.transferLastResult.downloadName, 'target_out.xml');
assert.equal(exported.transferLastResult.patchedTargetText.includes('S10'), true, 'patched output is Target B only');
assert.equal(sourceText.includes('S10'), true, 'Source A remains read-only input text');

const auditState = applyXmlCompareCanvasAction(exported, { type: 'export-transfer-audit' });
assert.equal(auditState.transferAudit.schema, 'transfer-patch-audit/v1');

const runtimeSource = fs.readFileSync(new URL('../tabs/xml-compare-transfer-apply-runtime.js', import.meta.url), 'utf8');
assert.equal(runtimeSource.includes('__xmlCompareTransferApplyCache'), false, 'runtime must not use global transfer cache');
assert.equal(runtimeSource.includes('details[open] pre'), false, 'runtime must not parse rendered pre JSON');
assert.equal(runtimeSource.includes('parsePreviewPlan'), false, 'runtime must not expose DOM plan parser');

const blocked = stageTransfer({}, { sourceText, targetText, workspaceRevision: 1, selectedBlocks: ['NodeNameBlock'] });
assert.equal(blocked.transferAudit.schema, 'transfer-patch-audit/v1');
assert.equal(blocked.transferLastResult.ok, false);

console.log('XML Compare state-backed transfer stage tests passed');
