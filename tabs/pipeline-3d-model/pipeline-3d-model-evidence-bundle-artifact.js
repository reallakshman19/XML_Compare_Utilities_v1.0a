import {
  PIPELINE_EXPORT_MANIFEST_NAME,
} from './pipeline-3d-model-export-manifest-artifact.js';

export const PIPELINE_EVIDENCE_BUNDLE_SCHEMA = 'PipelineEvidenceBundle.v1';
export const PIPELINE_EVIDENCE_BUNDLE_NAME = 'pipeline-evidence-bundle.json';

function text(value) {
  return String(value ?? '');
}

function bundleSource(artifacts) {
  const source = Array.isArray(artifacts) ? artifacts : [];
  return source.filter((item) => ![
    PIPELINE_EVIDENCE_BUNDLE_NAME,
    PIPELINE_EXPORT_MANIFEST_NAME,
  ].includes(item?.name));
}

function bundleEntry(item, order) {
  return Object.freeze({
    order,
    fileId: text(item?.fileId).trim() || null,
    name: text(item?.name).trim() || null,
    role: text(item?.role).trim() || null,
    mime: text(item?.mime).trim() || null,
    sourceSchema: text(item?.sourceSchema).trim() || null,
    text: text(item?.text),
  });
}

export function buildPipelineEvidenceBundle(artifacts = []) {
  const entries = bundleSource(artifacts).map(bundleEntry);
  return Object.freeze({
    schema: PIPELINE_EVIDENCE_BUNDLE_SCHEMA,
    artifactCount: entries.length,
    artifacts: Object.freeze(entries),
  });
}

export function buildPipelineEvidenceBundleArtifact(artifacts = []) {
  return Object.freeze({
    fileId: 'pipeline-evidence-bundle',
    name: PIPELINE_EVIDENCE_BUNDLE_NAME,
    mime: 'application/json',
    role: 'ENGINEERING_EVIDENCE',
    sourceSchema: PIPELINE_EVIDENCE_BUNDLE_SCHEMA,
    text: `${JSON.stringify(buildPipelineEvidenceBundle(artifacts), null, 2)}\n`,
  });
}

export function pipelineArtifactsWithEvidenceBundle(artifacts = []) {
  const copied = [...bundleSource(artifacts)];
  copied.push(buildPipelineEvidenceBundleArtifact(copied));
  return Object.freeze(copied);
}
