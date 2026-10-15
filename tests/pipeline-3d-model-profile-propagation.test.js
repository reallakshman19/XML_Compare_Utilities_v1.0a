import assert from 'node:assert/strict';
import { parseTable1 } from '../tabs/pipeline-3d-model/pipeline-3d-model-geometry.js';
import { framesFromTable1, parseTable2Paste,
  parseTable3Paste } from '../tabs/pipeline-3d-model/pipeline-3d-model-table-paste-parser.js';
import { SAMPLE_TABLE_2_PASTE_MULTISHEET,
  SAMPLE_TABLE_3_PASTE_MULTISHEET } from '../tabs/pipeline-3d-model/pipeline-3d-model-table-paste-samples.js';
import { SAMPLE_TABLE_1_MULTISHEET } from '../tabs/pipeline-3d-model/pipeline-3d-model-samples.js';
import { buildAuthoritativePipelineOutputs,
  sanitizeTable1Label } from '../tabs/pipeline-3d-model/pipeline-3d-model-profile-propagation.js';
import { createEmptyPipelineEngineeringConfigurationDraft,
  setPipelineEngineeringConfigurationField,
  updatePipelineEngineeringConfigurationDraftCollections } from '../tabs/pipeline-3d-model/pipeline-3d-model-engineering-configuration-fields.js';

