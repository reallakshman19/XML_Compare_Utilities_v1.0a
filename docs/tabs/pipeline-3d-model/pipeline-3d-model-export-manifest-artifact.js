export const PIPELINE_EXPORT_MANIFEST_SCHEMA = 'PipelineExportArtifactManifest.v1';
export const PIPELINE_EXPORT_MANIFEST_NAME = 'pipeline-export-manifest.json';

function text(value) {
  return String(value ?? '');
}

function byteLength(value) {
  return new TextEncoder().encode(text(value)).byteLength;
}

function manifestEntry(item, order) {
  return Object.freeze({
    order,
    fileId: text(item?.fileId).trim() || null,
    name: text(item?.name).trim() || null,
    role: text(item?.role).trim() || null,
    mime: text(item?.mime).trim() || null,
    sourceSchema: text(item?.sourceSchema).trim() || null,
    byteLength: byteLength(item?.text),
  });
}

export function buildPipelineExportManifestEvidence(artifacts = []) {
  const source = Array.isArray(artifacts) ? artifacts : [];
  const entries = source.filter((item) => item?.name !== PIPELINE_EXPORT_MANIFEST_NAME)
    .map(manifestEntry);
  return Object.freeze({
    schema: PIPELINE_EXPORT_MANIFEST_SCHEMA,
    artifactCount: entries.length,
    artifacts: Object.freeze(entries),
  });
}

function manifestJson(artifacts) {
  return `${JSON.stringify(buildPipelineExportManifestEvidence(artifacts), null, 2)}\n`;
}

export function buildPipelineExportManifestArtifact(artifacts = []) {
  return Object.freeze({
    fileId: 'pipeline-export-manifest',
    name: PIPELINE_EXPORT_MANIFEST_NAME,
    mime: 'application/json',
    role: 'ENGINEERING_EVIDENCE',
    sourceSchema: PIPELINE_EXPORT_MANIFEST_SCHEMA,
    text: manifestJson(artifacts),
  });
}

export function pipelineArtifactsWithManifest(artifacts = []) {
  const source = Array.isArray(artifacts) ? artifacts : [];
  const copied = source.filter((item) => item?.name !== PIPELINE_EXPORT_MANIFEST_NAME);
  copied.push(buildPipelineExportManifestArtifact(copied));
  return Object.freeze(copied);
}
