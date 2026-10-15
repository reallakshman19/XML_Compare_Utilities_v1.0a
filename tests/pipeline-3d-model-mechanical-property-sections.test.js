import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPipelineInputXmlDocumentPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js';
import {
  PIPELINE_MECHANICAL_PROPERTY_PLAN_SCHEMA,
  resolvePipelineMechanicalPropertyPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-mechanical-property-sections.js';

const propertySectionPlan = Object.freeze({
  schema: 'PipelinePropertySectionPlan.v1',
  sections: Object.freeze([
    Object.freeze({ sectionId: 'S1', analysisSectionId: 'AS1', startElementIndex: 0, startNode: 100 }),
    Object.freeze({ sectionId: 'S2', analysisSectionId: 'AS2', startElementIndex: 2, startNode: 120 }),
  ]),
  elements: Object.freeze(Array.from({ length: 4 }, (_, index) => Object.freeze({
    elementId: `E${index + 1}`,
  }))),
});
const input = {
  branchInfo: {
    modulus: 202705856, hotModuli: [181538944, 184007264, 203742576],
    poissons: 0.292, pipeDensity: 0.007833, materialName: 'A106 Grade B',
  },
  propertySections: [{
    startElementIndex: 2, modulus: 12117, hotMod1: 9317,
    poissons: 0.41, pipeDensity: 1905, materialName: 'FIBER RE PLASTIC',
  }],
  propertySectionPlan,
};
const plan = resolvePipelineMechanicalPropertyPlan(input);
assert.equal(plan.schema, PIPELINE_MECHANICAL_PROPERTY_PLAN_SCHEMA);
assert.equal(plan.ready, true);
assert.equal(plan.active, true);
assert.equal(plan.sections.length, 2);
assert.equal(plan.elements.length, 4);
assert.deepEqual(plan.elements.map((item) => item.propertyDisposition), [
  'SECTION_START_REPEATED', 'INHERITED_REPEATED',
  'SECTION_START_REPEATED', 'INHERITED_REPEATED',
]);
assert.equal(plan.elements[0].emittedProperties.modulus, 202705856);
assert.equal(plan.elements[1].emittedProperties.materialName, 'A106 Grade B');
assert.equal(plan.elements[2].emittedProperties.modulus, 12117);
assert.equal(plan.elements[3].emittedProperties.hotModuli[0], 9317);
assert.equal(plan.elements[3].emittedProperties.hotModuli[1], 184007264);
assert.equal(plan.elements[3].emittedProperties.materialName, 'FIBER RE PLASTIC');
assert.equal(JSON.stringify(plan), JSON.stringify(resolvePipelineMechanicalPropertyPlan(structuredClone(input))));
assert.equal(Object.isFrozen(plan.elements[3].emittedProperties.hotModuli), true);

const invalid = resolvePipelineMechanicalPropertyPlan({
  ...input, branchInfo: { ...input.branchInfo, poissons: 0.5 },
});
assert.equal(invalid.ready, false);
assert.ok(invalid.blockerCodes.includes('PIPELINE_MECHANICAL_PROPERTY_VALUE_INVALID'));
assert.equal(invalid.active, true);
const inactive = resolvePipelineMechanicalPropertyPlan({ propertySectionPlan });
assert.equal(inactive.active, false);

const coordinates = [
  { nodeNumber: 100, x: 0, y: 0, z: 0 },
  { nodeNumber: 110, x: 1000, y: 0, z: 0 },
  { nodeNumber: 120, x: 2000, y: 0, z: 0 },
];
const exportContext = { schema: 'PipelineUtilityExportContext.v1', branchInfo: {
  lineNo: 'PL-1B', jobName: 'TRI-1B', caesarVersion: '14.00', diameter: 100,
  wallThickness: 6, materialNumber: 106, modulus: 202705856,
  hotModuli: [181538944], poissons: 0.292, pipeDensity: 0.007833,
  materialName: 'A106 Grade B',
} };
const documentPlan = buildPipelineInputXmlDocumentPlan({
  exportContext, coordinateRows: coordinates, bendResolution: { errors: [], bendByIncomingElementIndex: {} },
});
assert.equal(documentPlan.ready, true);
assert.equal(documentPlan.mechanicalPropertyPlan.active, true);
assert.equal(documentPlan.elements[0].emittedMechanicalProperties.modulus, 202705856);
assert.equal(documentPlan.elements[1].emittedMechanicalProperties.materialName, 'A106 Grade B');
const inactiveContext = structuredClone(exportContext);
delete inactiveContext.branchInfo.modulus;
delete inactiveContext.branchInfo.hotModuli;
delete inactiveContext.branchInfo.poissons;
delete inactiveContext.branchInfo.pipeDensity;
delete inactiveContext.branchInfo.materialName;
const inactiveDocument = buildPipelineInputXmlDocumentPlan({
  exportContext: inactiveContext, coordinateRows: coordinates,
  bendResolution: { errors: [], bendByIncomingElementIndex: {} },
});
assert.equal(Object.hasOwn(inactiveDocument, 'mechanicalPropertyPlan'), false);
assert.equal(Object.hasOwn(inactiveDocument.elements[0], 'emittedMechanicalProperties'), false);

const documentSource = fs.readFileSync(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js', import.meta.url), 'utf8');
assert.match(documentSource, /resolvePipelineMechanicalPropertyPlan/);
assert.match(documentSource, /mechanicalPropertyPlanSchema/);
assert.match(documentSource, /emittedMechanicalProperties/);

console.log('pipeline-3d-model mechanical property sections: PASS');
