import { stableToken } from '../sequential-sketcher-contract.js';
import { sequentialSessionFingerprint } from '../construction/sequential-session-fingerprint.js';
import { sequentialSourceRecordsFingerprint } from './sequential-workspace-package.js';
import {
  sequentialCommandJournalHeadFingerprint,
  validateSequentialCommandJournalState,
} from '../scoped-edit/sequential-command-journal.js';

export const SEQUENTIAL_WORKSPACE_IMPORT_PREVIEW_SCHEMA = 'SequentialWorkspaceImportPreview.v1';
export const SEQUENTIAL_WORKSPACE_JOURNAL_IMPACTS = Object.freeze([
  'ABSENT', 'INSTALL', 'UNCHANGED', 'REPLACE', 'REMOVE',
]);

function fail(code) { throw new Error(code); }
function text(value) { return String(value ?? '').trim(); }
function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}
function canonicalJson(value) { return JSON.stringify(canonicalValue(value)); }
function sorted(values) { return [...new Set(values.map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
function difference(left, right) { const other = new Set(right); return left.filter((value) => !other.has(value)); }
function intersection(left, right) { const other = new Set(right); return left.filter((value) => other.has(value)); }
function sessionFingerprint(snapshot) { return snapshot?.session ? sequentialSessionFingerprint(snapshot.session) : null; }
function workspaceIdentity(snapshot) { return `${sessionFingerprint(snapshot) || ''}|${text(snapshot?.selectedCandidateId)}`; }
function editIdentity(value) { return text(value?.extensionFingerprint) || null; }
function editSummary(value) {
  const summary = value?.summary || {};
  const geometryEditCount = Number(summary.geometryEditCount || 0);
  return Object.freeze({
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
function currentBranchIds(model) {
  if (model?.evidence?.branches) return sorted(model.evidence.branches.map((branch) => branch.branchId));
  return sorted(model?.branchRegistry?.ids?.() || []);
}
function currentWorkspaceRows(model) {
  return (model?.branchRegistry?.entries?.() || []).map(({ branchId, snapshot }) => ({
    branchId,
    sessionFingerprint: sessionFingerprint(snapshot),
    selectedCandidateId: text(snapshot?.selectedCandidateId),
  })).sort((left, right) => left.branchId.localeCompare(right.branchId));
}
function journalIdentity(state, failureCode) {
  if (state === null || state === undefined) return null;
  const errors = validateSequentialCommandJournalState(state);
  if (errors.length) fail(failureCode);
  return Object.freeze({
    journalStateSchema: state.schema,
    adoptionCheckpointId: state.adoptionCheckpoint.checkpointId,
    journalHeadFingerprint: sequentialCommandJournalHeadFingerprint(state),
  });
}
function authorityImpact(current, packaged) {
  if (!current && !packaged) return 'ABSENT';
  if (!current) return 'INSTALL';
  if (!packaged) return 'REMOVE';
  return canonicalJson(current) === canonicalJson(packaged) ? 'UNCHANGED' : 'REPLACE';
}

export function sequentialWorkspaceCurrentStateFingerprint(model = {}) {
  const records = Array.isArray(model.records) ? model.records : null;
  const material = {
    sourceFingerprint: records ? sequentialSourceRecordsFingerprint(records) : null,
    branchIds: currentBranchIds(model),
    activeBranchId: model.session?.rootBranchId || null,
    workspaces: currentWorkspaceRows(model),
  };
  const authority = journalIdentity(model.journalState, 'WORKSPACE_IMPORT_JOURNAL_STATE_INVALID');
  const editFingerprint = editIdentity(model.draftEditExtension);
  if (authority) material.journalAuthority = authority;
  if (editFingerprint) material.draftEditExtensionFingerprint = editFingerprint;
  return stableToken(canonicalJson(material));
}

export function sequentialWorkspaceRestorationStateFingerprint(restoration = {}) {
  const registry = {
    ids: () => restoration.branchIds || [],
    entries: () => restoration.workspaces || [],
  };
  return sequentialWorkspaceCurrentStateFingerprint({
    records: restoration.records,
    evidence: restoration.evidence,
    branchRegistry: registry,
    session: restoration.workspaces?.find((row) => row.branchId === restoration.activeBranchId)?.snapshot?.session || null,
    journalState: restoration.journalState ?? null,
    draftEditExtension: restoration.draftEditExtension || null,
  });
}

function totals(workspaces) {
  const summary = {
    transactionCount: 0, undoEntryCount: 0, redoEntryCount: 0, deferredDecisionCount: 0,
    completeWorkspaceCount: 0, blockedWorkspaceCount: 0, failedWorkspaceCount: 0,
  };
  for (const row of workspaces) {
    const session = row.snapshot?.session;
    summary.transactionCount += session?.transactionLedger?.length || 0;
    summary.undoEntryCount += session?.undoStack?.length || 0;
    summary.redoEntryCount += session?.redoStack?.length || 0;
    summary.deferredDecisionCount += session?.deferredDecisionIds?.length || 0;
    if (session?.state === 'ROUTE_COMPLETE') summary.completeWorkspaceCount += 1;
    if (session?.state === 'USER_DECISION_REQUIRED') summary.blockedWorkspaceCount += 1;
    if (session?.state === 'FAILED') summary.failedWorkspaceCount += 1;
  }
  return Object.freeze(summary);
}
function workspaceChanges(restoration, model) {
  const current = new Map((model.branchRegistry?.entries?.() || []).map((row) => [row.branchId, row.snapshot]));
  const packaged = new Map((restoration.workspaces || []).map((row) => [row.branchId, row.snapshot]));
  const result = { newIds: [], overwrittenIds: [], unchangedIds: [] };
  for (const [branchId, snapshot] of packaged) {
    const existing = current.get(branchId);
    if (!existing) result.newIds.push(branchId);
    else if (workspaceIdentity(existing) === workspaceIdentity(snapshot)) result.unchangedIds.push(branchId);
    else result.overwrittenIds.push(branchId);
  }
  result.removedIds = [...current.keys()].filter((branchId) => !packaged.has(branchId));
  return result;
}

export function buildSequentialWorkspaceImportPreview(restoration, model = {}) {
  if (!['SequentialWorkspaceRestoration.v1', 'SequentialWorkspaceRestoration.v2'].includes(restoration?.schema)) {
    fail('WORKSPACE_IMPORT_PREVIEW_RESTORATION_INVALID');
  }
  const currentSourceFingerprint = Array.isArray(model.records) ? sequentialSourceRecordsFingerprint(model.records) : null;
  const sourceRelation = !currentSourceFingerprint ? 'EMPTY'
    : currentSourceFingerprint === restoration.sourceFingerprint ? 'MATCH' : 'DIFFERENT';
  const currentBranches = currentBranchIds(model);
  const packageBranches = sorted(restoration.branchIds || []);
  const changes = workspaceChanges(restoration, model);
  const currentJournal = journalIdentity(model.journalState, 'WORKSPACE_IMPORT_JOURNAL_STATE_INVALID');
  const packageJournal = journalIdentity(restoration.journalState, 'WORKSPACE_IMPORT_PACKAGE_JOURNAL_INVALID');
  const journalImpact = authorityImpact(currentJournal, packageJournal);
  const currentEdit = editIdentity(model.draftEditExtension);
  const packageEdit = editIdentity(restoration.draftEditExtension);
  const draftEditImpact = authorityImpact(currentEdit, packageEdit);
  const destructiveJournal = journalImpact === 'REPLACE' || journalImpact === 'REMOVE';
  const destructiveEdit = draftEditImpact === 'REPLACE' || draftEditImpact === 'REMOVE';
  return Object.freeze({
    schema: SEQUENTIAL_WORKSPACE_IMPORT_PREVIEW_SCHEMA,
    packageFingerprint: restoration.packageFingerprint,
    packageSchema: restoration.packageSchema || (restoration.schema.endsWith('.v2') ? 'SequentialWorkspacePackage.v2' : 'SequentialWorkspacePackage.v1'),
    packageRevision: restoration.packageRevision || (restoration.schema.endsWith('.v2') ? 2 : 1),
    currentStateFingerprint: sequentialWorkspaceCurrentStateFingerprint(model),
    sourceRelation,
    sourceReplacementRequired: sourceRelation === 'DIFFERENT',
    currentSourceFingerprint,
    packageSourceFingerprint: restoration.sourceFingerprint,
    currentBranchCount: currentBranches.length,
    packageBranchCount: packageBranches.length,
    addedBranchIds: difference(packageBranches, currentBranches),
    removedBranchIds: difference(currentBranches, packageBranches),
    commonBranchIds: intersection(packageBranches, currentBranches),
    currentSavedWorkspaceCount: model.branchRegistry?.entries?.().length || 0,
    packageSavedWorkspaceCount: restoration.workspaces?.length || 0,
    newWorkspaceBranchIds: sorted(changes.newIds),
    overwrittenWorkspaceBranchIds: sorted(changes.overwrittenIds),
    unchangedWorkspaceBranchIds: sorted(changes.unchangedIds),
    removedWorkspaceBranchIds: sorted(changes.removedIds),
    activeBranchBefore: model.session?.rootBranchId || null,
    activeBranchAfter: restoration.activeBranchId || null,
    decisionRegisterSummary: restoration.decisionRegister?.summary || null,
    packageTotals: totals(restoration.workspaces || []),
    currentJournalAuthorityPresent: Boolean(currentJournal),
    packageJournalAuthorityPresent: Boolean(packageJournal),
    currentJournalStateSchema: currentJournal?.journalStateSchema || null,
    packageJournalStateSchema: packageJournal?.journalStateSchema || null,
    currentJournalCheckpointId: currentJournal?.adoptionCheckpointId || null,
    packageJournalCheckpointId: packageJournal?.adoptionCheckpointId || null,
    currentJournalHeadFingerprint: currentJournal?.journalHeadFingerprint || null,
    packageJournalHeadFingerprint: packageJournal?.journalHeadFingerprint || null,
    journalImpact,
    currentDraftEditExtensionFingerprint: currentEdit,
    packageDraftEditExtensionFingerprint: packageEdit,
    draftEditImpact,
    packageDraftEditSummary: editSummary(restoration.draftEditExtension),
    requiresExplicitApply: true,
    hasDestructiveChanges: sourceRelation === 'DIFFERENT' || changes.overwrittenIds.length > 0
      || changes.removedIds.length > 0 || difference(currentBranches, packageBranches).length > 0
      || destructiveJournal || destructiveEdit,
  });
}

export function formatSequentialWorkspaceImportPreview(preview) {
  if (preview?.schema !== SEQUENTIAL_WORKSPACE_IMPORT_PREVIEW_SCHEMA) fail('WORKSPACE_IMPORT_PREVIEW_INVALID');
  const source = { EMPTY: 'will load source evidence into an empty workspace', MATCH: 'matches the current source evidence', DIFFERENT: 'will replace the current source evidence' }[preview.sourceRelation];
  const register = preview.decisionRegisterSummary
    ? ` Register: ${preview.decisionRegisterSummary.unresolvedCount || 0} unresolved, ${preview.decisionRegisterSummary.manualResolutionCount || 0} manual.` : '';
  const edits = preview.packageDraftEditSummary;
  return `Verified ${preview.packageSchema} revision ${preview.packageRevision} package ${preview.packageFingerprint}: source ${source}; journal impact ${preview.journalImpact}; Draft Edit 3D impact ${preview.draftEditImpact} (${edits.supportAdjustmentCount} support adjustments, ${edits.geometryEditCount} geometry edits (${edits.activeGeometryEditCount} active, ${edits.geometryRedoCount} redo)); ${preview.packageSavedWorkspaceCount} saved workspaces (${preview.newWorkspaceBranchIds.length} new, ${preview.overwrittenWorkspaceBranchIds.length} overwrite, ${preview.unchangedWorkspaceBranchIds.length} unchanged, ${preview.removedWorkspaceBranchIds.length} current removals); ${preview.packageTotals.transactionCount} transactions, ${preview.packageTotals.undoEntryCount} undo entries, ${preview.packageTotals.redoEntryCount} redo entries, ${preview.packageTotals.deferredDecisionCount} deferred decisions.${register} Nothing has been applied.`;
}