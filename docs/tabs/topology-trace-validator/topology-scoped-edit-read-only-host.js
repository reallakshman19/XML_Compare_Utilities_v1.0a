/** Certified read-only Topology host with explicit effect-denial capabilities. */
import { immutableJson, requiredContractText } from '../../contracts/contract-values.js';
import {
  SCOPED_EDIT_ENTITY_GEOMETRY_V1,
  validateScopedEditEntityGeometry,
} from '../../core/scoped-edit-runtime/scoped-edit-contracts.js';
import { assertScopedEditHostContract } from '../../core/scoped-edit-runtime/scoped-edit-host.js';
import { loadTopologyProducerCore } from './topology-producer-loader.js';
import {
  assertTopologyScopedEditReadModel,
  _test as readModelTest,
} from './topology-scoped-edit-read-model.js';
import {
  buildTopologyScopedEditEngineeringScene,
  _test as sceneTest,
} from './topology-scoped-edit-scene-adapter.js';
import { createTopologyScopedEditDryRun } from './topology-scoped-edit-journal-projection.js';
import {
  createTopologyScopedEditScopeResolver,
  _test as scopeTest,
  STALE_TOPOLOGY_SCOPE_AUTHORITY,
} from './topology-scoped-edit-scope-adapter.js';

export const TOPOLOGY_READ_ONLY_HOST_DESTROYED = 'TOPOLOGY_READ_ONLY_HOST_DESTROYED';
export const STALE_TOPOLOGY_HOST_AUTHORITY = 'STALE_TOPOLOGY_HOST_AUTHORITY';
export const TOPOLOGY_READ_ONLY_EFFECT_BOUNDARY_V1 = 'TopologyReadOnlyEffectBoundary.v1';
export const TOPOLOGY_READ_ONLY_EFFECT_DENIED = 'TOPOLOGY_READ_ONLY_EFFECT_DENIED';
export const TOPOLOGY_READ_ONLY_HOST_REJECTION = Object.freeze({
  UNKNOWN_ENTITY: 'TOPOLOGY_HOST_UNKNOWN_ENTITY',
  GEOMETRY_UNSUPPORTED: 'TOPOLOGY_HOST_GEOMETRY_UNSUPPORTED',
  GEOMETRY_INVALID: 'TOPOLOGY_HOST_GEOMETRY_INVALID',
});
const FORBIDDEN_EFFECTS = Object.freeze(['storageAccess', 'recoveryAcceptance', 'writerAcquisition',
  'controllerMutation', 'rendererRefresh', 'selectionPublication', 'productionAcceptance']);
