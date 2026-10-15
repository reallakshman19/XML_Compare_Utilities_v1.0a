export {
  XML_COMPARE_PHASE2_ORCHESTRATOR_SCHEMA,
  MATCH_CANDIDATE_SET_SCHEMA,
  MATCH_DECISION_SCHEMA,
  APPROVED_MATCH_SET_SCHEMA,
  TRANSFORM_POLICY_SCHEMA,
  VALIDATION_MODEL_V2_SCHEMA,
  VALIDATION_AUDIT_V2_SCHEMA,
  APPROVED_TRANSFER_CASE_SCHEMA,
  TRANSFER_PLAN_SCHEMA,
  TRANSFER_PATCH_AUDIT_SCHEMA,
  POST_TRANSFER_VALIDATION_SCHEMA,
  DEFAULT_TRANSFORM_POLICY,
  DEFAULT_NUMERIC_TOLERANCE_POLICY,
  diagnostic,
  stableHash,
  stableJson,
} from './phase2/shared.js';

export {
  createTransformPolicy,
  createMatchCandidateSet,
  createMatchDecision,
  createApprovedMatchSet,
} from './phase2/match-models.js?v=20260704-c4';

export {
  createValidationModelV2,
  createValidationAuditV2,
} from './phase2/validation-models.js';

export {
  createApprovedTransferCases,
  createTransferPlan,
  createTransferStage,
  validateTransferStage,
  createTransferPatchAudit,
  createPostTransferValidation,
} from './phase2/transfer-models.js';

import {
  XML_COMPARE_PHASE2_ORCHESTRATOR_SCHEMA,
  diagnostic,
} from './phase2/shared.js';
import {
  createApprovedMatchSet,
  createMatchCandidateSet,
  createTransformPolicy,
} from './phase2/match-models.js?v=20260704-c4';
import { createValidationModelV2 } from './phase2/validation-models.js';
import {
  createApprovedTransferCases,
  createPostTransferValidation,
  createTransferPatchAudit,
  createTransferPlan,
  createTransferStage,
} from './phase2/transfer-models.js';

export function orchestrateValidationTransferPhase(input = {}) {
  const readinessDiagnostics = readinessGateDiagnostics(input.sourceReadiness, input.targetReadiness);
  const policy = createTransformPolicy(input.transformPolicy || {});
  const candidateSet = createMatchCandidateSet({
    sourceId: input.sourceReadiness?.sourceId || 'source',
    targetId: input.targetReadiness?.sourceId || 'target',
    candidates: input.candidates || [],
    transformPolicy: policy,
  });
  const approvedMatchSet = createApprovedMatchSet({
    sourceGraph: input.sourceGraph,
    targetGraph: input.targetGraph,
    decisions: input.decisions || [],
    candidateSet,
    transformPolicy: policy,
  });
  return buildOrchestrationResult(input, readinessDiagnostics, candidateSet, approvedMatchSet);
}

function readinessGateDiagnostics(sourceReadiness = null, targetReadiness = null) {
  const diagnostics = [];
  if (sourceReadiness && sourceReadiness.readyForConnector === false) diagnostics.push(diagnostic('BLOCKER', 'SOURCE_NOT_READY_FOR_CONNECTOR', 'Source readiness audit failed.'));
  if (targetReadiness && targetReadiness.readyForConnector === false) diagnostics.push(diagnostic('BLOCKER', 'TARGET_NOT_READY_FOR_CONNECTOR', 'Target readiness audit failed.'));
  return diagnostics;
}

function buildOrchestrationResult(input, readinessDiagnostics, candidateSet, approvedMatchSet) {
  const validationModel = createValidationModelV2({
    sourceRecords: input.sourceRecords || [],
    targetRecords: input.targetRecords || [],
    approvedMatchSet,
    compareFields: input.compareFields || [],
    anchor: input.anchor || null,
  });
  const transferCases = createApprovedTransferCases({ approvedMatchSet, validationModel, requestedBlocks: input.requestedBlocks || [] });
  const transferPlan = createTransferPlan({
    approvedMatchSet,
    transferCases,
    scope: 'node',
    sourceText: input.sourceText || '',
    targetText: input.targetText || '',
    workspaceRevision: input.workspaceRevision || 0,
  });
  const transferAudit = createTransferPatchAudit({ transferPlan, diagnostics: readinessDiagnostics });
  return finalResult(readinessDiagnostics, candidateSet, approvedMatchSet, validationModel, transferCases, transferPlan, transferAudit, input.workspaceRevision || 0);
}

function finalResult(readinessDiagnostics, candidateSet, approvedMatchSet, validationModel, transferCases, transferPlan, transferAudit, workspaceRevision) {
  return Object.freeze({
    schema: XML_COMPARE_PHASE2_ORCHESTRATOR_SCHEMA,
    readinessGateOk: readinessDiagnostics.length === 0,
    candidateSet,
    approvedMatchSet,
    validationModel,
    transferCases,
    transferPlan,
    transferStage: createTransferStage({ plan: transferPlan, workspaceRevision }),
    transferAudit,
    postTransferValidation: createPostTransferValidation({ transferAudit }),
    diagnostics: Object.freeze(readinessDiagnostics),
    summary: summarize(candidateSet, approvedMatchSet, validationModel, transferCases, transferPlan),
  });
}

function summarize(candidateSet, approvedMatchSet, validationModel, transferCases, transferPlan) {
  return Object.freeze({
    candidateCount: candidateSet.summary.candidateCount,
    approvedMatchCount: approvedMatchSet.summary.approvedCount,
    validationBlockerCount: validationModel.summary.blockerCount,
    approvedTransferCaseCount: transferCases.filter((item) => item.approvalStatus === 'approved').length,
    transferReady: transferPlan.ok,
  });
}
