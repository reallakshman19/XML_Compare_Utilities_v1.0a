import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { parseTable1 } from '../tabs/pipeline-3d-model/pipeline-3d-model-geometry.js';
import { executePipelineCadBatchMove } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-batch-controller.js';
import { moveTable2RowsCommand, moveTable3MarkerRowsCommand } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-batch-commands.js';
import { CommandHistory } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-commands.js';
import { PipelineProfileModel } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-model.js';
import { buildAuthoritativePipelineOutputs } from '../tabs/pipeline-3d-model/pipeline-3d-model-profile-propagation.js';
import { framesFromTable1, parseTable2Paste, parseTable3Paste } from '../tabs/pipeline-3d-model/pipeline-3d-model-table-paste-parser.js';
import { SAMPLE_TABLE_2_PASTE_MULTISHEET, SAMPLE_TABLE_3_PASTE_MULTISHEET } from '../tabs/pipeline-3d-model/pipeline-3d-model-table-paste-samples.js';
import { SAMPLE_TABLE_1_MULTISHEET } from '../tabs/pipeline-3d-model/pipeline-3d-model-samples.js';
import { createEmptyPipelineEngineeringConfigurationDraft, setPipelineEngineeringConfigurationField,
  updatePipelineEngineeringConfigurationDraftCollections } from '../tabs/pipeline-3d-model/pipeline-3d-model-engineering-configuration-fields.js';
function profileRaw() {
  const frames = framesFromTable1(parseTable1(SAMPLE_TABLE_1_MULTISHEET));
  const table2 = parseTable2Paste(SAMPLE_TABLE_2_PASTE_MULTISHEET, { frames });
  const table3 = parseTable3Paste(SAMPLE_TABLE_3_PASTE_MULTISHEET, { frames });
  return { table2a: table2.rawText, table3a: table3.table3ARaw,
    table3b: table3.table3BRaw, table3c: table3.table3CRaw };
}
function configurationDraft() {
  let draft = createEmptyPipelineEngineeringConfigurationDraft();
  const values = { jobName: 'PCAD-004R', caesarVersion: '11.00', branchName: 'PCAD-004R', lineNo: 'PCAD-004R',
    outsideDiameterMm: 100, wallThickness: 6, materialNumber: 106, corrosionAllowance: 0,
    insulationThickness: 0, insulationDensity: 0, fluidDensity: 0, hydroPressure: 0,
    bendScreeningEnabled: true, emitToInputXml: true, screeningOnlyAcknowledged: true,
    detectHorizontal: true, detectVertical: true, detectCompound: true,
    minimumPlanTurnAngleDeg: 0.25, minimumProfileTurnAngleDeg: 0.25, maximumTurnAngleDeg: 45,
    shortElementAnglePolicy: 'ignore-below-length', minimumAngleElementLengthMm: 1000,
    retainedStraightAllowanceMm: 0, preferredStraightTangentMm: 2000,
    emitNearPointNode: true, emitMidpointNode: true, bendTypeCode: 0,
    normalFittingPolicyId: 'normal-standard-elbow', normalRadiusD: 1.5 };
  for (const [fieldId, value] of Object.entries(values)) draft = setPipelineEngineeringConfigurationField(draft, fieldId, value);
  return updatePipelineEngineeringConfigurationDraftCollections(draft, { sections: [{
    analysisSectionId: 'AS1', startElementIndex: 0, profileId: 'normal-metallic', outsideDiameterMm: 100,
    boundaryAuthority: 'TEST', boundarySourceReference: 'pcad-current-authority',
    sourceAuthority: 'TEST', sourceReference: 'pcad-current-authority' }] });
}
const CONFIGURATION_DRAFT = configurationDraft();
const ANALYSIS_SECTIONS = Object.freeze([{ startElementIndex: 0, profileId: 'normal-metallic',
  boundaryAuthority: 'TEST', boundarySourceReference: 'pcad-current-authority',
  sourceAuthority: 'TEST', sourceReference: 'pcad-current-authority' }]);
const build = (raw) => buildAuthoritativePipelineOutputs({ table1Text: SAMPLE_TABLE_1_MULTISHEET,
  table2Text: '', table3Text: '', profileRaw: raw, configurationDraft: CONFIGURATION_DRAFT,
  analysisSections: ANALYSIS_SECTIONS });
const bendEvidence = (output) => output.elasticBends.candidates.map((item) => ({
  classification: item.classification, radiusMm: item.radiusMm,
  incomingElementIndex: item.incomingElementIndex, previousNode: item.previousNode,
  cornerNode: item.cornerNode, nextNode: item.nextNode, status: item.status }));
