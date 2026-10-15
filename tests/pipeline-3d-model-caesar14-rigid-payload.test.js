import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPipelineInputXmlDocumentPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js';
import { buildInputXmlPipingModelXml } from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';
import {
  PIPELINE_CAESAR_14_RIGID_ATTRIBUTE_ORDER,
  caesar14RigidAttributeEntries,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-caesar14-writer-profile.js';

const joined = (entries) => entries.map(([name, value]) => `${name}="${value}"`).join(' ');
assert.deepEqual(PIPELINE_CAESAR_14_RIGID_ATTRIBUTE_ORDER, ['WEIGHT', 'TYPE']);
assert.equal(joined(caesar14RigidAttributeEntries({ weight: 2708, type: 'Valve' })),
  'WEIGHT="2708.000000" TYPE="Valve"');
const coordinateRows = [
  { nodeNumber: 100, x: 0, y: 0, z: 0 },
  { nodeNumber: 110, x: 1000, y: 0, z: 0 },
  { nodeNumber: 120, x: 2000, y: 0, z: 0 },
];
const exportContext = { schema: 'PipelineUtilityExportContext.v1', branchInfo: {
  lineNo: 'PL-1D', caesarVersion: '14.00', diameter: 168.275,
  wallThickness: 10.9728, materialNumber: 106,
} };
const documentPlan = buildPipelineInputXmlDocumentPlan({
  exportContext, coordinateRows, bendResolution: { errors: [], bendByIncomingElementIndex: {} },
  rigids: [
    { elementId: 'E1', type: 'flange', weight: 462 },
    { node: 120, type: 'valve', weight: 2708 },
  ],
});
assert.equal(documentPlan.ready, true);
assert.equal(documentPlan.counts.numRigid, 2);
assert.equal(documentPlan.rigidPlan.rigidCount, 2);
assert.equal(documentPlan.elements[0].rigid.type, 'Flange');
const xml = buildInputXmlPipingModelXml(documentPlan);
assert.match(xml, /NUMRIGID="2"/);
assert.equal((xml.match(/<RIGID /g) || []).length, 2);
assert.match(xml, /<RIGID WEIGHT="462\.000000" TYPE="Flange"\/>/);
assert.match(xml, /<RIGID WEIGHT="2708\.000000" TYPE="Valve"\/>/);
const inactivePlan = buildPipelineInputXmlDocumentPlan({
  exportContext, coordinateRows, bendResolution: { errors: [], bendByIncomingElementIndex: {} },
});
assert.equal(Object.hasOwn(inactivePlan, 'rigidPlan'), false);
assert.equal(Object.hasOwn(inactivePlan.elements[0], 'rigid'), false);
const legacyPlan = buildPipelineInputXmlDocumentPlan({
  exportContext: { ...exportContext, branchInfo: { ...exportContext.branchInfo, caesarVersion: '11.00' } },
  coordinateRows, bendResolution: { errors: [], bendByIncomingElementIndex: {} },
  rigids: [{ elementId: 'E1', type: 'Valve', weight: 1 }],
});
assert.equal(legacyPlan.ready, false);
assert.ok(legacyPlan.blockerCodes.includes('PIPELINE_RIGID_CAESAR14_REQUIRED'));
assert.throws(() => buildInputXmlPipingModelXml(legacyPlan),
  (error) => error.code === 'PIPELINE_RIGID_CAESAR14_REQUIRED');
const documentSource = fs.readFileSync(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js', import.meta.url), 'utf8');
assert.match(documentSource, /resolvePipelineRigidPlan/);
assert.match(documentSource, /numRigid: elements\.filter/);
assert.match(documentSource, /PIPELINE_RIGID_CAESAR14_REQUIRED/);
assert.match(documentSource, /rigidPlanSchema/);
const writerSource = fs.readFileSync(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js', import.meta.url), 'utf8');
assert.match(writerSource, /caesar14RigidAttributeEntries/);
assert.match(writerSource, /rigidXml\(element\.rigid/);
assert.match(writerSource, /rigidStructureValid/);
console.log('pipeline-3d-model CAESAR 14 rigid payload: PASS');
