/** Certified read-only Sequential host for the existing four-method Draft Edit seam. */
import { freezeJsonValue } from '../../../core/engineering-scene/engineering-json-value.js';
import {
  SCOPED_EDIT_ENTITY_GEOMETRY_V1,
  validateScopedEditEntityGeometry,
} from '../../../core/scoped-edit-runtime/scoped-edit-contracts.js';
import { assertScopedEditHostContract } from '../../../core/scoped-edit-runtime/scoped-edit-host.js';
import { assertSequentialScopedEditReadModel } from './sequential-scoped-edit-read-model.js';
import { buildSequentialScopedEditEngineeringScene } from './sequential-scoped-edit-scene-adapter.js';
import { createSequentialScopedEditScopeResolver } from './sequential-scoped-edit-scope-adapter.js';

export const SEQUENTIAL_READ_ONLY_HOST_DESTROYED = 'SEQUENTIAL_READ_ONLY_HOST_DESTROYED';
export const STALE_SEQUENTIAL_READ_ONLY_HOST = 'STALE_SEQUENTIAL_READ_ONLY_HOST';
export const SEQUENTIAL_READ_ONLY_COMMAND_DENIED = 'SEQUENTIAL_READ_ONLY_COMMAND_DENIED';
export const SEQUENTIAL_READ_ONLY_HOST_REJECTION = Object.freeze({
  UNKNOWN_ENTITY: 'SEQUENTIAL_HOST_UNKNOWN_ENTITY',
  GEOMETRY_INVALID: 'SEQUENTIAL_HOST_GEOMETRY_INVALID',
});

function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message);
  error.code = code;
  throw error;
}

function pointOf(value) {
  return [value?.x, value?.y, value?.z].every(Number.isFinite)
    ? [value.x, value.y, value.z] : null;
}

function geometryAnchor(geometry) {
  if (geometry?.kind === 'point') return pointOf(geometry.position);
  if (geometry?.kind === 'segment') {
    const start = pointOf(geometry.start); const end = pointOf(geometry.end);
    return start && end ? start.map((value, index) => (value + end[index]) / 2) : null;
  }
  if (geometry?.kind === 'polyline') {
    const points = (geometry.points || []).map(pointOf).filter(Boolean);
    if (!points.length) return null;
    return [0, 1, 2].map((axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length);
  }
  return null;
}

function assertLive(state) {
  if (state.destroyed) fail(SEQUENTIAL_READ_ONLY_HOST_DESTROYED,
    'Sequential read-only host is unavailable after destroy().');
  const current = String(state.authorityProvider() || '').trim();
  if (current !== state.readModel.authorityId) fail(STALE_SEQUENTIAL_READ_ONLY_HOST,
    `Sequential host authority ${state.readModel.authorityId} is stale against ${current}.`);
}

function entityGeometry(state, entityId) {
  assertLive(state);
  const entity = state.entityIndex.get(String(entityId || '').trim());
  if (!entity) fail(SEQUENTIAL_READ_ONLY_HOST_REJECTION.UNKNOWN_ENTITY,
    `Sequential scene entity ${entityId} does not exist.`);
  const anchor = geometryAnchor(entity.geometry);
  if (!anchor) fail(SEQUENTIAL_READ_ONLY_HOST_REJECTION.GEOMETRY_INVALID,
    `Sequential scene entity ${entity.id} has no finite read-only anchor.`, TypeError);
  return validateScopedEditEntityGeometry({ schema: SCOPED_EDIT_ENTITY_GEOMETRY_V1,
    entityId: entity.id, anchor });
}

export function createSequentialScopedEditReadOnlyHost(input = {}) {
  const readModel = assertSequentialScopedEditReadModel(input.readModel);
  const scene = buildSequentialScopedEditEngineeringScene(readModel);
  const resolveScope = createSequentialScopedEditScopeResolver({ readModel, scene });
  const authorityProvider = input.authorityProvider ?? (() => readModel.authorityId);
  if (typeof authorityProvider !== 'function') throw new TypeError('authorityProvider must be a function.');
  const state = { readModel, scene, resolveScope, authorityProvider,
    entityIndex: new Map(scene.entities.map((entity) => [entity.id, entity])), destroyed: false };
  const host = Object.freeze({
    scene() { assertLive(state); return state.scene; },
    resolveScope(request) { assertLive(state); return state.resolveScope(request).scope; },
    entityGeometry(entityId) { return entityGeometry(state, entityId); },
    appendEditCommand() {
      assertLive(state);
      fail(SEQUENTIAL_READ_ONLY_COMMAND_DENIED,
        'Sequential SSK-TS-1B host denies every edit command.');
    },
    destroy() {
      state.destroyed = true;
      return freezeJsonValue({ destroyed: true, authorityId: readModel.authorityId });
    },
  });
  assertScopedEditHostContract(host);
  return host;
}

export const _test = Object.freeze({ geometryAnchor });
