import {
  buildPipelineInputXmlBlockedMessage,
} from './pipeline-3d-model-inputxml-download-feedback.js';
import {
  resolvePipelineProjectMigrationBlockers,
} from './pipeline-3d-model-project-adapter.js?v=20260724-p3d-hard-051-1';

const XML_DOWNLOAD_SELECTOR = '[data-p3d="download-xml"]';

export function resolvePipelineInputXmlDownloadState(output = {}) {
  const blockerCodes = resolvePipelineProjectMigrationBlockers(output);
  const blocked = blockerCodes.length > 0;
  return Object.freeze({
    state: blocked ? 'BLOCKED' : 'READY',
    blocked,
    blockerCodes,
    title: blocked ? buildPipelineInputXmlBlockedMessage(output) : '',
  });
}

export function renderPipelineInputXmlDownloadControl(dialog, output) {
  const state = resolvePipelineInputXmlDownloadState(output);
  const button = dialog?.querySelector?.(XML_DOWNLOAD_SELECTOR);
  if (!button) return state;
  button.disabled = state.blocked;
  button.dataset.inputXmlState = state.state;
  button.setAttribute?.('aria-disabled', String(state.blocked));
  button.title = state.title;
  return state;
}
