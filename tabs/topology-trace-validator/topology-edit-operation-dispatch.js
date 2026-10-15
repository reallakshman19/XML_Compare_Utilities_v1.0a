/** Validate inspector inputs and dispatch one explicit topology edit operation. */

import { cleanText } from './topology-validator-values.js';

function requiredNumber(inspector, selector, label) {
  const value = inspector.querySelector(selector)?.value?.trim();
  if (!value) throw new Error(`${label} is required.`);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be a finite number.`);
  return number;
}

function readPosition(inspector, prefix) {
  return Object.fromEntries(['x', 'y', 'z'].map((axis) => [axis,
    requiredNumber(inspector, `[data-ttv-edit-${prefix}="${axis}"]`, `${prefix} ${axis.toUpperCase()}`)]));
}

function selectedRows(input) {
  return {
    nodes: input.selection.filter((row) => row.kind === 'node'),
    edges: input.selection.filter((row) => row.kind === 'edge'),
  };
}

function requireCount(rows, count, message) {
  if (rows.length !== count) throw new Error(message);
  return rows;
}

async function dispatchNodeOperation(input, nodes) {
  if (input.operation === 'MOVE_EXACT') {
    requireCount(nodes, 1, 'Exact XYZ requires exactly one selected node.');
    await input.execute('MOVE_NODE', { nodeId: nodes[0].id,
      position: readPosition(input.inspector, 'coordinate') });
    return true;
  }
  if (input.operation === 'MOVE_SEQUENTIAL_REQUEST') {
    requireCount(nodes, 1, 'Sequential stretch request requires exactly one selected node.');
    if (typeof input.exportSequentialMoveNodeRequest !== 'function') {
      throw new TypeError('Sequential stretch request export is unavailable.');
    }
    await input.exportSequentialMoveNodeRequest({ nodeId: nodes[0].id,
      targetPosition: readPosition(input.inspector, 'coordinate') });
    return true;
  }
  return false;
}

async function dispatchConnectionOperation(input, nodes) {
  if (input.operation === 'MERGE') {
    requireCount(nodes, 2, 'Merge requires exactly two selected nodes; the second node is retained.');
    await input.execute('MERGE_NODES', { sourceNodeId: nodes[0].id, targetNodeId: nodes[1].id });
    return true;
  }
  if (input.operation === 'BRIDGE') {
    requireCount(nodes, 2, 'Bridge requires exactly two selected nodes.');
    if (!input.contextEdgeId) throw new Error('Bridge requires an explicit engineering context edge.');
    await input.execute('BRIDGE_GAP', { fromNodeId: nodes[0].id,
      toNodeId: nodes[1].id, contextEdgeId: input.contextEdgeId });
    return true;
  }
  return false;
}

function edgeSelectionMessage(operation) {
  const labels = { DELETE: 'Delete', SPLIT: 'Split', DISCONNECT: 'Disconnect' };
  return `${labels[operation]} requires exactly one selected edge.`;
}

async function dispatchEdgeOperation(input, edges) {
  requireCount(edges, 1, edgeSelectionMessage(input.operation));
  const edgeId = edges[0].id;
  if (input.operation === 'DELETE') await input.execute('DELETE_EDGE', { edgeId });
  else if (input.operation === 'SPLIT') await input.execute('SPLIT_EDGE', { edgeId,
    fraction: requiredNumber(input.inspector, '[data-ttv-edit-split-fraction]', 'Split fraction') });
  else if (input.operation === 'DISCONNECT') {
    const endpoint = cleanText(input.inspector
      .querySelector('[data-ttv-edit-disconnect-endpoint]')?.value) || 'FROM';
    await input.execute('DISCONNECT_ENDPOINT', { edgeId, endpoint });
  } else return false;
  return true;
}

async function dispatchAddOperation(input, nodes) {
  if (input.operation !== 'ADD') return false;
  requireCount(nodes, 1, 'Add straight element requires exactly one selected start node.');
  if (!input.contextEdgeId) throw new Error('Add straight element requires an explicit engineering context edge.');
  await input.execute('ADD_STRAIGHT_ELEMENT', { fromNodeId: nodes[0].id,
    toPosition: readPosition(input.inspector, 'target'), contextEdgeId: input.contextEdgeId });
  return true;
}

/** Dispatch one validated operation through the controller command callback. */
export async function dispatchTopologyEditOperation(input) {
  const { nodes, edges } = selectedRows(input);
  if (await dispatchNodeOperation(input, nodes)) return;
  if (await dispatchConnectionOperation(input, nodes)) return;
  if (['DELETE', 'SPLIT', 'DISCONNECT'].includes(input.operation)
    && await dispatchEdgeOperation(input, edges)) return;
  if (await dispatchAddOperation(input, nodes)) return;
  throw new RangeError(`Unsupported edit operation ${input.operation}.`);
}
