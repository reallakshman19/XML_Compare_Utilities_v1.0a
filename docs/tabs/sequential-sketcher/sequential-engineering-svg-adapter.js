import { createEngineeringSvgPropertyProvider } from '../../core/engineering-svg/engineering-svg-property-provider.js';
import { createEngineeringSvgAdapter } from '../../core/engineering-svg/engineering-svg-adapter.js';
import { buildSequentialEngineeringSvgPropertySets } from './sequential-engineering-svg-properties.js';
import { buildSequentialEngineeringSvgScene } from './sequential-engineering-svg-scene.js';

export const SEQUENTIAL_ENGINEERING_SVG_ADAPTER_SCHEMA = 'SequentialEngineeringSvgAdapter.v1';

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function revisionsEqual(left, right) { return canonicalJson(left) === canonicalJson(right); }

function eventState(event, getState) {
  if (event?.schema === 'SequentialEngineeringSvgOwnerEvent.v1') return event.snapshot;
  return event?.state ?? event?.value ?? event ?? getState();
}

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

function requiredText(value, label) {
  const result = String(value || '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

export function createSequentialEngineeringSvgAdapter(options = {}) {
  const getState = requiredFunction(options.getState, 'Sequential engineering SVG getState');
  const subscribeState = requiredFunction(options.subscribeState, 'Sequential engineering SVG subscribeState');
  const sceneId = requiredText(options.sceneId, 'Sequential engineering SVG sceneId');
  const adapterId = requiredText(options.adapterId, 'Sequential engineering SVG adapterId');
  let lastBuild = null;

  function build(state = getState(), buildOptions = {}) {
    if (!state) throw new Error('Sequential engineering SVG requires an active owner snapshot.');
    lastBuild = buildSequentialEngineeringSvgScene(state, {
      sceneId,
      coordinateSystem: options.coordinateSystem,
      visibleProjection: buildOptions.visibleProjection ?? state?.visibleProjection,
    });
    return lastBuild;
  }

  const propertyProvider = createEngineeringSvgPropertyProvider({
    getPropertySets({ selectedIds, revision }) {
      const current = build();
      if (!revisionsEqual(current.scene.revision, revision)) {
        throw new Error('Sequential engineering SVG property request uses a stale domain revision.');
      }
      return buildSequentialEngineeringSvgPropertySets(current.scene, selectedIds);
    },
  });

  const adapter = createEngineeringSvgAdapter({
    descriptor: {
      adapterId,
      domainType: 'SEQUENTIAL_SKETCHER',
      accessMode: 'read-only',
      projections: ['ISO', 'XY', 'XZ', 'YZ'],
      capabilities: { selection: true, properties: true, parity: true, editing: false },
      metadata: { owner: 'sequential-sketcher', constructionAuthority: 'supervised-continuity-engine' },
    },
    getScene: () => build().scene,
    subscribeScene(listener) {
      const unsubscribe = subscribeState((event) => {
        const state = eventState(event, getState);
        if (!state) return;
        listener({
          scene: build(state, { visibleProjection: event?.visibleProjection }).scene,
          reason: String(event?.reason || 'sequential-domain-update'),
        });
      });
      if (typeof unsubscribe !== 'function') {
        throw new TypeError('Sequential engineering SVG subscribeState must return an unsubscribe function.');
      }
      return unsubscribe;
    },
    propertyProvider,
  });

  return Object.freeze({
    schema: SEQUENTIAL_ENGINEERING_SVG_ADAPTER_SCHEMA,
    adapter,
    buildSnapshot: build,
    getParityReport: () => lastBuild?.parity ?? build().parity,
  });
}
