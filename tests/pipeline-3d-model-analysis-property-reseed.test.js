import assert from 'node:assert/strict';
import { resolvePipelineAnalysisSectionPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-analysis-section-planner.js';
import {
  buildPipelineAnalysisPropertyReseedLedgerText,
  buildPipelineAnalysisPropertyReseedPlanJson,
  resolvePipelineAnalysisPropertyReseedPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-analysis-property-reseed.js';

const rows = Object.freeze([
  Object.freeze({ nodeNumber: 100 }), Object.freeze({ nodeNumber: 110 }),
  Object.freeze({ nodeNumber: 120 }), Object.freeze({ nodeNumber: 130 }),
]);
const full = Object.freeze({
  diameter: 114.3,
  wallThickness: 6.4,
  insulationThickness: 0,
  corrosionAllowance: 1.5,
  temperatures: Object.freeze([80, null, null, null, null, null, null, null, null]),
  pressures: Object.freeze([10, null, null, null, null, null, null, null, null]),
  hydroPressure: 15,
  insulationDensity: 0,
  fluidDensity: 0,
  materialNumber: 106,
});
const empty = Object.freeze({
  diameter: null, wallThickness: null, insulationThickness: null, corrosionAllowance: null,
  temperatures: Object.freeze(Array(9).fill(null)), pressures: Object.freeze(Array(9).fill(null)),
  hydroPressure: null, insulationDensity: null, fluidDensity: null, materialNumber: null,
});
const propertyPlan = Object.freeze({
  schema: 'PipelinePropertySectionPlan.v1',
  lineNo: 'PL-100',
  sectionCount: 1,
  sections: Object.freeze([Object.freeze({ schema: 'PipelinePropertySection.v1', sectionId: 'S1', startElementIndex: 0 })]),
  elements: Object.freeze([
    Object.freeze({ schema: 'PipelineElementPropertyResolution.v1', elementIndex: 0, elementId: 'E1', sectionId: 'S1', propertyDisposition: 'SECTION_START', properties: full, emittedProperties: full, effectiveSources: Object.freeze({ diameter: 'BASE_BRANCH_INFO', wallThickness: 'BASE_BRANCH_INFO' }) }),
    Object.freeze({ schema: 'PipelineElementPropertyResolution.v1', elementIndex: 1, elementId: 'E2', sectionId: 'S1', propertyDisposition: 'INHERITED', properties: full, emittedProperties: empty, effectiveSources: Object.freeze({ diameter: 'BASE_BRANCH_INFO', wallThickness: 'BASE_BRANCH_INFO' }) }),
    Object.freeze({ schema: 'PipelineElementPropertyResolution.v1', elementIndex: 2, elementId: 'E3', sectionId: 'S1', propertyDisposition: 'INHERITED', properties: full, emittedProperties: empty, effectiveSources: Object.freeze({ diameter: 'BASE_BRANCH_INFO', wallThickness: 'BASE_BRANCH_INFO' }) }),
  ]),
  diagnostics: Object.freeze([]),
  blockerCodes: Object.freeze([]),
  ready: true,
});

function frozenTree(value) {
  if (!value || typeof value !== 'object') return true;
  return Object.isFrozen(value) && Object.values(value).every(frozenTree);
}

const analysis = resolvePipelineAnalysisSectionPlan({
  coordinateRows: rows,
  analysisSections: [
    { startElementIndex: 0, profileId: 'normal-metallic' },
    { startElementIndex: 2, profileId: 'gre' },
  ],
}).analysisSectionPlan;
const propertyBefore = JSON.stringify(propertyPlan);
const reseed = resolvePipelineAnalysisPropertyReseedPlan({ analysisSectionPlan: analysis, propertySectionPlan: propertyPlan });
assert.equal(reseed.ready, true);
assert.deepEqual(reseed.reseedElementIndexes, [0, 2]);
assert.equal(reseed.reseedResolutions.length, 2);
assert.equal(reseed.reseedResolutions[0].analysisSectionId, 'AS1');
assert.equal(reseed.reseedResolutions[0].propertySectionId, 'S1');
assert.equal(reseed.reseedResolutions[0].boundaryNode, 100);
assert.equal(reseed.reseedResolutions[1].analysisSectionId, 'AS2');
assert.equal(reseed.reseedResolutions[1].propertySectionId, 'S1');
assert.equal(reseed.reseedResolutions[1].boundaryNode, 120);
assert.equal(reseed.reseedResolutions[1].disposition, 'ANALYSIS_SECTION_RESEED');
assert.deepEqual(reseed.propertySectionPlan.elements[2].emittedProperties, reseed.propertySectionPlan.elements[2].properties);
assert.equal(reseed.propertySectionPlan.elements[2].propertyDisposition, 'INHERITED');
assert.equal(reseed.propertySectionPlan.elements[2].sectionId, 'S1');
assert.equal(reseed.propertySectionPlan.sectionCount, 1);
assert.equal(reseed.propertySectionPlan.sections.length, 1);
assert.equal(JSON.stringify(propertyPlan), propertyBefore);
assert.deepEqual(propertyPlan.elements[2].emittedProperties, empty);
assert.ok(reseed.reseedResolutions[1].emittedPropertyNames.includes('diameter'));
assert.ok(reseed.reseedResolutions[1].emittedPropertyNames.includes('temperatures'));
assert.ok(frozenTree(reseed));
assert.equal(buildPipelineAnalysisPropertyReseedPlanJson(reseed), buildPipelineAnalysisPropertyReseedPlanJson(reseed));
assert.equal(buildPipelineAnalysisPropertyReseedLedgerText(reseed), buildPipelineAnalysisPropertyReseedLedgerText(reseed));

const second = resolvePipelineAnalysisPropertyReseedPlan({
  analysisSectionPlan: analysis,
  propertySectionPlan: reseed.propertySectionPlan,
});
assert.equal(JSON.stringify(reseed), JSON.stringify(second));

const coincidentPropertyBoundary = Object.freeze({
  ...propertyPlan,
  sectionCount: 2,
  sections: Object.freeze([
    propertyPlan.sections[0],
    Object.freeze({ schema: 'PipelinePropertySection.v1', sectionId: 'S2', startElementIndex: 2 }),
  ]),
  elements: Object.freeze(propertyPlan.elements.map((item, index) => index === 2 ? Object.freeze({
    ...item, sectionId: 'S2', propertyDisposition: 'SECTION_START', emittedProperties: Object.freeze({ wallThickness: 8 }),
    properties: Object.freeze({ ...full, wallThickness: 8 }),
  }) : item)),
});
const coincident = resolvePipelineAnalysisPropertyReseedPlan({
  analysisSectionPlan: analysis, propertySectionPlan: coincidentPropertyBoundary,
});
assert.equal(coincident.ready, true);
assert.equal(coincident.propertySectionPlan.sectionCount, 2);
assert.equal(coincident.propertySectionPlan.sections.length, 2);
assert.equal(coincident.propertySectionPlan.elements[2].sectionId, 'S2');
assert.equal(coincident.reseedResolutions.filter((item) => item.elementIndex === 2).length, 1);
assert.equal(coincident.propertySectionPlan.elements[2].emittedProperties.wallThickness, 8);
assert.equal(coincident.propertySectionPlan.elements[2].emittedProperties.diameter, 114.3);

const missingProperty = Object.freeze({
  ...propertyPlan,
  elements: Object.freeze(propertyPlan.elements.filter((item) => item.elementIndex !== 2)),
});
const missing = resolvePipelineAnalysisPropertyReseedPlan({ analysisSectionPlan: analysis, propertySectionPlan: missingProperty });
assert.equal(missing.ready, false);
assert.ok(missing.blockerCodes.includes('PIPELINE_PROPERTY_RESEED_ELEMENT_MISSING'));

const mismatchedProperty = Object.freeze({
  ...propertyPlan,
  elements: Object.freeze(propertyPlan.elements.map((item) => item.elementIndex === 2 ? Object.freeze({ ...item, elementId: 'E99' }) : item)),
});
const mismatch = resolvePipelineAnalysisPropertyReseedPlan({ analysisSectionPlan: analysis, propertySectionPlan: mismatchedProperty });
assert.equal(mismatch.ready, false);
assert.ok(mismatch.blockerCodes.includes('PIPELINE_PROPERTY_RESEED_PLAN_INVALID'));

const oneAnalysis = resolvePipelineAnalysisSectionPlan({ coordinateRows: rows, profileId: 'normal-metallic' }).analysisSectionPlan;
const oneReseed = resolvePipelineAnalysisPropertyReseedPlan({ analysisSectionPlan: oneAnalysis, propertySectionPlan: propertyPlan });
assert.deepEqual(oneReseed.reseedElementIndexes, [0]);
assert.deepEqual(oneReseed.propertySectionPlan.elements[0].emittedProperties, oneReseed.propertySectionPlan.elements[0].properties);

const mutableAnalysis = JSON.parse(JSON.stringify(analysis));
const mutableProperty = JSON.parse(JSON.stringify(propertyPlan));
const isolated = resolvePipelineAnalysisPropertyReseedPlan({
  analysisSectionPlan: mutableAnalysis, propertySectionPlan: mutableProperty,
});
mutableAnalysis.elementResolutions[0].analysisSectionId = 'AS99';
mutableProperty.elements[0].properties.diameter = 999;
assert.equal(isolated.reseedResolutions[0].analysisSectionId, 'AS1');
assert.equal(isolated.propertySectionPlan.elements[0].properties.diameter, 114.3);

console.log('Pipeline analysis-section property reseed tests passed.');
