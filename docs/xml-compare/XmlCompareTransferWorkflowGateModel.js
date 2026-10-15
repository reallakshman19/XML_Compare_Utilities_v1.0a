import { stableHash } from './contracts/phase2-validation-transfer-orchestrator.js';
import { createInputReadinessAuditFromWorkspace } from './input/create-input-readiness-audit-from-workspace.js';
import { createTransferProof } from './XmlCompareTransferProofModel.js';

export const XML_COMPARE_TRANSFER_WORKFLOW_GATE_SCHEMA = 'xml-compare-transfer-workflow-gate/v1';
export const TRANSFER_WORKFLOW_BLOCKERS = Object.freeze({
  SOURCE_NOT_READY: 'SOURCE_NOT_READY',
  TARGET_NOT_READY: 'TARGET_NOT_READY',
  APPROVED_CONNECTOR_REQUIRED: 'APPROVED_CONNECTOR_REQUIRED',
  TRANSFER_STAGE_REQUIRED: 'TRANSFER_STAGE_REQUIRED',
  TRANSFER_STAGE_BLOCKED: 'TRANSFER_STAGE_BLOCKED',
  TRANSFER_APPLY_REQUIRED: 'TRANSFER_APPLY_REQUIRED',
  TRANSFER_PROOF_REQUIRED: 'TRANSFER_PROOF_REQUIRED',
  TARGET_EXPORT_BLOCKED: 'TARGET_EXPORT_BLOCKED',
  UNRESOLVED_APPROVED_PAIR: 'UNRESOLVED_APPROVED_PAIR',
});

const clean = (value) => String(value ?? '').trim();
const diagnosticCodes = (items = []) => Object.freeze((items || []).map((item) => clean(item.code)).filter(Boolean));
const blockerDiagnostics = (items = []) => Object.freeze((items || []).filter((item) => clean(item.severity) === 'BLOCKER'));
const step = (id, label, status, message, diagnostics = []) => Object.freeze({ id, label, status, message, diagnostics: Object.freeze(diagnostics) });
const blocker = (code, message, diagnostics = []) => Object.freeze({ code, message, diagnostics: Object.freeze(diagnostics) });
const diag = (code, message) => Object.freeze({ severity: 'BLOCKER', code, message });

