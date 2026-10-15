import {
  APPROVED_TRANSFER_CASE_SCHEMA,
  POST_TRANSFER_VALIDATION_SCHEMA,
  TRANSFER_PATCH_AUDIT_SCHEMA,
  TRANSFER_PLAN_SCHEMA,
  clean,
  cloneArray,
  diagnostic,
  finite,
  pairKey,
  stableHash,
} from './shared.js';

export function createApprovedTransferCases({ approvedMatchSet = null, validationModel = null, requestedBlocks = [] } = {}) {
  const validationByPair = new Map((validationModel?.rows || []).map((row) => [pairKey(row.sourceUid, row.targetUid), row]));
  const blocks = normalizeBlocks(requestedBlocks);
  const cases = [];
  for (const match of approvedMatchSet?.approvedMatches || []) {
    const row = validationByPair.get(pairKey(match.sourceUid, match.targetUid));
    for (const blockName of blocks) cases.push(transferCase(match, row, blockName));
  }
  return Object.freeze(cases);
}

function normalizeBlocks(requestedBlocks) {
  return (Array.isArray(requestedBlocks) && requestedBlocks.length ? requestedBlocks : ['NodeNameBlock'])
    .map(clean)
    .filter(Boolean);
}

function transferCase(match, row, blockName) {
  return Object.freeze({
    schema: APPROVED_TRANSFER_CASE_SCHEMA,
    sourceNodeKey: clean(match.sourceStableKey || match.sourceUid),
    targetNodeKey: clean(match.targetStableKey || match.targetUid),
    sourceElementKey: clean(match.sourceElementKey || ''),
    targetElementKey: clean(match.targetElementKey || ''),
    sourceLineNo: clean(match.sourceLineNo || ''),
    targetLineNo: clean(match.targetLineNo || ''),
    blockName,
    approvalStatus: row?.status === 'OK' ? 'approved' : 'needs-review',
    identityConfidence: finite(match.identityConfidence, 0),
    coordinateDeltaMm: finite(row?.coordinateDeltaMm ?? match.coordinateDeltaMm, null),
    validationStatus: clean(row?.status || 'NOT_VALIDATED'),
    sourceStableKey: clean(match.sourceStableKey || match.sourceUid),
    targetStableKey: clean(match.targetStableKey || match.targetUid),
    sourceEvidenceRef: clean(match.sourceUid),
    targetEvidenceRef: clean(match.targetUid),
    approvedAt: row?.status === 'OK' ? new Date(0).toISOString() : '',
  });
}

export function createTransferPlan({ approvedMatchSet = null, transferCases = [], scope = 'node', sourceText = '', targetText = '', workspaceRevision = 0 } = {}) {
  const approvedCases = (transferCases || []).filter((item) => item.approvalStatus === 'approved');
  const diagnostics = transferPlanDiagnostics(approvedMatchSet, approvedCases);
  const base = Object.freeze({
    schema: TRANSFER_PLAN_SCHEMA,
    scope: clean(scope || 'node'),
    sourceHash: stableHash(sourceText),
    targetHash: stableHash(targetText),
    approvedMatchSetHash: stableHash(approvedMatchSet || {}),
    transferCases: Object.freeze(approvedCases),
    workspaceRevision: finite(workspaceRevision, 0),
    diagnostics: Object.freeze(diagnostics),
    resultTarget: 'target-only',
  });
  return Object.freeze({ ...base, transferPlanHash: stableHash(base), ok: diagnostics.length === 0 });
}

function transferPlanDiagnostics(approvedMatchSet, approvedCases) {
  const diagnostics = [];
  if (!approvedMatchSet?.approvedMatches?.length) diagnostics.push(diagnostic('BLOCKER', 'APPROVED_MATCH_SET_REQUIRED', 'Transfer requires an ApprovedMatchSet.v1.'));
  if (!approvedCases.length) diagnostics.push(diagnostic('BLOCKER', 'APPROVED_TRANSFER_CASE_REQUIRED', 'Transfer requires at least one approved transfer case.'));
  return diagnostics;
}

