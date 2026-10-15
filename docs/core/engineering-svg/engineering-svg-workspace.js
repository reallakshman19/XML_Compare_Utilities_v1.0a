import { ENGINEERING_SCENE_PROJECTION } from '../engineering-scene/index.js';
import { exportEngineeringSvg } from './engineering-svg-export.js';
import { buildEngineeringSvgProjectedScene } from './engineering-svg-projected-scene.js';
import { createEngineeringSvgRenderer } from './engineering-svg-renderer.js';
import { createEngineeringSvgSelection } from './engineering-svg-selection.js';

function viewportSize(host, viewport = {}) {
  const width = Number(viewport.width ?? host.clientWidth ?? 1200);
  const height = Number(viewport.height ?? host.clientHeight ?? 720);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new TypeError('Engineering SVG workspace viewport must be positive and finite.');
  }
  return Object.freeze({ width, height });
}

function entityIdFromTarget(target, root) {
  let current = target;
  while (current && current !== root) {
    const id = current.getAttribute?.('data-engineering-svg-entity-id');
    if (id) return id;
    current = current.parentNode;
  }
  return null;
}

function assertSceneProjection(scene, projection) {
  if (!ENGINEERING_SCENE_PROJECTION.includes(projection) || !scene.projections.includes(projection)) {
    throw new TypeError(`Scene does not support workspace projection "${projection}".`);
  }
  return projection;
}

function isSelectionKey(event) {
  return event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';
}

export const ENGINEERING_SVG_WORKSPACE_STATE_SCHEMA = 'EngineeringSvgWorkspaceState.v1';

export function createEngineeringSvgWorkspace(options = {}) {
  const { host, sceneSource } = options;
  if (!host || !sceneSource?.getSnapshot || !sceneSource?.subscribe) {
    throw new TypeError('Engineering SVG workspace requires a host and scene source.');
  }
  let projection = assertSceneProjection(sceneSource.getSnapshot(), options.projection || 'ISO');
  let viewport = viewportSize(host, options.viewport);
  let padding = Number(options.padding ?? 24);
  let destroyed = false;
  let sequence = 0;
  let lastReason = 'initial';
  const renderer = createEngineeringSvgRenderer(host);
  const selection = createEngineeringSvgSelection(options.selectedIds || []);
  const stateListeners = new Set();

  function currentState(reason) {
    const scene = sceneSource.getSnapshot();
    return Object.freeze({
      schema: ENGINEERING_SVG_WORKSPACE_STATE_SCHEMA,
      sequence,
      sceneId: scene.sceneId,
      revision: scene.revision,
      projection,
      viewport,
      padding,
      selectedIds: selection.getSelection(),
      reason: String(reason),
    });
  }

  function publishState(reason) {
    sequence += 1;
    lastReason = String(reason);
    const state = currentState(lastReason);
    stateListeners.forEach((listener) => listener(state));
    return state;
  }

  function render() {
    if (destroyed) throw new Error('Engineering SVG workspace is destroyed.');
    const scene = sceneSource.getSnapshot();
    assertSceneProjection(scene, projection);
    const projected = buildEngineeringSvgProjectedScene(scene, { projection, viewport, padding });
    renderer.reconcile(projected);
    renderer.setSelection(selection.getSelection());
    return projected;
  }

  const unsubscribeScene = sceneSource.subscribe(() => { render(); publishState('scene-changed'); });
  const unsubscribeSelection = selection.subscribe((detail) => {
    renderer.setSelection(detail.selectedIds);
    publishState(detail.reason);
  });
  const click = (event) => {
    const id = entityIdFromTarget(event.target, renderer.root);
    if (id) selection.setSelection([id], 'pointer');
    else selection.clear('pointer-empty');
  };
  const keydown = (event) => {
    if (!isSelectionKey(event)) return;
    const id = entityIdFromTarget(event.target, renderer.root);
    if (!id) return;
    event.preventDefault();
    selection.setSelection([id], 'keyboard');
  };
  renderer.root.addEventListener('click', click);
  renderer.root.addEventListener('keydown', keydown);
  render();

  return Object.freeze({
    root: renderer.root,
    render,
    getProjection: () => projection,
    setProjection(value) {
      projection = assertSceneProjection(sceneSource.getSnapshot(), value);
      const projected = render();
      publishState('projection-changed');
      return projected;
    },
    setViewport(value) {
      viewport = viewportSize(host, value);
      const projected = render();
      publishState('viewport-changed');
      return projected;
    },
    setPadding(value) {
      padding = Math.max(0, Number(value) || 0);
      const projected = render();
      publishState('padding-changed');
      return projected;
    },
    getSelection: selection.getSelection,
    setSelection: selection.setSelection,
    clearSelection: selection.clear,
    subscribeSelection: selection.subscribe,
    getState: () => currentState(lastReason),
    subscribeState(listener) {
      if (destroyed) throw new Error('Engineering SVG workspace is destroyed.');
      if (typeof listener !== 'function') throw new TypeError('Workspace state listener must be a function.');
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    getEntityNode: renderer.getEntityNode,
    getEntityCount: renderer.getEntityCount,
    exportSvg(exportOptions = {}) {
      const scene = sceneSource.getSnapshot();
      const exportProjection = assertSceneProjection(scene, exportOptions.projection || projection);
      return exportEngineeringSvg(scene, {
        projection: exportProjection,
        viewport: exportOptions.viewport || viewport,
        padding: exportOptions.padding ?? padding,
      });
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      unsubscribeScene();
      unsubscribeSelection();
      renderer.root.removeEventListener('click', click);
      renderer.root.removeEventListener('keydown', keydown);
      selection.dispose();
      renderer.destroy();
      stateListeners.clear();
      return true;
    },
  });
}
