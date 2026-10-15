import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseTable1 } from '../tabs/pipeline-3d-model/pipeline-3d-model-geometry.js';
import { framesFromTable1, parseTable2Paste, parseTable3Paste } from '../tabs/pipeline-3d-model/pipeline-3d-model-table-paste-parser.js';
import { SAMPLE_TABLE_2_PASTE_MULTISHEET, SAMPLE_TABLE_3_PASTE_MULTISHEET } from '../tabs/pipeline-3d-model/pipeline-3d-model-table-paste-samples.js';
import { SAMPLE_TABLE_1_MULTISHEET } from '../tabs/pipeline-3d-model/pipeline-3d-model-samples.js';
import { buildPipelineProjectOutputs } from '../tabs/pipeline-3d-model/pipeline-3d-model-project-adapter.js';
import {
  assertPipelineEngineeringSvgParity,
  buildPipelineEngineeringSvgParityReport,
  buildPipelineEngineeringSvgScene,
} from '../tabs/pipeline-3d-model/pipeline-engineering-svg-scene.js';
import {
  createPipelineEngineeringRevisionToken,
  preparePipelineEngineeringSvgViewModel,
} from '../tabs/pipeline-3d-model/pipeline-engineering-svg-view-model.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function snapshot() {
  const frames = framesFromTable1(parseTable1(SAMPLE_TABLE_1_MULTISHEET));
  const table2 = parseTable2Paste(SAMPLE_TABLE_2_PASTE_MULTISHEET, { frames });
  const table3 = parseTable3Paste(SAMPLE_TABLE_3_PASTE_MULTISHEET, { frames });
  const branchInfo = { branchName: 'PL-PARITY', lineNo: 'PL-PARITY', p1: '42', t1: '65' };
  const output = buildPipelineProjectOutputs({
    table1Text: SAMPLE_TABLE_1_MULTISHEET, table2Text: '', table3Text: '', branchInfo,
    profileRaw: {
      table2a: table2.rawText, table3a: table3.table3ARaw,
      table3b: table3.table3BRaw, table3c: table3.table3CRaw,
    },
  });
  return {
    output,
    branchInfo,
    revision: createPipelineEngineeringRevisionToken({
      projectRevision: 'p1', geometryRevision: 'g1', processConfigRevision: 'c1',
    }),
  };
}

function assertNoIssues(report) {
  for (const key of [
    'omittedEntities', 'ledgerErrors', 'duplicateIds', 'invalidCoordinates',
    'unresolvedReferences', 'routeDiscontinuities', 'coordinateRowMismatches',
    'inputXmlCountMismatches', 'inputXmlValueMismatches', 'propertyCoverageGaps',
  ]) assert.deepEqual(report[key], [], key);
}

const authoritative = snapshot();
const original = JSON.stringify(authoritative);
const viewModel = preparePipelineEngineeringSvgViewModel(authoritative);
const report = buildPipelineEngineeringSvgParityReport(viewModel);
assert.equal(JSON.stringify(authoritative), original);
assert.equal(report.passed, true);
assertNoIssues(report);
assert.equal(report.ledgerMode, 'dual');
assert.equal(report.reviewRowCount, 30);
assert.equal(report.geometryRowCount, 19);
assert.equal(report.inputXmlElementCount, 18);
assert.equal(report.expectedRouteSegmentCount, 18);
assert.equal(report.mappedRouteSegmentCount, 18);
assert.equal(report.totalExpected, 48);
assert.equal(report.totalMapped, 48);
assert.equal(report.markerReviewEntityCount, 4);
assert.equal(report.reviewOnlyRowCount, 11);
assert.equal(report.mappedByCategory.routeSegments, authoritative.output.inputXmlCoordinateRows.length - 1);
assert.equal(Object.values(report.mappedReviewPointsByCategory).reduce((sum, count) => sum + count, 0), 30);
assert.equal(assertPipelineEngineeringSvgParity(report), report);

assert.equal(viewModel.reviewRows.length, authoritative.output.coordinateRows.length);
assert.equal(viewModel.geometryRows.length, authoritative.output.inputXmlCoordinateRows.length);
assert(viewModel.reviewRows.every((row, index) => row.point.x === authoritative.output.coordinateRows[index].x
  && row.point.y === authoritative.output.coordinateRows[index].y
  && row.point.z === authoritative.output.coordinateRows[index].z));
assert(viewModel.geometryRows.every((row, index) => row.point.x === authoritative.output.inputXmlCoordinateRows[index].x
  && row.point.y === authoritative.output.inputXmlCoordinateRows[index].y
  && row.point.z === authoritative.output.inputXmlCoordinateRows[index].z));
