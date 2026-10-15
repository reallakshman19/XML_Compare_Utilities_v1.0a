/** Immutable engineering-demo baseline evidence for Sequential Draft Edit 3D. */
import { immutableJson, isIsoTimestamp } from '../../../contracts/contract-values.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import { sequentialCommandJournalHeadFingerprint } from './sequential-command-journal.js';
import {
  assertSequentialDraftEdit3dFixtureCatalog,
  createSequentialDraftEdit3dFixtureCatalog,
} from './sequential-draft-edit-3d-fixture-catalog.js';
import {
  SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_IDS,
  assertSequentialDraftEdit3dLimitationRegister,
  createSequentialDraftEdit3dLimitationRegister,
} from './sequential-draft-edit-3d-limitation-register.js';

export const SEQUENTIAL_DRAFT_EDIT_3D_RELEASE_MANIFEST_SCHEMA =
  'SequentialDraftEdit3dReleaseManifest.v1';
export const SEQUENTIAL_DRAFT_EDIT_3D_BASELINE = Object.freeze({
  repository: 'reallaksh19/XML_Compare_Utilities',
  commit: '19e04711fc54083bd8e622bbd82048839ca8ebfa',
  roadmapPhase: 'P0',
  workPack: 'SSK-3D-P0-A',
  releaseLevel: 'ENGINEERING_DEMO_BASELINE',
});
export const SEQUENTIAL_DRAFT_EDIT_3D_CAPABILITIES = Object.freeze({
  supervisedCommands: Object.freeze([
    'ADVANCE_ONE', 'CONNECT_CANDIDATE', 'DEFER_DECISION', 'MANUAL_CONNECT',
    'MARK_EXTERNAL_BOUNDARY', 'MARK_TERMINAL', 'REDO_LAST_TRANSACTION',
    'REJECT_CANDIDATE', 'RESUME_DECISION', 'REVERSE_COMPONENT',
    'RUN_UNTIL_BLOCKED', 'UNDO_LAST_TRANSACTION',
  ]),
  geometryOperations: Object.freeze(['MOVE_COMPONENT', 'ROTATE_SUBGRAPH', 'STRETCH_NODE']),
  supportOperations: Object.freeze(['MOVE_SUPPORT_SAME_CARRIER']),
  structuralImpactPreviews: Object.freeze([
    'ADD_STRAIGHT_ELEMENT', 'BRIDGE_GAP', 'DISCONNECT_ENDPOINT', 'MERGE_NODES',
    'RETIRE_COMPONENT', 'SPLIT_PIPE',
  ]),
});
export const SEQUENTIAL_DRAFT_EDIT_3D_RUNTIME_PATHS = Object.freeze([
  'tabs/sequential-sketcher/sequential-sketcher-tab.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-3d-controller.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-production-shadow.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-workspace-command-boundary.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-support-adjustment-boundary.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-geometry-edit-boundary.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-component-edit-operations.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-3d-fixture-catalog.js',
  'tabs/sequential-sketcher/scoped-edit/sequential-draft-edit-3d-limitation-register.js',
  'workbench3d/viewer/workbench-viewer.js',
]);
export const SEQUENTIAL_DRAFT_EDIT_3D_LIMITATIONS = SEQUENTIAL_DRAFT_EDIT_3D_LIMITATION_IDS;

