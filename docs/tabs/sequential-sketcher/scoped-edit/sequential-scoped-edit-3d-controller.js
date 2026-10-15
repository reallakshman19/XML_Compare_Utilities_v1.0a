/** Sequential Draft Edit 3D view with supervised geometry and topology edits. */
import { createSequentialScopedEditVisualModel } from './sequential-scoped-edit-visual-model.js';
import { createSequentialDraftEditCommandGateway } from './sequential-draft-edit-command-gateway.js';
import { createSequentialDraftEditCommandPanel } from './sequential-draft-edit-command-panel.js';
import { createSequentialDraftEditSupportMoveFeature } from './sequential-draft-edit-support-move-feature.js';
import { createSequentialComponentEditOperations } from './sequential-component-edit-operations.js';
import { createSequentialDraftEditRecoveryController } from './sequential-draft-edit-recovery-controller.js';
import { createSequentialTopologyEditHistoryPanel } from './sequential-topology-edit-history-panel.js';
import { selectSequentialDraftEditCandidateTarget } from './sequential-draft-edit-target-selection.js';
import { createSequentialDraftEditDecisionTarget } from './sequential-draft-edit-decision-target.js';
import { selectSequentialDraftEditReversalTarget } from './sequential-draft-edit-reversal-target.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';
import { classifySequentialDraftEdit3dAvailability, sequentialDraftEdit3dActiveMessage } from './sequential-scoped-edit-3d-availability.js';
export const SEQUENTIAL_SCOPED_EDIT_3D_CONTROLLER_V1 = 'SequentialScopedEdit3dController.v1';
export const SEQUENTIAL_SCOPED_EDIT_3D_RENDERER = 'DRAFT_EDIT_3D';
const CONTROLLERS = new WeakMap();
const VIEW_BY_PROJECTION = Object.freeze({ ISO: 'iso', XY: 'top', XZ: 'front', YZ: 'side' });
function requiredFunction(value, label) { if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`); return value; }
function requiredMethods(value, names, label) { names.forEach((name) => requiredFunction(value?.[name], `${label}.${name}`)); return value; }
function injectFailure(factory, stage) {
  if (typeof factory !== 'function') return; const result = factory(stage);
  if (result instanceof Error) throw result; if (result) throw new Error(String(result));
}
function elements(root) {
  const find = (selector) => { const value = root.querySelector(selector);
    if (!value) throw new Error(`Sequential Draft Edit 3D element missing: ${selector}`); return value; };
  return { button: find('[data-ssk-draft-edit-3d]'), host: find('[data-ssk-draft-edit-3d-host]'),
    construction: find('[data-ssk-construction-surface]'),
    preview: find('[data-ssk-engineering-svg-preview-host]'), status: find('[data-ssk-preview-status]') };
}
function setHidden(element, hidden) { element.hidden = hidden; element.setAttribute('aria-hidden', hidden ? 'true' : 'false'); if (hidden) element.setAttribute('inert', ''); else element.removeAttribute('inert'); }
function announce(state, message, status = 'ready') { state.elements.status.textContent = message; state.elements.status.dataset.state = status; }
function set3dPressed(state, pressed) {
  state.elements.button.classList.toggle('is-active', pressed);
  state.elements.button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  if (!pressed) return;
  state.root.querySelectorAll('[data-ssk-renderer]').forEach((button) => {
    button.classList.remove('is-active'); button.setAttribute('aria-pressed', 'false');
  });
}
function setFeatureActivity(state, active) { state.commandPanel?.setActive(active);
  state.supportMove?.setActive(active); state.componentEdit?.setActive(active); state.topologyHistory?.setActive(active); }
function show3dSurface(state) { setHidden(state.elements.construction, true);
  setHidden(state.elements.preview, true); setHidden(state.elements.host, false);
  set3dPressed(state, true); setFeatureActivity(state, true); }
function hide3dSurface(state) { setFeatureActivity(state, false); setHidden(state.elements.host, true); set3dPressed(state, false); }
function available(state) { return classifySequentialDraftEdit3dAvailability(state.shadow).available; }
function syncAvailability(state) {
  const value = classifySequentialDraftEdit3dAvailability(state.shadow);
  state.elements.button.disabled = !value.available; state.elements.button.title = value.title;
  state.elements.button.dataset.sskAvailability = value.code;
  if (!value.available && state.active) { state.active = false; hide3dSurface(state);
    setHidden(state.elements.construction, false); }
  if (!state.active) announce(state, value.message, value.status); return value.available;
}
function selectedIds(readModel) { return readModel?.selectionSnapshot?.entityIds || []; }
function applyProjection(state, readModel) { const projection = readModel?.ownerSnapshot?.visibleProjection || 'ISO';
  state.viewer?.setStandardView(VIEW_BY_PROJECTION[projection] || 'iso'); }
function syncDecisionTarget(state, scene, readModel) {
  try { state.commandPanel?.setDecisionTarget(createSequentialDraftEditDecisionTarget({
    readModel, scene, currentState: state.commandBoundary.readCurrentState(),
  })); } catch { state.commandPanel?.clearDecisionTarget(); }
}
function applyScene(state) {
  injectFailure(state.options.failureFactory, 'scene-apply');
  const view = state.topologyEditBoundary.readView(); const readModel = view.readModel; const scene = view.scene;
  if (!state.shadow.host() || !readModel || !scene) throw new Error('Sequential Draft Edit 3D authority is unavailable.');
  const model = createSequentialScopedEditVisualModel({ readModel, scene, draft: state.supportMove?.getDraft(),
    moveDraft: state.componentEdit?.getMoveDraft(), nodeStretchDraft: state.componentEdit?.getStretchDraft(),
    rotationDraft: state.componentEdit?.getRotationDraft(), splitDraft: state.componentEdit?.getSplitDraft() });
  state.scene = scene; state.readModel = readModel;
  state.viewer.setVerticalAxis(scene.coordinateSystem.verticalAxis);
  state.viewer.setModels({ source: null, target: model, registrationTranslation: [0, 0, 0] });
  state.viewer.setMode('target-only');
  const ids = selectedIds(readModel); state.viewer.setSelection(ids.at(-1) || null, ids.slice(0, -1));
  const mountKey = `${state.shadow.evidence().mountKey}:${readModel.authorityId}`;
  if (state.mountKey !== mountKey) { state.mountKey = mountKey; if (scene.entities.length) state.viewer.fitAll(); }
  applyProjection(state, readModel); syncDecisionTarget(state, scene, readModel);
  state.topologyHistory?.refresh();
  announce(state, sequentialDraftEdit3dActiveMessage(scene.entities.length));
}
function selectionCategory(state, objectId) { return state.scene?.entities.find((row) => row.id === objectId)?.domainRef?.category || null; }
function clearCommandTargets(state, reason = null) { state.commandPanel?.clearCandidateTarget(); state.commandPanel?.clearReversalTarget(reason); }
function clearNonCommandTargets(state, reason = null) { state.supportMove?.clearTarget(reason); state.componentEdit?.clear(reason); }
function selectCandidatePick(state, objectId) {
  clearNonCommandTargets(state); const target = selectSequentialDraftEditCandidateTarget({
    objectId, readModel: state.readModel, scene: state.scene,
    currentState: state.commandBoundary.readCurrentState(),
  });
  state.commandPanel.setCandidateTarget(target);
  announce(state, `Candidate ${target.candidateId} selected. Pick alone does not issue a command.`);
}
function selectReversalPick(state, objectId) {
  clearNonCommandTargets(state); const target = selectSequentialDraftEditReversalTarget({
    objectId, readModel: state.readModel, scene: state.scene,
    currentState: state.commandBoundary.readCurrentState(),
  });
  state.commandPanel.setReversalTarget(target);
  announce(state, `Reversal entry ${target.entryPortId} selected for ${target.componentId}.`);
}
function selectSupportPick(state, objectId) {
  clearCommandTargets(state, 'Construction command target cleared for support adjustment.');
  state.componentEdit?.clear(); const target = state.supportMove.select(objectId);
  announce(state, `Support ${target.supportId} selected. Review exact XYZ before Apply.`);
}
function componentPickNotice(result) {
  if (result.mode === 'STRETCH_NODE') return `Stretch node mode · ${result.target.nodes.length} qualified node(s) for ${result.target.canonicalType} ${result.target.componentId}.`;
  if (result.mode === 'ROTATE_SUBGRAPH') return `Rotate mode · ${result.target.scope} · ${result.target.affectedComponentIds.length} component(s) · ${result.target.boundaryCuts.length} boundary cut(s).`;
  if (result.mode === 'SPLIT_PIPE') return `Split pipe · ${result.target.parentComponentId} · exact interior location required.`;
  return `${result.target.canonicalType} ${result.target.componentId} selected. Preview, prepare and apply only when topology-preserving.`;
}
function selectComponentPick(state, objectId) {
  clearCommandTargets(state, 'Construction command target cleared for component edit.');
  state.supportMove?.clearTarget(); const result = state.componentEdit.select(objectId);
  announce(state, componentPickNotice(result));
}
function clearAllTargets(state, reason = null) { clearCommandTargets(state, reason); clearNonCommandTargets(state, reason); }
function selectPick(state, objectId) {
  state.viewer?.setSelection(objectId, []);
  if (!objectId) { clearAllTargets(state); return; }
  try {
    const category = selectionCategory(state, objectId);
    if (category === 'candidate') selectCandidatePick(state, objectId);
    else if (category === 'reversalCandidate') selectReversalPick(state, objectId);
    else if (category === 'support') selectSupportPick(state, objectId);
    else if (category === 'confirmed') selectComponentPick(state, objectId);
    else throw new RangeError('Selected scene entity is not an authoritative Draft Edit target.');
  } catch (error) {
    clearAllTargets(state, `Selection ${objectId} is non-authoritative: ${error.code || error.message}.`);
    announce(state, `Draft Edit 3D selected ${objectId}. No authoritative target was established.`);
  }
}
function viewerOptions(state) { return { navigationPreset: 'CAD_EDIT',
  onPick: (pick) => selectPick(state, pick?.objectId || null),
  onRuntimeError: (error) => containFailure(state, error, 'viewer runtime'),
  onNavigationError: (error) => containFailure(state, error, 'navigation') }; }
async function createViewer(state, canvas) {
  injectFailure(state.options.failureFactory, 'viewer-mount');
  if (typeof state.options.createViewer === 'function') return state.options.createViewer(canvas, viewerOptions(state));
  const { createWorkbenchViewer } = await import('../../../workbench3d/viewer/workbench-viewer.js?v=20260728-ssk-ts-3i');
  return createWorkbenchViewer(canvas, viewerOptions(state));
}
async function ensureViewer(state) {
  if (state.viewer) return state.viewer; if (state.pending) return state.pending;
  state.elements.host.innerHTML = '<div data-ssk-draft-edit-3d-canvas style="position:absolute;inset:0"></div>';
  const canvas = state.elements.host.querySelector('[data-ssk-draft-edit-3d-canvas]');
  state.pending = createViewer(state, canvas).then((viewer) => { state.viewer = viewer; return viewer; })
    .finally(() => { state.pending = null; });
  return state.pending;
}
function containFailure(state, error, stage) {
  const message = error?.message || String(error); state.failureCount += 1; state.active = false;
  hide3dSurface(state); setHidden(state.elements.construction, false);
  announce(state, `Draft Edit 3D failed during ${stage}: ${message}. Construction SVG retained.`, 'error');
  try { state.options.onFailure?.({ stage, message }); } catch {} return false;
}
async function show3d(state) {
  if (state.destroyed || !syncAvailability(state)) return false;
  try {
    await ensureViewer(state); if (state.destroyed) return false;
    try { state.options.onActivate?.(); } catch {}
    state.active = true; show3dSurface(state); applyScene(state); state.recovery?.refresh(); return true;
  } catch (error) { return containFailure(state, error, 'view mount'); }
}
function scheduleRefresh(state) {
  queueMicrotask(() => {
    if (state.destroyed) return;
    state.commandPanel?.refresh({ invalidatePending: true, invalidateTarget: true,
      reason: 'Prepared command and targets invalidated because owner authority changed.' });
    state.supportMove?.invalidate('Support adjustment invalidated because owner authority changed.');
    state.componentEdit?.invalidate('Component edit invalidated because owner authority changed.');
    state.topologyHistory?.refresh(); syncAvailability(state); if (!state.active) return;
    try { applyScene(state); state.recovery?.refresh(); }
    catch (error) { containFailure(state, error, 'owner refresh'); }
  });
}
function handleClick(state, event) {
  if (event.target?.closest?.('[data-ssk-draft-edit-3d]')) {
    event.preventDefault(); event.stopImmediatePropagation(); show3d(state); return;
  }
  if (event.target?.closest?.('[data-ssk-renderer]') && state.active) {
    state.active = false; hide3dSurface(state);
  }
}
function destroyFeature(value) { try { value?.destroy(); } catch {} }
function destroy(state) { if (state.destroyed) return false;
  state.destroyed = true; state.root.removeEventListener('click', state.onClick, true); try { state.unsubscribe?.(); } catch {}
  [state.recovery, state.topologyHistory, state.componentEdit, state.supportMove,
    state.commandPanel, state.gateway].forEach(destroyFeature);
  try { state.viewer?.dispose(); } catch {} state.viewer = null; state.scene = null; state.readModel = null;
  state.elements.host.innerHTML = ''; CONTROLLERS.delete(state.root); return true; }
function draftRefresh(state) { if (state.active && state.viewer && state.scene && state.readModel) applyScene(state); }
function authorityEvidence(value) {
  return Object.freeze({ authorityId: value.authorityId, sourceFingerprint: value.sourceFingerprint,
    branchId: value.branchId, branchSetFingerprint: value.branchSetFingerprint,
    journalHeadFingerprint: value.journalHeadFingerprint,
    confirmedConstructionFingerprint: value.confirmedConstructionFingerprint,
    supportProjectionFingerprint: value.supportProjectionFingerprint,
    ownerRevisionFingerprint: value.ownerRevisionFingerprint });
}
function recoveryContext(state, kind) {
  const support = kind === 'MOVE_SUPPORT_SAME_CARRIER';
  const boundary = support ? state.supportAdjustmentBoundary : state.geometryEditBoundary;
  const current = boundary.readCurrentState(); const history = boundary.readHistory();
  if (!history?.historyFingerprint) throw new RangeError('Pending draft recovery requires current history authority.');
  return Object.freeze({ authority: authorityEvidence(deriveSequentialEditAuthority(current)),
    editBaseFingerprint: history.historyFingerprint });
}
function installRecovery(state) {
  if (!state.options.recoveryStorage) return null;
  return createSequentialDraftEditRecoveryController({ root: state.root,
    storage: state.options.recoveryStorage, readContext: (kind) => recoveryContext(state, kind),
    now: state.options.recoverySavedAtProvider || state.options.commandIssuedAtProvider,
    beforeRestore: async () => {
      if (state.active) return true;
      const opened = await show3d(state);
      if (!opened) throw new Error('Draft Edit 3D could not be opened for pending-draft recovery.');
      return true;
    },
    restoreHandlers: {
      MOVE_COMPONENT: (record) => state.componentEdit.restoreRecovery(record),
      STRETCH_NODE: (record) => state.componentEdit.restoreRecovery(record),
      ROTATE_SUBGRAPH: (record) => state.componentEdit.restoreRecovery(record),
      MOVE_SUPPORT_SAME_CARRIER: (record) => state.supportMove.restoreRecovery(record),
    }, onDiagnostic: state.options.onRecoveryDiagnostic });
}
function installFeatures(state) {
  try {
    state.commandPanel = createSequentialDraftEditCommandPanel({ root: state.root, gateway: state.gateway,
      readCurrentState: state.commandBoundary.readCurrentState,
      readCurrentAuthorityId: () => deriveSequentialEditAuthority(state.commandBoundary.readCurrentState()).authorityId,
      now: state.options.commandIssuedAtProvider,
      onAccepted: state.options.onCommandAccepted, onFailure: state.options.onCommandFailure });
    state.supportMove = createSequentialDraftEditSupportMoveFeature({ root: state.root,
      readScene: () => state.scene, readModel: () => state.readModel,
      supportAdjustmentBoundary: state.supportAdjustmentBoundary,
      now: state.options.supportAdjustmentAppliedAtProvider || state.options.commandIssuedAtProvider,
      onDraftChanged: () => draftRefresh(state),
      onRecoveryDraft: (descriptor) => state.recovery?.capture('MOVE_SUPPORT_SAME_CARRIER', descriptor),
      onRecoveryClear: (reason) => state.recovery?.clear('MOVE_SUPPORT_SAME_CARRIER', reason) });
    state.componentEdit = createSequentialComponentEditOperations({ root: state.root,
      readScene: () => state.scene, readModel: () => state.readModel, readViewer: () => state.viewer,
      onDraftChanged: () => draftRefresh(state), geometryEditBoundary: state.geometryEditBoundary,
      topologyEditBoundary: state.topologyEditBoundary,
      applicationNow: state.options.geometryMoveAppliedAtProvider || state.options.commandIssuedAtProvider,
      onTopologyAccepted: () => scheduleRefresh(state),
      onModeChanged: (mode) => announce(state, `Component operation mode: ${mode}.`),
      onRecoveryDraft: (kind, descriptor) => state.recovery?.capture(kind, descriptor),
      onRecoveryClear: (kind, reason) => state.recovery?.clear(kind, reason) });
    state.topologyHistory = createSequentialTopologyEditHistoryPanel({ root: state.root,
      boundary: state.topologyEditBoundary, onChanged: () => scheduleRefresh(state) });
    state.recovery = installRecovery(state); state.recovery?.refresh();
    state.onClick = (event) => handleClick(state, event);
    state.unsubscribe = state.workspace.subscribeEngineeringSvgOwnerState(() => scheduleRefresh(state));
    if (typeof state.unsubscribe !== 'function') throw new TypeError('Sequential owner subscription must return an unsubscribe function.');
    state.root.addEventListener('click', state.onClick, true);
  } catch (error) {
    try { state.unsubscribe?.(); } catch {}
    [state.recovery, state.topologyHistory, state.componentEdit, state.supportMove,
      state.commandPanel, state.gateway].forEach(destroyFeature);
    throw error;
  }
}
export function getSequentialScopedEdit3dController(root) { return CONTROLLERS.get(root) || null; }
export function mountSequentialScopedEdit3dController(root, options = {}) {
  if (!root?.querySelector) throw new TypeError('Sequential Draft Edit 3D controller requires a root.');
  const existing = CONTROLLERS.get(root); if (existing) return existing;
  const commandBoundary = requiredMethods(options.commandBoundary,
    ['readCurrentState', 'publishCandidate'], 'commandBoundary');
  const supportAdjustmentBoundary = requiredMethods(options.supportAdjustmentBoundary,
    ['readCurrentState', 'readView', 'readHistory', 'publishCandidate'], 'supportAdjustmentBoundary');
  const geometryEditBoundary = requiredMethods(options.geometryEditBoundary,
    ['readCurrentState', 'readView', 'readHistory', 'readJournal', 'publishCandidate'], 'geometryEditBoundary');
  const topologyEditBoundary = requiredMethods(options.topologyEditBoundary,
    ['readCurrentState', 'readView', 'readJournal', 'publishCandidate', 'undo', 'redo'],
    'topologyEditBoundary');
  const shadow = requiredMethods(options.shadow, ['host', 'readModel', 'evidence'], 'shadow');
  const workspace = requiredMethods(options.workspace, ['subscribeEngineeringSvgOwnerState'], 'workspace');
  const gateway = createSequentialDraftEditCommandGateway({
    readCurrentState: commandBoundary.readCurrentState, publishCandidate: commandBoundary.publishCandidate });
  const state = { root, options, gateway, commandBoundary, supportAdjustmentBoundary,
    geometryEditBoundary, topologyEditBoundary, shadow, workspace, elements: elements(root),
    viewer: null, pending: null, scene: null, readModel: null, mountKey: '', active: false, destroyed: false,
    failureCount: 0, unsubscribe: null, commandPanel: null, supportMove: null, componentEdit: null,
    topologyHistory: null, recovery: null };
  installFeatures(state); syncAvailability(state);
  const controller = Object.freeze({ schema: SEQUENTIAL_SCOPED_EDIT_3D_CONTROLLER_V1,
    show: () => show3d(state), refresh: () => { scheduleRefresh(state); return true; },
    getCommandGatewayState: gateway.getState, getCommandPanelState: state.commandPanel.getState,
    prepareCommand: gateway.prepare, acceptCommand: gateway.accept, executeCommand: gateway.execute,
    getState: () => Object.freeze({ active: state.active, available: available(state),
      availability: classifySequentialDraftEdit3dAvailability(state.shadow), mounted: Boolean(state.viewer),
      mountKey: state.mountKey, failureCount: state.failureCount, destroyed: state.destroyed,
      commandGateway: gateway.getState(), commandPanel: state.commandPanel.getState(),
      supportMove: state.supportMove.getState(), componentEdit: state.componentEdit.getState(),
      topologyHistory: state.topologyHistory.getState(), recovery: state.recovery?.getState() || null,
      supportAdjustmentBoundary: supportAdjustmentBoundary.getState?.() || null,
      geometryEditBoundary: geometryEditBoundary.getState?.() || null,
      topologyEditBoundary: topologyEditBoundary.getState?.() || null,
      viewerState: state.viewer?.getStateSnapshot?.() ?? null }),
    destroy: () => destroy(state) }); CONTROLLERS.set(root, controller); return controller; }
