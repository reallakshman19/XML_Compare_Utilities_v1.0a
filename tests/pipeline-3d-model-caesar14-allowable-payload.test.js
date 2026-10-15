import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPipelineInputXmlDocumentPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js';
import { buildInputXmlPipingModelXml } from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';

const coordinateRows = [
  { nodeNumber: 100, x: 0, y: 0, z: 0 },
  { nodeNumber: 110, x: 1000, y: 0, z: 0 },
  { nodeNumber: 120, x: 2000, y: 0, z: 0 },
];
const exportContext = { schema: 'PipelineUtilityExportContext.v1', branchInfo: {
  lineNo: 'PL-1E', caesarVersion: '14.00', jobName: 'TRI-1E',
} };
const documentPlan = buildPipelineInputXmlDocumentPlan({
  exportContext, coordinateRows,
  bendResolution: { errors: [], bendByIncomingElementIndex: {} },
  allowableStresses: [{
    elementId: 'E1', pipingCode: 3, coldAllow: 620528, suppRqr: 0, expAllow: -1,
    cases: [{ num: 1, hotAllow: 510000, hotSy: 448159, cycRedFactor: 1 }],
  }],
});
assert.equal(documentPlan.ready, true);
assert.equal(documentPlan.counts.numAllow, 1);
assert.equal(documentPlan.elements[0].allowableStress.cases.length, 9);
const xml = buildInputXmlPipingModelXml(documentPlan);
assert.match(xml, /NUMALLOW="1"/);
assert.equal((xml.match(/<ALLOWABLESTRESS /g) || []).length, 1);
assert.equal((xml.match(/<CASE /g) || []).length, 9);
assert.match(xml, /<ALLOWABLESTRESS ALLOWBL_STRESS_INDICATOR="" DESIGN_FACTOR="" HOOP_STRESS_FACTOR="-1\.010100"/);
assert.match(xml, /PIPING_CODE="3\.000000" SUPP_RQR="0"/);
assert.match(xml, /<CASE NUM="1" HOT_ALLOW="510000\.000000" HOT_SY="448159\.000000"/);
assert.match(xml, /<CASE NUM="2" HOT_ALLOW="-1\.010100"/);

const inactive = buildPipelineInputXmlDocumentPlan({ exportContext, coordinateRows,
  bendResolution: { errors: [], bendByIncomingElementIndex: {} } });
assert.equal(inactive.counts.numAllow, 0);
assert.equal('allowableStressPlan' in inactive, false);
assert.equal('allowableStress' in inactive.elements[0], false);
assert.doesNotMatch(buildInputXmlPipingModelXml(inactive), /ALLOWABLESTRESS|<CASE /);

const legacy = buildPipelineInputXmlDocumentPlan({
  exportContext: { ...exportContext, branchInfo: { ...exportContext.branchInfo, caesarVersion: '11.00' } },
  coordinateRows, bendResolution: { errors: [], bendByIncomingElementIndex: {} },
  allowableStresses: [{ elementId: 'E1' }],
});
assert.equal(legacy.ready, false);
assert.ok(legacy.blockerCodes.includes('PIPELINE_ALLOWABLE_CAESAR14_REQUIRED'));
assert.throws(() => buildInputXmlPipingModelXml(legacy),
  (error) => error.code === 'PIPELINE_ALLOWABLE_CAESAR14_REQUIRED');

const documentSource = fs.readFileSync(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js', import.meta.url), 'utf8');
assert.match(documentSource, /resolvePipelineAllowableStressPlan/);
assert.match(documentSource, /numAllow: elements\.filter/);
assert.match(documentSource, /PIPELINE_ALLOWABLE_CAESAR14_REQUIRED/);
const writerSource = fs.readFileSync(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js', import.meta.url), 'utf8');
assert.match(writerSource, /caesar14AllowableStressAttributeEntries/);
assert.match(writerSource, /allowableStructureValid/);

console.log('pipeline-3d-model CAESAR 14 allowable payload: PASS');
