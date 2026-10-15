import { applyCategorizedTransferPlan } from './XmlCompareCategorizedTransferApplier.js';
import {
  createApprovedTransferCases,
  createPostTransferValidation,
  createTransferPatchAudit,
  createTransferPlan,
  createTransferStage,
  diagnostic,
  stableHash,
  validateTransferStage,
} from './contracts/phase2-validation-transfer-orchestrator.js';

export const XML_COMPARE_TRANSFER_STATE_MODEL_SCHEMA = 'xml-compare-transfer-state-model/v1';
const clean = (value) => String(value ?? '').trim();
const asArray = (items) => Object.freeze([...(Array.isArray(items) ? items : [])]);
const isCategorized = (text = '') => /<CategorizedInputXML\b/i.test(String(text));
const transferActions = new Set(['build-transfer-plan', 'stage-transfer', 'clear-transfer-stage', 'apply-staged-transfer', 'export-staged-transfer', 'export-transfer-audit']);

export function normalizeTransferState(input = {}) {
  return Object.freeze({
    transferPreviewPlans: Object.freeze({ node: input.transferPreviewPlans?.node || null, element: input.transferPreviewPlans?.element || null, line: input.transferPreviewPlans?.line || null }),
    transferStage: input.transferStage || null,
    transferAudit: input.transferAudit || null,
    postTransferValidation: input.postTransferValidation || null,
    transferLastResult: input.transferLastResult || null,
  });
}

function recordIndex(records = []) {
  const byStableKey = new Map();
  const byUid = new Map();
  for (const record of records || []) {
    const uid = clean(record.uid);
    if (uid && !byUid.has(uid)) byUid.set(uid, record);
    const stableKey = clean(record.stableKey);
    if (stableKey && !byStableKey.has(stableKey)) byStableKey.set(stableKey, record);
  }
  return { byStableKey, byUid };
}
// G2 fix: approved-match identity is level-independent — resolve by stableKey first, then fall back to
// the uid captured at approval time. Prevents silent transfer skips after a level-view switch.
function resolveRecord(index, stableKey = '', uid = '') {
  return index.byStableKey.get(clean(stableKey)) || index.byUid.get(clean(uid)) || null;
}

function caseId(item = {}) {
  return `case:${clean(item.sourceEvidenceRef)}=>${clean(item.targetEvidenceRef)}:${clean(item.blockName)}`;
}

function selectedBlocks(input = []) {
  return asArray((input || []).map(clean).filter(Boolean));
}

function pairForCase(item = {}, source = {}, target = {}, scope = 'node') {
  if (scope === 'line') return Object.freeze({ id: caseId(item), sourceLine: clean(source.lineNo || item.sourceLineNo), targetLine: clean(target.lineNo || item.targetLineNo), approvedCaseIds: Object.freeze([caseId(item)]) });
  if (scope === 'element') return Object.freeze({ id: caseId(item), sourceElement: clean(source.elementKey || item.sourceElementKey), targetElement: clean(target.elementKey || item.targetElementKey), approvedCaseIds: Object.freeze([caseId(item)]) });
  return Object.freeze({ id: caseId(item), sourceNode: clean(source.nodeNumber || item.sourceNodeKey), targetNode: clean(target.nodeNumber || item.targetNodeKey), sourceElement: clean(source.elementKey || item.sourceElementKey), targetElement: clean(target.elementKey || item.targetElementKey), sourceRole: clean(source.role), targetRole: clean(target.role), sourceLine: clean(source.lineNo || item.sourceLineNo), targetLine: clean(target.lineNo || item.targetLineNo), approvedCaseIds: Object.freeze([caseId(item)]) });
}

