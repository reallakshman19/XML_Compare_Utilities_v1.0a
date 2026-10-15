import assert from 'node:assert/strict';
import {
  createPipelineCadMarkupDocument,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-contracts.js';
import {
  buildPipelineCadMarkupEntityIndex,
  buildPipelineCadSourceFingerprint,
  derivePipelineCadDimensionEvidence,
  reconcilePipelineCadMarkupDocument,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-reconciliation.js';

const profile = {
  table2Rows: [
    { id: 'table2a-0001', sourceTable: 'table2a', sourceLine: 1, stationValue: 0, elevationValue: 10, basisH: 100 },
    { id: 'table2a-0002', sourceTable: 'table2a', sourceLine: 2, stationValue: 8, elevationValue: 16, basisH: 108 },
  ],
  table3LengthRows: [],
  table3DepthRows: [],
  table3MarkerRows: [{ id: 'table3c-0001', sourceTable: 'table3c', sourceLine: 1, absoluteH: 104, markerText: 'PM-001' }],
};
const entity = (graph, entityId, entityType) => ({ kind: 'ENTITY', graph, entityId, entityType, pointRole: 'CENTER' });
const sourceFingerprint = buildPipelineCadSourceFingerprint(profile);
assert.equal(sourceFingerprint, buildPipelineCadSourceFingerprint({
  ...profile, table2Rows: [...profile.table2Rows].reverse(),
}));
const document = createPipelineCadMarkupDocument({
  sourceFingerprint, nextSequence: 3,
  dimensions: [{
    schema: 'PipelineCadDimension.v1', dimensionId: 'pcad-dim-000001', graph: 'table2x',
    dimensionType: 'LINEAR_ALIGNED',
    firstAnchor: entity('table2x', 'table2a-0001', 'elevation-node'),
    secondAnchor: entity('table2x', 'table2a-0002', 'elevation-node'),
    offset: 0, labelMode: 'MEASURED', customLabel: '',
    measurementAuthority: 'ENGINEERING_PROFILE', status: 'ACTIVE',
    createdSequence: 1, revision: 1,
  }],
  annotations: [{
    schema: 'PipelineCadAnnotation.v1', annotationId: 'pcad-note-000002', graph: 'table3x',
    anchor: entity('table3x', 'table3c-0001', 'marker'), text: 'Exact marker',
    alignment: 'LEFT', leader: { enabled: false, dx: 0, dy: 0 },
    status: 'ACTIVE', createdSequence: 2, revision: 1,
  }],
});
const unchanged = reconcilePipelineCadMarkupDocument(document, profile);
assert.equal(unchanged.report.changed, false);
const nearbyButDifferentId = {
  ...profile,
  table3MarkerRows: [{ id: 'table3c-0099', sourceTable: 'table3c', sourceLine: 99, absoluteH: 104, markerText: 'PM-001' }],
};
const orphaned = reconcilePipelineCadMarkupDocument(document, nearbyButDifferentId);
assert.equal(orphaned.document.annotations[0].status, 'ORPHANED');
assert.deepEqual(orphaned.report.orphanedIds, ['pcad-note-000002']);
assert.equal(orphaned.report.changed, true);
const restored = reconcilePipelineCadMarkupDocument(orphaned.document, profile);
assert.equal(restored.document.annotations[0].status, 'ACTIVE');
assert.deepEqual(restored.report.activeIds, ['pcad-dim-000001', 'pcad-note-000002']);

const graphs = {
  table2x: { currentNodes: () => [
    { id: 'table2a-0001', type: 'elevation-node', x: 0, y: 10 },
    { id: 'table2a-0002', type: 'elevation-node', x: 8, y: 16 },
  ] },
  table3x: { depthNodes: () => [], markerNodes: () => [] },
};
const evidence = derivePipelineCadDimensionEvidence(document.dimensions[0], graphs);
assert.equal(evidence.value, 10);
graphs.table2x.currentNodes = () => [
  { id: 'table2a-0001', type: 'elevation-node', x: 0, y: 10 },
  { id: 'table2a-0002', type: 'elevation-node', x: 6, y: 18 },
];
assert.equal(derivePipelineCadDimensionEvidence(document.dimensions[0], graphs).value, 10);
assert.ok(Object.isFrozen(buildPipelineCadMarkupEntityIndex(profile)));
console.log('Pipeline CAD markup reconciliation: ok');
