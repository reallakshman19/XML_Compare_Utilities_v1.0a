import { stableToken } from '../sequential-sketcher-contract.js';
import { SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY } from '../policy/sequential-external-boundary-policy.js';
import { SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY } from '../policy/sequential-construction-tolerance-policy.js';
import { SEQUENTIAL_WORKSPACE_JOURNAL_IMPACTS } from './sequential-workspace-import-preview.js';

export const SEQUENTIAL_WORKSPACE_APPLICATION_RECEIPT_SCHEMA = 'SequentialWorkspaceApplicationReceipt.v1';

function text(value) { return String(value ?? '').trim(); }
function fail(code) { throw new Error(code); }
function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}
function fingerprintPayload(value) {
  const { receiptFingerprint, ...payload } = value || {};
  return payload;
}
function frozenStrings(values = []) {
  return Object.freeze([...values].map(text).filter(Boolean));
}
function expectedPackageRevision(schema) {
  if (schema === 'SequentialWorkspacePackage.v1') return 1;
  if (schema === 'SequentialWorkspacePackage.v2') return 2;
  if (schema === 'SequentialWorkspacePackage.v3') return 3;
  return null;
}
function validPackageIdentity(schema, revision) {
  return expectedPackageRevision(schema) === revision;
}
function normalizedPackageIdentity(value) {
  return {
    present: value?.packageSchema !== undefined || value?.packageRevision !== undefined,
    packageSchema: text(value?.packageSchema),
    packageRevision: Number(value?.packageRevision),
  };
}
function samePackageIdentity(left, right) {
  return left.packageSchema === right.packageSchema && left.packageRevision === right.packageRevision;
}
function packageIdentity(options) {
  const restoration = normalizedPackageIdentity(options.restoration);
  const preview = normalizedPackageIdentity(options.preview);
  for (const identity of [restoration, preview]) {
    if (identity.present && !validPackageIdentity(identity.packageSchema, identity.packageRevision)) {
      fail('WORKSPACE_APPLY_PACKAGE_IDENTITY_REQUIRED');
    }
  }
  if (restoration.present && preview.present && !samePackageIdentity(restoration, preview)) {
    fail('WORKSPACE_APPLY_PACKAGE_IDENTITY_MISMATCH');
  }
  const identity = restoration.present ? restoration : preview;
  if (!identity.present) fail('WORKSPACE_APPLY_PACKAGE_IDENTITY_REQUIRED');
  return { packageSchema: identity.packageSchema, packageRevision: identity.packageRevision };
}
function draftEditEvidence(restoration) {
  const extension = restoration?.draftEditExtension || null;
  if (!extension) return Object.freeze({
    extensionFingerprint: null,
    supportBranchCount: 0,
    supportAdjustmentCount: 0,
    geometryBranchCount: 0,
    geometryEditCount: 0,
    activeGeometryEditCount: 0,
    geometryRedoCount: 0,
    geometryHistoryTransitionCount: 0,
  });
  const summary = extension.summary || {};
  const geometryEditCount = Number(summary.geometryEditCount || 0);
  return Object.freeze({
    extensionFingerprint: text(extension.extensionFingerprint) || null,
    supportBranchCount: Number(summary.supportBranchCount || 0),
    supportAdjustmentCount: Number(summary.supportAdjustmentCount || 0),
    geometryBranchCount: Number(summary.geometryBranchCount || 0),
    geometryEditCount,
    activeGeometryEditCount: summary.activeGeometryEditCount == null
      ? geometryEditCount : Number(summary.activeGeometryEditCount),
    geometryRedoCount: Number(summary.geometryRedoCount || 0),
    geometryHistoryTransitionCount: Number(summary.geometryHistoryTransitionCount || 0),
  });
}
function validDraftEditEvidence(value, packageSchema) {
  if (packageSchema !== 'SequentialWorkspacePackage.v3' && value == null) return true;
  const evidence = value || {};
  const legacyCounts = ['supportBranchCount', 'supportAdjustmentCount',
    'geometryBranchCount', 'geometryEditCount'];
  if (!legacyCounts.every((key) => Number.isSafeInteger(evidence[key]) && evidence[key] >= 0)) return false;
  const active = evidence.activeGeometryEditCount == null
    ? evidence.geometryEditCount : evidence.activeGeometryEditCount;
  const redo = evidence.geometryRedoCount == null ? 0 : evidence.geometryRedoCount;
  const transitions = evidence.geometryHistoryTransitionCount == null
    ? 0 : evidence.geometryHistoryTransitionCount;
  if (![active, redo, transitions].every((count) => Number.isSafeInteger(count) && count >= 0)
    || active > evidence.geometryEditCount || redo !== evidence.geometryEditCount - active) return false;
  if (packageSchema === 'SequentialWorkspacePackage.v3') return Boolean(text(evidence.extensionFingerprint));
  return evidence.extensionFingerprint === null
    && [...legacyCounts.map((key) => evidence[key]), active, redo, transitions].every((count) => count === 0);
}
function validateReceiptPackageIdentity(receipt, index) {
  const hasSchema = receipt.packageSchema !== undefined;
  const hasRevision = receipt.packageRevision !== undefined;
  const hasImpact = receipt.impact?.journalImpact !== undefined;
  if (!hasSchema && !hasRevision && !hasImpact) return;
  if (!hasSchema || !hasRevision || !hasImpact
    || !validPackageIdentity(receipt.packageSchema, receipt.packageRevision)) {
    fail(`WORKSPACE_APPLY_RECEIPT_PACKAGE_IDENTITY_INVALID:${index}`);
  }
  if (!SEQUENTIAL_WORKSPACE_JOURNAL_IMPACTS.includes(receipt.impact.journalImpact)) {
    fail(`WORKSPACE_APPLY_RECEIPT_JOURNAL_IMPACT_INVALID:${index}`);
  }
  if (!validDraftEditEvidence(receipt.draftEditEvidence, receipt.packageSchema)) {
    fail(`WORKSPACE_APPLY_RECEIPT_DRAFT_EDIT_EVIDENCE_INVALID:${index}`);
  }
}

