/** Visible renderer-state evidence for the active Revision Compare WebGL scene. */
import { cleanText, deepFreeze } from './revision-contract-utils.js';
import { REVISION_VIEWER_RESPONSIVENESS_CSS } from './revision-viewer-responsiveness.js';

const REVISION_VIEWER_SCENE_STATUS_SCHEMA = 'RevisionViewerSceneStatus.v1';
export const REVISION_VIEWER_SCENE_REFRESH_MS = 250;
export const REVISION_VIEWER_SCENE_PENDING_LIMIT_MS = 15000;
export const REVISION_VIEWER_SCENE_STATUS_CSS = `
.revc-view-column{grid-template-rows:auto auto auto minmax(0,1fr)}
.revc-scene-status{display:grid;gap:7px;padding:8px 10px;border-bottom:1px solid #203550;background:#071421}
.revc-scene-status>header{display:flex;align-items:center;justify-content:space-between;gap:10px}
.revc-scene-status>header>div{display:flex;align-items:center;gap:7px;min-width:0}.revc-scene-status>header span:first-child{color:#5eead4;font:700 10px/1.2 ui-monospace,monospace;letter-spacing:.08em}.revc-scene-status>header b{font-size:11px;color:#dbeafe}.revc-scene-status>header strong{font:700 10px/1.2 ui-monospace,monospace;color:#93a9bf}
.revc-info-icon{display:inline-grid;place-items:center;width:17px;height:17px;border:1px solid #35587b;border-radius:50%;color:#7dd3fc;cursor:help;font-size:11px}
.revc-scene-status dl{margin:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#203550}.revc-scene-status dl div{min-width:0;padding:6px 7px;background:#0b1d2e}.revc-scene-status dt{font-size:8px;text-transform:uppercase;color:#7893ac}.revc-scene-status dd{margin:2px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#d6e4f2;font:10px/1.3 ui-monospace,monospace}
.revc-scene-status p{margin:0;color:#9fb4c9;font-size:10px}.revc-scene-status [data-status=ready]{color:#5eead4}.revc-scene-status [data-status=pending],.revc-scene-status [data-status=starting],.revc-scene-status [data-status=timeout]{color:#fbbf24}.revc-scene-status [data-status=blocked],.revc-scene-status [data-status=failed]{color:#fb7185}
@media(max-width:980px){.revc-scene-status dl{grid-template-columns:repeat(2,minmax(0,1fr))}}
${REVISION_VIEWER_RESPONSIVENESS_CSS}`;

const RENDERER_EVIDENCE_NOTE = 'Renderer evidence only. Counts, picks, and runtime revision do not alter source, engineering, topology, comparison, or export authority. Status refreshes every 250 ms while WebGL review is active.';

function nonNegativeInteger(value) {
  return Math.max(0, Math.trunc(Number(value) || 0));
}
function drawableCount(model) {
  return nonNegativeInteger(model?.segments?.length) + nonNegativeInteger(model?.markers?.length);
}
function requestedBackend(evidence) {
  return cleanText(evidence?.viewerBackend || evidence?.requestedBackend).toUpperCase();
}
function activeSnapshot(evidence) {
  return evidence?.activeBackend === 'WEBGL' && evidence?.viewer && typeof evidence.viewer === 'object'
    ? evidence.viewer : null;
}
function statusCore(audit, evidence) {
  const requested = requestedBackend(evidence);
  const snapshot = activeSnapshot(evidence);
  const expected = {
    source: drawableCount(audit?.visualModels?.revA),
    target: drawableCount(audit?.visualModels?.revB),
  };
  expected.total = expected.source + expected.target;
  if (requested !== 'WEBGL') return { status: 'INACTIVE', reason: 'WEBGL_NOT_SELECTED', terminal: true, expected, snapshot };
  if (evidence?.failed) return { status: 'FAILED', reason: 'VIEWER_FAILURE', terminal: true, expected, snapshot };
  if (!evidence?.mounted || evidence?.activeBackend !== 'WEBGL' || !snapshot) {
    return { status: 'STARTING', reason: 'VIEWER_MOUNT_PENDING', terminal: false, expected, snapshot };
  }
  if (cleanText(snapshot.runtimeError)) return { status: 'FAILED', reason: 'RUNTIME_FAILURE', terminal: true, expected, snapshot };
  if (snapshot.runtimePending || snapshot.runtimeRevision == null) {
    return { status: 'PENDING', reason: 'SCENE_DERIVATION_PENDING', terminal: false, expected, snapshot };
  }
  if (!expected.total) return { status: 'BLOCKED', reason: 'NO_DRAWABLE_INPUT', terminal: true, expected, snapshot };
  if (!nonNegativeInteger(snapshot.instanceCount)) {
    return { status: 'BLOCKED', reason: 'ZERO_RENDERED_INSTANCES', terminal: true, expected, snapshot };
  }
  return { status: 'READY', reason: 'SCENE_RENDERED', terminal: false, expected, snapshot };
}
function messageFor(core, evidence) {
  const rendered = nonNegativeInteger(core.snapshot?.instanceCount);
  if (core.reason === 'WEBGL_NOT_SELECTED') return 'Select 3D (WebGL) to inspect live scene readiness.';
  if (core.reason === 'VIEWER_FAILURE') return cleanText(evidence?.error) || 'Workbench WebGL viewer failed to mount.';
  if (core.reason === 'VIEWER_MOUNT_PENDING') return 'Workbench WebGL is mounting.';
  if (core.reason === 'RUNTIME_FAILURE') return cleanText(core.snapshot?.runtimeError) || 'Workbench scene derivation failed.';
  if (core.reason === 'SCENE_DERIVATION_PENDING') return `Deriving ${core.expected.total} drawable item(s) for Workbench WebGL.`;
  if (core.reason === 'NO_DRAWABLE_INPUT') return 'The approved audit contains no drawable source or target geometry.';
  if (core.reason === 'ZERO_RENDERED_INSTANCES') return `The audit contains ${core.expected.total} drawable item(s), but Workbench reported zero rendered instances.`;
  return `Workbench rendered ${rendered} instance(s) in ${nonNegativeInteger(core.snapshot?.drawBatchCount)} draw batch(es).`;
}

