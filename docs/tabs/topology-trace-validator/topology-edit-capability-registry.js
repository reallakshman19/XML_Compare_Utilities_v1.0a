/** Declarative Edit Draft commands and contextual availability rules. */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

function capability(input) { return Object.freeze(input); }

export const EDIT_TOOL_CAPABILITIES = Object.freeze([
  capability({ id: 'tool.select', action: 'TOOL', value: 'SELECT', label: 'Select', title: 'Select scene objects', shortcut: 'V', rule: 'INITIALIZED' }),
  capability({ id: 'tool.move', action: 'TOOL', value: 'MOVE', label: 'Move', title: 'Drag a node; X/Y/Z locks an axis; drop on a node to merge', shortcut: 'G', rule: 'INITIALIZED' }),
  capability({ id: 'tool.connect', action: 'TOOL', value: 'CONNECT', label: 'Connect', title: 'Drag node to node to bridge a gap', shortcut: 'C', rule: 'INITIALIZED' }),
  capability({ id: 'tool.add', action: 'TOOL', value: 'ADD', label: 'Add', title: 'Drag from a node to add a straight element', shortcut: 'A', rule: 'INITIALIZED' }),
  capability({ id: 'tool.split', action: 'TOOL', value: 'SPLIT', label: 'Break', title: 'Click an edge to split at the picked point', shortcut: 'B', rule: 'INITIALIZED' }),
  capability({ id: 'tool.measure', action: 'TOOL', value: 'MEASURE', label: 'Measure', title: 'Click component surfaces for segment and total distances', shortcut: 'M', rule: 'INITIALIZED' }),
]);

export const EDIT_OPERATION_CAPABILITIES = Object.freeze([
  capability({ id: 'operation.merge', action: 'OPERATION', value: 'MERGE', label: 'Snap / Merge', title: 'Merge exactly two selected nodes', shortcut: '', rule: 'TWO_NODES' }),
  capability({ id: 'operation.merge-request', action: 'OPERATION', value: 'MERGE_SEQUENTIAL_REQUEST', label: 'Export Merge', title: 'Download a non-publishing Sequential merge request for two selected nodes', shortcut: '', rule: 'EXACT_TWO_NODES' }),
  capability({ id: 'operation.bridge-request', action: 'OPERATION', value: 'BRIDGE_SEQUENTIAL_REQUEST', label: 'Export Bridge', title: 'Download a non-publishing Sequential bridge request for two selected nodes and the current context edge', shortcut: '', rule: 'EXACT_TWO_NODES_WITH_CONTEXT' }),
  capability({ id: 'operation.disconnect', action: 'OPERATION', value: 'DISCONNECT', label: 'Disconnect', title: 'Disconnect the selected edge endpoint', shortcut: '', rule: 'ONE_EDGE' }),
  capability({ id: 'operation.delete', action: 'OPERATION', value: 'DELETE', label: 'Delete', title: 'Delete the selected edge', shortcut: 'Delete', rule: 'ONE_EDGE' }),
]);

export const EDIT_SHELL_CAPABILITIES = Object.freeze([
  capability({ id: 'history.undo', action: 'UNDO', value: '', label: 'Undo', title: 'Undo the latest journal command', shortcut: 'Control+Z', rule: 'CAN_UNDO', legacy: 'data-ttv-edit-undo' }),
  capability({ id: 'history.redo', action: 'REDO', value: '', label: 'Redo', title: 'Redo the latest undone command', shortcut: 'Control+Y', rule: 'CAN_REDO', legacy: 'data-ttv-edit-redo' }),
  capability({ id: 'view.zoom-in', action: 'ZOOM_IN', value: '', label: '+', title: 'Zoom in', shortcut: '+', rule: 'INITIALIZED' }),
  capability({ id: 'view.zoom-out', action: 'ZOOM_OUT', value: '', label: '−', title: 'Zoom out', shortcut: '-', rule: 'INITIALIZED' }),
  capability({ id: 'view.fit', action: 'FIT', value: '', label: 'Fit', title: 'Fit all scene objects', shortcut: 'F', rule: 'INITIALIZED' }),
  capability({ id: 'scene.previous', action: 'PREVIOUS', value: '', label: '‹', title: 'Select the previous scene object', shortcut: '[', rule: 'INITIALIZED' }),
  capability({ id: 'scene.next', action: 'NEXT', value: '', label: '›', title: 'Select the next scene object', shortcut: ']', rule: 'INITIALIZED' }),
  capability({ id: 'scene.focus', action: 'FOCUS', value: '', label: 'Focus', title: 'Fit the selected scene object', shortcut: 'Enter', rule: 'HAS_SELECTION' }),
]);

