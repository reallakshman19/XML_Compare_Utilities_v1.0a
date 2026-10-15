/** Serializable Edit Draft UI state normalization and control synchronization. */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { uniqueSelection } from './topology-edit-controller-helpers.js';

/** Create immutable UI state from explicit controller fields. */
export function createTopologyEditUiState(input) {
  return Object.freeze({
    projection: cleanText(input.projection), tool: cleanText(input.tool), contextEdgeId: cleanText(input.contextEdgeId),
    supportScale: Number(input.supportScale), selection: Object.freeze(uniqueSelection(asArray(input.selection))),
  });
}

/** Validate and normalize persisted UI state. */
export function normalizeTopologyEditUiState(value) {
  const state = objectRecord(value), projection = cleanText(state.projection), tool = cleanText(state.tool);
  const supportScale = Number(state.supportScale);
  if (!['XY', 'XZ', 'YZ'].includes(projection)) throw new TypeError(`Persisted projection is invalid: ${projection}.`);
  if (!['SELECT', 'MOVE', 'CONNECT', 'ADD', 'SPLIT', 'MEASURE'].includes(tool)) throw new TypeError(`Persisted tool is invalid: ${tool}.`);
  if (!Number.isFinite(supportScale) || supportScale < 0.25 || supportScale > 6) throw new TypeError('Persisted support scale is invalid.');
  return createTopologyEditUiState({ projection, tool, contextEdgeId: state.contextEdgeId, supportScale, selection: state.selection });
}

/** Synchronize toolbar/slider controls after recovery or draft load. */
export function syncTopologyEditUiControls(root, state, setMeasurementActive) {
  root.querySelectorAll('[data-ttv-edit-projection]').forEach((button) => button.classList.toggle('is-active', button.dataset.ttvEditProjection === state.projection));
  root.querySelectorAll('[data-ttv-edit-tool]').forEach((button) => button.classList.toggle('is-active', button.dataset.ttvEditTool === state.tool));
  const slider = root.querySelector('[data-ttv-support-scale]'), output = root.querySelector('[data-ttv-support-scale-output]');
  if (slider) slider.value = String(state.supportScale);
  if (output) output.textContent = `${state.supportScale.toFixed(2)}×`;
  setMeasurementActive(state.tool === 'MEASURE');
}