const raw = profileRaw(), baseline = build(raw);
assert.equal(baseline.configurationPlan.ready, true, JSON.stringify(baseline.configurationPlan.blockerCodes));
assert.equal(baseline.diagnostics.elevationAuthority, 'TABLE_2');
assert.equal(baseline.orchestration.ready, false);
assert.ok(baseline.orchestration.blockerCodes.includes('PIPELINE_CONFIGURATION_INPUTXML_BLOCKED'));
assert.equal(baseline.xmlText, '');
assert.ok(baseline.inputXmlCoordinateRows.length < baseline.coordinateRows.length);
const markerModel = PipelineProfileModel.fromRaw(raw), markerSerializedBaseline = markerModel.serializeRaw();
const markerHistory = new CommandHistory(), markerRows = markerModel.table3MarkerRows.slice(0, 2);
markerHistory.execute(moveTable3MarkerRowsCommand(markerModel,
  markerRows.map((row) => ({ id: row.id, absoluteH: row.absoluteH + 3 }))));
const markerOutput = build(markerModel.serializeRaw());
assert.notEqual(markerModel.serializeRaw().table3c, raw.table3c);
assert.deepEqual(markerOutput.inputXmlCoordinateRows, baseline.inputXmlCoordinateRows);
assert.deepEqual(bendEvidence(markerOutput), bendEvidence(baseline));
assert.deepEqual(markerOutput.orchestration.blockerCodes, baseline.orchestration.blockerCodes);
assert.notDeepEqual(markerOutput.coordinateRows, baseline.coordinateRows);
markerHistory.undo(); assert.deepEqual(markerModel.serializeRaw(), markerSerializedBaseline);
markerHistory.redo(); assert.deepEqual(build(markerModel.serializeRaw()).inputXmlCoordinateRows, baseline.inputXmlCoordinateRows);
const table2Model = PipelineProfileModel.fromRaw(raw), table2History = new CommandHistory();
const table2Rows = table2Model.table2Rows.slice(2, 4);
table2History.execute(moveTable2RowsCommand(table2Model,
  table2Rows.map((row) => ({ id: row.id, elevation: row.elevationValue + 1 }))));
const table2Output = build(table2Model.serializeRaw());
assert.notDeepEqual(table2Output.inputXmlCoordinateRows, baseline.inputXmlCoordinateRows);
assert.equal(table2Output.xmlText, '');
assert.ok(table2Output.combined.every((point) => point.elevationAuthority === 'TABLE_2'));
assert.ok(table2Output.combined.every((point) => point.z === point.grade));
const blockedModel = PipelineProfileModel.fromRaw(raw), blockedHistory = new CommandHistory();
const blockedController = { model: blockedModel, history: blockedHistory,
  execute(command) { blockedHistory.execute(command); return true; }, dispatchEvent() {} };
const blockedBefore = blockedModel.serializeRaw();
assert.equal(executePipelineCadBatchMove(blockedController, { graph: 'table3x', entityType: 'depth-node',
  edits: blockedModel.table3DepthRows.map((row) => ({ id: row.id, z: row.z - 1 })) }), false);
assert.equal(blockedHistory.undoStack.length, 0); assert.deepEqual(blockedModel.serializeRaw(), blockedBefore);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const production = ['pipeline-3d-model-cad-authoring.js', 'pipeline-3d-model-cad-batch-commands.js',
  'pipeline-3d-model-cad-batch-controller.js', 'pipeline-3d-model-cad-batch-view.js',
  'pipeline-3d-model-cad-commands.js', 'pipeline-3d-model-cad-precision-runtime.js',
  'pipeline-3d-model-cad-selection-contracts.js', 'pipeline-3d-model-cad-selection-runtime.js',
  'pipeline-3d-model-cad-workspace.js', 'pipeline-3d-model-table2x-canvas.js',
  'pipeline-3d-model-table3x-canvas.js'];
for (const name of production) {
  const source = fs.readFileSync(path.join(ROOT, 'tabs/pipeline-3d-model', name), 'utf8');
  assert.ok(source.split(/\r?\n/).length < 300, `${name} must remain below 300 lines`);
  assert.doesNotMatch(source, /export\s+default\b|MutationObserver|pipeline-engineering-svg|core\/engineering-svg/);
}
const table3Source = fs.readFileSync(path.join(ROOT, 'tabs/pipeline-3d-model/pipeline-3d-model-table3x-canvas.js'), 'utf8');
const batchSource = fs.readFileSync(path.join(ROOT, 'tabs/pipeline-3d-model/pipeline-3d-model-cad-batch-commands.js'), 'utf8');
assert.match(table3Source, /TABLE3_DEPTH_BATCH_NOT_AUTHORIZED/);
assert.doesNotMatch(batchSource, /moveTable3DepthRowsCommand|target\.moveDepth/);
console.log('Pipeline CAD explicit current-authority regression tests passed');