export const EDIT_CAPABILITIES = Object.freeze([...EDIT_TOOL_CAPABILITIES, ...EDIT_OPERATION_CAPABILITIES, ...EDIT_SHELL_CAPABILITIES]);

/** Normalize controller evidence or an explicit controller context. */
export function topologyEditCapabilityContext(input) {
  const value = objectRecord(input), journal = objectRecord(value.commandJournal);
  return Object.freeze({
    initialized: Boolean(value.initialized ?? value.editedArtifacts), busy: Boolean(value.busy),
    selection: Object.freeze(asArray(value.selection)), tool: cleanText(value.tool) || 'SELECT',
    contextEdgeId: cleanText(value.contextEdgeId),
    canUndo: Boolean(value.canUndo ?? asArray(journal.activeCommandIds).length),
    canRedo: Boolean(value.canRedo ?? asArray(journal.redoCommandIds).length),
  });
}

function ruleResult(rule, context) {
  const nodes = context.selection.filter((row) => row.kind === 'node').length;
  const edges = context.selection.filter((row) => row.kind === 'edge').length;
  if (context.busy) return { enabled: false, reason: 'Wait for the active transaction.' };
  if (rule === 'INITIALIZED') return { enabled: context.initialized, reason: 'Initialize Edit Draft first.' };
  if (rule === 'TWO_NODES') return { enabled: context.initialized && nodes === 2, reason: 'Select exactly two nodes.' };
  if (rule === 'EXACT_TWO_NODES') return { enabled: context.initialized && context.selection.length === 2 && nodes === 2, reason: 'Select exactly two nodes and no other objects.' };
  if (rule === 'EXACT_TWO_NODES_WITH_CONTEXT') return {
    enabled: context.initialized && context.selection.length === 2 && nodes === 2
      && Boolean(context.contextEdgeId),
    reason: 'Select exactly two nodes and establish one context edge.',
  };
  if (rule === 'ONE_EDGE') return { enabled: context.initialized && edges === 1, reason: 'Select exactly one edge.' };
  if (rule === 'CAN_UNDO') return { enabled: context.canUndo, reason: 'No command is available to undo.' };
  if (rule === 'CAN_REDO') return { enabled: context.canRedo, reason: 'No command is available to redo.' };
  if (rule === 'HAS_SELECTION') return { enabled: context.initialized && context.selection.length > 0, reason: 'Select a scene object first.' };
  throw new RangeError(`Unknown edit capability rule ${rule}.`);
}

export function evaluateTopologyEditCapabilities(input) {
  const context = topologyEditCapabilityContext(input);
  return Object.freeze(Object.fromEntries(EDIT_CAPABILITIES.map((entry) => {
    const result = ruleResult(entry.rule, context);
    return [entry.id, Object.freeze({ ...result, active: entry.action === 'TOOL' && entry.value === context.tool })];
  })));
}

/** Render registry descriptors; labels/titles are trusted static application text. */
export function topologyEditCapabilityButtonsMarkup(capabilities, activeId) {
  return capabilities.map((entry) => {
    const active = entry.id === activeId ? ' is-active' : '';
    const legacy = entry.legacy ? ` ${entry.legacy}` : '';
    const shortcut = entry.shortcut ? ` aria-keyshortcuts="${entry.shortcut}"` : '';
    const tool = entry.action === 'TOOL' ? ` data-ttv-edit-tool="${entry.value}"` : '';
    const operation = entry.action === 'OPERATION' ? ` data-ttv-edit-operation="${entry.value}"` : '';
    return `<button type="button" class="${active.trim()}" data-ttv-edit-capability="${entry.id}" data-ttv-capability-title="${entry.title}" title="${entry.title}"${tool}${operation}${legacy}${shortcut}>${entry.label}</button>`;
  }).join('');
}

/** Synchronize disabled reasons and pressed state from authoritative controller evidence. */
export function syncTopologyEditCapabilityControls(root, input) {
  const states = evaluateTopologyEditCapabilities(input);
  root.querySelectorAll('[data-ttv-edit-capability]').forEach((button) => {
    const state = states[button.dataset.ttvEditCapability];
    if (!state) throw new Error(`Unregistered Edit capability ${button.dataset.ttvEditCapability}.`);
    button.disabled = !state.enabled;
    button.setAttribute('aria-disabled', String(!state.enabled));
    button.title = state.enabled ? button.dataset.ttvCapabilityTitle : state.reason;
    if (button.hasAttribute('data-ttv-edit-tool')) {
      button.classList.toggle('is-active', state.active);
      button.setAttribute('aria-pressed', String(state.active));
    }
  });
}

export function topologyEditCapabilityById(id) {
  const found = EDIT_CAPABILITIES.find((entry) => entry.id === id);
  if (!found) throw new RangeError(`Unknown Edit capability ${id}.`);
  return found;
}
