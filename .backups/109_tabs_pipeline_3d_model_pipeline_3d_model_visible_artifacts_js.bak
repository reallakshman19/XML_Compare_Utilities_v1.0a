import {
  pipelineApprovedCatalogVisibleArtifacts,
} from './pipeline-3d-model-approved-catalog-status-artifact.js';
import {
  pipelineArtifactsWithManifest,
} from './pipeline-3d-model-export-manifest-artifact.js';

export function pipelineVisibleArtifacts(output = {}) {
  return pipelineArtifactsWithManifest(pipelineApprovedCatalogVisibleArtifacts(output));
}
