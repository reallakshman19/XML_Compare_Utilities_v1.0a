import { freezeJsonValue } from '../engineering-scene/index.js';
import { ENGINEERING_SVG_ADAPTER_ACCESS_MODE } from '../engineering-scene/engineering-adapter-contracts.js';
import { engineeringRevisionTokensEqual } from './engineering-svg-command-gateway.js';
import { ENGINEERING_SVG_ADAPTER_SCHEMA } from './engineering-svg-adapter.js';
import { createEngineeringSvgAdapterBridge } from './engineering-svg-adapter-bridge.js';

export const ENGINEERING_SVG_ADAPTER_CONFORMANCE_SCHEMA = 'EngineeringSvgAdapterConformanceReport.v1';

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function check(id, execute) {
  return Promise.resolve().then(execute).then(
    (evidence) => freezeJsonValue({ id, status: 'pass', evidence: evidence ?? {} }),
    (error) => freezeJsonValue({ id, status: 'fail', evidence: {}, message: String(error?.message || error) }),
  );
}

function selectableEntityIds(scene, requested) {
  if (requested != null) {
    if (!Array.isArray(requested)) throw new TypeError('Conformance entityIds must be an array.');
    return [...requested].map(String).sort();
  }
  return scene.entities.filter((entity) => entity.selectable).map((entity) => entity.id).sort();
}

function assertPropertyCoverage(propertySets, entityIds, revision) {
  propertySets.forEach((set) => {
    if (!engineeringRevisionTokensEqual(set.revision, revision)) {
      throw new Error(`Property set "${set.id}" does not match the tested scene revision.`);
    }
  });
  const owners = new Set(propertySets.flatMap((set) => set.ownerIds));
  entityIds.forEach((id) => {
    if (!owners.has(id)) throw new Error(`Property provider did not cover selected entity "${id}".`);
  });
  return { propertySetIds: propertySets.map((set) => set.id).sort(), ownerIds: [...owners].sort() };
}

export async function runEngineeringSvgAdapterConformance(adapter, options = {}) {
  if (adapter?.schema !== ENGINEERING_SVG_ADAPTER_SCHEMA) {
    throw new TypeError('Adapter conformance requires EngineeringSvgAdapter.v1.');
  }
  let firstScene = null;
  let bridge = null;
  const checks = [];

  checks.push(await check('descriptor-access-boundary', () => {
    const editable = adapter.descriptor.accessMode === ENGINEERING_SVG_ADAPTER_ACCESS_MODE.EDITABLE;
    if (editable !== Boolean(adapter.commandGateway)) throw new Error('Adapter access mode and command boundary disagree.');
    return { accessMode: adapter.descriptor.accessMode, commandBoundary: editable };
  }));

  checks.push(await check('stable-scene-snapshot', async () => {
    firstScene = await adapter.getScene();
    const repeated = await adapter.getScene();
    if (canonicalJson(firstScene) !== canonicalJson(repeated)) {
      throw new Error('Repeated adapter scene snapshots differ without an intervening event.');
    }
    return { sceneId: firstScene.sceneId, revision: firstScene.revision, entityCount: firstScene.entities.length };
  }));

  checks.push(await check('scene-source-bridge', async () => {
    if (!firstScene) firstScene = await adapter.getScene();
    bridge = await createEngineeringSvgAdapterBridge(adapter);
    const snapshot = bridge.getDependencies().sceneSource.getSnapshot();
    if (canonicalJson(snapshot) !== canonicalJson(firstScene)) {
      throw new Error('Adapter bridge changed the authoritative scene snapshot.');
    }
    return { sceneId: snapshot.sceneId, revision: snapshot.revision };
  }));

  checks.push(await check('property-provider-coverage', async () => {
    if (!firstScene) firstScene = await adapter.getScene();
    const entityIds = selectableEntityIds(firstScene, options.entityIds);
    const sets = await adapter.propertyProvider.getPropertySets(entityIds, firstScene.revision);
    return { entityIds, ...assertPropertyCoverage(sets, entityIds, firstScene.revision) };
  }));

  checks.push(await check('snap-provider-identity', () => ({
    providerIds: adapter.snapProviders.map((provider) => provider.id),
  })));

  if (options.referenceRequest != null) {
    checks.push(await check('reference-vector', () => {
      if (!adapter.resolveReferenceVector) throw new Error('Conformance reference request requires an adapter resolver.');
      return { vector: adapter.resolveReferenceVector(options.referenceRequest) };
    }));
  }

  const bridgeRejectedEvent = bridge?.getLastRejectedEvent() ?? null;
  bridge?.dispose();
  const orderedChecks = [...checks].sort((left, right) => left.id.localeCompare(right.id));
  const failed = orderedChecks.filter((entry) => entry.status === 'fail');
  return freezeJsonValue({
    schema: ENGINEERING_SVG_ADAPTER_CONFORMANCE_SCHEMA,
    adapter: adapter.descriptor,
    testedRevision: firstScene?.revision ?? null,
    passed: failed.length === 0,
    checks: orderedChecks,
    rejectedEvent: bridgeRejectedEvent,
  });
}
