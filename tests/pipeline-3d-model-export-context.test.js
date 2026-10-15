import assert from 'node:assert/strict';
import { buildPipelineExportContextJson, qualifyPipelineUtilityExport,
  resolvePipelineUtilityExportContext } from '../tabs/pipeline-3d-model/pipeline-3d-model-export-context.js';
import { buildPipelineInputXmlDocumentPlan } from '../tabs/pipeline-3d-model/pipeline-3d-model-inputxml-document.js';
import { buildInputXmlPipingModelXml } from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';
const branchInfo = Object.freeze({ branchName: 'BR-07', lineNo: 'PL-100', boreMm: '100', wallThickness: '6',
  p1: '10', t1: '120', fluidDensity: '100', materialCode: '106', corrosionAllowance: '0',
  insulationThickness: '0', insulationDensity: '0', hydroPressure: '15' });
const rows = Object.freeze([
  Object.freeze({ branchName: 'BR-07', lineNo: 'PL-100', nodeNumber: 100, x: 0, y: 0, z: 0, nodeName: 'NODE-A' }),
  Object.freeze({ branchName: 'BR-07', lineNo: 'PL-100', nodeNumber: 110, x: 1000, y: 0, z: 0, nodeName: 'NODE-B' }),
]);
const noErrors = Object.freeze({ errors: Object.freeze([]), bendByIncomingElementIndex: Object.freeze({}),
  diagnostics: Object.freeze({ candidateCount: 0, emittedCount: 0, blockedCount: 0 }) });
const context = (settings = {}, info = branchInfo) => resolvePipelineUtilityExportContext({ branchInfo: info, settings });
function qualification(exportContext, bendResolution = noErrors) {
  const documentPlan = buildPipelineInputXmlDocumentPlan({ exportContext, coordinateRows: rows, bendResolution });
  return qualifyPipelineUtilityExport(exportContext, rows, bendResolution, documentPlan);
}
const missing = context({});
assert.equal(missing.profile.resolvedMode, '');
assert.equal(missing.profile.fallbackApplied, false);
assert.equal(missing.profile.resolutionReason, 'PROFILE_NOT_SPECIFIED');
assert.ok(missing.readiness.blockerCodes.includes('PIPELINE_CONFIGURATION_PROFILE_REQUIRED'));
assert.equal(qualification(missing).inputXmlAllowed, false);
const normal = context({ designBasis: 'default-metallic', requestedDesignBasis: 'default-metallic' });
assert.equal(normal.profile.resolvedMode, 'NORMAL'); assert.equal(normal.profile.fallbackApplied, false);
assert.equal(qualification(normal).inputXmlAllowed, true);
const b314 = context({ designBasis: 'asme-b31.4', requestedDesignBasis: 'asme-b31.4' });
assert.equal(b314.profile.resolvedMode, 'ASME_B31_4'); assert.equal(qualification(b314).inputXmlAllowed, true);
const greStraight = context({ designBasis: 'gre', requestedDesignBasis: 'gre' });
assert.equal(greStraight.profile.resolvedMode, 'GRE');
assert.equal(greStraight.readiness.fittingInputXmlRequested, false);
assert.equal(greStraight.readiness.preflightInputXmlAllowed, true);
const greFitting = context({ designBasis: 'gre', requestedDesignBasis: 'gre', enabled: true,
  emitToInputXml: true, greNominalBoreMm: 100,
  greBendBreakLengthBasis: 'NOMINAL_BORE_MULTIPLIER', greBendBreakMultiplierBore: 1.5 });
assert.equal(greFitting.grePlaceholder.bend.breakLengthMm, 150);
assert.deepEqual(greFitting.readiness.blockerCodes, ['GRE_BEND_POLICY_NOT_IMPLEMENTED']);
assert.equal(qualification(greFitting).inputXmlAllowed, false);
const unknown = context({ designBasis: 'not-a-profile' });
assert.equal(unknown.profile.resolvedMode, ''); assert.equal(unknown.profile.fallbackApplied, false);
assert.equal(unknown.profile.resolutionReason, 'PROFILE_INVALID');
const xml = buildInputXmlPipingModelXml(normal, rows);
assert.match(xml, /LINE="PL-100"/); assert.match(xml, /NUMELT="1"/);
assert.equal(buildInputXmlPipingModelXml(branchInfo, rows), xml, 'legacy branch-info callers remain compatible');
const blockedResolution = Object.freeze({ hasBlockingErrors: true,
  errors: Object.freeze([Object.freeze({ code: 'GRE_BEND_POLICY_NOT_IMPLEMENTED', message: 'GRE fitting emission is blocked.' })]),
  bendByIncomingElementIndex: Object.freeze({}) });
assert.throws(() => buildInputXmlPipingModelXml(greFitting, rows, blockedResolution),
  (error) => error.code === 'GRE_BEND_POLICY_NOT_IMPLEMENTED');
const blockedQualification = qualification(greFitting, blockedResolution);
assert.equal(buildPipelineExportContextJson(greFitting, blockedQualification),
  buildPipelineExportContextJson(greFitting, blockedQualification));
assert.ok(Object.isFrozen(greFitting)); assert.ok(Object.isFrozen(qualification(normal)));
const emptyPlan = buildPipelineInputXmlDocumentPlan({ exportContext: normal, coordinateRows: [], bendResolution: noErrors });
assert.deepEqual(qualifyPipelineUtilityExport(normal, [], noErrors, emptyPlan).blockerCodes,
  ['PIPELINE_GEOMETRY_SEGMENT_REQUIRED']);
console.log('Pipeline export context explicit qualification: ok');
