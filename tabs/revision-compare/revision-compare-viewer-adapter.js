/** Sole Revision Compare bridge to interchangeable read-only viewer backends. */
import { createEngineeringViewerController } from '../../core/engineering-viewer/index.js';
import { createWorkbenchViewer } from '../../workbench3d/viewer/workbench-viewer.js';
import { createRevisionCompareEngineeringSvgViewer } from './revision-compare-engineering-svg-viewer.js';
import { deepFreeze } from './revision-contract-utils.js';
import { normalizeRevisionCompareViewerBackend } from './revision-compare-viewer-backend.js';
import { createRevisionCompareViewerFactory } from './revision-compare-viewer-contract.js';
import {
  REVISION_COMPARE_DEFAULT_VIEWER_POLICY,
  createRevisionCompareViewerPolicy,
} from './revision-compare-viewer-policy.js';

function defaultClock() { return globalThis.performance?.now?.() ?? Date.now(); }
function clockFunction(value) {
  const result = value ?? defaultClock;
  if (typeof result !== 'function') throw new TypeError('Revision Compare viewer clock must be a function.');
  return result;
}
function indexAudit(context, audit) {
  context.differenceByObjectId = new Map();
  context.rowByDifferenceId = new Map();
  for (const row of audit?.differenceRows ?? []) {
    context.rowByDifferenceId.set(row.differenceId, row);
    if (row.visualRefs.sourceObjectId) context.differenceByObjectId.set(row.visualRefs.sourceObjectId, row.differenceId);
    if (row.visualRefs.targetObjectId) context.differenceByObjectId.set(row.visualRefs.targetObjectId, row.differenceId);
  }
}
function rowById(context, id) { return context.rowByDifferenceId.get(id) ?? null; }
function relatedObjectIds(row) { return [row?.visualRefs?.sourceObjectId, row?.visualRefs?.targetObjectId].filter(Boolean); }
function previewObjectIds(context) {
  if (!context.previewSourceDifferenceId || context.previewSourceDifferenceId !== context.selectedDifferenceId) return null;
  const source = rowById(context, context.previewSourceDifferenceId);
  const target = rowById(context, context.previewTargetDifferenceId);
  return [source?.visualRefs?.sourceObjectId, target?.visualRefs?.targetObjectId].filter(Boolean);
}
function picked(context, pick) {
  context.pickCount += 1;
  context.lastPickedObjectId = pick?.objectId ?? null;
  context.lastPickedDifferenceId = pick?.objectId ? context.differenceByObjectId.get(pick.objectId) ?? null : null;
  context.options.onPick?.(context.lastPickedDifferenceId);
}
function jsonCopy(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
}
function safeSnapshot(viewer) { return jsonCopy(viewer?.getStateSnapshot?.() ?? null); }
function auditIdentity(audit) { return audit?.auditId ?? audit?.basisId ?? null; }
function resetPickEvidence(context) {
  context.pickCount = 0;
  context.lastPickedObjectId = null;
  context.lastPickedDifferenceId = null;
}
function resetResponsivenessEvidence(context) {
  context.fitSelectedCount = 0;
  context.lastFitSelectedMs = null;
  context.maxFitSelectedMs = null;
  context.lastFitSelectedDifferenceId = null;
}
function resetInteractionEvidence(context) {
  resetPickEvidence(context);
  resetResponsivenessEvidence(context);
}
function finiteElapsed(startedAt, completedAt) {
  const elapsed = Number(completedAt) - Number(startedAt);
  return Number.isFinite(elapsed) ? Math.max(0, elapsed) : null;
}
function fitSelected(context) {
  if (!context.selectedDifferenceId || !context.controller.evidence().mounted) return false;
  const startedAt = context.clock();
  const result = context.controller.fitSelection();
  const elapsed = finiteElapsed(startedAt, context.clock());
  context.fitSelectedCount += 1;
  context.lastFitSelectedMs = elapsed;
  if (elapsed != null) context.maxFitSelectedMs = Math.max(context.maxFitSelectedMs ?? 0, elapsed);
  context.lastFitSelectedDifferenceId = context.selectedDifferenceId;
  return result;
}
function applySelection(context) {
  const ids = previewObjectIds(context) ?? relatedObjectIds(rowById(context, context.selectedDifferenceId));
  context.controller.setSelection(ids[0] ?? null, ids.slice(1));
}
function presentation(context) {
  return Object.freeze({ audit: context.audit, mode: context.presentationMode });
}
function applyPresentation(viewer, value) {
  viewer.setModels({ source: value.audit.visualModels.revA, target: value.audit.visualModels.revB });
  viewer.setStatuses(new Map(Object.entries(value.audit.visualModels.statusByObjectId)));
  viewer.setMode(value.mode);
  viewer.setVerticalAxis(value.audit.visualModels.revA.verticalAxis);
}
async function renderViewer(context, hostElement, audit) {
  const identity = auditIdentity(audit);
  if (context.auditIdentity !== identity) resetInteractionEvidence(context);
  context.auditIdentity = identity;
  context.audit = audit;
  indexAudit(context, audit);
  context.host = hostElement;
  applySelection(context);
  return context.controller.render(hostElement, presentation(context));
}
function clearViewer(context) {
  context.controller.clear();
  Object.assign(context, {
    audit: null, auditIdentity: null, host: null, selectedDifferenceId: null,
    previewSourceDifferenceId: null, previewTargetDifferenceId: null,
  });
  resetInteractionEvidence(context);
  context.differenceByObjectId.clear();
  context.rowByDifferenceId.clear();
}
function setBackend(context, value) {
  const backend = normalizeRevisionCompareViewerBackend(value);
  if (!context.policy.retainedBackends.includes(backend)) throw new TypeError(`Viewer backend ${backend} is not retained by policy.`);
  const previous = context.controller.evidence().requestedBackend;
  const result = context.controller.setBackend(backend);
  if (previous !== backend) resetInteractionEvidence(context);
  return result;
}
function setPresentationMode(context, value) {
  context.presentationMode = value === 'side-by-side' ? 'side-by-side' : 'overlay';
  if (!context.audit || !context.host || !context.controller.evidence().mounted) return true;
  context.controller.render(context.host, presentation(context));
  return !context.controller.evidence().failed;
}
function evidence(context) {
  const lifecycle = context.controller.evidence();
  return deepFreeze({
    mounted: lifecycle.mounted, failed: lifecycle.failed, error: lifecycle.error,
    viewerBackend: lifecycle.requestedBackend, activeBackend: lifecycle.activeBackend,
    presentationMode: context.presentationMode, selectedDifferenceId: context.selectedDifferenceId,
    previewSourceDifferenceId: context.previewSourceDifferenceId, previewTargetDifferenceId: context.previewTargetDifferenceId,
    pickCount: context.pickCount, lastPickedObjectId: context.lastPickedObjectId,
    lastPickedDifferenceId: context.lastPickedDifferenceId,
    fitSelectedCount: context.fitSelectedCount, lastFitSelectedMs: context.lastFitSelectedMs,
    maxFitSelectedMs: context.maxFitSelectedMs, lastFitSelectedDifferenceId: context.lastFitSelectedDifferenceId,
    policy: context.policy, mountRequests: lifecycle.mountRequests,
    snapshots: lifecycle.snapshots, viewer: lifecycle.viewer,
  });
}

