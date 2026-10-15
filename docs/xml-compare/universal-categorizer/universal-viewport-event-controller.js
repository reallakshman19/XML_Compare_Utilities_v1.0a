import {
  normalizeWorkbenchViewportRange,
  positionWorkbenchPalette,
} from '../../core/workbench-viewport/index.js';
import {
  createUniversalViewportProjection,
  deriveUniversalViewportFilterOptions,
} from './universal-viewport-projection.js';
import { createUniversalViewportSearchIndex } from './universal-viewport-search.js';
import {
  persistUniversalViewportUiState,
  pivotViewIdentity,
  selectPivotIdentity,
  selectTreeIdentity,
  treeViewIdentity,
} from './universal-viewport-state.js';
import { createUniversalNamedViewSnapshot } from './universal-viewport-named-views.js';
import { createUniversalViewportShellModel } from './universal-viewport-shell-model.js';
import {
  renderUniversalViewportActions,
  renderUniversalViewportInspector,
} from './universal-viewport-shell-view.js';
import {
  syncUniversalFilterSelect,
  syncUniversalNamedViewSelect,
} from './universal-viewport-control-view.js';
export const UNIVERSAL_VIEWPORT_EVENT_CONTROLLER_SCHEMA = 'universal-viewport-event-controller/v1'; const freeze = (value) => Object.freeze(value), text = (value) => String(value ?? '').trim();
function activeHost(controller) { return controller.state.mode === 'pivot' ? controller.hosts.pivot : controller.hosts.tree; }
function createIndexes(viewModel) {
  return freeze({
    tree: createUniversalViewportSearchIndex(viewModel.samplePreview.tree.nodes, { surface: 'tree', identityFor: treeViewIdentity }),
    pivot: createUniversalViewportSearchIndex(viewModel.samplePreview.pivot.rows, { surface: 'pivot', identityFor: pivotViewIdentity }),
  });
}
function filterOptions(indexes) {
  return freeze({
    tree: deriveUniversalViewportFilterOptions(indexes.tree, ['level']),
    pivot: deriveUniversalViewportFilterOptions(indexes.pivot, ['level', 'block', 'source']),
  });
}
function project(controller) {
  return freeze({
    tree: createUniversalViewportProjection(controller.indexes.tree, {
      searchText: controller.state.searchText,
      filters: controller.state.treeFilters,
      dimensions: ['level'],
      selectedId: controller.state.selectedTreeId,
    }),
    pivot: createUniversalViewportProjection(controller.indexes.pivot, {
      searchText: controller.state.searchText,
      filters: controller.state.pivotFilters,
      dimensions: ['level', 'block', 'source'],
      selectedId: controller.state.selectedPivotId,
    }),
  });
}
function shellModel(controller) {
  return createUniversalViewportShellModel({
    state: controller.state,
    hosts: controller.hosts,
    context: controller.context,
    projections: controller.projections,
    filterOptions: controller.filterOptions,
    namedViews: controller.namedStore.list(),
    namedViewDiagnostics: controller.namedStore.diagnostics(),
    selectedNamedViewId: controller.selectedNamedViewId,
  });
}
function refreshChrome(controller, message = '') {
  const model = shellModel(controller);
  const popup = controller.popup;
  popup.querySelector('[data-uxc-preview-surfaces]').dataset.mode = controller.state.mode;
  popup.querySelector('[data-uxc-viewport-shell]').dataset.mode = controller.state.mode;
  popup.querySelectorAll('[data-uxc-mode]').forEach((button) => {
    const active = button.dataset.uxcMode === controller.state.mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  popup.querySelector('.uxc-viewport-toolbar').innerHTML = renderUniversalViewportActions(model);
  popup.querySelector('.uxc-viewport-inspector').outerHTML = renderUniversalViewportInspector(model);
  const search = popup.querySelector('[data-uxc-preview-search]');
  if (search && popup.ownerDocument.activeElement !== search) search.value = controller.state.searchText;
  popup.querySelector('[data-uxc-tree-count]').textContent = `${model.search.treeCount} / ${model.search.treeTotal} Tree`;
  popup.querySelector('[data-uxc-pivot-count]').textContent = `${model.search.pivotCount} / ${model.search.pivotTotal} Pivot`;
  syncUniversalFilterSelect(popup.querySelector('[data-uxc-tree-filter="level"]'), model.filters.options.tree?.level, model.filters.tree.level);
  syncUniversalFilterSelect(popup.querySelector('[data-uxc-pivot-filter="level"]'), model.filters.options.pivot?.level, model.filters.pivot.level);
  syncUniversalFilterSelect(popup.querySelector('[data-uxc-pivot-filter="block"]'), model.filters.options.pivot?.block, model.filters.pivot.block);
  syncUniversalFilterSelect(popup.querySelector('[data-uxc-pivot-filter="source"]'), model.filters.options.pivot?.source, model.filters.pivot.source);
  syncUniversalNamedViewSelect(popup.querySelector('[data-uxc-named-view-select]'), model.namedViews.items, controller.selectedNamedViewId);
  const status = popup.querySelector('[data-uxc-viewport-status]');
  status.textContent = message || [...activeHost(controller).statusSegments(), `${model.search.treeCount} Tree`, `${model.search.pivotCount} Pivot`].join(' · ');
  updateVirtualSelection(controller);
  return model;
}
function updateVirtualSelection(controller) {
  const state = controller.state;
  controller.virtualViews.tree.setSelection({
    selectedId: state.selectedTreeId,
    relatedIds: state.selectedTreeId ? [state.selectedTreeId] : [],
  });
  controller.virtualViews.pivot.setSelection({
    selectedId: state.selectedPivotId,
    relatedIds: state.selectionIndex.pivotByTree[state.selectedTreeId] || [],
  });
}
function applyProjection(controller, message = '') {
  controller.projections = project(controller);
  controller.virtualViews.tree.setProjection(controller.projections.tree.items);
  controller.virtualViews.pivot.setProjection(controller.projections.pivot.items);
  persistUniversalViewportUiState(controller.state, controller.storage);
  return refreshChrome(controller, message);
}
function revealSelection(controller, focus = false) {
  const state = controller.state;
  if (controller.projections.tree.selectedVisible && state.selectedTreeId) controller.virtualViews.tree.reveal(state.selectedTreeId, focus);
  if (controller.projections.pivot.selectedVisible && state.selectedPivotId) controller.virtualViews.pivot.reveal(state.selectedPivotId, focus);
}
function selectTree(controller, id, options = {}) {
  selectTreeIdentity(controller.state, id);
  controller.projections = project(controller);
  persistUniversalViewportUiState(controller.state, controller.storage);
  updateVirtualSelection(controller);
  revealSelection(controller, options.focus);
  refreshChrome(controller);
  return true;
}
function selectPivot(controller, id, options = {}) {
  selectPivotIdentity(controller.state, id);
  controller.projections = project(controller);
  persistUniversalViewportUiState(controller.state, controller.storage);
  updateVirtualSelection(controller);
  revealSelection(controller, options.focus);
  refreshChrome(controller);
  return true;
}
function applyAction(controller, action, trigger) {
  const host = activeHost(controller);
  if (action === 'fit') host.fit();
  else if (action === 'range') positionWorkbenchPalette(controller.rangePalette, trigger, controller.document);
  else if (action === 'zoom-x-in') host.zoomBy(1.2, 1);
  else if (action === 'zoom-x-out') host.zoomBy(1 / 1.2, 1);
  else if (action === 'zoom-y-in') host.zoomBy(1, 1.2);
  else if (action === 'zoom-y-out') host.zoomBy(1, 1 / 1.2);
  else if (action === 'crosshair') host.applyViewTransform({ crosshair: !host.readViewTransform().crosshair });
  refreshChrome(controller);
}
function applyRange(controller, form) {
  const range = normalizeWorkbenchViewportRange(Object.fromEntries(new FormData(form)));
  const error = form.querySelector('[data-uxc-range-error]');
  if (!range) { error.textContent = 'Maximum values must be greater than minimum values.'; return false; }
  activeHost(controller).applyRange(range);
  error.textContent = '';
  form.hidden = true;
  refreshChrome(controller);
  return true;
}
function currentSnapshot(controller) {
  return createUniversalNamedViewSnapshot({
    ...controller.state,
    treeTransform: controller.hosts.tree.readViewTransform(),
    pivotTransform: controller.hosts.pivot.readViewTransform(),
    treeScrollAnchor: controller.virtualViews.tree.getScrollAnchor(),
    pivotScrollAnchor: controller.virtualViews.pivot.getScrollAnchor(),
  });
}
function namedAction(controller, action) {
  const nameInput = controller.popup.querySelector('[data-uxc-named-view-name]');
  const select = controller.popup.querySelector('[data-uxc-named-view-select]');
  const status = controller.popup.querySelector('[data-uxc-named-view-status]');
  try {
    if (action === 'save') { const views = controller.namedStore.save(nameInput.value, currentSnapshot(controller)); controller.selectedNamedViewId = views.at(-1)?.id || ''; }
    else if (action === 'rename') controller.namedStore.rename(select.value, nameInput.value);
    else if (action === 'delete') controller.namedStore.delete(select.value);
    else if (action === 'apply') applyNamedView(controller, controller.namedStore.get(select.value));
    if (action === 'delete') controller.selectedNamedViewId = ''; else if (action !== 'save') controller.selectedNamedViewId = select.value;
    status.textContent = action === 'apply' ? 'Named view applied.' : `Named view ${action} complete.`;
    refreshChrome(controller);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}
function applyNamedView(controller, view) {
  if (!view) throw new TypeError('Select a named view first.');
  Object.assign(controller.state, {
    mode: view.mode,
    searchText: view.searchText,
    treeFilters: { ...view.treeFilters },
    pivotFilters: { ...view.pivotFilters },
    selectedTreeId: view.selectedTreeId,
    selectedPivotId: view.selectedPivotId,
  });
  controller.hosts.tree.applyViewTransform(view.treeTransform);
  controller.hosts.pivot.applyViewTransform(view.pivotTransform);
  applyProjection(controller);
  controller.virtualViews.tree.applyScrollAnchor(view.treeScrollAnchor);
  controller.virtualViews.pivot.applyScrollAnchor(view.pivotScrollAnchor);
  persistUniversalViewportUiState(controller.state, controller.storage);
}
function pointerStatus(controller, value) { controller.popup.querySelector('[data-uxc-viewport-status]').textContent = value; }
function bindSurface(controller, surface, host) {
  let drag = null;
  surface.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    host.zoomBy(event.shiftKey ? factor : 1, event.shiftKey ? 1 : factor);
  }, { signal: controller.signal, passive: false });
  surface.addEventListener('pointerdown', (event) => {
    if (event.button !== 1 && !event.altKey) return;
    drag = { x: event.clientX, y: event.clientY };
    surface.setPointerCapture?.(event.pointerId);
  }, { signal: controller.signal });
  surface.addEventListener('pointermove', (event) => {
    const rect = surface.getBoundingClientRect();
    const world = host.screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    pointerStatus(controller, host.formatPointer(world));
    if (!drag) return;
    host.panBy(event.clientX - drag.x, event.clientY - drag.y);
    drag = { x: event.clientX, y: event.clientY };
  }, { signal: controller.signal });
  surface.addEventListener('pointerup', () => { drag = null; }, { signal: controller.signal });
  surface.addEventListener('pointercancel', () => { drag = null; }, { signal: controller.signal });
}
export function createUniversalViewportEventController(options = {}) {
  const abort = new AbortController();
  const controller = {
    schema: UNIVERSAL_VIEWPORT_EVENT_CONTROLLER_SCHEMA,
    ...options,
    signal: abort.signal,
    selectedNamedViewId: '',
    indexes: createIndexes(options.viewModel),
    filterOptions: null,
    projections: null,
  };
  controller.filterOptions = filterOptions(controller.indexes);
  controller.projections = project(controller);
  bind(controller, abort);
  controller.virtualViews.tree.setProjection(controller.projections.tree.items);
  controller.virtualViews.pivot.setProjection(controller.projections.pivot.items);
  controller.virtualViews.tree.applyScrollAnchor(controller.state.treeScrollAnchor);
  controller.virtualViews.pivot.applyScrollAnchor(controller.state.pivotScrollAnchor);
  refreshChrome(controller);
  return Object.freeze({
    schema: controller.schema,
    selectTree: (id, detail) => selectTree(controller, id, detail),
    selectPivot: (id, detail) => selectPivot(controller, id, detail),
    setScrollAnchor(surface, anchor) {
      controller.state[`${surface}ScrollAnchor`] = anchor;
      persistUniversalViewportUiState(controller.state, controller.storage);
    },
    projections: () => controller.projections,
    destroy() { abort.abort(); controller.hostUnsubscribers?.splice(0).forEach((fn) => fn()); return true; },
  });
}
function bind(controller, abort) {
  const popup = controller.popup;
  popup.addEventListener('click', (event) => {
    if (event.target.matches?.('.universal-xml-categorizer-backdrop') || event.target.closest?.('[data-universal-categorizer-close]')) return controller.onClose();
    const mode = event.target.closest?.('[data-uxc-mode]')?.dataset.uxcMode;
    if (mode) { controller.state.mode = mode; persistUniversalViewportUiState(controller.state, controller.storage); refreshChrome(controller); return; }
    if (event.target.closest?.('[data-uxc-search-clear]')) { controller.state.searchText = ''; applyProjection(controller); return; }
    const actionButton = event.target.closest?.('[data-uxc-view-action]');
    if (actionButton) applyAction(controller, actionButton.dataset.uxcViewAction, actionButton);
    const named = event.target.closest?.('[data-uxc-named-view-action]')?.dataset.uxcNamedViewAction;
    if (named) namedAction(controller, named);
  }, { signal: abort.signal });
  popup.addEventListener('input', (event) => {
    if (!event.target.matches?.('[data-uxc-preview-search]')) return;
    controller.state.searchText = event.target.value;
    applyProjection(controller);
  }, { signal: abort.signal });
  popup.addEventListener('change', (event) => {
    const tree = event.target.dataset?.uxcTreeFilter;
    const pivot = event.target.dataset?.uxcPivotFilter;
    if (tree) { controller.state.treeFilters[tree] = event.target.value; applyProjection(controller); }
    if (pivot) { controller.state.pivotFilters[pivot] = event.target.value; applyProjection(controller); }
    if (event.target.matches?.('[data-uxc-named-view-select]')) controller.selectedNamedViewId = event.target.value;
  }, { signal: abort.signal });
  popup.addEventListener('keydown', (event) => { if (event.key === 'Escape') controller.onClose(); }, { signal: abort.signal });
  controller.rangePalette.addEventListener('submit', (event) => { event.preventDefault(); applyRange(controller, event.currentTarget); }, { signal: abort.signal });
  controller.rangePalette.querySelector('[data-uxc-range-cancel]').addEventListener('click', () => { controller.rangePalette.hidden = true; }, { signal: abort.signal });
  bindSurface(controller, controller.treeSurface, controller.hosts.tree);
  bindSurface(controller, controller.pivotSurface, controller.hosts.pivot);
  controller.hostUnsubscribers = [controller.hosts.tree.subscribe(() => refreshChrome(controller)), controller.hosts.pivot.subscribe(() => refreshChrome(controller))];
}
export const _test = freeze({ createIndexes, filterOptions, project, currentSnapshot, activeHost, applyRange });
