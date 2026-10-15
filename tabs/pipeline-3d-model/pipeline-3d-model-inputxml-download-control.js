import {
  buildPipelineInputXmlBlockedMessage,
} from './pipeline-3d-model-inputxml-download-feedback.js';
import {
  resolvePipelineInputXmlReadiness,
} from './pipeline-3d-model-inputxml-readiness.js';
import { writePipelineElementText } from './pipeline-3d-model-dom-write.js';
import {
  writePipelineElementAttribute,
  writePipelineElementDataset,
  writePipelineElementProperty,
} from './pipeline-3d-model-dom-state-write.js';

const XML_DOWNLOAD_SELECTOR = '[data-p3d="download-xml"]';
const STATUS_SELECTOR = '[data-p3d-inputxml-status]';
const STATUS_ID = 'p3d-inputxml-download-status';

function statusLabel(blocked, blockerCodes) {
  if (!blocked) return 'InputXML export: ready';
  return `InputXML export: blocked — ${blockerCodes.join(', ')}`;
}

export function resolvePipelineInputXmlDownloadState(output = {}) {
  const readiness = resolvePipelineInputXmlReadiness(output);
  return Object.freeze({
    ...readiness,
    label: statusLabel(readiness.blocked, readiness.blockerCodes),
    title: readiness.blocked ? buildPipelineInputXmlBlockedMessage(output) : '',
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
  writePipelineElementProperty(element, 'id', STATUS_ID);
  writePipelineElementDataset(element, 'state', state.state);
  writePipelineElementText(element, state.label);
  writePipelineElementProperty(element, 'title', state.blockerCodes.join(', '));
}

export function renderPipelineInputXmlDownloadControl(dialog, output) {
  const state = resolvePipelineInputXmlDownloadState(output);
  const button = dialog?.querySelector?.(XML_DOWNLOAD_SELECTOR);
  renderStatusElement(dialog, state);
  if (!button) return state;
  writePipelineElementProperty(button, 'disabled', state.blocked);
  writePipelineElementDataset(button, 'inputXmlState', state.state);
  writePipelineElementAttribute(button, 'aria-disabled', String(state.blocked));
  writePipelineElementProperty(button, 'title', state.title);
  return state;
}
