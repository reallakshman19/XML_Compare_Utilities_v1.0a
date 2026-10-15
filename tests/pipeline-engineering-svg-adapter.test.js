import assert from 'node:assert/strict';
import { projectEngineeringGeometry } from '../core/engineering-svg/index.js';
import { runEngineeringSvgAdapterConformance } from '../core/engineering-svg/engineering-svg-adapter-conformance.js';
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
import { createPipelineEngineeringSvgAdapter } from '../tabs/pipeline-3d-model/pipeline-engineering-svg-adapter.js';
import { buildPipelineEngineeringSvgScene } from '../tabs/pipeline-3d-model/pipeline-engineering-svg-scene.js';
import { createPipelineEngineeringRevisionToken } from '../tabs/pipeline-3d-model/pipeline-engineering-svg-view-model.js';

function fixture() {
  const frames = framesFromTable1(parseTable1(SAMPLE_TABLE_1_MULTISHEET));
  const table2 = parseTable2Paste(SAMPLE_TABLE_2_PASTE_MULTISHEET, { frames });
  const table3 = parseTable3Paste(SAMPLE_TABLE_3_PASTE_MULTISHEET, { frames });
  const branchInfo = Object.freeze({
    branchName: 'PL-ESVG', lineNo: 'PL-ESVG', boreMm: '914.4', wallThickness: '12.7',
    p1: '55', t1: '80', t2: '40', t3: '20', fluidDensity: '850', materialCode: '106',
    corrosionAllowance: '3', insulationThickness: '50', insulationDensity: '120', hydroPressure: '82.5',
  });
  const output = buildPipelineProjectOutputs({
    table1Text: SAMPLE_TABLE_1_MULTISHEET, table2Text: '', table3Text: '',
    profileRaw: {
      table2a: table2.rawText, table3a: table3.table3ARaw,
      table3b: table3.table3BRaw, table3c: table3.table3CRaw,
    },
    branchInfo,
  });
  const revision = createPipelineEngineeringRevisionToken({
    projectRevision: 'fixture-project-r1',
    geometryRevision: 'fixture-propagation-r1',
    processConfigRevision: 'fixture-process-r1',
  });
  return Object.freeze({ output, branchInfo, revision });
}

function point(value) {
  return { x: value.x, y: value.y, z: value.z };
}

function field(set, key) {
  return set.fields.find((value) => value.key === key);
}

const snapshot = fixture();
const before = JSON.stringify(snapshot);
const built = buildPipelineEngineeringSvgScene(snapshot, { sceneId: 'pipeline-fixture' });
const { scene, parity, viewModel } = built;
assert.equal(JSON.stringify(snapshot), before, 'scene mapping must not mutate owner output');
assert.equal(viewModel.ledgerMode, 'dual');
assert.equal(viewModel.authority.reviewPointSource, 'coordinateRows');
assert.equal(viewModel.authority.routeGeometrySource, 'inputXmlCoordinateRows');
assert.equal(viewModel.authority.inputXmlParitySource, 'xmlText');
assert.equal(parity.passed, true);
assert.equal(parity.reviewRowCount, 30);
assert.equal(parity.geometryRowCount, 19);
assert.equal(parity.expectedRouteSegmentCount, 18);
assert.equal(parity.inputXmlElementCount, 18);
assert.equal(parity.totalMapped, 48);
assert.equal(scene.entities.length, 48);
assert.equal(scene.coordinateSystem.unit, 'mm');
assert.equal(scene.coordinateSystem.verticalAxis, 'Z');
assert.equal(scene.coordinateSystem.frame, 'GLOBAL');
assert.equal(scene.coordinateSystem.handedness, 'right');
assert.equal(scene.capabilities.editing, false);

const reviewEntities = scene.entities.filter((entity) => entity.geometry.kind === 'point')
  .sort((left, right) => left.metadata.pipeline.sourceIndex - right.metadata.pipeline.sourceIndex);
assert.equal(reviewEntities.length, snapshot.output.coordinateRows.length);
reviewEntities.forEach((entity, index) => {
  const row = snapshot.output.coordinateRows[index];
  assert.deepEqual(point(entity.geometry.position), point(row));
  assert.equal(entity.id, `pipeline:${row.branchName}:node:${row.nodeNumber}`);
  assert.equal(entity.metadata.pipeline.ledgerSource, 'coordinateRows');
});

const segmentEntities = scene.entities.filter((entity) => entity.geometry.kind === 'segment')
  .sort((left, right) => left.metadata.pipeline.sourceIndex - right.metadata.pipeline.sourceIndex);
assert.equal(segmentEntities.length, snapshot.output.inputXmlCoordinateRows.length - 1);
segmentEntities.forEach((entity, index) => {
  const from = snapshot.output.inputXmlCoordinateRows[index];
  const to = snapshot.output.inputXmlCoordinateRows[index + 1];
  assert.deepEqual(point(entity.geometry.start), point(from));
  assert.deepEqual(point(entity.geometry.end), point(to));
  assert.equal(entity.id, `pipeline:${from.branchName}:segment:${from.nodeNumber}-${to.nodeNumber}`);
  assert.equal(entity.metadata.pipeline.ledgerSource, 'inputXmlCoordinateRows');
});