function fail(message, Constructor = RangeError) { throw new Constructor(message); }
function text(value, label) {
  const result = String(value ?? '').trim();
  if (!result) fail(`${label} is required.`, TypeError);
  return result;
}
function safeFilePart(value) {
  return String(value || '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'branch';
}
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} is required.`, TypeError);
  return value;
}
function exactList(value, expected, label) {
  const actual = Array.isArray(value) ? [...value].map(String).sort() : [];
  const canonical = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(canonical)) fail(`${label} differs from the qualified baseline.`);
  return Object.freeze(canonical);
}
function journalAuthorityTimestamp(commandState) {
  const state = object(commandState.journalState, 'commandState.journalState');
  const journal = object(state.journal, 'commandState.journalState.journal');
  if (journal.schema !== 'CommandJournal.v1' || !isIsoTimestamp(journal.updatedAt)) {
    fail('Command journal authority timestamp is unavailable.', TypeError);
  }
  return journal.updatedAt;
}
function controllerEvidence(input) {
  const state = object(input.controllerState, 'controllerState');
  return {
    schema: text(input.controllerSchema, 'controllerSchema'),
    available: state.available === true,
    mounted: state.mounted === true,
    active: state.active === true,
    mountKey: String(state.mountKey || ''),
    failureCount: Number(state.failureCount || 0),
    destroyed: state.destroyed === true,
    fallbackSurface: 'CONSTRUCTION_SVG',
    viewerState: state.viewerState || null,
  };
}
function currentBranch(commandState, readModel) {
  const branchId = text(commandState.session?.rootBranchId, 'active branch');
  if (text(readModel.branchId, 'readModel.branchId') !== branchId) {
    fail('Current read authority branch differs from command authority.');
  }
  return branchId;
}
function journalEvidence(commandState, supportState, geometryState) {
  const journalState = object(commandState.journalState, 'commandState.journalState');
  const history = supportState.supportAdjustmentHistory || null;
  const register = supportState.supportAdjustmentRegister || history?.currentRegister || null;
  const geometryJournal = object(geometryState.geometryEditJournal, 'geometryEditJournal');
  return {
    commandJournalHeadFingerprint: sequentialCommandJournalHeadFingerprint(journalState),
    commandJournalState: 'PRESENT',
    supportRegisterHeadFingerprint: register?.headFingerprint || null,
    supportHistoryFingerprint: history?.historyFingerprint || null,
    geometryJournalHeadFingerprint: text(geometryJournal.headFingerprint,
      'geometryEditJournal.headFingerprint'),
    geometryEntryCount: Array.isArray(geometryJournal.entries) ? geometryJournal.entries.length : 0,
  };
}
function authorityEvidence(input, commandState, readModel, scene) {
  const shadow = object(input.shadowEvidence, 'shadowEvidence');
  const branchId = currentBranch(commandState, readModel);
  const entities = Array.isArray(scene.entities) ? scene.entities : [];
  return {
    branchId,
    sourceFingerprint: text(commandState.sourceFingerprint, 'sourceFingerprint'),
    readAuthorityId: text(readModel.authorityId, 'readModel.authorityId'),
    sceneId: text(scene.sceneId, 'scene.sceneId'),
    readRevisionFingerprint: sequentialSemanticFingerprint('SSK3DREVISION',
      object(readModel.revision, 'readModel.revision')),
    mountKey: text(shadow.mountKey, 'shadowEvidence.mountKey'),
    shadowSchema: text(shadow.schema, 'shadowEvidence.schema'),
    readModelSchema: text(readModel.schema, 'readModel.schema'),
    sceneSchema: text(scene.schema, 'scene.schema'),
    entityCount: entities.length,
  };
}
function capabilityEvidence(controllerState) {
  const allowed = controllerState.commandGateway?.allowedCommandTypes;
  return {
    supervisedCommands: exactList(allowed,
      SEQUENTIAL_DRAFT_EDIT_3D_CAPABILITIES.supervisedCommands, 'supervised command list'),
    geometryOperations: SEQUENTIAL_DRAFT_EDIT_3D_CAPABILITIES.geometryOperations,
    supportOperations: SEQUENTIAL_DRAFT_EDIT_3D_CAPABILITIES.supportOperations,
    structuralImpactPreviews: SEQUENTIAL_DRAFT_EDIT_3D_CAPABILITIES.structuralImpactPreviews,
  };
}
function material(input) {
  const commandState = object(input.commandState, 'commandState');
  const supportState = object(input.supportState, 'supportState');
  const geometryState = object(input.geometryState, 'geometryState');
  const view = object(input.view, 'view');
  const readModel = object(view.readModel, 'view.readModel');
  const scene = object(view.scene, 'view.scene');
  const controller = controllerEvidence(input);
  if (!controller.available) fail('Pilot baseline evidence requires an authoritative open branch.');
  return {
    schema: SEQUENTIAL_DRAFT_EDIT_3D_RELEASE_MANIFEST_SCHEMA,
    createdAt: journalAuthorityTimestamp(commandState),
    baseline: SEQUENTIAL_DRAFT_EDIT_3D_BASELINE,
    runtimePaths: SEQUENTIAL_DRAFT_EDIT_3D_RUNTIME_PATHS,
    authority: authorityEvidence(input, commandState, readModel, scene),
    journals: journalEvidence(commandState, supportState, geometryState),
    controller,
    capabilities: capabilityEvidence(input.controllerState),
    fixtureCatalog: createSequentialDraftEdit3dFixtureCatalog(),
    limitationRegister: createSequentialDraftEdit3dLimitationRegister(),
    limitations: SEQUENTIAL_DRAFT_EDIT_3D_LIMITATIONS,
    disposition: Object.freeze({
      releaseLevel: 'ENGINEERING_DEMO_BASELINE',
      internalPilotReady: false,
      newEditingAuthority: false,
      structuralTopologyPublication: 'NOT_AUTHORIZED',
      packagePersistenceChange: 'NONE',
    }),
  };
}
function fixtureCatalogInvariant(value) {
  try {
    const catalog = assertSequentialDraftEdit3dFixtureCatalog(value);
    return JSON.stringify(catalog) === JSON.stringify(createSequentialDraftEdit3dFixtureCatalog());
  } catch { return false; }
}
function limitationRegisterInvariant(value) {
  try {
    const register = assertSequentialDraftEdit3dLimitationRegister(value);
    const exact = JSON.stringify(register) === JSON.stringify(createSequentialDraftEdit3dLimitationRegister());
    const ids = register.entries.map((entry) => entry.limitationId);
    return exact && JSON.stringify(ids) === JSON.stringify(SEQUENTIAL_DRAFT_EDIT_3D_LIMITATIONS);
  } catch { return false; }
}
function invariant(value) {
  try {
    return value.baseline?.repository === SEQUENTIAL_DRAFT_EDIT_3D_BASELINE.repository
      && value.baseline?.commit === SEQUENTIAL_DRAFT_EDIT_3D_BASELINE.commit
      && value.baseline?.releaseLevel === 'ENGINEERING_DEMO_BASELINE'
      && JSON.stringify(value.runtimePaths) === JSON.stringify(SEQUENTIAL_DRAFT_EDIT_3D_RUNTIME_PATHS)
      && JSON.stringify(value.capabilities) === JSON.stringify(SEQUENTIAL_DRAFT_EDIT_3D_CAPABILITIES)
      && fixtureCatalogInvariant(value.fixtureCatalog)
      && limitationRegisterInvariant(value.limitationRegister)
      && JSON.stringify(value.limitations) === JSON.stringify(SEQUENTIAL_DRAFT_EDIT_3D_LIMITATIONS)
      && value.controller?.fallbackSurface === 'CONSTRUCTION_SVG'
      && value.disposition?.internalPilotReady === false
      && value.disposition?.newEditingAuthority === false
      && value.disposition?.structuralTopologyPublication === 'NOT_AUTHORIZED'
      && value.disposition?.packagePersistenceChange === 'NONE';
  } catch { return false; }
}
export function createSequentialDraftEdit3dReleaseManifest(input = {}) {
  const base = material(input);
  return immutableJson({ ...base,
    manifestFingerprint: sequentialSemanticFingerprint('SSK3DRELEASE', base) },
  'Sequential Draft Edit 3D release manifest');
}
export function assertSequentialDraftEdit3dReleaseManifest(value) {
  const manifest = immutableJson(value, 'Sequential Draft Edit 3D release manifest');
  if (manifest.schema !== SEQUENTIAL_DRAFT_EDIT_3D_RELEASE_MANIFEST_SCHEMA) {
    fail(`Release manifest must use ${SEQUENTIAL_DRAFT_EDIT_3D_RELEASE_MANIFEST_SCHEMA}.`, TypeError);
  }
  const { manifestFingerprint, ...base } = manifest;
  if (!isIsoTimestamp(manifest.createdAt)
    || manifestFingerprint !== sequentialSemanticFingerprint('SSK3DRELEASE', base)
    || !invariant(manifest)) fail('Release manifest differs from the qualified engineering-demo baseline.');
  return manifest;
}
export function validateSequentialDraftEdit3dReleaseManifest(value, input = {}) {
  const asserted = assertSequentialDraftEdit3dReleaseManifest(value);
  const rebuilt = createSequentialDraftEdit3dReleaseManifest(input);
  if (JSON.stringify(asserted) !== JSON.stringify(rebuilt)) fail(
    'Release manifest differs from current runtime regeneration.');
  return rebuilt;
}
export function sequentialDraftEdit3dReleaseManifestFileName(value) {
  const manifest = assertSequentialDraftEdit3dReleaseManifest(value);
  return `ssk-draft-edit-3d.${safeFilePart(manifest.authority.branchId)}.release-manifest.v1.json`;
}
