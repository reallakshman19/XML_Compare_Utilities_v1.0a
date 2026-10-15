import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dispatchTopologyEditOperation } from '../tabs/topology-trace-validator/topology-edit-operation-dispatch.js';

function inspectorFixture(values) {
  return Object.freeze({
    querySelector(selector) {
      const value = values[selector];
      return value === undefined ? null : Object.freeze({ value: String(value) });
    },
  });
}

const inspector = inspectorFixture({
  '[data-ttv-edit-coordinate="x"]': 101,
  '[data-ttv-edit-coordinate="y"]': 202,
  '[data-ttv-edit-coordinate="z"]': 303,
});
let exported = null;
let nativeExecuted = false;
await dispatchTopologyEditOperation({
  operation: 'MOVE_SEQUENTIAL_REQUEST',
  selection: Object.freeze([Object.freeze({ kind: 'node', id: 'CN-9' })]),
  contextEdgeId: '',
  inspector,
  execute: async () => { nativeExecuted = true; },
  exportSequentialMoveNodeRequest: async (value) => { exported = value; },
});
assert.equal(nativeExecuted, false, 'request export must not publish a native topology command');
assert.deepEqual(exported, {
  nodeId: 'CN-9',
  targetPosition: { x: 101, y: 202, z: 303 },
});

const registry = await readFile(new URL('../tabs/topology-trace-validator/topology-edit-inspector-registry.js', import.meta.url), 'utf8');
const controller = await readFile(new URL('../tabs/topology-trace-validator/topology-edit-controller.js', import.meta.url), 'utf8');
assert.match(registry, /MOVE_SEQUENTIAL_REQUEST/);
assert.match(registry, /Download Sequential stretch request/);
assert.match(controller, /createTopologySequentialMoveNodeRequest/);
assert.match(controller, /exportSequentialMoveNodeRequest/);
assert.doesNotMatch(controller, /set3dVisible\([^)]*\)\s*\{[^}]*Sequential/i);

console.log('[PASS] node inspector routes a non-publishing Sequential request export');
