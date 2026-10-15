import { WorkbenchViewportCapability } from '../../core/workbench-viewport/index.js';
import { createUniversalLoadedPreviewBundle } from './universal-loaded-preview-bundle.js';
import {
  createLinewiseUniversalWorkspaceViewModel,
  createUniversalWorkspaceViewModel,
} from './universal-workspace-view-model.js';
import { renderUniversalXmlCategorizerWorkspaceHtml } from './universal-xml-categorizer-shell.js';
import { createUniversalTreeViewportHost } from './universal-tree-viewport-host.js';
import { createUniversalPivotViewportHost } from './universal-pivot-viewport-host.js';
import { createUniversalViewportState } from './universal-viewport-state.js';
import { createUniversalViewportShellModel } from './universal-viewport-shell-model.js';
import { renderUniversalViewportShell } from './universal-viewport-shell-view.js';
import { createUniversalTreeVirtualView } from './universal-tree-virtual-view.js';
import { createUniversalPivotVirtualView } from './universal-pivot-virtual-view.js';
import { createUniversalNamedViewStore } from './universal-viewport-named-views.js';
import { createUniversalViewportEventController } from './universal-viewport-event-controller.js';

export const UNIVERSAL_VIEWPORT_LIFECYCLE_SCHEMA = 'universal-viewport-lifecycle/v2';
let mountSequence = 0;

function viewModelFor(context) {
  if (!context?.usableLoaded) return createLinewiseUniversalWorkspaceViewModel(context?.profile);
  const previewBundle = createUniversalLoadedPreviewBundle({
    profile: context.profile,
    sourceInputs: context.sourceInputs,
    targetRows: context.targetRows,
  });
  return createUniversalWorkspaceViewModel({ profile: context.profile, previewBundle });
}

function seedHost(signature, surfaceId, capabilities) {
  return { namespace: 'xml-builder', surfaceId, modeId: signature, capabilities, statusSegments: () => [surfaceId] };
}

function seedHosts(signature) {
  const base = [WorkbenchViewportCapability.FIT, WorkbenchViewportCapability.RANGE,
    WorkbenchViewportCapability.CROSSHAIR, WorkbenchViewportCapability.SELECT_SURFACE];
  return { tree: seedHost(signature, 'tree', base), pivot: seedHost(signature, 'pivot', base) };
}

function initialShell(context, state, viewModel, namedStore) {
  const model = createUniversalViewportShellModel({
    state,
    hosts: seedHosts(context.signature),
    context,
    namedViews: namedStore.list(),
    namedViewDiagnostics: namedStore.diagnostics(),
  });
  return renderUniversalViewportShell(model, viewModel);
}

function createVirtualViews(popup, state, viewModel, callbacks) {
  const treeSurface = popup.querySelector('[data-uxc-surface="tree"]');
  const pivotSurface = popup.querySelector('[data-uxc-surface="pivot"]');
  const tree = createUniversalTreeVirtualView({
    surface: treeSurface,
    items: state.selectionIndex.treeItems,
    onActivate: callbacks.tree,
    onWindowChange: (_, anchor) => callbacks.anchor('tree', anchor),
  });
  const pivot = createUniversalPivotVirtualView({
    surface: pivotSurface,
    items: state.selectionIndex.pivotItems,
    columns: viewModel.samplePreview.pivot.columns,
    onActivate: callbacks.pivot,
    onWindowChange: (_, anchor) => callbacks.anchor('pivot', anchor),
  });
  return { treeSurface, pivotSurface, virtualViews: Object.freeze({ tree, pivot }) };
}

function createHosts(context, viewModel, surfaces, virtualViews, storage, projections) {
  const treeRows = () => projections()?.tree.rows || viewModel.samplePreview.tree.nodes;
  const pivotRows = () => projections()?.pivot.rows || viewModel.samplePreview.pivot.rows;
  return Object.freeze({
    tree: createUniversalTreeViewportHost({
      surface: surfaces.treeSurface,
      tree: viewModel.samplePreview.tree,
      signature: context.signature,
      storage,
      rowProvider: treeRows,
      onViewTransform: virtualViews.tree.setViewTransform,
      revealIdentity: virtualViews.tree.reveal,
    }),
    pivot: createUniversalPivotViewportHost({
      surface: surfaces.pivotSurface,
      pivot: viewModel.samplePreview.pivot,
      signature: context.signature,
      storage,
      rowProvider: pivotRows,
      onViewTransform: virtualViews.pivot.setViewTransform,
      revealIdentity: virtualViews.pivot.reveal,
    }),
  });
}

export function mountUniversalViewportLifecycle(options = {}) {
  const doc = options.document || globalThis.document;
  if (!doc?.body) throw new TypeError('XML Builder viewport requires a document body.');
  const context = options.context;
  const storage = options.storage || globalThis.localStorage;
  const viewModel = viewModelFor(context);
  const state = createUniversalViewportState({
    signature: context.signature,
    tree: viewModel.samplePreview.tree,
    pivot: viewModel.samplePreview.pivot,
    storage,
  });
  const namedStore = createUniversalNamedViewStore({ signature: context.signature, storage });
  const viewportHtml = initialShell(context, state, viewModel, namedStore);
  doc.body.insertAdjacentHTML('beforeend', renderUniversalXmlCategorizerWorkspaceHtml(viewModel, {
    contextStatus: context.status,
    viewportHtml,
  }));
  const popup = doc.querySelector('[data-xml-compare-universal-categorizer-popup]:last-of-type');
  let events = null;
  let lifecycle = null;
  const callbacks = {
    tree: (id, detail) => events?.selectTree(id, detail),
    pivot: (id, detail) => events?.selectPivot(id, detail),
    anchor: (surface, anchor) => events?.setScrollAnchor(surface, anchor),
  };
  const surfaces = createVirtualViews(popup, state, viewModel, callbacks);
  const projections = () => events?.projections() || null;
  const hosts = createHosts(context, viewModel, surfaces, surfaces.virtualViews, storage, projections);
  let destroyed = false;
  lifecycle = {
    schema: UNIVERSAL_VIEWPORT_LIFECYCLE_SCHEMA,
    mountId: ++mountSequence,
    document: doc,
    popup,
    context,
    viewModel,
    state,
    hosts,
    virtualViews: surfaces.virtualViews,
    namedStore,
    treeSurface: surfaces.treeSurface,
    pivotSurface: surfaces.pivotSurface,
    storage,
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      events?.destroy();
      surfaces.virtualViews.tree.destroy();
      surfaces.virtualViews.pivot.destroy();
      hosts.tree.dispose();
      hosts.pivot.dispose();
      popup.remove();
      return true;
    },
  };
  events = createUniversalViewportEventController({
    document: doc,
    popup,
    context,
    viewModel,
    state,
    hosts,
    virtualViews: surfaces.virtualViews,
    namedStore,
    storage,
    treeSurface: surfaces.treeSurface,
    pivotSurface: surfaces.pivotSurface,
    rangePalette: popup.querySelector('[data-uxc-range-palette]'),
    onClose: () => lifecycle.destroy(),
  });
  lifecycle.eventController = events;
  popup.dataset.uxcViewportMountId = String(lifecycle.mountId);
  popup.dataset.uxcVirtualControllers = '2';
  return Object.freeze(lifecycle);
}

export const _test = Object.freeze({ viewModelFor, seedHosts, initialShell });
