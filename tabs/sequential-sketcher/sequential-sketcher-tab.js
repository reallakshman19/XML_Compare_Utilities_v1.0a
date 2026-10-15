import { mountSequentialSketcherWorkspace } from './sequential-sketcher-workspace.js?v=20260718-ssk-geometry-order-1';
import { mountSequentialEngineeringSvgPreviewController } from './sequential-engineering-svg-preview-controller.js?v=20260721-ssk-esvg-preview-1';
import { mountSequentialRedoController } from './construction/sequential-redo-controller.js?v=20260717-ssk-workspace-apply-receipts-1';
import { mountSequentialProjectExportController } from './platform/sequential-project-export-controller.js?v=20260717-ssk-workspace-apply-receipts-1';
import { mountSequentialWorkspacePersistenceController } from './persistence/sequential-workspace-persistence-controller.js?v=20260730-ssk-3d-p1-a';
import { createSequentialDraftEditPackageRuntime } from './persistence/sequential-draft-edit-package-runtime.js?v=20260730-ssk-3d-p1-a';
import { createSequentialDraftEditRecoveryStorage } from './persistence/sequential-draft-edit-recovery-storage.js?v=20260730-ssk-3d-p1-c';
import { mountSequentialContinuityController } from './continuity/sequential-continuity-controller.js?v=20260717-ssk-continuity-geometry-1';
import { createSequentialScopedEditProductionShadow } from './scoped-edit/sequential-scoped-edit-production-shadow.js?v=20260727-ssk-ts-1b-shadow-1';
import { mountSequentialScopedEdit3dController } from './scoped-edit/sequential-scoped-edit-3d-controller.js?v=20260731-ssk-ts-3q-reconcile';
import { createSequentialWorkspaceCommandBoundary } from './scoped-edit/sequential-workspace-command-boundary.js?v=20260727-ssk-ts-3a-gateway-1';
import { createSequentialSupportAdjustmentBoundary } from './scoped-edit/sequential-support-adjustment-boundary.js?v=20260730-ssk-3d-p1-a';
import { createSequentialGeometryEditBoundary } from './scoped-edit/sequential-geometry-edit-boundary.js?v=20260730-ssk-3d-p1-b';
import { createSequentialTopologyEditBoundary } from './scoped-edit/sequential-topology-edit-boundary.js?v=20260731-ssk-ts-3q-reconcile';
import { createSequentialDraftEdit3dPilotFeature } from './scoped-edit/sequential-draft-edit-3d-pilot-feature.js?v=20260730-ssk-3d-p0-a';

