/** Durable branch-local support and geometry edit state carried by workspace packages. */
import { immutableJson } from '../../../contracts/contract-values.js';
import { createConfirmedSequentialConstruction } from '../construction/sequential-construction-acceptance.js';
import { sameSequentialContractValue, sequentialSemanticFingerprint } from '../scoped-edit/sequential-command-contracts.js';
import { assertSequentialGeometryEditJournal } from '../scoped-edit/sequential-geometry-edit-journal.js';
import {
  assertSequentialGeometryEditHistory,
  sequentialGeometryEditHistoryJournal,
} from '../scoped-edit/sequential-geometry-edit-history.js';
import { createSequentialEditableTopologySnapshot } from '../scoped-edit/sequential-editable-topology-snapshot.js';
import { createSequentialScopedEditReadModel } from '../scoped-edit/sequential-scoped-edit-read-model.js';
import {
  createSequentialAdjustedEngineeringSvgOwnerSnapshot,
  createSequentialEngineeringSvgOwnerBridge,
} from '../sequential-engineering-svg-owner-bridge.js';
import { buildConfirmedConstructionSupportProjection } from '../support/sequential-confirmed-support-projection.js';
import { sequentialSupportProjectionFingerprint } from '../support/sequential-support-adjusted-projection.js';
import { assertSequentialSupportAdjustmentHistory } from '../support/sequential-support-adjustment-history.js';

export const SEQUENTIAL_DRAFT_EDIT_PACKAGE_EXTENSION_SCHEMA =
  'SequentialDraftEditPackageExtension.v1';
export const SEQUENTIAL_DRAFT_EDIT_PACKAGE_RESTORATION_SCHEMA =
  'SequentialDraftEditPackageRestoration.v1';