export function createRevisionCompareViewerAdapter(options = {}) {
  const webglFactory = options.webglViewerFactory ?? options.viewerFactory ?? createWorkbenchViewer;
  const policy = createRevisionCompareViewerPolicy(options.viewerPolicy ?? REVISION_COMPARE_DEFAULT_VIEWER_POLICY);
  const context = {
    options, policy, clock: clockFunction(options.clock), controller: null,
    host: null, audit: null, auditIdentity: null,
    presentationMode: policy.defaultSvgPresentation,
    selectedDifferenceId: null, previewSourceDifferenceId: null, previewTargetDifferenceId: null,
    pickCount: 0, lastPickedObjectId: null, lastPickedDifferenceId: null,
    fitSelectedCount: 0, lastFitSelectedMs: null, maxFitSelectedMs: null,
    lastFitSelectedDifferenceId: null,
    differenceByObjectId: new Map(), rowByDifferenceId: new Map(), disposed: false,
  };
  context.controller = createEngineeringViewerController({
    backendIds: policy.retainedBackends,
    initialBackend: policy.defaultBackend,
    factories: {
      WEBGL: createRevisionCompareViewerFactory(webglFactory, 'Revision Compare WebGL viewer'),
      SVG: createRevisionCompareViewerFactory(
        options.svgViewerFactory ?? createRevisionCompareEngineeringSvgViewer,
        'Revision Compare Engineering SVG viewer',
      ),
    },
    applyPresentation,
    onPick: (pick) => picked(context, pick),
    onError: options.onError ?? null,
  });
  return Object.freeze({
    render: (host, audit) => renderViewer(context, host, audit),
    setBackend: (backend) => setBackend(context, backend),
    setPresentationMode: (mode) => setPresentationMode(context, mode),
    selectDifference: (id) => {
      context.selectedDifferenceId = id ?? null;
      if (context.previewSourceDifferenceId !== context.selectedDifferenceId) {
        context.previewSourceDifferenceId = null;
        context.previewTargetDifferenceId = null;
      }
      applySelection(context);
    },
    previewPair: (sourceDifferenceId, targetDifferenceId) => {
      context.previewSourceDifferenceId = sourceDifferenceId ?? null;
      context.previewTargetDifferenceId = targetDifferenceId ?? null;
      applySelection(context);
    },
    clearPreview: () => {
      context.previewSourceDifferenceId = null;
      context.previewTargetDifferenceId = null;
      applySelection(context);
    },
    resetResponsivenessEvidence: () => {
      resetResponsivenessEvidence(context);
      return true;
    },
    fitSelected: () => fitSelected(context),
    fitAll: () => context.controller.fitAll(),
    clear: () => clearViewer(context),
    dispose: () => {
      if (context.disposed) return false;
      clearViewer(context);
      context.disposed = true;
      return context.controller.dispose();
    },
    evidence: () => evidence(context),
  });
}
export const _test = Object.freeze({ jsonCopy, previewObjectIds, relatedObjectIds, safeSnapshot });