import {
  resolvePipelineApprovedCatalogStatus,
} from './pipeline-3d-model-approved-catalog-status.js';

export const PIPELINE_APPROVED_CATALOG_STATUS_EVIDENCE_SCHEMA =
  'PipelineApprovedCatalogStatusEvidence.v1';
export const PIPELINE_APPROVED_CATALOG_STATUS_ARTIFACT_NAME =
  'pipeline-approved-catalog-status.json';

function text(value) {
  return String(value ?? '').trim();
}

export function buildPipelineApprovedCatalogStatusEvidence(output = {}) {
  const status = resolvePipelineApprovedCatalogStatus(output);
  const documentSchema = text(output?.inputXmlDocumentPlan?.schema) || null;
  const inputXmlAllowed = output?.exportQualification
    ? output.exportQualification.inputXmlAllowed === true : null;
  return Object.freeze({
    schema: PIPELINE_APPROVED_CATALOG_STATUS_EVIDENCE_SCHEMA,
    state: status.state,
    registryReference: status.registryReference,
    bindingCount: status.bindingCount,
    blockerCodes: Object.freeze([...status.blockerCodes]),
    documentSchema,
    inputXmlAllowed,
  });
}

function buildPipelineApprovedCatalogStatusJson(output = {}) {
  return `${JSON.stringify(buildPipelineApprovedCatalogStatusEvidence(output), null, 2)}\n`;
}

export function buildPipelineApprovedCatalogStatusArtifact(output = {}) {
  return Object.freeze({
    fileId: 'pipeline-approved-catalog-status',
    name: PIPELINE_APPROVED_CATALOG_STATUS_ARTIFACT_NAME,
    mime: 'application/json',
    role: 'ENGINEERING_EVIDENCE',
    sourceSchema: PIPELINE_APPROVED_CATALOG_STATUS_EVIDENCE_SCHEMA,
    text: buildPipelineApprovedCatalogStatusJson(output),
  });
}

export function pipelineApprovedCatalogVisibleArtifacts(output = {}) {
  const existing = Array.isArray(output?.artifacts) ? output.artifacts : [];
  const copied = [...existing];
  if (copied.some((item) => item?.name === PIPELINE_APPROVED_CATALOG_STATUS_ARTIFACT_NAME)) {
    return Object.freeze(copied);
  }
  copied.push(buildPipelineApprovedCatalogStatusArtifact(output));
  return Object.freeze(copied);
}