export function revisionViewerSceneStatus(audit, evidence = {}) {
  const core = statusCore(audit, evidence);
  const snapshot = core.snapshot ?? {};
  return deepFreeze({
    schema: REVISION_VIEWER_SCENE_STATUS_SCHEMA,
    status: core.status,
    reason: core.reason,
    terminal: core.terminal,
    requestedBackend: requestedBackend(evidence) || 'UNKNOWN',
    activeBackend: cleanText(evidence?.activeBackend).toUpperCase() || 'NONE',
    expected: core.expected,
    rendered: {
      instances: nonNegativeInteger(snapshot.instanceCount),
      batches: nonNegativeInteger(snapshot.drawBatchCount),
      chunks: nonNegativeInteger(snapshot.sceneChunkCount),
      spatialEntries: nonNegativeInteger(snapshot.spatialEntryCount),
      runtimeRevision: snapshot.runtimeRevision ?? null,
      lod: cleanText(snapshot.lod) || '—',
    },
    selectedObjectId: cleanText(snapshot.selectedObjectId) || null,
    pickCount: nonNegativeInteger(evidence?.pickCount),
    lastPickedObjectId: cleanText(evidence?.lastPickedObjectId) || null,
    message: messageFor(core, evidence),
    authorityNote: RENDERER_EVIDENCE_NOTE,
  });
}

export function timedOutRevisionViewerSceneStatus(model, elapsedMs) {
  if (!model || !['STARTING', 'PENDING'].includes(model.status)) return model;
  const seconds = Math.max(1, Math.ceil(nonNegativeInteger(elapsedMs) / 1000));
  return deepFreeze({
    ...model,
    status: 'TIMEOUT',
    reason: 'SCENE_READINESS_TIMEOUT',
    terminal: false,
    message: `Workbench scene readiness has not completed after ${seconds} seconds. Monitoring remains active.`,
  });
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}
function fact(label, value, attribute) {
  return `<div><dt>${escapeHtml(label)}</dt><dd ${attribute}>${escapeHtml(value)}</dd></div>`;
}
export function revisionViewerSceneStatusMarkup(model) {
  return `<section class="revc-scene-status" data-revc-scene-status data-status="${escapeHtml(model.status.toLowerCase())}"><header><div><span>WEBGL SCENE</span><b>Live renderer readiness</b><span class="revc-info-icon" tabindex="0" role="img" aria-label="Renderer evidence boundary" title="${escapeHtml(model.authorityNote)}">ⓘ</span></div><strong data-revc-scene-state data-status="${escapeHtml(model.status.toLowerCase())}">${escapeHtml(model.status)}</strong></header><dl>${fact('Rev A drawables', model.expected.source, 'data-revc-scene-source')}${fact('Rev B drawables', model.expected.target, 'data-revc-scene-target')}${fact('Rendered instances', model.rendered.instances, 'data-revc-scene-instances')}${fact('Draw batches', model.rendered.batches, 'data-revc-scene-batches')}${fact('Runtime revision', model.rendered.runtimeRevision ?? '—', 'data-revc-scene-runtime')}${fact('Selected object', model.selectedObjectId ?? 'None', 'data-revc-scene-selection')}${fact('Pick events', model.pickCount, 'data-revc-scene-picks')}${fact('Last picked object', model.lastPickedObjectId ?? 'None', 'data-revc-scene-last-pick')}</dl><p data-revc-scene-message>${escapeHtml(model.message)}</p></section>`;
}
