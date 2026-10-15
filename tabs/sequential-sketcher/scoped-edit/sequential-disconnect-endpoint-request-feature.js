/** Lifecycle owner for Validator DISCONNECT_ENDPOINT request import and relationship-impact preview. */
import { createSequentialEditableTopologySnapshot } from './sequential-editable-topology-snapshot.js';
import {
  createSequentialDisconnectEndpointImpact,
  parseSequentialDisconnectEndpointRequestText,
} from './sequential-disconnect-endpoint-impact-preview.js';
import { createSequentialDisconnectEndpointRequestPanel } from './sequential-disconnect-endpoint-request-panel.js';

export const SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_FEATURE_SCHEMA =
  'SequentialDisconnectEndpointRequestFeature.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
async function readRequestFile(file) {
  if (!file || typeof file.text !== 'function') throw new TypeError('Disconnect request file is required.');
  return parseSequentialDisconnectEndpointRequestText(await file.text());
}
function createPreview(state, input) {
  const topology = createSequentialEditableTopologySnapshot(state.readModel());
  state.preview = createSequentialDisconnectEndpointImpact(topology, input); return state.preview;
}
function clear(state, reason = 'disconnect-preview-cleared') {
  state.preview = null; state.panel.clear(reason); return null;
}
function setActive(state, value) {
  state.active = value === true && !state.destroyed;
  state.panel.setActive(state.active);
  if (!state.active && state.preview) clear(state, 'Draft Edit 3D inactive');
  return state.active;
}
function destroy(state) {
  if (state.destroyed) return false;
  state.preview = null; state.active = false; state.destroyed = true;
  state.panel.destroy(); return true;
}
export function createSequentialDisconnectEndpointRequestFeature(options = {}) {
  const root = options.root;
  if (!root?.querySelector) throw new TypeError('Disconnect request feature requires a root.');
  const state = { readModel: requiredFunction(options.readModel, 'readModel'),
    panel: null, preview: null, active: false, destroyed: false };
  state.panel = createSequentialDisconnectEndpointRequestPanel({ root,
    onReadRequest: readRequestFile, onPreview: (input) => createPreview(state, input) });
  return Object.freeze({ schema: SEQUENTIAL_DISCONNECT_ENDPOINT_REQUEST_FEATURE_SCHEMA,
    setActive: (value) => setActive(state, value),
    preview: (input) => createPreview(state, input),
    clear: (reason) => clear(state, reason),
    invalidate: (reason) => clear(state, reason || 'owner-authority-change'),
    getPreview: () => state.preview,
    getState: () => Object.freeze({ active: state.active,
      previewFingerprint: state.preview?.previewFingerprint || null,
      panel: state.panel.getState(), destroyed: state.destroyed }),
    destroy: () => destroy(state) });
}
