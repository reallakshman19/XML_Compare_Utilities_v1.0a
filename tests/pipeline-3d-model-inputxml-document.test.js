import assert from 'node:assert/strict';
import {
  buildPipelineInputXmlDocumentPlan,
  buildPipelineInputXmlDocumentPlanJson,
  PIPELINE_INPUTXML_DOCUMENT_SCHEMA,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js';
import { buildInputXmlPipingModelXml } from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';

const branchInfo = Object.freeze({
  branchName: 'BR-07', lineNo: 'PL-100', jobName: 'JOB-100', issueNo: 'A',
  caesarVersion: '11.00', boreMm: '114.3', wallThickness: '6.02',
  insulationThickness: '0', corrosionAllowance: '0', t1: '100', p1: '1000',
  hydroPressure: '1500', insulationDensity: '0', fluidDensity: '0.000965', materialCode: '1',
});
const context = Object.freeze({
  schema: 'PipelineUtilityExportContext.v1', profile: Object.freeze({ resolvedMode: 'NORMAL' }), branchInfo,
});
const rows = Object.freeze([
  Object.freeze({ nodeNumber: 100, x: 0, y: 0, z: 0, nodeName: 'NODE-A', lineNo: 'PL-100' }),
  Object.freeze({ nodeNumber: 110, x: 1000, y: 0, z: 0, nodeName: 'NODE-B', lineNo: 'PL-100' }),
]);
const noBends = Object.freeze({ errors: Object.freeze([]), bendByIncomingElementIndex: Object.freeze({}) });

const plan = buildPipelineInputXmlDocumentPlan({ exportContext: context, coordinateRows: rows, bendResolution: noBends });
assert.equal(plan.schema, PIPELINE_INPUTXML_DOCUMENT_SCHEMA);
assert.equal(plan.ready, true);
assert.deepEqual(plan.blockerCodes, []);
assert.equal(plan.counts.numElt, 1);
assert.equal(plan.counts.numBend, 0);
assert.equal(plan.elements[0].id, 'E1');
assert.equal(plan.elements[0].line, 'PL-100');
assert.equal(plan.elements[0].fromName, 'NODE-A');
assert.equal(plan.elements[0].propertySectionId, 'S1');
assert.equal(plan.elements[0].propertyDisposition, 'SECTION_START');
assert.ok(Object.isFrozen(plan));

const xml = buildInputXmlPipingModelXml(plan);
assert.match(xml, /<CAESARII xmlns="COADE" xmlns:ext="urn:reallaksh19:inputxml:extension:v1" VERSION="11\.00" XML_TYPE="Input">/);
assert.match(xml, /<PIPINGMODEL xmlns="" JOBNAME="JOB-100" ISSUE_NO="A" NUMELT="1"/);
assert.match(xml, /DIAMETER="114\.3" WALL_THICK="6\.02"/);
assert.match(xml, /FROM_NAME="NODE-A" TO_NAME="NODE-B" LINE="PL-100"/);
assert.doesNotMatch(xml, /NUMELEMENTS=|-1\.010100|NaN|Infinity/);
assert.equal(buildInputXmlPipingModelXml(context, rows, noBends), xml);

const bend = Object.freeze({
  radiusMm: 171.45, bendTypeCode: 0, turnAngleDeg: 90,
  curvatureNodes: Object.freeze([Object.freeze({ angleDeg: 45, nodeNumber: 105 })]),
});
const bendResolution = Object.freeze({ errors: Object.freeze([]), bendByIncomingElementIndex: Object.freeze({ 0: bend }) });
const bendPlan = buildPipelineInputXmlDocumentPlan({ exportContext: context, coordinateRows: rows, bendResolution });
const bendXml = buildInputXmlPipingModelXml(bendPlan);
assert.equal(bendPlan.counts.numBend, 1);
assert.match(bendXml, /<BEND RADIUS="171\.45" TYPE="0" ANGLE1="45" NODE1="105" NUM_MITER="0"\/>/);
assert.doesNotMatch(bendXml, /ANGLE2=|NODE2=|FITTINGTHICKNESS=|KFACTOR=/);

function planFor(overrides = {}, overrideRows = rows) {
  return buildPipelineInputXmlDocumentPlan({
    exportContext: { schema: 'PipelineUtilityExportContext.v1', profile: { resolvedMode: 'NORMAL' }, branchInfo: { ...branchInfo, ...overrides } },
    coordinateRows: overrideRows, bendResolution: noBends,
  });
}

assert.deepEqual(planFor({ lineNo: '' }).blockerCodes, ['PIPELINE_LINE_NUMBER_REQUIRED']);
assert.deepEqual(planFor({ boreMm: '' }).blockerCodes, ['PIPELINE_DIAMETER_REQUIRED']);
assert.deepEqual(planFor({ wallThickness: '' }).blockerCodes, ['PIPELINE_WALL_THICKNESS_REQUIRED']);
assert.deepEqual(planFor({}, [rows[0]]).blockerCodes, ['PIPELINE_GEOMETRY_SEGMENT_REQUIRED']);
assert.deepEqual(planFor({}, [rows[0], { ...rows[0], nodeNumber: 110 }]).blockerCodes, ['PIPELINE_ZERO_LENGTH_ELEMENT']);
assert.deepEqual(planFor({}, [rows[0], { ...rows[1], x: Number.NaN }]).blockerCodes, ['PIPELINE_GEOMETRY_NONFINITE']);
assert.deepEqual(planFor({}, [rows[0], { ...rows[1], nodeNumber: 100 }]).blockerCodes, ['PIPELINE_NODE_PAIR_INVALID']);

const greContextBlocked = Object.freeze({
  ...context, profile: Object.freeze({ resolvedMode: 'GRE' }),
  readiness: Object.freeze({ blockerCodes: Object.freeze(['GRE_BEND_POLICY_NOT_IMPLEMENTED']) }),
});
const contextBlockedPlan = buildPipelineInputXmlDocumentPlan({ exportContext: greContextBlocked, coordinateRows: rows, bendResolution: noBends });
assert.deepEqual(contextBlockedPlan.blockerCodes, ['GRE_BEND_POLICY_NOT_IMPLEMENTED']);
assert.throws(() => buildInputXmlPipingModelXml(greContextBlocked, rows, noBends), (error) => error.code === 'GRE_BEND_POLICY_NOT_IMPLEMENTED');

const firstJson = buildPipelineInputXmlDocumentPlanJson(plan);
assert.equal(firstJson, buildPipelineInputXmlDocumentPlanJson(plan));
assert.match(firstJson, /PipelineInputXmlDocumentPlan\.v1/);
assert.match(firstJson, /PipelinePropertySectionPlan\.v1/);
console.log('Pipeline canonical InputXML document planning tests passed.');
