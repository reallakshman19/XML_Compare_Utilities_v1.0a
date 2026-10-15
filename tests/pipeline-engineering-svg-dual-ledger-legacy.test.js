import assert from 'node:assert/strict';
import { buildInputXmlPipingModelXml, coordinateRowsToTabText } from '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js';
import {
  buildPipelineEngineeringSvgParityReport,
  buildPipelineEngineeringSvgScene,
} from '../tabs/pipeline-3d-model/pipeline-engineering-svg-scene.js';
import {
  createPipelineEngineeringRevisionToken,
  preparePipelineEngineeringSvgViewModel,
} from '../tabs/pipeline-3d-model/pipeline-engineering-svg-view-model.js';

function revision(tag) {
  return createPipelineEngineeringRevisionToken({
    projectRevision: `legacy-project-${tag}`,
    geometryRevision: `legacy-geometry-${tag}`,
    processConfigRevision: `legacy-process-${tag}`,
  });
}

const branchInfo = Object.freeze({
  branchName: 'PL-LEGACY', lineNo: 'PL-LEGACY', boreMm: '100', wallThickness: '6',
  p1: '10', t1: '120', t2: '90', t3: '5', fluidDensity: '100',
  materialCode: '106', corrosionAllowance: '0', insulationThickness: '0',
  insulationDensity: '0', hydroPressure: '15',
});
const coordinateRows = Object.freeze([
  Object.freeze({ branchName: 'PL-LEGACY', nodeNumber: 100, x: 0, y: 0, z: 0, nodeName: 'A' }),
  Object.freeze({ branchName: 'PL-LEGACY', nodeNumber: 110, x: 1000, y: 0, z: 0, nodeName: 'B' }),
  Object.freeze({ branchName: 'PL-LEGACY', nodeNumber: 120, x: 1000, y: 1000, z: 0, nodeName: 'C' }),
]);
const combined = Object.freeze(coordinateRows.map((row, index) => Object.freeze({
  x: row.x / 1000,
  y: row.y / 1000,
  z: row.z / 1000,
  source: 'vertex',
  sources: ['vertex'],
  label: row.nodeName,
  horizontal: index,
  grade: 0,
  elevationAuthority: 'TABLE_2',
})));
const xmlText = buildInputXmlPipingModelXml(branchInfo, coordinateRows);

function legacySnapshot(overrides = {}, tag = 'base') {
  return {
    output: {
      combined,
      coordinateRows,
      coordinateText: coordinateRowsToTabText(coordinateRows),
      xmlText,
      ...overrides,
    },
    branchInfo,
    revision: revision(tag),
  };
}

const legacy = legacySnapshot();
const before = JSON.stringify(legacy);
const viewModel = preparePipelineEngineeringSvgViewModel(legacy);
const report = buildPipelineEngineeringSvgParityReport(viewModel);
const built = buildPipelineEngineeringSvgScene(legacy, { sceneId: 'legacy' });

assert.equal(viewModel.ledgerMode, 'legacy-single');
assert.equal(viewModel.authority.routeGeometrySource, 'coordinateRows');
assert.equal(viewModel.reviewRows.length, 3);
assert.equal(viewModel.geometryRows.length, 3);
assert.equal(viewModel.routeSegments.length, 2);
assert.equal(report.passed, true);
assert.equal(report.ledgerMode, 'legacy-single');
assert.equal(report.totalMapped, 5);
assert.equal(built.scene.entities.length, 5);
assert.equal(JSON.stringify(legacy), before, 'legacy preparation and scene mapping must not mutate owner output');

const missingXml = legacySnapshot({ xmlText: xmlText.replace(/<PIPINGELEMENT\b[^>]*\/>\n?/, '') }, 'missing-xml');
const missingXmlReport = buildPipelineEngineeringSvgParityReport(missingXml);
assert.equal(missingXmlReport.ledgerMode, 'legacy-single');
assert(missingXmlReport.ledgerErrors.some((item) => item.reason === 'LEGACY_INPUTXML_COUNT_MISMATCH'));
assert.throws(() => buildPipelineEngineeringSvgScene(missingXml, { sceneId: 'legacy-bad' }), /ledgerErrors/);

for (const [name, value, reason] of [
  ['null', null, 'DUAL_GEOMETRY_LEDGER_NOT_ARRAY'],
  ['object', {}, 'DUAL_GEOMETRY_LEDGER_NOT_ARRAY'],
  ['empty', [], 'DUAL_GEOMETRY_LEDGER_TOO_SHORT'],
  ['one-row', [coordinateRows[0]], 'DUAL_GEOMETRY_LEDGER_TOO_SHORT'],
]) {
  const snapshot = legacySnapshot({ inputXmlCoordinateRows: value }, `dual-${name}`);
  const dual = preparePipelineEngineeringSvgViewModel(snapshot);
  const dualReport = buildPipelineEngineeringSvgParityReport(dual);
  assert.equal(dual.ledgerMode, 'dual', `${name} must not fall back to legacy mode`);
  assert(dualReport.ledgerErrors.some((item) => item.reason === reason));
  assert.throws(() => buildPipelineEngineeringSvgScene(snapshot, { sceneId: `dual-${name}` }), /ledgerErrors/);
}

const invalidGeometry = legacySnapshot({
  inputXmlCoordinateRows: [coordinateRows[0], { ...coordinateRows[1], x: 'invalid' }, coordinateRows[2]],
}, 'dual-invalid');
const invalidGeometryReport = buildPipelineEngineeringSvgParityReport(invalidGeometry);
assert.equal(invalidGeometryReport.ledgerMode, 'dual');
assert(invalidGeometryReport.invalidCoordinates.some((item) => item.reason === 'GEOMETRY_COORDINATE_INVALID'));
assert.throws(() => buildPipelineEngineeringSvgScene(invalidGeometry, { sceneId: 'dual-invalid' }), /invalidCoordinates/);

const duplicateGeometry = legacySnapshot({
  inputXmlCoordinateRows: [coordinateRows[0], { ...coordinateRows[1], nodeNumber: 100 }, coordinateRows[2]],
}, 'dual-duplicate');
const duplicateReport = buildPipelineEngineeringSvgParityReport(duplicateGeometry);
assert.equal(duplicateReport.ledgerMode, 'dual');
assert(duplicateReport.duplicateIds.length > 0);
assert.throws(() => buildPipelineEngineeringSvgScene(duplicateGeometry, { sceneId: 'dual-duplicate' }), /duplicateIds/);

console.log('Pipeline Engineering SVG explicit legacy and fail-closed dual-ledger modes: ok');
