import { validateEngineeringScene } from '../engineering-scene/index.js';

export const ENGINEERING_SVG_SCENE_SOURCE_SCHEMA = 'EngineeringSvgSceneSource.v1';

export function createEngineeringSvgSceneSource(initialScene) {
  let current = validateEngineeringScene(initialScene);
  let disposed = false;
  const listeners = new Set();

  function assertActive() {
    if (disposed) throw new Error('Engineering SVG scene source is disposed.');
  }

  return Object.freeze({
    schema: ENGINEERING_SVG_SCENE_SOURCE_SCHEMA,
    getSnapshot() {
      assertActive();
      return current;
    },
    setSnapshot(scene, reason = 'scene-update') {
      assertActive();
      current = validateEngineeringScene(scene);
      const event = Object.freeze({ type: 'sceneChanged', scene: current, reason: String(reason) });
      listeners.forEach((listener) => listener(event));
      return current;
    },
    subscribe(listener) {
      assertActive();
      if (typeof listener !== 'function') throw new TypeError('Scene-source listener must be a function.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    listenerCount() {
      return listeners.size;
    },
    dispose() {
      if (disposed) return false;
      disposed = true;
      listeners.clear();
      return true;
    },
  });
}
