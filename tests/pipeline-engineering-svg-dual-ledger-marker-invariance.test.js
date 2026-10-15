import assert from 'node:assert/strict';
import { parseTable1 } from '../tabs/pipeline-3d-model/pipeline-3d-model-geometry.js';
import {
  framesFromTable1,
  parseTable2Paste,
  parseTable3Paste,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-table-paste-parser.js';
import {
  SAMPLE_TABLE_2_PASTE_MULTISHEET,
  SAMPLE_TABLE_3_PASTE_MULTISHEET,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-table-paste-samples.js';
import { SAMPLE_TABLE_1_MULTISHEET } from '../tabs/pipeline-3d-model/pipeline-3d-model-samples.js';
import { resolvePipelineElasticBends } from '../tabs/pipeline-3d-model/pipeline-3d-model-elastic-bend.js';
import {
  DEFAULT_ELASTIC_BEND_SETTINGS,
  normalizeElasticBendSettings,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-elastic-bend-settings.js';
import { buildPipelineProjectOutputs } from '../tabs/pipeline-3d-model/pipeline-3d-model-project-adapter.js';
import {
  buildCoordinateRows,
  buildInputXmlPipingModelXml,
  coordinateRowsToTabText,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';
import { buildPipelineEngineeringSvgScene } from '../tabs/pipeline-3d-model/pipeline-engineering-svg-scene.js';
import {
  createPipelineEngineeringRevisionToken,
  preparePipelineEngineeringSvgViewModel,
} from '../tabs/pipeline-3d-model/pipeline-engineering-svg-view-model.js';

function branchInfo(branchName) {
  return Object.freeze({
    branchName, lineNo: branchName, boreMm: '100', wallThickness: '6',
    p1: '10', t1: '120', t2: '90', t3: '5', fluidDensity: '100',
    materialCode: '106', corrosionAllowance: '0', insulationThickness: '0',
    insulationDensity: '0', hydroPressure: '15',
  });
}

function revision(tag) {
  return createPipelineEngineeringRevisionToken({
    projectRevision: `project-${tag}`,
    geometryRevision: `geometry-${tag}`,
    processConfigRevision: `process-${tag}`,
  });
}

function profileFixture() {
  const frames = framesFromTable1(parseTable1(SAMPLE_TABLE_1_MULTISHEET));
  const table2 = parseTable2Paste(SAMPLE_TABLE_2_PASTE_MULTISHEET, { frames });
  const table3 = parseTable3Paste(SAMPLE_TABLE_3_PASTE_MULTISHEET, { frames });
  return {
    table2a: table2.rawText,
    table3a: table3.table3ARaw,
    table3b: table3.table3BRaw,
    table3c: table3.table3CRaw,
  };
}

function projectOutput(raw, branchName = 'PL-MARKER') {
  const info = branchInfo(branchName);
  return Object.freeze({
    output: buildPipelineProjectOutputs({
      table1Text: SAMPLE_TABLE_1_MULTISHEET,
      table2Text: '',
      table3Text: '',
      profileRaw: raw,
      branchInfo: info,
    }),
    branchInfo: info,
    revision: revision(branchName),
  });
}

function geometryEvidence(viewModel) {
  return {
    rows: viewModel.geometryRows.map((row) => ({
      id: row.id, nodeNumber: row.nodeNumber, nodeName: row.nodeName, point: row.point,
    })),
    segments: viewModel.routeSegments.map((segment) => ({
      id: segment.id, fromNode: segment.fromNode, toNode: segment.toNode,
      start: segment.start, end: segment.end, delta: segment.delta,
      xmlElement: segment.xmlElement,
    })),
  };
}

const raw = profileFixture();
const baseline = projectOutput(raw, 'PL-MARKER');
const inserted = projectOutput({
  ...raw,
  table3c: `${raw.table3c}\n2000.000\tPMS-ADAPTER-INSERTED`,
}, 'PL-MARKER');
const renamed = projectOutput({
  ...raw,
  table3b: raw.table3b.replace('1.5M', '2.0M'),
}, 'PL-MARKER');

const baselineView = preparePipelineEngineeringSvgViewModel(baseline);
const insertedView = preparePipelineEngineeringSvgViewModel(inserted);
const renamedView = preparePipelineEngineeringSvgViewModel(renamed);

assert.equal(baselineView.ledgerMode, 'dual');
assert.deepEqual(geometryEvidence(insertedView), geometryEvidence(baselineView));
assert.deepEqual(geometryEvidence(renamedView), geometryEvidence(baselineView));
assert.equal(inserted.output.xmlText, baseline.output.xmlText);
assert.equal(renamed.output.xmlText, baseline.output.xmlText);
assert.deepEqual(inserted.output.inputXmlCoordinateRows, baseline.output.inputXmlCoordinateRows);
assert.deepEqual(renamed.output.inputXmlCoordinateRows, baseline.output.inputXmlCoordinateRows);
assert(insertedView.reviewRows.some((row) => row.nodeName.includes('PMS-ADAPTER-INSERTED')));
assert(renamedView.reviewRows.some((row) => row.nodeName.includes('2.0M')));
assert(!baselineView.reviewRows.some((row) => row.nodeName.includes('2.0M')));
assert.equal(buildPipelineEngineeringSvgScene(inserted, { sceneId: 'inserted' }).parity.passed, true);
assert.equal(buildPipelineEngineeringSvgScene(renamed, { sceneId: 'renamed' }).parity.passed, true);

function sourcePoint(x, y, z, source, label) {
  return {
    x, y, z, source, sources: [source], label,
    grade: z, elevationAuthority: 'TABLE_2',
    markerEvidence: [{ label, source }],
  };
}

function bendSettings() {
  return normalizeElasticBendSettings({
    ...DEFAULT_ELASTIC_BEND_SETTINGS,
    enabled: true,
    emitToInputXml: true,
    screeningOnlyAcknowledged: true,
    diameterSource: 'explicit-od',
    explicitOutsideDiameterMm: 100,
    useFormulaMinimum: false,
    usePracticalMinimum: true,
    practicalRadiusMultiplierD: 1.5,
    minimumTurnAngleDeg: 0.1,
    maximumTurnAngleDeg: 179,
    retainedStraightAllowanceMm: 0,
    preferredStraightTangentMm: 0,
  });
}

function bendSnapshot(points, tag) {
  const info = branchInfo('PL-BEND-ADAPTER');
  const coordinateRows = buildCoordinateRows(points, info.branchName);
  const elasticBends = resolvePipelineElasticBends({
    points, coordinateRows, branchInfo: info, settings: bendSettings(),
  });
  const xmlText = buildInputXmlPipingModelXml(info, elasticBends.geometryRows, elasticBends);
  return Object.freeze({
    output: Object.freeze({
      combined: points,
      coordinateRows,
      inputXmlCoordinateRows: elasticBends.geometryRows,
      coordinateText: coordinateRowsToTabText(coordinateRows),
      xmlText,
      elasticBends,
      diagnostics: elasticBends.diagnostics,
      warnings: elasticBends.warnings,
    }),
    branchInfo: info,
    revision: revision(tag),
  });
}

const bendPoints = [
  sourcePoint(0, 0, 0, 'vertex', 'A'),
  sourcePoint(50, 0, 0, 'marker', 'PMS-001'),
  sourcePoint(100, 0, 0, 'vertex', 'IP-1'),
  sourcePoint(100, 100, 0, 'vertex', 'B'),
];
const bendVariantPoints = [
  sourcePoint(0, 0, 0, 'vertex', 'A'),
  sourcePoint(25, 0, 0, 'marker', 'PMS-NEW'),
  sourcePoint(50, 0, 0, 'marker', 'PMS-001-RENAMED'),
  sourcePoint(100, 0, 0, 'vertex', 'IP-1'),
  sourcePoint(100, 100, 0, 'vertex', 'B'),
];
const bend = bendSnapshot(bendPoints, 'bend');
const bendVariant = bendSnapshot(bendVariantPoints, 'bend-variant');
const bendView = preparePipelineEngineeringSvgViewModel(bend);
const bendVariantView = preparePipelineEngineeringSvgViewModel(bendVariant);

assert.equal(bendView.geometryRows.length, 3);
assert.equal(bendView.routeSegments.length, 2);
assert.equal(bendView.inputXmlElements.length, 2);
assert.equal(bendView.reviewRows.filter((row) => row.category === 'markers').length, 1);
assert.equal(bendView.inputXmlElements.filter((element) => element.bend).length, 1);
assert(bendView.routeSegments[0].xmlElement.bend);
assert.equal(bendView.routeSegments[1].xmlElement.bend, null);
assert.equal(bendView.routeSegments[0].xmlElement.bend.radius, 150);
assert.deepEqual(geometryEvidence(bendVariantView), geometryEvidence(bendView));
assert.equal(bendVariant.output.xmlText, bend.output.xmlText);
assert.equal(bendVariantView.reviewRows.filter((row) => row.category === 'markers').length, 2);
assert.equal(buildPipelineEngineeringSvgScene(bend, { sceneId: 'bend' }).scene.entities.length, 6);
assert.equal(buildPipelineEngineeringSvgScene(bendVariant, { sceneId: 'bend-variant' }).scene.entities.length, 7);

console.log('Pipeline Engineering SVG marker and bend dual-ledger invariance: ok');
