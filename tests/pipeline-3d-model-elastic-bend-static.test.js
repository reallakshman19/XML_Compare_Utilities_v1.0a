import assert from 'node:assert/strict';
import fs from 'node:fs';

const names = [
  'pipeline-3d-model-bend-policy.js',
  'pipeline-3d-model-bend-feasibility.js',
  'pipeline-3d-model-bend-classification.js',
  'pipeline-3d-model-bend-screening.js',
  'pipeline-3d-model-gre-placeholder.js',
  'pipeline-3d-model-bend-route.js',
  'pipeline-3d-model-bend-resolution-status.js',
  'pipeline-3d-model-bend-resolution-nodes.js',
  'pipeline-3d-model-bend-resolution.js',
  'pipeline-3d-model-elastic-bend-settings.js',
  'pipeline-3d-model-elastic-bend.js',
  'pipeline-3d-model-elastic-bend-ui-style.js',
  'pipeline-3d-model-elastic-bend-ui-policy-view.js',
  'pipeline-3d-model-elastic-bend-ui-view.js',
  'pipeline-3d-model-elastic-bend-ui-results.js',
  'pipeline-3d-model-elastic-bend-ui.js',
];
const sources = Object.fromEntries(names.map((name) => [
  name,
  fs.readFileSync(new URL(`../tabs/pipeline-3d-model/${name}`, import.meta.url), 'utf8'),
]));
for (const [name, text] of Object.entries(sources)) {
  assert.ok(text.split(/\r?\n/).length < 300, `${name} must stay below 300 lines`);
  assert.doesNotMatch(text, /export\s+default/);
}

const policy = sources['pipeline-3d-model-bend-policy.js'];
assert.match(policy, /ASME B31\.4/);
assert.match(policy, /edition: '2025'/);
assert.match(policy, /radiusReference: '404\.2\.2'/);
assert.match(policy, /tangentReference: '434\.7\.1\(d\)'/);
assert.match(policy, /if\s*\(nps\s*===\s*14\)\s*return\s*21/);
assert.match(policy, /if\s*\(nps\s*===\s*16\)\s*return\s*24/);
assert.match(policy, /if\s*\(nps\s*===\s*18\)\s*return\s*27/);
assert.match(policy, /if\s*\(nps\s*>=\s*20\)\s*return\s*30/);
assert.match(policy, /qualificationEvidenceRequired/);

const feasibility = sources['pipeline-3d-model-bend-feasibility.js'];
assert.match(feasibility, /requiredSide\(left\)\s*\+\s*requiredSide\(right\)/);
assert.match(feasibility, /left\.outgoingElementIndex\s*!==\s*right\.incomingElementIndex/);
assert.match(feasibility, /sharedSegmentFits/);
assert.match(feasibility, /availableLengthMm/);
assert.match(feasibility, /requiredLengthMm/);

const classification = sources['pipeline-3d-model-bend-classification.js'];
assert.match(classification, /TABLE1_PLAN_TURN_COLD_FIELD/);
assert.match(classification, /TABLE2_PROFILE_ONLY_ELASTIC/);
assert.match(classification, /TABLE1_PLAN_PRECEDENCE_COMPOUND_COLD_FIELD/);
assert.match(classification, /B31_4_COLD_FIELD_MULTIPLIER/);
assert.match(classification, /ignore-below-length/);

const core = [
  sources['pipeline-3d-model-elastic-bend.js'],
  sources['pipeline-3d-model-bend-screening.js'],
  sources['pipeline-3d-model-bend-route.js'],
  sources['pipeline-3d-model-bend-resolution.js'],
  sources['pipeline-3d-model-bend-resolution-status.js'],
  sources['pipeline-3d-model-bend-resolution-nodes.js'],
].join('\n');
assert.match(core, /youngsModulusMpa \* outsideDiameterMm/);
assert.match(core, /2 \* settings\.allowableBendingStressMpa/);
assert.match(core, /practicalRadiusMultiplierD \* outsideDiameterMm/);
assert.match(core, /Math\.tan\(\(turnAngleDeg \/ DEG\) \/ 2\)/);
assert.match(core, /values\.includes\('vertex'\) \|\| values\.includes\('table2'\)/);
assert.doesNotMatch(core, /depthRule|zOffset/i);
assert.match(core, /NODE_START \+ geometryIndex \* NODE_STEP/);
assert.match(core, /retainedStraightAllowanceMm/);
assert.match(core, /resolveSharedBendSegmentFeasibility/);
assert.match(core, /BEND_GEOMETRY_INFEASIBLE/);
assert.match(core, /BEND_SHARED_SEGMENT_INFEASIBLE/);
assert.match(core, /COLD_FIELD_BEND_QUALIFICATION_REQUIRED/);
assert.match(core, /sharedSegmentFailureCount/);
assert.match(core, /PipelineBendResolution\.v3/);
assert.match(core, /markerRowsExcludedBefore/);
assert.match(core, /role: 'NEAR_POINT'/);
assert.match(core, /role: 'MIDPOINT'/);
assert.match(core, /GreBendBreakBasis/);
assert.match(core, /GreTeeBreakBasis/);