function fail(code, detail = '', Constructor = RangeError) {
  const error = new Constructor(`${code}${detail ? `: ${detail}` : ''}`);
  error.code = code; throw error;
}
function text(value, label) {
  const result = String(value ?? '').trim();
  if (!result) fail('DRAFT_EDIT_PACKAGE_TEXT_REQUIRED', label, TypeError);
  return result;
}
function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function rows(value, label) {
  if (!Array.isArray(value)) fail('DRAFT_EDIT_PACKAGE_ARRAY_REQUIRED', label, TypeError);
  return value;
}
function uniqueBranches(values, label) {
  const result = values.map((row) => text(row?.branchId, `${label}.branchId`));
  if (new Set(result).size !== result.length) fail('DRAFT_EDIT_PACKAGE_DUPLICATE_BRANCH', label);
  return result;
}
function sorted(values) {
  return [...values].sort((left, right) => left.branchId.localeCompare(right.branchId));
}
function consumedIds(values, label) {
  const result = rows(values || [], label).map((value) => text(value, label)).sort();
  if (new Set(result).size !== result.length) fail('DRAFT_EDIT_PACKAGE_DUPLICATE_CONSUMED_ID', label);
  return Object.freeze(result);
}
function supportRow(value) {
  const branchId = text(value?.branchId, 'support branchId');
  const history = assertSequentialSupportAdjustmentHistory(value?.history, {
    constructionFingerprint: text(value?.constructionFingerprint, 'support constructionFingerprint'),
    baseProjectionFingerprint: text(value?.baseProjectionFingerprint,
      'support baseProjectionFingerprint'),
  });
  return Object.freeze({ branchId,
    constructionFingerprint: history.constructionFingerprint,
    baseProjectionFingerprint: history.baseProjectionFingerprint,
    history, consumedPreparedIds: consumedIds(value?.consumedPreparedIds,
      'support consumedPreparedIds') });
}
function geometryRow(value) {
  const branchId = text(value?.branchId, 'geometry branchId');
  const consumedPreparedIds = consumedIds(value?.consumedPreparedIds,
    'geometry consumedPreparedIds');
  if (value?.history) {
    const history = assertSequentialGeometryEditHistory(value.history, { branchId });
    const journal = sequentialGeometryEditHistoryJournal(history);
    if (value.journal && !sameSequentialContractValue(
      assertSequentialGeometryEditJournal(value.journal), journal)) {
      fail('DRAFT_EDIT_PACKAGE_GEOMETRY_ACTIVE_JOURNAL_MISMATCH', branchId);
    }
    return Object.freeze({ branchId,
      confirmedConstructionFingerprint: history.confirmedConstructionFingerprint,
      baseFingerprint: history.baseFingerprint, history, journal, consumedPreparedIds });
  }
  const journal = assertSequentialGeometryEditJournal(value?.journal);
  if (journal.branchId !== branchId) fail('DRAFT_EDIT_PACKAGE_GEOMETRY_BRANCH_MISMATCH', branchId);
  return Object.freeze({ branchId,
    confirmedConstructionFingerprint: journal.confirmedConstructionFingerprint,
    baseFingerprint: journal.baseFingerprint, journal, consumedPreparedIds });
}
function geometryCounts(row) {
  if (row.history) return { total: row.history.entries.length, active: row.history.cursor };
  return { total: row.journal.entries.length, active: row.journal.entries.length };
}
function extensionSummary(supportBranches, geometryBranches) {
  const summary = {
    supportBranchCount: supportBranches.length,
    supportAdjustmentCount: supportBranches.reduce((count, row) =>
      count + row.history.currentRegister.entries.length, 0),
    geometryBranchCount: geometryBranches.length,
    geometryEditCount: geometryBranches.reduce((count, row) => count + geometryCounts(row).total, 0),
  };
  if (geometryBranches.some((row) => row.history)) {
    summary.activeGeometryEditCount = geometryBranches.reduce((count, row) =>
      count + geometryCounts(row).active, 0);
    summary.geometryRedoCount = summary.geometryEditCount - summary.activeGeometryEditCount;
    summary.geometryHistoryTransitionCount = geometryBranches.reduce((count, row) =>
      count + (row.history?.consumedTransitionIds.length || 0), 0);
  }
  return Object.freeze(summary);
}
function extensionMaterial(input) {
  const supportBranches = sorted(rows(input.supportBranches || [], 'supportBranches').map(supportRow));
  const geometryBranches = sorted(rows(input.geometryBranches || [], 'geometryBranches').map(geometryRow));
  uniqueBranches(supportBranches, 'supportBranches'); uniqueBranches(geometryBranches, 'geometryBranches');
  return {
    schema: SEQUENTIAL_DRAFT_EDIT_PACKAGE_EXTENSION_SCHEMA,
    sourceFingerprint: text(input.sourceFingerprint, 'sourceFingerprint'),
    branchSetFingerprint: text(input.branchSetFingerprint, 'branchSetFingerprint'),
    commandJournalHeadFingerprint: input.commandJournalHeadFingerprint
      ? text(input.commandJournalHeadFingerprint, 'commandJournalHeadFingerprint') : null,
    supportBranches, geometryBranches,
    summary: extensionSummary(supportBranches, geometryBranches),
  };
}
function assertSummary(value, material) {
  const actual = value?.summary || {};
  for (const [key, expected] of Object.entries(material.summary)) {
    if (actual[key] !== expected) fail('DRAFT_EDIT_PACKAGE_SUMMARY_INVALID', key);
  }
  const allowed = new Set(Object.keys(material.summary));
  Object.keys(actual).forEach((key) => {
    if (!allowed.has(key)) fail('DRAFT_EDIT_PACKAGE_SUMMARY_INVALID', key);
  });
}
function baseIdentity(restoration) {
  return {
    sourceFingerprint: text(restoration?.sourceFingerprint
      || restoration?.source?.sourceFingerprint, 'restoration sourceFingerprint'),
    branchIds: rows(restoration?.branchIds || [], 'restoration.branchIds').map(String).sort(),
    branchSetFingerprint: text(restoration?.commandAuthority?.currentBranchSetFingerprint,
      'restoration currentBranchSetFingerprint'),
    commandJournalHeadFingerprint: restoration?.commandAuthority?.journalHeadFingerprint
      || restoration?.journalHeadFingerprint || null,
  };
}
function validateBranchInventory(extension, restoration) {
  const identity = baseIdentity(restoration);
  if (extension.sourceFingerprint !== identity.sourceFingerprint
    || extension.branchSetFingerprint !== identity.branchSetFingerprint) {
    fail('DRAFT_EDIT_PACKAGE_ANCESTRY_STALE');
  }
  if ((extension.commandJournalHeadFingerprint || null)
    !== (identity.commandJournalHeadFingerprint || null)) {
    fail('DRAFT_EDIT_PACKAGE_COMMAND_JOURNAL_STALE');
  }
  const known = new Set(identity.branchIds);
  [...extension.supportBranches, ...extension.geometryBranches].forEach((row) => {
    if (!known.has(row.branchId)) fail('DRAFT_EDIT_PACKAGE_BRANCH_UNKNOWN', row.branchId);
  });
}
function downstream(session, indexes) {
  if (session?.state !== 'ROUTE_COMPLETE') return Object.freeze({
    confirmedConstruction: null, supportProjection: null,
  });
  const confirmedConstruction = createConfirmedSequentialConstruction(session, indexes);
  const supportProjection = buildConfirmedConstructionSupportProjection(confirmedConstruction, indexes, {
    projectionToleranceMm: 50, onCenterlineToleranceMm: 0.001, ambiguityToleranceMm: 1,
  });
  return Object.freeze({ confirmedConstruction, supportProjection });
}
function restoredSnapshot(restoration, snapshot) {
  return Object.freeze({ ...snapshot, ...downstream(snapshot?.session, restoration.indexes) });
}
function workspaceMap(restoration) {
  return new Map(rows(restoration?.workspaces || [], 'restoration.workspaces')
    .map((row) => [text(row?.branchId, 'restoration workspace branchId'),
      restoredSnapshot(restoration, row.snapshot)]));
}
function baseOwnerSnapshot(restoration, snapshot) {
  const bridge = createSequentialEngineeringSvgOwnerBridge({
    readOwnerState: () => ({ session: snapshot.session, evidenceModel: restoration.evidence,
      indexes: restoration.indexes, confirmedConstruction: snapshot.confirmedConstruction,
      supportProjection: snapshot.supportProjection, visibleProjection: 'ISO' }),
  });
  try { return bridge.getSnapshot(); } finally { bridge.destroy(); }
}
function validateSupportAuthority(item, snapshot) {
  const base = snapshot?.supportProjection;
  if (!base) fail('DRAFT_EDIT_PACKAGE_SUPPORT_BASE_MISSING', item.branchId);
  assertSequentialSupportAdjustmentHistory(item.history, {
    constructionFingerprint: base.constructionFingerprint,
    baseProjectionFingerprint: sequentialSupportProjectionFingerprint(base),
  });
}
function effectiveOwner(restoration, snapshot, support) {
  const owner = baseOwnerSnapshot(restoration, snapshot);
  return support
    ? createSequentialAdjustedEngineeringSvgOwnerSnapshot(owner, support.history.currentRegister)
    : owner;
}
function validateGeometryAuthority(item, restoration, snapshot, support) {
  if (!snapshot) fail('DRAFT_EDIT_PACKAGE_WORKSPACE_MISSING', item.branchId);
  const owner = effectiveOwner(restoration, snapshot, support);
  const readModel = createSequentialScopedEditReadModel(owner);
  const topology = createSequentialEditableTopologySnapshot(readModel);
  if (item.history) {
    const history = assertSequentialGeometryEditHistory(item.history, { snapshot: topology });
    assertSequentialGeometryEditJournal(sequentialGeometryEditHistoryJournal(history), topology);
  } else {
    assertSequentialGeometryEditJournal(item.journal, topology);
  }
}
function validateEditAuthority(extension, restoration) {
  const workspaces = workspaceMap(restoration);
  const support = new Map(extension.supportBranches.map((item) => [item.branchId, item]));
  extension.supportBranches.forEach((item) => validateSupportAuthority(item,
    workspaces.get(item.branchId)));
  extension.geometryBranches.forEach((item) => validateGeometryAuthority(item, restoration,
    workspaces.get(item.branchId), support.get(item.branchId) || null));
}
function restorationMaterial(extension, workspaceRestoration) {
  validateBranchInventory(extension, workspaceRestoration);
  validateEditAuthority(extension, workspaceRestoration);
  return { schema: SEQUENTIAL_DRAFT_EDIT_PACKAGE_RESTORATION_SCHEMA,
    sourceFingerprint: extension.sourceFingerprint,
    branchSetFingerprint: extension.branchSetFingerprint,
    commandJournalHeadFingerprint: extension.commandJournalHeadFingerprint,
    supportBranches: extension.supportBranches, geometryBranches: extension.geometryBranches,
    summary: extension.summary, extensionFingerprint: extension.extensionFingerprint };
}