export function sequentialWorkspaceApplicationReceiptFingerprint(value) {
  return stableToken(JSON.stringify(canonicalValue(fingerprintPayload(value))));
}
export function validateSequentialWorkspaceApplicationApproval(preview, approval = {}) {
  if (preview?.schema !== 'SequentialWorkspaceImportPreview.v1') fail('WORKSPACE_APPLY_PREVIEW_INVALID');
  const reason = text(approval.reason);
  const evidenceNote = text(approval.evidenceNote);
  if (!reason) fail('WORKSPACE_APPLY_REASON_REQUIRED');
  if (preview.hasDestructiveChanges && !evidenceNote) fail('WORKSPACE_APPLY_EVIDENCE_REQUIRED');
  return Object.freeze({ reason, evidenceNote });
}
function impact(preview) {
  return Object.freeze({
    sourceRelation: preview.sourceRelation,
    sourceReplacementRequired: Boolean(preview.sourceReplacementRequired),
    addedBranchIds: frozenStrings(preview.addedBranchIds),
    removedBranchIds: frozenStrings(preview.removedBranchIds),
    newWorkspaceBranchIds: frozenStrings(preview.newWorkspaceBranchIds),
    overwrittenWorkspaceBranchIds: frozenStrings(preview.overwrittenWorkspaceBranchIds),
    unchangedWorkspaceBranchIds: frozenStrings(preview.unchangedWorkspaceBranchIds),
    removedWorkspaceBranchIds: frozenStrings(preview.removedWorkspaceBranchIds),
    activeBranchBefore: preview.activeBranchBefore || null,
    activeBranchAfter: preview.activeBranchAfter || null,
    packageTotals: Object.freeze({ ...(preview.packageTotals || {}) }),
    decisionRegisterSummary: preview.decisionRegisterSummary
      ? Object.freeze({ ...preview.decisionRegisterSummary }) : null,
    journalImpact: preview.journalImpact,
    hasDestructiveChanges: Boolean(preview.hasDestructiveChanges),
  });
}
export function createSequentialWorkspaceApplicationReceipt(options = {}) {
  const approval = validateSequentialWorkspaceApplicationApproval(options.preview, options);
  const identity = packageIdentity(options);
  const packageFingerprint = text(options.packageFingerprint || options.restoration?.packageFingerprint);
  const beforeFingerprint = text(options.beforeFingerprint);
  const afterFingerprint = text(options.afterFingerprint);
  if (!packageFingerprint) fail('WORKSPACE_APPLY_PACKAGE_FINGERPRINT_REQUIRED');
  if (!beforeFingerprint || !afterFingerprint) fail('WORKSPACE_APPLY_STATE_FINGERPRINT_REQUIRED');
  const sequence = Math.max(1, Number(options.sequence) || 1);
  const payload = {
    schema: SEQUENTIAL_WORKSPACE_APPLICATION_RECEIPT_SCHEMA,
    receiptId: `WS-APPLY-${String(sequence).padStart(5, '0')}-${stableToken(`${packageFingerprint}|${beforeFingerprint}|${afterFingerprint}|${approval.reason}`)}`,
    sequence,
    status: 'APPLIED',
    actorProvenance: 'USER_MANUAL',
    reason: approval.reason,
    evidenceNote: approval.evidenceNote,
    packageFingerprint,
    ...identity,
    packageSourceFingerprint: options.restoration?.sourceFingerprint || options.preview?.packageSourceFingerprint || null,
    beforeWorkspaceFingerprint: beforeFingerprint,
    afterWorkspaceFingerprint: afterFingerprint,
    previewCurrentStateFingerprint: options.preview.currentStateFingerprint,
    draftEditEvidence: draftEditEvidence(options.restoration),
    impact: impact(options.preview),
    externalBoundaryPolicyFingerprint: SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY.policyFingerprint,
    tolerancePolicyFingerprint: SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY.policyFingerprint,
    appliedAt: new Date().toISOString(),
  };
  return Object.freeze({
    ...payload,
    receiptFingerprint: sequentialWorkspaceApplicationReceiptFingerprint(payload),
  });
}
export function validateSequentialWorkspaceApplicationReceipt(receipt, index = 0) {
  if (receipt?.schema !== SEQUENTIAL_WORKSPACE_APPLICATION_RECEIPT_SCHEMA) {
    fail(`WORKSPACE_APPLY_RECEIPT_SCHEMA_INVALID:${index}`);
  }
  if (!text(receipt.receiptId) || receipt.status !== 'APPLIED' || receipt.actorProvenance !== 'USER_MANUAL') {
    fail(`WORKSPACE_APPLY_RECEIPT_IDENTITY_INVALID:${index}`);
  }
  if (!text(receipt.reason) || !text(receipt.packageFingerprint)
    || !text(receipt.beforeWorkspaceFingerprint) || !text(receipt.afterWorkspaceFingerprint)) {
    fail(`WORKSPACE_APPLY_RECEIPT_EVIDENCE_INVALID:${index}`);
  }
  validateReceiptPackageIdentity(receipt, index);
  if (receipt.impact?.hasDestructiveChanges && !text(receipt.evidenceNote)) {
    fail(`WORKSPACE_APPLY_RECEIPT_DESTRUCTIVE_EVIDENCE_MISSING:${index}`);
  }
  if (receipt.externalBoundaryPolicyFingerprint !== SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY.policyFingerprint) {
    fail(`WORKSPACE_APPLY_RECEIPT_EXTERNAL_POLICY_MISMATCH:${index}`);
  }
  if (receipt.tolerancePolicyFingerprint !== SEQUENTIAL_CONSTRUCTION_TOLERANCE_POLICY.policyFingerprint) {
    fail(`WORKSPACE_APPLY_RECEIPT_TOLERANCE_POLICY_MISMATCH:${index}`);
  }
  const expected = sequentialWorkspaceApplicationReceiptFingerprint(receipt);
  if (receipt.receiptFingerprint !== expected) fail(`WORKSPACE_APPLY_RECEIPT_FINGERPRINT_MISMATCH:${index}`);
  return Object.freeze({ ...receipt,
    draftEditEvidence: Object.freeze({ ...(receipt.draftEditEvidence || {}) }),
    impact: Object.freeze({ ...(receipt.impact || {}) }) });
}