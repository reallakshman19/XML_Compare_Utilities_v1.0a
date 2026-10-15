/** Fail-open production mount for the certified Topology/shared-runtime shadow. */
import { immutableJson } from '../../contracts/contract-values.js';
import { createEngineeringScopeRequest } from '../../core/engineering-scope/engineering-scope-contracts.js';
import {
  assertTopologyScopedEditReadModel,
  createTopologyScopedEditReadModel,
} from './topology-scoped-edit-read-model.js';
import { resolveTopologyNativeCommandTargets } from './topology-scoped-edit-command-targets.js';
import {
  createTopologyScopedEditShadowRuntime,
  runTopologyShadowPositiveParity,
} from './topology-scoped-edit-shadow-runtime.js';
import { topologyShadowSideEffectsAreZero } from './topology-scoped-edit-shadow-comparison.js';
import { asArray, cleanText, objectRecord, semanticHash, semanticStringify } from './topology-validator-values.js';

export const TOPOLOGY_PRODUCTION_SHADOW_V1 = 'TopologyProductionShadow.v1';
export const TOPOLOGY_PRODUCTION_SHADOW_DIAGNOSTIC_V1 = 'TopologyProductionShadowDiagnostic.v1';
export const TOPOLOGY_PRODUCTION_SHADOW_STATUS = Object.freeze({
  IDLE: 'IDLE', MOUNTED: 'MOUNTED', DEGRADED: 'DEGRADED', DESTROYED: 'DESTROYED',
});

const COLLECTIONS = Object.freeze(['nodes', 'edges', 'supports', 'rigids', 'junctions',
  'boundaries', 'bends', 'pointFeatures']);
const GEOMETRIC = Object.freeze(['nodes', 'supports', 'junctions', 'boundaries', 'bends', 'pointFeatures']);

function same(left, right) { return semanticStringify(left) === semanticStringify(right); }
function errorEvidence(error) { return { code: cleanText(error?.code) || error?.name || 'ERROR',
  message: error?.message ?? String(error) }; }
