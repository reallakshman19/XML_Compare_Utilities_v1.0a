import {
  createApprovedMatchSet,
  createMatchCandidateSet,
  createMatchDecision,
  createValidationModelV2,
} from './contracts/phase2-validation-transfer-orchestrator.js?v=20260704-c4';

export const XML_COMPARE_APPROVED_CONNECTOR_MODEL_SCHEMA = 'xml-compare-approved-connector-model/v1';

const clean = (value) => String(value ?? '').trim();
const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const asArray = (items) => Object.freeze([...(Array.isArray(items) ? items : [])]);

export function connectorPairKey(sourceUid = '', targetUid = '') {
  return `${clean(sourceUid)}=>${clean(targetUid)}`;
}

export function connectorLabel(record = {}) {
  return clean(
    record.displayName ||
    record.nodeName ||
    record.componentRefNo ||
    record.nodeNumber ||
    record.sourceLabel ||
    record.targetLabel ||
    record.value ||
    record.uid,
  );
}

function decisionKey(decision = {}) {
  return connectorPairKey(decision.sourceUid, decision.targetUid);
}

function appendLatestDecision(decisions = [], decision = null) {
  if (!decision?.sourceUid || !decision?.targetUid) return asArray(decisions);
  const key = decisionKey(decision);
  return Object.freeze([...(decisions || []).filter((item) => decisionKey(item) !== key), decision]);
}

function appendCandidate(candidates = [], candidate = null) {
  if (!candidate?.sourceUid || !candidate?.targetUid) return asArray(candidates);
  const key = connectorPairKey(candidate.sourceUid, candidate.targetUid);
  return Object.freeze([...(candidates || []).filter((item) => connectorPairKey(item.sourceUid, item.targetUid) !== key), candidate]);
}

export function createPendingConnectorPreview(input = {}) {
  const sourceRecord = input.sourceRecord || {};
  const targetRecord = input.targetRecord || {};
  const sourceUid = clean(input.sourceUid || sourceRecord.uid);
  const targetUid = clean(input.targetUid || targetRecord.uid);
  if (!sourceUid || !targetUid) return null;
  return Object.freeze({
    sourceUid,
    targetUid,
    sourceStableKey: clean(input.sourceStableKey || sourceRecord.stableKey || sourceUid),
    targetStableKey: clean(input.targetStableKey || targetRecord.stableKey || targetUid),
    sourceLabel: clean(input.sourceLabel || connectorLabel(sourceRecord) || sourceUid),
    targetLabel: clean(input.targetLabel || connectorLabel(targetRecord) || targetUid),
    basis: asArray(input.basis?.length ? input.basis : ['manual-preview']),
    confidence: finite(input.confidence ?? input.score ?? input.identityConfidence, 0.8),
    transformBasis: clean(input.transformBasis || 'identity-offset'),
    allowDuplicateTarget: Boolean(input.allowDuplicateTarget),
    diagnostics: asArray(input.diagnostics || []),
  });
}

export function candidateFromPreview(preview = {}) {
  if (!preview?.sourceUid || !preview?.targetUid) return null;
  return Object.freeze({
    sourceUid: clean(preview.sourceUid),
    targetUid: clean(preview.targetUid),
    sourceStableKey: clean(preview.sourceStableKey || preview.sourceUid),
    targetStableKey: clean(preview.targetStableKey || preview.targetUid),
    basis: asArray(preview.basis || ['manual-preview']),
    score: finite(preview.confidence, 0.8),
    identityConfidence: finite(preview.confidence, 0.8),
    deltaMm: finite(preview.deltaMm, 0),
    transformBasis: clean(preview.transformBasis || 'identity-offset'),
    allowDuplicateTarget: Boolean(preview.allowDuplicateTarget),
    diagnostics: asArray(preview.diagnostics || []),
  });
}

export function previewFromCandidate(candidate = {}) {
  return createPendingConnectorPreview({
    sourceUid: candidate.sourceUid,
    targetUid: candidate.targetUid,
    sourceStableKey: candidate.sourceStableKey,
    targetStableKey: candidate.targetStableKey,
    sourceLabel: candidate.sourceLabel,
    targetLabel: candidate.targetLabel,
    basis: ['candidate', ...(candidate.basis || [])],
    confidence: candidate.identityConfidence ?? candidate.score ?? candidate.confidence ?? 0.82,
    transformBasis: candidate.transformBasis || 'identity-offset',
    allowDuplicateTarget: Boolean(candidate.allowDuplicateTarget || candidate.method === 'numeric-fields'),
    diagnostics: candidate.diagnostics || [],
  });
}

export function normalizeApprovedConnectorState(input = {}) {
  const matchCandidates = asArray(input.matchCandidates || []);
  const matchDecisions = asArray(input.matchDecisions || []);
  const shouldBuild = input.approvedMatchSet || matchCandidates.length || matchDecisions.length;
  return Object.freeze({
    schema: XML_COMPARE_APPROVED_CONNECTOR_MODEL_SCHEMA,
    pendingConnectorPreview: input.pendingConnectorPreview || null,
    matchCandidates,
    matchDecisions,
    approvedMatchSet: input.approvedMatchSet || (shouldBuild ? buildApprovedMatchSet({ matchCandidates, matchDecisions }) : null),
  });
}