const PLACEHOLDER_TABLE_1 = [
  'at point X= Y= Z=\t392.755\t-173.688\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t695.086\t-152.301\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t860.335\t-140.566\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t1117.081\t-122.414\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t1295.369\t-90.301\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t1381.772\t-214.552\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t1427.714\t-222.807\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t1450.082\t-254.974\t0\t0\t0\t0\t0',
].join('\n');
const TABLE3_MARKERS = Object.freeze([
  'HL 0.0', 'HL 14.7', '1.5M START', '1.5M END',
  'A/G START', 'A/G END', 'PMS-001', 'PMS-004',
]);
function profileRaw() {
  const frames = framesFromTable1(parseTable1(SAMPLE_TABLE_1_MULTISHEET));
  const table2 = parseTable2Paste(SAMPLE_TABLE_2_PASTE_MULTISHEET, { frames });
  const table3 = parseTable3Paste(SAMPLE_TABLE_3_PASTE_MULTISHEET, { frames });
  return { table2a: table2.rawText, table3a: table3.table3ARaw,
    table3b: table3.table3BRaw, table3c: table3.table3CRaw };
}
function explicitConfigurationDraft() {
  let draft = createEmptyPipelineEngineeringConfigurationDraft();
  const values = {
    jobName: 'PROFILE-TEST', issueNo: 'A', caesarVersion: '11.00',
    branchName: 'PL-XX', lineNo: 'PL-XX', outsideDiameterMm: 100,
    wallThickness: 6, materialNumber: 106, corrosionAllowance: 0,
    insulationThickness: 0, insulationDensity: 0, fluidDensity: 100,
    hydroPressure: 15, pressure1: 10, temperature1: 120,
    bendScreeningEnabled: true, emitToInputXml: true,
    screeningOnlyAcknowledged: true, detectHorizontal: true,
    detectVertical: true, detectCompound: true,
    minimumPlanTurnAngleDeg: 0.25, minimumProfileTurnAngleDeg: 0.25,
    maximumTurnAngleDeg: 45, shortElementAnglePolicy: 'ignore-below-length',
    minimumAngleElementLengthMm: 1000, retainedStraightAllowanceMm: 0,
    preferredStraightTangentMm: 2000, emitNearPointNode: true,
    emitMidpointNode: true, bendTypeCode: 0,
    normalFittingPolicyId: 'normal-standard-elbow', normalRadiusD: 1.5,
  };
  for (const [fieldId, value] of Object.entries(values)) {
    draft = setPipelineEngineeringConfigurationField(draft, fieldId, value);
  }
  draft = updatePipelineEngineeringConfigurationDraftCollections(draft, {
    sections: [{ analysisSectionId: 'AS1', startElementIndex: 0, profileId: 'normal-metallic',
      outsideDiameterMm: 100, boundaryAuthority: 'TEST', boundarySourceReference: 'profile-fixture',
      sourceAuthority: 'TEST', sourceReference: 'profile-fixture' }],
  });
  return draft;
}
const CONFIGURATION_DRAFT = explicitConfigurationDraft();
function build(raw = profileRaw(), table1Text = SAMPLE_TABLE_1_MULTISHEET) {
  return buildAuthoritativePipelineOutputs({ table1Text, table2Text: '', table3Text: '',
    profileRaw: raw, configurationDraft: CONFIGURATION_DRAFT,
    analysisSections: [{ startElementIndex: 0, profileId: 'normal-metallic',
      boundaryAuthority: 'TEST', boundarySourceReference: 'profile-fixture',
      sourceAuthority: 'TEST', sourceReference: 'profile-fixture' }] });
}
function coordinateRows(value) {
  return value.split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
    const [branch, lineNo, node, x, y, z, name] = line.split('\t');
    return { branch, lineNo, node: Number(node), x: Number(x), y: Number(y), z: Number(z), name };
  });
}
const xyzRows = (value) => coordinateRows(value).map(({ x, y, z }) => ({ x, y, z }));
function xmlDeltas(value) {
  return [...value.matchAll(/DELTA_X="(-?[\d.]+)"[^>]*DELTA_Y="(-?[\d.]+)"[^>]*DELTA_Z="(-?[\d.]+)"/g)]
    .map((match) => Math.hypot(Number(match[1]), Number(match[2]), Number(match[3])));
}
const raw = profileRaw(), before = JSON.stringify(raw), output = build(raw);
assert.equal(JSON.stringify(raw), before, 'raw profile evidence must remain immutable');
assert.equal(output.configurationPlan.ready, true, JSON.stringify(output.configurationPlan.blockerCodes));
assert.equal(output.configurationPlan.draftSchema, CONFIGURATION_DRAFT.schema);
assert.equal(output.diagnostics.elevationAuthority, 'TABLE_2');
assert.equal(output.diagnostics.table2Rows, 10);
assert.equal(output.diagnostics.table3LengthRows, 4);
assert.equal(output.diagnostics.table3DepthRows, 2);
assert.equal(output.diagnostics.table3MarkerRows, 4);
assert.ok(output.diagnostics.warningCount >= 1);
assert.ok(output.warnings.some((warning) => warning.code === 'grade_profile_extrapolated'));
assert.ok(output.errors.some((error) => error.code === 'PIPELINE_CONFIGURATION_INPUTXML_BLOCKED'));
assert.ok(output.orchestration.blockerCodes.includes('PIPELINE_CONFIGURATION_INPUTXML_BLOCKED'));
assert.equal(output.xmlText, '');
assert.ok(Math.abs(output.diagnostics.stationSlope - 1) < 0.001);
assert.ok(output.diagnostics.stationResidual < 0.05);
assert.ok(output.diagnostics.routeStartStation > 12830 && output.diagnostics.routeStartStation < 12834);
assert.ok(output.diagnostics.table3OriginRoute > 760 && output.diagnostics.table3OriginRoute < 780);
assert.ok(output.diagnostics.maxSegment < 600);
assert.ok(output.diagnostics.markerRowsExcludedFromInputXml > 0);
assert.match(output.table2Text, /13621\.6\t240\.17/);
assert.match(output.table2XText, /13\+621\.6/);
assert.match(output.table3XText, /\n1\t1430\.577\t1430\.577\t0\.0/);
for (const expected of ['14.7', '46.7', '21.2', '20.9', '1.5M', 'A/G', 'PMS-001', 'PMS-004']) {
  assert.ok(output.table3XText.includes(expected), `Table 3X must retain ${expected}`);
}
assert.match(output.coordinateText, /Sheet 1 Pt 1/);
assert.doesNotMatch(output.coordinateText, /T1-001/);
assert.equal(sanitizeTable1Label('at point X= Y= Z=', 0), 'T1-001');
assert.equal(sanitizeTable1Label('Sheet 1 Pt 1', 0), 'Sheet 1 Pt 1');
const placeholderOutput = build(raw, PLACEHOLDER_TABLE_1);
assert.doesNotMatch(placeholderOutput.table1OutputText, /at point X= Y= Z=/i);
assert.doesNotMatch(placeholderOutput.coordinateText, /at point X= Y= Z=/i);
assert.equal(placeholderOutput.xmlText, '');
assert.match(placeholderOutput.table1OutputText, /T1-001/);
assert.match(placeholderOutput.coordinateText, /T1-001/);
const elPoint = output.combined.find((point) => point.label.includes('EL 13621.6'));
assert.ok(elPoint); assert.ok(elPoint.horizontal > 780 && elPoint.horizontal < 810);
assert.ok(elPoint.horizontal < output.diagnostics.routeLength);
assert.ok(!output.combined.some((point) => point.horizontal > output.diagnostics.routeLength + 0.001));
assert.ok(output.combined.every((point) => point.z === point.grade));
assert.ok(output.combined.every((point) => point.elevationAuthority === 'TABLE_2'));
const rows = coordinateRows(output.coordinateText);
const pms1 = rows.find((row) => row.name.includes('PMS-001'));
const pms4 = rows.find((row) => row.name.includes('PMS-004'));
assert.ok(pms1 && pms4); assert.ok(pms1.z > 240000 && pms1.z < 242000);
assert.ok(pms4.z > 240000 && pms4.z < 242000);
for (const expected of TABLE3_MARKERS) {
  assert.ok(output.coordinateText.includes(expected));
  assert.ok(!output.xmlText.includes(expected));
}
assert.doesNotMatch(output.coordinateText, /GRADE END|GRADE START/);
assert.equal(output.xmlText, '');
const zByXy = new Map();
for (const row of rows) {
  const key = `${row.x}|${row.y}`;
  if (zByXy.has(key)) assert.equal(row.z, zByXy.get(key)); else zByXy.set(key, row.z);
}
const markerOnlyOutput = build({ ...raw, table3b: raw.table3b.replace('1.5M', '2.0M') });
assert.deepEqual(xyzRows(markerOnlyOutput.coordinateText), xyzRows(output.coordinateText));
assert.match(markerOnlyOutput.coordinateText, /2\.0M START/);
assert.equal(markerOnlyOutput.xmlText, '');
const table2AuthorityOutput = build({ ...raw, table2a: raw.table2a.replace('240.17', '241.17') });
assert.notDeepEqual(xyzRows(table2AuthorityOutput.coordinateText), xyzRows(output.coordinateText));
assert.equal(table2AuthorityOutput.xmlText, '');
const deltas = xmlDeltas(output.xmlText);
assert.equal(deltas.length, 0);
assert.equal((output.xmlText.match(/<PIPINGELEMENT\b/g) || []).length, 0);
assert.ok(output.inputXmlCoordinateRows.length < rows.length);
const warningOutput = build({ ...raw, table3c: `${raw.table3c}\n2000.000\tPMS-OUTSIDE` });
assert.ok(warningOutput.warnings.some((warning) => warning.code === 'table3_h_clamped'));

console.log('pipeline-3d-model profile propagation tests passed');