assert(viewModel.reviewRows.filter((row) => row.category === 'markers')
  .every((row) => row.eventSources.includes('marker') && row.ledgerSource === 'coordinateRows'));
assert(viewModel.routeSegments.every((segment) => segment.ledgerSource === 'inputXmlCoordinateRows'));

const malformedReview = clone(authoritative);
malformedReview.output.coordinateRows[2].x = 'not-a-coordinate';
const malformedReviewReport = buildPipelineEngineeringSvgParityReport(malformedReview);
assert.equal(malformedReviewReport.passed, false);
assert(malformedReviewReport.invalidCoordinates.some((item) => item.reason === 'REVIEW_COORDINATE_INVALID'));
assert.throws(() => buildPipelineEngineeringSvgScene(malformedReview, { sceneId: 'malformed-review' }), /invalidCoordinates/);

const malformedGeometry = clone(authoritative);
malformedGeometry.output.inputXmlCoordinateRows[2].z = 'not-a-coordinate';
const malformedGeometryReport = buildPipelineEngineeringSvgParityReport(malformedGeometry);
assert.equal(malformedGeometryReport.passed, false);
assert(malformedGeometryReport.invalidCoordinates.some((item) => item.reason === 'GEOMETRY_COORDINATE_INVALID'));
assert.throws(() => buildPipelineEngineeringSvgScene(malformedGeometry, { sceneId: 'malformed-geometry' }), /invalidCoordinates/);

const duplicatedReview = clone(authoritative);
duplicatedReview.output.coordinateRows[1].nodeNumber = duplicatedReview.output.coordinateRows[0].nodeNumber;
const duplicateReviewReport = buildPipelineEngineeringSvgParityReport(duplicatedReview);
assert.equal(duplicateReviewReport.passed, false);
assert(duplicateReviewReport.duplicateIds.length > 0);

const duplicatedGeometry = clone(authoritative);
duplicatedGeometry.output.inputXmlCoordinateRows[1].nodeNumber = duplicatedGeometry.output.inputXmlCoordinateRows[0].nodeNumber;
const duplicateGeometryReport = buildPipelineEngineeringSvgParityReport(duplicatedGeometry);
assert.equal(duplicateGeometryReport.passed, false);
assert(duplicateGeometryReport.duplicateIds.length > 0);
assert.throws(() => buildPipelineEngineeringSvgScene(duplicatedGeometry, { sceneId: 'duplicate-geometry' }), /duplicateIds/);

const badXml = clone(authoritative);
badXml.output.xmlText = badXml.output.xmlText.replace(/DELTA_X="(-?[\d.]+)"/, (match, value) => `DELTA_X="${Number(value) + 1}"`);
const xmlReport = buildPipelineEngineeringSvgParityReport(badXml);
assert.equal(xmlReport.passed, false);
assert.equal(xmlReport.inputXmlCountMismatches.length, 0);
assert(xmlReport.inputXmlValueMismatches.length > 0);

const shortXml = clone(authoritative);
shortXml.output.xmlText = shortXml.output.xmlText.replace(/<PIPINGELEMENT\b(?:[^>]*\/>|[^>]*>[\s\S]*?<\/PIPINGELEMENT>)\n?/, '');
const shortXmlReport = buildPipelineEngineeringSvgParityReport(shortXml);
assert.equal(shortXmlReport.passed, false);
assert.deepEqual(shortXmlReport.inputXmlCountMismatches, [{
  reason: 'INPUTXML_ELEMENT_COUNT', expected: 18, actual: 17,
}]);

const discontinuous = clone(viewModel);
discontinuous.routeSegments[1].start.x += 1;
const continuityReport = buildPipelineEngineeringSvgParityReport(discontinuous);
assert.equal(continuityReport.passed, false);
assert(continuityReport.routeDiscontinuities.length > 0);

const badText = clone(authoritative);
badText.output.coordinateText = badText.output.coordinateText.replace(/\t(-?[\d.]+)\t(-?[\d.]+)\t(-?[\d.]+)\t/, '\t999\t$2\t$3\t');
const textReport = buildPipelineEngineeringSvgParityReport(badText);
assert.equal(textReport.passed, false);
assert(textReport.coordinateRowMismatches.length > 0);

mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/pipeline-engineering-svg-parity.json', `${JSON.stringify(report, null, 2)}\n`);

console.log(`PIPELINE_ESVG_COUNTS ${JSON.stringify({
  reviewRows: report.reviewRowCount,
  geometryRows: report.geometryRowCount,
  routeSegments: report.mappedRouteSegmentCount,
  inputXmlElements: report.inputXmlElementCount,
  total: report.totalMapped,
})}`);
console.log('Pipeline engineering SVG deterministic dual-ledger parity guards: ok');