export function createSequentialDraftEditPackageExtension(input = {}) {
  const material = extensionMaterial(input);
  return immutableJson({ ...material,
    extensionFingerprint: sequentialSemanticFingerprint('SSK3DEDITPACKAGE', material) },
  'Sequential Draft Edit package extension');
}
export function assertSequentialDraftEditPackageExtension(value) {
  const extension = immutableJson(value, 'Sequential Draft Edit package extension');
  if (extension.schema !== SEQUENTIAL_DRAFT_EDIT_PACKAGE_EXTENSION_SCHEMA) {
    fail('DRAFT_EDIT_PACKAGE_SCHEMA_INVALID', extension.schema, TypeError);
  }
  const material = extensionMaterial(extension); assertSummary(extension, material);
  const expected = sequentialSemanticFingerprint('SSK3DEDITPACKAGE', material);
  if (extension.extensionFingerprint !== expected) fail('DRAFT_EDIT_PACKAGE_FINGERPRINT_MISMATCH');
  return extension;
}
export function restoreSequentialDraftEditPackageExtension(value, workspaceRestoration) {
  const extension = assertSequentialDraftEditPackageExtension(value);
  return immutableJson(restorationMaterial(extension, workspaceRestoration),
    'Sequential Draft Edit package restoration');
}
export function emptySequentialDraftEditPackageExtension(input = {}) {
  return createSequentialDraftEditPackageExtension({ ...input,
    supportBranches: [], geometryBranches: [] });
}
export function sequentialDraftEditPackageExtensionFingerprint(value) {
  return assertSequentialDraftEditPackageExtension(clone(value)).extensionFingerprint;
}