const settings = sources['pipeline-3d-model-elastic-bend-settings.js'];
assert.match(settings, /PipelineBendSettings\.v4/);
assert.match(settings, /ELASTIC_BEND_STORAGE_KEY = 'pipeline-3d-model-bend-settings-v3'/);
assert.match(settings, /enabled: null, emitToInputXml: null, screeningOnlyAcknowledged: null/);
assert.match(settings, /designBasis: '', requestedDesignBasis: '', profileFallbackApplied: false/);
assert.match(settings, /bendClass: ''/);
assert.match(settings, /standardRadiusMultiplierD: null/);
assert.match(settings, /coldFieldRadiusMultiplierD: null/);
assert.match(settings, /shortElementAnglePolicy: ''/);
assert.match(settings, /coldFieldProjectRadiusMultiplierD: null/);
assert.match(settings, /retainedStraightAllowanceMm: null/);
assert.match(settings, /preferredStraightTangentMm: null/);
assert.match(settings, /profileResolutionReason/);
assert.match(settings, /greNominalBoreMm/);
assert.match(settings, /greBendBreakMultiplierBore: null/);
assert.match(settings, /greBendLocalThicknessMm/);
assert.match(settings, /greTeeBreakLengthMm/);
assert.match(settings, /greTeeLocalThicknessMm/);

const gre = sources['pipeline-3d-model-gre-placeholder.js'];
assert.match(gre, /PipelineGreFittingPlaceholder\.v1/);
assert.match(gre, /NOMINAL_BORE_MULTIPLIER/);
assert.match(gre, /EXPLICIT_LENGTH/);
assert.match(gre, /resolverReady: false/);
assert.match(gre, /geometryApplied: false/);
assert.match(gre, /inputXmlApplied: false/);

const ui = [
  sources['pipeline-3d-model-elastic-bend-ui.js'],
  sources['pipeline-3d-model-elastic-bend-ui-style.js'],
  sources['pipeline-3d-model-elastic-bend-ui-policy-view.js'],
  sources['pipeline-3d-model-elastic-bend-ui-view.js'],
  sources['pipeline-3d-model-elastic-bend-ui-results.js'],
].join('\n');
assert.match(ui, /Pipeline Bend Settings/);
assert.match(ui, /ASME B31\.4 — automatic classification/);
assert.match(ui, /Table 1 plan turn → Cold field/);
assert.match(ui, /GRE bend policy not implemented/);
assert.match(ui, /Normal — default, standard 1\.5D/);
assert.match(ui, /greNominalBoreMm/);
assert.match(ui, /greBendLocalThicknessMm/);
assert.match(ui, /greTeeBreakLengthMm/);
assert.match(ui, /1\.5 × 100 = 150 mm even when OD is 114\.3 mm/);
assert.match(ui, /Short elements remain in authoritative geometry/);
assert.match(ui, /installPipelineEngineeringConfigurationUi/);
assert.match(ui, /savePipelineEngineeringConfigurationDraft/);
assert.match(ui, /installPipelineElasticBendSettingsUi/);
assert.match(sources['pipeline-3d-model-elastic-bend-ui.js'], /PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY/);

const xml = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js', import.meta.url), 'utf8');
assert.match(xml, /function usableCurvatureNodes/);
assert.match(xml, /angle < turnAngleDeg - 1e-7/);
assert.match(xml, /attr\('NUM_MITER', 0\)/);
assert.match(xml, /buildPipelineInputXmlDocumentPlan/);
assert.match(xml, /PIPELINE_INPUTXML_DOCUMENT_SCHEMA/);
assert.match(xml, /NUMBEND/);
assert.match(xml, /bendByIncomingElementIndex|element\.bend/);
assert.doesNotMatch(xml, /SENTINEL_MISSING|-1\.010100|NUMELEMENTS/);

const adapter = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-project-adapter.js', import.meta.url), 'utf8');
assert.match(adapter, /output\.artifacts/);
assert.match(adapter, /pipeline-elastic-bends\.tsv/);
assert.match(adapter, /excludedMarkerCount/);
assert.match(adapter, /orchestrationBlockerCount/);
assert.match(adapter, /elasticBendCandidateCount/);
assert.match(adapter, /elasticBendEmittedCount/);
assert.match(adapter, /inputXmlDocumentBlockerCount/);

const profile = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-profile-propagation.js', import.meta.url), 'utf8');
assert.match(profile, /inputXmlCoordinateRows: inputXmlRows/);
assert.match(profile, /appendDiagnostics/);
assert.match(profile, /inputXmlDocumentPlanText/);
assert.match(profile, /markerRowsExcludedFromInputXml/);
assert.match(profile, /elasticBendText/);

const addon = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-table-paste-addon.js', import.meta.url), 'utf8');
assert.match(addon, /pipeline-3d-model-elastic-bend-ui\.js\?v=20260722-p3d-base-039-1/);
assert.match(addon, /export function loadMultiSheetPasteSamples/);
assert.match(addon, /installPipelineElasticBendSettingsUi\(dialog\)/);

const psnm = fs.readFileSync(new URL('../tabs/psnm-utility-tab.js', import.meta.url), 'utf8');
assert.match(psnm, /pipeline-3d-model-table-paste-addon\.js\?v=20260722-p3d-base-039-1/);
const runtime = fs.readFileSync(new URL('../core/app-standalone-runtime.js', import.meta.url), 'utf8');
assert.match(runtime, /export const STANDALONE_APP/);
assert.match(runtime, /M27 P3D-BASE-039/);

await import('./pipeline-3d-model-gre-placeholder.test.js');
await import('./pipeline-3d-model-inputxml-document-static.test.js');

console.log('Pipeline authoritative bend and canonical InputXML static guards passed.');