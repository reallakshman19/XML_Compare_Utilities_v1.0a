import {
  pipelineApprovedCatalogVisibleArtifacts,
} from './pipeline-3d-model-approved-catalog-status-artifact.js';
import {
  PIPELINE_EVIDENCE_BUNDLE_NAME,
  PIPELINE_EVIDENCE_BUNDLE_SCHEMA,
  buildPipelineEvidenceBundleArtifact,
} from './pipeline-3d-model-evidence-bundle-artifact.js';
import {
  PIPELINE_EXPORT_MANIFEST_NAME,
  PIPELINE_EXPORT_MANIFEST_SCHEMA,
  buildPipelineExportManifestArtifact,
} from './pipeline-3d-model-export-manifest-artifact.js';
import {
  createPipelineOnDemandTextArtifact,
} from './pipeline-3d-model-on-demand-artifact.js';

function baseArtifacts(output) {
  return pipelineApprovedCatalogVisibleArtifacts(output).filter((item) => ![
    PIPELINE_EVIDENCE_BUNDLE_NAME,
    PIPELINE_EXPORT_MANIFEST_NAME,
  ].includes(item?.name));
}

function bundleDescriptor(artifacts) {
  return createPipelineOnDemandTextArtifact({
    fileId: 'pipeline-evidence-bundle',
    name: PIPELINE_EVIDENCE_BUNDLE_NAME,
    mime: 'application/json',
    role: 'ENGINEERING_EVIDENCE',
    sourceSchema: PIPELINE_EVIDENCE_BUNDLE_SCHEMA,
  }, () => buildPipelineEvidenceBundleArtifact(artifacts).text);
}

function manifestDescriptor(artifacts) {
  return createPipelineOnDemandTextArtifact({
    fileId: 'pipeline-export-manifest',
    name: PIPELINE_EXPORT_MANIFEST_NAME,
    mime: 'application/json',
    role: 'ENGINEERING_EVIDENCE',
    sourceSchema: PIPELINE_EXPORT_MANIFEST_SCHEMA,
  }, () => {
    const bundle = buildPipelineEvidenceBundleArtifact(artifacts);
    return buildPipelineExportManifestArtifact([...artifacts, bundle]).text;
  });
}

export function pipelineVisibleArtifacts(output = {}) {
  const artifacts = baseArtifacts(output);
  return Object.freeze([
    ...artifacts,
    bundleDescriptor(artifacts),
    manifestDescriptor(artifacts),
  ]);
}
