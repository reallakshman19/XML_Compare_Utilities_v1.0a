import {
  resolvePipelineInputXmlBlockers,
} from './pipeline-3d-model-inputxml-readiness.js';

export function buildPipelineInputXmlBlockedMessage(output = {}) {
  const blockers = resolvePipelineInputXmlBlockers(output);
  const reason = blockers.length ? blockers.join(', ') : 'unknown blocker';
  return `Canonical InputXML is blocked: ${reason}.`;
}
