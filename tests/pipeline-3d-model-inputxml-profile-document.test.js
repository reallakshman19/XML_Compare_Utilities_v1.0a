import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  buildPipelineInputXmlDocumentPlan,
  buildPipelineInputXmlDocumentPlanJson,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js';
import { buildInputXmlPipingModelXml } from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';
import { authorityFixture, profileRows, withGreTurn } from './pipeline-3d-model-inputxml-profile-authority.test.js';

export const profileContext = Object.freeze({ schema: 'PipelineUtilityExportContext.v1',
  profile: Object.freeze({ resolvedMode: 'GRE' }),
  readiness: Object.freeze({ blockerCodes: Object.freeze(['GRE_BEND_POLICY_NOT_IMPLEMENTED']) }),
  branchInfo: Object.freeze({ lineNo: 'PL-048', jobName: 'P3D-XML-048', caesarVersion: '11.00',
    diameter: 100, wallThickness: 6, insulationThickness: 0, corrosionAllowance: 0,
    insulationDensity: 0, fluidDensity: 0, materialNumber: 1 }),
});
export const profileSections = Object.freeze([
  Object.freeze({ startElementIndex: 2, diameter: 200 }),
  Object.freeze({ startElementIndex: 4, diameter: 300 }),
]);
export function profileDocumentInput(authority = authorityFixture(), propertySections = profileSections) {
  return { exportContext: profileContext, coordinateRows: profileRows,
    bendResolution: authority.bendResolution, propertySections,
    profileAuthorityPlans: { analysisSectionPlan: authority.analysisSectionPlan,
      analysisDiameterPlan: authority.analysisDiameterPlan, normalFittingPlan: authority.normalFittingPlan,
      b314RadiusPlan: authority.b314RadiusPlan, greVendorSeriesPlan: authority.greVendorSeriesPlan } };
}

const plan = buildPipelineInputXmlDocumentPlan(profileDocumentInput());
assert.equal(plan.ready, true);
assert.equal(plan.profileAuthorityPlan.ready, true);
assert.equal(plan.counts.numElt, 6);
assert.equal(plan.counts.numBend, 2);
assert.deepEqual(plan.elements.map((item) => item.emittedProperties.diameter), [100, 100, 200, 200, 300, 300]);
assert.deepEqual(plan.elements.map((item) => item.analysisSectionId), ['AS1', 'AS1', 'AS2', 'AS2', 'AS3', 'AS3']);
assert.equal(plan.elements[0].bend.radiusMm, 150);
assert.equal(plan.elements[2].bend.radiusMm, 6000);
assert.equal(plan.elements[2].profileAuthority.fittingPolicyId, 'b31.4-cold-field-size-band');
assert.equal(plan.elements[4].bend, null);
assert.equal(plan.blockerCodes.includes('GRE_BEND_POLICY_NOT_IMPLEMENTED'), false);
assert.equal(Object.isFrozen(plan.elements[0].bend.curvatureNodes[0]), true);
assert.equal(buildPipelineInputXmlDocumentPlanJson(plan),
  buildPipelineInputXmlDocumentPlanJson(buildPipelineInputXmlDocumentPlan(profileDocumentInput())));

const profileRegistry = Object.freeze({
  source: Object.freeze({
    registryId: 'P3D-PROFILE-CATALOG', title: 'Approved Profile Catalog', revision: 'R1',
    approvalReference: 'APPROVAL-PROFILE-R1', sha256: 'b'.repeat(64), caesarVersion: '14.00',
  }),
  pipingCodeEntries: Object.freeze([]),
  materialAllowableEntries: Object.freeze([]),
});
const adoptedProfilePlan = buildPipelineInputXmlDocumentPlan({
  ...profileDocumentInput(), approvedCatalogRegistry: profileRegistry,
});
assert.equal(adoptedProfilePlan.ready, true);
assert.equal(adoptedProfilePlan.approvedCatalogAdoption.ready, true);
assert.equal(adoptedProfilePlan.approvedCatalogRegistryBindingPlan.bindingCount, 0);
assert.deepEqual(adoptedProfilePlan.elements, plan.elements);
assert.deepEqual(adoptedProfilePlan.profileAuthorityPlan, plan.profileAuthorityPlan);
assert.equal(buildInputXmlPipingModelXml(adoptedProfilePlan), buildInputXmlPipingModelXml(plan));

const mutableAuthority = authorityFixture();
mutableAuthority.bendResolution.candidates[0].diagnostics = [
  { severity: 'INFO', code: 'TRACE', message: 'trace', details: { node: 110 } },
];
mutableAuthority.bendResolution.bendByIncomingElementIndex[0].diagnostics = structuredClone(
  mutableAuthority.bendResolution.candidates[0].diagnostics);
