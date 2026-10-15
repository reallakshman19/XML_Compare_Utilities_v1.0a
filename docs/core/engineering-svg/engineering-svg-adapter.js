import {
  ENGINEERING_SVG_ADAPTER_ACCESS_MODE,
  createEngineeringSvgAdapterDescriptor,
} from '../engineering-scene/engineering-adapter-contracts.js';
import { createEngineeringPoint3D, validateEngineeringScene } from '../engineering-scene/index.js';
import {
  ENGINEERING_SVG_COMMAND_GATEWAY_SCHEMA,
} from './engineering-svg-command-gateway.js';
import {
  ENGINEERING_SVG_PROPERTY_PROVIDER_SCHEMA,
} from './engineering-svg-property-provider.js';
import {
  ENGINEERING_SVG_SNAP_PROVIDER_SCHEMA,
} from './engineering-svg-snap-provider.js';

export const ENGINEERING_SVG_ADAPTER_SCHEMA = 'EngineeringSvgAdapter.v1';

function assertSceneMatchesDescriptor(scene, descriptor) {
  validateEngineeringScene(scene);
  scene.projections.forEach((projection) => {
    if (!descriptor.projections.includes(projection)) {
      throw new TypeError(`Adapter scene projection "${projection}" is not declared by its descriptor.`);
    }
  });
  return scene;
}

function snapProviders(values = []) {
  if (!Array.isArray(values)) throw new TypeError('Engineering SVG adapter snap providers must be an array.');
  values.forEach((provider, index) => {
    if (provider?.schema !== ENGINEERING_SVG_SNAP_PROVIDER_SCHEMA || typeof provider.provide !== 'function') {
      throw new TypeError(`snapProviders[${index}] must use EngineeringSvgSnapProvider.v1.`);
    }
  });
  const sorted = [...values].sort((left, right) => left.id.localeCompare(right.id));
  const ids = sorted.map((provider) => provider.id);
  if (new Set(ids).size !== ids.length) throw new TypeError('Engineering SVG adapter snap provider IDs must be unique.');
  return Object.freeze(sorted);
}

function commandGateway(descriptor, value) {
  const editable = descriptor.accessMode === ENGINEERING_SVG_ADAPTER_ACCESS_MODE.EDITABLE;
  if (editable && (value?.schema !== ENGINEERING_SVG_COMMAND_GATEWAY_SCHEMA || typeof value.execute !== 'function')) {
    throw new TypeError('Editable engineering SVG adapters require EngineeringSvgCommandGateway.v1.');
  }
  if (!editable && value != null) {
    throw new TypeError('Read-only engineering SVG adapters cannot expose a command gateway.');
  }
  return value ?? null;
}

export function createEngineeringSvgAdapter(options = {}) {
  const descriptor = createEngineeringSvgAdapterDescriptor(options.descriptor);
  if (typeof options.getScene !== 'function' || typeof options.subscribeScene !== 'function') {
    throw new TypeError('Engineering SVG adapters require getScene and subscribeScene functions.');
  }
  if (options.propertyProvider?.schema !== ENGINEERING_SVG_PROPERTY_PROVIDER_SCHEMA
    || typeof options.propertyProvider.getPropertySets !== 'function') {
    throw new TypeError('Engineering SVG adapters require EngineeringSvgPropertyProvider.v1.');
  }
  const providers = snapProviders(options.snapProviders);
  const gateway = commandGateway(descriptor, options.commandGateway);
  const resolveReferenceVector = options.resolveReferenceVector;
  if (resolveReferenceVector != null && typeof resolveReferenceVector !== 'function') {
    throw new TypeError('Engineering SVG adapter reference resolver must be a function.');
  }

  async function getScene() {
    return assertSceneMatchesDescriptor(await options.getScene(), descriptor);
  }

  function subscribeScene(listener) {
    if (typeof listener !== 'function') throw new TypeError('Engineering SVG adapter listener must be a function.');
    const unsubscribe = options.subscribeScene((value) => {
      try {
        const scene = assertSceneMatchesDescriptor(value?.scene ?? value, descriptor);
        listener(Object.freeze({
          type: 'sceneChanged',
          scene,
          reason: String(value?.reason || 'adapter-scene-update'),
        }));
      } catch (error) {
        listener(Object.freeze({
          type: 'sceneRejected',
          reason: String(value?.reason || 'adapter-scene-rejected'),
          message: String(error?.message || error),
        }));
      }
    });
    if (typeof unsubscribe !== 'function') throw new TypeError('Adapter subscribeScene must return an unsubscribe function.');
    return unsubscribe;
  }

  function resolveVector(request) {
    if (!resolveReferenceVector) throw new Error('Engineering SVG adapter has no reference-vector resolver.');
    const vector = createEngineeringPoint3D(resolveReferenceVector(Object.freeze({ ...request })));
    if (Math.hypot(vector.x, vector.y, vector.z) === 0) {
      throw new TypeError('Engineering SVG adapter reference vector must be non-zero.');
    }
    return vector;
  }

  return Object.freeze({
    schema: ENGINEERING_SVG_ADAPTER_SCHEMA,
    descriptor,
    getScene,
    subscribeScene,
    propertyProvider: options.propertyProvider,
    commandGateway: gateway,
    snapProviders: providers,
    resolveReferenceVector: resolveReferenceVector ? resolveVector : null,
  });
}
