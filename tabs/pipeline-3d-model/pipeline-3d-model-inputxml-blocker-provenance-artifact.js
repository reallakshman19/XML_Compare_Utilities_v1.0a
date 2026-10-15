import {
  resolvePipelineInputXmlBlockerProvenance,
} from './pipeline-3d-model-inputxml-readiness.js';

export const PIPELINE_INPUTXML_BLOCKER_PROVENANCE_SCHEMA =
  'PipelineInputXmlBlockerProvenance.v1';
export const PIPELINE_INPUTXML_BLOCKER_PROVENANCE_ARTIFACT_NAME =
  'pipeline-inputxml-blocker-provenance.tsv';

export function buildPipelineInputXmlBlockerProvenanceEvidence(output = {}) {
  const blockers = resolvePipelineInputXmlBlockerProvenance(output);
  return Object.freeze({
    schema: PIPELINE_INPUTXML_BLOCKER_PROVENANCE_SCHEMA,
    state: blockers.length ? 'BLOCKED' : 'READY',
    blockerCount: blockers.length,
    blockers,
  });
}

function provenanceTsv(output) {
  const evidence = buildPipelineInputXmlBlockerProvenanceEvidence(output);
  const rows = evidence.blockers.map((row) =>
    [row.order, row.blockerCode, row.sources.join('|')].join('\t'));
  return [['Order', 'BlockerCode', 'Sources'].join('\t'), ...rows].join('\n') + '\n';
}

export function buildPipelineInputXmlBlockerProvenanceArtifact(output = {}) {
  return Object.freeze({
    fileId: 'pipeline-inputxml-blocker-provenance',
    name: PIPELINE_INPUTXML_BLOCKER_PROVENANCE_ARTIFACT_NAME,
    mime: 'text/tab-separated-values',
    role: 'ENGINEERING_EVIDENCE',
    sourceSchema: PIPELINE_INPUTXML_BLOCKER_PROVENANCE_SCHEMA,
    text: provenanceTsv(output),
  });
}
