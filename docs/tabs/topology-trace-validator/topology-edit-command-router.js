/** One command path for Edit Draft buttons and keyboard shortcuts. */

import {
  EDIT_CAPABILITIES, evaluateTopologyEditCapabilities, syncTopologyEditCapabilityControls,
  topologyEditCapabilityById, topologyEditCapabilityContext,
} from './topology-edit-capability-registry.js';
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';

function navigationRows(evidence) {
  const canonical = objectRecord(objectRecord(evidence.editedArtifacts).canonicalTopology);
  return Object.freeze([
    ...asArray(canonical.nodes).map((row) => ({ kind: 'node', id: cleanText(row.id) })),
    ...asArray(canonical.edges).map((row) => ({ kind: 'edge', id: cleanText(row.id) })),
    ...asArray(canonical.supports).map((row) => ({ kind: 'support', id: cleanText(row.id) })),
  ].filter((row) => row.id));
}

function navigateSelection(edit, direction) {
  const evidence = edit.evidence(), rows = navigationRows(evidence);
  if (!rows.length) throw new Error('No scene objects are available for keyboard navigation.');
  const active = asArray(evidence.selection).at(-1);
  const current = rows.findIndex((row) => row.kind === active?.kind && row.id === active?.id);
  const index = (current + direction + rows.length) % rows.length;
  edit.setExternalSelection([rows[index]]);
  edit.focusSelection();
}

/** Execute one registered capability against the public Edit controller API. */
export async function executeTopologyEditCapability(edit, id) {
  const entry = topologyEditCapabilityById(id);
  if (entry.action === 'TOOL') edit.setTool(entry.value);
  else if (entry.action === 'OPERATION') await edit.runOperation(entry.value);
  else if (entry.action === 'UNDO') await edit.undo();
  else if (entry.action === 'REDO') await edit.redo();
  else if (entry.action === 'ZOOM_IN') edit.zoomIn();
  else if (entry.action === 'ZOOM_OUT') edit.zoomOut();
  else if (entry.action === 'FIT') edit.fit();
  else if (entry.action === 'FOCUS') edit.focusSelection();
  else if (entry.action === 'PREVIOUS') navigateSelection(edit, -1);
  else if (entry.action === 'NEXT') navigateSelection(edit, 1);
  else throw new RangeError(`Unsupported Edit capability action ${entry.action}.`);
}

function shortcutId(event) {
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === 'z') return event.shiftKey ? 'history.redo' : 'history.undo';
  if ((event.ctrlKey || event.metaKey) && key === 'y') return 'history.redo';
  const lookup = { v: 'tool.select', g: 'tool.move', c: 'tool.connect', a: 'tool.add', b: 'tool.split', m: 'tool.measure', delete: 'operation.delete', backspace: 'operation.delete', f: 'view.fit', '+': 'view.zoom-in', '=': 'view.zoom-in', '-': 'view.zoom-out', '[': 'scene.previous', ']': 'scene.next', enter: 'scene.focus', escape: 'tool.select' };
  return lookup[key] ?? '';
}

function isEditableTarget(target) {
  return target instanceof Element && Boolean(target.closest('input,select,textarea,button,a,[contenteditable="true"]'));
}

async function runAvailable(edit, id) {
  const states = evaluateTopologyEditCapabilities(edit.evidence()), state = states[id];
  if (!state?.enabled) throw new Error(state?.reason || `Capability ${id} is unavailable.`);
  await executeTopologyEditCapability(edit, id);
}

/** Bind capability buttons and document keyboard routing through the supplied cleanup-aware listener. */
export function wireTopologyEditCommandRouter(root, edit, listen, onError) {
  if (!root || !edit || typeof listen !== 'function' || typeof onError !== 'function') throw new TypeError('Edit command router dependencies are required.');
  root.querySelectorAll('[data-ttv-edit-capability]').forEach((button) => listen(button, 'click', async () => {
    try { await runAvailable(edit, button.dataset.ttvEditCapability); }
    catch (error) { onError(error); }
    finally { syncTopologyEditCapabilityControls(root, topologyEditCapabilityContext(edit.evidence())); }
  }));
  listen(root.ownerDocument, 'keydown', async (event) => {
    const panel = root.querySelector('[data-ttv-edit-root]');
    if (!panel || panel.hidden || isEditableTarget(event.target)) return;
    const id = shortcutId(event);
    if (!id) return;
    event.preventDefault();
    try { await runAvailable(edit, id); } catch (error) { onError(error); }
    finally { syncTopologyEditCapabilityControls(root, topologyEditCapabilityContext(edit.evidence())); }
  });
  syncTopologyEditCapabilityControls(root, topologyEditCapabilityContext(edit.evidence()));
}

export const _test = Object.freeze({ shortcutId, navigationRows, isEditableTarget, capabilityCount: EDIT_CAPABILITIES.length });