export function buildApprovedMatchSet({ matchCandidates = [], matchDecisions = [], sourceGraph = null, targetGraph = null } = {}) {
  const candidateSet = createMatchCandidateSet({ candidates: matchCandidates });
  return createApprovedMatchSet({ sourceGraph, targetGraph, candidateSet, decisions: matchDecisions, transformPolicy: { approved: true, approvalBasis: 'manual-approved' } });
}

function decisionForPreview(preview = {}, decision = 'approved', basis = 'manual-review') {
  return createMatchDecision({
    sourceUid: preview.sourceUid,
    targetUid: preview.targetUid,
    decision,
    decisionBasis: basis,
    confidence: finite(preview.confidence, 0.8),
    diagnostics: preview.diagnostics || [],
  });
}

export function approvePendingConnector(state = {}) {
  const current = normalizeApprovedConnectorState(state);
  const preview = current.pendingConnectorPreview;
  const candidate = candidateFromPreview(preview);
  if (!candidate) return current;
  const matchCandidates = appendCandidate(current.matchCandidates, candidate);
  const matchDecisions = appendLatestDecision(current.matchDecisions, decisionForPreview(preview, 'approved', 'manual-review'));
  return normalizeApprovedConnectorState({ matchCandidates, matchDecisions, pendingConnectorPreview: null });
}

export function rejectPendingConnector(state = {}) {
  const current = normalizeApprovedConnectorState(state);
  const preview = current.pendingConnectorPreview;
  if (!preview) return current;
  const matchDecisions = appendLatestDecision(current.matchDecisions, decisionForPreview(preview, 'rejected', 'manual-rejected'));
  return normalizeApprovedConnectorState({ ...current, matchDecisions, pendingConnectorPreview: null });
}

export function acceptCandidateConnector(state = {}, candidate = {}) {
  const current = normalizeApprovedConnectorState(state);
  const preview = previewFromCandidate(candidate);
  const normalized = candidateFromPreview(preview);
  if (!normalized) return current;
  const blocked = ['ambiguous', 'conflict'].includes(clean(candidate.status));
  const decision = createMatchDecision({
    sourceUid: normalized.sourceUid,
    targetUid: normalized.targetUid,
    decision: blocked ? 'needs-review' : 'approved',
    decisionBasis: 'candidate-accepted',
    confidence: normalized.identityConfidence,
    diagnostics: blocked ? [{ severity: 'BLOCKER', code: 'CANDIDATE_NOT_APPROVED', message: `Candidate status ${clean(candidate.status)} requires review.` }] : [],
  });
  const matchCandidates = appendCandidate(current.matchCandidates, normalized);
  const matchDecisions = appendLatestDecision(current.matchDecisions, decision);
  return normalizeApprovedConnectorState({ matchCandidates, matchDecisions, pendingConnectorPreview: null });
}

export function rejectCandidateConnector(state = {}, candidate = {}) {
  const current = normalizeApprovedConnectorState(state);
  const preview = previewFromCandidate(candidate);
  const normalized = candidateFromPreview(preview);
  if (!normalized) return current;
  const matchCandidates = appendCandidate(current.matchCandidates, normalized);
  const matchDecisions = appendLatestDecision(current.matchDecisions, decisionForPreview(preview, 'rejected', 'candidate-rejected'));
  return normalizeApprovedConnectorState({ matchCandidates, matchDecisions, pendingConnectorPreview: null });
}

export function projectApprovedConnectors(approvedMatchSet = null) {
  return Object.freeze((approvedMatchSet?.approvedMatches || []).map((match) => Object.freeze({
    id: `approved:${connectorPairKey(match.sourceUid, match.targetUid)}`,
    sourceUid: clean(match.sourceUid),
    targetUid: clean(match.targetUid),
    sourceLabel: clean(match.sourceStableKey || match.sourceUid),
    targetLabel: clean(match.targetStableKey || match.targetUid),
    status: 'approved',
    basis: asArray(match.basis || ['approved-match-set']),
    confidence: finite(match.confidence, 0),
    locked: true,
    createdBy: 'approved-match-set',
  })));
}

export function createApprovedConnectorValidationModel({ state = {}, sourceRecords = [], targetRecords = [], compareFields = [] } = {}) {
  const current = normalizeApprovedConnectorState(state);
  const anchor = state.autoMapRequest ? { sourceUid: state.autoMapRequest.sourceUid, targetUid: state.autoMapRequest.targetUid } : null;
  return createValidationModelV2({ sourceRecords, targetRecords, approvedMatchSet: current.approvedMatchSet, compareFields, anchor });
}

export const _test = Object.freeze({
  clean,
  finite,
  asArray,
  appendCandidate,
  appendLatestDecision,
  decisionForPreview,
});
