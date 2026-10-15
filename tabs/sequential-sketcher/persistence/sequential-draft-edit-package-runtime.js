/** Production bridge between active Draft Edit 3D boundaries and workspace packages. */
import { sequentialSourceRecordsFingerprint } from './sequential-workspace-package.js';
import { sequentialBranchSetFingerprint } from '../scoped-edit/sequential-edit-authority.js';
import { sequentialCommandJournalHeadFingerprint } from '../scoped-edit/sequential-command-journal.js';
import { createSequentialDraftEditPackageExtension } from './sequential-draft-edit-package-extension.js';
import { createSequentialSupportAdjustmentPackageState } from './sequential-support-adjustment-package-state.js';
import { createSequentialGeometryEditPackageState } from './sequential-geometry-edit-package-state.js';

export const SEQUENTIAL_DRAFT_EDIT_PACKAGE_RUNTIME_SCHEMA =
  'SequentialDraftEditPackageRuntime.v1';
export const SEQUENTIAL_DRAFT_EDIT_PACKAGE_RUNTIME_DIAGNOSTIC_SCHEMA =
  'SequentialDraftEditPackageRuntimeDiagnostic.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function requiredMethods(value, names, label) {
  names.forEach((name) => requiredFunction(value?.[name], `${label}.${name}`));
  return value;
}
function modelIdentity(workspace) {
  workspace.saveActiveBranch();
  const model = workspace.getModel();
  if (!Array.isArray(model?.records) || !model?.branchRegistry?.ids) {
    throw new RangeError('Draft Edit package export requires loaded workspace evidence.');
  }
  if (!model.journalState) {
    throw new RangeError('Draft Edit package export requires accepted-command journal authority.');
  }
  return Object.freeze({
    model,
    sourceFingerprint: sequentialSourceRecordsFingerprint(model.records),
    branchSetFingerprint: sequentialBranchSetFingerprint(model.branchRegistry),
    commandJournalHeadFingerprint: sequentialCommandJournalHeadFingerprint(model.journalState),
  });
}
function packageStates(runtime) {
  return Object.freeze({
    support: runtime.supportBoundary.exportPackageState(),
    geometry: runtime.geometryBoundary.exportPackageState(),
  });
}
function extension(runtime) {
  const identity = modelIdentity(runtime.workspace);
  const states = packageStates(runtime);
  return createSequentialDraftEditPackageExtension({
    sourceFingerprint: identity.sourceFingerprint,
    branchSetFingerprint: identity.branchSetFingerprint,
    commandJournalHeadFingerprint: identity.commandJournalHeadFingerprint,
    supportBranches: states.support.branches,
    geometryBranches: states.geometry.branches,
  });
}
function restorationStates(value) {
  if (value?.schema !== 'SequentialDraftEditPackageRestoration.v1') {
    throw new TypeError('Draft Edit package runtime requires a validated restoration.');
  }
  return Object.freeze({
    support: createSequentialSupportAdjustmentPackageState(value.supportBranches),
    geometry: createSequentialGeometryEditPackageState(value.geometryBranches),
  });
}
function rollbackCommitted(runtime, commits, cause) {
  const rollbackErrors = [];
  for (const [boundary, commit] of commits.reverse()) {
    try { boundary.rollbackPackageState(commit); } catch (error) { rollbackErrors.push(error); }
  }
  if (rollbackErrors.length) {
    throw new AggregateError(
      [cause, ...rollbackErrors],
      'Draft Edit package restoration failed and rollback did not complete.',
      { cause },
    );
  }
  throw cause;
}
function prepareStates(runtime, states) {
  const support = runtime.supportBoundary.preparePackageState(states.support);
  try {
    const baseView = runtime.supportBoundary.readPackageStageView(support);
    const geometry = runtime.geometryBoundary.preparePackageState(states.geometry, { baseView });
    return Object.freeze({ support, geometry });
  } catch (error) {
    runtime.supportBoundary.discardPackageState(support);
    throw error;
  }
}
function restorationEvent(result) {
  return Object.freeze({
    schema: 'SequentialDraftEditPackageRuntimeRestoration.v1',
    support: result.support,
    geometry: result.geometry,
    summary: result.summary,
  });
}
function notifyRestored(runtime, result) {
  const restoration = restorationEvent(result);
  try {
    runtime.onRestored(restoration);
    return null;
  } catch (error) {
    const diagnostic = Object.freeze({
      schema: SEQUENTIAL_DRAFT_EDIT_PACKAGE_RUNTIME_DIAGNOSTIC_SCHEMA,
      stage: 'POST_COMMIT_RESTORATION_NOTIFICATION',
      errorName: error?.name || 'Error',
      message: error?.message || String(error),
      restoration,
    });
    try { runtime.onDiagnostic?.(diagnostic); } catch {}
    return diagnostic;
  }
}
function applyPreparedStates(runtime, prepared, summary) {
  const commits = [];
  try {
    const support = runtime.supportBoundary.commitPackageState(prepared.support);
    commits.push([runtime.supportBoundary, support]);
    const geometry = runtime.geometryBoundary.commitPackageState(prepared.geometry);
    commits.push([runtime.geometryBoundary, geometry]);
  } catch (error) {
    runtime.geometryBoundary.discardPackageState(prepared.geometry);
    runtime.supportBoundary.discardPackageState(prepared.support);
    rollbackCommitted(runtime, commits, error);
  }
  const [supportCommit, geometryCommit] = commits.map(([, commit]) => commit);
  const result = Object.freeze({
    support: supportCommit.state,
    geometry: geometryCommit.state,
    summary,
  });
  runtime.supportBoundary.finalizePackageState(supportCommit);
  runtime.geometryBoundary.finalizePackageState(geometryCommit);
  const diagnostic = notifyRestored(runtime, result);
  return diagnostic ? Object.freeze({ ...result, diagnostic }) : result;
}
function restore(runtime, value) {
  const states = restorationStates(value);
  return applyPreparedStates(runtime, prepareStates(runtime, states), value.summary);
}
function clear(runtime) {
  const states = Object.freeze({
    support: createSequentialSupportAdjustmentPackageState([]),
    geometry: createSequentialGeometryEditPackageState([]),
  });
  return applyPreparedStates(runtime, prepareStates(runtime, states), Object.freeze({
    supportBranchCount: 0, supportAdjustmentCount: 0,
    geometryBranchCount: 0, geometryEditCount: 0,
  }));
}
function state(runtime) {
  const states = packageStates(runtime);
  return Object.freeze({
    supportBranchCount: states.support.branchCount,
    supportAdjustmentCount: states.support.currentAdjustmentCount,
    geometryBranchCount: states.geometry.branchCount,
    geometryEditCount: states.geometry.editCount,
  });
}

export function createSequentialDraftEditPackageRuntime(options = {}) {
  const transactionMethods = [
    'preparePackageState', 'commitPackageState', 'rollbackPackageState',
    'finalizePackageState', 'discardPackageState',
  ];
  const runtime = {
    workspace: requiredMethods(options.workspace, ['getModel', 'saveActiveBranch'], 'workspace'),
    supportBoundary: requiredMethods(options.supportBoundary,
      ['exportPackageState', 'readPackageStageView', ...transactionMethods], 'supportBoundary'),
    geometryBoundary: requiredMethods(options.geometryBoundary,
      ['exportPackageState', ...transactionMethods], 'geometryBoundary'),
    onRestored: requiredFunction(options.onRestored || (() => {}), 'onRestored'),
    onDiagnostic: typeof options.onDiagnostic === 'function' ? options.onDiagnostic : null,
  };
  return Object.freeze({
    schema: SEQUENTIAL_DRAFT_EDIT_PACKAGE_RUNTIME_SCHEMA,
    createExtension: () => extension(runtime),
    restoreExtension: (value) => restore(runtime, value),
    clear: () => clear(runtime),
    getState: () => state(runtime),
  });
}
