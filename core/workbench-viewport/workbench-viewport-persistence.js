import { normalizeWorkbenchViewportState } from './workbench-viewport-state.js';

export const WORKBENCH_VIEWPORT_STORAGE_KEY = 'workbenchViewportStateV1';

function encode(value) {
  return encodeURIComponent(String(value));
}

export function workbenchViewportPersistenceKey(value = {}, storageKey = WORKBENCH_VIEWPORT_STORAGE_KEY) {
  const state = normalizeWorkbenchViewportState(value);
  return [storageKey, state.namespace, state.modeId, state.surfaceId].map(encode).join('/');
}

function readState(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function loadWorkbenchViewportState(identity = {}, storage = globalThis.localStorage, options = {}) {
  const fallback = normalizeWorkbenchViewportState({ ...options.fallback, ...identity });
  const key = workbenchViewportPersistenceKey(fallback, options.storageKey);
  const stored = readState(storage, key);
  return normalizeWorkbenchViewportState({ ...fallback, ...(stored || {}), ...identity });
}

export function saveWorkbenchViewportState(value, storage = globalThis.localStorage, options = {}) {
  const state = normalizeWorkbenchViewportState(value);
  const key = workbenchViewportPersistenceKey(state, options.storageKey);
  try {
    storage?.setItem?.(key, JSON.stringify(state));
  } catch {
    // View-state persistence is best-effort only.
  }
  return state;
}

export function removeWorkbenchViewportState(identity, storage = globalThis.localStorage, options = {}) {
  const key = workbenchViewportPersistenceKey(identity, options.storageKey);
  try {
    storage?.removeItem?.(key);
    return true;
  } catch {
    return false;
  }
}
