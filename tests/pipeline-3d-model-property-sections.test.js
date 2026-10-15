import assert from 'node:assert/strict';
import {
  buildPipelinePropertySectionLedgerText,
  resolvePipelinePropertySectionPlan,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-property-sections.js';
import { buildPipelineInputXmlDocumentPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js';
import { buildInputXmlPipingModelXml } from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';

const rows = Object.freeze([
  Object.freeze({ nodeNumber: 100, x: 0, y: 0, z: 0, nodeName: 'N100' }),
  Object.freeze({ nodeNumber: 110, x: 1000, y: 0, z: 0, nodeName: 'N110' }),
  Object.freeze({ nodeNumber: 120, x: 2000, y: 0, z: 0, nodeName: 'N120' }),
  Object.freeze({ nodeNumber: 130, x: 3000, y: 0, z: 0, nodeName: 'N130' }),
]);

const branchInfo = {
  branchName: 'B1', lineNo: 'PL-100', boreMm: '114.3', wallThickness: '6.4',
  insulationThickness: '0', corrosionAllowance: '0', fluidDensity: '0',
  insulationDensity: '0', materialCode: '106', hydroPressure: '15',
};
for (let index = 1; index <= 9; index += 1) {
  branchInfo[`t${index}`] = String(index === 9 ? -10 : index * 10);
  branchInfo[`p${index}`] = String(index - 1);
}

function context(info = branchInfo, blockerCodes = []) {
  return Object.freeze({
    schema: 'PipelineUtilityExportContext.v1', branchInfo: info,
    profile: Object.freeze({ resolvedMode: 'NORMAL' }),
    readiness: Object.freeze({ blockerCodes: Object.freeze(blockerCodes) }),
  });
}

const constant = resolvePipelinePropertySectionPlan({ branchInfo, coordinateRows: rows });
assert.equal(constant.ready, true);
assert.equal(constant.sectionCount, 1);
assert.equal(constant.elements.length, 3);
assert.equal(constant.elements[0].propertyDisposition, 'SECTION_START');
assert.equal(constant.elements[1].propertyDisposition, 'INHERITED');
assert.equal(constant.elements[0].emittedProperties.diameter, 114.3);
assert.equal(constant.elements[1].emittedProperties.diameter, null);
assert.equal(constant.elements[2].properties.wallThickness, 6.4);
assert.equal(constant.elements[0].emittedProperties.temperatures[8], -10);
assert.equal(constant.elements[0].emittedProperties.pressures[0], 0);
assert.equal(constant.elements[0].emittedProperties.fluidDensity, 0);

const constantPlan = buildPipelineInputXmlDocumentPlan({ exportContext: context(), coordinateRows: rows });
assert.equal(constantPlan.ready, true);
assert.equal(constantPlan.elements[0].propertySectionId, 'S1');
assert.equal(constantPlan.elements[1].propertyDisposition, 'INHERITED');
const constantXml = buildInputXmlPipingModelXml(constantPlan);
assert.equal((constantXml.match(/DIAMETER="114\.3"/g) || []).length, 1);
assert.equal((constantXml.match(/WALL_THICK="6\.4"/g) || []).length, 1);
assert.match(constantXml, /TEMP_EXP_C9="-10"/);
assert.match(constantXml, /PRESSURE_C1="0"/);
assert.equal((constantXml.match(/MATERIAL_NUM="106"/g) || []).length, 1);

const changed = resolvePipelinePropertySectionPlan({
  branchInfo, coordinateRows: rows,
  propertySections: [{ startElementIndex: 2, wallThickness: 8, materialCode: 200 }],
});
assert.equal(changed.ready, true);
assert.equal(changed.sectionCount, 2);
assert.equal(changed.sections[1].startNode, 120);
assert.equal(changed.elements[2].sectionId, 'S2');
assert.equal(changed.elements[2].emittedProperties.wallThickness, 8);
assert.equal(changed.elements[2].emittedProperties.materialNumber, 200);
assert.equal(changed.elements[2].emittedProperties.diameter, null);
assert.equal(changed.elements[2].properties.diameter, 114.3);

const changedPlan = buildPipelineInputXmlDocumentPlan({
  exportContext: context(), coordinateRows: rows,
  propertySections: [{ startElementIndex: 2, wallThickness: 8, materialCode: 200 }],
});
const changedXml = buildInputXmlPipingModelXml(changedPlan);
assert.equal((changedXml.match(/WALL_THICK=/g) || []).length, 2);
assert.equal((changedXml.match(/DIAMETER=/g) || []).length, 1);
assert.match(changedXml, /ID="E3"[^>]*WALL_THICK="8"[^>]*MATERIAL_NUM="200"/);

const invalidStart = resolvePipelinePropertySectionPlan({
  branchInfo, coordinateRows: rows, propertySections: [{ startElementIndex: 3, wallThickness: 8 }],
});
assert.deepEqual(invalidStart.blockerCodes, ['PIPELINE_PROPERTY_SECTION_START_INVALID']);

const duplicate = resolvePipelinePropertySectionPlan({
  branchInfo, coordinateRows: rows,
  propertySections: [
    { startElementIndex: 1, wallThickness: 8 },
    { startElementIndex: 1, wallThickness: 9 },
  ],
});
assert.ok(duplicate.blockerCodes.includes('PIPELINE_PROPERTY_SECTION_DUPLICATE'));

const noChange = resolvePipelinePropertySectionPlan({
  branchInfo, coordinateRows: rows, propertySections: [{ startElementIndex: 1, wallThickness: 6.4 }],
});
assert.deepEqual(noChange.blockerCodes, ['PIPELINE_PROPERTY_SECTION_NO_CHANGE']);

const invalidValue = resolvePipelinePropertySectionPlan({
  branchInfo, coordinateRows: rows, propertySections: [{ startElementIndex: 1, wallThickness: -1 }],
});
assert.ok(invalidValue.blockerCodes.includes('PIPELINE_PROPERTY_VALUE_INVALID'));
assert.ok(invalidValue.blockerCodes.includes('PIPELINE_PROPERTY_SECTION_NO_CHANGE'));

const missing = resolvePipelinePropertySectionPlan({
  branchInfo: { lineNo: 'PL-100' }, coordinateRows: rows,
});
assert.deepEqual(missing.blockerCodes, ['PIPELINE_DIAMETER_REQUIRED', 'PIPELINE_WALL_THICKNESS_REQUIRED']);

const greBlocked = buildPipelineInputXmlDocumentPlan({
  exportContext: context(branchInfo, ['GRE_BEND_POLICY_NOT_IMPLEMENTED']), coordinateRows: rows,
});
assert.equal(greBlocked.ready, false);
assert.ok(greBlocked.blockerCodes.includes('GRE_BEND_POLICY_NOT_IMPLEMENTED'));

const ledger = buildPipelinePropertySectionLedgerText(changed);
assert.match(ledger, /PipelinePropertySectionPlan\.v1\tE3\tS2\t2\t120\tWALL_THICK\t8\t8\tEXPLICIT\tSECTION_OVERRIDE/);
assert.match(ledger, /PipelinePropertySectionPlan\.v1\tE2\tS1\t0\t100\tDIAMETER\t\t114\.3\tINHERITED\tBASE_BRANCH_INFO/);
assert.equal(ledger, buildPipelinePropertySectionLedgerText(changed));
assert.ok(Object.isFrozen(changed));
assert.ok(Object.isFrozen(changed.sections));
assert.ok(Object.isFrozen(changed.elements));

console.log('Pipeline property section and canonical inheritance tests passed.');