function pairsFromCases(cases = [], sourceRecords = [], targetRecords = [], scope = 'node') {
  const sourceIndex = recordIndex(sourceRecords);
  const targetIndex = recordIndex(targetRecords);
  const pairs = [];
  const diagnostics = [];
  for (const item of cases || []) {
    const source = resolveRecord(sourceIndex, item.sourceStableKey, item.sourceEvidenceRef);
    const target = resolveRecord(targetIndex, item.targetStableKey, item.targetEvidenceRef);
    if (!source || !target) diagnostics.push(diagnostic('BLOCKER', 'UNRESOLVED_APPROVED_PAIR', `Approved pair could not be resolved to current ${!source ? 'source' : 'target'} records.`, { sourceEvidenceRef: clean(item.sourceEvidenceRef), targetEvidenceRef: clean(item.targetEvidenceRef), sourceStableKey: clean(item.sourceStableKey), targetStableKey: clean(item.targetStableKey) }));
    pairs.push(pairForCase(item, source || {}, target || {}, scope));
  }
  return { pairs: Object.freeze(pairs), diagnostics: Object.freeze(diagnostics) };
}

function hashPlan(plan = {}) {
  return stableHash({ ...plan, transferPlanHash: undefined });
}

function enrichPlan(basePlan = {}, input = {}) {
  const scope = clean(basePlan.scope || input.scope || 'node');
  const { pairs, diagnostics: pairDiagnostics } = pairsFromCases(basePlan.transferCases || [], input.sourceRecords, input.targetRecords, scope);
  const diagnostics = Object.freeze([...(basePlan.diagnostics || []), ...pairDiagnostics]);
  const draft = Object.freeze({ ...basePlan, transferScope: scope, selectedBlocks: selectedBlocks(input.selectedBlocks), approvedPairIds: asArray(input.approvedPairIds || []), pairs, diagnostics, ok: diagnostics.length === 0 });
  return Object.freeze({ ...draft, transferPlanHash: hashPlan(draft) });
}

export function buildTransferPlanPreview(input = {}) {
  const blocks = selectedBlocks(input.selectedBlocks?.length ? input.selectedBlocks : ['NodeNameBlock']);
  const transferCases = createApprovedTransferCases({ approvedMatchSet: input.approvedMatchSet, validationModel: input.approvedValidationModel, requestedBlocks: blocks });
  const basePlan = createTransferPlan({ approvedMatchSet: input.approvedMatchSet, transferCases, scope: input.scope || 'node', sourceText: input.sourceText, targetText: input.targetText, workspaceRevision: input.workspaceRevision });
  return enrichPlan(basePlan, { ...input, selectedBlocks: blocks });
}

function diagnosticsForApply({ stage, sourceText = '', targetText = '', plan = null, workspaceRevision = 0 } = {}) {
  const validation = validateTransferStage({ stage, sourceText, targetText, plan, workspaceRevision });
  const diagnostics = [...validation.diagnostics];
  if (!isCategorized(sourceText)) diagnostics.push(diagnostic('BLOCKER', 'SOURCE_NOT_CATEGORIZED', 'Source A must be CategorizedInputXML.'));
  if (!isCategorized(targetText)) diagnostics.push(diagnostic('BLOCKER', 'TARGET_NOT_CATEGORIZED', 'Target B must be CategorizedInputXML.'));
  if (stage?.plan && !stage.plan.transferCases?.length) diagnostics.push(diagnostic('BLOCKER', 'APPROVED_TRANSFER_CASE_REQUIRED', 'Transfer requires approved transfer cases.'));
  if (stage?.planHash && plan?.transferPlanHash && stage.planHash !== plan.transferPlanHash) diagnostics.push(diagnostic('BLOCKER', 'BLOCKED_STALE_STAGE_PLAN', 'Transfer plan changed after staging.'));
  return Object.freeze({ ok: diagnostics.length === 0, diagnostics: Object.freeze(diagnostics) });
}

function blockedState(state, plan, diagnostics, scope = 'node') {
  const audit = createTransferPatchAudit({ transferPlan: plan, result: null, diagnostics });
  return Object.freeze({ ...state, transferAudit: audit, postTransferValidation: createPostTransferValidation({ transferAudit: audit }), transferLastResult: Object.freeze({ ok: false, scope, updatedCount: 0, skippedCount: 0, downloadName: '', resultHash: '', diagnostics }) });
}

