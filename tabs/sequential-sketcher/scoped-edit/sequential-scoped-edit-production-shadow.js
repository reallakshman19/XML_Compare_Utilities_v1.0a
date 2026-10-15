/** Fail-open read-only Sequential Draft Edit shadow over settled owner snapshots. */
import { createEngineeringScopeRequest } from '../../../core/engineering-scope/engineering-scope-contracts.js';
import { freezeJsonValue } from '../../../core/engineering-scene/engineering-json-value.js';
import { sequentialSemanticFingerprint } from './sequential-command-contracts.js';
import {
  createSequentialScopedEditReadModel,
  deriveSequentialScopedEditAuthorityId,
} from './sequential-scoped-edit-read-model.js';
import { createSequentialScopedEditReadOnlyHost } from './sequential-scoped-edit-read-only-host.js';

export const SEQUENTIAL_PRODUCTION_SHADOW_V1 = 'SequentialProductionShadow.v1';
export const SEQUENTIAL_PRODUCTION_SHADOW_STATUS = Object.freeze({
  IDLE: 'IDLE', MOUNTED: 'MOUNTED', DEGRADED: 'DEGRADED', DESTROYED: 'DESTROYED',
});

function errorEvidence(error) {
  return { code: String(error?.code || error?.name || 'ERROR'),
    message: error?.message || String(error) };
}

function scopeRequest(readModel, scene) {
  const selected = readModel.selectionSnapshot.entityIds;
  const entityIds = selected.length ? selected : scene.entities.slice(0, 1).map((entity) => entity.id);
  if (!entityIds.length) return null;
  return createEngineeringScopeRequest({ schema: 'EngineeringScopeRequest.v1', kind: 'SELECTION',
    boundaryPolicy: 'FROZEN', elementBudget: Math.max(1, scene.entities.length),
    selection: { entityIds, closureDepth: 0 } });
}

function emptySceneEvidence(readModel, scene) {
  return freezeJsonValue({ schema: 'SequentialEmptySceneMountEvidence.v1',
    authorityId: readModel.authorityId, sceneId: scene.sceneId, entityIds: [], mountedCount: 0 });
}

function mountKey(readModel) {
  return sequentialSemanticFingerprint('SSK3DMOUNT', {
    authorityId: readModel.authorityId,
    selection: readModel.selectionSnapshot.entityIds,
    visibleProjection: readModel.ownerSnapshot.visibleProjection,
  });
}

function mountEvidence(readModel, host) {
  const scene = host.scene();
  const request = scopeRequest(readModel, scene);
  const scope = request ? host.resolveScope(request) : emptySceneEvidence(readModel, scene);
  const mountedCount = request ? scope.stats.mounted : 0;
  return freezeJsonValue({ authorityId: readModel.authorityId,
    sceneHash: sequentialSemanticFingerprint('SSK3DSCENE', scene),
    scopeHash: sequentialSemanticFingerprint('SSK3DSCOPE', scope),
    entityCount: scene.entities.length, mountedCount });
}

function release(current) {
  try { current?.host.destroy(); } catch {}
}

export function createSequentialScopedEditProductionShadow(input = {}) {
  if (typeof input.snapshotProvider !== 'function') throw new TypeError('snapshotProvider must be a function.');
  if (typeof input.subscribe !== 'function') throw new TypeError('subscribe must be a function.');
  let current = null; let destroyed = false;
  let status = SEQUENTIAL_PRODUCTION_SHADOW_STATUS.IDLE;
  let lastDiagnostic = null; let history = Object.freeze([]); let sequence = 0;

  function publish(kind, nextStatus, detail = {}) {
    status = nextStatus;
    lastDiagnostic = freezeJsonValue({ sequence: ++sequence, kind, status,
      authorityId: current?.readModel.authorityId || '', ...detail });
    history = Object.freeze([...history.slice(-49), lastDiagnostic]);
    try { input.onDiagnostic?.(lastDiagnostic); } catch {}
  }

  function evidence() {
    return freezeJsonValue({ schema: SEQUENTIAL_PRODUCTION_SHADOW_V1, status, destroyed,
      mounted: Boolean(current), authorityId: current?.readModel.authorityId || '',
      mountKey: current?.key || '', lastDiagnostic, history });
  }

  function authorityProvider() {
    const snapshot = input.snapshotProvider();
    return snapshot ? deriveSequentialScopedEditAuthorityId(snapshot) : 'NO_SEQUENTIAL_AUTHORITY';
  }

  function observe(event = null) {
    if (destroyed) return evidence();
    const snapshot = event?.schema === 'SequentialEngineeringSvgOwnerEvent.v1'
      ? event.snapshot : input.snapshotProvider();
    if (!snapshot) {
      release(current); current = null;
      publish('MOUNT', SEQUENTIAL_PRODUCTION_SHADOW_STATUS.IDLE,
        { reason: 'Sequential owner authority is not initialized.' });
      return evidence();
    }
    try {
      const readModel = createSequentialScopedEditReadModel(snapshot);
      const key = mountKey(readModel);
      if (current?.key === key) return evidence();
      const host = createSequentialScopedEditReadOnlyHost({ readModel, authorityProvider });
      const mount = mountEvidence(readModel, host);
      release(current);
      current = Object.freeze({ readModel, host, mount, key });
      publish('MOUNT', SEQUENTIAL_PRODUCTION_SHADOW_STATUS.MOUNTED, { mount });
    } catch (error) {
      release(current); current = null;
      publish('MOUNT', SEQUENTIAL_PRODUCTION_SHADOW_STATUS.DEGRADED,
        { error: errorEvidence(error) });
    }
    return evidence();
  }

  const unsubscribe = input.subscribe((event) => { try { observe(event); } catch {} });
  if (typeof unsubscribe !== 'function') throw new TypeError('subscribe must return an unsubscribe function.');
  observe();

  return Object.freeze({
    observe,
    evidence,
    host() { return current?.host || null; },
    readModel() { return current?.readModel || null; },
    destroy() {
      if (destroyed) return evidence();
      destroyed = true; unsubscribe(); release(current); current = null;
      publish('LIFECYCLE', SEQUENTIAL_PRODUCTION_SHADOW_STATUS.DESTROYED);
      return evidence();
    },
  });
}

export const _test = Object.freeze({ scopeRequest, emptySceneEvidence, mountKey, mountEvidence, release });
