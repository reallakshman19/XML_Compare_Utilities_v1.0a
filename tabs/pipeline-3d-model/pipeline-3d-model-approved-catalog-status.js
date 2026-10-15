import {
  renderPipelineInputXmlDownloadControl,
} from './pipeline-3d-model-inputxml-download-control.js';
import { writePipelineElementText } from './pipeline-3d-model-dom-write.js';
import {
  writePipelineElementAttribute,
  writePipelineElementDataset,
  writePipelineElementProperty,
} from './pipeline-3d-model-dom-state-write.js';

const CATALOG_BLOCKER_TOKEN = 'APPROVED_CATALOG';
const STATUS_SELECTOR = '[data-p3d-approved-catalog-status]';
const XML_DOWNLOAD_SELECTOR = '[data-p3d="download-xml"]';
const STATUS_ID = 'p3d-approved-catalog-status';

function text(value) {
  return String(value ?? '').trim();
}

function bindingCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function blockerCodes(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function approvedCatalogBlockers(output) {
  const sources = [
    output?.orchestration?.blockerCodes,
    output?.exportQualification?.blockerCodes,
    output?.inputXmlDocumentPlan?.blockerCodes,
  ];
  return [...new Set(sources.flatMap(blockerCodes)
    .filter((code) => code.includes(CATALOG_BLOCKER_TOKEN)))];
}

function statusLabel(state, reference, count) {
  if (state === 'INACTIVE') return 'Approved catalog: inactive';
  const identity = reference || 'approved registry';
  const bindingLabel = `${count} binding${count === 1 ? '' : 's'}`;
  return `Approved catalog: ${identity} — ${state === 'READY' ? 'adopted' : 'blocked'} — ${bindingLabel}`;
}

function visibleStatusLabel(status) {
  if (status.state !== 'BLOCKED' || status.blockerCodes.length === 0) return status.label;
  return `${status.label} — ${status.blockerCodes.join(', ')}`;
}

function markApprovedCatalogState(dialog, status) {
  const button = dialog?.querySelector?.(XML_DOWNLOAD_SELECTOR);
  if (!button) return;
  writePipelineElementDataset(button, 'approvedCatalogState', status.state);
  writePipelineElementAttribute(button, 'aria-describedby', STATUS_ID);
}

export function resolvePipelineApprovedCatalogStatus(output = {}) {
  const diagnostics = output?.diagnostics || {};
  const active = diagnostics.approvedCatalogAdoptionActive === true;
  const ready = active && diagnostics.approvedCatalogAdoptionReady === true;
  const state = active ? (ready ? 'READY' : 'BLOCKED') : 'INACTIVE';
  const registryReference = text(diagnostics.approvedCatalogRegistryReference) || null;
  const count = bindingCount(diagnostics.approvedCatalogBindingCount);
  const blockers = Object.freeze(approvedCatalogBlockers(output));
  return Object.freeze({
    state,
    registryReference,
    bindingCount: count,
    blockerCodes: blockers,
    label: statusLabel(state, registryReference, count),
  });
}

function ensureStatusElement(dialog) {
  if (!dialog?.querySelector || !dialog?.ownerDocument) return null;
  let element = dialog.querySelector(STATUS_SELECTOR);
  if (element) return element;
  element = dialog.ownerDocument.createElement('p');
  element.id = STATUS_ID;
  element.dataset.p3dApprovedCatalogStatus = 'true';
  element.className = 'p3d-approved-catalog-status';
  const anchor = dialog.querySelector('[data-p3d="xml-output"]');
  if (anchor?.parentElement) anchor.parentElement.insertBefore(element, anchor);
  else dialog.appendChild(element);
  return element;
}

export function renderPipelineApprovedCatalogStatus(dialog, output) {
  const status = resolvePipelineApprovedCatalogStatus(output);
  const element = ensureStatusElement(dialog);
  renderPipelineInputXmlDownloadControl(dialog, output);
  markApprovedCatalogState(dialog, status);
  if (!element) return status;
  writePipelineElementProperty(element, 'id', STATUS_ID);
  writePipelineElementDataset(element, 'state', status.state);
  writePipelineElementText(element, visibleStatusLabel(status));
  writePipelineElementProperty(element, 'title', status.blockerCodes.join(', '));
  return status;
}