function totalEntities(readModel) {
  return COLLECTIONS.reduce((count, key) => count + asArray(readModel.canonicalTopology[key]).length, 0);
}
function geometricIds(readModel) {
  return GEOMETRIC.flatMap((key) => asArray(readModel.canonicalTopology[key]))
    .map((row) => cleanText(objectRecord(row).id)).filter(Boolean);
}
function scopeSeeds(readModel, requested = []) {
  const editable = new Set(readModel.commandScopeBasis.editableEntityIds);
  const seeds = [...new Set(asArray(requested).map(cleanText).filter((id) => editable.has(id)))];
  const geometric = new Set(geometricIds(readModel));
  const hasGeometricSeed = seeds.some((id) => geometric.has(id));
  const geometry = hasGeometricSeed ? null
    : [...geometric].find((id) => editable.has(id) && !seeds.includes(id));
  if (geometry) seeds.push(geometry);
  if (!seeds.length && readModel.selectionSnapshot.entityIds.length) {
    seeds.push(...readModel.selectionSnapshot.entityIds.filter((id) => editable.has(id)));
  }
  if (!seeds.length && readModel.commandScopeBasis.editableEntityIds.length) {
    seeds.push(readModel.commandScopeBasis.editableEntityIds[0]);
  }
  if (!seeds.length) throw new RangeError('Topology production shadow has no editable scope seed.');
  return Object.freeze(seeds.sort());
}
function scopeRequest(readModel, requested, kind = 'SELECTION') {
  const seeds = scopeSeeds(readModel, requested);
  const material = kind === 'STRUCTURAL'
    ? { structural: { identifiers: seeds } }
    : { selection: { entityIds: seeds, closureDepth: 0 } };
  return createEngineeringScopeRequest({ schema: 'EngineeringScopeRequest.v1', kind,
    boundaryPolicy: 'FROZEN', elementBudget: Math.max(1, totalEntities(readModel)), ...material });
}
function releaseComposition(value) {
  if (!value) return;
  try { value.composition.runtime.destroy(); } catch {}
  try { value.composition.directHost.destroy(); } catch {}
  try { value.composition.runtimeHost.destroy(); } catch {}
}
function exactMountEvidence(composition) {
  const directScene = composition.directHost.scene(), runtimeScene = composition.context.scene;
  const directScope = composition.directHost.resolveScope(composition.scopeRequest);
  const runtimeScope = composition.runtime.getState().scope;
  if (!same(directScene, runtimeScene) || !same(directScope, runtimeScope)) {
    throw new Error('Production shadow mount scene or scope parity differs.');
  }
  const sideEffects = composition.sideEffects();
  if (!topologyShadowSideEffectsAreZero(sideEffects)) throw new Error('Production shadow mount produced a forbidden side effect.');
  return immutableJson({ sceneHash: semanticHash(directScene), scopeHash: semanticHash(directScope),
    entityCount: directScene.entities.length, editableCount: directScope.entityIds.length,
    sideEffects }, 'Topology production shadow mount evidence');
}
function journalSuffix(previous, next) {
  const before = previous.commandJournal.entries, after = next.commandJournal.entries;
  if (after.length !== before.length + 1) return null;
  if (before.some((entry, index) => !same(entry, after[index]))) return null;
  return after.at(-1);
}
function targetIds(readModel, envelope, factories) {
  const command = objectRecord(objectRecord(envelope.payload).nativeCommand);
  if (!command.id || !command.type) return null;
  return factories.resolveTargets(command, readModel.canonicalTopology).entityIds;
}
function dragEntity(composition, ids) {
  for (const id of ids) {
    try { composition.directHost.entityGeometry(id); return id; } catch {}
  }
  throw new RangeError('No geometric editable entity is available for shadow drag preparation.');
}
async function buildMount(snapshot, authorityProvider, dependencies, factories, requested = [], kind = 'SELECTION') {
  const readModel = snapshot?.schema === 'TopologyScopedEditReadModel.v1'
    ? await factories.assertReadModel(snapshot, dependencies)
    : await factories.createReadModel(snapshot, dependencies);
  const request = scopeRequest(readModel, requested, kind);
  const composition = await factories.createShadow({ readModel, scopeRequest: request,
    authorityProvider }, dependencies);
  return Object.freeze({ readModel, request, composition,
    mountEvidence: exactMountEvidence(composition) });
}
async function compareTransition(previous, next, authorityProvider, dependencies, factories) {
  const envelope = journalSuffix(previous.readModel, next.readModel);
  if (!envelope || envelope.commandType !== 'TOPOLOGY_COMMAND') {
    return immutableJson({ status: 'SKIPPED', reason: 'Transition is not one appended native command.' },
      'Topology production shadow transition diagnostic');
  }
  const ids = targetIds(previous.readModel, envelope, factories);
  if (!ids?.length) return immutableJson({ status: 'SKIPPED', reason: 'Native command has no scene target.' },
    'Topology production shadow transition diagnostic');
  let temporary = null;
  try {
    temporary = await buildMount(previous.readModel, () => previous.readModel.authorityId,
      dependencies, factories, ids, 'STRUCTURAL');
    const dragId = dragEntity(temporary.composition,
      temporary.composition.runtime.getState().scope.entityIds);
    const result = factories.runPositive(temporary.composition, { envelope, targetIds: ids,
      dragEntityId: dragId, commandName: envelope.commandType });
    const candidate = result.direct.evidence;
    if (!same(candidate.candidateProjection, next.readModel.journalProjection.projection)
      || !same(candidate.candidateReplay, next.readModel.replayState)) {
      throw new Error('Accepted Topology transition differs from the shadow candidate.');
    }
    return immutableJson({ status: 'PASS', commandId: envelope.commandId,
      nativeCommandType: objectRecord(objectRecord(envelope.payload).nativeCommand).type,
      projectionHash: candidate.projectionHash, replayHash: candidate.candidateReplayHash },
    'Topology production shadow transition diagnostic');
  } finally { releaseComposition(temporary); }
}
function defaultFactories() {
  return Object.freeze({ createReadModel: createTopologyScopedEditReadModel,
    assertReadModel: assertTopologyScopedEditReadModel, createShadow: createTopologyScopedEditShadowRuntime,
    runPositive: runTopologyShadowPositiveParity,
    resolveTargets: resolveTopologyNativeCommandTargets });
}
function createWithFactories(input, dependencies, factories) {
  if (typeof input.snapshotProvider !== 'function') throw new TypeError('Production shadow requires snapshotProvider().');
  if (typeof input.authorityProvider !== 'function') throw new TypeError('Production shadow requires authorityProvider().');
  if (input.snapshotKeyProvider != null && typeof input.snapshotKeyProvider !== 'function') {
    throw new TypeError('snapshotKeyProvider must be a function when supplied.');
  }
  let current = null, destroyed = false, status = TOPOLOGY_PRODUCTION_SHADOW_STATUS.IDLE;
  let lastDiagnostic = null, history = Object.freeze([]), queue = Promise.resolve(), sequence = 0;
  function publish(kind, nextStatus, authorityId, detail = {}) {
    status = nextStatus;
    lastDiagnostic = immutableJson({ schema: TOPOLOGY_PRODUCTION_SHADOW_DIAGNOSTIC_V1,
      sequence: ++sequence, kind, status, authorityId: cleanText(authorityId), ...detail },
    'Topology production shadow diagnostic');
    history = Object.freeze([...history.slice(-49), lastDiagnostic]);
    try { input.onDiagnostic?.(lastDiagnostic); } catch {}
    return lastDiagnostic;
  }
  function evidence() {
    return immutableJson({ schema: TOPOLOGY_PRODUCTION_SHADOW_V1, status,
      authorityId: current?.readModel.authorityId ?? '', mounted: Boolean(current), destroyed,
      mountKey: current?.key ?? '', lastDiagnostic, history }, 'Topology production shadow evidence');
  }
  function schedule(action) {
    const task = queue.then(action, action); queue = task.catch(() => {}); return task;
  }
  async function observe() {
    return schedule(async () => {
      if (destroyed) return evidence();
      let sourceKey = '';
      try { sourceKey = cleanText(input.snapshotKeyProvider?.()); }
      catch (error) {
        publish('KEY', TOPOLOGY_PRODUCTION_SHADOW_STATUS.DEGRADED, '', { error: errorEvidence(error) });
        return evidence();
      }
      if (sourceKey && current?.key === sourceKey) return evidence();
      let snapshot;
      try { snapshot = await input.snapshotProvider(); }
      catch (error) {
        if (destroyed) return evidence();
        publish('SNAPSHOT', TOPOLOGY_PRODUCTION_SHADOW_STATUS.DEGRADED, '', { error: errorEvidence(error) });
        return evidence();
      }
      if (destroyed) return evidence();
      if (!snapshot) {
        if (!current && status === TOPOLOGY_PRODUCTION_SHADOW_STATUS.IDLE) return evidence();
        releaseComposition(current); current = null;
        publish('MOUNT', TOPOLOGY_PRODUCTION_SHADOW_STATUS.IDLE, '', { reason: 'Edit authority is not initialized.' });
        return evidence();
      }
      const key = sourceKey || semanticHash({ authorityId: snapshot.authority?.authorityId ?? snapshot.authorityId,
        selection: snapshot.selectionSnapshot?.entityIds, scope: snapshot.commandScopeBasis });
      if (current?.key === key) return evidence();
      let next = null;
      try {
        next = await buildMount(snapshot, input.authorityProvider, dependencies, factories,
          snapshot.selectionSnapshot?.entityIds ?? []);
        if (destroyed) { releaseComposition(next); return evidence(); }
        let transition = immutableJson({ status: 'SKIPPED', reason: 'Initial production shadow mount.' },
          'Topology production shadow transition diagnostic');
        if (current) {
          try { transition = await compareTransition(current, next, input.authorityProvider,
            dependencies, factories); }
          catch (error) { transition = immutableJson({ status: 'FAIL', error: errorEvidence(error) },
            'Topology production shadow transition diagnostic'); }
        }
        if (destroyed) { releaseComposition(next); return evidence(); }
        releaseComposition(current); current = Object.freeze({ ...next, key });
        const nextStatus = transition.status === 'FAIL'
          ? TOPOLOGY_PRODUCTION_SHADOW_STATUS.DEGRADED
          : TOPOLOGY_PRODUCTION_SHADOW_STATUS.MOUNTED;
        publish('MOUNT', nextStatus, next.readModel.authorityId,
          { mount: next.mountEvidence, transition });
      } catch (error) {
        releaseComposition(next);
        if (destroyed) return evidence();
        if (current && current.readModel.authorityId !== snapshot.authority?.authorityId) {
          releaseComposition(current); current = null;
        }
        publish('MOUNT', TOPOLOGY_PRODUCTION_SHADOW_STATUS.DEGRADED,
          snapshot.authority?.authorityId, { error: errorEvidence(error) });
      }
      return evidence();
    });
  }
  function destroy() {
    if (destroyed) return evidence();
    destroyed = true; releaseComposition(current); current = null;
    publish('LIFECYCLE', TOPOLOGY_PRODUCTION_SHADOW_STATUS.DESTROYED, '', {});
    return evidence();
  }
  return Object.freeze({ observe, evidence, destroy });
}

export function createTopologyScopedEditProductionShadow(input = {}, dependencies = {}) {
  return createWithFactories(input, dependencies, defaultFactories());
}

export const _test = Object.freeze({ createWithFactories, scopeSeeds, scopeRequest, journalSuffix,
  exactMountEvidence, compareTransition, releaseComposition, dragEntity });
