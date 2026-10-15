import { stableToken } from '../sequential-sketcher-contract.js';
import { freezeConstructionSession } from '../construction/sequential-construction-contract.js';
import { sequentialSessionFingerprint } from '../construction/sequential-session-fingerprint.js';
import { buildSequentialEvidenceModel, indexSequentialEvidence } from '../source/sequential-evidence-model.js';
import { SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY } from '../policy/sequential-external-boundary-policy.js';
import { SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY } from '../policy/sequential-construction-tolerance-policy.js';
import { buildSequentialDecisionRegister } from '../review/sequential-review-queue-export.js';

export const SEQUENTIAL_WORKSPACE_PACKAGE_SCHEMA = 'SequentialWorkspacePackage.v1';
export const SEQUENTIAL_WORKSPACE_RESTORATION_SCHEMA = 'SequentialWorkspaceRestoration.v1';

function text(value) { return String(value ?? '').trim(); }
function fail(code, detail = '') {
  throw new Error(`${code}${detail ? `: ${detail}` : ''}`);
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
  );
}
function canonicalJson(value) { return JSON.stringify(canonicalValue(value)); }
function sameStrings(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function payloadWithoutFingerprint(value) {
  const { packageFingerprint, ...payload } = value || {};
  return payload;
}

export function sequentialSourceRecordsFingerprint(records) {
  if (!Array.isArray(records)) fail('WORKSPACE_SOURCE_RECORDS_INVALID');
  return stableToken(canonicalJson(records));
}

export function sequentialWorkspacePackageFingerprint(value) {
  return stableToken(canonicalJson(payloadWithoutFingerprint(value)));
}

function snapshotFingerprint(snapshot, context) {
  if (!snapshot || typeof snapshot !== 'object') fail('WORKSPACE_HISTORY_SNAPSHOT_MISSING', context);
  return sequentialSessionFingerprint(snapshot);
}

function validateHistoryEntry(entry, context) {
  if (entry?.schema !== 'SequentialConstructionUndoEntry.v1') {
    fail('WORKSPACE_HISTORY_SCHEMA_INVALID', context);
  }
  const before = snapshotFingerprint(entry.beforeSnapshot, `${context}:before`);
  const after = snapshotFingerprint(entry.afterSnapshot, `${context}:after`);
  if (before !== entry.beforeFingerprint) fail('WORKSPACE_HISTORY_BEFORE_FINGERPRINT_MISMATCH', context);
  if (after !== entry.afterFingerprint) fail('WORKSPACE_HISTORY_AFTER_FINGERPRINT_MISMATCH', context);
}

function validateTransactionLedger(session, branchId) {
  const ids = new Set();
  for (const [index, transaction] of (session?.transactionLedger || []).entries()) {
    const context = `${branchId}:transaction:${index}`;
    if (transaction?.schema !== 'SequentialConstructionTransaction.v1') {
      fail('WORKSPACE_TRANSACTION_SCHEMA_INVALID', context);
    }
    if (!text(transaction.transactionId) || ids.has(transaction.transactionId)) {
      fail('WORKSPACE_TRANSACTION_ID_INVALID', context);
    }
    ids.add(transaction.transactionId);
    if (transaction.externalBoundaryPolicyFingerprint
      && transaction.externalBoundaryPolicyFingerprint !== SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY.policyFingerprint) {
      fail('WORKSPACE_TRANSACTION_EXTERNAL_POLICY_MISMATCH', context);
    }
    if (transaction.tolerancePolicyFingerprint
      && transaction.tolerancePolicyFingerprint !== SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY.policyFingerprint) {
      fail('WORKSPACE_TRANSACTION_TOLERANCE_POLICY_MISMATCH', context);
    }
  }
}

function hydrateHistoryEntry(entry) {
  return deepFreeze({
    ...cloneJson(entry),
    beforeSnapshot: freezeConstructionSession(cloneJson(entry.beforeSnapshot)),
    afterSnapshot: freezeConstructionSession(cloneJson(entry.afterSnapshot)),
  });
}

function validateAndHydrateSession(rawSession, branchId, expectedFingerprint) {
  if (rawSession?.schema !== 'SequentialConstructionSession.v1') {
    fail('WORKSPACE_SESSION_SCHEMA_INVALID', branchId);
  }
  if (text(rawSession.rootBranchId) !== branchId) fail('WORKSPACE_SESSION_BRANCH_MISMATCH', branchId);
  const actualFingerprint = sequentialSessionFingerprint(rawSession);
  if (actualFingerprint !== expectedFingerprint) fail('WORKSPACE_SESSION_FINGERPRINT_MISMATCH', branchId);
  validateTransactionLedger(rawSession, branchId);
  for (const [index, entry] of (rawSession.undoStack || []).entries()) {
    validateHistoryEntry(entry, `${branchId}:undo:${index}`);
  }
  for (const [index, entry] of (rawSession.redoStack || []).entries()) {
    validateHistoryEntry(entry, `${branchId}:redo:${index}`);
  }
  return freezeConstructionSession({
    ...cloneJson(rawSession),
    transactionLedger: deepFreeze(cloneJson(rawSession.transactionLedger || [])),
    undoStack: Object.freeze((rawSession.undoStack || []).map(hydrateHistoryEntry)),
    redoStack: Object.freeze((rawSession.redoStack || []).map(hydrateHistoryEntry)),
  });
}

function workspaceRows(registry) {
  return (registry?.entries?.() || []).map(({ branchId, snapshot }) => {
    const session = snapshot?.session;
    if (!session) fail('WORKSPACE_SESSION_MISSING', branchId);
    return deepFreeze({
      schema: 'SequentialBranchWorkspace.v1',
      branchId,
      selectedCandidateId: text(snapshot.selectedCandidateId),
      sessionFingerprint: sequentialSessionFingerprint(session),
      session: cloneJson(session),
    });
  });
}

export function createSequentialWorkspacePackage(options = {}) {
  const records = cloneJson(options.records);
  if (!Array.isArray(records)) fail('WORKSPACE_SOURCE_RECORDS_INVALID');
  const evidence = options.evidence || buildSequentialEvidenceModel(records);
  const branchIds = evidence.branches.map((branch) => branch.branchId).sort((a, b) => a.localeCompare(b));
  const activeBranchId = text(options.activeBranchId);
  if (activeBranchId && !branchIds.includes(activeBranchId)) fail('WORKSPACE_ACTIVE_BRANCH_UNKNOWN', activeBranchId);
  const workspaces = workspaceRows(options.branchRegistry);
  if (activeBranchId && !workspaces.some((row) => row.branchId === activeBranchId)) {
    fail('WORKSPACE_ACTIVE_BRANCH_NOT_SAVED', activeBranchId);
  }
  const decisionRegister = options.reviewQueue ? cloneJson(buildSequentialDecisionRegister(options.reviewQueue)) : null;
  const payload = {
    schema: SEQUENTIAL_WORKSPACE_PACKAGE_SCHEMA,
    revision: 1,
    createdAt: new Date().toISOString(),
    source: {
      schema: 'SequentialWorkspaceSource.v1',
      sourceEvidenceSchema: evidence.schema,
      sourceFingerprint: sequentialSourceRecordsFingerprint(records),
      records,
    },
    policies: {
      externalBoundaryPolicyFingerprint: SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY.policyFingerprint,
      tolerancePolicyFingerprint: SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY.policyFingerprint,
    },
    branchIds,
    activeBranchId: activeBranchId || null,
    workspaces,
    decisionRegister,
  };
  return deepFreeze({
    ...payload,
    packageFingerprint: sequentialWorkspacePackageFingerprint(payload),
  });
}

export function serializeSequentialWorkspacePackage(options = {}) {
  return JSON.stringify(createSequentialWorkspacePackage(options), null, 2);
}

function parsedPackage(input) {
  if (typeof input === 'string') {
    try { return JSON.parse(input); } catch (error) { fail('WORKSPACE_PACKAGE_JSON_INVALID', error.message); }
  }
  return cloneJson(input);
}

export function restoreSequentialWorkspacePackage(input) {
  const value = parsedPackage(input);
  if (!value || typeof value !== 'object') fail('WORKSPACE_PACKAGE_INVALID');
  if (value.schema !== SEQUENTIAL_WORKSPACE_PACKAGE_SCHEMA || value.revision !== 1) {
    fail('WORKSPACE_PACKAGE_SCHEMA_INVALID');
  }
  const expectedPackageFingerprint = sequentialWorkspacePackageFingerprint(value);
  if (value.packageFingerprint !== expectedPackageFingerprint) fail('WORKSPACE_PACKAGE_FINGERPRINT_MISMATCH');
  if (value.policies?.externalBoundaryPolicyFingerprint !== SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY.policyFingerprint) {
    fail('WORKSPACE_EXTERNAL_POLICY_MISMATCH');
  }
  if (value.policies?.tolerancePolicyFingerprint !== SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY.policyFingerprint) {
    fail('WORKSPACE_TOLERANCE_POLICY_MISMATCH');
  }
  const records = cloneJson(value.source?.records);
  if (!Array.isArray(records)) fail('WORKSPACE_SOURCE_RECORDS_INVALID');
  const sourceFingerprint = sequentialSourceRecordsFingerprint(records);
  if (value.source?.sourceFingerprint !== sourceFingerprint) fail('WORKSPACE_SOURCE_FINGERPRINT_MISMATCH');
  const evidence = buildSequentialEvidenceModel(records);
  if (value.source?.sourceEvidenceSchema !== evidence.schema) fail('WORKSPACE_SOURCE_SCHEMA_MISMATCH');
  const indexes = indexSequentialEvidence(evidence);
  const branchIds = evidence.branches.map((branch) => branch.branchId).sort((a, b) => a.localeCompare(b));
  const claimedBranchIds = [...(value.branchIds || [])].map(text).sort((a, b) => a.localeCompare(b));
  if (!sameStrings(branchIds, claimedBranchIds)) fail('WORKSPACE_BRANCH_SET_MISMATCH');
  const seen = new Set();
  const workspaces = (value.workspaces || []).map((row) => {
    const branchId = text(row?.branchId);
    if (!branchIds.includes(branchId) || seen.has(branchId)) fail('WORKSPACE_BRANCH_ENTRY_INVALID', branchId);
    if (row?.schema !== 'SequentialBranchWorkspace.v1') fail('WORKSPACE_BRANCH_SCHEMA_INVALID', branchId);
    seen.add(branchId);
    const session = validateAndHydrateSession(row.session, branchId, row.sessionFingerprint);
    return deepFreeze({
      branchId,
      snapshot: {
        session,
        confirmedConstruction: null,
        supportProjection: null,
        selectedCandidateId: text(row.selectedCandidateId),
      },
    });
  });
  const activeBranchId = text(value.activeBranchId);
  if (activeBranchId && !workspaces.some((row) => row.branchId === activeBranchId)) {
    fail('WORKSPACE_ACTIVE_BRANCH_NOT_SAVED', activeBranchId);
  }
  const decisionRegister = value.decisionRegister ? deepFreeze(cloneJson(value.decisionRegister)) : null;
  if (decisionRegister && decisionRegister.schema !== 'SequentialDecisionRegister.v1') {
    fail('WORKSPACE_DECISION_REGISTER_SCHEMA_INVALID');
  }
  return deepFreeze({
    schema: SEQUENTIAL_WORKSPACE_RESTORATION_SCHEMA,
    packageFingerprint: value.packageFingerprint,
    sourceFingerprint,
    records,
    evidence,
    indexes,
    branchIds,
    activeBranchId: activeBranchId || null,
    workspaces,
    decisionRegister,
  });
}
