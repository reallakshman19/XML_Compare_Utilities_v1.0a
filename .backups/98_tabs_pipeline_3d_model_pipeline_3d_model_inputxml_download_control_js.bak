import {
  buildPipelineInputXmlBlockedMessage,
} from './pipeline-3d-model-inputxml-download-feedback.js';
import {
  resolvePipelineProjectMigrationBlockers,
} from './pipeline-3d-model-project-adapter.js?v=20260724-p3d-hard-051-1';

const XML_DOWNLOAD_SELECTOR = '[data-p3d="download-xml"]';
const STATUS_SELECTOR = '[data-p3d-inputxml-status]';
const STATUS_ID = 'p3d-inputxml-download-status';

function statusLabel(blocked, blockerCodes) {
  if (!blocked) return 'InputXML export: ready';
  return `InputXML export: blocked — ${blockerCodes.join(', ')}`;
}

export function resolvePipelineInputXmlDownloadState(output = {}) {
  const blockerCodes = resolvePipelineProjectMigrationBlockers(output);
  const blocked = blockerCodes.length > 0;
  return Object.freeze({
    state: blocked ? 'BLOCKED' : 'READY',
    blocked,
    blockerCodes,
    label: statusLabel(blocked, blockerCodes),
    title: blocked ? buildPipelineInputXmlBlockedMessage(output) : '',
  });
}

function ensureStatusElement(dialog) {
  if (!dialog?.querySelector || !dialog?.ownerDocument?.createElement) return null;
  let element = dialog.querySelector(STATUS_SELECTOR);
  if (element) return element;
  element = dialog.ownerDocument.createElement('p');
  element.id = STATUS_ID;
  element.dataset.p3dInputxmlStatus = 'true';
  element.className = 'p3d-inputxml-download-status';
  const anchor = dialog.querySelector('[data-p3d="xml-output"]');
  if (anchor?.parentElement) anchor.parentElement.insertBefore(element, anchor);
  else dialog.appendChild?.(element);
  return element;
}

function renderStatusElement(dialog, state) {
  const element = ensureStatusElement(dialog);
  if (!element) return;
  element.id = STATUS_ID;
  element.dataset.state = state.state;
  element.textContent = state.label;
  element.title = state.blockerCodes.join(', ');
}

export function renderPipelineInputXmlDownloadControl(dialog, output) {
  const state = resolvePipelineInputXmlDownloadState(output);
  const button = dialog?.querySelector?.(XML_DOWNLOAD_SELECTOR);
  renderStatusElement(dialog, state);
  if (!button) return state;
  button.disabled = state.blocked;
  button.dataset.inputXmlState = state.state;
  button.setAttribute?.('aria-disabled', String(state.blocked));
  button.title = state.title;
  return state;
}