const mutableInput = profileDocumentInput(mutableAuthority);
const isolatedPlan = buildPipelineInputXmlDocumentPlan(mutableInput);
const isolatedJson = buildPipelineInputXmlDocumentPlanJson(isolatedPlan);
const isolatedXml = buildInputXmlPipingModelXml(isolatedPlan);
const sourceBend = mutableInput.bendResolution.bendByIncomingElementIndex[0];
sourceBend.radiusMm = 999;
sourceBend.bendTypeCode = 2;
sourceBend.curvatureNodes.push({ angleDeg: 60, nodeNumber: 106 });
sourceBend.curvatureNodes[0].nodeNumber = 999999;
sourceBend.diagnostics[0].details.node = 999;
assert.equal(buildPipelineInputXmlDocumentPlanJson(isolatedPlan), isolatedJson);
assert.equal(buildInputXmlPipingModelXml(isolatedPlan), isolatedXml);
assert.equal(isolatedPlan.elements[0].bend.radiusMm, 150);
assert.equal(isolatedPlan.elements[0].bend.bendTypeCode, 0);
assert.equal(isolatedPlan.elements[0].bend.curvatureNodes.length, 1);
assert.equal(isolatedPlan.elements[0].bend.curvatureNodes[0].nodeNumber, 105);
assert.equal(isolatedPlan.elements[0].bend.diagnostics[0].details.node, 110);

const conflict = buildPipelineInputXmlDocumentPlan(profileDocumentInput(authorityFixture(), [
  { startElementIndex: 2, diameter: 201 }, { startElementIndex: 4, diameter: 300 },
]));
assert.equal(conflict.ready, false);
assert.ok(conflict.blockerCodes.includes('PIPELINE_INPUTXML_PROPERTY_CONFLICT'));
const greTurn = buildPipelineInputXmlDocumentPlan(profileDocumentInput(withGreTurn()));
assert.equal(greTurn.ready, false);
assert.ok(greTurn.blockerCodes.includes('PIPELINE_INPUTXML_GRE_BEND_GEOMETRY_REQUIRED'));
assert.equal(greTurn.elements[4].bend, null);
assert.equal(greTurn.counts.numBend, 2);

const legacyContext = { schema: 'PipelineUtilityExportContext.v1', profile: { resolvedMode: 'NORMAL' },
  branchInfo: { branchName: 'BR-07', lineNo: 'PL-100', jobName: 'JOB-100', issueNo: 'A',
    caesarVersion: '11.00', boreMm: '114.3', wallThickness: '6.02', insulationThickness: '0',
    corrosionAllowance: '0', t1: '100', p1: '1000', hydroPressure: '1500', insulationDensity: '0',
    fluidDensity: '0.000965', materialCode: '1' } };
const legacyRows = [{ nodeNumber: 100, x: 0, y: 0, z: 0, nodeName: 'NODE-A', lineNo: 'PL-100' },
  { nodeNumber: 110, x: 1000, y: 0, z: 0, nodeName: 'NODE-B', lineNo: 'PL-100' }];
const noBends = { errors: [], bendByIncomingElementIndex: {} };
const legacyPlan = buildPipelineInputXmlDocumentPlan({ exportContext: legacyContext,
  coordinateRows: legacyRows, bendResolution: noBends });
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
assert.equal(hash(buildPipelineInputXmlDocumentPlanJson(legacyPlan)),
  'c20b46294a53e876501ab08f5adde84c0ca6ce7a262d6d8cd1c986e01381141b');
assert.equal(hash(buildInputXmlPipingModelXml(legacyPlan)),
  '936819d07151f665facb6cad778ec226b80f047e93fde7901c754df97515d759');
assert.equal(Object.hasOwn(legacyPlan, 'profileAuthorityPlan'), false);

const typoContext = structuredClone(legacyContext);
typoContext.readiness = { blockerCodes: ['GRE_BEND_POLICY_NOT_IMPLEMEMTED'] };
const typoPlan = buildPipelineInputXmlDocumentPlan({
  exportContext: typoContext, coordinateRows: legacyRows, bendResolution: noBends,
});
assert.equal(typoPlan.ready, false);
assert.deepEqual(typoPlan.blockerCodes, ['GRE_BEND_POLICY_NOT_IMPLEMEMTED']);
assert.equal(typoPlan.diagnostics[0].code, 'GRE_BEND_POLICY_NOT_IMPLEMEMTED');
assert.equal(typoPlan.diagnostics[0].message, 'The resolved Pipeline export context blocks canonical InputXML.');

console.log('pipeline-3d-model InputXML profile document: PASS');