function sideReady(readiness = {}, side = 'source') {
  const model = side === 'target' ? readiness.targetB : readiness.sourceA;
  const diagnostics = blockerDiagnostics(model?.diagnostics || []);
  return { ready: Boolean(model?.readyForConnector) && diagnostics.length === 0, diagnostics, recordCount: Number(model?.recordCount || 0) };
}
function sourceStep(readiness) {
  const side = sideReady(readiness, 'source');
  return step('source-readiness', 'Source A readiness', side.ready ? 'ready' : 'blocked', side.ready ? 'Source A is ready for connector workflow.' : 'Source A is not ready for transfer.', side.diagnostics);
}
function targetStep(readiness) {
  const side = sideReady(readiness, 'target');
  return step('target-readiness', 'Target B readiness', side.ready ? 'ready' : 'blocked', side.ready ? 'Target B is ready for connector workflow.' : 'Target B is not ready for transfer.', side.diagnostics);
}
function approvedStep(canvas = {}) {
  const count = Number(canvas.approvedMatchSet?.summary?.approvedCount || canvas.approvedMatchSet?.approvedMatches?.length || 0);
  return step('approved-connectors', 'Approved connector', count > 0 ? 'ready' : 'blocked', count > 0 ? `${count} approved connector(s) available.` : 'Approve at least one connector before staging transfer.', []);
}
function staleStageDiagnostics(canvas = {}, state = {}) {
  const stage = canvas.transferStage || {}, diagnostics = [];
  if (stage.sourceHash && stage.sourceHash !== stableHash(state.textA || '')) diagnostics.push(diag('BLOCKED_STALE_STAGE_SOURCE', 'Source XML changed after transfer stage.'));
  if (stage.targetHash && stage.targetHash !== stableHash(state.textB || '')) diagnostics.push(diag('BLOCKED_STALE_STAGE_TARGET', 'Target XML changed after transfer stage.'));
  if (stage.workspaceRevision !== undefined && Number(stage.workspaceRevision) !== Number(state.workspaceRevision || 0)) diagnostics.push(diag('BLOCKED_STALE_STAGE_WORKSPACE', 'Workspace revision changed after transfer stage.'));
  return Object.freeze(diagnostics);
}
function stageStep(canvas = {}, state = {}) {
  const stale = staleStageDiagnostics(canvas, state);
  if (stale.length) return step('transfer-stage', 'Transfer staged', 'blocked', 'Transfer stage is stale or blocked.', stale);
  if (canvas.transferLastResult?.ok) return step('transfer-stage', 'Transfer staged', 'complete', 'Transfer was staged and applied.', []);
  if (canvas.transferStage?.plan && canvas.transferStage.plan.ok) return step('transfer-stage', 'Transfer staged', 'complete', 'Transfer stage is valid.', []);
  if (canvas.transferStage?.plan && !canvas.transferStage.plan.ok) return step('transfer-stage', 'Transfer staged', 'blocked', 'Transfer stage has blocking diagnostics.', canvas.transferStage.plan.diagnostics || []);
  return step('transfer-stage', 'Transfer staged', 'pending', 'Stage transfer after readiness and approval are complete.', []);
}
function applyStep(canvas = {}) {
  if (canvas.transferLastResult?.ok) return step('transfer-apply', 'Applied in memory', 'complete', 'Transfer has been applied in memory.', []);
  if (canvas.transferLastResult?.ok === false) return step('transfer-apply', 'Applied in memory', 'blocked', 'Transfer apply was blocked.', canvas.transferAudit?.diagnostics || []);
  return step('transfer-apply', 'Applied in memory', 'pending', 'Apply the staged transfer to create a patched Target B preview.', []);
}
function proofStep(canvas = {}) {
  const proof = createTransferProof({ transferAudit: canvas.transferAudit, postTransferValidation: canvas.postTransferValidation, transferLastResult: canvas.transferLastResult });
  if (proof.ok && proof.changedBlocks.length) return step('proof-review', 'Proof reviewed', 'complete', 'Transfer proof is available for review.', proof.diagnostics);
  return step('proof-review', 'Proof reviewed', 'pending', 'Review the transfer result and proof after apply/export.', proof.diagnostics);
}
function exportStep(canvas = {}) {
  const ready = Boolean(canvas.transferLastResult?.ok && canvas.transferLastResult?.patchedTargetText && canvas.transferAudit);
  return step('target-export', 'Target export', ready ? 'ready' : 'blocked', ready ? 'Patched Target B export is ready.' : 'Apply transfer before exporting patched Target B.', []);
}
function hasUnresolvedPair(diagnostics = []) {
  return (diagnostics || []).some((item) => clean(item.code) === TRANSFER_WORKFLOW_BLOCKERS.UNRESOLVED_APPROVED_PAIR);
}
function makeBlockers({ source, target, approved, stage, applied, proof }) {
  const items = [];
  if (source.status === 'blocked') items.push(blocker(TRANSFER_WORKFLOW_BLOCKERS.SOURCE_NOT_READY, source.message, source.diagnostics));
  if (target.status === 'blocked') items.push(blocker(TRANSFER_WORKFLOW_BLOCKERS.TARGET_NOT_READY, target.message, target.diagnostics));
  if (approved.status === 'blocked') items.push(blocker(TRANSFER_WORKFLOW_BLOCKERS.APPROVED_CONNECTOR_REQUIRED, approved.message));
  if (stage.status === 'blocked') items.push(blocker(hasUnresolvedPair(stage.diagnostics) ? TRANSFER_WORKFLOW_BLOCKERS.UNRESOLVED_APPROVED_PAIR : TRANSFER_WORKFLOW_BLOCKERS.TRANSFER_STAGE_BLOCKED, stage.message, stage.diagnostics));
  if (stage.status === 'pending') items.push(blocker(TRANSFER_WORKFLOW_BLOCKERS.TRANSFER_STAGE_REQUIRED, stage.message));
  if (applied.status === 'pending') items.push(blocker(TRANSFER_WORKFLOW_BLOCKERS.TRANSFER_APPLY_REQUIRED, applied.message));
  if (proof.status === 'pending') items.push(blocker(TRANSFER_WORKFLOW_BLOCKERS.TRANSFER_PROOF_REQUIRED, proof.message, proof.diagnostics));
  return Object.freeze(items);
}
function nextAction(steps = []) {
  const first = steps.find((item) => item.status === 'blocked' || item.status === 'pending');
  if (!first) return 'Workflow complete. Export patched Target B or download proof JSON.';
  return first.message;
}
export function createXmlCompareTransferWorkflowGate({ state = {}, workspace = null, readinessAudit = null } = {}) {
  const canvas = state.canvasState || state || {};
  const readiness = readinessAudit || createInputReadinessAuditFromWorkspace({ state, workspace: workspace || {} });
  const source = sourceStep(readiness), target = targetStep(readiness), approved = approvedStep(canvas), stage = stageStep(canvas, state), applied = applyStep(canvas), proof = proofStep(canvas), targetExport = exportStep(canvas);
  const steps = Object.freeze([source, target, approved, stage, applied, proof, targetExport]);
  const blockers = makeBlockers({ source, target, approved, stage, applied, proof });
  return Object.freeze({ schema: XML_COMPARE_TRANSFER_WORKFLOW_GATE_SCHEMA, okForTransferStage: source.status === 'ready' && target.status === 'ready' && approved.status === 'ready', okForApply: stage.status === 'complete' && !canvas.transferLastResult?.ok, okForExport: targetExport.status === 'ready', steps, blockers, blockerCodes: diagnosticCodes(blockers), nextAction: nextAction(steps) });
}
export function gateAllowsAction(gate = {}, action = '') {
  if (action === 'stage-transfer') return Boolean(gate.okForTransferStage);
  if (action === 'apply-staged-transfer') return Boolean(gate.okForApply);
  if (action === 'export-staged-transfer') return Boolean(gate.okForExport);
  if (action === 'download-transfer-proof-json') return Boolean(gate.okForExport);
  if (action === 'copy-patched-target-preview') return Boolean(gate.okForExport);
  return true;
}
export const _test = Object.freeze({ clean, diagnosticCodes, blockerDiagnostics, step, blocker, diag, sideReady, sourceStep, targetStep, approvedStep, staleStageDiagnostics, stageStep, applyStep, proofStep, exportStep, makeBlockers, nextAction });