export function createTransferStage({ plan = null, workspaceRevision = 0 } = {}) {
  return Object.freeze({
    scope: clean(plan?.scope || 'node'),
    plan,
    sourceHash: clean(plan?.sourceHash),
    targetHash: clean(plan?.targetHash),
    planHash: clean(plan?.transferPlanHash),
    workspaceRevision: finite(workspaceRevision, finite(plan?.workspaceRevision, 0)),
    createdAt: new Date(0).toISOString(),
  });
}

export function validateTransferStage({ stage = null, sourceText = '', targetText = '', plan = null, workspaceRevision = 0 } = {}) {
  const diagnostics = [];
  if (!stage?.plan) diagnostics.push(diagnostic('BLOCKER', 'TRANSFER_STAGE_MISSING', 'Stage Transfer before applying.'));
  if (stage?.sourceHash && stage.sourceHash !== stableHash(sourceText)) diagnostics.push(diagnostic('BLOCKER', 'BLOCKED_STALE_STAGE_SOURCE', 'Source XML changed after transfer stage.'));
  if (stage?.targetHash && stage.targetHash !== stableHash(targetText)) diagnostics.push(diagnostic('BLOCKER', 'BLOCKED_STALE_STAGE_TARGET', 'Target XML changed after transfer stage.'));
  if (stage?.planHash && plan && stage.planHash !== stableHash({ ...plan, transferPlanHash: undefined })) diagnostics.push(diagnostic('BLOCKER', 'BLOCKED_STALE_STAGE_PLAN', 'Transfer plan changed after staging.'));
  if (finite(stage?.workspaceRevision, 0) !== finite(workspaceRevision, 0)) diagnostics.push(diagnostic('BLOCKER', 'BLOCKED_STALE_STAGE_WORKSPACE', 'Workspace revision changed after transfer stage.'));
  return Object.freeze({ ok: diagnostics.length === 0, diagnostics: Object.freeze(diagnostics) });
}

export function createTransferPatchAudit({ transferPlan = null, result = null, diagnostics = [] } = {}) {
  const changedBlocks = result?.changedBlocks || result?.audit?.filter?.((row) => row.status === 'updated') || [];
  const skippedBlocks = result?.skippedBlocks || result?.audit?.filter?.((row) => row.status === 'skipped') || [];
  const allDiagnostics = [...(diagnostics || []), ...(transferPlan?.diagnostics || [])];
  return Object.freeze({
    schema: TRANSFER_PATCH_AUDIT_SCHEMA,
    sourceHash: clean(transferPlan?.sourceHash),
    targetHash: clean(transferPlan?.targetHash),
    resultHash: stableHash(result?.xml || result || ''),
    approvedMatchSetHash: clean(transferPlan?.approvedMatchSetHash),
    transferPlanHash: clean(transferPlan?.transferPlanHash),
    transferCases: cloneArray(transferPlan?.transferCases || []),
    changedBlocks: cloneArray(changedBlocks),
    skippedBlocks: cloneArray(skippedBlocks),
    blockerCount: allDiagnostics.filter((item) => item.severity === 'BLOCKER').length,
    warningCount: allDiagnostics.filter((item) => item.severity === 'WARNING').length,
    diagnostics: Object.freeze(allDiagnostics),
    resultOk: Boolean(result?.ok || result?.xml),
  });
}

export function createPostTransferValidation({ transferAudit = null } = {}) {
  const blockers = (transferAudit?.diagnostics || []).filter((item) => item.severity === 'BLOCKER');
  return Object.freeze({
    schema: POST_TRANSFER_VALIDATION_SCHEMA,
    resultOk: Boolean(transferAudit?.resultOk) && blockers.length === 0,
    blockerCount: blockers.length,
    diagnostics: cloneArray(transferAudit?.diagnostics || []),
  });
}
