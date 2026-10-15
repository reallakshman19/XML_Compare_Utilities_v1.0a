import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  supportRestraintAssessmentsToCsv,
  supportRestraintDirectionsToCsv,
  supportRestraintExceptionsToCsv,
  supportRestraintFamiliesToCsv,
} from '../tabs/support-steel-relationship-builder/support-restraint-function-export.js';
import {
  renderSupportRestraintFunctionPanel,
  renderSupportRestraintFunctionResults,
} from '../tabs/support-steel-relationship-builder/support-restraint-function-view.js';

const panel = renderSupportRestraintFunctionPanel();
for (const label of [
  'Support restraint-function validation',
  'Intent and analytical capability remain separate evidence',
  'Direction offset tolerance mm', 'Vertical-pipe parallel threshold',
  'REST requires -VERTICAL', 'GUIDE requires both lateral directions',
  'LINE_STOP requires both axial directions', 'HOLD_DOWN requires +VERTICAL',
  'ANCHOR requires all six translation directions',
]) assert.ok(panel.includes(label), `missing restraint function UI label ${label}`);
assert.match(panel, /data-ssrf-rule="restraintDirectionToleranceMm"/);
assert.match(panel, /data-ssrf-rule="verticalPipeParallelThreshold"/);

const restraint = {
  schema: 'SupportRestraintFunctionBundle.v1',
  summary: {
    confirmedFamilyCount: 1, partiallyConfirmedFamilyCount: 1,
    conflictFamilyCount: 0, ambiguousFamilyCount: 0,
    notProvenFamilyCount: 1, exceptionCount: 1,
  },
  functionAssessments: [{
    assessmentId: 'SSRF-ASSESS:/PS-1:/PIPE-1:GUIDE',
    supportFamilyId: '/PS-1', carrierObjectId: '/PIPE-1', supportFunction: 'GUIDE',
    functionStatus: 'FUNCTION_PARTIALLY_CONFIRMED',
    requiredDirections: ['+LATERAL', '-LATERAL'], evidencedDirections: ['+LATERAL'],
    confidence: 'MEDIUM', evidenceBoundary: 'ANALYTICAL_FUNCTION_CANDIDATE',
  }],
  restraintEdges: [{
    edgeId: 'SSRF-EDGE:1', edgeType: 'SUPPORT_RESTRAINT_DIRECTION',
    supportFamilyId: '/PS-1', supportMemberId: '/PS-1.2', carrierObjectId: '/PIPE-1',
    movementDirection: '+LATERAL', relationshipStatus: 'ANALYTICAL_RESTRAINT_DIRECTION_CANDIDATE',
    confidence: 'HIGH', evidenceId: 'SSRF-DIRECTION:1',
  }],
  functionExceptions: [{
    exceptionId: 'SSRF-EX:1', exceptionCode: 'GUIDE_ONLY_ONE_SIDE_PROVEN',
    severity: 'WARN', supportFamilyId: '/PS-1', carrierObjectId: '/PIPE-1',
    supportFunction: 'GUIDE', message: 'Only +LATERAL is analytically evidenced.',
  }],
  familyResults: [{
    supportFamilyId: '/PS-1', functionStatus: 'FUNCTION_PARTIALLY_CONFIRMED',
    intendedFunctions: ['GUIDE'], carrierObjectIds: ['/PIPE-1'],
    assessmentIds: ['SSRF-ASSESS:/PS-1:/PIPE-1:GUIDE'],
    exceptionIds: ['SSRF-EX:1'], exceptionCodes: ['GUIDE_ONLY_ONE_SIDE_PROVEN'],
  }],
};
const results = renderSupportRestraintFunctionResults(restraint);
assert.match(results, /SupportRestraintFunctionBundle\.v1/);
assert.match(results, /FUNCTION_PARTIALLY_CONFIRMED/);
assert.match(results, /GUIDE_ONLY_ONE_SIDE_PROVEN/);
assert.match(results, /ANALYTICAL_FUNCTION_CANDIDATE/);
assert.match(results, /Fabricated restraint confirmed<\/dt><dd>No/);
assert.match(results, /XML required<\/dt><dd>No/);

