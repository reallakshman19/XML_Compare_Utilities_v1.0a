import {
  assertEngineeringRevisionToken,
  cloneJsonValue,
  freezeJsonValue,
} from '../engineering-scene/index.js';

export const ENGINEERING_SVG_DRAFT_SCHEMA = 'EngineeringSvgDraftSnapshot.v1';

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

function emptyState() {
  return {
    schema: ENGINEERING_SVG_DRAFT_SCHEMA,
    operationId: null,
    baseRevision: null,
    geometry: {},
    properties: {},
  };
}

export function createEngineeringSvgDraftStore() {
  let state = emptyState();
  let disposed = false;
  const listeners = new Set();

  function assertActiveStore() {
    if (disposed) throw new Error('Engineering SVG draft store is disposed.');
  }

  function assertOperation() {
    assertActiveStore();
    if (!state.operationId) throw new Error('No engineering SVG draft operation is active.');
  }

  function publish(reason) {
    const snapshot = freezeJsonValue(state);
    listeners.forEach((listener) => listener(Object.freeze({ snapshot, reason })));
    return snapshot;
  }

  return Object.freeze({
    getSnapshot() {
      assertActiveStore();
      return freezeJsonValue(state);
    },
    begin(input = {}) {
      assertActiveStore();
      if (state.operationId) throw new Error('An engineering SVG draft operation is already active.');
      state = {
        ...emptyState(),
        operationId: requiredText(input.operationId, 'Draft operationId'),
        baseRevision: cloneJsonValue(assertEngineeringRevisionToken(input.baseRevision, 'draft.baseRevision')),
      };
      return publish('begin');
    },
    stageGeometry(entityId, value = {}) {
      assertOperation();
      const id = requiredText(entityId, 'Draft geometry entityId');
      if (value.entity?.id != null && String(value.entity.id) !== id) {
        throw new TypeError('Draft geometry entity descriptor ID must match entityId.');
      }
      state.geometry[id] = cloneJsonValue({
        original: value.original ?? null,
        draft: value.draft ?? null,
        constraint: value.constraint ?? null,
        entity: value.entity ?? null,
      });
      return publish('stage-geometry');
    },
    stageProperty(entityId, key, value = {}) {
      assertOperation();
      const id = requiredText(entityId, 'Draft property entityId');
      const propertyKey = requiredText(key, 'Draft property key');
      if (!state.properties[id]) state.properties[id] = {};
      state.properties[id][propertyKey] = cloneJsonValue({
        original: value.original ?? null,
        draft: value.draft ?? null,
      });
      return publish('stage-property');
    },
    clear(reason = 'clear') {
      assertActiveStore();
      state = emptyState();
      return publish(String(reason));
    },
    subscribe(listener) {
      assertActiveStore();
      if (typeof listener !== 'function') throw new TypeError('Draft-store listener must be a function.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    listenerCount: () => listeners.size,
    dispose() {
      if (disposed) return false;
      disposed = true;
      listeners.clear();
      state = emptyState();
      return true;
    },
  });
}
