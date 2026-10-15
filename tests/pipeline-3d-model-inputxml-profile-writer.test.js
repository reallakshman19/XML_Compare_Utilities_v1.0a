import assert from 'node:assert/strict';
import { buildPipelineInputXmlDocumentPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js';
import { buildInputXmlPipingModelXml } from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';
import { withGreTurn } from './pipeline-3d-model-inputxml-profile-authority.test.js';
import { profileDocumentInput } from './pipeline-3d-model-inputxml-profile-document.test.js';

const plan = buildPipelineInputXmlDocumentPlan(profileDocumentInput());
const xml = buildInputXmlPipingModelXml(plan);
assert.equal(xml, buildInputXmlPipingModelXml(buildPipelineInputXmlDocumentPlan(profileDocumentInput())));
assert.equal(xml, buildInputXmlPipingModelXml(JSON.parse(JSON.stringify(plan))));
assert.equal((xml.match(/ DIAMETER="/g) || []).length, 6);
assert.match(xml, /ID="E1"[^>]*DIAMETER="100"/);
assert.match(xml, /ID="E3"[^>]*DIAMETER="200"/);
assert.match(xml, /ID="E5"[^>]*DIAMETER="300"/);
assert.match(xml, /<BEND RADIUS="150" TYPE="0" ANGLE1="45" NODE1="105" NUM_MITER="0"\/>/);
assert.match(xml, /<BEND RADIUS="6000" TYPE="0" ANGLE1="45" NODE1="125" NUM_MITER="0"\/>/);
assert.equal((xml.match(/<BEND /g) || []).length, 2);
assert.doesNotMatch(xml, /FITTINGTHICKNESS=/);
assert.doesNotMatch(xml, /\b(PROFILE|PIPING_CODE|VENDOR|SERIES|QUALIFICATION|ANALYSIS_SECTION)=/);
assert.doesNotMatch(xml, /NPS|NOMINAL_BORE/);

function writerBlocked(mutator) {
  const forged = structuredClone(plan); mutator(forged);
  assert.throws(() => buildInputXmlPipingModelXml(forged),
    (error) => error.code === 'PIPELINE_INPUTXML_WRITER_BLOCKED');
}
writerBlocked((v) => { v.elements[0].emittedProperties.diameter = 99; });
writerBlocked((v) => { v.elements[0].bend.radiusMm = 149; });
writerBlocked((v) => { v.elements[0].bend.fittingThicknessMm = 7; });
writerBlocked((v) => { v.elements[0].bend.bendTypeCode = 2; });
writerBlocked((v) => { v.elements[0].bend.curvatureNodes[0].angleDeg = 10; });
writerBlocked((v) => { v.elements[0].bend.curvatureNodes[0].nodeNumber = 999999; });
writerBlocked((v) => { v.elements[0].bend.previousNode = 999; });
writerBlocked((v) => { v.elements[0].bend.nextNode = 999; });
writerBlocked((v) => { v.elements[0].bend.curvatureNodes.push({ angleDeg: 60, nodeNumber: 106 }); });
writerBlocked((v) => { v.elements[1].bend = { radiusMm: 150 }; });
writerBlocked((v) => { v.elements[4].bend = { radiusMm: 762, fittingThicknessMm: 14 }; });
writerBlocked((v) => { v.profileAuthorityPlan.sectionAuthorities.splice(0, 1); });
writerBlocked((v) => { v.profileAuthorityPlan.sectionAuthorities[0].startElementIndex = 1; });
writerBlocked((v) => { v.profileAuthorityPlan.fittingAuthorities.splice(0, 1); });
writerBlocked((v) => { v.profileAuthorityPlan.fittingAuthorities[0].incomingElementIndex = 1; });
writerBlocked((v) => { v.profileAuthorityPlan.analysisSectionPlanSchema = 'PipelineAnalysisSectionPlan.v0'; });
writerBlocked((v) => { v.analysisDiameterPlanSchema = 'PipelineAnalysisDiameterPlan.v0'; });
writerBlocked((v) => { v.counts.numBend = 1; });
writerBlocked((v) => { v.counts.numElt = 5; });
writerBlocked((v) => { v.blockerCodes = ['FORGED']; v.ready = true; });
writerBlocked((v) => { v.diagnostics = [{ severity: 'BLOCKING', code: 'FORGED', message: 'x', details: {} }]; v.ready = true; });

const greTurn = buildPipelineInputXmlDocumentPlan(profileDocumentInput(withGreTurn()));
assert.equal(greTurn.elements[4].profileAuthority.fittingThicknessMm, 14);
assert.equal(greTurn.elements[4].bend, null);
assert.throws(() => buildInputXmlPipingModelXml(greTurn), (error) =>
  error.code === 'PIPELINE_INPUTXML_GRE_BEND_GEOMETRY_REQUIRED'
  && error.blockerCodes.includes('PIPELINE_INPUTXML_GRE_BEND_GEOMETRY_REQUIRED'));
console.log('pipeline-3d-model InputXML profile writer: PASS');
