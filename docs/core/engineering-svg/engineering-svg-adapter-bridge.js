import { freezeJsonValue } from '../engineering-scene/index.js';
import { ENGINEERING_SVG_ADAPTER_SCHEMA } from './engineering-svg-adapter.js';
import { createEngineeringSvgSceneSource } from './engineering-svg-scene-source.js';

export const ENGINEERING_SVG_ADAPTER_BRIDGE_SCHEMA = 'EngineeringSvgAdapterBridge.v1';
export const ENGINEERING_SVG_ADAPTER_DEPENDENCIES_SCHEMA = 'EngineeringSvgAdapterDependencies.v1';

function assertAdapter(adapter) {
  if (adapter?.schema !== ENGINEERING_SVG_ADAPTER_SCHEMA
    || typeof adapter.getScene !== 'function'
    || typeof adapter.subscribeScene !== 'function') {
    throw new TypeError('Adapter bridge requires EngineeringSvgAdapter.v1.');
  }
  return adapter;
}

export async function createEngineeringSvgAdapterBridge(adapterValue) {
  const adapter = assertAdapter(adapterValue);
  const sceneSource = createEngineeringSvgSceneSource(await adapter.getScene());
  let disposed = false;
  let lastRejectedEvent = null;

  const unsubscribe = adapter.subscribeScene((event) => {
    if (disposed) return;
    if (event?.type === 'sceneRejected') {
      lastRejectedEvent = freezeJsonValue({
        type: 'sceneRejected',
        reason: String(event.reason || 'adapter-scene-rejected'),
        message: String(event.message || 'Adapter scene event was rejected.'),
      });
      return;
    }
    try {
      sceneSource.setSnapshot(event.scene, event.reason);
      lastRejectedEvent = null;
    } catch (error) {
      lastRejectedEvent = freezeJsonValue({
        type: 'sceneRejected',
        reason: String(event?.reason || 'adapter-scene-rejected'),
        message: String(error?.message || error),
      });
    }
  });

  const dependencies = Object.freeze({
    schema: ENGINEERING_SVG_ADAPTER_DEPENDENCIES_SCHEMA,
    descriptor: adapter.descriptor,
    sceneSource,
    propertyProvider: adapter.propertyProvider,
    commandGateway: adapter.commandGateway,
    snapProviders: adapter.snapProviders,
    resolveReferenceVector: adapter.resolveReferenceVector,
  });

  return Object.freeze({
    schema: ENGINEERING_SVG_ADAPTER_BRIDGE_SCHEMA,
    descriptor: adapter.descriptor,
    getDependencies() {
      if (disposed) throw new Error('Engineering SVG adapter bridge is disposed.');
      return dependencies;
    },
    getLastRejectedEvent: () => lastRejectedEvent,
    dispose() {
      if (disposed) return false;
      disposed = true;
      unsubscribe();
      sceneSource.dispose();
      return true;
    },
  });
}