const bundle = { supportRestraintFunction: restraint };
assert.match(supportRestraintAssessmentsToCsv(bundle), /AssessmentId,SupportFamilyId/);
assert.match(supportRestraintAssessmentsToCsv(bundle), /FUNCTION_PARTIALLY_CONFIRMED/);
assert.match(supportRestraintDirectionsToCsv(bundle), /MovementDirection/);
assert.match(supportRestraintDirectionsToCsv(bundle), /\+LATERAL/);
assert.match(supportRestraintExceptionsToCsv(bundle), /GUIDE_ONLY_ONE_SIDE_PROVEN/);
assert.match(supportRestraintFamiliesToCsv(bundle), /SupportFamilyId,FunctionStatus/);

const engine = readFileSync('tabs/support-steel-relationship-builder/support-restraint-function-engine.js', 'utf8');
const evidence = readFileSync('tabs/support-steel-relationship-builder/support-restraint-evidence.js', 'utf8');
const intent = readFileSync('tabs/support-steel-relationship-builder/support-restraint-intent.js', 'utf8');
const frame = readFileSync('tabs/support-steel-relationship-builder/support-restraint-local-frame.js', 'utf8');
const facade = readFileSync('tabs/support-steel-relationship-builder/support-steel-restraint-evidence-bundle.js', 'utf8');
const builderAddon = readFileSync('tabs/support-steel-relationship-builder/support-restraint-function-addon.js', 'utf8');
const nativeAddon = readFileSync('tabs/ps-family-clash-audit/ps-family-restraint-function-addon.js', 'utf8');
const projection = readFileSync('tabs/ps-family-clash-audit/ps-family-carrier-evidence-projection.js', 'utf8');
const bootstrap = readFileSync('tabs/ps-family-clash-audit/ps-family-evidence-audit-bootstrap.js', 'utf8');

assert.match(engine, /SupportRestraintFunctionBundle\.v1/);
assert.match(engine, /FUNCTION_CONFIRMED/);
assert.match(engine, /FUNCTION_PARTIALLY_CONFIRMED/);
assert.match(engine, /FUNCTION_CONFLICT/);
assert.match(engine, /FUNCTION_NOT_PROVEN/);
assert.match(engine, /FUNCTION_AMBIGUOUS/);
assert.match(engine, /SUPPORT_RESTRAINT_DIRECTION/);
assert.match(frame, /SupportCarrierLocalFrame\.v1/);
assert.match(frame, /VERTICAL_PIPE_FRAME_AMBIGUOUS/);
assert.match(intent, /EXPLICIT_ATTRIBUTE/);
assert.match(intent, /DESCRIPTION_HINT/);
assert.match(evidence, /physicalGeometryAvailable/);
assert.match(evidence, /ANALYTICAL_MEMBER_GEOMETRY_IN_CARRIER_FRAME/);
assert.match(facade, /supportRestraintFunction/);
assert.match(builderAddon, /data-ssrb-input=\"model\"/);
assert.match(builderAddon, /support-steel-restraint-evidence-bundle/);
assert.match(nativeAddon, /Download Restraint Evidence/);
assert.match(nativeAddon, /support-restraint-function-evidence\.zip/);
assert.match(projection, /restraintFunctionAssessmentRows/);
assert.match(projection, /restraintDirectionEdgeRows/);
assert.match(bootstrap, /ps-family-restraint-function-addon\.js/);
assert.match(bootstrap, /restraint-function-v1/);
for (const source of [engine, evidence, intent, frame, facade, builderAddon, nativeAddon]) {
  assert.doesNotMatch(source, /parseSupportChangeXml|clashRows|clashName/);
}

console.log('support-restraint-function-ui tests passed');
