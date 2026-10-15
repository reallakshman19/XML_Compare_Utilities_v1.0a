import assert from 'node:assert/strict';
import {
  createEngineeringCommandResult,
  createEngineeringEditIntent,
  createEngineeringPropertyField,
  createEngineeringPropertySet,
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
} from '../core/engineering-scene/index.js';
import { createEngineeringSvgCommandGateway } from '../core/engineering-svg/engineering-svg-command-gateway.js';
import { createEngineeringSvgPropertyProvider } from '../core/engineering-svg/engineering-svg-property-provider.js';
import { createEngineeringSvgSnapProvider } from '../core/engineering-svg/engineering-svg-snap-provider.js';
import {
  createEngineeringSvgAdapter,
  createEngineeringSvgAdapterBridge,
  runEngineeringSvgAdapterConformance,
} from '../core/engineering-svg/adapter-runtime.js';

function scene(revision, x = 0) {
  return createEngineeringScene({
    sceneId: 'adapter-scene',
    revision,
    projections: ['XY', 'ISO'],
    entities: ['a', 'b'].map((id, index) => createEngineeringSceneEntity({
      id,
      kind: 'point',
      domainType: 'SYNTHETIC_POINT',
      geometry: createPointGeometry({ x: x + index, y: index, z: 0 }),
      domainRef: { owner: 'synthetic-adapter', id },
    })),
  });
}

function propertyProvider(getRevision) {
  return createEngineeringSvgPropertyProvider({
    getPropertySets({ selectedIds, revision }) {
      assert.deepEqual(revision, getRevision());
      return selectedIds.map((id) => createEngineeringPropertySet({
        id: `properties:${id}`,
        revision,
        ownerIds: [id],
        fields: [createEngineeringPropertyField({
          key: 'label', label: 'Label', type: 'text', scope: 'ENTITY', value: id, editable: true,
        })],
      }));
    },
  });
}

function domain(accessMode = 'read-only') {
  let currentRevision = createEngineeringRevisionToken('adapter-r1');
  let currentScene = scene(currentRevision);
  const listeners = new Set();
  const provider = propertyProvider(() => currentRevision);
  let editCalls = 0;
  const gateway = createEngineeringSvgCommandGateway({
    getCurrentRevision: () => currentRevision,
    execute(intent) {
      editCalls += 1;
      currentRevision = createEngineeringRevisionToken(`adapter-r${editCalls + 1}`);
      currentScene = scene(currentRevision, editCalls * 10);
      return createEngineeringCommandResult({
        operationId: intent.operationId,
        status: 'committed',
        resultingRevision: currentRevision,
      });
    },
  });
  const snap = createEngineeringSvgSnapProvider({ id: 'synthetic-endpoints', provide: () => [] });
  const adapter = createEngineeringSvgAdapter({
    descriptor: {
      adapterId: `synthetic-${accessMode}`,
      domainType: 'SYNTHETIC_DOMAIN',
      accessMode,
      projections: ['ISO', 'XY'],
      capabilities: { properties: true, snap: true },
    },
    getScene: () => currentScene,
    subscribeScene(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    propertyProvider: provider,
    commandGateway: accessMode === 'editable' ? gateway : undefined,
    snapProviders: [snap],
    resolveReferenceVector: () => ({ x: 1, y: 2, z: 0 }),
  });
  return {
    adapter,
    emit(value) { listeners.forEach((listener) => listener(value)); },
    listenerCount: () => listeners.size,
    revision: () => currentRevision,
    editCalls: () => editCalls,
  };
}

const readOnly = domain('read-only');
assert.equal(readOnly.adapter.commandGateway, null);
assert.throws(() => createEngineeringSvgAdapter({
  descriptor: { adapterId: 'invalid-read', domainType: 'TEST', accessMode: 'read-only' },
  getScene: readOnly.adapter.getScene,
  subscribeScene: readOnly.adapter.subscribeScene,
  propertyProvider: readOnly.adapter.propertyProvider,
  commandGateway: createEngineeringSvgCommandGateway({
    getCurrentRevision: readOnly.revision,
    execute: () => { throw new Error('not used'); },
  }),
}), /cannot expose a command gateway/);

assert.throws(() => createEngineeringSvgAdapter({
  descriptor: { adapterId: 'invalid-edit', domainType: 'TEST', accessMode: 'editable' },
  getScene: readOnly.adapter.getScene,
  subscribeScene: readOnly.adapter.subscribeScene,
  propertyProvider: readOnly.adapter.propertyProvider,
}), /require EngineeringSvgCommandGateway/);

const bridge = await createEngineeringSvgAdapterBridge(readOnly.adapter);
const source = bridge.getDependencies().sceneSource;
const original = source.getSnapshot();
readOnly.emit({ scene: { bad: true }, reason: 'malformed-test' });
assert.equal(source.getSnapshot(), original);
assert.equal(bridge.getLastRejectedEvent().reason, 'malformed-test');
const nextRevision = createEngineeringRevisionToken('adapter-r-event');
const nextScene = scene(nextRevision, 20);
readOnly.emit({ scene: nextScene, reason: 'valid-test' });
assert.deepEqual(source.getSnapshot(), nextScene);
assert.equal(bridge.getLastRejectedEvent(), null);
assert.equal(readOnly.listenerCount(), 1);
assert.equal(bridge.dispose(), true);
assert.equal(readOnly.listenerCount(), 0);

const report = await runEngineeringSvgAdapterConformance(readOnly.adapter, {
  referenceRequest: { kind: 'path', referenceId: 'synthetic-path' },
});
assert.equal(report.passed, true);
assert.deepEqual(report.checks.map((entry) => entry.id), [...report.checks.map((entry) => entry.id)].sort());
assert.equal(readOnly.listenerCount(), 0);
assert.deepEqual(JSON.parse(JSON.stringify(report)), report);

const editable = domain('editable');
const editableReport = await runEngineeringSvgAdapterConformance(editable.adapter);
assert.equal(editableReport.passed, true);
const baseRevision = editable.revision();
const result = await editable.adapter.commandGateway.execute(createEngineeringEditIntent({
  type: 'SET_PROPERTIES',
  operationId: 'adapter-edit-1',
  baseRevision,
  entityIds: ['a'],
  changes: { properties: { label: 'updated' } },
  source: { interaction: 'adapter-conformance' },
}));
assert.equal(result.status, 'committed');
assert.equal(editable.editCalls(), 1);

assert.throws(() => createEngineeringSvgAdapter({
  descriptor: { adapterId: 'duplicate-snap', domainType: 'TEST' },
  getScene: readOnly.adapter.getScene,
  subscribeScene: readOnly.adapter.subscribeScene,
  propertyProvider: readOnly.adapter.propertyProvider,
  snapProviders: [readOnly.adapter.snapProviders[0], readOnly.adapter.snapProviders[0]],
}), /IDs must be unique/);

const zeroResolver = createEngineeringSvgAdapter({
  descriptor: { adapterId: 'zero-vector', domainType: 'TEST' },
  getScene: readOnly.adapter.getScene,
  subscribeScene: readOnly.adapter.subscribeScene,
  propertyProvider: readOnly.adapter.propertyProvider,
  resolveReferenceVector: () => ({ x: 0, y: 0, z: 0 }),
});
assert.throws(() => zeroResolver.resolveReferenceVector({ kind: 'path', referenceId: 'x' }), /non-zero/);

console.log('engineering SVG adapter conformance: ok');
