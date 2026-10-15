import {
  resolvePipelineProjectMigrationBlockers,
} from './pipeline-3d-model-project-adapter.js?v=20260724-p3d-hard-051-1';

export function buildPipelineInputXmlBlockedMessage(output = {}) {
  const blockers = resolvePipelineProjectMigrationBlockers(output);
  const reason = blockers.length ? blockers.join(', ') : 'unknown blocker';
  return `Canonical InputXML is blocked: ${reason}.`;
}
