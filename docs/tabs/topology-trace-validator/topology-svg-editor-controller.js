/** Coordinates a support-only SVG draft without mutating loaded evidence. */
import { cleanText } from './topology-validator-values.js';
import { TOPOLOGY_SVG_HEIGHT, TOPOLOGY_SVG_PADDING, TOPOLOGY_SVG_WIDTH, createTopologyWorldTransform, projectTopologyPoint } from './topology-svg-projections.js';
import { TopologySvgEditorModel } from './topology-svg-editor-model.js';
import { TopologySvgEditorHistory, moveTopologySupportCommand } from './topology-svg-editor-history.js';
import { applyTopologySvgEditorDraft } from './topology-svg-editor-view-model.js';
import { buildTopologySvgEditorHandles, clientToTopologySvg, solveTopologyEditorAxisDrag, topologyEditorAxisVector } from './topology-svg-editor-overlay.js';

const MODES = Object.freeze(['review', 'edit']);
const coordinates = Object.freeze(['x', 'y', 'z']);
const fmt = (value) => Number(value).toFixed(3).replace(/\.?0+$/, '');

export function createTopologySvgEditorController(traceController, elements) {
  let mode = 'review', model = null, selectedKey = '', svg = null, viewModel = null, drag = null;
  const history = new TopologySvgEditorHistory(100), cleanups = [];
  const listen = (target, type, handler) => { if (!target) return; target.addEventListener(type, handler); cleanups.push(() => target.removeEventListener(type, handler)); };

  function ensureModel(baseViewModel) {
    if (!model && baseViewModel) model = new TopologySvgEditorModel(baseViewModel, traceController.evidence().hashes);
    return model;
  }

  function adapt(baseViewModel) {
    ensureModel(baseViewModel);
    return applyTopologySvgEditorDraft(baseViewModel, model, mode === 'edit');
  }

  function selectedEntity() { return model?.entity(selectedKey) ?? null; }
  function transform() { return viewModel ? createTopologyWorldTransform(viewModel.bounds, TOPOLOGY_SVG_WIDTH, TOPOLOGY_SVG_HEIGHT, TOPOLOGY_SVG_PADDING) : null; }

  function renderHandles() {
    svg?.querySelector('[data-ttv-editor-layer="handles"]')?.remove();
    if (mode !== 'edit' || !svg || !viewModel) return;
    const entity = selectedEntity(), worldToSvg = transform();
    if (!entity || !worldToSvg) return;
    const target = svg.querySelector('.ttv-svg-content');
    target?.insertAdjacentHTML('beforeend', buildTopologySvgEditorHandles(entity, viewModel.projection, worldToSvg));
    svg.querySelectorAll('[data-ttv-editor-axis]').forEach((handle) => listenHandle(handle));
  }

  function markDirty() {
    if (!svg || !model) return;
    for (const entity of model.dirtyEntities()) {
      svg.querySelectorAll(`[data-object-key="${CSS.escape(entity.objectKey)}"]`).forEach((node) => node.classList.add('is-editor-dirty'));
    }
  }

  function afterRender(payload) {
    svg = payload.svg; viewModel = payload.viewModel;
    renderHandles(); markDirty(); updatePanel();
  }

  function onSelection(_selection, objectKey) {
    const key = cleanText(objectKey);
    selectedKey = model?.entity(key) ? key : '';
    renderHandles(); updatePanel();
  }

  function setMode(nextMode) {
    if (!MODES.includes(nextMode)) throw new RangeError(`Unknown topology editor mode: ${nextMode}`);
    mode = nextMode;
    if (mode === 'edit') {
      ensureModel(traceController.evidence().viewModel);
      const overlays = elements.root.querySelector('[data-ttv-component-symbols]');
      const supportType = elements.root.querySelector('[data-ttv-type="SUPPORT"]');
      if (overlays) overlays.checked = true;
      if (supportType) supportType.checked = true;
      elements.root.querySelectorAll('[data-ttv-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.ttvMode === 'spatial'));
      syncModeButtons();
      traceController.setMode('spatial');
      traceController.setFilters({
        showComponentSymbols: true,
        types: [...elements.root.querySelectorAll('[data-ttv-type]:checked')].map((input) => input.dataset.ttvType),
      });
    } else {
      syncModeButtons(); traceController.render();
    }
    updatePanel();
  }

  function coordinateValues() {
    return Object.fromEntries(coordinates.map((axis) => [axis, Number(elements.panel.querySelector(`[data-ttv-editor-coordinate="${axis}"]`)?.value)]));
  }

  function setCoordinates() {
    const entity = selectedEntity(), point = coordinateValues();
    if (!entity || coordinates.some((axis) => !Number.isFinite(point[axis]))) return setPanelStatus('Select a support and enter finite X, Y and Z values.', 'error');
    history.execute(moveTopologySupportCommand(model, entity.objectKey, point));
    traceController.assertNoMutation(); traceController.render(); setPanelStatus('Support position committed to the draft.', 'ready');
  }

  function undo() { if (history.undo()) { traceController.assertNoMutation(); traceController.render(); } }
  function redo() { if (history.redo()) { traceController.assertNoMutation(); traceController.render(); } }
  function revert() {
    if (!model) return;
    model.revert(); history.clear(); traceController.assertNoMutation(); traceController.render(); setPanelStatus('Draft reverted to loaded evidence.', 'ready');
  }

  function exportPatch() {
    if (!model) return;
    const patch = model.patch(), blob = new Blob([`${JSON.stringify(patch, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = elements.root.ownerDocument.createElement('a');
    link.href = url; link.download = 'topology-edit-patch.json'; elements.root.ownerDocument.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    setPanelStatus(`${patch.operationCount} draft operation(s) exported.`, 'ready');
  }

  function updatePanel(positionOverride = null) {
    const entity = selectedEntity(), position = positionOverride ?? entity?.position;
    elements.panel.hidden = mode !== 'edit';
    elements.root.querySelectorAll('[data-ttv-editor-dirty]').forEach((node) => { node.textContent = model?.isDirty ? `${model.dirtyCount} pending` : 'Clean'; });
    elements.panel.querySelector('[data-ttv-editor-selection]').textContent = entity ? `${entity.name || 'SUPPORT'} · ${entity.sourceEntityId || entity.objectKey}` : 'Select a support symbol';
    for (const axis of coordinates) {
      const input = elements.panel.querySelector(`[data-ttv-editor-coordinate="${axis}"]`);
      input.disabled = !entity; input.value = position ? fmt(position[axis]) : '';
    }
    elements.panel.querySelector('[data-ttv-editor-set]').disabled = !entity;
    elements.panel.querySelector('[data-ttv-editor-undo]').disabled = !history.canUndo;
    elements.panel.querySelector('[data-ttv-editor-redo]').disabled = !history.canRedo;
    elements.panel.querySelector('[data-ttv-editor-revert]').disabled = !model?.isDirty;
    elements.panel.querySelector('[data-ttv-editor-export]').disabled = !model?.isDirty;
  }

  function syncModeButtons() {
    elements.root.querySelectorAll('[data-ttv-editor-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.ttvEditorMode === mode));
  }

  function setPanelStatus(message, kind) {
    const status = elements.panel.querySelector('[data-ttv-editor-status]'); status.textContent = message; status.dataset.status = kind;
  }

  function listenHandle(handle) {
    const onDown = (event) => beginDrag(event, handle);
    handle.addEventListener('pointerdown', onDown);
  }

  function beginDrag(event, handle) {
    if (mode !== 'edit' || event.button !== 0 || !viewModel) return;
    const entity = selectedEntity(), axis = handle.dataset.ttvEditorAxis, worldToSvg = transform();
    const vector = entity && worldToSvg ? topologyEditorAxisVector(viewModel.projection, axis, worldToSvg) : null;
    if (!entity || !vector) return;
    event.preventDefault(); event.stopPropagation(); handle.setPointerCapture(event.pointerId);
    drag = { pointerId: event.pointerId, axis, objectKey: entity.objectKey, start: clientToTopologySvg(svg, event.clientX, event.clientY),
      startPosition: { ...entity.position }, previewPosition: { ...entity.position }, vector, handle };
    const onMove = (moveEvent) => moveDrag(moveEvent), onEnd = (endEvent) => endDrag(endEvent, true), onCancel = (cancelEvent) => endDrag(cancelEvent, false);
    handle.addEventListener('pointermove', onMove); handle.addEventListener('pointerup', onEnd, { once: true }); handle.addEventListener('pointercancel', onCancel, { once: true });
    drag.cleanup = () => { handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onEnd); handle.removeEventListener('pointercancel', onCancel); };
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const current = clientToTopologySvg(svg, event.clientX, event.clientY), delta = solveTopologyEditorAxisDrag(drag.start, current, drag.vector);
    drag.previewPosition = { ...drag.startPosition, [drag.axis]: drag.startPosition[drag.axis] + delta };
    const worldToSvg = transform(), projected = projectTopologyPoint(drag.previewPosition, viewModel.projection), point = projected && worldToSvg ? worldToSvg(projected) : null;
    if (point) {
      svg.querySelectorAll(`.ttv-component-support[data-object-key="${CSS.escape(drag.objectKey)}"]`).forEach((node) => node.setAttribute('transform', `translate(${point.x} ${point.y}) rotate(0)`));
      const startProjected = projectTopologyPoint(drag.startPosition, viewModel.projection), startPoint = startProjected ? worldToSvg(startProjected) : null;
      if (startPoint) svg.querySelector('[data-ttv-editor-layer="handles"]')?.setAttribute('transform', `translate(${point.x - startPoint.x} ${point.y - startPoint.y})`);
    }
    updatePanel(drag.previewPosition); setPanelStatus(`${drag.axis.toUpperCase()} ${fmt(drag.previewPosition[drag.axis])}`, 'dragging');
  }

  function endDrag(event, commit) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault(); event.stopPropagation(); drag.cleanup?.();
    if (drag.handle.hasPointerCapture(event.pointerId)) drag.handle.releasePointerCapture(event.pointerId);
    const final = drag.previewPosition, start = drag.startPosition, objectKey = drag.objectKey;
    drag = null;
    if (commit && coordinates.some((axis) => Math.abs(final[axis] - start[axis]) > 1e-9)) history.execute(moveTopologySupportCommand(model, objectKey, final));
    traceController.assertNoMutation(); traceController.render(); setPanelStatus(commit ? 'Axis drag committed to the draft.' : 'Axis drag cancelled.', 'ready');
  }

  function cancelDrag() { if (drag) endDrag({ pointerId: drag.pointerId, preventDefault() {}, stopPropagation() {} }, false); }

  function reset() {
    cancelDrag(); mode = 'review'; model = null; selectedKey = ''; history.clear(); syncModeButtons(); updatePanel();
  }

  function evidence() { return Object.freeze({ mode, selectedKey, dragging: Boolean(drag), history: { canUndo: history.canUndo, canRedo: history.canRedo }, draft: model?.evidence() ?? null }); }
  function destroy() { cancelDrag(); cleanups.forEach((cleanup) => cleanup()); traceController.setViewModelAdapter(null); traceController.setRenderObserver(null); traceController.setSelectionObserver(null); }

  traceController.setViewModelAdapter(adapt); traceController.setRenderObserver(afterRender); traceController.setSelectionObserver(onSelection);
  elements.root.querySelectorAll('[data-ttv-editor-mode]').forEach((button) => listen(button, 'click', () => setMode(button.dataset.ttvEditorMode)));
  listen(elements.panel.querySelector('[data-ttv-editor-set]'), 'click', setCoordinates);
  listen(elements.panel.querySelector('[data-ttv-editor-undo]'), 'click', undo); listen(elements.panel.querySelector('[data-ttv-editor-redo]'), 'click', redo);
  listen(elements.panel.querySelector('[data-ttv-editor-revert]'), 'click', revert); listen(elements.panel.querySelector('[data-ttv-editor-export]'), 'click', exportPatch);
  listen(elements.root.ownerDocument, 'keydown', (event) => { if (event.key === 'Escape' && drag) { event.preventDefault(); cancelDrag(); } });
  history.addEventListener('historyChanged', () => updatePanel()); syncModeButtons(); updatePanel();
  return Object.freeze({ setMode, reset, undo, redo, revert, exportPatch, evidence, destroy, adapt, afterRender, onSelection });
}
