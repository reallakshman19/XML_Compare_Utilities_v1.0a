import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
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
import { buildPipelineProjectOutputs } from '../tabs/pipeline-3d-model/pipeline-3d-model-project-adapter.js';
import {
  buildPipelineEngineeringSvgParityReport,
  buildPipelineEngineeringSvgScene,
} from '../tabs/pipeline-3d-model/pipeline-engineering-svg-scene.js';
import { createPipelineEngineeringRevisionToken } from '../tabs/pipeline-3d-model/pipeline-engineering-svg-view-model.js';

function markerRichSnapshot() {
  const frames = framesFromTable1(parseTable1(SAMPLE_TABLE_1_MULTISHEET));
  const table2 = parseTable2Paste(SAMPLE_TABLE_2_PASTE_MULTISHEET, { frames });
  const table3 = parseTable3Paste(SAMPLE_TABLE_3_PASTE_MULTISHEET, { frames });
  const branchInfo = Object.freeze({
    branchName: 'PL-SHADOW-CERT', lineNo: 'PL-SHADOW-CERT', p1: '55', t1: '80',
  });
  const output = buildPipelineProjectOutputs({
    table1Text: SAMPLE_TABLE_1_MULTISHEET,
    table2Text: '',
    table3Text: '',
    profileRaw: {
      table2a: table2.rawText,
      table3a: table3.table3ARaw,
      table3b: table3.table3BRaw,
      table3c: table3.table3CRaw,
    },
    branchInfo,
  });
  const revision = createPipelineEngineeringRevisionToken({
    projectRevision: 'shadow-cert-project-r1',
    geometryRevision: 'shadow-cert-geometry-r1',
    processConfigRevision: 'shadow-cert-process-r1',
  });
  return Object.freeze({ output, branchInfo, revision });
}

const snapshot = markerRichSnapshot();
const parity = buildPipelineEngineeringSvgParityReport(snapshot);
const built = buildPipelineEngineeringSvgScene(snapshot, { sceneId: 'pipeline-shadow-cert' });
const evidence = Object.freeze({
  schema: 'PipelineEngineeringSvgShadowCompatibility.v1',
  ledgerMode: parity.ledgerMode,
  reviewCoordinateRowCount: snapshot.output.coordinateRows.length,
  inputXmlCoordinateRowCount: snapshot.output.inputXmlCoordinateRows.length,
  excludedMarkerCount: snapshot.output.diagnostics.markerRowsExcludedFromInputXml,
  routeSegmentCount: parity.mappedRouteSegmentCount,
  inputXmlElementCount: parity.inputXmlElementCount,
  totalExpected: parity.totalExpected,
  totalMapped: parity.totalMapped,
  parityPassed: parity.passed,
  inputXmlMismatches: parity.inputXmlMismatches,
  categories: parity.mappedByCategory,
});

assert.equal(parity.ledgerMode, 'dual');
assert.equal(snapshot.output.coordinateRows.length, 30);
assert.equal(snapshot.output.inputXmlCoordinateRows.length, 19);
assert.equal(snapshot.output.diagnostics.markerRowsExcludedFromInputXml, 11);
assert.equal(parity.mappedRouteSegmentCount, 18);
assert.equal(parity.inputXmlElementCount, 18);
assert.equal(parity.totalExpected, 48);
assert.equal(parity.totalMapped, 48);
assert.equal(parity.passed, true);
assert.deepEqual(parity.inputXmlMismatches, []);
assert.deepEqual(parity.routeDiscontinuities, []);
assert.deepEqual(parity.omittedEntities, []);
assert.equal(built.scene.entities.length, 48);

mkdirSync('artifacts/pipeline-engineering-svg-shadow', { recursive: true });
writeFileSync(
  'artifacts/pipeline-engineering-svg-shadow/compatibility.json',
  `${JSON.stringify(evidence, null, 2)}\n`,
);

console.log(`PIPELINE_SHADOW_COMPATIBILITY ${JSON.stringify(evidence)}`);
