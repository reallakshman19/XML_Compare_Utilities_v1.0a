import assert from 'node:assert/strict';
import { buildPipelineCoreOrchestration } from '../tabs/pipeline-3d-model/pipeline-3d-model-core-orchestrator.js';
import { createEmptyPipelineEngineeringConfigurationDraft, setPipelineEngineeringConfigurationField,
  updatePipelineEngineeringConfigurationDraftCollections } from '../tabs/pipeline-3d-model/pipeline-3d-model-engineering-configuration-fields.js';
import { buildPipelineEngineeringConfigurationPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-engineering-configuration.js';
function readyConfiguration() {
  let draft = createEmptyPipelineEngineeringConfigurationDraft();
  const values = { jobName: 'JOB', caesarVersion: '11.00', branchName: 'BR', lineNo: 'LINE',
    outsideDiameterMm: 100, wallThickness: 0, materialNumber: 0, corrosionAllowance: 0,
    insulationThickness: 0, insulationDensity: 0, fluidDensity: 0, hydroPressure: 0,
    bendScreeningEnabled: true, emitToInputXml: true, screeningOnlyAcknowledged: true,
    detectHorizontal: true, detectVertical: true, detectCompound: true,
    minimumPlanTurnAngleDeg: 0.25, minimumProfileTurnAngleDeg: 0.25,
    maximumTurnAngleDeg: 45, shortElementAnglePolicy: 'include-all',
    minimumAngleElementLengthMm: 0, retainedStraightAllowanceMm: 0,
    preferredStraightTangentMm: 2000, emitNearPointNode: true,
    emitMidpointNode: true, bendTypeCode: 0,
    normalFittingPolicyId: 'normal-explicit-radius-bend', normalRadiusMm: 150 };
  for (const [key, value] of Object.entries(values)) draft = setPipelineEngineeringConfigurationField(draft, key, value);
  draft = updatePipelineEngineeringConfigurationDraftCollections(draft, {
    sections: [{ startElementIndex: 0, profileId: 'normal-metallic', outsideDiameterMm: 100 }],
  });
  return buildPipelineEngineeringConfigurationPlan(draft);
}
const clean = (schema, extra = {}) => ({ schema, diagnostics: [], blockerCodes: [], ready: true, ...extra });
function dependencies(log) {
  const call = (name, result) => (input) => { log.push([name, input]); return result(input); };
  return {
    resolveBends: call('bends', (input) => ({ schema: 'PipelineBendResolution.v3',
      geometryRows: input.coordinateRows, candidates: [], bendByIncomingElementIndex: {},
      errors: [], hasBlockingErrors: false, diagnostics: [], blockerCodes: [], ready: true })),
    resolvePropertySectionPlan: call('properties', () => clean('PipelinePropertySectionPlan.v1', { sections: [], elements: [], sectionCount: 0 })),
    resolveAnalysisSectionPlan: call('analysis', () => ({ analysisSectionPlan: clean('PipelineAnalysisSectionPlan.v1', { sections: [], elementResolutions: [] }) })),
    resolvePropertyReseedPlan: call('reseed', () => clean('PipelineAnalysisPropertyReseedPlan.v1', { propertySectionPlan: clean('PipelinePropertySectionPlan.v1', { sections: [], elements: [] }) })),
    resolveDiameterPlan: call('diameter', () => clean('PipelineAnalysisDiameterPlan.v1')),
    resolveNormalFittingPlan: call('normal', () => clean('PipelineNormalFittingPlan.v1')),
    resolveB314RadiusPlan: call('b314', () => clean('PipelineB314RadiusPlan.v1')),
    resolveGreVendorSeriesPlan: call('gre', () => clean('PipelineGreVendorSeriesPlan.v1')),
    buildInputXmlDocumentPlan: call('document', () => clean('PipelineInputXmlDocumentPlan.v1', { profileAuthorityPlan: clean('PipelineInputXmlProfileAuthorityPlan.v1') })),
    buildInputXmlXml: call('writer', () => '<ROOT/>'),
  };
}
const log = [];
const result = buildPipelineCoreOrchestration({ configurationPlan: readyConfiguration(),
  points: [{}, {}], coordinateRows: [{ nodeNumber: 100 }, { nodeNumber: 110 }] }, dependencies(log));
assert.equal(result.ready, true, JSON.stringify(result.blockerCodes));
assert.equal(result.xmlText, '<ROOT/>');
assert.deepEqual(log.map(([name]) => name), ['bends', 'properties', 'analysis', 'reseed', 'diameter', 'normal', 'b314', 'gre', 'document', 'writer']);
assert.ok(result.artifacts.some((item) => item.name === 'pipeline-3d-model.xml'));
const blockedLog = [];
const blocked = buildPipelineCoreOrchestration({ configurationDraft: createEmptyPipelineEngineeringConfigurationDraft() }, dependencies(blockedLog));
assert.equal(blocked.ready, false); assert.equal(blockedLog.length, 0); assert.equal(blocked.xmlText, '');
assert.equal(blocked.artifacts.some((item) => item.name === 'pipeline-3d-model.xml'), false);
console.log('pipeline-3d-model core orchestrator: PASS');