export function stageTransfer(state = {}, input = {}) {
  const current = normalizeTransferState(state);
  const plan = input.plan || buildTransferPlanPreview(input);
  const transferPreviewPlans = Object.freeze({ ...current.transferPreviewPlans, [clean(plan.scope || input.scope || 'node')]: plan });
  if (!plan.ok || !plan.transferCases?.length) return blockedState({ ...current, transferPreviewPlans }, plan, plan.diagnostics, plan.scope);
  const stage = Object.freeze({ ...createTransferStage({ plan, workspaceRevision: input.workspaceRevision }), selectedBlocks: plan.selectedBlocks, approvedPairIds: plan.approvedPairIds, approvedMatchSetHash: plan.approvedMatchSetHash });
  return Object.freeze({ ...current, transferPreviewPlans, transferStage: stage, transferAudit: null, postTransferValidation: null, transferLastResult: null });
}

export function clearTransferStage(state = {}) {
  const current = normalizeTransferState(state);
  return Object.freeze({ ...current, transferStage: null, transferAudit: null, postTransferValidation: null, transferLastResult: null });
}

function summarizeResult(result = {}, scope = 'node', name = '') {
  const updatedCount = (result.audit || []).filter((row) => row.status === 'updated').length;
  const skippedCount = (result.audit || []).filter((row) => row.status === 'skipped').length;
  return Object.freeze({ ok: Boolean(result.xml), scope, updatedCount, skippedCount, downloadName: name, resultHash: stableHash(result.xml || ''), patchedTargetText: result.xml || '', diagnostics: Object.freeze([]) });
}

export function applyStagedTransfer(state = {}, input = {}) {
  const current = normalizeTransferState(state);
  const stage = current.transferStage;
  const plan = input.plan || current.transferPreviewPlans?.[stage?.scope] || stage?.plan || null;
  const validation = diagnosticsForApply({ stage, sourceText: input.sourceText, targetText: input.targetText, plan, workspaceRevision: input.workspaceRevision });
  if (!validation.ok) return blockedState(current, stage?.plan || plan, validation.diagnostics, stage?.scope || input.scope);
  const result = applyCategorizedTransferPlan(input.targetText, input.sourceText, stage.plan, { policy: 'replace' });
  const audit = createTransferPatchAudit({ transferPlan: stage.plan, result, diagnostics: [] });
  return Object.freeze({ ...current, transferAudit: audit, postTransferValidation: createPostTransferValidation({ transferAudit: audit }), transferLastResult: summarizeResult(result, stage.scope, input.downloadName || 'target_transferred_categorized.xml') });
}

function exportAuditState(state = {}, scope = 'node') {
  const current = normalizeTransferState(state);
  if (current.transferAudit) return current;
  return blockedState(current, current.transferStage?.plan || null, [diagnostic('BLOCKER', 'TRANSFER_AUDIT_MISSING', 'No TransferPatchAudit.v1 is available to export.')], scope);
}

export function applyXmlCompareTransferStateAction(state = {}, action = {}) {
  if (!transferActions.has(action.type)) return null;
  if (action.type === 'build-transfer-plan') return stageTransfer(state, { ...action, plan: buildTransferPlanPreview(action) });
  if (action.type === 'stage-transfer') return stageTransfer(state, action);
  if (action.type === 'clear-transfer-stage') return clearTransferStage(state);
  if (action.type === 'apply-staged-transfer' || action.type === 'export-staged-transfer') return applyStagedTransfer(state, action);
  if (action.type === 'export-transfer-audit') return exportAuditState(state, action.scope);
  return normalizeTransferState(state);
}

export const _test = Object.freeze({ clean, asArray, isCategorized, caseId, selectedBlocks, pairForCase, pairsFromCases, hashPlan, diagnosticsForApply });
