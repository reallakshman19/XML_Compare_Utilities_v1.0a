import assert from 'node:assert/strict';
import { TOPOLOGY_NATIVE_TARGET_RESOLVER_TYPES, resolveTopologyAttributeTargets,
  resolveTopologyNativeCommandTargets, resolveTopologyRemarkTargets } from '../tabs/topology-trace-validator/topology-scoped-edit-command-targets.js';
const p = (branch, child) => `$[${branch}].children[${child}]`;
const canonical = Object.freeze({ nodes: Object.freeze([{ id: 'N1', sourcePaths: [p(0, 0)] }, { id: 'N2', sourcePaths: [p(0, 0)] },
  { id: 'N3', sourcePaths: [p(1, 0)] }, { id: 'N4', sourcePaths: [p(1, 0)] }]),
  edges: Object.freeze([{ id: 'E1', fromNodeId: 'N1', toNodeId: 'N2', sourcePaths: [p(0, 0)] },
    { id: 'E2', fromNodeId: 'N3', toNodeId: 'N4', sourcePaths: [p(1, 0)] }]),
  supports: [], rigids: [], junctions: [], boundaries: [], bends: [], pointFeatures: [] });
const cases = [['MOVE_NODE', { nodeId: 'N1', position: { x: 1, y: 2, z: 3 } }, ['N1']],
  ['MERGE_NODES', { sourceNodeId: 'N1', targetNodeId: 'N2' }, ['N1', 'N2']],
  ['BRIDGE_GAP', { fromNodeId: 'N1', toNodeId: 'N3', contextEdgeId: 'E1' }, ['E1', 'N1', 'N3']],
  ['ADD_STRAIGHT_ELEMENT', { fromNodeId: 'N1', toNodeId: 'N2', contextEdgeId: 'E1' }, ['E1', 'N1', 'N2']],
  ['SPLIT_EDGE', { edgeId: 'E1', fraction: 0.5 }, ['E1']], ['DISCONNECT_ENDPOINT', { edgeId: 'E1', endpoint: 'FROM' }, ['E1', 'N1']],
  ['DELETE_EDGE', { edgeId: 'E1' }, ['E1']], ['ADD_BEND_DEFINITION', { nodeId: 'N1', edgeIds: ['E1'] }, ['E1', 'N1']],
  ['ADD_JUNCTION_DEFINITION', { nodeId: 'N1', edgeIds: ['E1', 'E2'] }, ['E1', 'E2', 'N1']],
  ['TRIM_EDGE', { edgeId: 'E1', endpoint: 'TO', position: { x: 1, y: 0, z: 0 } }, ['E1', 'N2']]];
for (const [type, payload, ids] of cases) assert.deepEqual(resolveTopologyNativeCommandTargets({ type, payload }, canonical).entityIds, [...ids].sort(), type);
const tx = resolveTopologyNativeCommandTargets({ type: 'TRANSACTION', payload: { operations: [
  { type: 'MOVE_NODE', payload: { nodeId: 'N1' } }, { type: 'DELETE_EDGE', payload: { edgeId: 'E2' } }] } }, canonical);
assert.equal(tx.childTargets.length, 2); assert.deepEqual(tx.entityIds, ['E2', 'N1']); assert.equal(TOPOLOGY_NATIVE_TARGET_RESOLVER_TYPES.length, 11);
assert.throws(() => resolveTopologyNativeCommandTargets({ type: 'UNKNOWN', payload: { nodeId: 'N1' } }, canonical),
  (error) => error.code === 'UNSUPPORTED_COMMAND_TARGET_RESOLVER');
assert.throws(() => resolveTopologyNativeCommandTargets({ type: 'TRANSACTION', payload: { operations: [
  { type: 'MOVE_NODE', payload: { nodeId: 'N1' } }, { type: 'UNKNOWN', payload: {} }] } }, canonical),
  (error) => error.code === 'UNSUPPORTED_COMMAND_TARGET_RESOLVER');
const attribute = resolveTopologyAttributeTargets({ sourcePath: p(1, 0), branchIndex: 1 }, canonical);
assert.deepEqual(attribute.sourceBranchIndexes, [1]); assert.deepEqual(attribute.entityIds, ['E2', 'N3', 'N4']);
const replayState = { draft: { commands: [{ id: 'EC-1', type: 'MOVE_NODE', payload: { nodeId: 'N3' } }] }, attributeLedger: { edits: [] } };
assert.deepEqual(resolveTopologyRemarkTargets('EC-1', canonical, replayState).entityIds, ['N3']);
console.log('[PASS] 11 explicit native resolvers, transactions, attributes, and remarks');