function fail(code, message, Constructor = RangeError) {
  const error = new Constructor(message); error.code = code; throw error;
}
export function createTopologyScopedEditEffectBoundary(probes = {}) {
  const boundary = { schema: TOPOLOGY_READ_ONLY_EFFECT_BOUNDARY_V1,
    observe(operation) { probes.readOnlyOperation?.(requiredContractText(operation, 'read-only operation')); } };
  for (const name of FORBIDDEN_EFFECTS) boundary[name] = () => {
    probes[name]?.(); fail(TOPOLOGY_READ_ONLY_EFFECT_DENIED, `Forbidden Topology effect denied: ${name}.`);
  };
  return Object.freeze(boundary);
}
function requiredEffects(value) {
  const effects = value ?? createTopologyScopedEditEffectBoundary();
  if (effects.schema !== TOPOLOGY_READ_ONLY_EFFECT_BOUNDARY_V1 || typeof effects.observe !== 'function'
    || FORBIDDEN_EFFECTS.some((name) => typeof effects[name] !== 'function')) {
    throw new TypeError(`Topology host requires ${TOPOLOGY_READ_ONLY_EFFECT_BOUNDARY_V1}.`);
  }
  return effects;
}
function completeState(input, core, readModel, scene, resolveScope) {
  const provider = input.authorityProvider ?? (() => readModel.authorityId);
  if (typeof provider !== 'function') throw new TypeError('authorityProvider must be a function.');
  return { readModel, core, provider, effects: requiredEffects(input.effects), scene, resolveScope,
    entityIndex: new Map(scene.entities.map((entity) => [entity.id, entity])), destroyed: false };
}
async function hostStateWithCore(input, core, dependencies = {}) {
  const readModel = await readModelTest.assertWithCore(input.readModel, core, dependencies);
  const scene = await sceneTest.createWithCore(readModel, core, dependencies);
  const resolveScope = await scopeTest.resolverWithCore({ readModel, scene }, core, dependencies);
  return completeState(input, core, readModel, scene, resolveScope);
}
async function publicHostState(input, core, dependencies = {}) {
  const readModel = await assertTopologyScopedEditReadModel(input.readModel, dependencies);
  const scene = await buildTopologyScopedEditEngineeringScene(readModel, dependencies);
  const resolveScope = await createTopologyScopedEditScopeResolver({ readModel, scene }, dependencies);
  return completeState(input, core, readModel, scene, resolveScope);
}
function assertLive(state, staleCode = STALE_TOPOLOGY_HOST_AUTHORITY) {
  if (state.destroyed) fail(TOPOLOGY_READ_ONLY_HOST_DESTROYED,
    'Topology read-only host is unavailable after destroy().');
  const current = requiredContractText(state.provider(), 'current Topology authorityId');
  if (current !== state.readModel.authorityId) fail(staleCode,
    `Topology host authority ${state.readModel.authorityId} is stale against ${current}.`);
}
function observed(state, operation, action, staleCode) {
  assertLive(state, staleCode); state.effects.observe(operation); return action();
}
function pointAnchor(entity) {
  const geometry = entity.geometry;
  if (geometry?.kind !== 'point') fail(TOPOLOGY_READ_ONLY_HOST_REJECTION.GEOMETRY_UNSUPPORTED,
    `Entity ${entity.id} does not expose authoritative point-anchor geometry.`);
  const point = geometry.position;
  if (![point?.x, point?.y, point?.z].every(Number.isFinite)) fail(
    TOPOLOGY_READ_ONLY_HOST_REJECTION.GEOMETRY_INVALID,
    `Entity ${entity.id} geometry is not finite.`, TypeError);
  return [point.x, point.y, point.z];
}
function readGeometry(state, entityIdInput) {
  return observed(state, 'entityGeometry', () => {
    const entityId = requiredContractText(entityIdInput, 'entityId');
    const entity = state.entityIndex.get(entityId);
    if (!entity) fail(TOPOLOGY_READ_ONLY_HOST_REJECTION.UNKNOWN_ENTITY,
      `Topology scene entity ${entityId} does not exist.`);
    return validateScopedEditEntityGeometry({ schema: SCOPED_EDIT_ENTITY_GEOMETRY_V1,
      entityId, anchor: pointAnchor(entity) });
  });
}
function scopeEvidence(state, request) {
  return observed(state, 'resolveScope', () => state.resolveScope(request), STALE_TOPOLOGY_SCOPE_AUTHORITY);
}
function dryRun(state, currentProjection, envelope) {
  return observed(state, 'appendEditCommand', () => createTopologyScopedEditDryRun({
    readModel: state.readModel, currentProjection, envelope, core: state.core }));
}
function destroy(state) {
  if (!state.destroyed) { state.effects.observe('destroy'); state.destroyed = true; }
  return immutableJson({ destroyed: true, authorityId: state.readModel.authorityId },
    'Topology read-only host destroy evidence');
}
function hostFromState(state) {
  const host = Object.freeze({
    scene() { return observed(state, 'scene', () => state.scene); },
    resolveScope(request) { return scopeEvidence(state, request).scope; },
    resolveScopeEvidence(request) { return scopeEvidence(state, request); },
    entityGeometry(entityId) { return readGeometry(state, entityId); },
    appendEditCommand(currentProjection, envelope) {
      return dryRun(state, currentProjection, envelope).candidateProjection;
    },
    dryRun(currentProjection, envelope) { return dryRun(state, currentProjection, envelope); },
    destroy() { return destroy(state); },
  });
  assertScopedEditHostContract(host); return host;
}
async function createWithCore(input, core, dependencies = {}) {
  return hostFromState(await hostStateWithCore(input, core, dependencies));
}
export async function createTopologyScopedEditReadOnlyHost(input = {}, dependencies = {}) {
  const core = await loadTopologyProducerCore();
  return hostFromState(await publicHostState(input, core, dependencies));
}
export const _test = Object.freeze({ createWithCore, FORBIDDEN_EFFECTS });
