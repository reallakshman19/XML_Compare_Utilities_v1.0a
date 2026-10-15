import {
  pipelineApprovedCatalogVisibleArtifacts,
} from './pipeline-3d-model-approved-catalog-status-artifact.js';
import {
  pipelineArtifactsWithEvidenceBundle,
} from './pipeline-3d-model-evidence-bundle-artifact.js';
import {
  pipelineArtifactsWithManifest,
} from './pipeline-3d-model-export-manifest-artifact.js';

export function pipelineVisibleArtifacts(output = {}) {
  const artifacts = pipelineApprovedCatalogVisibleArtifacts(output);
  return pipelineArtifactsWithManifest(pipelineArtifactsWithEvidenceBundle(artifacts));
}
