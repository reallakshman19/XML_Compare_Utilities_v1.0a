import assert from 'node:assert/strict';
import {
  buildPipelineInputXmlBlockedMessage,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-download-feedback.js';

const complete = buildPipelineInputXmlBlockedMessage({
  orchestration: { blockerCodes: ['ORCHESTRATION_BLOCKER'] },
  exportQualification: {
    inputXmlAllowed: false,
    blockerCodes: ['EXPORT_BLOCKER', 'ORCHESTRATION_BLOCKER'],
  },
  inputXmlDocumentPlan: { blockerCodes: ['DOCUMENT_BLOCKER'] },
});
assert.equal(complete,
  'Canonical InputXML is blocked: ORCHESTRATION_BLOCKER, EXPORT_BLOCKER, DOCUMENT_BLOCKER.');

const fallback = buildPipelineInputXmlBlockedMessage({
  exportQualification: { inputXmlAllowed: false, blockerCodes: [] },
});
assert.equal(fallback,
  'Canonical InputXML is blocked: PIPELINE_PROJECT_MIGRATION_INPUTXML_NOT_ALLOWED.');

console.log('pipeline-3d-model InputXML download feedback: PASS');