const markerEntities = reviewEntities.filter((entity) => entity.domainRef.category === 'markers');
const depthEntities = reviewEntities.filter((entity) => entity.domainRef.category === 'depthEvents');
assert(markerEntities.length >= 4, 'representative fixture must retain PMS markers');
assert(depthEntities.length >= 4, 'representative fixture must retain Table 3 depth evidence');
for (const entity of [...markerEntities, ...depthEntities]) {
  assert.equal(entity.metadata.pipeline.elevationAuthority, 'TABLE_2');
}
assert.equal(segmentEntities.some((entity) => /PMS|1\.5M|A\/G/.test(JSON.stringify(entity.metadata))), false);

const ids = scene.entities.map((entity) => entity.id);
const geometryLedger = scene.entities.map((entity) => ({ id: entity.id, geometry: entity.geometry }));
for (const projection of scene.projections) {
  const projected = scene.entities.map((entity) => ({
    id: entity.id,
    geometry: projectEngineeringGeometry(entity.geometry, projection),
  }));
  assert.deepEqual(projected.map((entry) => entry.id), ids, `${projection} must preserve Pipeline identity`);
  assert.deepEqual(scene.entities.map((entity) => ({ id: entity.id, geometry: entity.geometry })), geometryLedger);
}
assert.deepEqual(buildPipelineEngineeringSvgScene(snapshot, { sceneId: 'pipeline-fixture' }).scene, scene);
assert.throws(() => createPipelineEngineeringRevisionToken({ projectRevision: 'r1', geometryRevision: 'r1' }), /processConfigRevision/);
assert.throws(() => buildPipelineEngineeringSvgScene({ ...snapshot, revision: null }, { sceneId: 'pipeline-fixture' }), /revision/);

let currentSnapshot = snapshot;
const listeners = new Set();
const source = createPipelineEngineeringSvgAdapter({
  adapterId: 'pipeline-fixture-adapter', sceneId: 'pipeline-fixture',
  getSnapshot: () => currentSnapshot,
  subscribeSnapshot(listener) { listeners.add(listener); return () => listeners.delete(listener); },
});
assert.equal(source.adapter.descriptor.accessMode, 'read-only');
assert.equal(source.adapter.descriptor.capabilities.editing, false);
assert.equal(source.adapter.commandGateway, null);
assert.equal(source.adapter.snapProviders.length, 0);
const conformance = await runEngineeringSvgAdapterConformance(source.adapter);
assert.equal(conformance.passed, true);
assert.equal(listeners.size, 0);

const selected = [segmentEntities[0].id, markerEntities[0].id];
const propertySets = await source.adapter.propertyProvider.getPropertySets(selected, scene.revision);
assert.equal(JSON.stringify(snapshot), before, 'property requests must not mutate owner output');
const sceneSet = propertySets.find((set) => set.ownerIds.includes(scene.sceneId));
const segmentSet = propertySets.find((set) => set.ownerIds.includes(segmentEntities[0].id));
const markerSet = propertySets.find((set) => set.ownerIds.includes(markerEntities[0].id));
assert(sceneSet && segmentSet && markerSet);
assert(sceneSet.fields.every((value) => value.scope === 'SCENE' && value.editable === false));
assert(segmentSet.fields.every((value) => value.scope === 'ENTITY' && value.editable === false));
assert(markerSet.fields.every((value) => value.scope === 'ENTITY' && value.editable === false));
assert.equal(field(sceneSet, 'ledgerMode').value, 'dual');
assert.equal(field(sceneSet, 'routeGeometrySource').value, 'inputXmlCoordinateRows');
assert.equal(field(segmentSet, 'geometryLedgerSource').value, 'inputXmlCoordinateRows');
assert.equal(field(markerSet, 'reviewLedgerSource').value, 'coordinateRows');
const processKeys = new Set(['p1', 't1', 't2', 't3', 'fluidDensity', 'materialCode', 'insulationDensity', 'hydroPressure']);
assert(segmentSet.fields.every((value) => !processKeys.has(value.key)));
assert(markerSet.fields.every((value) => !processKeys.has(value.key)));
assert.equal(field(sceneSet, 'p1').value, '55');

const events = [];
const unsubscribe = source.adapter.subscribeScene((event) => events.push(event));
currentSnapshot = Object.freeze({
  ...snapshot,
  revision: createPipelineEngineeringRevisionToken({
    projectRevision: 'fixture-project-r2',
    geometryRevision: 'fixture-propagation-r1',
    processConfigRevision: 'fixture-process-r1',
  }),
});
for (const listener of listeners) listener({ snapshot: currentSnapshot, reason: 'project-revision-changed' });
assert.equal(events.length, 1);
assert.equal(events[0].reason, 'project-revision-changed');
assert.equal(events[0].scene.revision.value.projectRevision, 'fixture-project-r2');
assert.equal(JSON.stringify(snapshot), before, 'subscriptions must not mutate prior owner output');
unsubscribe();
assert.equal(listeners.size, 0);

console.log('Pipeline engineering SVG dual-ledger adapter parity and conformance: ok');
