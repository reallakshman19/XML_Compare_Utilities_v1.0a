import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPipelineInputXmlDocumentPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js';
import { buildInputXmlPipingModelXml } from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';
import {
  PIPELINE_CAESAR_14_RESTRAINT_ATTRIBUTE_ORDER,
  caesar14RestraintAttributeEntries,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-caesar14-writer-profile.js';
import { resolvePipelineRestraintPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-restraint-plan.js';

const joined = (entries) => entries.map(([name, value]) => `${name}="${value}"`).join(' ');
assert.deepEqual(PIPELINE_CAESAR_14_RESTRAINT_ATTRIBUTE_ORDER, [
  'NUM', 'NODE', 'TYPE', 'STIFFNESS', 'GAP', 'FRIC_COEF', 'CNODE',
  'XCOSINE', 'YCOSINE', 'ZCOSINE', 'TAG', 'GUID',
]);
const real = {
  slot: 1, node: 110, type: 17, stiffness: null, gap: null,
  frictionCoefficient: 0.3, cnode: null,
  xCosine: 0, yCosine: 1, zCosine: 0, tag: 'SL1', guid: '',
};
assert.equal(joined(caesar14RestraintAttributeEntries(real)),
  'NUM="1" NODE="110.000000" TYPE="17.000000" STIFFNESS="-1.010100" GAP="-1.010100" FRIC_COEF="0.300000" CNODE="-1.010100" XCOSINE="0.000000" YCOSINE="1.000000" ZCOSINE="0.000000" TAG="SL1" GUID=""');
const placeholder = {
  slot: 2, placeholder: true, node: null, type: null, stiffness: null, gap: null,
  frictionCoefficient: null, cnode: null, xCosine: 0, yCosine: 0, zCosine: 0,
  tag: '', guid: '',
};
assert.equal(joined(caesar14RestraintAttributeEntries(placeholder)),
  'NUM="2" NODE="-1.010100" TYPE="-1.010100" STIFFNESS="-1.010100" GAP="-1.010100" FRIC_COEF="-1.010100" CNODE="-1.010100" XCOSINE="0.000000" YCOSINE="0.000000" ZCOSINE="0.000000" TAG="" GUID=""');

const plan = resolvePipelineRestraintPlan({
  coordinateRows: [{ nodeNumber: 100 }, { nodeNumber: 110 }],
  restraints: [real],
});
assert.equal(plan.ready, true);
assert.equal(plan.restraintCount, 1);
assert.equal(plan.elements[0].slots.length, 6);
assert.equal(joined(caesar14RestraintAttributeEntries(plan.elements[0].slots[5])),
  'NUM="6" NODE="-1.010100" TYPE="-1.010100" STIFFNESS="-1.010100" GAP="-1.010100" FRIC_COEF="-1.010100" CNODE="-1.010100" XCOSINE="0.000000" YCOSINE="0.000000" ZCOSINE="0.000000" TAG="" GUID=""');

const coordinateRows = [
  { nodeNumber: 100, x: 0, y: 0, z: 0 },
  { nodeNumber: 110, x: 1000, y: 0, z: 0 },
  { nodeNumber: 120, x: 2000, y: 0, z: 0 },
];
const exportContext = { schema: 'PipelineUtilityExportContext.v1', branchInfo: {
  lineNo: 'PL-1C', caesarVersion: '14.00', diameter: 168.275,
  wallThickness: 10.9728, materialNumber: 106,
} };
const documentPlan = buildPipelineInputXmlDocumentPlan({
  exportContext, coordinateRows, bendResolution: { errors: [], bendByIncomingElementIndex: {} },
  restraints: [
    { elementId: 'E1', type: 17, frictionCoefficient: 0.3, yCosine: 1, tag: 'SL1' },
    { node: 120, type: 9, gap: 10, zCosine: 1 },
  ],
});
assert.equal(documentPlan.ready, true);
assert.equal(documentPlan.counts.numRest, 2);
assert.equal(documentPlan.elements[0].restraintSlots.length, 6);
const xml = buildInputXmlPipingModelXml(documentPlan);
assert.match(xml, /NUMREST="2"/);
assert.equal((xml.match(/<RESTRAINT /g) || []).length, 12);
assert.match(xml, /<RESTRAINT NUM="1" NODE="110\.000000" TYPE="17\.000000"/);
const legacyPlan = buildPipelineInputXmlDocumentPlan({
  exportContext: { ...exportContext, branchInfo: { ...exportContext.branchInfo, caesarVersion: '11.00' } },
  coordinateRows, bendResolution: { errors: [], bendByIncomingElementIndex: {} },
  restraints: [{ elementId: 'E1', type: 17, yCosine: 1 }],
});
assert.equal(legacyPlan.ready, false);
assert.ok(legacyPlan.blockerCodes.includes('PIPELINE_RESTRAINT_CAESAR14_REQUIRED'));
assert.throws(() => buildInputXmlPipingModelXml(legacyPlan),
  (error) => error.code === 'PIPELINE_RESTRAINT_CAESAR14_REQUIRED');

const documentSource = fs.readFileSync(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js', import.meta.url), 'utf8');
assert.match(documentSource, /resolvePipelineRestraintPlan/);
assert.match(documentSource, /numRest: elements\.reduce/);
assert.match(documentSource, /PIPELINE_RESTRAINT_CAESAR14_REQUIRED/);
assert.match(documentSource, /restraintPlanSchema/);
const writerSource = fs.readFileSync(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js', import.meta.url), 'utf8');
assert.match(writerSource, /caesar14RestraintAttributeEntries/);
assert.match(writerSource, /element\.restraintSlots/);
assert.match(writerSource, /restraintStructureValid/);

console.log('pipeline-3d-model CAESAR 14 restraint payload: PASS');