const STYLE_ID = 'sequential-sketcher-style';
const CONTINUITY_STYLE_ID = 'sequential-continuity-style';
function ensureLink(documentRef, id, href) {
  if (documentRef.getElementById(id)) return;
  const link = documentRef.createElement('link'); link.id = id; link.rel = 'stylesheet'; link.href = href;
  documentRef.head.appendChild(link);
}
function ensureStylesheet(documentRef) {
  ensureLink(documentRef, STYLE_ID, './tabs/sequential-sketcher/sequential-sketcher.css?v=20260717-ssk-workspace-apply-receipts-1');
  ensureLink(documentRef, CONTINUITY_STYLE_ID, './tabs/sequential-sketcher/continuity/sequential-continuity.css?v=20260717-ssk-continuity-geometry-1');
}
function numeric(root, selector, fallback) {
  const value = Number(root.querySelector(selector)?.value); return Number.isFinite(value) ? value : fallback;
}
function commandEngineOptions(root) {
  return { exactToleranceMm: numeric(root, '[data-ssk-exact-tolerance]', 1),
    autoRepairToleranceMm: Math.min(25, numeric(root, '[data-ssk-repair-tolerance]', 25)),
    candidateSearchRadiusMm: numeric(root, '[data-ssk-candidate-radius]', 250) };
}
function exactClock(provider) { return typeof provider === 'function' ? provider : () => new Date().toISOString(); }
function createTile(container) {
  const tile = container.ownerDocument.createElement('button'); tile.type = 'button';
  tile.className = 'psmap-card psmap-tile'; tile.setAttribute('data-ssk-open', '1');
  tile.innerHTML = '<span class="ssk-launcher-icon">✎</span><b>Sequential Sketcher</b><span>Compile pipe + fittings into an auditable pen sequence</span>';
  container.appendChild(tile); return tile;
}
function createOverlay(runtime) {
  const overlay = runtime.container.ownerDocument.createElement('div'); overlay.className = 'ssk-modal';
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Sequential Sketcher');
  runtime.container.ownerDocument.body.appendChild(overlay); runtime.overlay = overlay; return overlay;
}
function destroyScoped(runtime) {
  runtime.pilotFeature?.destroy(); runtime.pilotFeature = null;
  runtime.draftEdit3dController?.destroy(); runtime.draftEdit3dController = null;
  runtime.draftEditRecoveryStorage?.destroy(); runtime.draftEditRecoveryStorage = null;
  runtime.topologyEditBoundary?.destroy(); runtime.topologyEditBoundary = null;
  runtime.geometryEditBoundary?.destroy(); runtime.geometryEditBoundary = null;
  runtime.supportAdjustmentBoundary?.destroy(); runtime.supportAdjustmentBoundary = null;
  runtime.draftEditPackageRuntime = null;
  runtime.scopedEditShadow?.destroy(); runtime.scopedEditShadow = null;
}
function destroyWorkspace(runtime, removeTile = false) {
  destroyScoped(runtime);
  runtime.previewController?.destroy(); runtime.previewController = null;
  runtime.continuityController?.destroy(); runtime.continuityController = null;
  runtime.persistenceController?.destroy(); runtime.persistenceController = null;
  runtime.projectExportController?.destroy(); runtime.projectExportController = null;
  runtime.redoController?.destroy(); runtime.redoController = null;
  runtime.active?.destroy(); runtime.active = null;
  runtime.overlay?.remove(); runtime.overlay = null;
  if (removeTile) { runtime.tile.removeEventListener('click', runtime.open); runtime.tile.remove(); }
}
function mountShadow(runtime) {
  try {
    runtime.scopedEditShadow = createSequentialScopedEditProductionShadow({
      snapshotProvider: runtime.active.getEngineeringSvgOwnerSnapshot,
      subscribe: runtime.active.subscribeEngineeringSvgOwnerState,
      onDiagnostic: runtime.context.onSequentialScopedEditShadowDiagnostic,
    });
  } catch (error) {
    runtime.scopedEditShadow = null;
    try { runtime.context.onSequentialScopedEditShadowFailure?.(error); } catch {}
  }
}
function reportDraftEditRestorationDiagnostic(runtime, diagnostic) {
  try { runtime.context.onSequentialScopedEdit3dFailure?.({
    stage: 'post-commit restoration refresh', message: diagnostic.message, diagnostic,
  }); } catch {}
}
function reportDraftRecoveryDiagnostic(runtime, diagnostic) {
  try { runtime.context.onSequentialScopedEdit3dFailure?.({
    stage: 'pending draft recovery', message: diagnostic.message, diagnostic,
  }); } catch {}
  try { runtime.context.onSequentialDraftEditRecoveryDiagnostic?.(diagnostic); } catch {}
}
function browserRecoveryStorage(overlay) {
  try { return overlay.ownerDocument.defaultView?.localStorage || null; } catch { return null; }
}
function createDraftRecoveryStorage(runtime, overlay) {
  runtime.draftEditRecoveryStorage = createSequentialDraftEditRecoveryStorage({
    storage: browserRecoveryStorage(overlay),
    onDiagnostic: (diagnostic) => reportDraftRecoveryDiagnostic(runtime, diagnostic),
  });
}
function createDraftEditPackageRuntime(runtime) {
  runtime.draftEditPackageRuntime = createSequentialDraftEditPackageRuntime({
    workspace: runtime.active, supportBoundary: runtime.supportAdjustmentBoundary,
    geometryBoundary: runtime.geometryEditBoundary,
    onRestored: () => { runtime.scopedEditShadow?.observe(); runtime.draftEdit3dController?.refresh(); },
    onDiagnostic: (diagnostic) => reportDraftEditRestorationDiagnostic(runtime, diagnostic),
  });
}
function createBoundaries(runtime, overlay) {
  const commandBoundary = createSequentialWorkspaceCommandBoundary({
    readModel: runtime.active.getModel,
    readOwnerSnapshot: runtime.active.getEngineeringSvgOwnerSnapshot,
    readEngineOptions: () => commandEngineOptions(overlay),
    restorePackage: runtime.active.restorePackage,
    failureFactory: runtime.context.sequentialDraftEditCommandPublicationFailureFactory,
    onSynchronizationFailure: runtime.context.onSequentialDraftEditCommandSynchronizationFailure,
    syncAfterCommit: () => { runtime.scopedEditShadow?.observe(); runtime.draftEdit3dController?.refresh(); },
  });
  runtime.supportAdjustmentBoundary = createSequentialSupportAdjustmentBoundary({
    readBaseState: commandBoundary.readCurrentState,
    readBaseOwnerSnapshot: runtime.active.getEngineeringSvgOwnerSnapshot,
    onPublished: () => runtime.draftEdit3dController?.refresh(),
  });
  runtime.geometryEditBoundary = createSequentialGeometryEditBoundary({
    readBaseState: runtime.supportAdjustmentBoundary.readCurrentState,
    readBaseView: runtime.supportAdjustmentBoundary.readView,
    onPublished: () => runtime.draftEdit3dController?.refresh(),
  });
  runtime.topologyEditBoundary = createSequentialTopologyEditBoundary({
    readBaseState: runtime.geometryEditBoundary.readCurrentState,
    readBaseView: runtime.geometryEditBoundary.readView,
    onPublished: () => runtime.draftEdit3dController?.refresh(),
  });
  createDraftEditPackageRuntime(runtime); return commandBoundary;
}
function mountPilot(runtime, overlay, commandBoundary) {
  const context = runtime.context;
  runtime.pilotFeature = createSequentialDraftEdit3dPilotFeature({
    root: overlay, controller: runtime.draftEdit3dController, shadow: runtime.scopedEditShadow,
    commandBoundary, supportBoundary: runtime.supportAdjustmentBoundary,
    geometryBoundary: runtime.geometryEditBoundary, workspace: runtime.active,
    documentRef: overlay.ownerDocument,
    onExport: context.onSequentialDraftEdit3dPilotEvidence,
    onFailure: context.onSequentialDraftEdit3dPilotEvidenceFailure,
  });
}
function mountDraftEdit(runtime, overlay, commandBoundary) {
  const context = runtime.context; createDraftRecoveryStorage(runtime, overlay);
  runtime.draftEdit3dController = mountSequentialScopedEdit3dController(overlay, {
    shadow: runtime.scopedEditShadow, workspace: runtime.active, commandBoundary,
    supportAdjustmentBoundary: runtime.supportAdjustmentBoundary,
    geometryEditBoundary: runtime.geometryEditBoundary,
    topologyEditBoundary: runtime.topologyEditBoundary,
    recoveryStorage: runtime.draftEditRecoveryStorage,
    recoverySavedAtProvider: exactClock(context.sequentialDraftEditRecoverySavedAtProvider),
    onRecoveryDiagnostic: (diagnostic) => reportDraftRecoveryDiagnostic(runtime, diagnostic),
    createViewer: context.createSequentialScopedEdit3dViewer,
    commandIssuedAtProvider: exactClock(context.sequentialDraftEditCommandIssuedAtProvider),
    supportAdjustmentAppliedAtProvider: exactClock(context.sequentialSupportAdjustmentAppliedAtProvider),
    geometryMoveAppliedAtProvider: exactClock(context.sequentialGeometryMoveAppliedAtProvider),
    failureFactory: context.sequentialScopedEdit3dFailureFactory,
    onActivate: () => runtime.previewController?.switchRenderer('CONSTRUCTION_SVG'),
    onFailure: context.onSequentialScopedEdit3dFailure,
  });
  mountPilot(runtime, overlay, commandBoundary);
}
function mountScoped(runtime, overlay) {
  if (!runtime.scopedEditShadow) return;
  try { mountDraftEdit(runtime, overlay, createBoundaries(runtime, overlay)); }
  catch (error) {
    runtime.pilotFeature?.destroy(); runtime.pilotFeature = null;
    runtime.draftEdit3dController?.destroy(); runtime.draftEdit3dController = null;
    runtime.draftEditRecoveryStorage?.destroy(); runtime.draftEditRecoveryStorage = null;
    runtime.topologyEditBoundary?.destroy(); runtime.topologyEditBoundary = null;
    runtime.geometryEditBoundary?.destroy(); runtime.geometryEditBoundary = null;
    runtime.supportAdjustmentBoundary?.destroy(); runtime.supportAdjustmentBoundary = null;
    runtime.draftEditPackageRuntime = null;
    try { runtime.context.onSequentialScopedEdit3dFailure?.({
      stage: 'controller mount', message: error?.message || String(error),
    }); } catch {}
  }
}
function mountSecondary(runtime, overlay) {
  runtime.previewController = mountSequentialEngineeringSvgPreviewController(overlay, {
    workspace: runtime.active,
    failureFactory: runtime.context.sequentialEngineeringSvgPreviewFailureFactory,
    onFailure: runtime.context.onSequentialEngineeringSvgPreviewFailure,
  });
  runtime.redoController = mountSequentialRedoController(overlay, runtime.active, runtime.context);
  runtime.projectExportController = mountSequentialProjectExportController(overlay, runtime.active, runtime.context);
  runtime.persistenceController = mountSequentialWorkspacePersistenceController(overlay, runtime.active, {
    ...runtime.context, draftEditPackageRuntime: runtime.draftEditPackageRuntime,
  });
  runtime.continuityController = mountSequentialContinuityController(overlay, runtime.active, runtime.context);
}
function openWorkspace(runtime) {
  if (runtime.active) return;
  const overlay = createOverlay(runtime);
  runtime.active = mountSequentialSketcherWorkspace(overlay, { ...runtime.context,
    close: () => destroyWorkspace(runtime) });
  mountShadow(runtime); mountScoped(runtime, overlay); mountSecondary(runtime, overlay);
}
export function installSequentialSketcherTile(container, context = {}) {
  ensureStylesheet(container.ownerDocument);
  if (container.querySelector('[data-ssk-open]')) return () => {};
  const runtime = { container, context, tile: createTile(container), overlay: null, active: null,
    redoController: null, projectExportController: null, persistenceController: null,
    continuityController: null, previewController: null, scopedEditShadow: null,
    supportAdjustmentBoundary: null, geometryEditBoundary: null, topologyEditBoundary: null,
    draftEditPackageRuntime: null, draftEditRecoveryStorage: null,
    draftEdit3dController: null, pilotFeature: null, open: null };
  runtime.open = () => openWorkspace(runtime); runtime.tile.addEventListener('click', runtime.open);
  return () => destroyWorkspace(runtime, true);
}
export { mountSequentialSketcherWorkspace };
