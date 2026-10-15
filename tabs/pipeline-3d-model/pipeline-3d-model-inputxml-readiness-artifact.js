import {
  resolvePipelineInputXmlReadiness,
} from './pipeline-3d-model-inputxml-readiness.js';

export const PIPELINE_INPUTXML_READINESS_EVIDENCE_SCHEMA =
  'PipelineInputXmlReadinessEvidence.v1';
export const PIPELINE_INPUTXML_READINESS_ARTIFACT_NAME =
  'pipeline-inputxml-readiness.json';

function text(value) {
  return String(value ?? '').trim();
}

export function buildPipelineInputXmlReadinessEvidence(output = {}) {
  const readiness = resolvePipelineInputXmlReadiness(output);
  return Object.freeze({
    schema: PIPELINE_INPUTXML_READINESS_EVIDENCE_SCHEMA,
    state: readiness.state,
    blockerCodes: Object.freeze([...readiness.blockerCodes]),
    inputXmlAllowed: output?.exportQualification
      ? output.exportQualification.inputXmlAllowed === true : null,
    documentSchema: text(output?.inputXmlDocumentPlan?.schema) || null,
    orchestrationSchema: text(output?.orchestration?.schema) || null,
    xmlAvailable: text(output?.xmlText).length > 0,
  });
}

function readinessJson(output) {
  return `${JSON.stringify(buildPipelineInputXmlReadinessEvidence(output), null, 2)}\n`;
}

export function buildPipelineInputXmlReadinessArtifact(output = {}) {
  return Object.freeze({
    fileId: 'pipeline-inputxml-readiness',
    name: PIPELINE_INPUTXML_READINESS_ARTIFACT_NAME,
    mime: 'application/json',
    role: 'ENGINEERING_EVIDENCE',
    sourceSchema: PIPELINE_INPUTXML_READINESS_EVIDENCE_SCHEMA,
    text: readinessJson(output),
  });
}
